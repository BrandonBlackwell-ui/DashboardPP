import { useState, useRef, useEffect } from 'react';
import { buildAssistantContext } from '../lib/buildAssistantContext';

const HTTP_SERVER = import.meta.env.VITE_ANALIZAR_SERVER || 'http://localhost:3001';
const WS_URL = HTTP_SERVER.replace(/^http/, 'ws').replace(/\/$/, '') + '/voz';

const IN_RATE = 16000;   // Gemini espera PCM16 mono 16kHz de entrada
const OUT_RATE = 24000;  // Gemini devuelve PCM16 mono 24kHz

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

// Sesión de voz con el relay /voz del servidor (Gemini Live).
// Devuelve { state, errMsg, start, stop } — state: idle|connecting|listening|speaking|error
export function useVoiceSession() {
  const [state, setState] = useState('idle');
  const [errMsg, setErrMsg] = useState('');

  const wsRef = useRef(null);
  const micCtxRef = useRef(null);
  const streamRef = useRef(null);
  const procRef = useRef(null);
  const playCtxRef = useRef(null);
  const playTimeRef = useRef(0);
  const sourcesRef = useRef([]);
  const stateRef = useRef('idle');   // espejo de `state` para leer dentro de callbacks del WS

  useEffect(() => { stateRef.current = state; }, [state]);

  const cleanup = () => {
    try { wsRef.current?.send(JSON.stringify({ type: 'stop' })); } catch { /* noop */ }
    try { wsRef.current?.close(); } catch { /* noop */ }
    try { procRef.current?.disconnect(); } catch { /* noop */ }
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch { /* noop */ }
    try { micCtxRef.current?.close(); } catch { /* noop */ }
    try { playCtxRef.current?.close(); } catch { /* noop */ }
    wsRef.current = null; procRef.current = null; streamRef.current = null;
    micCtxRef.current = null; playCtxRef.current = null;
    sourcesRef.current = []; playTimeRef.current = 0;
  };

  useEffect(() => () => cleanup(), []);

  const stopPlayback = () => {
    sourcesRef.current.forEach(s => { try { s.stop(); } catch { /* noop */ } });
    sourcesRef.current = [];
    playTimeRef.current = playCtxRef.current?.currentTime || 0;
  };

  const playChunk = (b64) => {
    const ctx = playCtxRef.current;
    if (!ctx) return;
    const int16 = base64ToInt16(b64);
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
    const buf = ctx.createBuffer(1, f32.length, OUT_RATE);
    buf.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    playTimeRef.current = Math.max(playTimeRef.current, now);
    src.start(playTimeRef.current);
    playTimeRef.current += buf.duration;
    setState('speaking');
    src.onended = () => {
      sourcesRef.current = sourcesRef.current.filter(s => s !== src);
      if (!sourcesRef.current.length) setState('listening');
    };
    sourcesRef.current.push(src);
  };

  const start = async () => {
    setErrMsg(''); setState('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const micCtx = new (window.AudioContext || window.webkitAudioContext)();
      micCtxRef.current = micCtx;
      await micCtx.resume();
      const playCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: OUT_RATE });
      playCtxRef.current = playCtx;
      await playCtx.resume();
      playTimeRef.current = playCtx.currentTime;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'start', context: buildAssistantContext() }));
      };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === 'ready') {
          setState('listening');
          // Empieza a capturar micrófono
          const source = micCtx.createMediaStreamSource(stream);
          const proc = micCtx.createScriptProcessor(4096, 1, 1);
          procRef.current = proc;
          proc.onaudioprocess = (e) => {
            if (ws.readyState !== 1) return;
            const pcm = floatTo16kPCM(e.inputBuffer.getChannelData(0), micCtx.sampleRate);
            ws.send(JSON.stringify({ type: 'audio', data: bytesToBase64(new Uint8Array(pcm.buffer)) }));
          };
          source.connect(proc);
          proc.connect(micCtx.destination);
        } else if (m.type === 'audio') {
          playChunk(m.data);
        } else if (m.type === 'interrupted') {
          stopPlayback();
        } else if (m.type === 'error') {
          setErrMsg(m.msg || 'Error del asistente'); setState('error');
        } else if (m.type === 'closed') {
          if (stateRef.current !== 'error') setState('idle');
        }
      };
      ws.onerror = () => { setErrMsg('No se pudo conectar con el servidor de voz.'); setState('error'); };
      ws.onclose = () => { if (stateRef.current === 'connecting') { setErrMsg('Conexión cerrada.'); setState('error'); } };
    } catch (e) {
      setErrMsg(e?.name === 'NotAllowedError' ? 'Permiso de micrófono denegado.' : (e?.message || 'Error al iniciar.'));
      setState('error');
    }
  };

  const stop = () => { cleanup(); setState('idle'); };

  return { state, errMsg, start, stop };
}
