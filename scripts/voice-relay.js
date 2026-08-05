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

// ─── Herramientas de consulta (todo se busca en las tablas, nada de memoria) ───
// Portadas del MCP, recortadas para voz: pocas filas y textos cortos, porque la
// respuesta se escucha, no se lee.

const ENG = p => (p.likes || 0) + (p.comments_count || 0) * 2 + ((p.shares || 0) + (p.retweets || 0)) * 3;

// Una captura del mismo post cada día llegaba como filas distintas (y Facebook
// reescribe la URL), así que se deduplica por texto normalizado y se conserva la
// versión con más engagement.
const dedupPosts = (filas) => {
  const porClave = new Map();
  for (const f of filas || []) {
    const clave = `${f.platform || ''}|${String(f.text || '').replace(/\s+/g, ' ').trim().slice(0, 160).toLowerCase()}`;
    const prev = porClave.get(clave);
    if (!prev || ENG(f) > ENG(prev)) porClave.set(clave, f);
  }
  return [...porClave.values()];
};

// PostgREST rompe el filtro ilike con comas, paréntesis o comodines.
const limpiaBusqueda = (texto) => String(texto || '').replace(/[,()*%"'\\;:{}[\]&=]/g, ' ').split(/\s+/).filter(Boolean).join(' ');

const rangoPosts = (q, from, to) => {
  if (from) q = q.gte('published_date', from);
  if (to) q = q.lte('published_date', to + 'T23:59:59');
  return q;
};

// ── Buscar por tema: la pregunta humana no trae fecha ("¿qué dijeron de mi
// presentación con Grupo Frontera?"). Devuelve en qué días aparece el tema.
export async function buscarTema(args = {}) {
  if (!supabase) return { error: 'Base no configurada.' };
  const tema = limpiaBusqueda(args.tema || args.question);
  if (!tema) return { error: 'Dime qué tema buscar.' };
  const n = Math.min(Math.max(Number(args.limit || 8), 3), 20);
  const red = normalizePlatform(args.red || args.platform);
  const patron = `%${tema}%`;

  let qp = supabase.from('scraped_posts')
    .select('text,username,platform,theme_key,url,likes,views,comments_count,sentiment,published_date,fb_haha,fb_angry,fb_like')
    .ilike('text', patron).order('likes', { ascending: false }).limit(120);
  if (red) qp = qp.eq('theme_key', red);
  qp = rangoPosts(qp, args.from, args.to);

  const [{ data: posts }, { data: comentarios }, { data: analisis }] = await Promise.all([
    qp,
    supabase.from('scraped_comments').select('text,author,likes,published_time')
      .ilike('text', patron).order('likes', { ascending: false }).limit(40),
    supabase.from('reports').select('date_key,theme_key,ai_analysis')
      .eq('approved', true).not('ai_analysis', 'is', null)
      .order('date_key', { ascending: false }).limit(300),
  ]);

  // Los análisis se filtran en memoria: el tema puede estar en cualquier parte del JSON.
  const termino = tema.toLowerCase();
  const enAnalisis = (analisis || [])
    .filter(r => JSON.stringify(r.ai_analysis || {}).toLowerCase().includes(termino))
    .slice(0, 12)
    .map(r => ({
      date: r.date_key,
      donde: PLATFORM_LABELS[r.theme_key] || r.theme_key,
      lectura: compactText(r.ai_analysis?.desglose_por_red?.[r.theme_key]?.lectura
        || (Array.isArray(r.ai_analysis?.resumen_ejecutivo) ? r.ai_analysis.resumen_ejecutivo.join(' · ') : r.ai_analysis?.resumen_ejecutivo), 260),
    }));

  const limpios = dedupPosts(posts).sort((a, b) => ENG(b) - ENG(a));
  const porDia = {};
  for (const p of limpios) {
    const d = (p.published_date || '').slice(0, 10);
    if (d) porDia[d] = (porDia[d] || 0) + 1;
  }
  for (const a of enAnalisis) porDia[a.date] = porDia[a.date] || 0;

  const dias = Object.entries(porDia).sort((a, b) => a[0] < b[0] ? -1 : 1)
    .map(([date, menciones]) => ({ date, menciones_encontradas: menciones }));

  return {
    tema,
    dias_donde_aparece: dias,
    total_publicaciones: limpios.length,
    publicaciones: limpios.slice(0, n).map(p => ({
      date: (p.published_date || '').slice(0, 10),
      red: PLATFORM_LABELS[p.theme_key] || p.platform,
      autor: p.username, texto: compactText(p.text, 200), url: p.url,
      likes: p.likes || 0, views: p.views || 0, sentimiento: p.sentiment || '',
      ...((p.fb_haha || p.fb_angry) ? { reacciones: { like: p.fb_like || 0, haha: p.fb_haha || 0, angry: p.fb_angry || 0 } } : {}),
    })),
    comentarios: (comentarios || []).slice(0, n).map(c => ({
      autor: c.author || '', texto: compactText(c.text, 180), likes: c.likes || 0,
    })),
    analisis_que_lo_mencionan: enAnalisis,
    instruction: dias.length
      ? 'Ya tienes las fechas donde aparece el tema. Para el sentimiento de ese día llama a get_dashboard_data con esa fecha exacta. No respondas el sentimiento con lo que veas aquí.'
      : 'No se encontró el tema. Dile a Pepe que no aparece en lo monitoreado en lugar de suponer.',
  };
}

// ── Voces: quiénes hablan de Pepe y de qué lado están.
export async function consultarVoces(args = {}) {
  if (!supabase) return { error: 'Base no configurada.' };
  const tipo = ['aliados', 'contrarios', 'neutrales'].includes(args.tipo) ? args.tipo : 'todos';
  const n = Math.min(Math.max(Number(args.limit || 10), 3), 30);
  const minAlcance = Number.isFinite(Number(args.min_alcance)) ? Number(args.min_alcance) : 50;
  const mapa = { aliados: 'positive', contrarios: 'negative', neutrales: 'neutral' };
  const inv = { positive: 'aliados', negative: 'contrarios', neutral: 'neutrales' };

  let q = supabase.from('allies_critics_voices')
    .select('username,platform,sentiment,followers,total_engagement,tier,keywords,profile_url')
    .order('total_engagement', { ascending: false }).limit(600);
  if (tipo !== 'todos') q = q.eq('sentiment', mapa[tipo]);
  const red = normalizePlatform(args.red || args.platform);
  if (red) q = q.eq('platform', red);
  const { data: filas, error } = await q;
  if (error) return { error: error.message };

  const grupos = {}; const vistos = new Set(); let sueltos = 0;
  for (const f of filas || []) {
    const u = (f.username || '').toLowerCase().trim().replace(/^@/, '');
    const cat = inv[f.sentiment] || 'neutrales';
    if (!u || vistos.has(cat + u)) continue;
    vistos.add(cat + u);
    const alcance = f.total_engagement || f.followers || 0;
    if (alcance < Math.max(minAlcance, 0)) { sueltos++; continue; }
    // Un medio nacional y alguien con un like no pesan igual: van en secciones distintas.
    const esCuenta = ['macro', 'medio'].includes(f.tier) || (f.followers || 0) >= 10000 || alcance >= 5000;
    const seccion = esCuenta ? 'medios_y_cuentas' : 'comentaristas';
    grupos[cat] ||= {}; grupos[cat][seccion] ||= [];
    if (grupos[cat][seccion].length >= n) continue;
    grupos[cat][seccion].push({
      cuenta: f.username, red: PLATFORM_LABELS[f.platform] || f.platform, alcance,
      ...(f.followers ? { seguidores: f.followers } : {}),
      ...(f.tier ? { nivel: f.tier } : {}),
      ...(f.profile_url ? { perfil: f.profile_url } : {}),
    });
  }

  return {
    voces: grupos,
    totales: Object.fromEntries(Object.entries(grupos).map(([c, s]) => [c, Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.length]))])),
    nota: `Solo voces con alcance ≥ ${Math.max(minAlcance, 0)}${sueltos ? ` (${sueltos} comentaristas más pequeños quedaron fuera)` : ''}. `
      + 'Alcance = engagement acumulado o seguidores, el mayor de los dos. Al hablarlo, nombra primero medios y cuentas con peso; los comentaristas sueltos son ruido individual.',
  };
}

