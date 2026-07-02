import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Donut from './Donut';
import { C, riskMeta } from '../utils/helpers';

const TOPIC_META = {
  musica:       { label:'Música',        color:'#4E7351' },
  entrevistas:  { label:'Entrevistas',   color:'#B0822F' },
  empresas:     { label:'Empresas',      color:'#9B3331' },
  familia:      { label:'Familia',       color:'#A9997B' },
  redes_propias:{ label:'Redes Propias', color:'#3D3426' },
  facebook:     { label:'Facebook',      color:'#1877F2' },
  instagram:    { label:'Instagram',     color:'#D62976' },
  x:            { label:'X / Twitter',   color:'#111111' },
  tiktok:       { label:'TikTok',        color:'#FE2C55' },
  google_news:  { label:'Google News',   color:'#4285F4' },
  youtube:      { label:'YouTube',       color:'#FF0000' },
};

const DAYS_ES = ['dom','lun','mar','mié','jue','vie','sáb'];
const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function dotColor(d) {
  if (!d) return '#D5CDB8';
  if (d.neg > 30) return C.crim;
  if (d.pos > 50) return C.teal;
  if (d.neg > 15) return C.gold;
  return C.slate;
}

// Sentiment evolution line chart: favorable vs crítico across all days with data
function TrendChart({ days, allDays, topics, onSelectDay, selected }) {
  const [topicFilter, setTopicFilter] = useState('all');
  const activeTopics = topicFilter === 'all' ? topics : topics.filter(t => t.key === topicFilter);

  // Average pos/neg across the selected topics that have data for each day
  const points = allDays.map(dk => {
    const dd = days[dk] || {};
    const entries = activeTopics.map(t => dd[t.key]).filter(Boolean);
    if (!entries.length) return { dk, pos: null, neg: null, risk: null };
    const pos = entries.reduce((s,e) => s + (e.pos||0), 0) / entries.length;
    const neg = entries.reduce((s,e) => s + (e.neg||0), 0) / entries.length;
    const worst = entries.some(e => e.risk === 'muy_alto') ? 'muy_alto'
      : entries.some(e => e.risk === 'alto') ? 'alto'
      : entries.some(e => e.risk === 'medio') ? 'medio' : 'bajo';
    return { dk, pos, neg, risk: worst };
  });
  const withData = points.filter(p => p.pos !== null);
  const notEnough = withData.length < 2;

  const W = 640, H = 130, PAD_X = 8, PAD_Y = 14;
  const n = points.length;
  const x = i => PAD_X + (i / Math.max(1, n - 1)) * (W - PAD_X * 2);
  const y = v => H - PAD_Y - (v / 100) * (H - PAD_Y * 2);

  const linePath = (key) => {
    let d = '', started = false;
    points.forEach((p, i) => {
      if (p[key] === null) { started = false; return; }
      d += (started ? ' L ' : ' M ') + x(i).toFixed(1) + ' ' + y(p[key]).toFixed(1);
      started = true;
    });
    return d;
  };

  return (
    <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:'14px 16px', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:10, flexWrap:'wrap' }}>
        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.14em',
          textTransform:'uppercase', color:C.ink, fontWeight:700 }}>Evolución del sentimiento</span>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:14, height:2, background:C.teal, display:'inline-block' }} />
          <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, color:'#6B6253', textTransform:'uppercase' }}>Favorable</span>
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:14, height:2, background:C.crim, display:'inline-block' }} />
          <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, color:'#6B6253', textTransform:'uppercase' }}>Crítico</span>
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:C.crim, display:'inline-block', opacity:0.85 }} />
          <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, color:'#6B6253', textTransform:'uppercase' }}>Día de riesgo</span>
        </span>
      </div>
      {/* Per-network filter */}
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
        {[{ key:'all', label:'Todas', color:C.ink }, ...topics].map(t => (
          <button key={t.key} onClick={() => setTopicFilter(t.key)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px', borderRadius:999, cursor:'pointer',
              fontFamily:"'Geist Mono',monospace", fontSize:9, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
              border: topicFilter===t.key ? `1px solid ${C.ink}` : '1px solid rgba(33,28,23,0.13)',
              background: topicFilter===t.key ? C.ink : 'transparent',
              color: topicFilter===t.key ? '#FBF8F1' : '#6B6253', transition:'all 0.15s' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:t.color, flex:'none' }} />
            {t.label}
          </button>
        ))}
      </div>
      {notEnough ? (
        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#A9997B',
          textTransform:'uppercase', letterSpacing:'0.06em', padding:'18px 0' }}>
          Sin datos suficientes para graficar esta red.
        </div>
      ) : (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block' }}>
        {/* Gridlines */}
        {[0,25,50,75,100].map(v => (
          <g key={v}>
            <line x1={PAD_X} x2={W-PAD_X} y1={y(v)} y2={y(v)} stroke="rgba(33,28,23,0.07)" strokeWidth="1" />
            <text x={PAD_X} y={y(v)-3} fontSize="8" fill="#A9997B" fontFamily="'Geist Mono',monospace">{v}%</text>
          </g>
        ))}
        {/* Lines */}
        <motion.path d={linePath('pos')} fill="none" stroke={C.teal} strokeWidth="2" strokeLinejoin="round"
          initial={{ pathLength:0 }} animate={{ pathLength:1 }} transition={{ duration:0.9 }} />
        <motion.path d={linePath('neg')} fill="none" stroke={C.crim} strokeWidth="2" strokeLinejoin="round"
          initial={{ pathLength:0 }} animate={{ pathLength:1 }} transition={{ duration:0.9, delay:0.15 }} />
        {/* Day markers (clickable) */}
        {points.map((p, i) => p.pos !== null && (
          <g key={p.dk} style={{ cursor:'pointer' }} onClick={() => onSelectDay(p.dk)}>
            <rect x={x(i)-8} y={0} width={16} height={H} fill="transparent" />
            {(p.risk === 'alto' || p.risk === 'muy_alto') && (
              <circle cx={x(i)} cy={y(p.neg)} r="4.5" fill={C.crim} opacity="0.9" />
            )}
            <circle cx={x(i)} cy={y(p.pos)} r={p.dk === selected ? 4 : 2.5} fill={C.teal} />
            <circle cx={x(i)} cy={y(p.neg)} r={p.dk === selected ? 4 : 2.5} fill={C.crim} />
            {p.dk === selected && (
              <line x1={x(i)} x2={x(i)} y1={PAD_Y-4} y2={H-PAD_Y+4} stroke="rgba(33,28,23,0.25)" strokeWidth="1" strokeDasharray="3 2" />
            )}
          </g>
        ))}
      </svg>
      )}
    </div>
  );
}

