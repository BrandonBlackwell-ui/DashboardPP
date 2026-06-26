import { motion } from 'framer-motion';
import Donut from './Donut';
import TiltCard from './TiltCard';
import { C, fmt, fmtK, platLabel, cap, riskMeta, sentMeta, sevMeta, pill } from '../utils/helpers';

const stagger = { hidden:{}, visible:{ transition:{ staggerChildren:0.06 } } };
const item = { hidden:{ opacity:0, y:14 }, visible:{ opacity:1, y:0, transition:{ type:'spring', stiffness:260, damping:22 } } };

function Section({ title, right, children, px }) {
  return (
    <motion.div variants={item} style={{ padding: px || '14px 18px 6px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }}>
        <h2 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:22,
          letterSpacing:'-0.015em', color:C.ink, margin:0 }}>{title}</h2>
        {right}
      </div>
      {children}
    </motion.div>
  );
}

function Card({ accentColor, children }) {
  return (
    <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)',
      borderLeft: accentColor ? `3px solid ${accentColor}` : undefined,
      borderRadius:3, padding:18, marginBottom:9 }}>
      {children}
    </div>
  );
}

function Pill({ rm }) {
  return <span style={{ ...pill(rm.ink, rm.bg, rm.bd) }}>{rm.label}</span>;
}

function PlatformIcon({ platform, size = 18 }) {
  const p = (platform || '').toLowerCase();
  const box = { width:size, height:size, flex:'none', display:'inline-flex', alignItems:'center', justifyContent:'center' };
  if (p === 'facebook') {
    return (
      <span style={box} aria-label="Facebook">
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="#1877F2" />
          <path fill="#fff" d="M14.86 12.66h-1.9V20h-3.05v-7.34H8.36v-2.6h1.55V8.38c0-1.2.57-3.08 3.08-3.08l2.26.01v2.52h-1.64c-.27 0-.65.13-.65.71v1.52h2.33l-.43 2.6Z" />
        </svg>
      </span>
    );
  }
  if (p === 'instagram') {
    return (
      <span style={box} aria-label="Instagram">
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <defs>
            <linearGradient id="igGradient" x1="4" x2="20" y1="20" y2="4" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FEDA75" />
              <stop offset="0.35" stopColor="#FA7E1E" />
              <stop offset="0.62" stopColor="#D62976" />
              <stop offset="1" stopColor="#4F5BD5" />
            </linearGradient>
          </defs>
          <rect width="22" height="22" x="1" y="1" rx="6" fill="url(#igGradient)" />
          <rect x="6.1" y="6.1" width="11.8" height="11.8" rx="3.6" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="16.25" cy="7.75" r="1.05" fill="#fff" />
        </svg>
      </span>
    );
  }
  if (p === 'tiktok') {
    return (
      <span style={box} aria-label="TikTok">
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <rect width="22" height="22" x="1" y="1" rx="5" fill="#050505" />
          <path fill="#25F4EE" d="M10.73 17.1a2.04 2.04 0 0 1-1.1.32 2.12 2.12 0 1 1 1.47-3.65V10.5a5.14 5.14 0 1 0 3.05 4.7V8.78a6.25 6.25 0 0 0 3.52 1.08V6.82a3.22 3.22 0 0 1-3.52-3.02h-3.42v13.3Z" opacity=".9" />
          <path fill="#FE2C55" d="M11.55 17.1a2.04 2.04 0 0 1-1.1.32 2.12 2.12 0 0 1-1.68-3.4 2.12 2.12 0 0 0 3.14 1.85V9.68a6.19 6.19 0 0 0 3.52 1.08V7.71a3.22 3.22 0 0 1-3.52-3.02h-.36v12.4Z" />
          <path fill="#fff" d="M11.1 17.1a2.04 2.04 0 0 1-1.1.32 2.12 2.12 0 1 1 1.47-3.65v-3.26a5.14 5.14 0 1 0 3.05 4.7V8.78a6.25 6.25 0 0 0 3.52 1.08V6.82a3.22 3.22 0 0 1-3.52-3.02H11.1v13.3Z" />
        </svg>
      </span>
    );
  }
  if (p === 'twitter' || p === 'x') {
    return (
      <span style={box} aria-label="X">
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <rect width="22" height="22" x="1" y="1" rx="5" fill="#000" />
          <path fill="#fff" d="M14.58 11.1 20.1 5h-1.31l-4.8 5.3L10.16 5H5.75l5.8 8.01L5.75 19h1.31l5.07-5.2 4.05 5.2h4.41l-6.01-7.9Zm-1.8 1.9-.59-.8-4.67-6.18h2.01l3.77 5 .59.79 4.9 6.49h-2.01l-4-5.3Z" />
        </svg>
      </span>
    );
  }
  if (p === 'google_news') {
    return (
      <span style={box} aria-label="Google News">
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <rect x="4.2" y="3.2" width="13.5" height="15.8" rx="1.8" fill="#4285F4" transform="rotate(-7 10.95 11.1)" />
          <rect x="6.2" y="5.2" width="13.5" height="15.8" rx="1.8" fill="#34A853" transform="rotate(5 12.95 13.1)" />
          <rect x="5" y="6.5" width="14" height="13.5" rx="1.7" fill="#fff" />
          <rect x="7" y="8.5" width="3.5" height="3.5" fill="#EA4335" />
          <rect x="11.5" y="8.5" width="5.5" height="1.1" fill="#4285F4" />
          <rect x="11.5" y="11" width="5.5" height="1.1" fill="#4285F4" />
          <rect x="7" y="14" width="10" height="1.1" fill="#FBBC04" />
          <rect x="7" y="16.3" width="8" height="1.1" fill="#34A853" />
        </svg>
      </span>
    );
  }
  return <span style={{ ...box, width:size, height:size, background:C.ink }} aria-hidden="true" />;
}

function SentBar({ pos, neu, neg }) {
  return (
    <div style={{ display:'flex', height:5, borderRadius:2, overflow:'hidden', background:'#E3DAC6', margin:'8px 0' }}>
      <motion.div initial={{ width:0 }} animate={{ width:pos+'%' }} transition={{ duration:0.8, ease:'easeOut' }}
        style={{ background:C.teal }} />
      <motion.div initial={{ width:0 }} animate={{ width:neu+'%' }} transition={{ duration:0.8, ease:'easeOut', delay:0.1 }}
        style={{ background:C.slate }} />
      <motion.div initial={{ width:0 }} animate={{ width:neg+'%' }} transition={{ duration:0.8, ease:'easeOut', delay:0.2 }}
        style={{ background:C.crim }} />
    </div>
  );
}

