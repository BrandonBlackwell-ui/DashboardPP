import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseDailyCSV } from '../utils/csvParser';
import { C } from '../utils/helpers';

const STORAGE_KEY = 'bw_pa_extra_data';

function loadExtra() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveExtra(extra) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(extra));
}

// Merge a new themeData into existing PA_DATA and CALENDAR_DATA in memory
export function mergeNewData(dateKey, themeKey, themeData) {
  // 1. Update PA_DATA themes (replace if same key, or keep if newer)
  if (window.PA_DATA?.themes) {
    window.PA_DATA.themes[themeKey] = themeData;
    // Update range label if new date is later
    const newDate = new Date(dateKey);
    const curEnd = new Date(window.PA_DATA.meta?.period?.end || '2026-06-15');
    if (newDate > curEnd) {
      window.PA_DATA.meta.period.end = dateKey;
      const start = window.PA_DATA.meta.period.start;
      window.PA_DATA.meta.range_label = formatRange(start, dateKey);
    }
  }

  // 2. Update CALENDAR_DATA
  if (window.CALENDAR_DATA) {
    if (!window.CALENDAR_DATA.days[dateKey]) window.CALENDAR_DATA.days[dateKey] = {};
    const s = themeData.sentiment || {};
    window.CALENDAR_DATA.days[dateKey][themeKey] = {
      pos: s.pos || 0, neg: s.neg || 0,
      risk: themeData.risk?.level || 'bajo',
      posts: themeData.totals?.posts || 0,
      topEvents: (themeData.timeline?.events || []).slice(0,3).map(e => e.main).filter(Boolean),
      headlines: [],
      alerts: themeData.alerts?.total || 0,
      opps: themeData.opps?.total || 0,
    };
    // Extend range
    if (dateKey > (window.CALENDAR_DATA.dateRange?.end || '')) {
      window.CALENDAR_DATA.dateRange.end = dateKey;
    }
    if (dateKey < (window.CALENDAR_DATA.dateRange?.start || '9999')) {
      window.CALENDAR_DATA.dateRange.start = dateKey;
    }
  }

  // 3. Persist to localStorage
  const extra = loadExtra();
  if (!extra[dateKey]) extra[dateKey] = {};
  extra[dateKey][themeKey] = { themeData, addedAt: new Date().toISOString() };
  saveExtra(extra);
}

// Apply any previously saved data on startup
export function applyStoredExtra() {
  const extra = loadExtra();
  for (const [dateKey, themes] of Object.entries(extra)) {
    for (const [themeKey, { themeData }] of Object.entries(themes)) {
      mergeNewData(dateKey, themeKey, themeData);
    }
  }
}

function formatRange(start, end) {
  const s = new Date(start+'T12:00:00'), e = new Date(end+'T12:00:00');
  const ms = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  if (s.getMonth() === e.getMonth()) return `${s.getDate()} – ${e.getDate()} ${ms[e.getMonth()]} ${e.getFullYear()}`;
  return `${s.getDate()} ${ms[s.getMonth()]} – ${e.getDate()} ${ms[e.getMonth()]} ${e.getFullYear()}`;
}

