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

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const AI_KEY      = process.env.OPENROUTER_API_KEY;
const GEMINI_KEY  = process.env.GEMINI_API_KEY;
const PORT        = process.env.PORT || 3001;

if (!APIFY_TOKEN || !AI_KEY) {
  console.error('Faltan variables de entorno: APIFY_TOKEN y OPENROUTER_API_KEY');
  process.exit(1);
}

let running = false;
let reporting = false;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS — permite Vercel + local
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Health check
  if (url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, running }));
    return;
  }

  // Analizar
  if (url.pathname === '/analizar') {
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
attachVoiceRelay(server, { geminiKey: GEMINI_KEY });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Analizar Server escuchando en puerto ${PORT}`);
  console.log(`APIFY_TOKEN: ${APIFY_TOKEN ? '✓' : '✗'}`);
  console.log(`OPENROUTER_API_KEY: ${AI_KEY ? '✓' : '✗'}`);
  console.log(`GEMINI_API_KEY (voz): ${GEMINI_KEY ? '✓' : '✗'}`);
});