// ── Medios: qué prensa lo está cubriendo y con qué tono.
export async function consultarMedios(args = {}) {
  if (!supabase) return { error: 'Base no configurada.' };
  const n = Math.min(Math.max(Number(args.limit || 12), 3), 30);
  let q = supabase.from('scraped_posts')
    .select('username,url,text,sentiment,published_date,likes')
    .eq('theme_key', 'google_news').order('published_date', { ascending: false }).limit(600);
  q = rangoPosts(q, args.from, args.to);
  const { data: notas, error } = await q;
  if (error) return { error: error.message };
  if (!notas?.length) return { total_notas: 0, message: 'No hay notas de prensa en esa ventana.' };

  const porMedio = {};
  for (const nt of dedupPosts(notas)) {
    const medio = (nt.username || '').trim() || 'sin identificar';
    const m = porMedio[medio] ||= { medio, notas: 0, favorable: 0, critico: 0, neutral: 0, ultima: '', ejemplo: '', link: '' };
    m.notas += 1;
    const s = (nt.sentiment || '').toLowerCase();
    if (s.includes('fav') || s.includes('pos')) m.favorable++;
    else if (s.includes('crit') || s.includes('neg')) m.critico++;
    else m.neutral++;
    const fecha = (nt.published_date || '').slice(0, 10);
    if (fecha > m.ultima) { m.ultima = fecha; m.ejemplo = compactText(nt.text, 140); m.link = nt.url || ''; }
  }

  const lista = Object.values(porMedio).sort((a, b) => b.notas - a.notas).slice(0, n)
    .map(m => ({
      ...m,
      tono: m.critico > m.favorable ? 'crítico' : m.favorable > m.critico ? 'favorable' : 'neutral',
    }));

  return {
    ventana: { from: args.from || 'todo el histórico', to: args.to || 'hoy' },
    total_notas: notas.length, medios_distintos: Object.keys(porMedio).length,
    medios: lista,
    nota: 'El tono sale de la clasificación pieza por pieza. Un medio con muchas notas neutrales no es lo mismo que uno con pocas pero críticas: dilo así.',
  };
}

