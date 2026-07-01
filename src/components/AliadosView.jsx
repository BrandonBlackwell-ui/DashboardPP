import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C, fmt, fmtK } from '../utils/helpers';
import PlatformIcon from './PlatformIcon';

const PLATFORM_ORDER = ['facebook', 'instagram', 'tiktok', 'x', 'google_news', 'redes_propias'];
const PLATFORM_LABELS = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok',
  x: 'X', google_news: 'Google News', redes_propias: 'Redes Propias',
};

function buildVoicesFromData(data) {
  if (!data?.themes) return { allies: [], critics: [] };
  const allMap = {};

  PLATFORM_ORDER.forEach(themeKey => {
    const theme = data.themes[themeKey];
    if (!theme?.voices) return;
    const add = (v, side) => {
      if (!v?.username) return;
      const key = (v.username || '').toLowerCase().trim().replace(/^@/, '');
      if (!key) return;
      if (!allMap[key]) {
        allMap[key] = { username: v.username, platform: v.platform || themeKey,
          networks: [], side, likes: 0, comments: 0, engagement: 0, posts: 0,
          tier: v.tier || 'micro', keywords: [], text: v.text || '', impact: v.impact || '', url: v.url || '' };
      }
      const e = allMap[key];
      if (!e.networks.includes(themeKey)) e.networks.push(themeKey);
      e.likes += v.likes || 0;
      e.comments += v.comments || 0;
      e.engagement += v.engagement || 0;
      e.posts += v.posts || 0;
      if (v.keywords?.length && !e.keywords.length) e.keywords = v.keywords;
      if (v.text && !e.text) e.text = v.text;
      if (v.impact && !e.impact) e.impact = v.impact;
      if (v.tier === 'macro') e.tier = 'macro';
      else if (v.tier === 'medio' && e.tier === 'micro') e.tier = 'medio';
      if (side === 'negative') e.side = 'negative';
    };
    (theme.voices.allies || []).forEach(v => add(v, 'positive'));
    (theme.voices.critics || []).forEach(v => add(v, 'negative'));
  });

  const all = Object.values(allMap).sort((a, b) => b.engagement - a.engagement);
  return {
    allies: all.filter(v => v.side !== 'negative'),
    critics: all.filter(v => v.side === 'negative'),
  };
}

function Tooltip({ v, side }) {
  const isAlly = side !== 'negative';
  const accent = isAlly ? C.teal : C.crim;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 2, scale: 0.97 }}
      transition={{ duration: 0.13 }}
      style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
        background: '#211C17', borderRadius: 4, padding: '10px 14px', zIndex: 99,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)', minWidth: 200, pointerEvents: 'none',
        border: `1px solid ${accent}40` }}>
      {/* Arrow */}
      <div style={{ position:'absolute', bottom:-5, left:'50%', transform:'translateX(-50%)',
        width:8, height:8, background:'#211C17', borderRight:`1px solid ${accent}40`,
        borderBottom:`1px solid ${accent}40`, rotate:'45deg' }} />

      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <PlatformIcon platform={v.platform} size={13} />
        <span style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:13,
          color:'#EFE9DC', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:160 }}>
          {v.username}
        </span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
        {[
          { label:'Posts', value: v.posts || 0, icon:'📄' },
          { label:'Likes', value: fmt(v.likes || 0), icon:'♥' },
          { label:'Comentarios', value: fmt(v.comments || 0), icon:'💬' },
        ].map(m => (
          <div key={m.label} style={{ textAlign:'center' }}>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:15, color:'#EFE9DC', fontWeight:700 }}>{m.value}</div>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, color:'rgba(255,255,255,0.45)',
              textTransform:'uppercase', letterSpacing:'0.08em', marginTop:1 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {v.networks.length > 1 && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.1)', marginTop:8, paddingTop:6,
          display:'flex', gap:5, flexWrap:'wrap' }}>
          {v.networks.map(net => (
            <span key={net} style={{ display:'inline-flex', alignItems:'center', gap:3,
              fontFamily:"'Geist Mono',monospace", fontSize:8.5, color:'rgba(255,255,255,0.5)',
              textTransform:'uppercase', letterSpacing:'0.06em' }}>
              <PlatformIcon platform={net} size={9} />{PLATFORM_LABELS[net] || net}
            </span>
          ))}
        </div>
      )}

      {v.impact && (
        <div style={{ marginTop:6, fontFamily:"'Geist Mono',monospace", fontSize:9, letterSpacing:'0.08em',
          textTransform:'uppercase', color: accent }}>
          Impacto: {v.impact}
        </div>
      )}
    </motion.div>
  );
}

