/**
 * voice-relay.js — Puente WebSocket entre el navegador y Gemini Live API.
 *
 * El navegador NUNCA ve la API key. Flujo:
 *   navegador  --(ws /voz)-->  este relay  --(wss)-->  Gemini Live
 *
 * Protocolo navegador → relay:
 *   { type:'start', context:'<texto del dashboard>', ptt:true }  inicia la sesión
 *   { type:'audio', data:'<pcm16 16kHz base64>' }        chunk de micrófono
 *   { type:'activity_start' }                            (solo ptt) empieza a hablar
 *   { type:'activity_end' }                              (solo ptt) soltó el botón
 *   { type:'stop' }                                      cierra
 *
 * Con ptt:true se apaga la detección automática de voz de Gemini y el turno lo
 * marca el navegador (walkie-talkie): nada de lo que entre por el micrófono
 * cuenta hasta que llega activity_start, y Gemini no responde hasta activity_end.
 * Sin ptt el comportamiento es el de antes (Gemini decide cuándo hablaste).
 *
 * Protocolo relay → navegador:
 *   { type:'ready' }                       Gemini listo para escuchar
 *   { type:'audio', data:'<pcm16 24kHz>' } audio de respuesta
 *   { type:'text',  text:'...' }           transcripción parcial (si viene)
 *   { type:'interrupted' }                 el usuario interrumpió: limpia buffer
 *   { type:'turn_complete' }               terminó de responder
 *   { type:'error', msg:'...' }
 */

import WebSocket, { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';

const GEMINI_MODEL = process.env.GEMINI_LIVE_MODEL || 'models/gemini-3.1-flash-live-preview';
const GEMINI_WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const DEFAULT_SUPABASE_URL = 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';

function cleanEnv(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function resolveSupabaseUrl() {
  const configured = cleanEnv(process.env.SUPABASE_URL);
  const candidate = configured || DEFAULT_SUPABASE_URL;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
      throw new Error('not a Supabase project URL');
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    console.warn('[voz] SUPABASE_URL invalida; usando URL default del proyecto.');
    return DEFAULT_SUPABASE_URL;
  }
}

const SUPABASE_URL = resolveSupabaseUrl();
const SUPABASE_KEY = cleanEnv(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY);
const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const PLATFORM_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
  google_news: 'Google News',
  redes_propias: 'Redes propias (cuentas de Pepe)',
  resumen: 'Panorama consolidado del día',
};

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function shiftDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// Devuelve el rango y, cuando NADIE lo pidió explícitamente, `defaulted:true`.
// Ese flag viaja hasta la respuesta de la herramienta: un rango elegido por
// default no puede pasar por "consulté la fecha que me pediste".
function resolveDateRange({ from, to, question }) {
  const now = process.env.VOICE_TODAY ? new Date(process.env.VOICE_TODAY + 'T12:00:00') : new Date();
  const q = (question || '').toLowerCase();
  if (from && to) return { from, to, defaulted: false };
  if (from && !to) return { from, to: from, defaulted: false };
  // Solo `to`: ventana de 7 días que TERMINA en esa fecha (antes se ignoraba el dato).
  if (!from && to) return { from: iso(shiftDays(new Date(to + 'T12:00:00'), -6)), to, defaulted: false };
  if (q.includes('semana pasada')) {
    const day = now.getDay();
    const mondayThisWeek = shiftDays(now, day === 0 ? -6 : 1 - day);
    const mondayLastWeek = shiftDays(mondayThisWeek, -7);
    return { from: iso(mondayLastWeek), to: iso(shiftDays(mondayLastWeek, 6)), defaulted: false };
  }
  if (q.includes('ultimos 7') || q.includes('ultimos siete') || q.includes('últimos 7') || q.includes('últimos siete')) {
    return { from: iso(shiftDays(now, -6)), to: iso(now), defaulted: false };
  }
  if (q.includes('ayer')) {
    const y = iso(shiftDays(now, -1));
    return { from: y, to: y, defaulted: false };
  }
  if (q.includes('hoy')) {
    const today = iso(now);
    return { from: today, to: today, defaulted: false };
  }
  return { from: iso(shiftDays(now, -6)), to: iso(now), defaulted: true };
}

function normalizePlatform(platform) {
  if (!platform || platform === 'all') return null;
  const p = String(platform).toLowerCase().trim();
  if (p === 'twitter') return 'x';
  if (p === 'google news' || p === 'news') return 'google_news';
  return p;
}

function compactText(text, max = 220) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

// Las cuentas de Pepe son favorables por definición (su público lo sigue porque
// le gusta): promediarlas con lo que dicen terceros infla el favorable. En días
// sin datos de terceros el panorama sale verde por pura aritmética.
const OWN_ACCOUNTS_KEY = 'redes_propias';

const RANGO_POR_DEFAULT = (from, to) =>
  `OJO: nadie pidió estas fechas — al no recibir fecha usé los últimos 7 días (${from} a ${to}) por default. ` +
  'Si Pepe preguntó por un evento concreto (una presentación, una gira, una polémica), esta ventana probablemente NO lo incluye. ' +
  'Busca la fecha del evento en la LÍNEA DE TIEMPO del contexto y vuelve a consultar con esa fecha antes de afirmar nada.';

const prom = (nums) => {
  const xs = nums.filter(n => Number.isFinite(n));
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
};

