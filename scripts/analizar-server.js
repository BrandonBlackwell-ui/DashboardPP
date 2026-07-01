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
import { runFullAnalysis } from './run-full-analysis.js';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const AI_KEY      = process.env.OPENROUTER_API_KEY;
const PORT        = process.env.PORT || 3001;

if (!APIFY_TOKEN || !AI_KEY) {
  console.error('Faltan variables de entorno: APIFY_TOKEN y OPENROUTER_API_KEY');
  process.exit(1);
}

let running = false;

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

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Analizar Server escuchando en puerto ${PORT}`);
  console.log(`APIFY_TOKEN: ${APIFY_TOKEN ? '✓' : '✗'}`);
  console.log(`OPENROUTER_API_KEY: ${AI_KEY ? '✓' : '✗'}`);
});
