import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../utils/helpers';
import { useVoiceSession } from '../hooks/useVoiceSession';

const GRID_BG = {
  backgroundImage: 'linear-gradient(rgba(33,28,23,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(33,28,23,0.05) 1px,transparent 1px)',
  backgroundSize: '24px 24px',
};

// Paleta del orbe por estado: [color base, sombra profunda]
const ORB = {
  idle:       { base: '#B0822F', deep: '#6E5015', label: 'Sesión cerrada' },
  connecting: { base: '#B0822F', deep: '#6E5015', label: 'Conectando…' },
  ready:      { base: '#7A7263', deep: '#413B31', label: 'Mantén presionado para hablar' },
  recording:  { base: '#4E7351', deep: '#2C4630', label: 'Grabando… suelta para enviar' },
  thinking:   { base: '#B0822F', deep: '#6E5015', label: 'Pensando…' },
  speaking:   { base: '#8A5E1E', deep: '#4E340D', label: 'Respondiendo… presiona para interrumpir' },
  error:      { base: '#9B3331', deep: '#571C1B', label: 'Error' },
};

// Animación de "respiración" del orbe según estado
const BREATH = {
  idle:       { scale: [1, 1.02, 1],  dur: 3.6 },
  connecting: { scale: [1, 1.03, 1],  dur: 1.2 },
  ready:      { scale: [1, 1.02, 1],  dur: 3.0 },
  recording:  { scale: [1, 1.07, 1],  dur: 0.9 },
  thinking:   { scale: [1, 1.04, 1],  dur: 1.4 },
  speaking:   { scale: [1, 1.09, 1],  dur: 0.65 },
  error:      { scale: [1, 1, 1],     dur: 2 },
};