export async function getDashboardData(args = {}) {
  if (!supabase) {
    return { error: 'Supabase no esta configurado en el servidor de voz.' };
  }

  const { from, to, defaulted } = resolveDateRange(args);
  const platform = normalizePlatform(args.platform);
  const limit = Math.min(Math.max(Number(args.limit || 30), 5), 80);

  // Solo material aprobado: los borradores del día no se le leen al cliente.
  // El `resumen` (panorama consolidado del día) SÍ entra: es el veredicto que manda.
  let reportsQuery = supabase
    .from('reports')
    .select('id,date_key,theme_key,ai_analysis,approved')
    .gte('date_key', from)
    .lte('date_key', to)
    .eq('approved', true)
    .order('date_key', { ascending: true });

  if (platform) reportsQuery = reportsQuery.eq('theme_key', platform);
  const { data: allReports, error: reportsError } = await reportsQuery;
  if (reportsError) return { error: reportsError.message, from, to, platform };

  if (!allReports?.length) {
    // Distinguir "no hay nada" de "hay análisis todavía en revisión": si se
    // confunden, el modelo contesta "no pasó nada" sobre un día sin publicar.
    const { count: pendientes } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .gte('date_key', from).lte('date_key', to).eq('approved', false);
    return {
      from, to, platform: platform || 'all', total_reports: 0,
      ...(defaulted ? { nota_rango: RANGO_POR_DEFAULT(from, to) } : {}),
      message: pendientes
        ? `El análisis de ${from} a ${to} todavía está en revisión y no se ha publicado. NO afirmes cómo fue el sentimiento de esas fechas: dile a Pepe que en cuanto se publique se lo cuentas.`
        : `No hay análisis publicado entre ${from} y ${to}. Dile a Pepe que de esas fechas no tienes datos en lugar de estimar.`,
    };
  }

  // El resumen no es una red: es el panorama del día. Se aparta del desglose.
  const resumenRows = allReports.filter(r => r.theme_key === 'resumen');
  const reports = allReports.filter(r => r.theme_key !== 'resumen');

  const reportIds = reports.map(r => r.id);
  const { data: posts, error: postsError } = await supabase
    .from('scraped_posts')
    .select('*')
    .in('report_id', reportIds)
    .order('likes', { ascending: false })
    .limit(limit);
  if (postsError) return { error: postsError.message, from, to, platform };

  const postIds = (posts || []).map(p => p.id);
  const { data: comments } = postIds.length
    ? await supabase
      .from('scraped_comments')
      .select('*')
      .in('post_id', postIds)
      .order('likes', { ascending: false })
      .limit(limit * 2)
    : { data: [] };

  const byReport = new Map(reports.map(r => [r.id, r]));

  // Sentimiento por red: PROMEDIO de los días del rango, no el máximo. Con
  // Math.max el "favorable" salía del mejor día y el "crítico" del peor, de
  // días distintos, y los dos números no eran comparables entre sí.
  const sentOf = (r) => {
    const s = r.ai_analysis?.sentimiento || {};
    const num = (...ks) => { for (const k of ks) if (s[k] != null) return Number(s[k]); return null; };
    return { fav: num('favorable', 'positivo', 'pos'), neu: num('neutral', 'neu'), cri: num('critico', 'negativo', 'neg') };
  };

  const acum = {};
  for (const r of reports) {
    const k = r.theme_key || 'sin_red';
    acum[k] ||= { reports: 0, posts: 0, comments: 0, fav: [], neu: [], cri: [], dias: [] };
    acum[k].reports += 1;
    const s = sentOf(r);
    acum[k].fav.push(s.fav); acum[k].neu.push(s.neu); acum[k].cri.push(s.cri);
    acum[k].dias.push(r.date_key);
  }
  for (const p of posts || []) {
    const report = byReport.get(p.report_id);
    const k = report?.theme_key || p.platform || 'sin_red';
    acum[k] ||= { reports: 0, posts: 0, comments: 0, fav: [], neu: [], cri: [], dias: [] };
    acum[k].posts += 1;
    acum[k].comments += Number(p.comments_count || 0);
  }

  const byPlatform = {};
  for (const [k, a] of Object.entries(acum)) {
    byPlatform[k] = {
      reports: a.reports, posts: a.posts, comments: a.comments,
      favorable: prom(a.fav), neutral: prom(a.neu), critico: prom(a.cri),
      dias_con_analisis: [...new Set(a.dias)].length,
      ...(k === OWN_ACCOUNTS_KEY ? {
        ojo: 'Son las CUENTAS DE PEPE: su propio público. NO es sentimiento público ni opinión de terceros. Nunca cites este número como "la gente opina"; úsalo solo para hablar del rendimiento de sus publicaciones.',
      } : {}),
    };
  }

  // Lo que opinan TERCEROS: promedio de las redes sin las cuentas propias.
  const terceros = reports.filter(r => r.theme_key !== OWN_ACCOUNTS_KEY).map(sentOf);
  const sentimientoTerceros = terceros.length ? {
    favorable: prom(terceros.map(s => s.fav)),
    neutral: prom(terceros.map(s => s.neu)),
    critico: prom(terceros.map(s => s.cri)),
    redes_incluidas: [...new Set(reports.filter(r => r.theme_key !== OWN_ACCOUNTS_KEY).map(r => PLATFORM_LABELS[r.theme_key] || r.theme_key))],
    nota: 'Esta es la lectura pública real (sin las cuentas de Pepe). Es la que vale cuando pregunta "cómo me recibieron" o "qué dice la gente".',
  } : null;

  // Panorama consolidado por día: el veredicto oficial del semáforo. Manda sobre
  // cualquier lectura por red — antes se excluía y el modelo elegía la red que
  // más le gustaba (para el 18 jul: Instagram favorable, ignorando el 54% crítico).
  const panoramaPorDia = resumenRows.map(r => {
    const s = sentOf(r);
    return {
      date: r.date_key,
      favorable: s.fav, neutral: s.neu, critico: s.cri,
      nivel_riesgo: r.ai_analysis?.nivel_riesgo || '',
      lectura: compactText(Array.isArray(r.ai_analysis?.resumen_ejecutivo)
        ? r.ai_analysis.resumen_ejecutivo.join(' · ')
        : (r.ai_analysis?.resumen_ejecutivo || ''), 320),
    };
  });

  const commentsByPost = {};
  for (const c of comments || []) {
    commentsByPost[c.post_id] ||= [];
    if (commentsByPost[c.post_id].length < 5) {
      commentsByPost[c.post_id].push({
        author: c.username || c.author || '',
        text: compactText(c.text, 180),
        likes: c.likes || 0,
        sentiment: c.sentiment || '',
      });
    }
  }

  const topPosts = (posts || []).slice(0, 15).map(p => {
    const report = byReport.get(p.report_id);
    // Desglose de reacciones de FB: si 😂/😡 dominan sobre 👍 es burla/molestia (señal clave).
    const rxTotal = (p.fb_like||0)+(p.fb_love||0)+(p.fb_haha||0)+(p.fb_wow||0)+(p.fb_sad||0)+(p.fb_angry||0);
    const reactions = rxTotal
      ? { like: p.fb_like||0, love: p.fb_love||0, haha: p.fb_haha||0, wow: p.fb_wow||0, sad: p.fb_sad||0, angry: p.fb_angry||0 }
      : undefined;
    return {
      date: report?.date_key || '',
      platform: PLATFORM_LABELS[report?.theme_key || p.platform] || report?.theme_key || p.platform || '',
      author: p.username || '',
      text: compactText(p.text),
      url: p.url || '',
      likes: p.likes || 0,
      views: p.views || 0,
      comments_count: p.comments_count || 0,
      sentiment: p.sentiment || '',
      ...(reactions ? { reactions } : {}),
      comments: commentsByPost[p.id] || [],
    };
  });

  const nombresVoces = (lista) => (Array.isArray(lista) ? lista : [])
    .map(v => (typeof v === 'string' ? v : (v?.username || v?.nombre || '')))
    .filter(Boolean)
    .slice(0, 8);

  const aiHighlights = allReports
    .map(r => {
      const ai = r.ai_analysis || {};
      // La "lectura" real vive en el desglose de la red; si no, usa el resumen ejecutivo.
      const lecturaRed = ai.desglose_por_red?.[r.theme_key]?.lectura;
      const resumenEj = Array.isArray(ai.resumen_ejecutivo)
        ? ai.resumen_ejecutivo.join(' · ')
        : (ai.resumen_ejecutivo || '');
      const alertas = (Array.isArray(ai.alertas) ? ai.alertas : [])
        .map(a => (typeof a === 'string' ? a : (a?.text || a?.alerta || ''))).filter(Boolean);
      return {
        date: r.date_key,
        platform: PLATFORM_LABELS[r.theme_key] || r.theme_key,
        lectura: lecturaRed || resumenEj || '',
        nivel_riesgo: ai.nivel_riesgo || '',
        alertas,
        oportunidades: Array.isArray(ai.oportunidades) ? ai.oportunidades : [],
        aliados: nombresVoces(ai.analisis_voces?.aliados_destacados),
        contrarios: nombresVoces(ai.analisis_voces?.criticos_destacados),
      };
    })
    .filter(x => x.lectura || x.alertas.length || x.aliados.length || x.contrarios.length)
    .slice(0, 12);

  // Comparativa vs el periodo anterior del mismo largo: "¿voy mejor o peor?" es la
  // pregunta que más importa; se responde sin que Pepe tenga que pedirla dos veces.
  let comparativa = null;
  try {
    const days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);
    const prevTo = iso(shiftDays(new Date(from + 'T12:00:00'), -1));
    const prevFrom = iso(shiftDays(new Date(from + 'T12:00:00'), -days));
    const avgSent = async (f, t) => {
      const { data } = await supabase
        .from('reports').select('ai_analysis')
        .gte('date_key', f).lte('date_key', t)
        .eq('theme_key', 'resumen').eq('approved', true).not('ai_analysis', 'is', null);
      let fav = 0, cri = 0, n = 0;
      for (const r of data || []) {
        const s = r.ai_analysis?.sentimiento || {};
        const fv = Number(s.favorable || 0), cr = Number(s.critico || 0);
        if (fv || cr) { fav += fv; cri += cr; n++; }
      }
      return n ? { favorable: Math.round(fav / n), critico: Math.round(cri / n), dias_con_datos: n } : null;
    };
    const [actual, anterior] = await Promise.all([avgSent(from, to), avgSent(prevFrom, prevTo)]);
    if (actual && anterior) {
      comparativa = {
        periodo_actual: { from, to, ...actual },
        periodo_anterior: { from: prevFrom, to: prevTo, ...anterior },
        delta: { favorable: actual.favorable - anterior.favorable, critico: actual.critico - anterior.critico },
        nota: 'delta positivo en favorable = va mejor; delta positivo en critico = empeoró. Úsalo para decirle a Pepe si va mejor o peor que el periodo anterior, con los puntos de diferencia.',
      };
    }
  } catch { /* comparativa es best-effort */ }

  return {
    from,
    to,
    platform: platform || 'all',
    total_reports: allReports.length,
    total_posts: posts?.length || 0,
    total_comments_sampled: comments?.length || 0,
    ...(defaulted ? { nota_rango: RANGO_POR_DEFAULT(from, to) } : {}),
    ...(panoramaPorDia.length ? { panorama_por_dia: panoramaPorDia } : {}),
    ...(sentimientoTerceros ? { sentimiento_terceros: sentimientoTerceros } : {}),
    by_platform: byPlatform,
    top_posts: topPosts,
    ai_highlights: aiHighlights,
    ...(comparativa ? { comparativa } : {}),
    instruction: 'Responde en español, breve y claro. Para decir cómo fue recibido algo usa `sentimiento_terceros` y el `panorama_por_dia`, NUNCA el promedio de todas las redes ni las cuentas propias. Si una red se ve favorable y otra crítica, dilo así: el promedio esconde la división. Si el usuario pide links, menciona que puede abrirlos en el dashboard y cita los URLs disponibles.',
  };
}

