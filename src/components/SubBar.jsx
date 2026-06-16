import { motion, AnimatePresence } from 'framer-motion';
import { C, platLabel } from '../utils/helpers';

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

export default function SubBar({ tab, pano, date, plat, data, dateOptions, onPanoChange, onDateChange, onPlatChange, isDesktop }) {
  const isPanorama = tab === 'panorama';
  const isTheme = !isPanorama && tab !== 'historico';
  const isHist = tab === 'historico';

  const T = data?.themes || {};
  const order = data?.order || [];
  const platSet = new Set();
  (isTheme ? [T[tab]] : order.map(k=>T[k])).forEach(t =>
    (t?.platforms||[]).forEach(p => platSet.add(p.name)));
  const platOpts = [['todas','Todas'], ...Array.from(platSet).map(p => [p, platLabel(p)])];

  return (
    <div style={{ position:'sticky', top:0, zIndex:30, background:C.sub,
      borderBottom:'1px solid #E3DAC6', padding: isDesktop ? '10px 24px' : '10px 18px' }}>
      <AnimatePresence mode="wait">
        {isPanorama && (
          <motion.div key="pano"
            initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
            transition={{ duration:0.2 }}>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, letterSpacing:'0.16em',
              textTransform:'uppercase', color:'#8A7E6A', marginBottom:8 }}>Vista del panorama</div>
            <div style={{ display:'flex', gap:6 }}>
              {[['editorial','Editorial'],['mosaico','Mosaico'],['resumen','Resumen']].map(([k,l]) => (
                <Chip key={k} label={l} active={pano===k} onClick={() => onPanoChange(k)} />
              ))}
            </div>
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
                {(dateOptions || [['todas','Todas'],['13','13 jun'],['14','14 jun'],['15','15 jun']]).map(([k,l]) => (
                  <Chip key={k} label={l} active={date===k} onClick={() => onDateChange(k)} />
                ))}
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, letterSpacing:'0.14em',
                textTransform:'uppercase', color:'#8A7E6A', width:54, flex:'none' }}>Red</span>
              <div style={{ display:'flex', gap:5, overflowX:'auto', scrollbarWidth:'none' }}>
                {platOpts.map(([k,l]) => (
                  <Chip key={k} label={l} active={plat===k} onClick={() => onPlatChange(k)} />
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