// ── Rendimiento de las publicaciones de Pepe: la base para "¿qué publico?".
export async function rendimientoPropias(args = {}) {
  if (!supabase) return { error: 'Base no configurada.' };
  const n = Math.min(Math.max(Number(args.limit || 8), 3), 20);
  let q = supabase.from('scraped_posts')
    .select('platform,username,text,url,published_date,likes,comments_count,views,shares,retweets')
    .eq('theme_key', 'redes_propias').order('likes', { ascending: false }).limit(800);
  q = rangoPosts(q, args.from, args.to);
  const { data: filas, error } = await q;
  if (error) return { error: error.message };

  const posts = dedupPosts(filas).sort((a, b) => ENG(b) - ENG(a));
  if (!posts.length) return { total_publicaciones: 0, message: 'Sin publicaciones propias en esa ventana.' };

  const porRed = {};
  for (const p of posts) {
    const r = porRed[p.platform] ||= { publicaciones: 0, engagement_total: 0 };
    r.publicaciones += 1; r.engagement_total += ENG(p);
  }
  for (const r of Object.values(porRed)) r.engagement_promedio = Math.round(r.engagement_total / r.publicaciones);

  // Contra el promedio de SU red: medir un post de Instagram contra el global infla el múltiplo.
  const limpia = p => {
    const base = porRed[p.platform]?.engagement_promedio || 0;
    const e = ENG(p);
    return {
      red: PLATFORM_LABELS[p.platform] || p.platform, fecha: (p.published_date || '').slice(0, 10),
      texto: compactText(p.text, 170), url: p.url || '', engagement: e,
      likes: p.likes || 0, comentarios: p.comments_count || 0, views: p.views || 0,
      ...(base ? { vs_promedio_de_su_red: `${(e / base).toFixed(1)}x` } : {}),
    };
  };

  return {
    total_publicaciones: posts.length,
    engagement_promedio_global: Math.round(posts.reduce((a, p) => a + ENG(p), 0) / posts.length),
    por_red: porRed,
    mejores: posts.slice(0, n).map(limpia),
    peores: posts.length > 6 ? posts.slice(-3).map(limpia) : [],
    nota: 'engagement = likes + comentarios×2 + compartidos×3. Esto es rendimiento de SU contenido, no opinión pública. Para recomendar qué publicar, apóyate en los mejores y di el múltiplo vs el promedio de esa red.',
  };
}