const VOICE_TOOLS = [{
  functionDeclarations: [{
    name: 'get_dashboard_data',
    description: 'Consulta Supabase para responder preguntas historicas o por rango de fechas sobre menciones, posts, comentarios, sentimiento, aliados, contrarios y redes sociales de Pepe Aguilar.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Pregunta original del usuario.' },
        from: { type: 'string', description: 'Fecha inicial YYYY-MM-DD. Si el usuario dice semana pasada, calcula el lunes de la semana pasada.' },
        to: { type: 'string', description: 'Fecha final YYYY-MM-DD.' },
        platform: { type: 'string', description: 'facebook, instagram, x, tiktok, google_news, redes_propias o all.' },
        limit: { type: 'number', description: 'Maximo de publicaciones a revisar, entre 5 y 80.' },
      },
      required: ['question'],
    },
  }],
}];

// ─── Memoria de conversaciones (para dar sensación de continuidad) ─────────────
// Trae el resumen de las últimas 1-2 sesiones. Solo resúmenes cortos → costo mínimo de tokens.
// Devuelve también la fecha de la última sesión para calcular "novedades desde entonces".
async function fetchRecentMemory(maxSessions = 2) {
  if (!supabase) return { block: '', lastDate: null };
  try {
    const { data } = await supabase
      .from('voice_sessions')
      .select('created_at, summary')
      .not('summary', 'is', null)
      .order('created_at', { ascending: false })
      .limit(maxSessions);
    if (!data?.length) return { block: '', lastDate: null };
    const lastDate = (data[0].created_at || '').slice(0, 10) || null;
    const bloques = data.reverse().map(s => `- (${(s.created_at || '').slice(0, 10)}) ${s.summary}`);
    const block = `\n=== MEMORIA DE CONVERSACIONES ANTERIORES ===\nContexto de lo último que habló Pepe contigo. Retómalo con naturalidad SOLO si es relevante (ej. "la última vez me comentaste que te preocupaba Instagram, ¿seguimos con eso?"). No lo recites literal.\n${bloques.join('\n')}\n`;
    return { block, lastDate };
  } catch { return { block: '', lastDate: null }; }
}

