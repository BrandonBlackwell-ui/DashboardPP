import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import ParticleBackground from './ParticleBackground';
import { C } from '../utils/helpers';

const SERVER = import.meta.env.VITE_ANALIZAR_SERVER || 'http://localhost:3001';

function AnalizarModal({ onClose, onDone }) {
  const [logs, setLogs] = useState([]);
  const [phase, setPhase] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [serverOk, setServerOk] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetch(`${SERVER}/status`).then(r => r.json()).then(d => setServerOk(d.ok)).catch(() => setServerOk(false));
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const start = () => {
    const today = new Date().toISOString().slice(0, 10);
    const es = new EventSource(`${SERVER}/analizar?date=${today}`);

    es.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === 'phase')       { setPhase(`Fase ${ev.phase}: ${ev.msg}`); setLogs(l => [...l, { ok:true, msg:`▶ ${ev.phase}: ${ev.msg}` }]); }
      else if (ev.type === 'phase_done') setLogs(l => [...l, { ok:true, msg:`✓ ${ev.msg}` }]);
      else if (ev.type === 'saved')  setLogs(l => [...l, { ok:true, msg:`  └ ${ev.net}: ${ev.count} posts` }]);
      else if (ev.type === 'ai_done') setLogs(l => [...l, { ok:true, msg:`  └ IA ${ev.net}: ${JSON.stringify(ev.result?.sentimiento || ev.result?.error)}` }]);
      else if (ev.type === 'error')  setLogs(l => [...l, { ok:false, msg:`✗ ${ev.msg}` }]);
      else if (ev.type === 'done')   { setDone(true); setPhase('¡Análisis completo!'); es.close(); onDone?.(); }
    };
    es.onerror = () => { setError('Conexión perdida con el servidor local.'); es.close(); };
  };

  const phaseColor = { A: C.gold, B: C.teal, C:'#7C5CBF', D: C.goldDeep };
  const currentPhase = phase.match(/Fase ([ABCD])/)?.[1];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(33,28,23,0.82)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.95 }}
        style={{ background:'#1A1612', border:`1px solid ${C.gold}30`, borderRadius:6, width:560, maxWidth:'95vw',
          maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase', color:C.gold, marginBottom:4 }}>
              Blackwell · Analizar
            </div>
            <div style={{ fontFamily:"'Geist',sans-serif", fontSize:16, fontWeight:600, color:'#EFE9DC' }}>
              {done ? '¡Análisis completo!' : phase || 'Análisis diario completo'}
            </div>
          </div>
          {(done || error) && (
            <motion.button whileTap={{ scale:0.95 }} onClick={onClose}
              style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'rgba(255,255,255,0.4)', background:'transparent', border:'1px solid rgba(255,255,255,0.1)', borderRadius:2, padding:'5px 10px', cursor:'pointer' }}>
              Cerrar
            </motion.button>
          )}
        </div>

        {/* Server status / start */}
        {logs.length === 0 && !error && (
          <div style={{ padding:'28px 22px', textAlign:'center' }}>
            {serverOk === null && <div style={{ color:'rgba(255,255,255,0.4)', fontSize:13 }}>Verificando servidor local...</div>}
            {serverOk === false && (
              <div>
                <div style={{ color:'#FF6B6B', fontSize:13, marginBottom:8 }}>
                  No se pudo conectar con el servidor de análisis.
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)', lineHeight:1.6 }}>
                  Verifica que el servicio en Railway esté activo, o revisa la variable <code style={{ background:'rgba(255,255,255,0.08)', padding:'1px 5px', borderRadius:2 }}>VITE_ANALIZAR_SERVER</code> en Vercel.
                </div>
              </div>
            )}
            {serverOk === true && (
              <div>
                <div style={{ color:'#4CAF50', fontSize:13, marginBottom:20 }}>Servidor listo en localhost:3001</div>
                <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:18 }}>
                  {['A','B','C','D'].map((p, i) => (
                    <div key={p} style={{ textAlign:'center' }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:`${phaseColor[p]}20`, border:`1px solid ${phaseColor[p]}60`,
                        display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Geist Mono',monospace", fontSize:12, fontWeight:700, color:phaseColor[p] }}>
                        {p}
                      </div>
                      <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:8, color:'rgba(255,255,255,0.3)', marginTop:4, textTransform:'uppercase' }}>
                        {['Apify','Cmts','IA redes','Opus'][i]}
                      </div>
                    </div>
                  ))}
                </div>
                <motion.button whileHover={{ background: C.gold }} whileTap={{ scale:0.97 }} onClick={start}
                  style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
                    background:C.goldDeep, color:'#1A1612', border:'none', borderRadius:3, padding:'11px 28px', cursor:'pointer', transition:'all 0.15s' }}>
                  Iniciar análisis →
                </motion.button>
              </div>
            )}
          </div>
        )}

        {/* Progress log */}
        {logs.length > 0 && (
          <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'14px 22px', scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.1) transparent' }}>
            {currentPhase && (
              <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase',
                color: phaseColor[currentPhase] || C.gold, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                {!done && <motion.span animate={{ opacity:[1,0.3,1] }} transition={{ repeat:Infinity, duration:1.2 }}>●</motion.span>}
                {done ? '✓ ' : ''}{phase}
              </div>
            )}
            {logs.map((l, i) => (
              <div key={i} style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, lineHeight:1.7,
                color: l.ok ? 'rgba(255,255,255,0.7)' : '#FF6B6B' }}>
                {l.msg}
              </div>
            ))}
            {!done && !error && (
              <motion.div animate={{ opacity:[0.4,1,0.4] }} transition={{ repeat:Infinity, duration:1.5 }}
                style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'rgba(255,255,255,0.25)', marginTop:4 }}>
                procesando...
              </motion.div>
            )}
          </div>
        )}

        {error && (
          <div style={{ padding:'16px 22px', color:'#FF6B6B', fontFamily:"'Geist Mono',monospace", fontSize:11 }}>{error}</div>
        )}
      </motion.div>
    </div>
  );
}