// ── Evolución: "¿voy mejor o peor?", con la crítica de terceros aparte.
export async function evolucionSentimiento(args = {}) {
  if (!supabase) return { error: 'Base no configurada.' };
  const red = normalizePlatform(args.red || args.platform) || 'resumen';
  let q = supabase.from('reports').select('date_key,theme_key,ai_analysis')
    .eq('approved', true).not('ai_analysis', 'is', null)
    .order('date_key', { ascending: true }).limit(600);
  if (args.from) q = q.gte('date_key', args.from);
  if (args.to) q = q.lte('date_key', args.to);
  const { data: filas, error } = await q;
  if (error) return { error: error.message };

  const porDia = {};
  for (const f of filas || []) (porDia[f.date_key] ||= {})[f.theme_key] = f.ai_analysis || {};

  const serie = [];
  for (const fecha of Object.keys(porDia).sort()) {
    const temas = porDia[fecha];
    const ai = temas[red];
    if (!ai) continue;
    const s = ai.sentimiento || {};
    const punto = { fecha, favorable: s.favorable ?? null, critico: s.critico ?? null, riesgo: ai.nivel_riesgo || '' };
    if (red === 'resumen') {
      // El % publicado incluye las cuentas propias; este no.
      const terceros = Object.entries(temas)
        .filter(([k]) => k !== 'resumen' && k !== OWN_ACCOUNTS_KEY)
        .map(([, t]) => Number(t?.sentimiento?.critico)).filter(Number.isFinite);
      if (terceros.length) punto.critico_terceros = Math.round(terceros.reduce((a, b) => a + b, 0) / terceros.length);
    }
    serie.push(punto);
  }
  if (!serie.length) return { red, dias: 0, message: 'No hay análisis publicado en ese rango.' };

  const critT = serie.map(p => p.critico_terceros).filter(Number.isFinite);
  return {
    red: PLATFORM_LABELS[red] || red, dias: serie.length,
    primero: serie[0], ultimo: serie[serie.length - 1],
    promedio_favorable: prom(serie.map(p => p.favorable)),
    ...(critT.length ? {
      promedio_critico_terceros: Math.round(critT.reduce((a, b) => a + b, 0) / critT.length),
      nota: 'critico_terceros es la crítica de medios y público sin las cuentas propias de Pepe; el porcentaje global las incluye y sale más favorable. Usa el de terceros para hablar de reputación.',
    } : {}),
    serie,
  };
}