// ─── Perfil persistente de Pepe (memoria larga entre sesiones) ─────────────────
// Hechos duraderos que el resumidor va extrayendo: temas que le preocupan, cómo le
// gusta que le hablen, pendientes. Es lo que hace que Orwell "lo conozca".
async function fetchProfile(maxFacts = 15) {
  if (!supabase) return { block: '', facts: [] };
  try {
    const { data } = await supabase
      .from('voice_profile')
      .select('fact, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(maxFacts);
    if (!data?.length) return { block: '', facts: [] };
    const facts = data.map(f => f.fact);
    const block = `\n=== PERFIL DE PEPE (lo que sabes de él por conversaciones pasadas) ===\nÚsalo para personalizar el trato: retoma sus pendientes, respeta sus preferencias, no le repitas lo que ya sabe. Nunca recites esta lista.\n${facts.map(f => `- ${f}`).join('\n')}\n`;
    return { block, facts };
  } catch { return { block: '', facts: [] }; }
}

// ─── Brief del día + novedades desde la última sesión (server-side) ────────────
// Garantiza que Orwell SIEMPRE sepa lo de hoy aunque el contexto del navegador
// llegue delgado (ej. Pepe entra directo al orbe de voz sin cargar el dashboard).
// Índice fecha → qué pasó, con TODO el histórico publicado. Sin esto el modelo no
// puede traducir "mi presentación con Grupo Frontera" a una fecha, y la herramienta
// termina consultando los últimos 7 días por default (que no contienen el evento).
async function fetchTimeline(maxDays = 90) {
  if (!supabase) return '';
  try {
    const { data: reps } = await supabase
      .from('reports')
      .select('date_key, ai_analysis')
      .eq('theme_key', 'resumen')
      .eq('approved', true)
      .not('ai_analysis', 'is', null)
      .order('date_key', { ascending: false })
      .limit(maxDays);
    if (!reps?.length) return '';

    const lineas = reps
      .filter(r => r.ai_analysis?._fuente !== 'historico-migrado')
      .map(r => {
        const ai = r.ai_analysis || {};
        const s = ai.sentimiento || {};
        const ej = Array.isArray(ai.resumen_ejecutivo) ? ai.resumen_ejecutivo[0] : ai.resumen_ejecutivo;
        return `${r.date_key} | ${s.favorable ?? '?'}% fav / ${s.critico ?? '?'}% crít (riesgo ${ai.nivel_riesgo || '?'}) | ${compactText(ej, 190)}`;
      })
      .reverse();
    if (!lineas.length) return '';

    return `\n=== LÍNEA DE TIEMPO · FECHA → QUÉ PASÓ (histórico publicado) ===
Úsala SIEMPRE que Pepe mencione un evento sin decir la fecha (una presentación, una gira, una polémica, "cuando canté con...").
Localiza el día aquí, y recién entonces llama a get_dashboard_data con ESA fecha en from y to. Nunca contestes por un evento con la ventana por default.
${lineas.join('\n')}\n`;
  } catch { return ''; }
}

async function fetchServerBrief(lastSessionDate) {
  if (!supabase) return '';
  try {
    const { data: reps } = await supabase
      .from('reports')
      .select('date_key, theme_key, ai_analysis')
      .eq('approved', true)
      .not('ai_analysis', 'is', null)
      .order('date_key', { ascending: false })
      .limit(40);
    if (!reps?.length) return '';

    const L = [];
    // Resumen más reciente (el panorama del último día analizado, ignorando placeholders migrados)
    const latest = reps.find(r => r.theme_key === 'resumen' && r.ai_analysis?._fuente !== 'historico-migrado')
      || reps.find(r => r.theme_key === 'resumen');
    if (latest) {
      const ai = latest.ai_analysis || {};
      const s = ai.sentimiento || {};
      L.push(`=== RESUMEN MÁS RECIENTE (${latest.date_key}, cargado por el servidor) ===`);
      L.push(`Sentimiento: favorable ${s.favorable ?? '?'}% / neutral ${s.neutral ?? '?'}% / crítico ${s.critico ?? '?'}%. Riesgo: ${ai.nivel_riesgo || '?'}.`);
      const pts = Array.isArray(ai.resumen_ejecutivo) ? ai.resumen_ejecutivo : [];
      pts.slice(0, 3).forEach(p => L.push(`· ${compactText(p, 260)}`));
    }
    // Novedades desde la última conversación: alertas y días de riesgo nuevos
    if (lastSessionDate) {
      const nuevos = reps.filter(r => r.date_key > lastSessionDate && r.ai_analysis?._fuente !== 'historico-migrado');
      const items = [];
      for (const r of nuevos) {
        const ai = r.ai_analysis || {};
        if (['alto', 'muy_alto'].includes((ai.nivel_riesgo || '').toLowerCase())) {
          items.push(`(${r.date_key}) ${PLATFORM_LABELS[r.theme_key] || r.theme_key} marcó riesgo ${ai.nivel_riesgo}.`);
        }
        (Array.isArray(ai.alertas) ? ai.alertas : []).slice(0, 1).forEach(a => {
          const t = typeof a === 'string' ? a : (a?.text || a?.alerta || '');
          if (t) items.push(`(${r.date_key}) ${compactText(t, 200)}`);
        });
      }
      if (items.length) {
        L.push(`\n=== NOVEDADES DESDE TU ÚLTIMA CONVERSACIÓN CON PEPE (${lastSessionDate}) ===`);
        L.push('Esto pasó desde la última vez que hablaron. Tu PRIMER saludo debe abrir con lo más importante de aquí (máximo 2 cosas), como quien le cuenta a un amigo qué se perdió.');
        [...new Set(items)].slice(0, 6).forEach(i => L.push(`- ${i}`));
      }
    }
    return L.length ? `\n${L.join('\n')}\n` : '';
  } catch { return ''; }
}

// ─── Personalidad de Orwell (guía de estilo fija, va siempre en el prompt) ──────
const ORWELL_STYLE = `
=== PERSONALIDAD Y ESTILO (OBLIGATORIO) ===
- Eres Orwell: el consejero de confianza de Pepe Aguilar en temas de reputación. No un robot que lee cifras: un analista cercano que lo conoce y quiere que le vaya bien.
- Habla en español mexicano, cálido y directo. Frases cortas, lenguaje natural de conversación, cero jerga corporativa ("engagement rate" → "cuánta gente reaccionó").
- ES UNA CONVERSACIÓN DE VOZ: responde en 2 a 4 frases por turno. Si hay más que contar, ofrece: "¿quieres que entre al detalle?".
- Números HABLABLES: di "casi cinco mil likes", no "cuatro mil setecientos setenta y siete". Redondea siempre al hablar.
- Celebra los logros con emoción genuina y el dato en la mano ("tu reel de la Feria rompió veintiún mil reacciones, Pepe — eso casi nadie lo logra").
- Las malas noticias se dicen completas pero con salida: qué está pasando + qué se puede hacer. Nunca alarmes sin plan.
- Si en un post de Facebook las reacciones de risa (haha) o enojo (angry) dominan sobre los likes, dilo: es señal de burla o molestia aunque el total se vea alto.
- APERTURA: tu primer turno SIEMPRE saluda a Pepe por su nombre con calidez y dale un briefing corto (máximo 4 frases) con lo más importante de las NOVEDADES o del RESUMEN MÁS RECIENTE, y cierra preguntándole por dónde quiere empezar.
- CIERRE RITUAL: cuando notes que la conversación va terminando (Pepe se despide o agradece), despídete dejando una cita concreta: recuérdale que cada mañana a las 7 llega el reporte nuevo y que te pregunte cómo amaneció la conversación. Que se quede con un motivo para volver mañana.
- SALUDA UNA SOLA VEZ: el saludo y el briefing de apertura van SOLO en tu primer turno de la sesión. Si ya saludaste, nunca vuelvas a presentarte ni a repetir el resumen inicial, aunque el turno se haya cortado a media frase o Pepe se quede callado. Retoma donde iban.

=== REGLAS SOBRE LOS DATOS (INVIOLABLES) ===
1. NO AFIRMES UN SENTIMIENTO SIN HABERLO CONSULTADO. Si Pepe pregunta cómo recibieron algo (una presentación, una colaboración, una entrevista) y no consultaste ESA fecha con get_dashboard_data, no contestes: primero ubica la fecha en la LÍNEA DE TIEMPO y consúltala. Está prohibido contestar "fue muy positivo" con lo que recuerdes del contexto general.
2. LOS REPORTES DE BLACKWELL MANDAN. Si Pepe dice que un reporte, documento o correo de Blackwell dice algo distinto a lo que tú ves, el reporte tiene razón y tú te equivocaste. Nunca sugieras que el reporte está confundido, que habla de otro tema o que tiene mal las fechas. Responde: reconoce la diferencia, pídele la fecha del reporte, consúltala y corrige tu lectura en voz alta ("tienes razón, Pepe, déjame ver ese día... efectivamente...").
3. LAS CUENTAS PROPIAS NO SON EL PÚBLICO. "Redes propias" es el público que YA sigue a Pepe: favorable por definición. Nunca la presentes como "la gente opina" ni la promedies con terceros. Para cómo lo recibió la gente usa el sentimiento de terceros y el panorama del día.
4. EL PROMEDIO PUEDE ESCONDER UNA DIVISIÓN. Cuando una red va favorable y otra crítica el mismo día, dilo explícitamente con las dos cifras; es la información que más le sirve. Un evento puede celebrarse en Instagram y ser masacrado en Facebook y TikTok: eso NO es "recepción positiva".
5. SIN DATO, DILO. Si no hay análisis publicado de esas fechas, o el rango que consultaste no cubre lo que Pepe preguntó, dilo con naturalidad ("de ese día todavía no tengo el análisis publicado") en lugar de estimar. Nunca inventes cifras ni digas que revisaste algo que no revisaste.
`;

// Al cerrar la sesión: resume la charla, extrae hechos duraderos para el perfil
// y guarda ambos para la próxima vez.
async function summarizeAndStore({ transcript, questions, aiKey, knownFacts = [] }) {
  if (!supabase) return;
  const userTurns = transcript.filter(t => t.role === 'user');
  if (!userTurns.length) return; // sesión vacía, no guardar

  let summary = '';
  let facts = [];
  if (aiKey) {
    try {
      const convo = transcript
        .map(t => `${t.role === 'user' ? 'Pepe' : 'Orwell'}: ${t.text}`)
        .join('\n').slice(0, 6000);
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: `Analiza la conversación de Pepe Aguilar con su asistente de voz y devuelve SOLO JSON válido con esta forma exacta:
{"resumen":"2-3 frases en español de qué habló y qué le preocupaba o pidió","hechos":["..."]}
"hechos" = máximo 3 datos DURADEROS sobre Pepe que sirvan en futuras conversaciones: temas que le preocupan o interesan, preferencias de cómo quiere que le hablen, pendientes que dijo que haría, cosas que pidió no repetirle. NO incluyas datos puntuales del día (métricas, notas) ni nada que ya esté en esta lista de hechos conocidos: ${JSON.stringify(knownFacts.slice(0, 15))}. Si no hay hechos nuevos, "hechos" va vacío.` },
            { role: 'user', content: convo },
          ],
        }),
      });
      const j = await resp.json();
      const raw = (j.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
      try {
        const parsed = JSON.parse(raw);
        summary = String(parsed.resumen || '').trim();
        facts = (Array.isArray(parsed.hechos) ? parsed.hechos : []).map(f => String(f).trim()).filter(Boolean).slice(0, 3);
      } catch { summary = raw; }
    } catch (e) { console.warn('[voz] resumen falló:', e?.message || e); }
  }
  if (!summary) summary = 'Pepe preguntó: ' + questions.slice(0, 5).join(' | ');

  // Hechos nuevos → perfil persistente (si la tabla no existe, solo avisa)
  if (facts.length) {
    try {
      await supabase.from('voice_profile').insert(facts.map(fact => ({ fact })));
      console.log(`[voz] ${facts.length} hecho(s) nuevos guardados en voice_profile.`);
    } catch (e) { console.warn('[voz] no se pudo guardar el perfil (¿existe la tabla voice_profile?):', e?.message || e); }
  }

  try {
    await supabase.from('voice_sessions').insert({
      ended_at: new Date().toISOString(),
      turns: userTurns.length,
      user_questions: questions,
      transcript,
      summary,
    });
    console.log(`[voz] sesión guardada en voice_sessions (${userTurns.length} turnos, ${questions.length} preguntas).`);
  } catch (e) { console.warn('[voz] no se pudo guardar la sesión (¿existe la tabla voice_sessions?):', e?.message || e); }
}

