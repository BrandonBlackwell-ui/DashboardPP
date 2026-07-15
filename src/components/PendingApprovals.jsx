import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { C, platLabel } from '../utils/helpers';

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const fmtDate = dk => { const d = new Date(dk + 'T12:00:00'); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; };
const themeLabel = t => ({ resumen: 'Panorama', redes_propias: 'Redes Propias' })[t] || platLabel(t);

// Panel para el admin: reportes con approved=false (el cliente pp2026 no los ve
// hasta que se aprueben). Clic en APROBAR publica TODO el día para el cliente.
export default function PendingApprovals({ onDone }) {
  const [pending, setPending] = useState(null); // null = cargando
  const [busy, setBusy] = useState('');         // date_key en proceso
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('id, date_key, theme_key, created_at')
          .eq('approved', false)
          .order('date_key', { ascending: false });
        if (error) throw error;
        // Agrupar por fecha
        const byDate = {};
        (data || []).forEach(r => { (byDate[r.date_key] ||= []).push(r.theme_key); });
        setPending(Object.entries(byDate).map(([date_key, themes]) => ({ date_key, themes })));
      } catch { setPending([]); }
    })();
  }, []);

  const approve = async (dateKey) => {
    setBusy(dateKey);
    try {
      const { error } = await supabase.from('reports')
        .update({ approved: true }).eq('date_key', dateKey).eq('approved', false);
      if (error) throw error;
      setPending(p => p.filter(x => x.date_key !== dateKey));
    } catch (e) {
      alert('No se pudo aprobar: ' + (e?.message || e));
    } finally { setBusy(''); }
  };

  const close = () => { setDismissed(true); onDone?.(); };

  // Nada que mostrar: cargando, sin pendientes, o cerrado
  if (dismissed || pending === null || pending.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position:'fixed', inset:0, background:'rgba(33,28,23,0.55)', zIndex:250,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
          fontFamily:"'Geist', system-ui, sans-serif" }}>
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type:'spring', stiffness: 320, damping: 28 }}
          style={{ background:'#EFE9DC', border:'1.5px solid #211C17', borderRadius:4,
            width:'100%', maxWidth:520, maxHeight:'82vh', overflowY:'auto',
            boxShadow:'6px 6px 0 rgba(33,28,23,0.25)' }}>

          {/* Header */}
          <div style={{ padding:'18px 22px 14px', borderBottom:'2px solid #211C17',
            position:'sticky', top:0, background:'#EFE9DC', zIndex:2 }}>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, letterSpacing:'0.16em',
              textTransform:'uppercase', color:C.gold, fontWeight:600 }}>
              Panel de administración
            </div>
            <div style={{ fontFamily:"'Geist',sans-serif", fontWeight:700, fontSize:19, color:C.ink, marginTop:4 }}>
              Reportes por aprobar · {pending.length} {pending.length === 1 ? 'día' : 'días'}
            </div>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, color:'#8A7E6A',
              marginTop:5, lineHeight:1.5 }}>
              El cliente (pp2026) no ve estos días hasta que los apruebes.
            </div>
          </div>

          {/* Lista por fecha */}
          <div style={{ padding:'14px 22px 6px' }}>
            {pending.map(({ date_key, themes }) => (
              <div key={date_key} style={{ display:'flex', alignItems:'center', gap:12,
                padding:'13px 14px', marginBottom:10, background:'#FAF7F0',
                border:'1px solid rgba(33,28,23,0.16)', borderLeft:`3px solid ${C.gold}`, borderRadius:3 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Geist',sans-serif", fontWeight:700, fontSize:14.5, color:C.ink }}>
                    {fmtDate(date_key)}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                    {themes.map((t, i) => (
                      <span key={i} style={{ fontFamily:"'Geist Mono',monospace", fontSize:8.5,
                        padding:'2px 7px', borderRadius:999, textTransform:'uppercase',
                        letterSpacing:'0.05em', color:'#6B6253',
                        background:'rgba(176,130,47,0.08)', border:'1px solid rgba(176,130,47,0.22)' }}>
                        {themeLabel(t)}
                      </span>
                    ))}
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => approve(date_key)}
                  disabled={busy === date_key}
                  style={{ flex:'none', fontFamily:"'Geist Mono',monospace", fontSize:10.5, fontWeight:700,
                    letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer',
                    color:'#FBF8F1', background: busy === date_key ? '#8A7E6A' : C.ink,
                    border:'none', borderRadius:3, padding:'9px 14px' }}>
                  {busy === date_key ? '…' : '✓ Aprobar'}
                </motion.button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding:'10px 22px 18px', display:'flex', justifyContent:'flex-end' }}>
            <button onClick={close}
              style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, fontWeight:600,
                letterSpacing:'0.06em', textTransform:'uppercase', color:'#6B6253',
                background:'transparent', border:'1px solid rgba(33,28,23,0.25)',
                borderRadius:3, padding:'8px 14px', cursor:'pointer' }}>
              Ver después
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
