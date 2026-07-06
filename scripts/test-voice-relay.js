/**
 * test-voice-relay.js — Diagnóstico del asistente de voz.
 *
 * Prueba 1 (relay en Railway): reproduce lo que hace el navegador.
 *   node scripts/test-voice-relay.js relay https://TU-APP.up.railway.app
 *   → hace GET /status y luego abre el WebSocket /voz, manda {type:'start'} y
 *     espera 'ready' (relay + Gemini OK) o muestra el 'error'/'closed'.
 *
 * Prueba 2 (Gemini directo, sin nuestro relay): aísla si el modelo/key sirven.
 *   GEMINI_API_KEY=xxxx node scripts/test-voice-relay.js gemini
 *   → conecta directo a Gemini Live y espera setupComplete.
 *
 * Puedes fijar el modelo con GEMINI_LIVE_MODEL (default: el del relay).
 */

import WebSocket from 'ws';

const MODE = process.argv[2];
const MODEL = process.env.GEMINI_LIVE_MODEL || 'models/gemini-3.1-flash-live-preview';
const GEMINI_WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const done = (code) => { setTimeout(() => process.exit(code), 200); };

async function testRelay(base) {
  if (!base) { console.error('Falta la URL. Ej: node scripts/test-voice-relay.js relay https://tu-app.up.railway.app'); process.exit(1); }
  const httpUrl = base.replace(/\/$/, '');
  const wsUrl = httpUrl.replace(/^http/, 'ws') + '/voz';

  log('1) GET', httpUrl + '/status');
  try {
    const r = await fetch(httpUrl + '/status');
    log('   status HTTP:', r.status, '·', await r.text());
  } catch (e) {
    log('   ✗ No respondió el HTTP:', e.message);
    log('   → Railway no está alcanzable o la URL está mal. Revisa VITE_ANALIZAR_SERVER.');
    return done(1);
  }

  log('2) WebSocket ->', wsUrl);
  const ws = new WebSocket(wsUrl);
  const timer = setTimeout(() => { log('   ✗ Timeout: no llegó "ready" en 15s.'); ws.close(); done(1); }, 15000);

  ws.on('open', () => { log('   ✓ WS abierto. Enviando {type:"start"}...'); ws.send(JSON.stringify({ type: 'start', context: 'Prueba de diagnóstico. Responde solo "listo".' })); });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw.toString()); } catch { return; }
    if (m.type === 'audio') { log('   ✓ recibido audio (' + (m.data?.length || 0) + ' b64)'); }
    else log('   ←', JSON.stringify(m).slice(0, 300));
    if (m.type === 'ready') { log('   ✅ RELAY + GEMINI OK: llegó "ready".'); clearTimeout(timer); ws.close(); done(0); }
    if (m.type === 'error') { log('   ✗ El relay reportó error (mira arriba).'); clearTimeout(timer); ws.close(); done(1); }
  });
  ws.on('close', (c, r) => log('   WS cerrado. code=' + c, r?.toString?.() || ''));
  ws.on('error', (e) => { log('   ✗ Error WS:', e.message); clearTimeout(timer); done(1); });
}

function testGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.error('Falta GEMINI_API_KEY. Ej: GEMINI_API_KEY=xxx node scripts/test-voice-relay.js gemini'); process.exit(1); }
  log('Conectando directo a Gemini con modelo:', MODEL);
  const g = new WebSocket(`${GEMINI_WS}?key=${key}`);
  const timer = setTimeout(() => { log('✗ Timeout: no llegó setupComplete en 15s.'); g.close(); done(1); }, 15000);

  g.on('open', () => {
    log('✓ WS a Gemini abierto. Enviando setup...');
    g.send(JSON.stringify({ setup: { model: MODEL, generationConfig: { responseModalities: ['AUDIO'] }, inputAudioTranscription: {}, outputAudioTranscription: {} } }));
  });
  g.on('message', async (raw) => {
    let text; try { text = raw?.toString ? raw.toString('utf8') : String(raw); } catch { return; }
    let d; try { d = JSON.parse(text); } catch { log('← (no-JSON)', text.slice(0, 300)); return; }
    if (d.setupComplete) { log('✅ GEMINI OK: setupComplete. El modelo y la key sirven.'); clearTimeout(timer); g.close(); return done(0); }
    log('←', JSON.stringify(d).slice(0, 400));
  });
  g.on('close', (c, r) => log('WS Gemini cerrado. code=' + c, r?.toString?.() || ''));
  g.on('error', (e) => { log('✗ Error WS Gemini:', e.message); clearTimeout(timer); done(1); });
}

if (MODE === 'relay') testRelay(process.argv[3]);
else if (MODE === 'gemini') testGemini();
else { console.error('Uso:\n  node scripts/test-voice-relay.js relay https://TU-APP.up.railway.app\n  GEMINI_API_KEY=xxx node scripts/test-voice-relay.js gemini'); process.exit(1); }