function BarRow({ v, side, maxEng, index }) {
  const [hovered, setHovered] = useState(false);
  const isAlly = side !== 'negative';
  const accent = isAlly ? C.teal : C.crim;
  const barColor = isAlly
    ? 'linear-gradient(90deg, #2D6A4F 0%, #40916C 100%)'
    : 'linear-gradient(90deg, #9B3331 0%, #C1453F 100%)';
  const pct = maxEng > 0 ? Math.max(2, (v.engagement / maxEng) * 100) : 2;
  const tierLabel = v.tier === 'macro' ? 'Macro' : v.tier === 'medio' ? 'Med' : 'Mic';
  const tierColor = v.tier === 'macro' ? C.crim : v.tier === 'medio' ? C.goldDeep : '#8A7E6A';

  return (
    <motion.div
      initial={{ opacity: 0, x: isAlly ? -12 : 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: index * 0.025 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 0', cursor: 'default' }}>

      {/* Name column */}
      <div style={{ display:'flex', alignItems:'center', gap:5, width: 150, flex:'none' }}>
        <PlatformIcon platform={v.platform} size={12} />
        <span style={{ fontFamily:"'Geist',sans-serif", fontSize:12, fontWeight: hovered ? 700 : 500,
          color: hovered ? accent : C.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          flex:1, transition:'all 0.15s' }}>
          {v.username}
        </span>
        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:8.5, color: tierColor,
          flex:'none', letterSpacing:'0.04em' }}>{tierLabel}</span>
      </div>

      {/* Bar */}
      <div style={{ flex: 1, height: 22, background: 'rgba(33,28,23,0.07)', borderRadius: 2,
        overflow: 'hidden', position: 'relative' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: pct + '%' }}
          transition={{ type: 'spring', stiffness: 180, damping: 28, delay: 0.1 + index * 0.02 }}
          style={{ height: '100%', backgroundImage: barColor, borderRadius: 2,
            opacity: hovered ? 1 : 0.75, transition: 'opacity 0.15s',
            boxShadow: hovered ? `0 0 8px ${accent}50` : 'none' }}
        />
        {hovered && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
            paddingLeft:8, gap:8, pointerEvents:'none' }}>
            <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, color:'#fff',
              fontWeight:600, textShadow:'0 1px 3px rgba(0,0,0,0.6)', letterSpacing:'0.04em' }}>
              {fmtK(v.engagement)}
            </span>
          </div>
        )}
      </div>

      {/* Value label */}
      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color: hovered ? accent : '#8A7E6A',
        width: 44, flex:'none', textAlign:'right', fontWeight: hovered ? 700 : 400,
        transition:'all 0.15s', letterSpacing:'0.04em' }}>
        {fmtK(v.engagement)}
      </span>

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && <Tooltip v={v} side={side} />}
      </AnimatePresence>
    </motion.div>
  );
}

