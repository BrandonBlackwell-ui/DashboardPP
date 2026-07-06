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

const GEMINI_MODEL = process.env.GEMINI_LIVE_MODEL || 'models/gemini-3.1-flash-live-preview';
const GEMINI_WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export function attachVoiceRelay(server, { geminiKey }) {
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

    const toClient = (obj) => { try { client.send(JSON.stringify(obj)); } catch { /* closed */ } };

    const sendAudioToGoogle = (b64) => {
      if (google && google.readyState === 1) {
        google.send(JSON.stringify({
          realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: b64 }] },
        }));
      }
    };

    client.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === 'start') {
        if (!geminiKey) { console.warn('[voz] start sin GEMINI_API_KEY'); toClient({ type: 'error', msg: 'Falta GEMINI_API_KEY en el servidor.' }); return; }
        if (google) return; // ya iniciada

        console.log(`[voz] start recibido. Conectando a Gemini (${GEMINI_MODEL})...`);
        google = new WebSocket(`${GEMINI_WS}?key=${geminiKey}`);

        google.onopen = () => {
          console.log('[voz] WS a Gemini abierto, enviando setup.');
          google.send(JSON.stringify({
            setup: {
              model: GEMINI_MODEL,
              generationConfig: { responseModalities: ['AUDIO'] },
              systemInstruction: { parts: [{ text: msg.context || '' }] },
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

          const sc = data.serverContent;
          if (sc) {
            for (const part of (sc.modelTurn?.parts || [])) {
              if (part.inlineData?.data) toClient({ type: 'audio', data: part.inlineData.data });
              if (part.text) toClient({ type: 'text', role: 'assistant', text: part.text });
            }
            // Transcripciones (llegan en fragmentos; audio y texto pueden venir en el mismo mensaje).
            if (sc.outputTranscription?.text) toClient({ type: 'text', role: 'assistant', text: sc.outputTranscription.text });
            if (sc.inputTranscription?.text) toClient({ type: 'text', role: 'user', text: sc.inputTranscription.text });
            if (sc.interrupted) toClient({ type: 'interrupted' });
            if (sc.turnComplete) toClient({ type: 'turn_complete' });
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
        try { google?.close(); } catch { /* noop */ }
      }
    });

    client.on('close', () => { try { google?.close(); } catch { /* noop */ } });
  });

  return wss;
}
