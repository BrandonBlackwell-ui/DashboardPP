import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C, fmt, fmtK } from '../utils/helpers';
import PlatformIcon from './PlatformIcon';
import { supabase } from '../lib/supabase';

// Normaliza para emparejar el nombre del medio (IA) con la fuente scrapeada (google_news)
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
const normSrc = s => (s || '').toLowerCase().normalize('NFD').replace(DIACRITICS, '').replace(/[^a-z0-9 ]/g, '').trim();
function matchesMedia(sourceName, mediaName) {
  const a = normSrc(sourceName), b = normSrc(mediaName);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const wa = a.split(' ').filter(w => w.length > 3);
  const wb = b.split(' ').filter(w => w.length > 3);
  return wb.some(w => wa.includes(w));
}

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
          tier: v.tier || 'micro', keywords: [], text: v.text || '', impact: v.impact || '', url: v.url || '',
          reactions: { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0, care: 0 } };
      }
      const e = allMap[key];
      if (!e.networks.includes(themeKey)) e.networks.push(themeKey);
      e.likes += v.likes || 0;
      e.comments += v.comments || 0;
      e.engagement += v.engagement || 0;
      e.posts += v.posts || 0;
      if (v.reactions && typeof v.reactions === 'object') {
        ['like','love','haha','wow','sad','angry','care'].forEach(r => {
          e.reactions[r] += v.reactions[r] || 0;
        });
      }
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

const FB_REACTIONS = [
  { key: 'haha',  emoji: '😂', label: 'Jaja' },
  { key: 'love',  emoji: '❤️', label: 'Me encanta' },
  { key: 'like',  emoji: '👍', label: 'Me gusta' },
  { key: 'wow',   emoji: '😮', label: 'Asombro' },
  { key: 'sad',   emoji: '😢', label: 'Tristeza' },
  { key: 'angry', emoji: '😡', label: 'Enojo' },
  { key: 'care',  emoji: '🤗', label: 'Cariño' },
];