// ── Catálogo oficial de mensajes (BW-26-07-PA-MSG-001). Fijo, no se deduce.
const MENSAJES_CLAVE = {
  documento: 'BW-26-07-PA-MSG-001',
  mensaje_maestro: 'Elegí ser dueño de lo que creo, de lo que construyo y de lo que cuido. Eso es lo que soy, y lo que seré.',
  pilares: [
    { nombre: 'PIONERO', eje: 'independencia', idea: 'El artista dueño de su obra y de su infraestructura; libertad y autenticidad.' },
    { nombre: 'VISIONARIO', eje: 'tecnología / IA', idea: 'La IA como herramienta al servicio del creador; soberanía tecnológica y relevancia.' },
    { nombre: 'GUARDIÁN', eje: 'charrería / mexicanidad', idea: 'Charrería, mariachi, orgullo mexicano y el legado de Don Antonio como patrimonio.' },
  ],
  valores_transversales: ['soberanía', 'orgullo mexicano', 'compromiso con el público', 'respeto al talento', 'independencia real', 'excelencia', 'pertenencia cultural'],
  pivotes_reactivos: [
    { tema: 'Ángela Aguilar', pivote: 'cada artista, su propio escenario', manejo: 'Regresar al show y al catálogo propio. Nunca entrar en polémica.' },
    { tema: 'Nodal / Cazzu / Emiliano', pivote: 'cada quien habla por sí mismo, hoy vine a cantar', manejo: 'Cortar el hilo y volver a la música.' },
    { tema: 'Amuleto del Tri', pivote: 'presencia, no oráculo', manejo: 'Cero apropiación del apodo.' },
    { tema: "Críticas a 'El Son de la Negra' y comparaciones", pivote: 'silencio activo y posición de altura', manejo: 'Solo responde un tercero creíble, nunca Pepe directo.' },
    { tema: 'Cancelación de conciertos EEUU/Canadá', pivote: 'comunicación oficial desde producción', manejo: 'No desde Pepe; distinguir casos (visas por show, no todos).' },
    { tema: 'Homenaje Día de San Juan / legado Don Antonio', pivote: 'patrimonio compartido', manejo: 'Cero apropiación desde Pepe.' },
  ],
  como_usarlo: 'Ancla cada recomendación a un pilar y dilo. Ante un tema reactivo aplica el pivote tal como está escrito. Son TRES pilares.',
};

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
  }, {
    name: 'buscar_tema',
    description: 'Busca un tema, evento, persona o frase en TODO lo monitoreado (publicaciones, comentarios y analisis) sin saber la fecha. Uso obligatorio cuando Pepe menciona algo por su nombre y no por su fecha: "mi presentacion con Grupo Frontera", "lo del amuleto", "los que dicen que no vendo boletos". Devuelve en que dias aparece el tema; despues consulta esos dias con get_dashboard_data.',
    parameters: {
      type: 'object',
      properties: {
        tema: { type: 'string', description: 'Palabra o frase a buscar. Corta y sin comillas: "Grupo Frontera", "boletos", "amuleto".' },
        from: { type: 'string', description: 'Opcional. Fecha inicial YYYY-MM-DD.' },
        to: { type: 'string', description: 'Opcional. Fecha final YYYY-MM-DD.' },
        red: { type: 'string', description: 'Opcional: facebook, instagram, x, tiktok, google_news, redes_propias.' },
        limit: { type: 'number', description: 'Ejemplos a devolver, 3 a 20.' },
      },
      required: ['tema'],
    },
  }, {
    name: 'voces',
    description: 'Quien habla de Pepe y de que lado esta: aliados, contrarios y neutrales, separando medios y cuentas con peso real de comentaristas sueltos, con su alcance. Para "quienes son mis aliados", "quienes me atacan", "que cuentas me estan pegando en TikTok".',
    parameters: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: 'aliados, contrarios, neutrales o todos.' },
        red: { type: 'string', description: 'Opcional: filtrar por una red.' },
        limit: { type: 'number', description: 'Maximo por categoria, 3 a 30.' },
        min_alcance: { type: 'number', description: 'Alcance minimo. 0 incluye comentaristas pequenos.' },
      },
      required: [],
    },
  }, {
    name: 'medios',
    description: 'Que medios de prensa estan cubriendo a Pepe, cuantas notas publico cada uno y con que tono. Para "que medios hablan de mi", "quien me esta pegando en prensa", "como viene la prensa esta semana".',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Fecha inicial YYYY-MM-DD.' },
        to: { type: 'string', description: 'Fecha final YYYY-MM-DD.' },
        limit: { type: 'number', description: 'Medios a devolver, 3 a 30.' },
      },
      required: [],
    },
  }, {
    name: 'rendimiento_propias',
    description: 'Como rindieron las publicaciones DE PEPE en sus propias cuentas, comparadas contra el promedio de su misma red. Es la base para recomendar: "que publico manana", "que formato funciona", "en que red me conviene publicar", "como va mi contenido". NO es opinion publica.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Fecha inicial YYYY-MM-DD.' },
        to: { type: 'string', description: 'Fecha final YYYY-MM-DD.' },
        limit: { type: 'number', description: 'Publicaciones top a devolver, 3 a 20.' },
      },
      required: [],
    },
  }, {
    name: 'evolucion',
    description: 'Serie dia por dia de sentimiento y riesgo para saber si va mejor o peor, con la critica de terceros calculada aparte (sin las cuentas propias). Para "como vengo", "mejore respecto a la semana pasada", "como evoluciono el mes".',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Fecha inicial YYYY-MM-DD.' },
        to: { type: 'string', description: 'Fecha final YYYY-MM-DD.' },
        red: { type: 'string', description: 'resumen para el global (default) o una red concreta.' },
      },
      required: [],
    },
  }, {
    name: 'mensajes_clave',
    description: 'Catalogo oficial de la estrategia: mensaje maestro, los TRES pilares (PIONERO, VISIONARIO, GUARDIAN) y el pivote para cada tema reactivo. Consultalo SIEMPRE que pregunten por los mensajes, los pilares, como responder a un tema delicado o si algo esta alineado a la estrategia. No los deduzcas de los analisis.',
    parameters: { type: 'object', properties: {}, required: [] },
  }],
}];

