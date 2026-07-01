import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../utils/helpers';

function Chip({ label, active, onClick }) {
  return (
    <motion.button
      whileTap={{ scale:0.93 }}
      onClick={onClick}
      style={{ flex:'none', fontFamily:"'Geist Mono',monospace", fontWeight:500,
        fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase',
        padding:'6px 11px', borderRadius:2, cursor:'pointer', whiteSpace:'nowrap',
        background: active ? C.ink : C.card,
        color: active ? '#FBF8F1' : '#6B6253',
        border: active ? `1px solid ${C.ink}` : '1px solid rgba(33,28,23,0.13)',
        transition:'all 0.15s' }}>
      {label}
    </motion.button>
  );
}

const OWNED_NETS = [
  { key:'instagram', label:'Instagram' },
  { key:'facebook',  label:'Facebook' },
  { key:'tiktok',    label:'TikTok' },
  { key:'youtube',   label:'YouTube' },
  { key:'x',         label:'X' },
];

const MONTH_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fmtDateKey(dk) {
  if (!dk || dk === 'todas') return '';
  const d = new Date(dk + 'T12:00:00');
  if (isNaN(d)) return dk;
  return `${d.getDate()} ${MONTH_ES[d.getMonth()]} ${d.getFullYear()}`;
}

export default function SubBar({ tab, pano, date, data, dateOptions, onPanoChange, onDateChange, onOwnedNetChange, ownedNet, isDesktop, panoramaDate, onPanoramaDateChange }) {
  if (tab === 'panorama') return null;

  const isTheme = tab !== 'historico' && tab !== 'reporte' && tab !== 'redes_propias' && tab !== 'social_listening' && tab !== 'aliados';
  const isHist = tab === 'historico';
  const isOwned = tab === 'redes_propias';
  const isSL = tab === 'social_listening';

  return (
    <div style={{ position:'sticky', top:0, zIndex:30, background:C.sub,
      borderBottom:'1px solid #E3DAC6', padding: isDesktop ? '10px 24px' : '10px 18px' }}>
      <AnimatePresence mode="wait">

        {isOwned && (
          <motion.div key="owned"
            initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
            transition={{ duration:0.2 }}
            style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, letterSpacing:'0.14em',
                textTransform:'uppercase', color:'#8A7E6A', flex:'none' }}>
                {date && date !== 'todas' ? fmtDateKey(date) : 'Última actualización'}
              </span>
            </div>
            <div style={{ display:'flex', gap:5, overflowX:'auto', scrollbarWidth:'none' }}>
              {OWNED_NETS.map(n => (
                <Chip key={n.key} label={n.label} active={ownedNet === n.key} onClick={() => onOwnedNetChange?.(n.key)} />
              ))}
            </div>
          </motion.div>
        )}

        {isSL && (
          <motion.div key="sl"
            initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
            transition={{ duration:0.2 }}>
            <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, letterSpacing:'0.14em',
              textTransform:'uppercase', color:'#8A7E6A' }}>
              {date && date !== 'todas' ? fmtDateKey(date) : 'Última actualización'}
            </span>
          </motion.div>
        )}

        {isTheme && (
          <motion.div key="theme"
            initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
            transition={{ duration:0.2 }}
            style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, letterSpacing:'0.14em',
                textTransform:'uppercase', color:'#8A7E6A', width:54, flex:'none' }}>Fecha</span>
              <div style={{ display:'flex', gap:5, overflowX:'auto', scrollbarWidth:'none' }}>
                {(dateOptions || []).map(([k,l]) => (
                  <Chip key={k} label={l} active={date===k} onClick={() => onDateChange(k)} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {isHist && (
          <motion.div key="hist"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
              {[['#4E7351','Música'],['#B0822F','Entrevistas'],['#9B3331','Empresas'],['#A9997B','Familia']].map(([c,l]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ width:8,height:8,borderRadius:2,background:c,flex:'none' }} />
                  <span style={{ fontFamily:"'Geist Mono',monospace",fontSize:9,color:'#6B6253',letterSpacing:'0.08em',textTransform:'uppercase' }}>{l}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