function formatDate(str) {
  if (!str) return '';
  try {
    const d = new Date(str);
    if (isNaN(d)) return str;
    const ms = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d.getDate()} ${ms[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return str; }
}

// ── Detail panel ─────────────────────────────────────────────────────────────
function VoiceDetail({ v, side, onClose, isDesktop }) {
  const [posts, setPosts] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAlly = side !== 'negative';
  const accent = isAlly ? C.teal : C.crim;

  // Load posts on mount
  useState(() => {
    (async () => {
      try {
        const username = (v.username || '').replace(/^@/, '');
        const { data } = await supabase
          .from('scraped_posts')
          .select('url, text, platform, published_date, likes, comments_count, shares, views, retweets, fb_like, fb_love, fb_haha, fb_wow, fb_sad, fb_angry')
          .ilike('username', username)
          .order('published_date', { ascending: false })
          .limit(500);
        // Deduplicate by URL — same post scraped across multiple reports
        const seen = new Set();
        const unique = (data || []).filter(p => {
          const key = p.url || p.text?.slice(0, 80);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setPosts(unique);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [v.username]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0,
        width: isDesktop ? 420 : '100vw', background: C.card,
        borderLeft: `1px solid rgba(33,28,23,0.13)`,
        boxShadow: '-8px 0 32px rgba(0,0,0,0.18)', zIndex: 200,
        display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(33,28,23,0.10)',
        position: 'sticky', top: 0, background: C.card, zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PlatformIcon platform={v.platform} size={18} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Geist',sans-serif", fontWeight: 700, fontSize: 16,
              color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {v.username}
            </div>
            <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9.5,
              color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
              {isAlly ? 'Aliado' : 'Contrario'} · {v.tier === 'macro' ? 'Macro' : v.tier === 'medio' ? 'Medio' : 'Micro'}
              {v.datesSeen > 1 ? ` · ${v.datesSeen} días activo` : ''}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: "'Geist Mono',monospace", fontSize: 11, color: '#8A7E6A',
              padding: '4px 8px', letterSpacing: '0.06em' }}>
            CERRAR ×
          </button>
        </div>

        {/* Aggregate stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
          {[
            { label: 'Posts únicos', value: posts !== null ? fmt(posts.length) : '…' },
            { label: 'Engagement', value: fmtK(v.engagement || 0) },
            { label: 'Comentarios', value: fmt(v.comments || 0) },
          ].map(m => (
            <div key={m.label} style={{ background: 'rgba(33,28,23,0.04)',
              border: '1px solid rgba(33,28,23,0.08)', borderRadius: 3, padding: '8px 10px' }}>
              <div style={{ fontFamily: "'Geist Mono',monospace", fontWeight: 700,
                fontSize: 17, color: C.ink }}>{m.value}</div>
              <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 8.5,
                color: '#8A7E6A', textTransform: 'uppercase', letterSpacing: '0.07em',
                marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {v.keywords?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: '#8A7E6A',
              textTransform: 'uppercase', letterSpacing: '0.08em', alignSelf: 'center' }}>Gatillos:</span>
            {v.keywords.map((kw, i) => (
              <span key={i} style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9.5,
                padding: '2px 6px', borderRadius: 2, letterSpacing: '0.04em',
                background: isAlly ? 'rgba(40,167,69,0.08)' : 'rgba(220,53,69,0.08)',
                color: accent, border: `1px solid ${accent}30` }}>{kw}</span>
            ))}
          </div>
        )}
      </div>

      {/* Post list */}
      <div style={{ flex: 1, padding: '14px 20px 24px' }}>
        <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: C.goldDeep, fontWeight: 600, marginBottom: 12 }}>
          Publicaciones históricas
        </div>

        {loading && (
          <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10.5,
            color: '#8A7E6A', textTransform: 'uppercase', padding: '20px 0' }}>
            Cargando…
          </div>
        )}

        {!loading && posts?.length === 0 && (
          <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10.5,
            color: '#8A7E6A', textTransform: 'uppercase', padding: '20px 0' }}>
            No se encontraron publicaciones individuales.
          </div>
        )}

        {!loading && posts?.map((p, i) => {
          const eng = (p.likes || 0) + (p.comments_count || 0) * 2 + (p.shares || 0) * 3 + (p.retweets || 0) * 3;
          return (
            <div key={i} style={{ marginBottom: 10, padding: '11px 13px',
              background: 'rgba(33,28,23,0.035)', border: '1px solid rgba(33,28,23,0.08)',
              borderLeft: `3px solid ${accent}`, borderRadius: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <PlatformIcon platform={p.platform} size={11} />
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9.5,
                  color: '#8A7E6A', textTransform: 'uppercase', flex: 1 }}>
                  {formatDate(p.published_date)}
                </span>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener"
                    style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9,
                      color: C.goldDeep, fontWeight: 700, textDecoration: 'none',
                      letterSpacing: '0.06em' }}>
                    ABRIR ↗
                  </a>
                )}
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.45, color: C.ink, margin: '0 0 8px',
                wordBreak: 'break-word',
                display: '-webkit-box', WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {p.text || '[Sin texto]'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px',
                fontFamily: "'Geist Mono',monospace", fontSize: 9.5,
                color: '#8A7E6A', textTransform: 'uppercase' }}>
                {p.platform === 'facebook' && (p.fb_haha||p.fb_love||p.fb_like||p.fb_wow||p.fb_sad||p.fb_angry)
                  ? FB_REACTIONS.map(r => {
                      const n = p[`fb_${r.key}`] || 0;
                      return n > 0 ? <span key={r.key}>{r.emoji} {fmt(n)} {r.label}</span> : null;
                    })
                  : p.likes ? <span>{fmt(p.likes)} {p.platform === 'facebook' ? 'Reacciones' : '♥'}</span> : null}
                {p.comments_count ? <span>{fmt(p.comments_count)} 💬</span> : null}
                {p.shares    ? <span>{fmt(p.shares)} ↗</span> : null}
                {p.retweets  ? <span>{fmt(p.retweets)} RT</span> : null}
                {p.views     ? <span>{fmtK(p.views)} views</span> : null}
                {eng > 0     ? <span style={{ color: accent, fontWeight: 600 }}>Eng: {fmtK(eng)}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Bar row ───────────────────────────────────────────────────────────────────
function BarRow({ v, side, maxEng, index, onSelect }) {
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
      onClick={() => onSelect(v)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 0', cursor: 'pointer' }}>

      {/* Name column */}
      <div style={{ display:'flex', alignItems:'center', gap:5, width: 160, flex:'none' }}>
        <PlatformIcon platform={v.platform} size={12} />
        <div style={{ flex:1, minWidth:0 }}>
          <span style={{ fontFamily:"'Geist',sans-serif", fontSize:12, fontWeight: hovered ? 700 : 500,
            color: hovered ? accent : C.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            display:'block', transition:'all 0.15s' }}>
            {v.username}
          </span>
          {(v.datesSeen > 1 || v.posts > 0) && (
            <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:8, color:'#A9997B',
              letterSpacing:'0.04em', display:'block', lineHeight:1 }}>
              {v.datesSeen > 1 ? `${v.datesSeen} días activo` : `${v.posts} post`}
            </span>
          )}
        </div>
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
              {fmtK(v.engagement)} · click para ver historial
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
    </motion.div>
  );
}

