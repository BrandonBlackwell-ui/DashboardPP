import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../utils/helpers';
import { useVoiceSession } from '../hooks/useVoiceSession';

// Mismo icono de línea que la pantalla de entrada (ModeSelect).
const IconVoice = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="square">
    <rect x="9.2" y="3.5" width="5.6" height="10.5" rx="2.8" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <line x1="12" y1="18" x2="12" y2="20.5" />
    <line x1="8.5" y1="20.5" x2="15.5" y2="20.5" />
  </svg>
);

export default function VoiceAssistant() {
  const [open, setOpen] = useState(false);
  const { state, errMsg, start, stop, beginTalk, endTalk, canTalk } = useVoiceSession();

  // Permite abrir el asistente desde otro botón (ej. el sidebar de admin)
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener('bw-open-voice', openIt);
    return () => window.removeEventListener('bw-open-voice', openIt);
  }, []);

  const toggleOpen = () => {
    if (open) { stop(); setOpen(false); }
    else { setOpen(true); }
  };

  // Suelta el turno aunque el cursor/dedo se levante fuera del botón.
  useEffect(() => {
    if (!canTalk) return;
    const up = () => endTalk();
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [canTalk, endTalk]);

  const stateMeta = {
    idle:       { label: 'Sesión cerrada', color: C.gold, pulse: false },
    connecting: { label: 'Conectando…', color: C.gold, pulse: true },
    ready:      { label: 'Mantén presionado', color: '#7A7263', pulse: false },
    recording:  { label: 'Grabando… suelta para enviar', color: C.teal, pulse: true },
    thinking:   { label: 'Pensando…', color: C.gold, pulse: true },
    speaking:   { label: 'Respondiendo… presiona para cortar', color: C.goldDeep, pulse: true },
    error:      { label: errMsg || 'Error', color: C.crim, pulse: false },
  }[state] || { label: '', color: C.gold, pulse: false };

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
        {open ? '×' : <IconVoice size={24} />}
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
                onPointerDown={(e) => {
                  if (!canTalk) return;
                  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
                  beginTalk();
                }}
                onPointerUp={() => canTalk && endTalk()}
                onClick={() => { if (state === 'idle' || state === 'error') start(); }}
                onContextMenu={(e) => e.preventDefault()}
                whileTap={{ scale: 0.95 }}
                title={canTalk ? 'Mantén presionado para hablar' : 'Iniciar sesión'}
                style={{ width: 84, height: 84, borderRadius: '50%',
                  cursor: state === 'connecting' ? 'wait' : 'pointer',
                  userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'none',
                  border: `2px solid ${stateMeta.color}`,
                  background: state === 'recording' ? `${stateMeta.color}33` : `${stateMeta.color}18`,
                  boxShadow: state === 'recording' ? `0 0 0 5px ${stateMeta.color}22` : 'none',
                  color: stateMeta.color, fontSize: 30, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', position: 'relative' }}>
                {canTalk ? '🎙️' : state === 'connecting' ? '…' : '▶'}
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

              {/* Sesión: abrir / cerrar */}
              <div style={{ display: 'flex', gap: 8 }}>
                {(state === 'idle' || state === 'error') && (
                  <button onClick={start}
                    style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FBF8F1',
                      background: C.ink, border: '1.5px solid #211C17', borderRadius: 3,
                      padding: '9px 16px', cursor: 'pointer' }}>
                    Iniciar sesión
                  </button>
                )}
                {canTalk && (
                  <button onClick={stop}
                    style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase', color: C.crim,
                      background: 'transparent', border: `1.5px solid ${C.crim}`, borderRadius: 3,
                      padding: '9px 16px', cursor: 'pointer' }}>
                    Cerrar sesión
                  </button>
                )}
              </div>

              <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: '#A9997B',
                textAlign: 'center', lineHeight: 1.5 }}>
                {canTalk
                  ? <>Mantén presionado el micrófono mientras hablas<br/>y suelta para enviar. Presiona de nuevo para interrumpir.</>
                  : <>Conoce sentimiento, aliados, medios e histórico.<br/>Sesión por turnos, tipo walkie-talkie.</>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
