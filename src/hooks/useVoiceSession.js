import { useState, useRef, useEffect, useCallback } from 'react';
import { buildAssistantContext } from '../lib/buildAssistantContext';

const HTTP_SERVER = import.meta.env.VITE_ANALIZAR_SERVER || 'http://localhost:3001';
const WS_URL = HTTP_SERVER.replace(/^http/, 'ws').replace(/\/$/, '') + '/voz';

const IN_RATE = 16000;   // Gemini espera PCM16 mono 16kHz de entrada
const OUT_RATE = 24000;  // Gemini devuelve PCM16 mono 24kHz
const OUT_GAIN = 1.6;    // margen de volumen: la salida de Gemini viene baja

// En celular, un micrófono activo CON cancelación de eco hace que el sistema mande
// la salida al canal de llamada (volumen propio, más bajo que el multimedia) y que
// el cancelador atenúe la bocina cuando oye la voz del propio agente. Con
// walkie-talkie no necesitamos AEC: solo se transmite cuando Pepe aprieta el botón.
const MIC_CONSTRAINTS = {
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

// Avisos de walkie-talkie: un tono corto al abrir el micrófono, otro al soltar y
// uno más tenue cuando Orwell termina y vuelve a ser tu turno. Sintetizados (nada
// que descargar) y a volumen bajo a propósito: son una señal, no una alarma.
const TONOS = {
  abre:   { de: 620, a: 940, dur: 0.09, vol: 0.05 },  // ya puedes hablar
  cierra: { de: 900, a: 560, dur: 0.11, vol: 0.045 }, // se envió lo que dijiste
  turno:  { de: 720, a: 760, dur: 0.07, vol: 0.025 }, // Orwell terminó, te toca
};

// ── Helpers de audio ──────────────────────────────────────────────
function floatTo16kPCM(float32, srcRate) {
  const ratio = srcRate / IN_RATE;
  const outLen = Math.floor(float32.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = Math.max(-1, Math.min(1, float32[Math.floor(i * ratio)] || 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
function base64ToInt16(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

// Sesión de voz con el relay /voz del servidor (Gemini Live), en modo walkie-talkie:
// la sesión se abre una vez (start) y cada intervención se delimita a mano con
// beginTalk/endTalk. El micrófono está abierto todo el tiempo pero solo se envía
// audio mientras el botón está presionado, así que nada de lo que se diga fuera
// del botón llega a Gemini.
//
// state: idle | connecting | ready | recording | thinking | speaking | error
//   ready     → sesión viva, esperando que presiones para hablar
//   recording → estás hablando (botón presionado)
//   thinking  → soltaste el botón, Orwell está preparando la respuesta
//   speaking  → Orwell está hablando (presionar lo interrumpe)
export function useVoiceSession() {
  const [state, setState] = useState('idle');
  const [errMsg, setErrMsg] = useState('');

  const wsRef = useRef(null);
  const micCtxRef = useRef(null);
  const streamRef = useRef(null);
  const procRef = useRef(null);
  const playCtxRef = useRef(null);
  const playGainRef = useRef(null);
  const playTimeRef = useRef(0);
  const sourcesRef = useRef([]);
  const stateRef = useRef('idle');   // espejo de `state` para leer dentro de callbacks del WS
  const talkingRef = useRef(false);  // true mientras el botón está presionado

  useEffect(() => { stateRef.current = state; }, [state]);

  const setPhase = (next) => { stateRef.current = next; setState(next); };

  const cleanup = () => {
    try { wsRef.current?.send(JSON.stringify({ type: 'stop' })); } catch { /* noop */ }
    try { wsRef.current?.close(); } catch { /* noop */ }
    try { procRef.current?.disconnect(); } catch { /* noop */ }
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch { /* noop */ }
    try { micCtxRef.current?.close(); } catch { /* noop */ }
    try { playCtxRef.current?.close(); } catch { /* noop */ }
    wsRef.current = null; procRef.current = null; streamRef.current = null;
    micCtxRef.current = null; playCtxRef.current = null; playGainRef.current = null;
    sourcesRef.current = []; playTimeRef.current = 0;
    talkingRef.current = false;
  };

  useEffect(() => () => cleanup(), []);

  const beep = useCallback((kind) => {
    const ctx = playCtxRef.current;
    const t = TONOS[kind];
    if (!ctx || !t || ctx.state === 'closed') return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(t.de, now);
      osc.frequency.exponentialRampToValueAtTime(t.a, now + t.dur);
      // Rampas exponenciales desde/hacia casi-cero: un corte seco se oye como clic.
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(t.vol, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t.dur);
      osc.connect(g);
      g.connect(ctx.destination); // directo: no pasa por la ganancia de la voz
      osc.start(now);
      osc.stop(now + t.dur + 0.02);
    } catch { /* el tono nunca debe romper la sesión */ }
  }, []);

  const stopPlayback = () => {
    sourcesRef.current.forEach(s => { try { s.stop(); } catch { /* noop */ } });
    sourcesRef.current = [];
    playTimeRef.current = playCtxRef.current?.currentTime || 0;
  };

  const playChunk = (b64) => {
    const ctx = playCtxRef.current;
    if (!ctx) return;
    // Mientras transmites no se escucha nada (walkie-talkie): los fragmentos que
    // vengan en camino de un turno interrumpido se descartan.
    if (talkingRef.current) return;
    const int16 = base64ToInt16(b64);
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
    const buf = ctx.createBuffer(1, f32.length, OUT_RATE);
    buf.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(playGainRef.current || ctx.destination);
    const now = ctx.currentTime;
    playTimeRef.current = Math.max(playTimeRef.current, now);
    src.start(playTimeRef.current);
    playTimeRef.current += buf.duration;
    setPhase('speaking');
    src.onended = () => {
      sourcesRef.current = sourcesRef.current.filter(s => s !== src);
      // Solo cuando termina de hablar de verdad: si lo cortaste tú, ya sonó 'abre'.
      if (!sourcesRef.current.length && !talkingRef.current) {
        if (stateRef.current === 'speaking') beep('turno');
        setPhase('ready');
      }
    };
    sourcesRef.current.push(src);
  };

  const send = (obj) => {
    const ws = wsRef.current;
    if (ws?.readyState === 1) ws.send(JSON.stringify(obj));
  };

  const start = async () => {
    setErrMsg(''); setPhase('connecting');
    try {
      // iOS 16.4+: pide sesión de audio que reproduce por la bocina aunque el
      // micrófono esté disponible (si no, Safari baja el nivel / usa el auricular).
      try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch { /* noop */ }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
      streamRef.current = stream;
      // Micrófono en silencio hasta que se presione el botón: el sistema no
      // mantiene la ruta de "llamada" mientras Orwell habla.
      stream.getAudioTracks().forEach(t => { t.enabled = false; });

      const micCtx = new (window.AudioContext || window.webkitAudioContext)();
      micCtxRef.current = micCtx;
      await micCtx.resume();
      const playCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: OUT_RATE });
      playCtxRef.current = playCtx;
      await playCtx.resume();
      const gain = playCtx.createGain();
      gain.gain.value = OUT_GAIN;
      gain.connect(playCtx.destination);
      playGainRef.current = gain;
      playTimeRef.current = playCtx.currentTime;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'start', ptt: true, context: buildAssistantContext() }));
      };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === 'ready') {
          setPhase('ready');
          // Micrófono siempre abierto; el gate es talkingRef (el botón).
          const source = micCtx.createMediaStreamSource(stream);
          const proc = micCtx.createScriptProcessor(4096, 1, 1);
          procRef.current = proc;
          proc.onaudioprocess = (e) => {
            if (ws.readyState !== 1 || !talkingRef.current) return;
            const pcm = floatTo16kPCM(e.inputBuffer.getChannelData(0), micCtx.sampleRate);
            ws.send(JSON.stringify({ type: 'audio', data: bytesToBase64(new Uint8Array(pcm.buffer)) }));
          };
          source.connect(proc);
          proc.connect(micCtx.destination);
        } else if (m.type === 'audio') {
          playChunk(m.data);
        } else if (m.type === 'interrupted') {
          stopPlayback();
        } else if (m.type === 'turn_complete') {
          // Turno cerrado sin audio pendiente (ej. solo consultó datos): vuelve a esperar.
          if (!talkingRef.current && !sourcesRef.current.length) {
            if (stateRef.current === 'speaking' || stateRef.current === 'thinking') beep('turno');
            setPhase('ready');
          }
        } else if (m.type === 'error') {
          setErrMsg(m.msg || 'Error del asistente'); setPhase('error');
        } else if (m.type === 'closed') {
          if (stateRef.current !== 'error') setPhase('idle');
        }
      };
      ws.onerror = () => { setErrMsg('No se pudo conectar con el servidor de voz.'); setPhase('error'); };
      ws.onclose = () => { if (stateRef.current === 'connecting') { setErrMsg('Conexión cerrada.'); setPhase('error'); } };
    } catch (e) {
      setErrMsg(e?.name === 'NotAllowedError' ? 'Permiso de micrófono denegado.' : (e?.message || 'Error al iniciar.'));
      setPhase('error');
    }
  };

  const stop = () => { cleanup(); setErrMsg(''); setPhase('idle'); };

  // Sesión viva: hay botón de hablar y de cerrar. Incluye 'recording' — si no,
  // el listener que suelta el turno se desmontaría justo al empezar a grabar.
  const canTalk = ['ready', 'recording', 'thinking', 'speaking'].includes(state);

  const beginTalk = useCallback(() => {
    if (talkingRef.current) return;
    const live = ['ready', 'thinking', 'speaking'].includes(stateRef.current);
    if (!live || wsRef.current?.readyState !== 1) return;
    talkingRef.current = true;
    stopPlayback();                  // corta a Orwell en el navegador…
    beep('abre');
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = true; });
    send({ type: 'activity_start' }); // …y en Gemini (START_OF_ACTIVITY_INTERRUPTS)
    setPhase('recording');
  }, [beep]);

  const endTalk = useCallback(() => {
    if (!talkingRef.current) return;
    talkingRef.current = false;
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
    beep('cierra');
    send({ type: 'activity_end' });
    setPhase('thinking');
  }, [beep]);

  return { state, errMsg, start, stop, beginTalk, endTalk, canTalk };
}