export default function VoiceOrbView({ onBack, isDesktop }) {
  const { state, errMsg, start, stop, beginTalk, endTalk, canTalk } = useVoiceSession();
  const meta = ORB[state] || ORB.idle;
  const breath = BREATH[state] || BREATH.idle;
  const active = state !== 'idle' && state !== 'error';
  const orbSize = isDesktop ? 300 : Math.min(280, window.innerWidth * 0.64);

  const handleBack = () => { stop(); onBack(); };

  // Barra espaciadora como botón de hablar (solo con la sesión abierta).
  useEffect(() => {
    if (!canTalk) return;
    const down = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      beginTalk();
    };
    const up = (e) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      endTalk();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [canTalk, beginTalk, endTalk]);

  // Si el dedo/cursor se suelta fuera del orbe, el turno igual se cierra.
  useEffect(() => {
    if (!canTalk) return;
    const up = () => endTalk();
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [canTalk, endTalk]);

  const btnBase = {
    fontFamily: "'Geist Mono',monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', borderRadius: 3, padding: '11px 22px', cursor: 'pointer',
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'#EFE9DC', ...GRID_BG, zIndex:150,
      display:'flex', flexDirection:'column', fontFamily:"'Geist', system-ui, sans-serif" }}>

      {/* Barra superior */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 22px',
        borderBottom:'2px solid #211C17', background:'rgba(239,233,220,0.9)' }}>
        <button onClick={handleBack}
          style={{ ...btnBase, fontSize:11, padding:'7px 13px', color:C.ink,
            background:'transparent', border:'1.5px solid #211C17' }}>
          ← Volver
        </button>
        <div style={{ flex:1 }} />
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:"'Geist',sans-serif", fontWeight:900, letterSpacing:'-0.04em',
            fontSize:19, color:'#211C17', lineHeight:1 }}>Blackwell</div>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:8.5, letterSpacing:'0.18em',
            textTransform:'uppercase', color:C.gold, marginTop:3 }}>Agente de voz · IA</div>
        </div>
      </div>

      {/* Orbe central */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', gap:24, padding:'0 24px' }}>

        <div style={{ position:'relative', width:orbSize, height:orbSize }}>
          {/* Halo exterior */}
          <motion.div
            key={`halo-${state}`}
            animate={{ opacity: active ? [0.35, 0.6, 0.35] : 0.25, scale: breath.scale }}
            transition={{ repeat: Infinity, duration: breath.dur, ease: 'easeInOut' }}
            style={{ position:'absolute', inset:-36, borderRadius:'50%', filter:'blur(34px)',
              background:`radial-gradient(circle, ${meta.base}66 0%, transparent 70%)` }} />

          {/* Ondas cuando hay actividad real (no en reposo esperando el botón) */}
          <AnimatePresence>
            {(state === 'recording' || state === 'speaking' || state === 'connecting' || state === 'thinking') &&
              [0, 1].map(i => (
                <motion.span key={`ring-${i}-${state}`}
                  initial={{ opacity: 0.4, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.45 }}
                  exit={{ opacity: 0 }}
                  transition={{ repeat: Infinity, duration: state === 'speaking' ? 1.1 : 1.6,
                    delay: i * (state === 'speaking' ? 0.55 : 0.8), ease: 'easeOut' }}
                  style={{ position:'absolute', inset:0, borderRadius:'50%',
                    border:`1.5px solid ${meta.base}` }} />
            ))}
          </AnimatePresence>

          {/* Cuerpo del orbe: con la sesión abierta es el botón de hablar.
              Sin `key` por estado a propósito: remontarlo a media pulsación
              perdería la captura del puntero y el turno quedaría abierto. */}
          <motion.button
            onPointerDown={(e) => {
              if (!canTalk) return;
              try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
              beginTalk();
            }}
            onPointerUp={() => canTalk && endTalk()}
            onClick={() => { if (state === 'idle' || state === 'error') start(); }}
            onContextMenu={(e) => e.preventDefault()}
            whileTap={{ scale: 0.97 }}
            animate={{ scale: breath.scale }}
            transition={{ repeat: Infinity, duration: breath.dur, ease: 'easeInOut' }}
            title={canTalk ? 'Mantén presionado para hablar (o barra espaciadora)'
              : (state === 'connecting' ? 'Conectando…' : 'Iniciar sesión')}
            style={{ position:'absolute', inset:0, borderRadius:'50%', border:'none',
              cursor: state === 'connecting' ? 'wait' : 'pointer',
              userSelect:'none', WebkitUserSelect:'none', WebkitTouchCallout:'none', touchAction:'none',
              background:`radial-gradient(circle at 33% 28%, #FBF8F1AA 0%, ${meta.base} 46%, ${meta.deep} 100%)`,
              boxShadow: state === 'recording'
                ? `0 0 0 6px ${meta.base}33, 0 24px 70px ${meta.deep}66, inset 0 -14px 40px ${meta.deep}88, inset 0 10px 30px #FBF8F144`
                : `0 24px 70px ${meta.deep}55, inset 0 -14px 40px ${meta.deep}88, inset 0 10px 30px #FBF8F144`,
            }}>
            {/* brillo superior */}
            <span style={{ position:'absolute', top:'12%', left:'22%', width:'34%', height:'20%',
              borderRadius:'50%', background:'radial-gradient(circle, #FBF8F166 0%, transparent 70%)',
              transform:'rotate(-18deg)', pointerEvents:'none' }} />
            {/* etiqueta central */}
            <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
              justifyContent:'center', pointerEvents:'none', fontFamily:"'Geist Mono',monospace",
              fontSize: 11, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase',
              color:'#FBF8F1', textShadow:`0 1px 8px ${meta.deep}` }}>
              {state === 'idle' || state === 'error' ? 'Iniciar' : state === 'recording' ? 'Hablando' : ''}
            </span>
          </motion.button>
        </div>

        {/* Estado */}
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, fontWeight:700,
            letterSpacing:'0.16em', textTransform:'uppercase',
            color: state === 'error' ? C.crim : meta.base }}>
            {state === 'error' ? (errMsg || 'Error') : meta.label}
          </div>
        </div>

        {/* Botones de sesión */}
        <div style={{ display:'flex', gap:10 }}>
          {(state === 'idle' || state === 'error') && (
            <button onClick={start}
              style={{ ...btnBase, color:'#FBF8F1', background:C.ink, border:'1.5px solid #211C17' }}>
              Iniciar sesión
            </button>
          )}
          {state === 'connecting' && (
            <button disabled
              style={{ ...btnBase, color:'#8A7E6A', background:'transparent',
                border:'1.5px solid rgba(33,28,23,0.25)', cursor:'wait' }}>
              Conectando…
            </button>
          )}
          {canTalk && (
            <button onClick={stop}
              style={{ ...btnBase, color:C.crim, background:'transparent', border:`1.5px solid ${C.crim}` }}>
              Cerrar sesión
            </button>
          )}
        </div>

        {/* Instrucciones */}
        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, color:'#8A7E6A',
          textAlign:'center', lineHeight:1.7, letterSpacing:'0.04em', maxWidth:420 }}>
          {canTalk ? (
            <>
              Mantén presionado el orbe <span style={{ color:C.gold }}>(o la barra espaciadora)</span> mientras hablas
              y suelta para enviar.<br/>
              Si Orwell está respondiendo, presionar de nuevo lo interrumpe.
            </>
          ) : (
            <>
              Conoce el sentimiento, aliados, medios e histórico del dashboard.<br/>
              Abre la sesión y habla por turnos: presionas, hablas, sueltas.
            </>
          )}
        </div>
      </div>

      {/* Pie */}
      <div style={{ padding:'14px 22px', borderTop:'1px solid rgba(33,28,23,0.13)',
        display:'flex', justifyContent:'space-between', fontFamily:"'Geist Mono',monospace",
        fontSize:9, letterSpacing:'0.06em', textTransform:'uppercase', color:C.gold }}>
        <span>Preparado por Blackwell Strategy</span>
        <span style={{ color:C.crim, fontWeight:600 }}>Confidencial · uso interno</span>
      </div>
    </div>
  );
}
