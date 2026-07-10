/**
 * analizar-server.js — Servidor local para el botón "Analizar" del dashboard.
 *
 * Uso:
 *   node scripts/analizar-server.js <APIFY_TOKEN> <OPENROUTER_KEY>
 *
 * Queda escuchando en http://localhost:3001
 * El dashboard llama a GET http://localhost:3001/analizar?date=YYYY-MM-DD
 * y recibe eventos SSE con el progreso en tiempo real.
 */

import http from 'http';
import { URL } from 'url';
import { runFullAnalysis, runAIOnly, scrapeCommentsForUrls } from './run-full-analysis.js';
import { generateEventReport } from './event-report.js';
import { buildReportDocx } from './report-docx.js';
import { attachVoiceRelay } from './voice-relay.js';
import { dateInZoneWithOffset, runDailyPepeAnalysis } from './daily-pepe-analysis.js';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const AI_KEY      = process.env.OPENROUTER_API_KEY;
const GEMINI_KEY  = process.env.GEMINI_API_KEY;
const PORT        = process.env.PORT || 3001;

const requiredEnv = {
  APIFY_TOKEN,
  OPENROUTER_API_KEY: AI_KEY,
};

function missingEnv(names = Object.keys(requiredEnv)) {
  return names.filter(name => !requiredEnv[name]);
}

function requireEnv(res, names) {
  const missing = missingEnv(names);
  if (!missing.length) return true;

  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Faltan variables de entorno en el servidor',
    missing,
  }));
  return false;
}

const missingAtBoot = missingEnv();
if (missingAtBoot.length) {
  console.warn(`Servidor iniciado con variables faltantes: ${missingAtBoot.join(', ')}`);
}

let running = false;
let reporting = false;
let dailyRunning = false;
let lastDailyTargetDate = null;

function getMexicoCityClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.DAILY_ANALYSIS_TIME_ZONE || 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function startDailyAnalysisScheduler() {
  if (process.env.ENABLE_DAILY_ANALYSIS === 'false') {
    console.log('[daily-pepe] Scheduler desactivado por ENABLE_DAILY_ANALYSIS=false');
    return;
  }

  const scheduledHour = Number.parseInt(process.env.DAILY_ANALYSIS_HOUR || '7', 10);
  const scheduledMinute = Number.parseInt(process.env.DAILY_ANALYSIS_MINUTE || '0', 10);

  const tick = () => {
    const clock = getMexicoCityClock();
    const hour = Number(clock.hour);
    const minute = Number(clock.minute);
    if (hour !== scheduledHour || minute !== scheduledMinute) return;

    const targetDate = dateInZoneWithOffset();
    if (dailyRunning || lastDailyTargetDate === targetDate) return;

    dailyRunning = true;
    lastDailyTargetDate = targetDate;
    console.log(`[daily-pepe] Disparador Railway iniciado para ${targetDate}`);

    runDailyPepeAnalysis({ date: targetDate })
      .catch(error => console.error('[daily-pepe] Fallo el disparador diario:', error))
      .finally(() => { dailyRunning = false; });
  };

  tick();
  setInterval(tick, 60 * 1000);
  console.log(`[daily-pepe] Scheduler activo: ${String(scheduledHour).padStart(2, '0')}:${String(scheduledMinute).padStart(2, '0')} America/Mexico_City`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS — permite Vercel + local
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Health check
  if (url.pathname === '/' || url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, running, missingEnv: missingEnv() }));
    return;
  }

  // Analizar
  if (url.pathname === '/analizar') {
    if (!requireEnv(res, ['APIFY_TOKEN', 'OPENROUTER_API_KEY'])) return;

    if (running) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ya hay un análisis en curso' }));
      return;
    }

    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    running = true;
    send({ type: 'start', date });

    runFullAnalysis({
      apifyToken: APIFY_TOKEN,
      aiKey:      AI_KEY,
      date,
      emit:       send,
    })
      .catch(e => send({ type: 'error', msg: e.message }))
      .finally(() => {
        running = false;
        res.end();
      });

    return;
  }

  // Re-análisis IA sin scraping (usa data ya guardada en Supabase)
  if (url.pathname === '/reanalizar') {
    if (!requireEnv(res, ['OPENROUTER_API_KEY'])) return;

    if (running) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ya hay un análisis en curso' }));
      return;
    }

    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (data) => { res.write(`data: ${JSON.stringify(data)}\n\n`); };

    running = true;
    send({ type: 'start', date, mode: 'ai-only' });

    runAIOnly({ aiKey: AI_KEY, date, emit: send })
      .catch(e => send({ type: 'error', msg: e.message }))
      .finally(() => { running = false; res.end(); });

    return;
  }

  // Deep-dive de comentarios de piezas específicas.
  // GET /comentarios?u=instagram~<url>&u=tiktok~<url>   (param 'u' repetible: plataforma~url)
  if (url.pathname === '/comentarios') {
    if (!requireEnv(res, ['APIFY_TOKEN'])) return;

    const items = url.searchParams.getAll('u').map(v => {
      const i = v.indexOf('~');
      return i === -1 ? null : { platform: v.slice(0, i).trim(), url: v.slice(i + 1).trim() };
    }).filter(Boolean);

    if (!items.length) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Falta ?u=plataforma~url' }));
      return;
    }

    const limit = parseInt(url.searchParams.get('limit') || '300', 10);
    scrapeCommentsForUrls({ apifyToken: APIFY_TOKEN, items, limit })
      .then(results => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ results }));
      })
      .catch(e => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      });
    return;
  }

  // Reporte de evento (self-service admin): scrapea/filtra/IA + genera .docx
  // GET /reporte-evento?query=<evento>&from=YYYY-MM-DD&to=YYYY-MM-DD  (SSE)
  if (url.pathname === '/reporte-evento') {
    if (!requireEnv(res, ['APIFY_TOKEN', 'OPENROUTER_API_KEY'])) return;

    const query = url.searchParams.get('query');
    const from  = url.searchParams.get('from');
    const to    = url.searchParams.get('to') || from;
    if (!query || !from) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Faltan parámetros: query y from (YYYY-MM-DD)' }));
      return;
    }
    if (reporting) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ya hay un reporte en curso' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    const send = (data) => { res.write(`data: ${JSON.stringify(data)}\n\n`); };
    reporting = true;
    send({ type: 'start', query, from, to });
    generateEventReport({ apifyToken: APIFY_TOKEN, aiKey: AI_KEY, query, from, to, emit: send })
      .then(async ({ data, model }) => {
        send({ type: 'phase', msg: 'Generando el .docx…' });
        const buf = await buildReportDocx(data);
        send({ type: 'done', filename: `${data.meta.folio}.docx`, model, stats: data._stats, docx: buf.toString('base64') });
      })
      .catch(e => send({ type: 'error', msg: e.message }))
      .finally(() => { reporting = false; res.end(); });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

// Asistente de voz (Gemini Live) — puente WebSocket en /voz
attachVoiceRelay(server, { geminiKey: GEMINI_KEY, aiKey: AI_KEY });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Analizar Server escuchando en puerto ${PORT}`);
  console.log(`APIFY_TOKEN: ${APIFY_TOKEN ? 'ok' : 'missing'}`);
  console.log(`OPENROUTER_API_KEY: ${AI_KEY ? 'ok' : 'missing'}`);
  console.log(`GEMINI_API_KEY (voz): ${GEMINI_KEY ? 'ok' : 'missing'}`);
  startDailyAnalysisScheduler();
});