function SentBar({ pos, neu, neg }) {
  return (
    <div style={{ display:'flex', height:4, borderRadius:2, overflow:'hidden', background:'#E3DAC6', margin:'6px 0' }}>
      <motion.div initial={{ width:0 }} animate={{ width:(pos||0)+'%' }} transition={{ duration:0.6 }} style={{ background:C.teal }} />
      <motion.div initial={{ width:0 }} animate={{ width:(neu||0)+'%' }} transition={{ duration:0.6, delay:0.1 }} style={{ background:C.slate }} />
      <motion.div initial={{ width:0 }} animate={{ width:(neg||0)+'%' }} transition={{ duration:0.6, delay:0.2 }} style={{ background:C.crim }} />
    </div>
  );
}

export default function CalendarView({ calData, onGoTheme, isDesktop, supabaseKeys }) {
  const CD = calData;
  const days = CD?.days || {};

  // Derive topic list dynamically from whatever keys are actually in the data
  const allTopicKeys = [...new Set(Object.values(days).flatMap(d => Object.keys(d || {})))];
  const TOPICS = allTopicKeys.length
    ? allTopicKeys.map(key => ({ key, ...(TOPIC_META[key] || { label: key, color: '#8A7E6A' }) }))
    : Object.entries(TOPIC_META).slice(0, 4).map(([key, meta]) => ({ key, ...meta }));

  // Build sorted day list from earliest known data to latest (dynamic, not hardcoded)
  const allDays = [];
  const knownDays = Object.keys(days).sort();
  const startKey = knownDays[0] || '2026-06-01';
  const endKey = knownDays[knownDays.length - 1] || '2026-06-15';
  const startDate = new Date(startKey + 'T12:00:00');
  const endDate = new Date(endKey + 'T12:00:00');
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    allDays.push(d.toISOString().slice(0, 10));
  }

  const lastDay = allDays[allDays.length - 1] || '2026-06-15';
  const [selected, setSelected] = useState(lastDay);
  const selData = days[selected] || {};

  const startLabel = startDate.getDate() + ' ' + MONTHS_ES[startDate.getMonth()];
  const endLabel = endDate.getDate() + ' ' + MONTHS_ES[endDate.getMonth()] + ' ' + endDate.getFullYear();
  const totalDays = allDays.length;

  const stagger = { hidden:{}, visible:{ transition:{ staggerChildren:0.04 } } };
  const item = { hidden:{ opacity:0, y:10 }, visible:{ opacity:1, y:0, transition:{ type:'spring', stiffness:300, damping:24 } } };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" style={{ padding: isDesktop ? '24px 28px 6px' : '20px 18px 6px' }}>

      {/* Header */}
      <motion.div variants={item}>
        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, letterSpacing:'0.18em',
          textTransform:'uppercase', color:C.gold, fontWeight:600 }}>Histórico · {startLabel} – {endLabel}</div>
        <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:28, lineHeight:1.05,
          letterSpacing:'-0.025em', color:C.ink, margin:'8px 0 4px' }}>
          {totalDays} días de <em style={{ fontStyle:'normal', color:C.goldDeep }}>conversación</em>.
        </h1>
        <p style={{ fontSize:12, color:'#6B6253', margin:'0 0 16px' }}>Selecciona un día para ver el resumen.</p>
      </motion.div>

      {/* Legend */}
      <motion.div variants={item} style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
        {TOPICS.map(t => (
          <div key={t.key} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:8, height:8, borderRadius:2, background:t.color, flex:'none' }} />
            <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#6B6253',
              letterSpacing:'0.08em', textTransform:'uppercase' }}>{t.label}</span>
          </div>
        ))}
      </motion.div>

      {/* Sentiment trend over the full period */}
      <motion.div variants={item}>
        <TrendChart days={days} allDays={allDays} topics={TOPICS} onSelectDay={setSelected} selected={selected} />
      </motion.div>

      {/* Calendar grid */}
      <motion.div variants={item}
        style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:6, marginBottom:16 }}>
        {allDays.map(dayKey => {
          const date = new Date(dayKey + 'T12:00:00');
          const dayNum = date.getDate();
          const dayName = DAYS_ES[date.getDay()];
          const dayData = days[dayKey] || {};
          const isActive = dayKey === selected;
          const hasAny = TOPICS.some(t => dayData[t.key]);

          return (
            <motion.button key={dayKey}
              whileTap={{ scale:0.93 }}
              whileHover={{ y:-1 }}
              onClick={() => setSelected(dayKey)}
              style={{ padding:'10px 6px 8px', borderRadius:3, cursor:'pointer', textAlign:'center',
                background: isActive ? C.ink : hasAny ? C.card : '#F3EDE0',
                border: isActive ? `1px solid ${C.ink}` : '1px solid rgba(33,28,23,0.13)',
                transition:'all 0.15s' }}>
              <div style={{ fontFamily:"'Geist Mono',monospace", fontWeight:700, fontSize:17,
                color: isActive ? '#FBF8F1' : hasAny ? C.ink : '#C4B89A', lineHeight:1 }}>{dayNum}</div>
              <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.08em',
                textTransform:'uppercase', color: isActive ? 'rgba(255,255,255,0.5)' : '#8A7E6A',
                marginTop:3, marginBottom:6 }}>{dayName}</div>
              <div style={{ display:'flex', justifyContent:'center', gap:3, flexWrap:'wrap' }}>
                {TOPICS.map(t => {
                  const td = dayData[t.key];
                  const dc = td ? dotColor(td) : '#D5CDB8';
                  return <span key={t.key} style={{ width:5, height:5, borderRadius:'50%',
                    background: isActive ? 'rgba(255,255,255,0.5)' : dc,
                    opacity: td ? 1 : 0.3 }} />;
                })}
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Day detail */}
      <AnimatePresence mode="wait">
        <motion.div key={selected}
          initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
          transition={{ duration:0.25 }}>

          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, letterSpacing:'0.16em',
            textTransform:'uppercase', color:C.gold, fontWeight:600, marginBottom:12 }}>
            {(() => { const d=new Date(selected+'T12:00:00'); return d.getDate()+' '+MONTHS_ES[d.getMonth()]+' 2026'; })()}
          </div>

          <div style={{ display:'grid', gridTemplateColumns: isDesktop && TOPICS.length <= 4 ? '1fr 1fr' : '1fr', gap:8 }}>
          {TOPICS.map(t => {
            const td = (days[selected]||{})[t.key];
            const rm = td ? riskMeta(td.risk) : null;

            return (
              <motion.div key={t.key}
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
                transition={{ type:'spring', stiffness:280, damping:24 }}
                style={{ background: td ? C.card : '#F3EDE0', border:'1px solid rgba(33,28,23,0.13)',
                  borderLeft:`3px solid ${td ? t.color : '#D5CDB8'}`, borderRadius:3,
                  padding:13, opacity: td ? 1 : 0.55 }}>

                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {td ? (
                    <Donut pos={td.pos||0} neu={Math.max(0,100-(td.pos||0)-(td.neg||0))} neg={td.neg||0} size={46} />
                  ) : (
                    <div style={{ width:40, height:40, borderRadius:'50%', background:'#E3DAC6', flex:'none' }} />
                  )}
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:14,
                        color: td ? C.ink : '#A9997B' }}>{t.label}</span>
                      {rm && td && <span style={{ display:'inline-flex', alignItems:'center', padding:'1px 6px',
                        borderRadius:999, fontFamily:"'Geist Mono',monospace", fontSize:11, fontWeight:500,
                        letterSpacing:'0.06em', textTransform:'uppercase', color:rm.ink,
                        background:rm.bg, border:`1px solid ${rm.bd}` }}>{rm.label}</span>}
                    </div>
                    {td ? (
                      <SentBar pos={td.pos} neu={Math.max(0,100-td.pos-td.neg)} neg={td.neg} />
                    ) : (
                      <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#A9997B',
                        marginTop:4, letterSpacing:'0.06em' }}>SIN DATOS PARA ESTA FECHA</div>
                    )}
                    {td && (
                      <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#6B6253',
                        letterSpacing:'0.04em' }}>
                        {(Math.round((td.pos||0)*10)/10).toFixed(1)}% fav · {(Math.round((td.neg||0)*10)/10).toFixed(1)}% crítica · {td.posts||0} posts
                      </div>
                    )}
                  </div>
                  {td && (!supabaseKeys || supabaseKeys.has(`${t.key}:${selected}`) || !!td) && (
                    <motion.button whileTap={{ scale:0.9 }}
                      onClick={() => onGoTheme(t.key, selected)}
                      style={{ flex:'none', fontFamily:"'Geist Mono',monospace", fontSize:11, fontWeight:600,
                        color:C.goldDeep, background:'transparent', border:'none', cursor:'pointer',
                        letterSpacing:'0.06em', padding:'4px 6px' }}>
                      VER →
                    </motion.button>
                  )}
                </div>

                {/* Events/headlines */}
                {td && (td.topEvents||[]).length > 0 && (
                  <div style={{ marginTop:9, paddingTop:9, borderTop:'1px dotted rgba(33,28,23,0.10)' }}>
                    {(td.topEvents||[]).slice(0,2).map((ev,i) => (
                      <div key={i} style={{ display:'flex', gap:8, marginBottom:5 }}>
                        <span style={{ flex:'none', width:10, height:1, background:t.color, marginTop:8 }} />
                        <span style={{ fontSize:11, lineHeight:1.4, color:'#2A241C' }}>{ev}</span>
                      </div>
                    ))}
                  </div>
                )}
                {td && (td.headlines||[]).length > 0 && !(td.topEvents||[]).length && (
                  <div style={{ marginTop:9, paddingTop:9, borderTop:'1px dotted rgba(33,28,23,0.10)' }}>
                    {(td.headlines||[]).slice(0,2).map((h,i) => (
                      <div key={i} style={{ display:'flex', gap:8, marginBottom:5 }}>
                        <span style={{ flex:'none', width:10, height:1, background:t.color, marginTop:8 }} />
                        <span style={{ fontSize:11, lineHeight:1.4, color:'#2A241C' }}>{h}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