// ── Chart section ─────────────────────────────────────────────────────────────
function ChartSection({ voices, side, label, maxEng, onSelect }) {
  const isAlly = side !== 'negative';
  const accent = isAlly ? C.teal : C.crim;
  const TOP = 10;
  const shown = voices.slice(0, TOP);

  return (
    <div>
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

      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
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
          ? shown.map((v, i) => (
              <BarRow key={v.username} v={v} side={side} maxEng={maxEng} index={i} onSelect={onSelect} />
            ))
          : <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A',
              textTransform:'uppercase', padding:'12px 0' }}>
              Sin datos detectados.
            </div>
        }
        {voices.length > TOP && (
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, color:'#A9997B',
            textTransform:'uppercase', marginTop:6, letterSpacing:'0.06em' }}>
            + {voices.length - TOP} voces adicionales
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fila de medio: barra = nº de notas; segmentos internos = mezcla de tono ─────
function MediaBarRow({ item, side, maxNotas, index, onSelect }) {
  const { medio: m, count, notes } = item;
  const [hovered, setHovered] = useState(false);
  const accent = side === 'favorable' ? C.teal : side === 'critico' ? C.crim : '#8A7E6A';
  const pct = maxNotas > 0 ? Math.max(3, (count / maxNotas) * 100) : 3;
  const tierLabel = m.alcance === 'macro' ? 'Nac' : 'Reg';
  const hasMix = (m.favPct || 0) + (m.neuPct || 0) + (m.critPct || 0) > 0;
  const seg = hasMix
    ? [['#40916C', m.favPct || 0], ['#C4B89A', m.neuPct || 0], ['#C1453F', m.critPct || 0]]
    : [[accent, 100]];
  return (
    <motion.div
      initial={{ opacity: 0, x: side === 'critico' ? 12 : -12 }} animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: index * 0.025 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect({ medio: m, notes })}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: 160, flex: 'none' }}>
        {m.dominio
          ? <img src={`https://www.google.com/s2/favicons?domain=${m.dominio}&sz=64`} alt="" width={13} height={13} style={{ borderRadius: 3, flex: 'none' }} onError={e => { e.target.style.display = 'none'; }} />
          : <PlatformIcon platform="google_news" size={12} />}
        <span style={{ flex: 1, minWidth: 0, fontFamily: "'Geist',sans-serif", fontSize: 12, fontWeight: hovered ? 700 : 500, color: hovered ? accent : C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nombre}</span>
        <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 8.5, color: m.alcance === 'macro' ? C.crim : C.goldDeep, flex: 'none' }}>{tierLabel}</span>
      </div>
      <div style={{ flex: 1, height: 22, background: 'rgba(33,28,23,0.07)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: pct + '%' }}
          transition={{ type: 'spring', stiffness: 180, damping: 28, delay: 0.1 + index * 0.02 }}
          style={{ height: '100%', borderRadius: 2, overflow: 'hidden', display: 'flex', opacity: hovered ? 1 : 0.82, transition: 'opacity 0.15s' }}>
          {seg.map(([col, w], j) => <div key={j} style={{ width: w + '%', height: '100%', background: col }} />)}
        </motion.div>
        {hovered && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: 8, pointerEvents: 'none' }}>
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
              {m.favPct || 0}% fav · {m.neuPct || 0}% neu · {m.critPct || 0}% crít · ver notas
            </span>
          </div>
        )}
      </div>
      <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: hovered ? accent : '#8A7E6A', width: 52, flex: 'none', textAlign: 'right', fontWeight: hovered ? 700 : 400 }}>
        {count} {count === 1 ? 'nota' : 'notas'}
      </span>
    </motion.div>
  );
}

