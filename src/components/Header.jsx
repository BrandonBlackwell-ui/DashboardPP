import { motion } from 'framer-motion';
import { C } from '../utils/helpers';
import ParticleBackground from './ParticleBackground';

const INK_FILTER = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><filter id='i'><feTurbulence type='fractalNoise' baseFrequency='0.022' numOctaves='3' seed='4'/><feDisplacementMap in='SourceGraphic' scale='1.4' xChannelSelector='R' yChannelSelector='G'/></filter></svg>#i")`;

export default function Header({ tab, data, onExport, onTabChange, onUpload }) {
  const T = data?.themes || {};
  const order = data?.order || [];

  const tabs = [
    { key:'panorama', label:'Panorama' },
    ...order.map(k => ({ key:k, label:T[k]?.label || k })),
    { key:'historico', label:'Histórico' },
    { key:'reporte', label:'Reporte' },
  ];

  return (
    <div style={{ position:'sticky', top:0, zIndex:40, background:C.paper,
      borderBottom:`2px solid ${C.ink}`, overflow:'hidden' }}>
      <ParticleBackground />

      <div style={{ position:'relative', padding:'13px 18px 0', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
          {/* Wordmark */}
          <div>
            <motion.span
              initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.5 }}
              style={{ display:'inline-block', lineHeight:1 }}>
              <span style={{ fontFamily:"'Geist',sans-serif", fontWeight:900, letterSpacing:'-0.04em',
                color:C.ink, fontSize:25, display:'inline-block', lineHeight:1,
                filter:'url(#bw-ink)' }}>Blackwell</span>
              <span style={{ display:'block', height:3, width:'100%', background:C.ink,
                borderRadius:1, filter:'url(#bw-ink-rough)', marginTop:2 }} />
            </motion.span>
            <motion.div
              initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3 }}
              style={{ display:'flex', alignItems:'center', gap:7, marginTop:9 }}>
              <motion.span
                animate={{ scale:[1,1.3,1] }} transition={{ repeat:Infinity, duration:2.5, ease:'easeInOut' }}
                style={{ width:7, height:7, background:C.gold, borderRadius:'50%', flex:'none' }} />
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.14em',
                textTransform:'uppercase', color:C.gold, fontWeight:600 }}>
                Brief Diario · Pepe Aguilar
              </span>
            </motion.div>
          </div>

          {/* Action buttons */}
          <div style={{ display:'flex', flexDirection:'column', gap:5, flex:'none' }}>
            <motion.button whileHover={{ background:C.ink, color:'#FBF8F1' }} whileTap={{ scale:0.95 }}
              onClick={onExport}
              style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 11px', borderRadius:2,
                fontFamily:"'Geist Mono',monospace", fontSize:10, fontWeight:600, letterSpacing:'0.08em',
                textTransform:'uppercase', border:`1px solid ${C.ink}`, background:'transparent',
                color:C.ink, cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}>
              {tab==='panorama'||tab==='historico' ? 'Exportar' : 'Exportar'} ↓
            </motion.button>
            <motion.button whileHover={{ background:C.gold, color:'#FBF8F1', borderColor:C.gold }} whileTap={{ scale:0.95 }}
              onClick={onUpload}
              style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 11px', borderRadius:2,
                fontFamily:"'Geist Mono',monospace", fontSize:10, fontWeight:600, letterSpacing:'0.08em',
                textTransform:'uppercase', border:`1px solid ${C.gold}`, background:'transparent',
                color:C.gold, cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}>
              + Subir CSV
            </motion.button>
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display:'flex', gap:6, marginTop:13, overflowX:'auto', paddingBottom:11,
          scrollbarWidth:'none' }}>
          {tabs.map(t => (
            <motion.button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              whileTap={{ scale:0.95 }}
              style={{ flex:'none', fontFamily:"'Geist Mono',monospace", fontWeight:600,
                fontSize:10.5, letterSpacing:'0.08em', textTransform:'uppercase',
                padding:'8px 13px', borderRadius:2, cursor:'pointer', whiteSpace:'nowrap',
                border: tab===t.key ? `1px solid ${C.gold}` : '1px solid rgba(33,28,23,0.13)',
                background: tab===t.key ? C.gold : 'transparent',
                color: tab===t.key ? '#FBF8F1' : '#6B6253',
                transition:'all 0.2s' }}>
              {t.label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
