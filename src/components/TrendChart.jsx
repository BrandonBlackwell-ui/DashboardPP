import { useState } from 'react';
import { motion } from 'framer-motion';
import { C } from '../utils/helpers';

export const SL_TREND_KEYS = ['facebook','instagram','x','tiktok','google_news'];

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const dayLabel = dk => { const d = new Date(dk+'T12:00:00'); return d.getDate() + ' ' + MESES[d.getMonth()]; };

// Línea de evolución favorable vs crítico sobre los días con data.
// props:
//  days        — window.CALENDAR_DATA.days ({ dateKey: { themeKey: {pos,neg,risk} } })
//  topics      — [{key,label,color}] temas/redes disponibles como chips
//  aggregateKeys — keys que promedia el chip "Todas" (default: SL)
//  showChips   — mostrar filtro por red (default true)
//  title       — encabezado (default "Evolución del sentimiento")
//  onSelectDay / selected — opcionales, para vincular con el calendario
export default function TrendChart({ days, topics, onSelectDay, selected, showChips = true,
  title = 'Evolución del sentimiento', aggregateKeys }) {
  const [topicFilter, setTopicFilter] = useState('all');

  const allDays = Object.keys(days || {}).sort();
  const chipTopics = (topics || []).filter(t => t.key !== 'resumen');
  const aggKeys = aggregateKeys || SL_TREND_KEYS;
  const aggTopics = chipTopics.filter(t => aggKeys.includes(t.key));
  const activeTopics = topicFilter === 'all'
    ? (aggTopics.length ? aggTopics : chipTopics)
    : chipTopics.filter(t => t.key === topicFilter);

  // Solo días con data — la línea conecta puntos reales, sin huecos
  const points = allDays.map(dk => {
    const dd = days[dk] || {};
    const entries = activeTopics.map(t => dd[t.key]).filter(Boolean);
    if (!entries.length) return null;
    const pos = entries.reduce((s,e) => s + (e.pos||0), 0) / entries.length;
    const neg = entries.reduce((s,e) => s + (e.neg||0), 0) / entries.length;
    const worst = entries.some(e => e.risk === 'muy_alto') ? 'muy_alto'
      : entries.some(e => e.risk === 'alto') ? 'alto'
      : entries.some(e => e.risk === 'medio') ? 'medio' : 'bajo';
    return { dk, pos, neg, risk: worst };
  }).filter(Boolean);
  const notEnough = points.length < 2;

  // Escala Y dinámica
  const maxVal = Math.max(...points.map(p => Math.max(p.pos, p.neg)), 10);
  const yMax = Math.min(100, Math.ceil((maxVal + 8) / 10) * 10);

  const W = 640, H = 150, PAD_X = 30, PAD_Y = 18;
  const n = points.length;
  const x = i => PAD_X + (i / Math.max(1, n - 1)) * (W - PAD_X * 2);
  const y = v => H - PAD_Y - (v / yMax) * (H - PAD_Y * 2);
  const linePath = key =>
    points.map((p, i) => (i ? 'L ' : 'M ') + x(i).toFixed(1) + ' ' + y(p[key]).toFixed(1)).join(' ');
  const gridVals = [0, Math.round(yMax/2), yMax];

  return (
    <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:'14px 16px', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:10, flexWrap:'wrap' }}>
        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.14em',
          textTransform:'uppercase', color:C.ink, fontWeight:700 }}>{title}</span>
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
      {showChips && chipTopics.length > 1 && (
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
          {[{ key:'all', label:'Todas', color:C.ink }, ...chipTopics].map(t => (
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
      )}
      {notEnough ? (
        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#A9997B',
          textTransform:'uppercase', letterSpacing:'0.06em', padding:'18px 0' }}>
          Sin datos suficientes para graficar.
        </div>
      ) : (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block' }}>
        {gridVals.map(v => (
          <g key={v}>
            <line x1={PAD_X} x2={W-PAD_X} y1={y(v)} y2={y(v)} stroke="rgba(33,28,23,0.07)" strokeWidth="1" />
            <text x={2} y={y(v)+3} fontSize="8" fill="#A9997B" fontFamily="'Geist Mono',monospace">{v}%</text>
          </g>
        ))}
        <motion.path d={linePath('pos')} fill="none" stroke={C.teal} strokeWidth="2" strokeLinejoin="round"
          initial={{ pathLength:0 }} animate={{ pathLength:1 }} transition={{ duration:0.9 }} />
        <motion.path d={linePath('neg')} fill="none" stroke={C.crim} strokeWidth="2" strokeLinejoin="round"
          initial={{ pathLength:0 }} animate={{ pathLength:1 }} transition={{ duration:0.9, delay:0.15 }} />
        {points.map((p, i) => (
          <g key={p.dk} style={{ cursor: onSelectDay ? 'pointer' : 'default' }}
            onClick={() => onSelectDay?.(p.dk)}>
            <rect x={x(i)-14} y={0} width={28} height={H} fill="transparent" />
            {(p.risk === 'alto' || p.risk === 'muy_alto') && (
              <circle cx={x(i)} cy={y(p.neg)} r="5.5" fill={C.crim} opacity="0.25" />
            )}
            <circle cx={x(i)} cy={y(p.pos)} r={p.dk === selected ? 4.5 : 3} fill={C.teal}
              stroke="#FBF8F1" strokeWidth="1.5" />
            <circle cx={x(i)} cy={y(p.neg)} r={p.dk === selected ? 4.5 : 3} fill={C.crim}
              stroke="#FBF8F1" strokeWidth="1.5" />
            {p.dk === selected && (
              <line x1={x(i)} x2={x(i)} y1={PAD_Y-4} y2={H-PAD_Y+4} stroke="rgba(33,28,23,0.25)" strokeWidth="1" strokeDasharray="3 2" />
            )}
            <text x={x(i)} y={H-3} fontSize="8" fill={p.dk === selected ? '#211C17' : '#A9997B'}
              fontWeight={p.dk === selected ? '700' : '400'}
              textAnchor="middle" fontFamily="'Geist Mono',monospace">{dayLabel(p.dk)}</text>
          </g>
        ))}
      </svg>
      )}
    </div>
  );
}
