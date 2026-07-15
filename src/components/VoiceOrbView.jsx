import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../utils/helpers';
import { useVoiceSession } from '../hooks/useVoiceSession';

const GRID_BG = {
  backgroundImage: 'linear-gradient(rgba(33,28,23,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(33,28,23,0.05) 1px,transparent 1px)',
  backgroundSize: '24px 24px',
};

// Paleta del orbe por estado: [color base, sombra profunda]
const ORB = {
  idle:       { base: '#B0822F', deep: '#6E5015', label: 'Toca el orbe para hablar' },
  connecting: { base: '#B0822F', deep: '#6E5015', label: 'Conectando…' },
  listening:  { base: '#4E7351', deep: '#2C4630', label: 'Escuchando…' },
  speaking:   { base: '#8A5E1E', deep: '#4E340D', label: 'Respondiendo…' },
  error:      { base: '#9B3331', deep: '#571C1B', label: 'Error' },
};

// Animación de "respiración" del orbe según estado
const BREATH = {
  idle:       { scale: [1, 1.02, 1],  dur: 3.6 },
  connecting: { scale: [1, 1.03, 1],  dur: 1.2 },
  listening:  { scale: [1, 1.05, 1],  dur: 2.0 },
  speaking:   { scale: [1, 1.09, 1],  dur: 0.65 },
  error:      { scale: [1, 1, 1],     dur: 2 },
};

export default function VoiceOrbView({ onBack, isDesktop }) {
  const { state, errMsg, start, stop } = useVoiceSession();
  const meta = ORB[state];
  const breath = BREATH[state];
  const active = state === 'listening' || state === 'speaking' || state === 'connecting';
  const orbSize = isDesktop ? 300 : Math.min(280, window.innerWidth * 0.64);

  const handleBack = () => { stop(); onBack(); };

  return (
    <div style={{ position:'fixed', inset:0, background:'#EFE9DC', ...GRID_BG, zIndex:150,
      display:'flex', flexDirection:'column', fontFamily:"'Geist', system-ui, sans-serif" }}>

      {/* Barra superior */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 22px',
        borderBottom:'2px solid #211C17', background:'rgba(239,233,220,0.9)' }}>
        <button onClick={handleBack}
          style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, fontWeight:700, letterSpacing:'0.08em',
            textTransform:'uppercase', color:C.ink, background:'transparent',
            border:'1.5px solid #211C17', borderRadius:3, padding:'7px 13px', cursor:'pointer' }}>
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
        justifyContent:'center', gap:28, padding:'0 24px' }}>

        <div style={{ position:'relative', width:orbSize, height:orbSize }}>
          {/* Halo exterior */}
          <motion.div
            key={`halo-${state}`}
            animate={{ opacity: active ? [0.35, 0.6, 0.35] : 0.25, scale: breath.scale }}
            transition={{ repeat: Infinity, duration: breath.dur, ease: 'easeInOut' }}
            style={{ position:'absolute', inset:-36, borderRadius:'50%', filter:'blur(34px)',
              background:`radial-gradient(circle, ${meta.base}66 0%, transparent 70%)` }} />

          {/* Ondas cuando está activo */}
          <AnimatePresence>
            {active && [0, 1].map(i => (
              <motion.span key={`ring-${i}-${state}`}
                initial={{ opacity: 0.4, scale: 1 }}
                animate={{ opacity: 0, scale: 1.45 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: state === 'speaking' ? 1.1 : 2.2,
                  delay: i * (state === 'speaking' ? 0.55 : 1.1), ease: 'easeOut' }}
                style={{ position:'absolute', inset:0, borderRadius:'50%',
                  border:`1.5px solid ${meta.base}` }} />
            ))}
          </AnimatePresence>

          {/* Cuerpo del orbe */}
          <motion.button
            key={`orb-${state}`}
            onClick={state === 'idle' || state === 'error' ? start : stop}
            whileTap={{ scale: 0.97 }}
            animate={{ scale: breath.scale }}
            transition={{ repeat: Infinity, duration: breath.dur, ease: 'easeInOut' }}
            title={state === 'idle' || state === 'error' ? 'Iniciar conversación' : 'Detener'}
            style={{ position:'absolute', inset:0, borderRadius:'50%', cursor:'pointer', border:'none',
              background:`radial-gradient(circle at 33% 28%, #FBF8F1AA 0%, ${meta.base} 46%, ${meta.deep} 100%)`,
              boxShadow:`0 24px 70px ${meta.deep}55, inset 0 -14px 40px ${meta.deep}88, inset 0 10px 30px #FBF8F144`,
            }}>
            {/* brillo superior */}
            <span style={{ position:'absolute', top:'12%', left:'22%', width:'34%', height:'20%',
              borderRadius:'50%', background:'radial-gradient(circle, #FBF8F166 0%, transparent 70%)',
              transform:'rotate(-18deg)', pointerEvents:'none' }} />
          </motion.button>
        </div>

        {/* Estado */}
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, fontWeight:700,
            letterSpacing:'0.16em', textTransform:'uppercase',
            color: state === 'error' ? C.crim : meta.base }}>
            {state === 'error' ? (errMsg || 'Error') : meta.label}
          </div>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, color:'#8A7E6A',
            marginTop:10, lineHeight:1.6, letterSpacing:'0.04em' }}>
            Conoce el sentimiento, aliados, medios e histórico del dashboard.<br/>
            Habla con naturalidad — puedes interrumpir mientras responde.
          </div>
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
