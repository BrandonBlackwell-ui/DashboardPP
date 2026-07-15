import { motion } from 'framer-motion';

const GRID_BG = {
  backgroundImage: 'linear-gradient(rgba(33,28,23,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(33,28,23,0.07) 1px,transparent 1px)',
  backgroundSize: '24px 24px',
};

// Iconos de línea, estilo de la casa (tinta, trazo 1.6)
const IconDashboard = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="square">
    <rect x="3.5" y="3.5" width="17" height="17" rx="0.5" />
    <line x1="8"  y1="16.5" x2="8"  y2="11" />
    <line x1="12" y1="16.5" x2="12" y2="7.5" />
    <line x1="16" y1="16.5" x2="16" y2="13" />
  </svg>
);
const IconVoice = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="square">
    <rect x="9.2" y="3.5" width="5.6" height="10.5" rx="2.8" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <line x1="12" y1="18" x2="12" y2="20.5" />
    <line x1="8.5" y1="20.5" x2="15.5" y2="20.5" />
  </svg>
);

export default function ModeSelect({ onPick, isDesktop }) {
  const cards = [
    { key: 'dashboard', title: 'Dashboard', sub: 'Panorama, histórico, aliados y reportes',
      Icon: IconDashboard, accent: '#B0822F' },
    { key: 'voice', title: 'Agente de Voz', sub: 'Conversa con la IA sobre tu reputación',
      Icon: IconVoice, accent: '#4E7351' },
  ];

  return (
    <div style={{ position:'fixed', inset:0, background:'#241E18', display:'flex',
      alignItems:'center', justifyContent:'center', padding:24,
      fontFamily:"'Geist', system-ui, sans-serif" }}>
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        style={{ background:'#EFE9DC', borderRadius:4, width:'100%',
          maxWidth: isDesktop ? 620 : 400, padding: isDesktop ? '44px 44px 40px' : '36px 26px 30px',
          ...GRID_BG }}>

        {/* Wordmark */}
        <div style={{ textAlign:'center', marginBottom:34 }}>
          <div style={{ fontFamily:"'Geist',sans-serif", fontWeight:900, letterSpacing:'-0.04em',
            fontSize:28, color:'#211C17', lineHeight:1 }}>Blackwell</div>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, letterSpacing:'0.18em',
            textTransform:'uppercase', color:'#B0822F', marginTop:5 }}>
            Strategy · ¿Cómo quieres entrar?
          </div>
        </div>

        {/* Dos botones grandes */}
        <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap:14 }}>
          {cards.map(({ key, title, sub, Icon, accent }) => (
            <motion.button key={key}
              whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
              onClick={() => onPick(key)}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14,
                padding:'34px 20px 26px', cursor:'pointer', textAlign:'center',
                background:'#FAF7F0', border:'1.5px solid #211C17', borderRadius:4,
                boxShadow:'4px 4px 0 rgba(33,28,23,0.16)' }}>
              <span style={{ width:76, height:76, borderRadius:'50%', display:'flex',
                alignItems:'center', justifyContent:'center', color:accent,
                background:`${accent}14`, border:`1.5px solid ${accent}` }}>
                <Icon />
              </span>
              <span style={{ fontFamily:"'Geist',sans-serif", fontWeight:700, fontSize:18,
                color:'#211C17', letterSpacing:'-0.01em' }}>{title}</span>
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, color:'#8A7E6A',
                lineHeight:1.5, letterSpacing:'0.04em', textTransform:'uppercase' }}>{sub}</span>
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, fontWeight:700,
                color:accent, letterSpacing:'0.1em', textTransform:'uppercase', marginTop:2 }}>
                Entrar →
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