function ChartSection({ voices, side, label, maxEng }) {
  const isAlly = side !== 'negative';
  const accent = isAlly ? C.teal : C.crim;
  const TOP = 20;
  const shown = voices.slice(0, TOP);

  return (
    <div>
      {/* Section header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, paddingBottom:8,
        borderBottom:`2px solid ${accent}` }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:accent, flex:'none' }} />
        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.14em',
          textTransform:'uppercase', color:accent, fontWeight:700 }}>
          {label} · {voices.length}
        </span>
        <span style={{ marginLeft:'auto', fontFamily:"'Geist Mono',monospace", fontSize:9,
          color:'#8A7E6A', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          Alcance →
        </span>
      </div>

      {/* Column labels */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, paddingBottom:4 }}>
        <div style={{ width:150, flex:'none' }} />
        <div style={{ flex:1, fontFamily:"'Geist Mono',monospace", fontSize:8.5, color:'#A9997B',
          letterSpacing:'0.08em', textTransform:'uppercase' }}>
          Alcance (engagement)
        </div>
        <div style={{ width:44, flex:'none', fontFamily:"'Geist Mono',monospace", fontSize:8.5,
          color:'#A9997B', textAlign:'right', letterSpacing:'0.04em' }}>Total</div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {shown.length > 0
          ? shown.map((v, i) => <BarRow key={v.username} v={v} side={side} maxEng={maxEng} index={i} />)
          : <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A',
              textTransform:'uppercase', padding:'12px 0' }}>
              Sin datos detectados.
            </div>
        }
        {voices.length > TOP && (
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, color:'#A9997B',
            textTransform:'uppercase', marginTop:6, letterSpacing:'0.06em' }}>
            + {voices.length - TOP} voces adicionales no mostradas
          </div>
        )}
      </div>
    </div>
  );
}

export default function AliadosView({ data, isDesktop }) {
  const { allies, critics } = buildVoicesFromData(data);

  const coveredNets = PLATFORM_ORDER.filter(k => data?.themes?.[k]?.voices);
  const totalEngagement = [...allies, ...critics].reduce((s, v) => s + v.engagement, 0);
  const maxEng = Math.max(...[...allies, ...critics].map(v => v.engagement), 1);

  const stagger = { hidden:{}, visible:{ transition:{ staggerChildren:0.05 } } };
  const item = { hidden:{ opacity:0, y:10 }, visible:{ opacity:1, y:0, transition:{ type:'spring', stiffness:300, damping:24 } } };
  const px = isDesktop ? '24px 28px 6px' : '20px 18px 6px';

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" style={{ paddingBottom:40 }}>

      {/* Header */}
      <motion.div variants={item} style={{ padding: px }}>
        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, letterSpacing:'0.16em',
          textTransform:'uppercase', color:C.gold, fontWeight:600 }}>Vista · Voces</div>
        <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:33, lineHeight:1.02,
          letterSpacing:'-0.025em', color:C.ink, margin:'7px 0 5px' }}>
          Aliados y contrarios<em style={{ fontStyle:'normal', color:C.goldDeep }}>.</em>
        </h1>
        <p style={{ fontSize:13, color:'#6B6253', margin:0 }}>
          Barras ordenadas por alcance · pasa el cursor para ver likes, comentarios y publicaciones
        </p>
      </motion.div>

      {/* Summary chips */}
      <motion.div variants={item} style={{ padding: isDesktop ? '8px 28px 20px' : '8px 18px 20px',
        display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
        <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:999,
          fontFamily:"'Geist Mono',monospace", fontSize:10, fontWeight:600, letterSpacing:'0.06em',
          textTransform:'uppercase', color:C.teal, background:C.tealBg, border:`1px solid ${C.tealBd}` }}>
          {allies.length} Aliados
        </span>
        <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:999,
          fontFamily:"'Geist Mono',monospace", fontSize:10, fontWeight:600, letterSpacing:'0.06em',
          textTransform:'uppercase', color:C.crim, background:C.crimBg, border:`1px solid ${C.crimBd}` }}>
          {critics.length} Contrarios
        </span>
        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A',
          textTransform:'uppercase', letterSpacing:'0.06em' }}>
          Alcance total: {fmtK(totalEngagement)}
        </span>
        <div style={{ display:'flex', gap:5, marginLeft:'auto' }}>
          {coveredNets.map(net => (
            <span key={net} title={PLATFORM_LABELS[net]}
              style={{ opacity:0.6, display:'inline-flex', alignItems:'center' }}>
              <PlatformIcon platform={net} size={15} />
            </span>
          ))}
        </div>
      </motion.div>

      {/* Charts */}
      <motion.div variants={item} style={{ padding: isDesktop ? '0 28px' : '0 18px' }}>
        <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap:32 }}>
          <ChartSection voices={allies} side="positive" label="Aliados" maxEng={maxEng} />
          <ChartSection voices={critics} side="negative" label="Contrarios" maxEng={maxEng} />
        </div>
      </motion.div>

    </motion.div>
  );
}
