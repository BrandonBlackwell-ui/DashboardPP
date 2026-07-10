/**
 * voice-relay.js — Puente WebSocket entre el navegador y Gemini Live API.
 *
 * El navegador NUNCA ve la API key. Flujo:
 *   navegador  --(ws /voz)-->  este relay  --(wss)-->  Gemini Live
 *
 * Protocolo navegador → relay:
 *   { type:'start', context:'<texto del dashboard>' }   inicia la sesión
 *   { type:'audio', data:'<pcm16 16kHz base64>' }        chunk de micrófono
 *   { type:'stop' }                                      cierra
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
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';
const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const PLATFORM_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
  google_news: 'Google News',
  redes_propias: 'Redes propias',
};

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function shiftDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function resolveDateRange({ from, to, question }) {
  const now = process.env.VOICE_TODAY ? new Date(process.env.VOICE_TODAY + 'T12:00:00') : new Date();
  const q = (question || '').toLowerCase();
  if (from && to) return { from, to };
  if (from && !to) return { from, to: from };
  if (q.includes('semana pasada')) {
    const day = now.getDay();
    const mondayThisWeek = shiftDays(now, day === 0 ? -6 : 1 - day);
    const mondayLastWeek = shiftDays(mondayThisWeek, -7);
    return { from: iso(mondayLastWeek), to: iso(shiftDays(mondayLastWeek, 6)) };
  }
  if (q.includes('ultimos 7') || q.includes('ultimos siete') || q.includes('últimos 7') || q.includes('últimos siete')) {
    return { from: iso(shiftDays(now, -6)), to: iso(now) };
  }
  if (q.includes('ayer')) {
    const y = iso(shiftDays(now, -1));
    return { from: y, to: y };
  }
  if (q.includes('hoy')) {
    const today = iso(now);
    return { from: today, to: today };
  }
  return { from: iso(shiftDays(now, -6)), to: iso(now) };
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

export async function getDashboardData(args = {}) {
  if (!supabase) {
    return { error: 'Supabase no esta configurado en el servidor de voz.' };
  }

  const { from, to } = resolveDateRange(args);
  const platform = normalizePlatform(args.platform);
  const limit = Math.min(Math.max(Number(args.limit || 30), 5), 80);

  let reportsQuery = supabase
    .from('reports')
    .select('id,date_key,theme_key,ai_analysis,approved')
    .gte('date_key', from)
    .lte('date_key', to)
    .neq('theme_key', 'resumen')
    .order('date_key', { ascending: true });

  if (platform) reportsQuery = reportsQuery.eq('theme_key', platform);
  const { data: reports, error: reportsError } = await reportsQuery;
  if (reportsError) return { error: reportsError.message, from, to, platform };
  if (!reports?.length) return { from, to, platform: platform || 'all', total_reports: 0, message: 'No hay reportes en ese rango.' };

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
  const byPlatform = {};
  for (const r of reports) {
    const k = r.theme_key || 'sin_red';
    byPlatform[k] ||= { reports: 0, posts: 0, comments: 0, favorable: 0, neutral: 0, critico: 0 };
    byPlatform[k].reports += 1;
    const s = r.ai_analysis?.sentimiento || {};
    byPlatform[k].favorable = Math.max(byPlatform[k].favorable, Number(s.favorable || s.positivo || s.pos || 0));
    byPlatform[k].neutral = Math.max(byPlatform[k].neutral, Number(s.neutral || s.neu || 0));
    byPlatform[k].critico = Math.max(byPlatform[k].critico, Number(s.critico || s.negativo || s.neg || 0));
  }
  for (const p of posts || []) {
    const report = byReport.get(p.report_id);
    const k = report?.theme_key || p.platform || 'sin_red';
    byPlatform[k] ||= { reports: 0, posts: 0, comments: 0, favorable: 0, neutral: 0, critico: 0 };
    byPlatform[k].posts += 1;
    byPlatform[k].comments += Number(p.comments_count || 0);
  }

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
      comments: commentsByPost[p.id] || [],
    };
  });

  const nombresVoces = (lista) => (Array.isArray(lista) ? lista : [])
    .map(v => (typeof v === 'string' ? v : (v?.username || v?.nombre || '')))
    .filter(Boolean)
    .slice(0, 8);

  const aiHighlights = reports
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

  return {
    from,
    to,
    platform: platform || 'all',
    total_reports: reports.length,
    total_posts: posts?.length || 0,
    total_comments_sampled: comments?.length || 0,
    by_platform: byPlatform,
    top_posts: topPosts,
    ai_highlights: aiHighlights,
    instruction: 'Responde en español, breve y claro. Si el usuario pide links, menciona que puede abrirlos en el dashboard y cita los URLs disponibles.',
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
async function fetchRecentMemory(maxSessions = 2) {
  if (!supabase) return '';
  try {
    const { data } = await supabase
      .from('voice_sessions')
      .select('created_at, summary')
      .not('summary', 'is', null)
      .order('created_at', { ascending: false })
      .limit(maxSessions);
    if (!data?.length) return '';
    const bloques = data.reverse().map(s => `- (${(s.created_at || '').slice(0, 10)}) ${s.summary}`);
    return `\n=== MEMORIA DE CONVERSACIONES ANTERIORES ===\nContexto de lo último que habló Pepe contigo. Retómalo con naturalidad SOLO si es relevante (ej. "la última vez me comentaste que te preocupaba Instagram, ¿seguimos con eso?"). No lo recites literal.\n${bloques.join('\n')}\n`;
  } catch { return ''; }
}

// Al cerrar la sesión: resume la charla y la guarda para la próxima vez.
async function summarizeAndStore({ transcript, questions, aiKey }) {
  if (!supabase) return;
  const userTurns = transcript.filter(t => t.role === 'user');
  if (!userTurns.length) return; // sesión vacía, no guardar

  let summary = '';
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
            { role: 'system', content: 'Resume en 2-3 frases y en español de qué habló Pepe con el asistente y qué le preocupaba o pidió. Breve y factual, sin preámbulos ni comillas.' },
            { role: 'user', content: convo },
          ],
        }),
      });
      const j = await resp.json();
      summary = j.choices?.[0]?.message?.content?.trim() || '';
    } catch (e) { console.warn('[voz] resumen falló:', e?.message || e); }
  }
  if (!summary) summary = 'Pepe preguntó: ' + questions.slice(0, 5).join(' | ');

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
    const pendingAudio = [];

    // Estado de la sesión para capturar preguntas y guardar memoria al final.
    const transcript = [];
    const questions = [];
    let userBuf = '';
    let asstBuf = '';
    let saved = false;
    const finalize = () => {
      if (saved) return;
      saved = true;
      summarizeAndStore({ transcript, questions, aiKey }).catch(() => {});
    };

    const toClient = (obj) => { try { client.send(JSON.stringify(obj)); } catch { /* closed */ } };

    const sendAudioToGoogle = (b64) => {
      if (google && google.readyState === 1) {
        // Formato nuevo de la Live API: realtimeInput.audio (mediaChunks daba code 1007).
        google.send(JSON.stringify({
          realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: b64 } },
        }));
      }
    };

    client.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === 'start') {
        if (!geminiKey) { console.warn('[voz] start sin GEMINI_API_KEY'); toClient({ type: 'error', msg: 'Falta GEMINI_API_KEY en el servidor.' }); return; }
        if (google) return; // ya iniciada

        // Trae la memoria de sesiones anteriores antes de abrir Gemini (costo mínimo: solo resúmenes).
        const memoria = await fetchRecentMemory();

        console.log(`[voz] start recibido. Conectando a Gemini (${GEMINI_MODEL})...`);
        google = new WebSocket(`${GEMINI_WS}?key=${geminiKey}`);

        google.onopen = () => {
          console.log('[voz] WS a Gemini abierto, enviando setup.');
          google.send(JSON.stringify({
            setup: {
              model: GEMINI_MODEL,
              generationConfig: { responseModalities: ['AUDIO'] },
              systemInstruction: { parts: [{ text: `${msg.context || ''}

Te llamas ORWELL. Si Pepe te pregunta tu nombre o cómo te llamas, responde con calidez que eres Orwell, su analista de reputación. Puedes presentarte como Orwell en tu primer saludo.
${memoria}
Tambien tienes acceso a la herramienta get_dashboard_data para consultar Supabase en vivo. Usala SIEMPRE que Pepe pregunte por fechas, rangos, historico, "semana pasada", "ayer", comparativas, posts, comentarios, links, aliados o contrarios que no esten explicitamente en el contexto visible. No inventes datos: primero consulta la herramienta y despues responde.` }] },
              tools: VOICE_TOOLS,
              // Habilita transcripción de lo que dice el usuario y lo que responde Gemini.
              inputAudioTranscription: {},
              outputAudioTranscription: {},
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
            pendingAudio.forEach(sendAudioToGoogle);
            pendingAudio.length = 0;
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
        if (googleReady) sendAudioToGoogle(msg.data);
        else pendingAudio.push(msg.data);
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