const SIDEBAR_W = 240;

const SOCIAL_KEYS = new Set(['facebook', 'instagram', 'x', 'tiktok', 'google_news']);

export default function DesktopShell({ tab, data, pano, onTabChange, onExport, onRefresh, children }) {
  const [showAnalizar, setShowAnalizar] = useState(false);
  const T = data?.themes || {};
  const order = data?.order || [];
  const rawMode = data?.meta?.source === 'apify_local' || T?.resumen?.rawOnly;

  const hasSocial = order.some(k => SOCIAL_KEYS.has(k));
  const isActiveSocial = SOCIAL_KEYS.has(tab);

  const tabs = [
    { key: 'panorama', label: 'Panorama' },
    ...order
      .filter(k => !SOCIAL_KEYS.has(k))
      .map(k => ({ key: k, label: T[k]?.label || k })),
    ...(hasSocial ? [{ key: 'social_listening', label: 'Social Listening' }] : []),
    ...(!rawMode ? [
      { key: 'historico', label: 'Histórico' },
      { key: 'aliados', label: 'Aliados' },
      { key: 'reporte', label: 'Reporte' },
    ] : []),
  ].filter(t => T[t.key] || t.key === 'panorama' || t.key === 'aliados' || t.key === 'social_listening' || !rawMode);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <AnimatePresence>
        {showAnalizar && (
          <AnalizarModal
            onClose={() => setShowAnalizar(false)}
            onDone={() => { onRefresh?.(); }}
          />
        )}
      </AnimatePresence>
      {/* Sidebar */}
      <div style={{
        width: SIDEBAR_W,
        minWidth: SIDEBAR_W,
        background: '#211C17',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        overflow: 'hidden',
      }}>
        <ParticleBackground />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Wordmark */}
          <div style={{ padding: '22px 20px 18px' }}>
            <motion.span
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{ display: 'inline-block', lineHeight: 1 }}>
              <span style={{
                fontFamily: "'Geist',sans-serif", fontWeight: 900, letterSpacing: '-0.04em',
                color: '#EFE9DC', fontSize: 22, display: 'inline-block', lineHeight: 1,
              }}>Blackwell</span>
              <span style={{ display: 'block', height: 2, width: '100%', background: '#EFE9DC', borderRadius: 1, marginTop: 2 }} />
            </motion.span>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9 }}>
              <motion.span
                animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                style={{ width: 6, height: 6, background: C.gold, borderRadius: '50%', flex: 'none' }} />
              <span style={{
                fontFamily: "'Geist Mono',monospace", fontSize: 9.5, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: C.gold, fontWeight: 600, lineHeight: 1.3,
              }}>
                Brief Diario · Pepe Aguilar
              </span>
            </motion.div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 20px' }} />

          {/* Nav label */}
          <div style={{
            fontFamily: "'Geist Mono',monospace", fontSize: 8.5, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', padding: '14px 20px 8px',
          }}>Navegación</div>

          {/* Tabs */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '0 12px', scrollbarWidth: 'none' }}>
            {tabs.map(t => {
              const isActive = tab === t.key || (t.key === 'social_listening' && isActiveSocial);
              return (
                <motion.button
                  key={t.key}
                  onClick={() => onTabChange(t.key)}
                  whileHover={!isActive ? { background: 'rgba(255,255,255,0.06)' } : {}}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    fontFamily: "'Geist Mono',monospace", fontWeight: 600,
                    fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '10px 12px', borderRadius: 3, cursor: 'pointer',
                    border: 'none', marginBottom: 2,
                    background: isActive ? C.gold : 'transparent',
                    color: isActive ? '#FBF8F1' : 'rgba(239,233,220,0.65)',
                    transition: 'all 0.15s',
                  }}>
                  {t.label}
                </motion.button>
              );
            })}
          </nav>

          {/* Bottom buttons */}
          <div style={{ padding: '16px 12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {sessionStorage.getItem('bw_role') === 'admin' && (
            <motion.button
              whileHover={{ background: C.gold, color: '#1A1612', borderColor: C.gold }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAnalizar(true)}
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                fontFamily: "'Geist Mono',monospace", fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '10px 12px', borderRadius: 2, cursor: 'pointer',
                border: `1px solid ${C.gold}70`, background: `${C.gold}15`,
                color: C.gold, marginBottom: 7, transition: 'all 0.15s',
              }}>
              ⚡ Analizar
            </motion.button>
            )}
            {sessionStorage.getItem('bw_role') === 'admin' && (
            <motion.button
              whileHover={{ background: '#EFE9DC', color: '#211C17' }} whileTap={{ scale: 0.95 }}
              onClick={() => window.dispatchEvent(new Event('bw-open-voice'))}
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                fontFamily: "'Geist Mono',monospace", fontSize: 10, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '9px 12px', borderRadius: 2, cursor: 'pointer',
                border: '1px solid rgba(239,233,220,0.45)', background: 'transparent',
                color: '#EFE9DC', marginBottom: 7, transition: 'all 0.15s',
              }}>
              🎙️ Asistente de voz
            </motion.button>
            )}
            <motion.button
              whileHover={{ background: '#EFE9DC', color: '#211C17' }} whileTap={{ scale: 0.95 }}
              onClick={onExport}
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                fontFamily: "'Geist Mono',monospace", fontSize: 10, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '9px 12px', borderRadius: 2, cursor: 'pointer',
                border: '1px solid rgba(239,233,220,0.45)', background: 'transparent',
                color: '#EFE9DC', marginBottom: 7, transition: 'all 0.15s',
              }}>
              Exportar ↓
            </motion.button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div style={{
        marginLeft: SIDEBAR_W,
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 900,
          minHeight: '100vh',
          background: '#EFE9DC',
          backgroundImage: 'linear-gradient(rgba(33,28,23,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(33,28,23,0.05) 1px,transparent 1px)',
          backgroundSize: '24px 24px',
          position: 'relative',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