function StatusIcon({ state }) {
  if (state === 'ok') return <span style={{ fontSize:22 }}>✓</span>;
  if (state === 'err') return <span style={{ fontSize:22 }}>✕</span>;
  return (
    <motion.div animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:0.9, ease:'linear' }}
      style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${C.gold}`,
        borderTopColor:'transparent' }} />
  );
}

export default function UploadModal({ onClose, onDataUpdated }) {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState({});
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function handleFiles(flist) {
    const csvFiles = Array.from(flist).filter(f => f.name.endsWith('.csv'));
    if (!csvFiles.length) return;
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...csvFiles.filter(f => !existing.has(f.name))];
    });
  }

  async function processAll() {
    const newResults = {};
    for (const file of files) {
      newResults[file.name] = 'loading';
      setResults({ ...newResults });
      try {
        const text = await file.text();
        const { dateKey, themeKey, themeData } = parseDailyCSV(text, file.name);
        mergeNewData(dateKey, themeKey, themeData);
        newResults[file.name] = { state:'ok', dateKey, themeKey, label: themeData.label };
      } catch (e) {
        newResults[file.name] = { state:'err', msg: e.message };
      }
      setResults({ ...newResults });
    }
    const hasOk = Object.values(newResults).some(r => r?.state === 'ok');
    if (hasOk) onDataUpdated();
  }

  const allDone = files.length > 0 && files.every(f => results[f.name] && results[f.name] !== 'loading');

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:'fixed', inset:0, background:'rgba(33,28,23,0.72)', zIndex:100,
        display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>

      <motion.div initial={{ scale:0.9, y:20 }} animate={{ scale:1, y:0 }} exit={{ scale:0.9, y:20 }}
        style={{ width:'100%', maxWidth:420, background:C.paper,
          backgroundImage:'linear-gradient(rgba(33,28,23,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(33,28,23,0.04) 1px,transparent 1px)',
          backgroundSize:'24px 24px',
          border:`2px solid ${C.ink}`, borderRadius:4, overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'16px 18px 12px', borderBottom:`1px solid rgba(33,28,23,0.15)`,
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, letterSpacing:'0.16em',
              textTransform:'uppercase', color:C.gold, fontWeight:600, marginBottom:4 }}>
              Actualización de datos
            </div>
            <div style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:18, color:C.ink }}>
              Subir reporte diario
            </div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer',
            fontFamily:"'Geist Mono',monospace", fontSize:14, color:'#8A7E6A' }}>✕</button>
        </div>

        <div style={{ padding:18 }}>
          {/* Drop zone */}
          <motion.div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            animate={{ borderColor: dragging ? C.gold : 'rgba(33,28,23,0.20)', background: dragging ? 'rgba(176,130,47,0.06)' : C.card }}
            style={{ border:'2px dashed', borderRadius:3, padding:'28px 18px', textAlign:'center',
              cursor:'pointer', marginBottom:14, transition:'all 0.15s' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>📂</div>
            <div style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:14, color:C.ink, marginBottom:4 }}>
              Arrastra los CSV aquí
            </div>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, color:'#8A7E6A',
              letterSpacing:'0.06em', textTransform:'uppercase' }}>
              O toca para seleccionar · Puedes cargar varios a la vez
            </div>
            <input ref={inputRef} type="file" accept=".csv" multiple
              style={{ display:'none' }} onChange={e => handleFiles(e.target.files)} />
          </motion.div>

          {/* File list */}
          {files.length > 0 && (
            <div style={{ marginBottom:14 }}>
              {files.map(f => {
                const r = results[f.name];
                return (
                  <motion.div key={f.name} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                      background:C.card, border:`1px solid ${r?.state==='ok'?C.teal:r?.state==='err'?C.crim:'rgba(33,28,23,0.13)'}`,
                      borderRadius:3, marginBottom:6 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:C.ink,
                        fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {f.name}
                      </div>
                      {r?.state==='ok' && (
                        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, color:C.teal, marginTop:2 }}>
                          {r.label} · {r.dateKey} ✓
                        </div>
                      )}
                      {r?.state==='err' && (
                        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, color:C.crim, marginTop:2 }}>
                          {r.msg}
                        </div>
                      )}
                    </div>
                    {r === 'loading' && <StatusIcon state="loading" />}
                    {r?.state === 'ok' && <span style={{ color:C.teal, fontSize:18 }}>✓</span>}
                    {r?.state === 'err' && <span style={{ color:C.crim, fontSize:18 }}>✕</span>}
                    {!r && (
                      <button onClick={() => setFiles(fs => fs.filter(x => x.name !== f.name))}
                        style={{ background:'transparent', border:'none', cursor:'pointer', color:'#8A7E6A', fontSize:12 }}>✕</button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Info note */}
          <div style={{ background:'rgba(176,130,47,0.08)', border:'1px solid rgba(176,130,47,0.25)',
            borderRadius:3, padding:'10px 12px', marginBottom:14 }}>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, color:C.gold,
              fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>
              Cómo funciona
            </div>
            <div style={{ fontSize:11.5, lineHeight:1.5, color:'#6B6253' }}>
              El sistema detecta automáticamente el <strong>tema</strong> (Música, Entrevistas, Empresas, Familia)
              y la <strong>fecha</strong> desde el nombre del archivo. Los datos se guardan en el navegador
              y persisten entre sesiones — no necesitas subir el mismo archivo dos veces.
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:8 }}>
            <motion.button whileTap={{ scale:0.95 }} onClick={onClose}
              style={{ flex:1, padding:'10px 0', borderRadius:2, border:`1px solid rgba(33,28,23,0.20)`,
                background:'transparent', fontFamily:"'Geist Mono',monospace", fontSize:10.5,
                fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#6B6253', cursor:'pointer' }}>
              Cancelar
            </motion.button>
            <motion.button whileTap={{ scale:0.95 }} whileHover={{ background: allDone ? C.teal : C.ink }}
              onClick={allDone ? onClose : processAll}
              disabled={files.length === 0}
              style={{ flex:2, padding:'10px 0', borderRadius:2, border:'none',
                background: allDone ? C.teal : files.length === 0 ? '#D5CDB8' : C.ink,
                fontFamily:"'Geist Mono',monospace", fontSize:10.5, fontWeight:600,
                letterSpacing:'0.08em', textTransform:'uppercase',
                color: files.length === 0 ? '#A9997B' : '#FBF8F1',
                cursor: files.length === 0 ? 'default' : 'pointer', transition:'all 0.2s' }}>
              {allDone ? 'Listo — cerrar' : files.length === 0 ? 'Selecciona archivos' : `Procesar ${files.length} archivo${files.length>1?'s':''}`}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