// ── Columna de medios (aliados / contrarios / neutrales) ────────────────────────
function MediaColumn({ items, side, label, sub, maxNotas, onSelect }) {
  const accent = side === 'favorable' ? C.teal : side === 'critico' ? C.crim : '#8A7E6A';
  const TOP = 20;
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, TOP);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${accent}` }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flex: 'none' }} />
        <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent, fontWeight: 700 }}>{label} · {items.length}</span>
        <span style={{ marginLeft: 'auto', fontFamily: "'Geist Mono',monospace", fontSize: 9, color: '#8A7E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sub}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ width: 160, flex: 'none' }} />
        <div style={{ flex: 1, fontFamily: "'Geist Mono',monospace", fontSize: 8.5, color: '#A9997B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Notas · tono (fav/neu/crít)</div>
        <div style={{ width: 52, flex: 'none', fontFamily: "'Geist Mono',monospace", fontSize: 8.5, color: '#A9997B', textAlign: 'right' }}>Total</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {shown.length
          ? shown.map((it, i) => <MediaBarRow key={it.medio.nombre + i} item={it} side={side} maxNotas={maxNotas} index={i} onSelect={onSelect} />)
          : <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: '#8A7E6A', textTransform: 'uppercase', padding: '12px 0' }}>Sin medios en esta categoría.</div>}
        {items.length > TOP && (
          <button onClick={() => setExpanded(v => !v)}
            style={{ font: 'inherit', textAlign: 'left', cursor: 'pointer', background: 'transparent',
              border: 'none', padding: '6px 0 0', fontFamily: "'Geist Mono',monospace", fontSize: 9.5,
              color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            {expanded ? '− ver menos' : `+ ${items.length - TOP} medios más`}
          </button>
        )}
      </div>
    </div>
  );
}

// Clasifica el tono de UNA nota. Usa el sentiment real de la nota si existe (lo llena la
// IA); si no, estima por palabras clave del titular (aproximado, dominio Pepe/familia).
const NOTE_NEG = ['pelea','golpes','burla','burl','exhibe','roba','robar','escándalo','escandalo','crític','critic','polémic','polemic','demanda','ataca','ataque','arremete','calvicie','bullying','se rapa','cancel','hunde','humilla','acusa','plagio','deuda','drama','tunde','funa','destroza',"can't",'cant stop','vs ','contra ','pleito','indirecta','desubicad','inmadur'];
const NOTE_POS = ['reconocid','nominad','homenaje','éxito','exito','orgullo','respald','leyenda','celebra','triunfo','aplauso','gala','premi','honra','emotiv','emociona','gran ','maravill','brilla','arrasa','conquista','aplaude','elogi'];
function classifyNote(note) {
  const s = (note.sentiment || '').toLowerCase();
  if (['favorable', 'positive', 'positivo'].includes(s)) return 'pos';
  if (['critico', 'crítico', 'negative', 'negativo'].includes(s)) return 'neg';
  if (s === 'neutral') return 'neu';
  const t = (note.text || '').toLowerCase();
  const neg = NOTE_NEG.some(k => t.includes(k));
  const pos = NOTE_POS.some(k => t.includes(k));
  return neg && !pos ? 'neg' : pos && !neg ? 'pos' : 'neu';
}

// ── Panel de detalle de un medio: sus notas acumuladas, agrupadas por tono ──────
function MediaDetail({ medio, notes, onClose, isDesktop }) {
  const accent = medio.tono === 'favorable' ? C.teal : medio.tono === 'critico' ? C.crim : C.goldDeep;
  const grupos = [
    { key: 'pos', label: 'Positivas', color: C.teal },
    { key: 'neu', label: 'Neutrales', color: '#8A7E6A' },
    { key: 'neg', label: 'Negativas', color: C.crim },
  ].map(g => ({ ...g, items: notes.filter(n => classifyNote(n) === g.key) })).filter(g => g.items.length);
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: isDesktop ? 420 : '100vw',
        background: C.card, borderLeft: '1px solid rgba(33,28,23,0.13)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.18)', zIndex: 200,
        display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(33,28,23,0.10)',
        position: 'sticky', top: 0, background: C.card, zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {medio.dominio ? (
            <img src={`https://www.google.com/s2/favicons?domain=${medio.dominio}&sz=64`} alt=""
              width={20} height={20} style={{ borderRadius: 4, flex: 'none' }}
              onError={e => { e.target.style.display = 'none'; }} />
          ) : <PlatformIcon platform="google_news" size={18} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Geist',sans-serif", fontWeight: 700, fontSize: 16, color: C.ink,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{medio.nombre}</div>
            <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9.5, color: accent,
              textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
              {medio.alcance === 'macro' ? 'Nacional' : 'Regional'} · {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: "'Geist Mono',monospace", fontSize: 11, color: '#8A7E6A', padding: '4px 8px' }}>CERRAR ×</button>
        </div>
      </div>
      <div style={{ flex: 1, padding: '14px 20px 24px' }}>
        {notes.length === 0 && (
          <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10.5, color: '#8A7E6A',
            textTransform: 'uppercase', padding: '20px 0' }}>Sin notas individuales guardadas.</div>
        )}
        {grupos.map(g => (
          <div key={g.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10,
              paddingBottom: 6, borderBottom: `2px solid ${g.color}` }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: g.color, flex: 'none' }} />
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: g.color, fontWeight: 700 }}>{g.label} · {g.items.length}</span>
            </div>
            {g.items.map((p, i) => (
              <div key={i} style={{ marginBottom: 10, padding: '11px 13px', background: 'rgba(33,28,23,0.035)',
                border: '1px solid rgba(33,28,23,0.08)', borderLeft: `3px solid ${g.color}`, borderRadius: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9.5, color: '#8A7E6A',
                    textTransform: 'uppercase', flex: 1 }}>{formatDate(p.published_date)}</span>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener" style={{ fontFamily: "'Geist Mono',monospace",
                      fontSize: 9, color: C.goldDeep, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.06em' }}>ABRIR ↗</a>
                  )}
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.45, color: C.ink, margin: 0, wordBreak: 'break-word' }}>
                  {p.text || '[Sin título]'}
                </p>
              </div>
            ))}
          </div>
        ))}
        {notes.length > 0 && (
          <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 8.5, color: '#A9997B',
            letterSpacing: '0.04em', marginTop: 4 }}>
            Clasificación automática por titular; se afina con el análisis de IA.
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AliadosView({ data, isDesktop }) {
  const voices = window.ALL_VOICES_DATA || buildVoicesFromData(data);
  const { allies, critics } = voices;
  const isHistorical = !!window.ALL_VOICES_DATA;

  const [selectedVoice, setSelectedVoice] = useState(null);
  const [selectedSide, setSelectedSide] = useState('positive');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [newsPosts, setNewsPosts] = useState(null);

  // Trae todas las notas de google_news una vez, deduplicadas por URL
  useEffect(() => {
    (async () => {
      try {
        const { data: rows } = await supabase
          .from('scraped_posts')
          .select('url, text, published_date, username, sentiment')
          .eq('platform', 'google_news')
          .order('published_date', { ascending: false })
          .limit(1000);
        const seen = new Set();
        const uniq = (rows || []).filter(p => {
          const k = p.url || p.text?.slice(0, 80);
          if (!k || seen.has(k)) return false;
          seen.add(k); return true;
        });
        setNewsPosts(uniq);
      } catch { setNewsPosts([]); }
    })();
  }, []);

  const notesFor = (m) => (newsPosts || []).filter(p => matchesMedia(p.username, m.nombre));

  // Solo mostramos medios con al menos una nota real respaldada en la base.
  // Mientras cargan las notas (newsPosts === null) se muestran todos provisionalmente.
  const allMedia = window.ALL_MEDIA_DATA || [];
  const visibleMedia = newsPosts === null ? allMedia : allMedia.filter(m => notesFor(m).length > 0);

  const totalEngagement = [...allies, ...critics].reduce((s, v) => s + v.engagement, 0);
  const totalPosts = [...allies, ...critics].reduce((s, v) => s + (v.posts || 0), 0);
  const maxEng = Math.max(...[...allies, ...critics].map(v => v.engagement), 1);

  const handleSelect = (v, side) => { setSelectedVoice(v); setSelectedSide(side); };

  const stagger = { hidden:{}, visible:{ transition:{ staggerChildren:0.05 } } };
  const item = { hidden:{ opacity:0, y:10 }, visible:{ opacity:1, y:0, transition:{ type:'spring', stiffness:300, damping:24 } } };
  const px = isDesktop ? '24px 28px 6px' : '20px 18px 6px';

  return (
    <>
      <motion.div variants={stagger} initial="hidden" animate="visible" style={{ paddingBottom:40 }}>

        {/* Header */}
        <motion.div variants={item} style={{ padding: px }}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, letterSpacing:'0.16em',
            textTransform:'uppercase', color:C.gold, fontWeight:600 }}>
            Vista · Voces{isHistorical ? ' · Histórico' : ''}
          </div>
          <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:33, lineHeight:1.02,
            letterSpacing:'-0.025em', color:C.ink, margin:'7px 0 5px' }}>
            Aliados y contrarios<em style={{ fontStyle:'normal', color:C.goldDeep }}>.</em>
          </h1>
          <p style={{ fontSize:13, color:'#6B6253', margin:0 }}>
            {isHistorical
              ? 'Top 10 por alcance · acumulado histórico · click en un nombre para ver sus publicaciones'
              : 'Top 10 por alcance · click en un nombre para ver sus publicaciones'}
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
          {totalPosts > 0 && (
            <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A',
              textTransform:'uppercase', letterSpacing:'0.06em' }}>
              · {fmt(totalPosts)} posts históricos
            </span>
          )}
        </motion.div>

        {/* Charts */}
        <motion.div variants={item} style={{ padding: isDesktop ? '0 28px' : '0 18px' }}>
          <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap:32 }}>
            <ChartSection voices={allies} side="positive" label="Aliados" maxEng={maxEng}
              onSelect={v => handleSelect(v, 'positive')} />
            <ChartSection voices={critics} side="negative" label="Contrarios" maxEng={maxEng}
              onSelect={v => handleSelect(v, 'negative')} />
          </div>
        </motion.div>

        {/* Medios de comunicación */}
        {visibleMedia.length > 0 && (
          <motion.div variants={item} style={{ padding: isDesktop ? '28px 28px 0' : '24px 18px 0' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, paddingBottom:8,
              borderBottom:`2px solid ${C.goldDeep}` }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:C.goldDeep, flex:'none' }} />
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.14em',
                textTransform:'uppercase', color:C.goldDeep, fontWeight:700 }}>
                Medios de comunicación · {visibleMedia.length}
              </span>
              <span style={{ marginLeft:'auto', fontFamily:"'Geist Mono',monospace", fontSize:9,
                color:'#8A7E6A', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Cobertura acumulada
              </span>
            </div>
            {(() => {
              // Conteo real de notas por medio (dedup); si aún cargan, usa el de la IA.
              const withCount = visibleMedia.map(m => {
                const notes = notesFor(m);
                const count = newsPosts === null ? (m.notas || 0) : notes.length;
                return { medio: m, notes, count };
              });
              // Clasificación viene de loadFromSupabase (regla: mayoría + piso 40%).
              const allies  = withCount.filter(x => x.medio.tono === 'favorable').sort((a, b) => b.count - a.count);
              const critics = withCount.filter(x => x.medio.tono === 'critico').sort((a, b) => b.count - a.count);
              const neutral = withCount.filter(x => !x.medio.tono || x.medio.tono === 'neutral').sort((a, b) => b.count - a.count);
              const maxNotas = Math.max(1, ...withCount.map(x => x.count));
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: isDesktop ? 24 : 18, marginBottom: 22 }}>
                    <MediaColumn items={allies}  side="favorable" label="Aliados"    sub="Cobertura favorable" maxNotas={maxNotas} onSelect={setSelectedMedia} />
                    <MediaColumn items={critics} side="critico"   label="Contrarios" sub="Cobertura crítica"   maxNotas={maxNotas} onSelect={setSelectedMedia} />
                  </div>
                  {neutral.length > 0 && (
                    <MediaColumn items={neutral} side="neutral" label="Neutrales" sub="Cobertura informativa" maxNotas={maxNotas} onSelect={setSelectedMedia} />
                  )}
                </>
              );
            })()}
          </motion.div>
        )}

      </motion.div>

      {/* Detail panel overlay */}
      <AnimatePresence>
        {selectedVoice && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedVoice(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(33,28,23,0.35)', zIndex: 199 }} />
            <VoiceDetail
              v={selectedVoice} side={selectedSide}
              onClose={() => setSelectedVoice(null)}
              isDesktop={isDesktop} />
          </>
        )}
      </AnimatePresence>

      {/* Detail panel de medios */}
      <AnimatePresence>
        {selectedMedia && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedMedia(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(33,28,23,0.35)', zIndex: 199 }} />
            <MediaDetail
              medio={selectedMedia.medio} notes={selectedMedia.notes}
              onClose={() => setSelectedMedia(null)}
              isDesktop={isDesktop} />
          </>
        )}
      </AnimatePresence>
    </>
  );
}