// Despachador: nombre de la herramienta → función que la resuelve.
const TOOL_HANDLERS = {
  get_dashboard_data: getDashboardData,
  buscar_tema: buscarTema,
  voces: consultarVoces,
  medios: consultarMedios,
  rendimiento_propias: rendimientoPropias,
  evolucion: evolucionSentimiento,
  mensajes_clave: async () => MENSAJES_CLAVE,
};

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
1. CERO DATOS DE MEMORIA. Ninguna cifra, nombre de aliado o contrario, medio, fecha o lectura sale de este prompt: todo se consulta con las herramientas en el momento. Si Pepe pregunta cómo recibieron algo (una presentación, una colaboración, una entrevista) y no consultaste ESA fecha, no contestes: ubica la fecha con buscar_tema o en la LÍNEA DE TIEMPO y consúltala. Está prohibido contestar "fue muy positivo" de memoria. Si te preguntan quiénes son sus aliados, llama a voces; si preguntan por prensa, llama a medios; si preguntan qué publicar, llama a rendimiento_propias. Vale más tardar dos segundos que inventar.
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
=== TUS HERRAMIENTAS (TODO DATO SE CONSULTA, NADA SE RECUERDA) ===
No traes cifras precargadas en la cabeza: este prompt solo te orienta. CADA dato concreto que digas
tiene que salir de una consulta hecha en ESTA conversacion. Si no consultaste, no lo afirmes.
- get_dashboard_data — sentimiento y panorama de una fecha o rango, publicaciones y comentarios del dia.
- buscar_tema — un tema/evento por su NOMBRE cuando no sabes la fecha. Te dice en que dias aparece.
- voces — aliados, contrarios y neutrales con su alcance.
- medios — que prensa lo cubre, cuantas notas y con que tono.
- rendimiento_propias — como rindieron SUS publicaciones (para recomendar que publicar).
- evolucion — dia por dia, si va mejor o peor, con la critica de terceros aparte.
- mensajes_clave — el catalogo oficial de mensaje maestro, pilares y pivotes.
Ruta obligada cuando Pepe menciona un evento por su nombre ("mi presentacion con Grupo Frontera"):
1) buscar_tema para ubicar la fecha  2) get_dashboard_data con ESA fecha  3) recien entonces responde.
Puedes llamar varias herramientas en un mismo turno. Mientras consultas, dile algo breve ("dejame ver eso").` }] },
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
              const handler = TOOL_HANDLERS[call.name];
              if (!handler) {
                functionResponses.push({ id: call.id, name: call.name, response: { error: 'Herramienta no soportada.' } });
                continue;
              }
              try {
                console.log(`[voz] tool ${call.name}`, JSON.stringify(call.args || {}));
                const result = await handler(call.args || {});
                functionResponses.push({ id: call.id, name: call.name, response: result });
              } catch (e) {
                console.error(`[voz] error en tool ${call.name}:`, e?.message || e);
                functionResponses.push({ id: call.id, name: call.name, response: { error: e?.message || 'Error consultando la base.' } });
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
