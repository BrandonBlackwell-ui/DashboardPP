import { motion } from 'framer-motion';
import { C, fmt, fmtK } from '../utils/helpers';
import PlatformIcon from './PlatformIcon';

const PLATFORM_ORDER = ['facebook', 'instagram', 'tiktok', 'x', 'google_news', 'redes_propias'];
const PLATFORM_LABELS = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok',
  x: 'X', google_news: 'Google News', redes_propias: 'Redes Propias',
};

function pill(ink, bg, bd) {
  return { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:999,
    fontFamily:"'Geist Mono',monospace", fontSize:10, fontWeight:600, letterSpacing:'0.06em',
    textTransform:'uppercase', color:ink, background:bg, border:`1px solid ${bd}` };
}

function buildVoicesFromData(data) {
  if (!data?.themes) return { allies: [], critics: [] };

  const allMap = {}; // key: normalized username

  PLATFORM_ORDER.forEach(themeKey => {
    const theme = data.themes[themeKey];
    if (!theme?.voices) return;
    const add = (v, side) => {
      if (!v?.username) return;
      const key = (v.username || '').toLowerCase().trim().replace(/^@/, '');
      if (!key) return;
      if (!allMap[key]) {
        allMap[key] = {
          username: v.username, platform: v.platform || themeKey,
          networks: [], side,
          likes: 0, comments: 0, engagement: 0, posts: 0,
          tier: v.tier || 'micro',
          keywords: [], text: v.text || '', impact: v.impact || '',
          url: v.url || '',
        };
      }
      const entry = allMap[key];
      if (!entry.networks.includes(themeKey)) entry.networks.push(themeKey);
      entry.likes += v.likes || 0;
      entry.comments += v.comments || 0;
      entry.engagement += v.engagement || 0;
      entry.posts += v.posts || 0;
      if (v.keywords?.length && !entry.keywords.length) entry.keywords = v.keywords;
      if (v.text && !entry.text) entry.text = v.text;
      if (v.impact && !entry.impact) entry.impact = v.impact;
      if (v.tier === 'macro') entry.tier = 'macro';
      else if (v.tier === 'medio' && entry.tier === 'micro') entry.tier = 'medio';
      // If same person appears as ally in one network and critic in another, critic wins
      if (side === 'negative') entry.side = 'negative';
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

function VoiceCard({ v, side }) {
  const isAlly = side !== 'negative';
  const accentColor = isAlly ? C.teal : C.crim;
  const tierInk = v.tier === 'macro' ? C.crim : v.tier === 'medio' ? C.goldDeep : C.teal;
  const tierBg = v.tier === 'macro' ? C.crimBg : v.tier === 'medio' ? C.amberBg : C.tealBg;
  const tierBd = v.tier === 'macro' ? C.crimBd : v.tier === 'medio' ? C.amberBd : C.tealBd;
  const tierLabel = v.tier === 'macro' ? 'Macro' : v.tier === 'medio' ? 'Medio' : 'Micro';
  const Tag = v.url ? 'a' : 'div';

  return (
    <Tag href={v.url || undefined} target={v.url ? '_blank' : undefined} rel="noopener"
      style={{ display:'block', padding:'14px 16px', textDecoration:'none', background:C.card,
        borderRadius:3, border:`1px solid rgba(33,28,23,0.10)`,
        borderLeftWidth:3, borderLeftColor:accentColor, borderLeftStyle:'solid' }}>

      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <PlatformIcon platform={v.platform} size={15} />
        <span style={{ fontWeight:600, fontSize:14, color:C.ink, flex:1, minWidth:0,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.username}</span>
        <span style={{ ...pill(tierInk, tierBg, tierBd) }}>{tierLabel}</span>
      </div>

      {/* Networks badges */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
        {v.networks.map(net => (
          <span key={net} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px',
            borderRadius:2, background:'rgba(33,28,23,0.06)', border:'1px solid rgba(33,28,23,0.10)',
            fontFamily:"'Geist Mono',monospace", fontSize:9.5, color:'#6B6253', textTransform:'uppercase' }}>
            <PlatformIcon platform={net} size={10} />
            {PLATFORM_LABELS[net] || net}
          </span>
        ))}
      </div>

      {/* Metrics */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px', fontFamily:"'Geist Mono',monospace",
        fontSize:10, color:'#8A7E6A', textTransform:'uppercase', marginBottom: v.text ? 8 : 0 }}>
        <span>{v.posts} {v.posts === 1 ? 'publicación' : 'publicaciones'}</span>
        {v.likes > 0 && <span>♥ {fmt(v.likes)}</span>}
        {v.comments > 0 && <span>💬 {fmt(v.comments)}</span>}
        {v.engagement > 0 && <span style={{ color:C.goldDeep, fontWeight:600 }}>Alcance: {fmt(v.engagement)}</span>}
        {v.impact && <span style={{ color:accentColor }}>Impacto: {v.impact}</span>}
      </div>

      {/* Quote */}
      {v.text && (
        <p style={{ fontSize:12, lineHeight:1.45, color:'#5A4E3C', fontStyle:'italic', margin:0, paddingLeft:2 }}>
          "{v.text.length > 130 ? v.text.slice(0, 130) + '…' : v.text}"
        </p>
      )}

      {/* Keywords */}
      {v.keywords?.length > 0 && (
        <div style={{ borderTop:'1px dotted rgba(33,28,23,0.08)', paddingTop:6, marginTop:8,
          display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
          <span style={{ fontSize:9.5, color:'#8A7E6A', fontFamily:"'Geist Mono',monospace", textTransform:'uppercase' }}>Gatillos:</span>
          {v.keywords.map((kw, idx) => (
            <span key={idx} style={{ fontSize:9.5, padding:'2px 5px', borderRadius:2,
              background: isAlly ? 'rgba(40,167,69,0.08)' : 'rgba(220,53,69,0.08)',
              color:accentColor, border:`1px solid ${isAlly ? 'rgba(40,167,69,0.15)' : 'rgba(220,53,69,0.15)'}`,
              fontFamily:"'Geist Mono',monospace" }}>{kw}</span>
          ))}
        </div>
      )}
    </Tag>
  );
}

export default function AliadosView({ data, isDesktop }) {
  const { allies, critics } = buildVoicesFromData(data);

  const stagger = { hidden:{}, visible:{ transition:{ staggerChildren:0.04 } } };
  const item = { hidden:{ opacity:0, y:10 }, visible:{ opacity:1, y:0, transition:{ type:'spring', stiffness:300, damping:24 } } };
  const px = isDesktop ? '24px 28px 6px' : '20px 18px 6px';

  // Network coverage summary
  const coveredNets = PLATFORM_ORDER.filter(k => data?.themes?.[k]?.voices);
  const totalEngagement = [...allies, ...critics].reduce((s, v) => s + v.engagement, 0);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" style={{ paddingBottom:32 }}>

      {/* Header */}
      <motion.div variants={item} style={{ padding: px }}>
        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, letterSpacing:'0.16em',
          textTransform:'uppercase', color:C.gold, fontWeight:600 }}>Vista · Voces</div>
        <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:33, lineHeight:1.02,
          letterSpacing:'-0.025em', color:C.ink, margin:'7px 0 5px' }}>
          Aliados y contrarios<em style={{ fontStyle:'normal', color:C.goldDeep }}>.</em>
        </h1>
        <p style={{ fontSize:14, color:'#6B6253', margin:0 }}>
          Voces compiladas de todas las redes · ordenadas por alcance total
        </p>
      </motion.div>

      {/* Summary chips */}
      <motion.div variants={item} style={{ padding: isDesktop ? '0 28px 16px' : '0 18px 16px',
        display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
        <span style={{ ...pill(C.teal, C.tealBg, C.tealBd) }}>
          {allies.length} Aliados
        </span>
        <span style={{ ...pill(C.crim, C.crimBg, C.crimBd) }}>
          {critics.length} Contrarios
        </span>
        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A',
          textTransform:'uppercase', letterSpacing:'0.06em' }}>
          Alcance total: {fmtK(totalEngagement)}
        </span>
        <div style={{ display:'flex', gap:5, marginLeft:'auto' }}>
          {coveredNets.map(net => (
            <span key={net} title={PLATFORM_LABELS[net]}
              style={{ opacity:0.7, display:'inline-flex', alignItems:'center' }}>
              <PlatformIcon platform={net} size={16} />
            </span>
          ))}
        </div>
      </motion.div>

      {/* Two-column grid */}
      <motion.div variants={item} style={{ padding: isDesktop ? '0 28px' : '0 18px' }}>
        <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap:24 }}>

          {/* Allies column */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ width:10, height:10, borderRadius:'50%', background:C.teal, flex:'none' }} />
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em',
                textTransform:'uppercase', color:C.teal, fontWeight:700 }}>
                Aliados · {allies.length}
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {allies.length > 0
                ? allies.map((v, i) => <VoiceCard key={`ally-${i}`} v={v} side="positive" />)
                : <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A',
                    textTransform:'uppercase', padding:'16px 0' }}>
                    Sin aliados detectados aún.
                  </div>
              }
            </div>
          </div>

          {/* Critics column */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ width:10, height:10, borderRadius:'50%', background:C.crim, flex:'none' }} />
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em',
                textTransform:'uppercase', color:C.crim, fontWeight:700 }}>
                Contrarios · {critics.length}
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {critics.length > 0
                ? critics.map((v, i) => <VoiceCard key={`critic-${i}`} v={v} side="negative" />)
                : <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A',
                    textTransform:'uppercase', padding:'16px 0' }}>
                    Sin contrarios detectados aún.
                  </div>
              }
            </div>
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
}