// Exportados también para pruebas (no requieren Gemini).
export { fetchRecentMemory, fetchProfile, fetchServerBrief };

export function attachVoiceRelay(server, { geminiKey, aiKey }) {
  const wss = new WebSocketServer({ noServer: true });

  // Allowlist de orígenes; '*' (o sin definir) deja pasar todo, igual que el CORS HTTP.
  // Acepta lista separada por comas y normaliza la barra final para evitar falsos 403.
  const norm = (s) => (s || '').trim().replace(/\/+$/, '');
  const allowList = norm(process.env.ALLOWED_ORIGIN || '*').split(',').map(norm).filter(Boolean);
  const allowAll = allowList.length === 0 || allowList.includes('*');
  const originOk = (origin) => allowAll || !origin || allowList.includes(norm(origin));
  console.log(`[voz] allowlist de origenes: ${allowAll ? '* (todos)' : allowList.join(', ')}`);

  server.on('upgrade', (req, socket, head) => {
    let pathname = '/';
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { /* noop */ }
    if (pathname !== '/voz') { socket.destroy(); return; }
    const origin = req.headers.origin;
    if (!originOk(origin)) {
      console.warn(`[voz] 403 upgrade rechazado. origin="${origin}" no está en la allowlist.`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    console.log(`[voz] upgrade aceptado. origin="${origin || '(sin origin)'}"`);
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  wss.on('connection', (client) => {
    console.log('[voz] cliente conectado al relay.');
    let google = null;
    let googleReady = false;
    let ptt = false;              // walkie-talkie: el turno lo marca el navegador
    const pending = [];           // payloads para Gemini que llegaron antes de setupComplete

    // Estado de la sesión para capturar preguntas y guardar memoria al final.
    const transcript = [];
    const questions = [];
    let userBuf = '';
    let asstBuf = '';
    let saved = false;
    let knownFacts = []; // hechos del perfil ya conocidos (para no duplicar al extraer)
    const finalize = () => {
      if (saved) return;
      saved = true;
      summarizeAndStore({ transcript, questions, aiKey, knownFacts }).catch(() => {});
    };

    const toClient = (obj) => { try { client.send(JSON.stringify(obj)); } catch { /* closed */ } };

    // Encola hasta que Gemini responda setupComplete; el orden importa
    // (activityStart tiene que llegar antes que su audio).
    const sendToGoogle = (payload) => {
      if (!googleReady) { pending.push(payload); return; }
      if (google && google.readyState === 1) google.send(JSON.stringify(payload));
    };

    // Formato nuevo de la Live API: realtimeInput.audio (mediaChunks daba code 1007).
    const sendAudioToGoogle = (b64) =>
      sendToGoogle({ realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: b64 } } });

    client.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === 'start') {
        if (!geminiKey) { console.warn('[voz] start sin GEMINI_API_KEY'); toClient({ type: 'error', msg: 'Falta GEMINI_API_KEY en el servidor.' }); return; }
        if (google) return; // ya iniciada
        ptt = msg.ptt === true;

        // Antes de abrir Gemini: memoria de sesiones, perfil de Pepe y brief del día
        // (todo en paralelo; solo resúmenes cortos → costo mínimo de tokens).
        const [memoria, perfil, timeline] = await Promise.all([fetchRecentMemory(), fetchProfile(), fetchTimeline()]);
        const brief = await fetchServerBrief(memoria.lastDate);
        knownFacts = perfil.facts;

        // Voz prebuilt de Gemini (más natural que la default). Configurable con
        // VOICE_NAME en el entorno; VOICE_NAME=off la desactiva si diera problemas.
        const voiceName = cleanEnv(process.env.VOICE_NAME) || 'Charon';
        const speechConfig = voiceName.toLowerCase() === 'off' ? {}
          : { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } };

        // Walkie-talkie: sin VAD automático, el turno lo abre y lo cierra el navegador.
        // START_OF_ACTIVITY_INTERRUPTS = presionar el botón corta a Orwell a media frase.
        // TURN_INCLUDES_ONLY_ACTIVITY = lo que entre fuera del botón no cuenta como turno.
        const realtimeInputConfig = ptt ? {
          realtimeInputConfig: {
            automaticActivityDetection: { disabled: true },
            activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
            turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
          },
        } : {};

        console.log(`[voz] start recibido. Conectando a Gemini (${GEMINI_MODEL}, voz=${voiceName}, ptt=${ptt})...`);
        google = new WebSocket(`${GEMINI_WS}?key=${geminiKey}`);

        google.onopen = () => {
          console.log('[voz] WS a Gemini abierto, enviando setup.');
          google.send(JSON.stringify({
            setup: {
              model: GEMINI_MODEL,
              generationConfig: { responseModalities: ['AUDIO'], ...speechConfig },
              systemInstruction: { parts: [{ text: `${msg.context || ''}

Te llamas ORWELL. Si Pepe te pregunta tu nombre o cómo te llamas, responde con calidez que eres Orwell, su analista de reputación. Puedes presentarte como Orwell en tu primer saludo.
${ORWELL_STYLE}${memoria.block}${perfil.block}${timeline}${brief}
Tambien tienes acceso a la herramienta get_dashboard_data para consultar Supabase en vivo. Usala SIEMPRE que Pepe pregunte por fechas, rangos, historico, "semana pasada", "ayer", comparativas, posts, comentarios, links, aliados o contrarios que no esten explicitamente en el contexto visible. No inventes datos: primero consulta la herramienta y despues responde.` }] },
              tools: VOICE_TOOLS,
              // Habilita transcripción de lo que dice el usuario y lo que responde Gemini.
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              ...realtimeInputConfig,
            },
          }));
        };

        google.onmessage = async (ev) => {
          let text;
          try {
            if (typeof ev.data === 'string') text = ev.data;
            else if (ev.data?.arrayBuffer) text = Buffer.from(await ev.data.arrayBuffer()).toString('utf8');
            else text = Buffer.from(ev.data).toString('utf8');
          } catch { return; }

          let data;
          try { data = JSON.parse(text); } catch { return; }

          if (data.setupComplete) {
            console.log('[voz] Gemini setupComplete → ready.');
            googleReady = true;
            toClient({ type: 'ready' });
            const queued = pending.splice(0, pending.length);
            queued.forEach(sendToGoogle);
            return;
          }

          if (data.toolCall?.functionCalls?.length) {
            const functionResponses = [];
            for (const call of data.toolCall.functionCalls) {
              if (call.name !== 'get_dashboard_data') {
                functionResponses.push({ id: call.id, name: call.name, response: { error: 'Herramienta no soportada.' } });
                continue;
              }
              try {
                console.log('[voz] tool get_dashboard_data', JSON.stringify(call.args || {}));
                const result = await getDashboardData(call.args || {});
                functionResponses.push({ id: call.id, name: call.name, response: result });
              } catch (e) {
                console.error('[voz] error en tool get_dashboard_data:', e?.message || e);
                functionResponses.push({ id: call.id, name: call.name, response: { error: e?.message || 'Error consultando Supabase.' } });
              }
            }
            google.send(JSON.stringify({ toolResponse: { functionResponses } }));
          }

          const sc = data.serverContent;
          if (sc) {
            for (const part of (sc.modelTurn?.parts || [])) {
              if (part.inlineData?.data) toClient({ type: 'audio', data: part.inlineData.data });
              if (part.text) toClient({ type: 'text', role: 'assistant', text: part.text });
            }
            // Transcripciones (llegan en fragmentos; audio y texto pueden venir en el mismo mensaje).
            if (sc.outputTranscription?.text) { toClient({ type: 'text', role: 'assistant', text: sc.outputTranscription.text }); asstBuf += sc.outputTranscription.text; }
            if (sc.inputTranscription?.text) { toClient({ type: 'text', role: 'user', text: sc.inputTranscription.text }); userBuf += sc.inputTranscription.text; }
            if (sc.interrupted) toClient({ type: 'interrupted' });
            if (sc.turnComplete) {
              toClient({ type: 'turn_complete' });
              // Cierra el turno: guarda lo que dijo Pepe (pregunta) y lo que respondió Orwell.
              const u = userBuf.trim();
              const a = asstBuf.trim();
              if (u) { transcript.push({ role: 'user', text: u }); questions.push(u); }
              if (a) transcript.push({ role: 'assistant', text: a });
              userBuf = '';
              asstBuf = '';
            }
          }
        };

        google.onerror = (ev) => {
          console.error('[voz] error WS Gemini:', ev?.message || ev?.error?.message || 'sin detalle');
          toClient({ type: 'error', msg: 'Error de conexión con Gemini.' });
        };
        google.onclose = (ev) => {
          const reason = ev?.reason ? ` reason="${ev.reason}"` : '';
          console.log(`[voz] WS Gemini cerrado. code=${ev?.code}${reason} (ready=${googleReady})`);
          // Si Gemini cierra ANTES de estar listo, es un fallo (modelo/key/formato): repórtalo como error.
          if (!googleReady) toClient({ type: 'error', msg: `Gemini cerró la conexión (code ${ev?.code}${reason}).` });
          else toClient({ type: 'closed', code: ev?.code });
        };
        return;
      }

      if (msg.type === 'audio') {
        sendAudioToGoogle(msg.data);
        return;
      }

      // Walkie-talkie: el navegador abre y cierra el turno con el botón.
      if (msg.type === 'activity_start' || msg.type === 'activity_end') {
        if (!ptt) return; // en modo automático Gemini decide los turnos
        const key = msg.type === 'activity_start' ? 'activityStart' : 'activityEnd';
        sendToGoogle({ realtimeInput: { [key]: {} } });
        return;
      }

      if (msg.type === 'stop') {
        finalize();
        try { google?.close(); } catch { /* noop */ }
      }
    });

    client.on('close', () => { finalize(); try { google?.close(); } catch { /* noop */ } });
  });

  return wss;
}