export default function ThemeView({ tab, date, plat, data, isDesktop, noData, calendarSummary }) {
  const T = data.themes;
  const t = T[tab];
  if (!t) return null;

  if (noData) {
    const dayInt = parseInt(date, 10);
    return (
      <div style={{ padding:'40px 24px', textAlign:'center' }}>
        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, letterSpacing:'0.18em',
          textTransform:'uppercase', color:'#B0822F', fontWeight:600, marginBottom:12 }}>
          {dayInt} jun 2026
        </div>
        <div style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:22,
          color:'#211C17', marginBottom:8 }}>Sin datos para esta fecha.</div>
        <p style={{ fontSize:13, color:'#6B6253' }}>
          No se subió un reporte de <strong>{t.label}</strong> para el {dayInt} de junio.
        </p>
      </div>
    );
  }

  const s = t.sentiment || { pos:0, neu:0, neg:0 };
  const rm = riskMeta(t.risk?.level);

  const targetDays = [date];
  if (date !== 'todas') {
    const dateObj = new Date(`2026-06-${date}T12:00:00`);
    if (dateObj.getDay() === 5) { // 5 is Friday
      const d1 = parseInt(date, 10);
      targetDays.push(String(d1 + 1).padStart(2, '0'));
      targetDays.push(String(d1 + 2).padStart(2, '0'));
    }
  }

  const platMatch = pl => plat==='todas' || pl===plat;
  const dateMatchTs = ts => { if(date==='todas') return true; const m=/\d{4}-\d{2}-(\d{2})/.exec(ts||''); return m && targetDays.includes(m[1]); };
  const dateMatchSlash = f => { if(date==='todas') return true; const m=/^(\d{2})\//.exec(f||''); return m && targetDays.includes(m[1]); };

  const mapPost = p => ({
    url:p.url, text:p.text, razon:p.razon,
    platformLabel:platLabel(p.platform), dateLabel:(p.time||'').slice(5,10).split('-').reverse().join('/'),
    tipoLabel:cap(p.tipo||'Alerta'), impacto:p.impacto||'', score:p.score!=null?p.score:'',
    engagementLabel:fmtK(p.engagement)
  });

  // Alerts
  const al = t.alertometro||t.alerts||{};
  const alPosts = (al.posts||[]).filter(p=>platMatch(p.platform)&&dateMatchTs(p.time)).map(mapPost);

  // Opps
  const op = t.oportunometro||t.opps||{};
  const opPosts = (op.posts||[]).filter(p=>platMatch(p.platform)&&dateMatchTs(p.time)).map(mapPost);

  // Pros/cons
  const pc = t.pros_cons||t.proscons||{};

  // Complaints
  const cm = t.complaints||{};
  const cats = (cm.categories||[]).map(cat => ({
    titulo:cat.titulo, porcentaje:cat.porcentaje,
    items:(cat.items||[]).map(it => {
      const src=(it.sources&&it.sources[0])||null;
      return { texto:it.texto, url:src?.url, hasLink:!!src, sourceLabel:src?'Fuente · '+platLabel(src.platform):'' };
    })
  }));

  // News
  const ratingMeta = {
    positivo:{label:'Favorable',ink:C.teal,bg:C.tealBg,bd:C.tealBd,c:C.teal},
    neutral:{label:'Neutral',ink:'#8A7E6A',bg:C.slateBg,bd:C.slateBd,c:C.slate},
    negativo:{label:'Crítica',ink:C.crim,bg:C.crimBg,bd:C.crimBd,c:C.crim}
  };
  const newsGroups = [];
  if (t.news) {
    ['negativo','neutral','positivo'].forEach(r => {
      (t.news.grupos?.[r]||t.news[r]||[]).forEach(gp => {
        const not=(gp.noticias||[]).filter(n=>dateMatchSlash(n.fecha));
        if (date!=='todas'&&not.length===0) return;
        const rmeta=ratingMeta[r];
        newsGroups.push({ ...gp, ratingLabel:rmeta.label, ink:rmeta.ink, bg:rmeta.bg, border:rmeta.bd, color:rmeta.c,
          noticias:not.map(n=>({titulo:n.titulo,fuente:n.fuente,fecha:n.fecha,link:n.link})) });
      });
    });
  }

  // Trending
  const trending = (t.trending||[]).filter(x=>x.titulo).map((x,i) => ({
    rank:String(i+1).padStart(2,'0'), titulo:x.titulo, desc:x.desc,
    viewsLabel:fmtK(x.metricas?.views), likesLabel:fmtK(x.metricas?.likes),
    posPct:Math.round(x.sent?.positivo_porcentaje||0), negPct:Math.round(x.sent?.negativo_porcentaje||0)
  }));

  // Voices
  const v = t.voices||{};
  const vsegs = (v.segmentos||[]).filter(x=>x.narrativa).map(x => { const m=sentMeta(x.sentimiento);
    return { label:x.label, narrativa:x.narrativa, sentimiento:cap(x.sentimiento), ink:m.ink, bg:m.bg, bd:m.bd }; });
  const valertas = (v.alertas||[]).map(x => { const m=sevMeta(x.severidad);
    return { ...x, severidad:cap(x.severidad), color:m.c, ink:m.ink, bg:m.bg, bd:m.bd }; });

  // Influencers
  const inf = t.influencers||{};
  const itop = (inf.top||[]).filter(p=>platMatch(p.platform)).map(p => { const m=sentMeta(p.sentiment);
    return { rank:String(p.rank).padStart(2,'0'), username:p.username, platformLabel:platLabel(p.platform),
      categoria:p.categoria||'', pic:p.pic, url:p.url, followersFmt:fmtK(p.followers), sentColor:m.c }; });

  // Gap
  const gap = t.narrative_gap||t.gap;

  // Recon
  const rc = (t.reconocimientos||t.recon||[]).filter(x=>x.titulo);

  // Timeline
  const tl = t.timeline||{};
  const events = (tl.events||[]).filter(e=>date==='todas'||targetDays.some(d => (e.date||'').endsWith('-'+d))).map(e => {
    const m=sentMeta(e.sentiment);
    const dd=(e.date||'').slice(8,10), mm=(e.date||'').slice(5,7);
    return { dateLabel:dd+'/'+mm, main:e.main, sentiment:cap(e.sentiment), engagement:cap(e.engagement),
      postsLabel:(e.posts||0)+' posts', dotColor:m.c, ink:m.ink, bg:m.bg, bd:m.bd };
  });

  // Platforms
  const pls = (t.platforms||[]).filter(p=>platMatch(p.name)).map(p => {
    const sd=p.sentiment||p.sent||{positivo:0,neutral:0,negativo:0};
    const rawP=sd.positivo||0, rawN=sd.neutral||0, rawNeg=sd.negativo||0;
    const tot=rawP+rawN+rawNeg||1;
    const pp=Math.round(rawP/tot*100), pn=Math.round(rawNeg/tot*100), pu=Math.max(0,100-pp-pn);
    return { nameLabel:platLabel(p.name), postsLabel:fmt(p.posts), commentsLabel:fmt(p.comments), pp, pu, pn };
  });

  const networkStrategy = t.networkStrategy || {};
  const strategyNetworks = (networkStrategy.networks||[]).filter(n=>platMatch(n.key)).map(n => {
    const toneMeta = n.tone === 'favorable' ? sentMeta('positivo') : n.tone === 'critica' ? sentMeta('negativo') : sentMeta('neutral');
    return {
      ...n,
      toneLabel: n.tone === 'favorable' ? 'Favorable' : n.tone === 'critica' ? 'Critica' : 'Neutral',
      toneMeta,
      postsLabel:fmt(n.posts),
      viewsLabel:fmtK(n.views),
      commentsLabel:fmt(n.comments),
      topTerms:(n.topTerms||[]).slice(0,4),
      themes:(n.themes||[]).slice(0,3),
    };
  });
  const strategyAllies = (networkStrategy.allies||[])
    .filter(a=>platMatch(a.platform))
    .map(a => ({
      ...a,
      tierLabel:a.tier === 'macro' ? 'Macro' : a.tier === 'medio' ? 'Medio' : 'Micro',
      followersLabel:fmtK(a.followers),
      viewsLabel:fmtK(a.views),
      platformLabel:a.platformLabel || platLabel(a.platform),
    }));

  // Comments topics
  const ct = t.comments_topics||t.commentsTopics||{};
  const ctTopics = (ct.topics||[]).filter(x=>x.titulo).map(x => ({
    titulo:x.titulo, porcentaje:x.porcentaje, items:(x.items||[]).slice(0,4) }));

  const emojis = (t.emojis||[]).slice(0,12).map(e => ({ emoji:e.emoji, count:fmt(e.count) }));
  const kws = t.keywords||[];
  const maxN=kws.length?kws[0].n:1, minN=kws.length?kws[kws.length-1].n:1;
  const keywords = kws.slice(0,32).map(k => {
    const r=(k.n-minN)/((maxN-minN)||1);
    return { w:k.w, sizePx:Math.round(12+r*14)+'px', color:r>0.66?C.ink:r>0.33?C.gold:'#8A7E6A' };
  });

  const px = isDesktop ? '24px 28px' : '19px 18px';
  const sectionPx = isDesktop ? '14px 28px 6px' : '14px 18px 6px';

  return (
    <motion.div key={tab} variants={stagger} initial="hidden" animate="visible">

      {/* Calendar summary banner */}
      {calendarSummary && (
        <motion.div variants={item} style={{ margin: isDesktop ? '16px 28px 0' : '14px 18px 0',
          background:'rgba(176,130,47,0.10)', border:'1px solid rgba(176,130,47,0.35)',
          borderRadius:3, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:14, flex:'none' }}>📅</span>
          <div>
            <div style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:12, color:'#7A5A1A' }}>
              Reporte consolidado de fin de semana
            </div>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:'#8A7E6A', marginTop:2 }}>
              Datos parciales del histórico · sin desglose completo disponible
            </div>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <motion.div variants={item} style={{ padding: isDesktop ? '24px 28px 4px' : '19px 18px 4px' }}>
        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, letterSpacing:'0.16em',
          textTransform:'uppercase', color:C.gold, fontWeight:600 }}>Tema · {t.label}</div>
        <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:33, lineHeight:1.02,
          letterSpacing:'-0.025em', color:C.ink, margin:'7px 0 5px' }}>
          {t.label}<em style={{ fontStyle:'normal', color:C.goldDeep }}>.</em>
        </h1>
        <p style={{ fontSize:14, color:'#6B6253', margin:0 }}>{t.es}</p>
      </motion.div>

      {/* Desktop 2-column: Sentiment + Alertómetro | Oportunidades + Pros/contras */}
      {isDesktop ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, padding:'0 28px' }}>
          {/* Left col */}
          <div style={{ paddingRight:14 }}>
            {/* Sentiment */}
            <motion.div variants={item} style={{ paddingTop:16, paddingBottom:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:16, background:C.card,
                border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:18 }}>
                <Donut pos={s.pos} neu={s.neu} neg={s.neg} size={112} showLabel />
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.14em',
                    textTransform:'uppercase', color:'#6B6253', marginBottom:10 }}>Sentimiento general</div>
                  {[{color:C.teal,label:'Favorable',pct:Math.round(s.pos)+'%'},{color:C.slate,label:'Neutral',pct:Math.round(s.neu)+'%'},{color:C.crim,label:'Crítica',pct:Math.round(s.neg)+'%'}].map(l => (
                    <div key={l.label} style={{ display:'flex', alignItems:'center', gap:9, marginBottom:8 }}>
                      <span style={{ width:8,height:8,borderRadius:'50%',flex:'none',background:l.color }} />
                      <span style={{ fontSize:12, color:'#2A241C', flex:1 }}>{l.label}</span>
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:14, color:C.ink }}>{l.pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
            {/* Alertómetro */}
            <motion.div variants={item} style={{ paddingTop:14, paddingBottom:6 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }}>
                <h2 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:22,
                  letterSpacing:'-0.015em', color:C.ink, margin:0 }}>Alertómetro &amp; riesgo</h2>
                <Pill rm={rm} />
              </div>
              <Card accentColor={rm.c}>
                <div style={{ display:'flex', gap:0 }}>
                  <div style={{ flex:1, borderRight:'1px solid rgba(33,28,23,0.10)', paddingRight:12 }}>
                    <div style={{ fontSize:26, fontWeight:600, color:C.ink, lineHeight:1 }}>{Math.round(t.risk?.negPct||s.neg||0)}<span style={{ fontSize:15 }}>%</span></div>
                    <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase', color:'#6B6253', marginTop:6 }}>Conversación crítica</div>
                  </div>
                  <div style={{ flex:1, paddingLeft:14 }}>
                    <div style={{ fontSize:26, fontWeight:600, color:C.ink, lineHeight:1 }}>{al.total||0}</div>
                    <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase', color:'#6B6253', marginTop:6 }}>Posts con alerta / {al.analizados||0}</div>
                  </div>
                </div>
                <div style={{ fontSize:14, lineHeight:1.5, color:'#2A241C', marginTop:13, paddingTop:13, borderTop:'1px solid rgba(33,28,23,0.10)' }}>
                  {al.recomendacion||'No se encontraron posts negativos'}
                </div>
              </Card>
              {alPosts.map((p,i) => (
                <TiltCard key={i} style={{ display:'block', textDecoration:'none', background:C.card,
                  border:'1px solid rgba(33,28,23,0.13)', borderLeft:`3px solid ${C.crim}`,
                  borderRadius:3, padding:16, marginBottom:8 }}>
                  <a href={p.url} target="_blank" rel="noopener" style={{ textDecoration:'none', display:'block' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                      <span style={{ ...pill(C.crim,'rgba(155,51,49,0.12)','rgba(155,51,49,0.38)') }}>{p.tipoLabel}</span>
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#8A7E6A', marginLeft:'auto', textTransform:'uppercase' }}>{p.platformLabel} · {p.dateLabel}</span>
                    </div>
                    <div style={{ fontSize:14, lineHeight:1.45, color:'#2A241C' }}>{p.text}</div>
                    <div style={{ fontSize:13, lineHeight:1.4, color:'#6B6253', marginTop:7 }}>{p.razon}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:9, paddingTop:8, borderTop:'1px dotted rgba(33,28,23,0.10)' }}>
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.crim }}>PELIGROSIDAD {p.score}</span>
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#8A7E6A' }}>{p.engagementLabel} INTERACC.</span>
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600, marginLeft:'auto' }}>ABRIR ↗</span>
                    </div>
                  </a>
                </TiltCard>
              ))}
            </motion.div>
          </div>
          {/* Right col */}
          <div style={{ paddingLeft:14 }}>
            {/* Oportunidades */}
            {(op.recomendacion||opPosts.length>0) && (
              <motion.div variants={item} style={{ paddingTop:16, paddingBottom:6 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }}>
                  <h2 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:22,
                    letterSpacing:'-0.015em', color:C.ink, margin:0 }}>Oportunidades</h2>
                  <span style={{ ...pill(C.teal,C.tealBg,C.tealBd) }}>Nivel {cap(op.nivel||'—')}</span>
                </div>
                {op.recomendacion && <Card accentColor={C.teal}>
                  <div style={{ fontSize:14, lineHeight:1.5, color:'#2A241C' }}>{op.recomendacion}</div>
                </Card>}
                {opPosts.map((p,i) => (
                  <TiltCard key={i} style={{ marginBottom:8, borderRadius:3 }}>
                    <a href={p.url} target="_blank" rel="noopener" style={{ display:'block', textDecoration:'none',
                      background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderLeft:`3px solid ${C.teal}`,
                      borderRadius:3, padding:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                        <span style={{ ...pill(C.teal,C.tealBg,C.tealBd) }}>Impacto {p.impacto}</span>
                        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#8A7E6A', marginLeft:'auto', textTransform:'uppercase' }}>{p.platformLabel} · {p.dateLabel}</span>
                      </div>
                      <div style={{ fontSize:14, lineHeight:1.45, color:'#2A241C' }}>{p.text}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:9, paddingTop:8, borderTop:'1px dotted rgba(33,28,23,0.10)' }}>
                        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.teal }}>OPORTUNIDAD {p.score}</span>
                        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600, marginLeft:'auto' }}>ABRIR ↗</span>
                      </div>
                    </a>
                  </TiltCard>
                ))}
              </motion.div>
            )}
            {/* Pros y contras */}
            {((pc.positive||[]).length>0||(pc.negative||[]).length>0) && (
            <motion.div variants={item} style={{ paddingTop:14, paddingBottom:6 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }}>
                <h2 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:22,
                  letterSpacing:'-0.015em', color:C.ink, margin:0 }}>Pros y contras</h2>
              </div>
              <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:'4px 15px 12px' }}>
                {(pc.positive||[]).length>0 && (
                  <div style={{ padding:'12px 0 4px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
                      <span style={{ width:8,height:8,borderRadius:'50%',background:C.teal }} />
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:C.teal }}>A favor</span>
                    </div>
                    {(pc.positive||[]).map((it,i) => (
                      <div key={i} style={{ display:'flex', gap:11, padding:'7px 0', borderBottom:'1px dotted rgba(33,28,23,0.07)' }}>
                        <span style={{ flex:'none', width:14, height:1, background:C.teal, marginTop:9 }} />
                        <span style={{ fontSize:14, lineHeight:1.5, color:'#2A241C' }}>{it}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(pc.negative||[]).length>0 && (
                  <div style={{ padding:'12px 0 4px', borderTop:'1px solid rgba(33,28,23,0.10)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
                      <span style={{ width:8,height:8,borderRadius:'50%',background:C.crim }} />
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:C.crim }}>En contra</span>
                    </div>
                    {(pc.negative||[]).map((it,i) => (
                      <div key={i} style={{ display:'flex', gap:11, padding:'7px 0', borderBottom:'1px dotted rgba(33,28,23,0.07)' }}>
                        <span style={{ flex:'none', width:14, height:1, background:C.crim, marginTop:9 }} />
                        <span style={{ fontSize:14, lineHeight:1.5, color:'#2A241C' }}>{it}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Mobile: Sentiment */}
          <motion.div variants={item} style={{ padding:'16px 18px 6px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:16, background:C.card,
              border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:18 }}>
              <Donut pos={s.pos} neu={s.neu} neg={s.neg} size={112} showLabel />
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.14em',
                  textTransform:'uppercase', color:'#6B6253', marginBottom:10 }}>Sentimiento general</div>
                {[{color:C.teal,label:'Favorable',pct:Math.round(s.pos)+'%'},{color:C.slate,label:'Neutral',pct:Math.round(s.neu)+'%'},{color:C.crim,label:'Crítica',pct:Math.round(s.neg)+'%'}].map(l => (
                  <div key={l.label} style={{ display:'flex', alignItems:'center', gap:9, marginBottom:8 }}>
                    <span style={{ width:8,height:8,borderRadius:'50%',flex:'none',background:l.color }} />
                    <span style={{ fontSize:12, color:'#2A241C', flex:1 }}>{l.label}</span>
                    <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:14, color:C.ink }}>{l.pct}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Alertómetro */}
          <Section title="Alertómetro & riesgo" right={<Pill rm={rm} />}>
        <Card accentColor={rm.c}>
          <div style={{ display:'flex', gap:0 }}>
            <div style={{ flex:1, borderRight:'1px solid rgba(33,28,23,0.10)', paddingRight:12 }}>
              <div style={{ fontSize:26, fontWeight:600, color:C.ink, lineHeight:1 }}>{Math.round(t.risk?.negPct||s.neg||0)}<span style={{ fontSize:15 }}>%</span></div>
              <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase', color:'#6B6253', marginTop:6 }}>Conversación crítica</div>
            </div>
            <div style={{ flex:1, paddingLeft:14 }}>
              <div style={{ fontSize:26, fontWeight:600, color:C.ink, lineHeight:1 }}>{al.total||0}</div>
              <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase', color:'#6B6253', marginTop:6 }}>Posts con alerta / {al.analizados||0}</div>
            </div>
          </div>
          <div style={{ fontSize:14, lineHeight:1.5, color:'#2A241C', marginTop:13, paddingTop:13, borderTop:'1px solid rgba(33,28,23,0.10)' }}>
            {al.recomendacion||'No se encontraron posts negativos'}
          </div>
        </Card>
        {alPosts.map((p,i) => (
          <TiltCard key={i} style={{ display:'block', textDecoration:'none', background:C.card,
            border:'1px solid rgba(33,28,23,0.13)', borderLeft:`3px solid ${C.crim}`,
            borderRadius:3, padding:16, marginBottom:8 }}>
            <a href={p.url} target="_blank" rel="noopener" style={{ textDecoration:'none', display:'block' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                <span style={{ ...pill(C.crim,'rgba(155,51,49,0.12)','rgba(155,51,49,0.38)') }}>{p.tipoLabel}</span>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#8A7E6A', marginLeft:'auto', textTransform:'uppercase' }}>{p.platformLabel} · {p.dateLabel}</span>
              </div>
              <div style={{ fontSize:14, lineHeight:1.45, color:'#2A241C' }}>{p.text}</div>
              <div style={{ fontSize:13, lineHeight:1.4, color:'#6B6253', marginTop:7 }}>{p.razon}</div>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:9, paddingTop:8, borderTop:'1px dotted rgba(33,28,23,0.10)' }}>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.crim }}>PELIGROSIDAD {p.score}</span>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#8A7E6A' }}>{p.engagementLabel} INTERACC.</span>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600, marginLeft:'auto' }}>ABRIR ↗</span>
              </div>
            </a>
          </TiltCard>
        ))}
      </Section>

      {/* Oportunidades */}
      {(op.recomendacion||opPosts.length>0) && (
        <Section title="Oportunidades" right={<span style={{ ...pill(C.teal,C.tealBg,C.tealBd) }}>Nivel {cap(op.nivel||'—')}</span>}>
          {op.recomendacion && <Card accentColor={C.teal}>
            <div style={{ fontSize:14, lineHeight:1.5, color:'#2A241C' }}>{op.recomendacion}</div>
          </Card>}
          {opPosts.map((p,i) => (
            <TiltCard key={i} style={{ marginBottom:8, borderRadius:3 }}>
              <a href={p.url} target="_blank" rel="noopener" style={{ display:'block', textDecoration:'none',
                background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderLeft:`3px solid ${C.teal}`,
                borderRadius:3, padding:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                  <span style={{ ...pill(C.teal,C.tealBg,C.tealBd) }}>Impacto {p.impacto}</span>
                  <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#8A7E6A', marginLeft:'auto', textTransform:'uppercase' }}>{p.platformLabel} · {p.dateLabel}</span>
                </div>
                <div style={{ fontSize:14, lineHeight:1.45, color:'#2A241C' }}>{p.text}</div>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:9, paddingTop:8, borderTop:'1px dotted rgba(33,28,23,0.10)' }}>
                  <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.teal }}>OPORTUNIDAD {p.score}</span>
                  <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600, marginLeft:'auto' }}>ABRIR ↗</span>
                </div>
              </a>
            </TiltCard>
          ))}
        </Section>
      )}

      {/* Pros y contras */}
      {((pc.positive||[]).length>0||(pc.negative||[]).length>0) && (
      <Section title="Pros y contras">
        <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:'4px 15px 12px' }}>
          {(pc.positive||[]).length>0 && (
            <div style={{ padding:'12px 0 4px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
                <span style={{ width:8,height:8,borderRadius:'50%',background:C.teal }} />
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:C.teal }}>A favor</span>
              </div>
              {(pc.positive||[]).map((it,i) => (
                <div key={i} style={{ display:'flex', gap:11, padding:'7px 0', borderBottom:'1px dotted rgba(33,28,23,0.07)' }}>
                  <span style={{ flex:'none', width:14, height:1, background:C.teal, marginTop:9 }} />
                  <span style={{ fontSize:14, lineHeight:1.5, color:'#2A241C' }}>{it}</span>
                </div>
              ))}
            </div>
          )}
          {(pc.negative||[]).length>0 && (
            <div style={{ padding:'12px 0 4px', borderTop:'1px solid rgba(33,28,23,0.10)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
                <span style={{ width:8,height:8,borderRadius:'50%',background:C.crim }} />
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:C.crim }}>En contra</span>
              </div>
              {(pc.negative||[]).map((it,i) => (
                <div key={i} style={{ display:'flex', gap:11, padding:'7px 0', borderBottom:'1px dotted rgba(33,28,23,0.07)' }}>
                  <span style={{ flex:'none', width:14, height:1, background:C.crim, marginTop:9 }} />
                  <span style={{ fontSize:14, lineHeight:1.5, color:'#2A241C' }}>{it}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
      )}
        </>
      )}

      {/* Quejas */}
      {cats.length>0 && (
        <Section title="Quejas y críticas" px={sectionPx} right={<span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:'#8A7E6A', letterSpacing:'0.04em' }}>{cm.total||0} ANALIZADAS</span>}>
          {cats.map((cat,ci) => (
            <TiltCard key={ci} style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:14, marginBottom:9 }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10 }}>
                <span style={{ fontWeight:600, fontSize:13.5, color:C.ink, letterSpacing:'-0.005em' }}>{cat.titulo}</span>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:14, color:C.crim, fontVariantNumeric:'tabular-nums' }}>{cat.porcentaje}%</span>
              </div>
              <div style={{ height:4, background:'#E3DAC6', borderRadius:2, margin:'10px 0 12px', overflow:'hidden' }}>
                <motion.div initial={{ width:0 }} animate={{ width:Math.min(100,cat.porcentaje)+'%' }}
                  transition={{ duration:0.8 }} style={{ height:'100%', background:C.crim }} />
              </div>
              {cat.items.map((it,ii) => (
                <a key={ii} href={it.url||'#'} target={it.hasLink?'_blank':'_self'} rel="noopener"
                  style={{ display:'flex', gap:11, textDecoration:'none', padding:'6px 0', borderBottom:'1px dotted rgba(33,28,23,0.07)' }}>
                  <span style={{ flex:'none', width:14, height:1, background:C.crim, marginTop:9 }} />
                  <span style={{ flex:1 }}>
                    <span style={{ fontSize:12, lineHeight:1.5, color:'#2A241C', display:'block' }}>{it.texto}</span>
                    {it.hasLink && <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' }}>{it.sourceLabel} ↗</span>}
                  </span>
                </a>
              ))}
            </TiltCard>
          ))}
        </Section>
      )}

      {/* Noticias */}
      {newsGroups.length>0 && (
        <Section title="Noticias · semáforo" px={sectionPx} right={<span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:'#8A7E6A', letterSpacing:'0.04em' }}>{t.news?.total||newsGroups.length} TEMAS</span>}>
          <p style={{ fontSize:11, color:'#8A7E6A', margin:'0 0 12px', fontFamily:"'Geist Mono',monospace" }}>Toca para abrir la fuente.</p>
          {newsGroups.map((g,gi) => (
            <TiltCard key={gi} style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)',
              borderLeft:`3px solid ${g.color}`, borderRadius:3, padding:14, marginBottom:9 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span style={{ ...pill(g.ink,g.bg,g.border) }}>{g.ratingLabel}</span>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#8A7E6A', marginLeft:'auto' }}>{g.porcentaje}% COBERTURA</span>
              </div>
              <div style={{ fontWeight:600, fontSize:13.5, lineHeight:1.35, color:C.ink }}>{g.titulo}</div>
              <div style={{ fontSize:12, lineHeight:1.5, color:'#2A241C', marginTop:6 }}>{g.descripcion}</div>
              <div style={{ marginTop:11, borderTop:'1px solid rgba(33,28,23,0.10)', paddingTop:8 }}>
                {g.noticias.map((n,ni) => (
                  <a key={ni} href={n.link} target="_blank" rel="noopener"
                    style={{ display:'flex', gap:11, alignItems:'flex-start', textDecoration:'none', padding:'6px 0' }}>
                    <span style={{ flex:'none', width:14, height:1, background:g.color, marginTop:9 }} />
                    <span style={{ flex:1 }}>
                      <span style={{ fontSize:12, lineHeight:1.4, color:'#2A241C', display:'block' }}>{n.titulo}</span>
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600, textTransform:'uppercase' }}>{n.fuente} · {n.fecha} ↗</span>
                    </span>
                  </a>
                ))}
              </div>
            </TiltCard>
          ))}
        </Section>
      )}

      {/* Tendencias */}
      {trending.length>0 && (
        <Section title="Temas en tendencia" px={sectionPx}>
          {trending.map(tr => (
            <TiltCard key={tr.rank} style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:14, marginBottom:8 }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:500, fontSize:13, color:C.gold, lineHeight:1.3, flex:'none' }}>{tr.rank}</span>
                <div>
                  <div style={{ fontWeight:600, fontSize:13.5, lineHeight:1.3, color:C.ink }}>{tr.titulo}</div>
                  <div style={{ fontSize:12, lineHeight:1.5, color:'#2A241C', marginTop:6 }}>{tr.desc}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:14, marginTop:11, paddingTop:9, borderTop:'1px dotted rgba(33,28,23,0.10)', fontFamily:"'Geist Mono',monospace" }}>
                <span style={{ fontSize:11, color:'#6B6253' }}>{tr.viewsLabel} VIEWS</span>
                <span style={{ fontSize:11, color:'#6B6253' }}>{tr.likesLabel} LIKES</span>
                <span style={{ fontSize:11, color:C.teal, marginLeft:'auto' }}>{tr.posPct}%+</span>
                <span style={{ fontSize:11, color:C.crim }}>{tr.negPct}%–</span>
              </div>
            </TiltCard>
          ))}
        </Section>
      )}

      {/* Voces */}
      {(v.resumen||vsegs.length||valertas.length) ? (
        <Section title="Voces de la conversación" px={sectionPx}>
          {v.resumen && (
            <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:'16px 18px', marginBottom:10 }}>
              <div style={{ fontFamily:"'Fraunces',serif", fontStyle:'italic', fontWeight:300, fontSize:18, lineHeight:1.3, color:C.ink }}>"{v.resumen}"</div>
              <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:'#6B6253', marginTop:13, paddingTop:11, borderTop:'1px solid rgba(33,28,23,0.10)' }}>Lectura de la conversación</div>
            </div>
          )}
          {valertas.map((al,i) => (
            <div key={i} style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderLeft:`3px solid ${al.color}`, borderRadius:3, padding:16, marginBottom:8 }}>
              <span style={{ ...pill(al.ink,al.bg,al.bd), display:'inline-flex', marginBottom:7 }}>Severidad {al.severidad}</span>
              <div style={{ fontWeight:600, fontSize:14, color:C.ink, lineHeight:1.3 }}>{al.tema}</div>
              <div style={{ fontSize:13, lineHeight:1.45, color:'#2A241C', marginTop:5 }}>{al.descripcion}</div>
            </div>
          ))}
          {vsegs.map((seg,i) => (
            <div key={i} style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:16, marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontWeight:600, fontSize:14, color:C.ink, flex:1 }}>{seg.label}</span>
                <span style={{ ...pill(seg.ink,seg.bg,seg.bd) }}>{seg.sentimiento}</span>
              </div>
              <div style={{ fontSize:13, lineHeight:1.45, color:'#2A241C', marginTop:7 }}>{seg.narrativa}</div>
            </div>
          ))}
        </Section>
      ) : null}

      {/* Influencers */}
      {itop.length>0 && (
        <Section title="Voces con más alcance" px={sectionPx} right={<span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:'#8A7E6A' }}>{inf.total||0} ANALIZADAS</span>}>
          <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap:8 }}>
          {itop.map(i => (
            <TiltCard key={i.rank} style={{ borderRadius:3 }}>
              <a href={i.url} target="_blank" rel="noopener"
                style={{ display:'flex', gap:12, alignItems:'center', textDecoration:'none',
                  background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:11 }}>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:500, fontSize:12, color:C.gold, width:18, textAlign:'center' }}>{i.rank}</span>
                <div style={{ width:40, height:40, borderRadius:2, flex:'none',
                  background:'#E3DAC6', border:'1px solid rgba(33,28,23,0.13)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:14, color:'#6B6253',
                  textTransform:'uppercase', userSelect:'none' }}>
                  {(i.username||'?').replace(/[^a-zA-Z0-9]/g,'').slice(0,2)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontWeight:600, fontSize:13, color:C.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{i.username}</span>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:i.sentColor, flex:'none' }} />
                  </div>
                  <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#8A7E6A', marginTop:3, textTransform:'uppercase' }}>{i.platformLabel} · {i.categoria}</div>
                  <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:'#6B6253', marginTop:2 }}>{i.followersFmt} seguidores</div>
                </div>
                <span style={{ fontFamily:"'Geist Mono',monospace", color:C.goldDeep, fontSize:11, fontWeight:600 }}>↗</span>
              </a>
            </TiltCard>
          ))}
          </div>
        </Section>
      )}

      {/* Brecha narrativa */}
      {gap && gap.contraste && (
        <Section title="Brecha narrativa" px={sectionPx}>
          <p style={{ fontSize:11, color:'#8A7E6A', margin:'0 0 11px', fontFamily:"'Geist Mono',monospace" }}>Lo que comunica el equipo vs. lo que opina el público.</p>
          <Card>
            <div style={{ fontSize:14, lineHeight:1.5, color:'#2A241C' }}>{gap.contraste?.gap_principal||''}</div>
            <div style={{ marginTop:13, paddingTop:13, borderTop:'1px solid rgba(33,28,23,0.10)' }}>
              <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8A7E6A', marginBottom:4 }}>Narrativa oficial</div>
              <div style={{ fontSize:12, lineHeight:1.45, color:'#2A241C' }}>{gap.oficial?.mensaje_principal||gap.oficial?.tono_general||''}</div>
              <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8A7E6A', margin:'11px 0 4px' }}>Hallazgo principal</div>
              <div style={{ fontSize:12, lineHeight:1.45, color:'#2A241C' }}>{gap.resumen?.hallazgo_principal||gap.resumen?.sintesis||''}</div>
            </div>
          </Card>
        </Section>
      )}

      {/* Reconocimientos */}
      {rc.length>0 && (
        <Section title="Reconocimientos" px={sectionPx}>
          {rc.map((r,i) => (
            <div key={i} style={{ display:'flex', gap:12, background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderLeft:`3px solid ${C.gold}`, borderRadius:3, padding:16, marginBottom:8 }}>
              <span style={{ flex:'none', width:14, height:1, background:C.gold, marginTop:9 }} />
              <div>
                <div style={{ fontWeight:600, fontSize:14, lineHeight:1.35, color:C.ink }}>{r.titulo}</div>
                <div style={{ fontSize:13, lineHeight:1.45, color:'#2A241C', marginTop:5 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Timeline */}
      {events.length>0 && (
        <Section title="Línea de tiempo" px={sectionPx}>
          {events.map((e,i) => (
            <div key={i} style={{ display:'flex', gap:13 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:'none', width:12 }}>
                <motion.span initial={{ scale:0 }} animate={{ scale:1 }} transition={{ delay:i*0.1+0.3 }}
                  style={{ width:11, height:11, borderRadius:'50%', background:e.dotColor, border:'2px solid #EFE9DC', boxShadow:`0 0 0 1px ${e.dotColor}` }} />
                <span style={{ width:1, flex:1, background:'rgba(33,28,23,0.13)', marginTop:2 }} />
              </div>
              <div style={{ flex:1, paddingBottom:15 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:12, color:C.ink }}>{e.dateLabel}</span>
                  <span style={{ ...pill(e.ink,e.bg,e.bd) }}>{e.sentiment}</span>
                </div>
                <div style={{ fontSize:14, lineHeight:1.45, color:'#2A241C', marginTop:6 }}>{e.main}</div>
                <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#8A7E6A', marginTop:5, textTransform:'uppercase' }}>Engagement {e.engagement} · {e.postsLabel}</div>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Desglose por red */}
      {strategyNetworks.length>0 && (
        <Section title="Mapa por red y aliados" px={sectionPx} right={<span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:'#8A7E6A' }}>{fmt(networkStrategy.totalPosts||0)} MENCIONES</span>}>
          <div style={{ display:'grid', gridTemplateColumns: isDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap:8 }}>
            {strategyNetworks.map(n => (
              <div key={n.key} style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
                  <PlatformIcon platform={n.key} size={24} />
                  <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:700, fontSize:22, color:C.ink, lineHeight:1 }}>{n.share}%</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:11, color:C.ink, letterSpacing:'0.08em', textTransform:'uppercase' }}>{n.label}</div>
                    <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', marginTop:2 }}>{n.postsLabel} POSTS · {n.viewsLabel} VIEWS · {n.commentsLabel} COM.</div>
                  </div>
                  <span style={{ ...pill(n.toneMeta.ink,n.toneMeta.bg,n.toneMeta.bd) }}>{n.toneLabel}</span>
                </div>

                <SentBar pos={n.sent?.positivo||0} neu={n.sent?.neutral||0} neg={n.sent?.negativo||0} />
                <div style={{ display:'flex', gap:13, marginTop:8, fontFamily:"'Geist Mono',monospace" }}>
                  <span style={{ fontSize:11, color:C.teal }}>{n.sent?.positivo||0}%+</span>
                  <span style={{ fontSize:11, color:'#8A7E6A' }}>{n.sent?.neutral||0}% NEU</span>
                  <span style={{ fontSize:11, color:C.crim }}>{n.sent?.negativo||0}%-</span>
                </div>

                {n.themes.length>0 && (
                  <div style={{ marginTop:12, paddingTop:11, borderTop:'1px solid rgba(33,28,23,0.10)' }}>
                    <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8A7E6A', marginBottom:7 }}>Temas que prende</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {n.themes.map(th => (
                        <span key={th.key} style={{ ...pill(C.goldDeep,'rgba(176,130,47,0.10)','rgba(176,130,47,0.30)') }}>{th.label} {th.pct}%</span>
                      ))}
                    </div>
                  </div>
                )}

                {n.topTerms.length>0 && (
                  <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:'6px 9px' }}>
                    {n.topTerms.map(term => (
                      <span key={term} style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#6B6253' }}>#{term}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {strategyAllies.length>0 && (
            <div style={{ marginTop:10, background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1.2fr 0.8fr 0.7fr 0.7fr 0.55fr' : '1.1fr 0.8fr 0.6fr', gap:8,
                padding:'9px 12px', background:'rgba(33,28,23,0.04)', borderBottom:'1px solid rgba(33,28,23,0.10)' }}>
                {['Voz posible','Red','Tamaño', ...(isDesktop ? ['Views','Tipo'] : [])].map(h => (
                  <span key={h} style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8A7E6A' }}>{h}</span>
                ))}
              </div>
              {strategyAllies.map((a,i) => (
                <a key={`${a.platform}-${a.username}-${i}`} href={a.url} target="_blank" rel="noopener"
                  style={{ display:'grid', gridTemplateColumns: isDesktop ? '1.2fr 0.8fr 0.7fr 0.7fr 0.55fr' : '1.1fr 0.8fr 0.6fr', gap:8,
                    alignItems:'center', padding:'10px 12px', textDecoration:'none', borderBottom:i<strategyAllies.length-1?'1px solid rgba(33,28,23,0.08)':'none' }}>
                  <span style={{ minWidth:0 }}>
                    <span style={{ display:'block', fontWeight:600, fontSize:13, color:C.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.username}</span>
                    <span style={{ display:'block', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', marginTop:2 }}>{a.followersLabel} seguidores</span>
                  </span>
                  <span style={{ display:'flex', alignItems:'center', gap:7, fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#6B6253', textTransform:'uppercase' }}>
                    <PlatformIcon platform={a.platform} size={16} />
                    {a.platformLabel}
                  </span>
                  <span style={{ ...pill(a.tier === 'macro' ? C.crim : a.tier === 'medio' ? C.goldDeep : C.teal, a.tier === 'macro' ? C.crimBg : a.tier === 'medio' ? C.amberBg : C.tealBg, a.tier === 'macro' ? C.crimBd : a.tier === 'medio' ? C.amberBd : C.tealBd) }}>{a.tierLabel}</span>
                  {isDesktop && <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#6B6253' }}>{a.viewsLabel}</span>}
                  {isDesktop && <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600 }}>ABRIR</span>}
                </a>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Desglose por red */}
      {pls.length>0 && (
        <Section title="Desglose por red" px={sectionPx}>
          {pls.map((p,i) => (
            <div key={i} style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:16, marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
                <PlatformIcon platform={p.name} size={18} />
                <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:11, color:C.ink, flex:1, letterSpacing:'0.06em', textTransform:'uppercase' }}>{p.nameLabel}</span>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#8A7E6A' }}>{p.postsLabel} POSTS · {p.commentsLabel} COM.</span>
              </div>
              <SentBar pos={p.pp} neu={p.pu} neg={p.pn} />
              <div style={{ display:'flex', gap:13, marginTop:8, fontFamily:"'Geist Mono',monospace" }}>
                <span style={{ fontSize:11, color:C.teal }}>{p.pp}%+</span>
                <span style={{ fontSize:11, color:'#8A7E6A' }}>{p.pu}% NEU</span>
                <span style={{ fontSize:11, color:C.crim }}>{p.pn}%–</span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Temas en comentarios */}
      {ctTopics.length>0 && (
        <Section title="Temas en comentarios" px={sectionPx} right={<span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:'#8A7E6A' }}>{ct.total||0} COM.</span>}>
          {ctTopics.map((cat,i) => (
            <div key={i} style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:16, marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10, marginBottom:8 }}>
                <span style={{ fontWeight:600, fontSize:14, color:C.ink }}>{cat.titulo}</span>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:13, color:C.gold }}>{cat.porcentaje}%</span>
              </div>
              {cat.items.map((it,ii) => (
                <div key={ii} style={{ display:'flex', gap:11, padding:'6px 0', borderBottom:'1px dotted rgba(33,28,23,0.07)' }}>
                  <span style={{ flex:'none', width:14, height:1, background:C.gold, marginTop:9 }} />
                  <span style={{ fontSize:13, lineHeight:1.45, color:'#2A241C' }}>{it}</span>
                </div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {/* Pulso emocional */}
      {(emojis.length>0||keywords.length>0) && <Section title="Pulso emocional" px={sectionPx}>
        <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:18 }}>
          {emojis.length>0 && (<>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', color:'#8A7E6A', marginBottom:10 }}>Emojis más usados</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {emojis.map((e,i) => (
                <motion.div key={i} initial={{ scale:0 }} animate={{ scale:1 }} transition={{ delay:i*0.04, type:'spring' }}
                  style={{ display:'flex', alignItems:'center', gap:5, background:C.sub, border:'1px solid #E3DAC6', borderRadius:2, padding:'5px 9px' }}>
                  <span style={{ fontSize:14 }}>{e.emoji}</span>
                  <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, fontWeight:600, color:'#6B6253' }}>{e.count}</span>
                </motion.div>
              ))}
            </div>
          </>)}
          {keywords.length>0 && (<>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', color:'#8A7E6A', margin:'16px 0 10px' }}>Palabras clave</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'7px 12px', alignItems:'baseline' }}>
              {keywords.map((k,i) => (
                <motion.span key={i} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*0.02 }}
                  style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, color:k.color, fontSize:k.sizePx, lineHeight:1 }}>
                  {k.w}
                </motion.span>
              ))}
            </div>
          </>)}
        </div>
      </Section>}

    </motion.div>
  );
}
