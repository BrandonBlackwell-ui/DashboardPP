import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../utils/helpers';
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

export default function VoiceAssistant() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('idle'); // idle | connecting | listening | speaking | error
  const [errMsg, setErrMsg] = useState('');
  const [transcript, setTranscript] = useState('');

  const wsRef = useRef(null);
  const micCtxRef = useRef(null);
  const streamRef = useRef(null);
  const procRef = useRef(null);
  const playCtxRef = useRef(null);
  const playTimeRef = useRef(0);
  const sourcesRef = useRef([]);

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
    setErrMsg(''); setTranscript(''); setState('connecting');
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
        } else if (m.type === 'text') {
          setTranscript(t => (t + ' ' + m.text).trim().slice(-600));
        } else if (m.type === 'interrupted') {
          stopPlayback();
        } else if (m.type === 'error') {
          setErrMsg(m.msg || 'Error del asistente'); setState('error');
        } else if (m.type === 'closed') {
          if (state !== 'error') setState('idle');
        }
      };
      ws.onerror = () => { setErrMsg('No se pudo conectar con el servidor de voz.'); setState('error'); };
      ws.onclose = () => { if (state === 'connecting') { setErrMsg('Conexión cerrada.'); setState('error'); } };
    } catch (e) {
      setErrMsg(e?.name === 'NotAllowedError' ? 'Permiso de micrófono denegado.' : (e?.message || 'Error al iniciar.'));
      setState('error');
    }
  };

  const stop = () => { cleanup(); setState('idle'); };

  const toggleOpen = () => {
    if (open) { stop(); setOpen(false); }
    else { setOpen(true); }
  };

  const stateMeta = {
    idle:       { label: 'Toca para hablar', color: C.gold, pulse: false },
    connecting: { label: 'Conectando…', color: C.gold, pulse: true },
    listening:  { label: 'Escuchando…', color: C.teal, pulse: true },
    speaking:   { label: 'Respondiendo…', color: C.goldDeep, pulse: true },
    error:      { label: errMsg || 'Error', color: C.crim, pulse: false },
  }[state];

  return (
    <>
      {/* Botón flotante */}
      <motion.button
        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
        onClick={toggleOpen}
        title="Asistente de voz"
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 120,
          width: 56, height: 56, borderRadius: '50%', cursor: 'pointer',
          border: 'none', background: open ? C.ink : C.gold, color: open ? C.gold : '#1A1612',
          boxShadow: '0 6px 20px rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 22 }}>
        {open ? '×' : '🎙️'}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{ position: 'fixed', bottom: 92, right: 24, zIndex: 120,
              width: 320, background: '#FAF7F0', border: '1.5px solid #211C17',
              borderRadius: 6, boxShadow: '0 12px 40px rgba(0,0,0,0.3)', overflow: 'hidden' }}>

            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(33,28,23,0.13)' }}>
              <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9.5, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: C.gold, fontWeight: 600, marginBottom: 2 }}>
                Asistente · IA de voz
              </div>
              <div style={{ fontFamily: "'Geist',sans-serif", fontWeight: 600, fontSize: 15, color: C.ink }}>
                Pregúntame del dashboard
              </div>
            </div>

            <div style={{ padding: '22px 16px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <motion.button
                onClick={state === 'idle' || state === 'error' ? start : stop}
                whileTap={{ scale: 0.95 }}
                style={{ width: 84, height: 84, borderRadius: '50%', cursor: 'pointer',
                  border: `2px solid ${stateMeta.color}`, background: `${stateMeta.color}18`,
                  color: stateMeta.color, fontSize: 30, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', position: 'relative' }}>
                {state === 'idle' || state === 'error' ? '🎙️' : '■'}
                {stateMeta.pulse && (
                  <motion.span
                    animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.6 }}
                    style={{ position: 'absolute', inset: -2, borderRadius: '50%',
                      border: `2px solid ${stateMeta.color}` }} />
                )}
              </motion.button>

              <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: state === 'error' ? C.crim : '#6B6253', textAlign: 'center' }}>
                {stateMeta.label}
              </div>

              {transcript && (
                <div style={{ fontSize: 12, lineHeight: 1.45, color: '#2A241C', background: 'rgba(33,28,23,0.04)',
                  border: '1px solid rgba(33,28,23,0.08)', borderRadius: 4, padding: '9px 11px',
                  maxHeight: 120, overflowY: 'auto', width: '100%' }}>
                  {transcript}
                </div>
              )}

              <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: '#A9997B',
                textAlign: 'center', lineHeight: 1.5 }}>
                Conoce sentimiento, aliados, medios e histórico.<br/>Habla con naturalidad; puedes interrumpir.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
