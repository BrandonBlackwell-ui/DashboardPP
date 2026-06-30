import { useState } from 'react';
import { motion } from 'framer-motion';
import Donut from './Donut';
import TiltCard from './TiltCard';
import PlatformIcon from './PlatformIcon';
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

function deriveNetworkStrategy(themeData) {
  const existing = themeData.networkStrategy;
  if (existing?.networks?.length) return existing;

  const platforms = themeData.platforms || [];
  const totalPosts = platforms.reduce((sum, p) => sum + (Number(p.posts) || 0), 0);
  if (!totalPosts) return { totalPosts:0, networks:[], allies:[] };

  const influencers = themeData.influencers?.top || [];
  const networks = platforms.map(p => {
    const sd = p.sentiment || p.sent || {};
    const pos = Number(sd.positivo || sd.positive || 0);
    const neu = Number(sd.neutral || 0);
    const neg = Number(sd.negativo || sd.negative || 0);
    const tone = neg > pos && neg >= neu ? 'critica' : pos >= neg && pos >= neu ? 'favorable' : 'neutral';
    const allies = influencers
      .filter(i => (i.platform || '').toLowerCase() === (p.name || p.platform || '').toLowerCase())
      .filter(i => !String(i.sentiment || '').toLowerCase().includes('negat'))
      .map(i => ({
        username:i.username,
        platform:i.platform,
        followers:Number(i.followers || 0),
        url:i.url,
        posts:0,
        views:0,
        likes:0,
        tier:Number(i.followers || 0) >= 500000 ? 'macro' : Number(i.followers || 0) >= 50000 ? 'medio' : 'micro',
        score:Number(i.followers || 0),
      }))
      .sort((a,b) => b.score - a.score)
      .slice(0, 4);

    return {
      key:p.name || p.platform,
      label:platLabel(p.name || p.platform),
      share:Math.round((Number(p.posts) || 0) / totalPosts * 100),
      posts:Number(p.posts) || 0,
      comments:Number(p.comments) || 0,
      views:0,
      likes:0,
      tone,
      sent:{ positivo:Math.round(pos), neutral:Math.round(neu), negativo:Math.round(neg) },
      topTerms:[],
      themes:[],
      allies,
      fallback:true,
    };
  }).sort((a,b) => b.posts - a.posts);

  const allies = networks.flatMap(n => n.allies.map(a => ({ ...a, platformLabel:n.label })))
    .sort((a,b) => b.score - a.score)
    .slice(0, 9);

  return { totalPosts, networks, allies, fallback:true };
}

const NEG_KW = ['chisme','chismesito','polém','polemic','escándalo','escandalo','cancela','cancelad','colad','critica','crítica','critico','crítico','horrible','vergüenza','verguenza','fraude','mentira','hipócrita','hipocrita','controver','acusac','denuncia','trampa','falso','odio','asco','decepcion','decepción','hater','malo','pésimo','pesimo','ridículo','ridiculo','reclam'];
const POS_KW = ['fan','amor','love','increíble','increible','talento','mejor','hermoso','hermosa','apoy','admiro','admira','admiración','admiracion','genio','genial','orgullo','orgullos','bravo','maravill','gracias','éxito','exito','felicit','encanta','encanto','bonit','bellísim','bellisim','viva','gozo','alegria','alegría'];

function scoreText(text) {
  const t = (text || '').toLowerCase();
  const neg = NEG_KW.filter(k => t.includes(k)).length;
  const pos = POS_KW.filter(k => t.includes(k)).length;
  return neg > pos ? 'negative' : pos > neg ? 'positive' : 'neutral';
}

function deriveVoices(themeData, postsByPlatform) {
  const allPosts = Object.values(postsByPlatform).flat();
  if (!allPosts.length) return { allies:[], critics:[] };

  // Aggregate per author
  const authorMap = {};
  allPosts.forEach(p => {
    const key = (p.username || '').toLowerCase().trim();
    if (!key || key === 'pepeaguilar_oficial' || key === 'pepeaguilaroficial') return;
    const eng = (p.likes||0) + (p.comments||0)*2 + (p.shares||0)*3 + (p.bookmarks||0) + (p.retweets||0)*3 + (p.views||0)*0.01;
    const tone = scoreText(p.text);
    if (!authorMap[key]) {
      authorMap[key] = { username:p.username, platform:p.platform, followers:p.followers||0, posts:0, engagement:0, toneVotes:{positive:0,neutral:0,negative:0} };
    }
    const a = authorMap[key];
    a.posts++;
    a.engagement += eng;
    a.followers = Math.max(a.followers, p.followers||0);
    a.toneVotes[tone]++;
  });

  const voices = Object.values(authorMap).map(a => {
    const followers = a.followers;
    const tv = a.toneVotes;
    const dominant = tv.negative > tv.positive && tv.negative >= tv.neutral ? 'negative'
                   : tv.positive > tv.negative && tv.positive >= tv.neutral ? 'positive'
                   : 'neutral';
    return {
      username: a.username,
      platform: a.platform,
      followers,
      url: '',
      posts: a.posts,
      engagement: Math.round(a.engagement),
      sentiment: dominant,
      tier: followers >= 500000 ? 'macro' : followers >= 50000 ? 'medio' : 'micro',
      score: followers * 0.1 + a.engagement,
    };
  }).sort((a, b) => b.score - a.score);

  return {
    allies: voices.filter(v => v.sentiment !== 'negative').slice(0, 10),
    critics: voices.filter(v => v.sentiment === 'negative').slice(0, 10),
  };
}

function thumbnailFromUrl(url) {
  const raw = String(url || '');
  const videoId = raw.match(/[?&]v=([^&]+)/)?.[1] || raw.match(/youtube\.com\/shorts\/([^?/]+)/)?.[1];
  if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  return '';
}

function postKey(post, index = 0) {
  return post.url || `${post.username || 'post'}-${post.date || index}-${index}`;
}

function deriveNetworkPosts(themeData) {
  const buckets = {};
  const add = (platform, post) => {
    const key = (platform || post.platform || '').toLowerCase();
    if (!key) return;
    if (!buckets[key]) buckets[key] = [];
    if (post.url && buckets[key].some(p => p.url === post.url)) return;
    if (!post.url && buckets[key].some(p => p.text === (post.text || post.titulo || post.title || '') && p.username === (post.username || post.user || post.fuente || ''))) return;
    buckets[key].push({
      url:post.url || '',
      sourceUrl:post.sourceUrl || '',
      text:post.text || post.titulo || post.title || '',
      username:post.username || post.user || post.fuente || '',
      platform:key,
      date:post.time || post.fecha || '',
      metric:post.views ? `${fmtK(post.views)} views` : post.engagement ? `${fmtK(post.engagement)} interacc.` : '',
      likes:post.reactions || post.likes || 0,
      comments:post.comments || 0,
      shares:post.shares || 0,
      retweets:post.retweets || 0,
      quotes:post.quotes || 0,
      bookmarks:post.bookmarks || 0,
      followers:post.followers || 0,
      type:post.type || '',
      commentsExtracted:post.commentsExtracted || 0,
      commentsList:post.commentsList || [],
      thumbnail:post.thumbnail || post.image || post.coverUrl || thumbnailFromUrl(post.url),
    });
  };

  (themeData.networkStrategy?.networks || []).forEach(n => {
    (n.postsList || n.posts_list || []).forEach(p => add(n.key, p));
  });
  (themeData.alerts?.posts || themeData.alertometro?.posts || []).forEach(p => add(p.platform, p));
  (themeData.opps?.posts || themeData.oportunometro?.posts || []).forEach(p => add(p.platform, p));
  (themeData.influencers?.top || []).forEach(p => add(p.platform, {
    url:p.url,
    text:p.categoria || p.sentiment || 'Perfil con alcance',
    username:p.username,
    platform:p.platform,
    views:0,
  }));
  if (themeData.news?.grupos) {
    ['positivo','neutral','negativo'].forEach(rating => {
      (themeData.news.grupos[rating] || []).forEach(group => {
        (group.noticias || []).forEach(n => add('google_news', { ...n, username:n.fuente, text:n.titulo }));
      });
    });
  } else if (themeData.news) {
    ['positivo','neutral','negativo'].forEach(rating => {
      (themeData.news[rating] || []).forEach(group => {
        (group.noticias || []).forEach(n => add('google_news', { ...n, username:n.fuente, text:n.titulo }));
      });
    });
  }

  Object.keys(buckets).forEach(k => { buckets[k] = buckets[k].slice(0, 12); });
  return buckets;
}

export default function ThemeView({ tab, date, plat, data, isDesktop, noData, calendarSummary }) {
  const T = data.themes;
  const t = T[tab];
  const [activeNetwork, setActiveNetwork] = useState(null);
  const [activePostKey, setActivePostKey] = useState(null);
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
  const alPosts = (al.posts||[]).filter(p=>p.url&&platMatch(p.platform)&&dateMatchTs(p.time)).map(mapPost);

  // Opps
  const op = t.oportunometro||t.opps||{};
  const opPosts = (op.posts||[]).filter(p=>p.url&&platMatch(p.platform)&&dateMatchTs(p.time)).map(mapPost);

  // Pros/cons
  const pc = t.pros_cons||t.proscons||{};

  // Complaints
  const cm = t.complaints||{};
  const cats = (cm.categories||[]).map(cat => ({
    titulo:cat.titulo, porcentaje:cat.porcentaje,
    items:(cat.items||[]).map(it => {
      const src=(it.sources&&it.sources[0])||null;
      return { texto:it.texto, url:src?.url || '', hasLink:!!src?.url, sourceLabel:src?.url?'Fuente · '+platLabel(src.platform):'' };
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

  const networkStrategy = deriveNetworkStrategy(t);
  const networkPostsByKey = deriveNetworkPosts(t);
  const voices = deriveVoices(t, networkPostsByKey);
  const strategyNetworks = (networkStrategy.networks||[]).map(n => {
    const toneMeta = n.tone === 'favorable' ? sentMeta('positivo') : n.tone === 'critica' ? sentMeta('negativo') : sentMeta('neutral');
    return {
      ...n,
      toneLabel: n.tone === 'favorable' ? 'Favorable' : n.tone === 'critica' ? 'Critica' : 'Neutral',
      toneMeta,
      postsLabel:n.targetPosts ? `${fmt(n.posts)}/${n.targetPosts}` : fmt(n.posts),
      scrapeLabel:n.scrapePosts && n.scrapePosts !== n.targetPosts ? `scrape ${fmt(n.scrapePosts)}` : '',
      viewsLabel:fmtK(n.views),
      commentsLabel:fmt(n.comments),
      topTerms:(n.topTerms||[]).slice(0,4),
      themes:(n.themes||[]).slice(0,3),
      postsList:networkPostsByKey[n.key] || n.postsList || [],
    };
  });
  const selectedNetwork = activeNetwork || (t.rawOnly ? strategyNetworks[0]?.key : null);
  const strategyAllies = (networkStrategy.allies||[]).map(a => ({
      ...a,
      tierLabel:a.tier === 'macro' ? 'Macro' : a.tier === 'medio' ? 'Medio' : 'Micro',
      followersLabel:a.followers ? `${fmtK(a.followers)} seguidores` : (a.audienceLabel || ''),
      viewsLabel:a.views ? fmtK(a.views) : '',
      platformLabel:a.platformLabel || platLabel(a.platform),
      hasLink:!!a.url,
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
  const networkMapTitle = networkStrategy.title || 'Mapa por red y aliados';
  const networkMapItemLabel = networkStrategy.itemLabel || 'MENCIONES';
  const renderNetworkMap = (compact = false) => strategyNetworks.length > 0 && (
    <Section title={networkMapTitle} px={compact ? '16px 0 6px' : sectionPx}
      right={<span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:'#8A7E6A' }}>{fmt(networkStrategy.totalPosts||0)} {networkMapItemLabel}</span>}>
      <div style={{ display:'grid', gridTemplateColumns: compact ? 'repeat(2, minmax(0, 1fr))' : isDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap:8 }}>
        {strategyNetworks.map(n => (
          <button key={n.key} onClick={() => { setActiveNetwork(activeNetwork === n.key ? null : n.key); setActivePostKey(null); }}
            style={{ textAlign:'left', cursor:'pointer', background:C.card,
              border:selectedNetwork === n.key ? `1px solid ${C.gold}` : '1px solid rgba(33,28,23,0.13)',
              boxShadow:selectedNetwork === n.key ? '0 0 0 1px rgba(176,130,47,0.18)' : 'none',
              borderRadius:3, padding:compact ? 12 : 16, font:'inherit' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:compact ? 8 : 10 }}>
              <PlatformIcon platform={n.key} size={compact ? 22 : 24} />
              <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:700, fontSize:compact ? 20 : 22, color:C.ink, lineHeight:1 }}>{n.share}%</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:10.5, color:C.ink, letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{n.label}</div>
                <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:compact ? 9.5 : 10.5, color:'#8A7E6A', marginTop:2 }}>
                  {[
                    `${n.postsLabel} POSTS`,
                    n.scrapeLabel ? n.scrapeLabel.toUpperCase() : '',
                    !compact && n.views ? `${n.viewsLabel} VIEWS` : '',
                    !compact && n.comments ? `${n.commentsLabel} COM.` : '',
                  ].filter(Boolean).join(' - ')}
                </div>
              </div>
            </div>
            {!t.rawOnly && <>
              <SentBar pos={n.sent?.positivo||0} neu={n.sent?.neutral||0} neg={n.sent?.negativo||0} />
              <div style={{ display:'flex', gap:10, marginTop:7, fontFamily:"'Geist Mono',monospace" }}>
                <span style={{ fontSize:10.5, color:C.teal }}>{n.sent?.positivo||0}%+</span>
                <span style={{ fontSize:10.5, color:'#8A7E6A' }}>{n.sent?.neutral||0}% NEU</span>
                <span style={{ fontSize:10.5, color:C.crim }}>{n.sent?.negativo||0}%-</span>
              </div>
            </>}

            {!compact && n.themes.length>0 && (
              <div style={{ marginTop:12, paddingTop:11, borderTop:'1px solid rgba(33,28,23,0.10)' }}>
                <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8A7E6A', marginBottom:7 }}>Temas que prende</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {n.themes.map(th => (
                    <span key={th.key} style={{ ...pill(C.goldDeep,'rgba(176,130,47,0.10)','rgba(176,130,47,0.30)') }}>{th.label} {th.pct}%</span>
                  ))}
                </div>
              </div>
            )}

            {!compact && n.topTerms.length>0 && (
              <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:'6px 9px' }}>
                {n.topTerms.map(term => (
                  <span key={term} style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#6B6253' }}>#{term}</span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedNetwork && (() => {
        const selectedPosts = networkPostsByKey[selectedNetwork] || [];
        const selectedPost = selectedPosts.find((p, idx) => postKey(p, idx) === activePostKey) || selectedPosts[0];
        const selectedComments = selectedPost?.commentsList || [];
        return (
        <div style={{ marginTop:10, display:'grid', gridTemplateColumns:isDesktop && !compact ? 'minmax(0, 0.95fr) minmax(0, 1.05fr)' : '1fr', gap:10 }}>
          <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(33,28,23,0.04)', borderBottom:'1px solid rgba(33,28,23,0.10)' }}>
              <PlatformIcon platform={selectedNetwork} size={16} />
              <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.ink }}>
                Publicaciones de {platLabel(selectedNetwork)}
              </span>
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', marginLeft:'auto' }}>
                {selectedPosts.length} visibles
              </span>
            </div>
            {selectedPosts.length > 0 ? selectedPosts.map((p, i) => {
              const key = postKey(p, i);
              const isSelected = key === postKey(selectedPost, selectedPosts.indexOf(selectedPost));
              return (
                <button key={key} onClick={() => setActivePostKey(key)}
                  style={{ display:'grid', gridTemplateColumns:p.thumbnail && !compact ? '76px 1fr' : '1fr', gap:10, width:'100%', padding:'11px 12px', textAlign:'left',
                    background:isSelected ? 'rgba(176,130,47,0.10)' : C.card, border:0, borderBottom:i<selectedPosts.length-1?'1px solid rgba(33,28,23,0.08)':'none', cursor:'pointer', font:'inherit' }}>
                  {p.thumbnail && !compact && (
                    <span style={{ width:76, height:48, borderRadius:3, overflow:'hidden', background:'rgba(33,28,23,0.08)', display:'block' }}>
                      <img src={p.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading="lazy" />
                    </span>
                  )}
                  <span style={{ minWidth:0 }}>
                    <span style={{ display:'block', fontSize:13.5, lineHeight:1.35, color:C.ink }}>{p.text || p.url}</span>
                    <span style={{ display:'block', fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', marginTop:5, textTransform:'uppercase' }}>
                      {[p.username, p.metric, p.likes ? `${fmt(p.likes)} likes` : '', p.comments ? `${fmt(p.comments)} com.` : '', p.shares ? `${fmt(p.shares)} shares` : '', p.bookmarks ? `${fmt(p.bookmarks)} saved` : '', (p.date || '').slice(0,10)].filter(Boolean).join(' - ')}
                    </span>
                  </span>
                </button>
              );
            }) : (
              <div style={{ padding:'12px', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', textTransform:'uppercase' }}>
                No hay publicaciones para esta red.
              </div>
            )}
          </div>

          <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, overflow:'hidden' }}>
            {selectedPost ? (
              t.networkStrategy?.title === 'Redes monitoreadas' || tab !== 'redes_propias' ? (
                <SocialPostPreview post={selectedPost} platform={selectedNetwork} isDesktop={isDesktop} />
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:selectedPost.thumbnail && !compact ? '104px 1fr auto' : '1fr auto', gap:12, padding:12, borderBottom:'1px solid rgba(33,28,23,0.10)', alignItems:'center' }}>
                    {selectedPost.thumbnail && !compact && (
                      <span style={{ width:104, height:64, borderRadius:3, overflow:'hidden', background:'rgba(33,28,23,0.08)', display:'block' }}>
                        <img src={selectedPost.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading="lazy" />
                      </span>
                    )}
                    <span style={{ minWidth:0 }}>
                      <span style={{ display:'block', fontSize:14.5, lineHeight:1.35, color:C.ink }}>{selectedPost.text || selectedPost.url}</span>
                      <span style={{ display:'block', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', marginTop:6, textTransform:'uppercase' }}>
                        {[selectedPost.username, selectedPost.metric, selectedPost.likes ? `${fmt(selectedPost.likes)} likes` : '', selectedPost.comments ? `${fmt(selectedPost.comments)} com.` : '', selectedPost.commentsExtracted ? `${fmt(selectedPost.commentsExtracted)} extraidos` : '', selectedPost.shares ? `${fmt(selectedPost.shares)} shares` : '', selectedPost.bookmarks ? `${fmt(selectedPost.bookmarks)} saved` : '', (selectedPost.date || '').slice(0,10)].filter(Boolean).join(' - ')}
                      </span>
                    </span>
                    {selectedPost.url && <a href={selectedPost.url} target="_blank" rel="noopener" style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:C.goldDeep, fontWeight:700, textDecoration:'none' }}>ABRIR</a>}
                  </div>
                  {(selectedComments.length > 0 || t.networkStrategy?.title !== 'Redes monitoreadas') && (
                  <div style={{ padding:12 }}>
                    <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.goldDeep, marginBottom:8 }}>
                      {selectedComments.length ? `${selectedComments.length} comentarios extraidos` : 'Sin comentarios extraidos'}
                    </div>
                    {selectedComments.length ? selectedComments.slice(0, 12).map(comment => (
                      <a key={comment.id} href={comment.url || undefined} target={comment.url ? '_blank' : undefined} rel={comment.url ? 'noopener' : undefined}
                        style={{ display:'block', marginBottom:8, padding:'9px 10px', background:'rgba(33,28,23,0.035)', border:'1px solid rgba(33,28,23,0.07)', borderRadius:3, textDecoration:'none' }}>
                        <span style={{ display:'block', fontSize:12.8, lineHeight:1.38, color:'#2A241C' }}>{comment.text || '[Sin texto]'}</span>
                        <span style={{ display:'block', marginTop:5, fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', textTransform:'uppercase' }}>
                          {[comment.author, comment.publishedTime, comment.likes ? `${comment.likes} likes` : '', comment.replies ? `${comment.replies} replies` : '', comment.views ? `${comment.views} views` : '', comment.url ? 'abrir comentario' : ''].filter(Boolean).join(' - ')}
                        </span>
                      </a>
                    )) : (
                      <div style={{ padding:'16px 0 4px', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', textTransform:'uppercase' }}>
                        Esta publicacion aun no tiene comentarios raspados en la muestra local.
                      </div>
                    )}
                  </div>
                  )}
                </>
              )
            ) : (
              <div style={{ padding:12, fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', textTransform:'uppercase' }}>Selecciona una publicacion.</div>
            )}
          </div>
        </div>
        );
      })()}

      {false && selectedNetwork && (
        <div style={{ marginTop:10, background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(33,28,23,0.04)', borderBottom:'1px solid rgba(33,28,23,0.10)' }}>
            <PlatformIcon platform={selectedNetwork} size={16} />
            <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.ink }}>
              {networkMapItemLabel === 'PUBLICACIONES' ? 'Publicaciones de' : 'Menciones de'} {platLabel(selectedNetwork)}
            </span>
            <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', marginLeft:'auto' }}>
              {(networkPostsByKey[selectedNetwork] || []).length} {networkMapItemLabel}
            </span>
          </div>
          {t.rawOnly && (
            <div style={{ padding:'9px 12px', borderBottom:'1px solid rgba(33,28,23,0.08)', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', textTransform:'uppercase', background:'rgba(176,130,47,0.06)' }}>
              Comentarios individuales pendientes; aqui se muestran publicaciones y conteos que trajo cada post.
            </div>
          )}
          {(networkPostsByKey[selectedNetwork] || []).length > 0 ? (
            (networkPostsByKey[selectedNetwork] || []).map((p, i) => {
              const Tag = p.url ? 'a' : 'div';
              return (
              <Tag key={`${p.url || p.username}-${i}`} href={p.url || undefined} target={p.url ? '_blank' : undefined} rel={p.url ? 'noopener' : undefined}
                style={{ display:'grid', gridTemplateColumns:p.thumbnail && !compact ? '96px 1fr auto' : p.url ? '1fr auto' : '1fr', gap:12, alignItems:'center', padding:'12px',
                  textDecoration:'none', borderBottom:i<(networkPostsByKey[selectedNetwork] || []).length-1?'1px solid rgba(33,28,23,0.08)':'none' }}>
                {p.thumbnail && !compact && (
                  <span style={{ width:96, height:54, borderRadius:3, overflow:'hidden', background:'rgba(33,28,23,0.08)', display:'block' }}>
                    <img src={p.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading="lazy" />
                  </span>
                )}
                <span style={{ minWidth:0, display:'block' }}>
                  <span style={{ display:'block', fontSize:14, lineHeight:1.35, color:C.ink, whiteSpace:compact ? 'nowrap' : 'normal', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {p.text || p.username || p.url}
                  </span>
                  <span style={{ display:'block', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', marginTop:6, textTransform:'uppercase', lineHeight:1.45 }}>
                    {[p.username, p.metric, p.sourceUrl ? 'URL sin verificar' : '', (p.date || '').slice(0,10)].filter(Boolean).join(' - ')}
                  </span>
                  {(p.commentsList || []).length > 0 && (
                    <span style={{ display:'block', marginTop:10, paddingTop:9, borderTop:'1px solid rgba(33,28,23,0.08)' }}>
                      <span style={{ display:'block', fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:C.goldDeep, marginBottom:7 }}>
                        {p.commentsList.length} comentarios extraidos
                      </span>
                      {(p.commentsList || []).slice(0, 12).map(comment => (
                        <span key={comment.id} style={{ display:'block', marginBottom:8, padding:'8px 9px', background:'rgba(33,28,23,0.035)', border:'1px solid rgba(33,28,23,0.07)', borderRadius:3 }}>
                          <span style={{ display:'block', fontSize:12.5, lineHeight:1.35, color:'#2A241C' }}>{comment.text}</span>
                          <span style={{ display:'block', marginTop:5, fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', textTransform:'uppercase' }}>
                            {[comment.author, comment.publishedTime, comment.likes ? `${comment.likes} likes` : '', comment.replies ? `${comment.replies} replies` : '', comment.views ? `${comment.views} views` : '', comment.url ? 'link' : ''].filter(Boolean).join(' - ')}
                          </span>
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                {p.url && <span style={{ alignSelf:'center', justifySelf:'end', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:C.goldDeep, fontWeight:600 }}>ABRIR</span>}
              </Tag>
              );
            })
          ) : (
            <div style={{ padding:'12px', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', textTransform:'uppercase' }}>
              No hay menciones individuales para esta red.
            </div>
          )}
        </div>
      )}

      {strategyAllies.length>0 && (
        <div style={{ marginTop:10, background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns: compact ? '1.1fr 0.8fr 0.6fr' : isDesktop ? '1.2fr 0.8fr 0.7fr 0.7fr 0.55fr' : '1.1fr 0.8fr 0.6fr', gap:8,
            padding:'9px 12px', background:'rgba(33,28,23,0.04)', borderBottom:'1px solid rgba(33,28,23,0.10)' }}>
            {['Voz posible','Red','Tamaño', ...(!compact && isDesktop ? ['Views','Tipo'] : [])].map(h => (
              <span key={h} style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8A7E6A' }}>{h}</span>
            ))}
          </div>
          {strategyAllies.slice(0, compact ? 4 : strategyAllies.length).map((a,i) => {
            const Tag = a.hasLink ? 'a' : 'div';
            return (
            <Tag key={`${a.platform}-${a.username}-${i}`} href={a.hasLink ? a.url : undefined} target={a.hasLink ? '_blank' : undefined} rel={a.hasLink ? 'noopener' : undefined}
              style={{ display:'grid', gridTemplateColumns: compact ? '1.1fr 0.8fr 0.6fr' : isDesktop ? '1.2fr 0.8fr 0.7fr 0.7fr 0.55fr' : '1.1fr 0.8fr 0.6fr', gap:8,
                alignItems:'center', padding:'10px 12px', textDecoration:'none', borderBottom:i<Math.min(strategyAllies.length, compact ? 4 : strategyAllies.length)-1?'1px solid rgba(33,28,23,0.08)':'none' }}>
              <span style={{ minWidth:0 }}>
                <span style={{ display:'block', fontWeight:600, fontSize:13, color:C.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.username}</span>
                {a.followersLabel && <span style={{ display:'block', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', marginTop:2 }}>{a.followersLabel}</span>}
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:7, fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#6B6253', textTransform:'uppercase' }}>
                <PlatformIcon platform={a.platform} size={16} />
                {a.platformLabel}
              </span>
              <span style={{ ...pill(a.tier === 'macro' ? C.crim : a.tier === 'medio' ? C.goldDeep : C.teal, a.tier === 'macro' ? C.crimBg : a.tier === 'medio' ? C.amberBg : C.tealBg, a.tier === 'macro' ? C.crimBd : a.tier === 'medio' ? C.amberBd : C.tealBd) }}>{a.tierLabel}</span>
              {!compact && isDesktop && <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#6B6253' }}>{a.viewsLabel}</span>}
              {!compact && isDesktop && a.hasLink && <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600 }}>ABRIR</span>}
            </Tag>
            );
          })}
        </div>
      )}
    </Section>
  );

  return (
    <motion.div key={tab} variants={stagger} initial="hidden" animate="visible">

      {/* Calendar summary banner */}
      {calendarSummary && (
        <motion.div variants={item} style={{ margin: isDesktop ? '16px 28px 0' : '14px 18px 0',
          background:'rgba(176,130,47,0.10)', border:'1px solid rgba(176,130,47,0.35)',
          borderRadius:3, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:14, flex:'none' }}>[cal]</span>
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
          textTransform:'uppercase', color:C.gold, fontWeight:600 }}>{t.rawOnly ? 'Vista' : 'Tema'} · {t.label}</div>
        <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:33, lineHeight:1.02,
          letterSpacing:'-0.025em', color:C.ink, margin:'7px 0 5px' }}>
          {t.label}<em style={{ fontStyle:'normal', color:C.goldDeep }}>.</em>
        </h1>
        <p style={{ fontSize:14, color:'#6B6253', margin:0 }}>{t.es}</p>
      </motion.div>

      {/* Desktop 2-column: Sentiment + Alertómetro | Oportunidades + Pros/contras */}
      {t.sourceMeta && !t.rawOnly && (
        <motion.div variants={item} style={{ padding:isDesktop ? '8px 28px 4px' : '8px 18px 4px' }}>
          <div style={{ background:'rgba(33,28,23,0.04)', border:'1px solid rgba(33,28,23,0.10)', borderRadius:3, padding:'11px 13px' }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 14px', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.goldDeep, fontWeight:600 }}>{t.sourceMeta.mode}</span>
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#6B6253' }}>{t.sourceMeta.dateWindow}</span>
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#6B6253' }}>{t.sourceMeta.query}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:isDesktop ? '1fr 1fr' : '1fr', gap:8 }}>
              {(t.sourceMeta.actors||[]).map(actor => (
                <div key={actor.name} style={{ background:C.card, border:'1px solid rgba(33,28,23,0.10)', borderRadius:3, padding:'9px 10px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <PlatformIcon platform={actor.platform} size={16} />
                    <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, fontWeight:600, color:C.ink }}>{actor.name}</span>
                  </div>
                  <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', marginTop:5, textTransform:'uppercase' }}>
                    {[actor.status, actor.cost].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize:12, color:'#2A241C', marginTop:6, lineHeight:1.35 }}>
                    Datos: {(actor.fields||[]).join(', ')}
                  </div>
                  {(actor.missing||[]).length>0 && (
                    <div style={{ fontSize:12, color:'#8A7E6A', marginTop:3, lineHeight:1.35 }}>
                      No viene: {actor.missing.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {(t.sourceMeta.profiles||[]).length > 0 && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid rgba(33,28,23,0.10)' }}>
                <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8A7E6A', marginBottom:7 }}>
                  Perfiles oficiales configurados
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {t.sourceMeta.profiles.map(profile => (
                    <a key={profile.platform} href={profile.url} target="_blank" rel="noopener"
                      style={{ display:'inline-flex', alignItems:'center', gap:7, textDecoration:'none',
                        background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:'7px 9px' }}>
                      <PlatformIcon platform={profile.platform} size={16} />
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:C.ink, fontWeight:600, textTransform:'uppercase' }}>
                        {profile.label}
                      </span>
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A' }}>
                        @{profile.handle}
                      </span>
                      {profile.audienceLabel && (
                        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A' }}>
                          {profile.audienceLabel}
                        </span>
                      )}
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:C.goldDeep, textTransform:'uppercase' }}>
                        {profile.postsStatus}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {t.rawOnly ? (
        <div style={{ paddingBottom:24 }}>
          {renderNetworkMap(false)}
          {(voices.allies.length > 0 || voices.critics.length > 0) && (() => {
            const VoiceCard = ({ v, side }) => {
              const isAlly = side === 'ally';
              const accentColor = isAlly ? C.teal : C.crim;
              const Tag = v.url ? 'a' : 'div';
              const tierLabel = v.tier === 'macro' ? 'Macro' : v.tier === 'medio' ? 'Medio' : 'Micro';
              const tierInk = v.tier === 'macro' ? C.crim : v.tier === 'medio' ? C.goldDeep : C.teal;
              const tierBg = v.tier === 'macro' ? C.crimBg : v.tier === 'medio' ? C.amberBg : C.tealBg;
              const tierBd = v.tier === 'macro' ? C.crimBd : v.tier === 'medio' ? C.amberBd : C.tealBd;
              return (
                <Tag href={v.url || undefined} target={v.url ? '_blank' : undefined} rel={v.url ? 'noopener' : undefined}
                  style={{ display:'block', padding:'11px 13px', textDecoration:'none',
                    borderLeft:`3px solid ${accentColor}`, background:C.card,
                    border:`1px solid rgba(33,28,23,0.10)`, borderLeftWidth:3, borderLeftColor:accentColor,
                    borderRadius:3, marginBottom:7 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                    <PlatformIcon platform={v.platform} size={15} />
                    <span style={{ fontWeight:600, fontSize:13.5, color:C.ink, flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.username}</span>
                    <span style={{ ...pill(tierInk, tierBg, tierBd), flexShrink:0 }}>{tierLabel}</span>
                  </div>
                  <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', textTransform:'uppercase' }}>
                    {[v.followers ? `${fmtK(v.followers)} seg.` : '', v.posts ? `${v.posts} posts` : '', v.categoria].filter(Boolean).join(' · ')}
                  </div>
                </Tag>
              );
            };
            return (
              <Section title="Aliados y contrarios" px={sectionPx}>
                <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap:12 }}>
                  {voices.allies.length > 0 && (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <span style={{ width:10, height:10, borderRadius:'50%', background:C.teal, display:'inline-block', flexShrink:0 }} />
                        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.teal, fontWeight:700 }}>Aliados · {voices.allies.length}</span>
                      </div>
                      {voices.allies.map((v,i) => <VoiceCard key={`ally-${i}`} v={v} side="ally" />)}
                    </div>
                  )}
                  {voices.critics.length > 0 && (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <span style={{ width:10, height:10, borderRadius:'50%', background:C.crim, display:'inline-block', flexShrink:0 }} />
                        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.crim, fontWeight:700 }}>Contrarios · {voices.critics.length}</span>
                      </div>
                      {voices.critics.map((v,i) => <VoiceCard key={`critic-${i}`} v={v} side="critic" />)}
                    </div>
                  )}
                </div>
              </Section>
            );
          })()}
        </div>
      ) : isDesktop ? (
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
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600, marginLeft:'auto' }}>ABRIR</span>
                    </div>
                  </a>
                </TiltCard>
              ))}
            </motion.div>
          </div>
          {/* Right col */}
          <div style={{ paddingLeft:14 }}>
            {renderNetworkMap(true)}

            {/* Aliados y contrarios */}
            {(voices.allies.length > 0 || voices.critics.length > 0) && (() => {
              const VoiceCard = ({ v, side }) => {
                const isAlly = side === 'ally';
                const accentColor = isAlly ? C.teal : C.crim;
                const Tag = v.url ? 'a' : 'div';
                const tierLabel = v.tier === 'macro' ? 'Macro' : v.tier === 'medio' ? 'Medio' : 'Micro';
                const tierInk = v.tier === 'macro' ? C.crim : v.tier === 'medio' ? C.goldDeep : C.teal;
                const tierBg = v.tier === 'macro' ? C.crimBg : v.tier === 'medio' ? C.amberBg : C.tealBg;
                const tierBd = v.tier === 'macro' ? C.crimBd : v.tier === 'medio' ? C.amberBd : C.tealBd;
                return (
                  <Tag href={v.url || undefined} target={v.url ? '_blank' : undefined} rel={v.url ? 'noopener' : undefined}
                    style={{ display:'block', padding:'11px 13px', textDecoration:'none',
                      background:C.card, borderRadius:3, marginBottom:7,
                      border:`1px solid rgba(33,28,23,0.10)`, borderLeftWidth:3, borderLeftColor:accentColor, borderLeftStyle:'solid' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                      <PlatformIcon platform={v.platform} size={15} />
                      <span style={{ fontWeight:600, fontSize:13.5, color:C.ink, flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.username}</span>
                      <span style={{ ...pill(tierInk, tierBg, tierBd), flexShrink:0 }}>{tierLabel}</span>
                    </div>
                    <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', textTransform:'uppercase' }}>
                      {[v.followers ? `${fmtK(v.followers)} seg.` : '', v.posts ? `${v.posts} posts` : '', v.categoria].filter(Boolean).join(' · ')}
                    </div>
                  </Tag>
                );
              };
              return (
                <motion.div variants={item} style={{ paddingTop:16, paddingBottom:6 }}>
                  <h2 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:22, letterSpacing:'-0.015em', color:C.ink, margin:'0 0 11px' }}>Aliados y contrarios</h2>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    {voices.allies.length > 0 && (
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                          <span style={{ width:10, height:10, borderRadius:'50%', background:C.teal, display:'inline-block', flexShrink:0 }} />
                          <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.teal, fontWeight:700 }}>Aliados · {voices.allies.length}</span>
                        </div>
                        {voices.allies.map((v,i) => <VoiceCard key={`ally-${i}`} v={v} side="ally" />)}
                      </div>
                    )}
                    {voices.critics.length > 0 && (
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                          <span style={{ width:10, height:10, borderRadius:'50%', background:C.crim, display:'inline-block', flexShrink:0 }} />
                          <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.crim, fontWeight:700 }}>Contrarios · {voices.critics.length}</span>
                        </div>
                        {voices.critics.map((v,i) => <VoiceCard key={`critic-${i}`} v={v} side="critic" />)}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })()}

            {/* Oportunidades */}
            {(op.recomendacion||opPosts.length>0) && (
              <motion.div variants={item} style={{ paddingTop:16, paddingBottom:6 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }}>
                  <h2 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:22,
                    letterSpacing:'-0.015em', color:C.ink, margin:0 }}>Oportunidades</h2>
                  <span style={{ ...pill(C.teal,C.tealBg,C.tealBd) }}>Nivel {cap(op.nivel||'-')}</span>
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
                        <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600, marginLeft:'auto' }}>ABRIR</span>
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
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600, marginLeft:'auto' }}>ABRIR</span>
              </div>
            </a>
          </TiltCard>
        ))}
      </Section>

      {/* Oportunidades */}
      {(op.recomendacion||opPosts.length>0) && (
        <Section title="Oportunidades" right={<span style={{ ...pill(C.teal,C.tealBg,C.tealBd) }}>Nivel {cap(op.nivel||'-')}</span>}>
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
                  <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600, marginLeft:'auto' }}>ABRIR</span>
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

      {/* Aliados y contrarios (mobile / non-rawOnly) */}
      {!t.rawOnly && (voices.allies.length > 0 || voices.critics.length > 0) && (() => {
        const VoiceCard = ({ v, side }) => {
          const isAlly = side === 'ally';
          const accentColor = isAlly ? C.teal : C.crim;
          const Tag = v.url ? 'a' : 'div';
          const tierLabel = v.tier === 'macro' ? 'Macro' : v.tier === 'medio' ? 'Medio' : 'Micro';
          const tierInk = v.tier === 'macro' ? C.crim : v.tier === 'medio' ? C.goldDeep : C.teal;
          const tierBg = v.tier === 'macro' ? C.crimBg : v.tier === 'medio' ? C.amberBg : C.tealBg;
          const tierBd = v.tier === 'macro' ? C.crimBd : v.tier === 'medio' ? C.amberBd : C.tealBd;
          return (
            <Tag href={v.url || undefined} target={v.url ? '_blank' : undefined} rel={v.url ? 'noopener' : undefined}
              style={{ display:'block', padding:'11px 13px', textDecoration:'none', background:C.card,
                borderRadius:3, marginBottom:7, border:`1px solid rgba(33,28,23,0.10)`,
                borderLeftWidth:3, borderLeftColor:accentColor, borderLeftStyle:'solid' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                <PlatformIcon platform={v.platform} size={15} />
                <span style={{ fontWeight:600, fontSize:13.5, color:C.ink, flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.username}</span>
                <span style={{ ...pill(tierInk, tierBg, tierBd), flexShrink:0 }}>{tierLabel}</span>
              </div>
              <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', textTransform:'uppercase' }}>
                {[v.followers ? `${fmtK(v.followers)} seg.` : '', v.posts ? `${v.posts} posts` : '', v.categoria].filter(Boolean).join(' · ')}
              </div>
            </Tag>
          );
        };
        return (
          <Section title="Aliados y contrarios" px={sectionPx}>
            <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap:12 }}>
              {voices.allies.length > 0 && (
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:C.teal, display:'inline-block', flexShrink:0 }} />
                    <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.teal, fontWeight:700 }}>Aliados · {voices.allies.length}</span>
                  </div>
                  {voices.allies.map((v,i) => <VoiceCard key={`ally-${i}`} v={v} side="ally" />)}
                </div>
              )}
              {voices.critics.length > 0 && (
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:C.crim, display:'inline-block', flexShrink:0 }} />
                    <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.crim, fontWeight:700 }}>Contrarios · {voices.critics.length}</span>
                  </div>
                  {voices.critics.map((v,i) => <VoiceCard key={`critic-${i}`} v={v} side="critic" />)}
                </div>
              )}
            </div>
          </Section>
        );
      })()}

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
                    {it.hasLink && <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' }}>{it.sourceLabel}</span>}
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
                      <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600, textTransform:'uppercase' }}>{n.fuente} · {n.fecha}</span>
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
                <span style={{ fontSize:11, color:C.crim }}>{tr.negPct}%-</span>
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
                <span style={{ fontFamily:"'Geist Mono',monospace", color:C.goldDeep, fontSize:11, fontWeight:600 }}>ABRIR</span>
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
      {!isDesktop && strategyNetworks.length>0 && (
        <Section title="Mapa por red y aliados" px={sectionPx} right={<span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:'#8A7E6A' }}>{fmt(networkStrategy.totalPosts||0)} MENCIONES</span>}>
          {false && networkStrategy.fallback && (
            <div style={{ background:'rgba(176,130,47,0.08)', border:'1px solid rgba(176,130,47,0.22)', borderRadius:3,
              padding:'9px 12px', marginBottom:9, fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A',
              letterSpacing:'0.04em', textTransform:'uppercase' }}>
              Histórico reconstruido con desglose guardado · para temas/hashtags y views exactos se necesita `all_platforms_data`
            </div>
          )}
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
              {strategyAllies.map((a,i) => {
                const Tag = a.hasLink ? 'a' : 'div';
                return (
                <Tag key={`${a.platform}-${a.username}-${i}`} href={a.hasLink ? a.url : undefined} target={a.hasLink ? '_blank' : undefined} rel={a.hasLink ? 'noopener' : undefined}
                  style={{ display:'grid', gridTemplateColumns: isDesktop ? '1.2fr 0.8fr 0.7fr 0.7fr 0.55fr' : '1.1fr 0.8fr 0.6fr', gap:8,
                    alignItems:'center', padding:'10px 12px', textDecoration:'none', borderBottom:i<strategyAllies.length-1?'1px solid rgba(33,28,23,0.08)':'none' }}>
                  <span style={{ minWidth:0 }}>
                    <span style={{ display:'block', fontWeight:600, fontSize:13, color:C.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.username}</span>
                    {a.followersLabel && <span style={{ display:'block', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', marginTop:2 }}>{a.followersLabel}</span>}
                  </span>
                  <span style={{ display:'flex', alignItems:'center', gap:7, fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#6B6253', textTransform:'uppercase' }}>
                    <PlatformIcon platform={a.platform} size={16} />
                    {a.platformLabel}
                  </span>
                  <span style={{ ...pill(a.tier === 'macro' ? C.crim : a.tier === 'medio' ? C.goldDeep : C.teal, a.tier === 'macro' ? C.crimBg : a.tier === 'medio' ? C.amberBg : C.tealBg, a.tier === 'macro' ? C.crimBd : a.tier === 'medio' ? C.amberBd : C.tealBd) }}>{a.tierLabel}</span>
                  {isDesktop && <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#6B6253' }}>{a.viewsLabel}</span>}
                  {isDesktop && a.hasLink && <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:C.goldDeep, fontWeight:600 }}>ABRIR</span>}
                </Tag>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* Desglose por red */}
      {!t.rawOnly && pls.length>0 && (
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
                <span style={{ fontSize:11, color:C.crim }}>{p.pn}%-</span>
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

function SocialPostPreview({ post, platform, isDesktop }) {
  if (!post) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.slice(0, 10);
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr.slice(0, 10);
    }
  };

  const getInitials = (username) => {
    return String(username || 'U').slice(0, 2).toUpperCase();
  };

  const renderContent = () => {
    switch (platform) {
      case 'instagram':
        return (
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #DBDBDB',
            borderRadius: 8,
            overflow: 'hidden',
            color: '#262626',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            maxWidth: 450,
            margin: '16px auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px'
              }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%', background: '#FFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 'bold', color: '#262626'
                }}>
                  {getInitials(post.username)}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{post.username || 'instagram_user'}</span>
                  <VerifiedIcon />
                </div>
                <span style={{ fontSize: 11, color: '#8e8e8e' }}>{formatDate(post.date)}</span>
              </div>
            </div>

            <div style={{ width: '100%', background: '#F8F9FA', position: 'relative', overflow: 'hidden' }}>
              {post.thumbnail ? (
                <img src={post.thumbnail} alt="" style={{ width: '100%', height: 'auto', maxHeight: 300, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{
                  height: 200,
                  background: 'linear-gradient(45deg, #f58529, #dd2a7b, #8134af, #515bd4)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  color: '#FFFFFF', padding: 20, textAlign: 'center'
                }}>
                  <PlatformIcon platform="instagram" size={48} />
                  <span style={{ marginTop: 12, fontSize: 13, opacity: 0.95, fontFamily: "'Geist Mono', monospace" }}>Instagram Post</span>
                </div>
              )}
            </div>

            <div style={{ padding: '10px 14px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <span style={{ color: '#ed4956', cursor: 'pointer' }}><HeartFilledIcon /></span>
                  <span style={{ color: '#262626' }}><CommentIcon /></span>
                  <span style={{ color: '#262626' }}><SendIcon /></span>
                </div>
                <span style={{ color: '#262626' }}><BookmarkIcon /></span>
              </div>

              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>
                {post.likes ? `${fmt(post.likes)} Me gusta` : '1 Me gusta'}
              </div>

              <div style={{ fontSize: 13.5, lineHeight: 1.4, wordBreak: 'break-word', maxHeight: 110, overflowY: 'auto' }}>
                <span style={{ fontWeight: 600, marginRight: 6 }}>{post.username}</span>
                {post.text || 'Sin texto.'}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #EFEFEF', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#8e8e8e', textTransform: 'uppercase', fontFamily: "'Geist Mono', monospace" }}>Enlace original</span>
              {post.url ? (
                <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#0095f6', fontWeight: 600, fontSize: 13 }}>
                  Ver en Instagram
                </a>
              ) : (
                <span style={{ fontSize: 12, color: '#8e8e8e' }}>No disponible</span>
              )}
            </div>
          </div>
        );

      case 'x':
        return (
          <div style={{
            background: '#000000',
            border: '1px solid #2F3336',
            borderRadius: 12,
            padding: 16,
            color: '#E7E9EA',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            maxWidth: 450,
            margin: '16px auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: '#333',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: 14, color: '#FFF'
              }}>
                {getInitials(post.username)}
              </div>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#F7F9F9' }}>{post.username || 'x_user'}</span>
                  <VerifiedIcon />
                </div>
                <span style={{ fontSize: 13, color: '#71767B' }}>@{String(post.username || 'user').toLowerCase()}</span>
              </div>
              <span style={{ fontSize: 13, color: '#71767B', alignSelf: 'flex-start' }}>{formatDate(post.date)}</span>
            </div>

            <div style={{ fontSize: 15, lineHeight: 1.45, marginBottom: 12, whiteSpace: 'pre-wrap', color: '#E7E9EA' }}>
              {post.text || 'Sin texto en la publicación.'}
            </div>

            {post.thumbnail && (
              <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #2F3336', marginBottom: 12, background: '#15181C' }}>
                <img src={post.thumbnail} alt="" style={{ width: '100%', maxHeight: 250, objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            <div style={{
              display: 'flex', justifyContent: 'space-between', maxWidth: 350, margin: '8px 0 0',
              borderTop: '1px solid #2F3336', paddingTop: 10, color: '#71767B', fontSize: 13
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><XReplyIcon /> {post.comments ? fmt(post.comments) : '0'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><XRetweetIcon /> {post.retweets ? fmt(post.retweets) : '0'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: post.likes ? '#F91880' : 'inherit' }}><XLikeIcon /> {post.likes ? fmt(post.likes) : '1'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><XShareIcon /></span>
            </div>

            <div style={{ borderTop: '1px solid #2F3336', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#71767B', textTransform: 'uppercase', fontFamily: "'Geist Mono', monospace" }}>Publicación en X</span>
              {post.url ? (
                <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#1D9BF0', fontWeight: 600, fontSize: 13 }}>
                  Ver en X.com
                </a>
              ) : (
                <span style={{ fontSize: 12, color: '#71767B' }}>No disponible</span>
              )}
            </div>
          </div>
        );

      case 'tiktok':
        return (
          <div style={{
            background: '#121212',
            border: '1px solid #2F2F2F',
            borderRadius: 12,
            padding: 16,
            color: '#FFFFFF',
            fontFamily: 'SFProText-Regular, Tahoma, Geneva, sans-serif',
            maxWidth: 450,
            margin: '16px auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: '#2F2F2F', border: '1.5px solid #FE2C55',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: 13
              }}>
                {getInitials(post.username)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{post.username || 'tiktok_user'}</div>
                <span style={{ fontSize: 11, color: '#A0A0A0' }}>{formatDate(post.date)}</span>
              </div>
              <div style={{
                padding: '4px 12px', background: '#FE2C55', color: '#FFF', borderRadius: 4,
                fontSize: 12, fontWeight: 600, fontFamily: "'Geist Mono', monospace"
              }}>TIKTOK</div>
            </div>

            <div style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 12, color: '#E1E1E1' }}>
              {post.text || 'Sin descripción.'}
            </div>

            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#000', marginBottom: 12 }}>
              {post.thumbnail ? (
                <img src={post.thumbnail} alt="" style={{ width: '100%', maxHeight: 250, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{
                  height: 180,
                  background: 'linear-gradient(135deg, #121212 0%, #252525 100%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: 20, border: '1px dashed #FE2C55', borderRadius: 8
                }}>
                  <PlatformIcon platform="tiktok" size={40} />
                  <span style={{ marginTop: 10, fontSize: 12, color: '#A0A0A0' }}>Video de TikTok</span>
                </div>
              )}
              {post.metric && (
                <div style={{
                  position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.6)',
                  padding: '3px 8px', borderRadius: 4, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <span>▶</span> {post.metric}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 16, fontSize: 12.5, color: '#A0A0A0', borderBottom: '1px solid #2F2F2F', paddingBottom: 10 }}>
              <span>❤️ <strong>{post.likes ? fmt(post.likes) : '0'}</strong> Likes</span>
              <span>💬 <strong>{post.comments ? fmt(post.comments) : '0'}</strong> Comentarios</span>
            </div>

            <div style={{ paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#A0A0A0', textTransform: 'uppercase', fontFamily: "'Geist Mono', monospace" }}>Ver original</span>
              {post.url ? (
                <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#25F4EE', fontWeight: 600, fontSize: 13 }}>
                  Ver en TikTok
                </a>
              ) : (
                <span style={{ fontSize: 12, color: '#A0A0A0' }}>No disponible</span>
              )}
            </div>
          </div>
        );

      case 'facebook':
        return (
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E5E5',
            borderRadius: 8,
            padding: 14,
            color: '#1C1E21',
            fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif',
            maxWidth: 450,
            margin: '16px auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#F0F2F5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: 13, color: '#1877F2', border: '1px solid #E5E5E5'
              }}>
                {getInitials(post.username)}
              </div>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1C1E21' }}>{post.username || 'facebook_user'}</span>
                  <VerifiedIcon />
                </div>
                <span style={{ fontSize: 12, color: '#65676B' }}>{formatDate(post.date)} · 🌐</span>
              </div>
            </div>

            <div style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 10, color: '#1C1E21' }}>
              {post.text || 'Sin texto.'}
            </div>

            {post.thumbnail && (
              <div style={{ margin: '0 -14px 10px -14px', borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', background: '#F0F2F5' }}>
                <img src={post.thumbnail} alt="" style={{ width: '100%', maxHeight: 250, objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#65676B', paddingBottom: 10, borderBottom: '1px solid #E5E5E5' }}>
              <span>👍❤️ {post.likes ? fmt(post.likes) : '0'} reacciones</span>
              <span>{post.comments ? `${fmt(post.comments)} comentarios` : ''}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-around', margin: '4px 0 -4px', padding: '4px 0 0', color: '#65676B', fontWeight: 600, fontSize: 13 }}>
              <span style={{ cursor: 'pointer' }}>👍 Me gusta</span>
              <span style={{ cursor: 'pointer' }}>💬 Comentar</span>
              <span style={{ cursor: 'pointer' }}>↪️ Compartir</span>
            </div>

            <div style={{ borderTop: '1px solid #E5E5E5', marginTop: 12, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#65676B', textTransform: 'uppercase', fontFamily: "'Geist Mono', monospace" }}>Publicación de Facebook</span>
              {post.url ? (
                <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#1877F2', fontWeight: 600, fontSize: 13 }}>
                  Ver en Facebook
                </a>
              ) : (
                <span style={{ fontSize: 12, color: '#65676B' }}>No disponible</span>
              )}
            </div>
          </div>
        );

      case 'google_news':
      default:
        return (
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #DADCE0',
            borderRadius: 8,
            padding: 16,
            color: '#202124',
            fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
            maxWidth: 450,
            margin: '16px auto',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, borderBottom: '1px solid #F1F3F4', paddingBottom: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>G</div>
              <span style={{ fontSize: 12, color: '#5f6368', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'Geist Mono', monospace" }}>Google News</span>
              <span style={{ fontSize: 11, color: '#70757a', marginLeft: 'auto' }}>{formatDate(post.date)}</span>
            </div>

            <div style={{ fontSize: 13, color: '#1a73e8', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>
              {post.username || 'Prensa'}
            </div>

            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35, marginBottom: 12 }}>
              {post.url ? (
                <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1a0dab', textDecoration: 'none' }}>
                  {post.text || 'Sin título.'}
                </a>
              ) : (
                <span style={{ color: '#202124' }}>{post.text || 'Sin título.'}</span>
              )}
            </div>

            {post.thumbnail && (
              <div style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
                <img src={post.thumbnail} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              {post.url ? (
                <a href={post.url} target="_blank" rel="noopener noreferrer"
                  style={{
                    textDecoration: 'none', background: '#1a73e8', color: '#FFFFFF',
                    padding: '8px 16px', borderRadius: 4, fontSize: 13, fontWeight: 500,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)', display: 'inline-block'
                  }}>
                  Leer noticia completa
                </a>
              ) : (
                <span style={{ fontSize: 12, color: '#70757a' }}>Enlace no disponible</span>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
      <div style={{
        fontFamily: "'Geist Mono', monospace", fontSize: 9.5, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: '#8A7E6A', marginBottom: 10, textAlign: 'center'
      }}>
        Vista Previa de Publicación
      </div>
      {renderContent()}
    </div>
  );
}

function VerifiedIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="#1d9bf0" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.99-3.818-3.99-.48 0-.94.1-1.348.27C14.825 2.515 13.512 1.5 12 1.5s-2.825 1.015-3.422 2.28c-.407-.17-.867-.27-1.348-.27-2.108 0-3.818 1.78-3.818 3.99 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.71 3.99 3.818 3.99.48 0 .94-.1 1.348-.27.597 1.265 1.91 2.27 3.422 2.27s2.825-1.005 3.422-2.27c.407.17.867.27 1.348.27 2.108 0 3.818-1.78 3.818-3.99 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6zm-12.72 3.28l-3.29-3.28 1.41-1.42 1.88 1.88 5.18-5.17 1.42 1.41-6.6 6.58z"/>
    </svg>
  );
}

function HeartFilledIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function XReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M1.75 1.75h20.5c.966 0 1.75.784 1.75 1.75v12.5c0 .966-.784 1.75-1.75 1.75h-4.32l-5.68 5.68-5.68-5.68H1.75C.784 17.75 0 16.966 0 16V3.5c0-.966.784-1.75 1.75-1.75zm0 1.5c-.138 0-.25.112-.25.25v12.5c0 .138.112.25.25.25h5.18l4.07 4.07 4.07-4.07h5.18c.138 0 .25-.112.25-.25V3.5c0-.138-.112-.25-.25-.25H1.75z"/>
    </svg>
  );
}

function XRetweetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M4.5 3.75h15c1.24 0 2.25 1.01 2.25 2.25v3c0 .41-.34.75-.75.75s-.75-.34-.75-.75v-3c0-.41-.34-.75-.75-.75h-15c-.41 0-.75.34-.75.75v3c0 .41-.34.75-.75.75s-.75-.34-.75-.75v-3c0-1.24 1.01-2.25 2.25-2.25zm15 16.5h-15c-1.24 0-2.25-1.01-2.25-2.25v-3c0-.41.34-.75.75-.75s.75.34.75.75v3c0 .41.34.75.75.75h15c.41 0 .75-.34.75-.75v-3c0-.41-.34-.75-.75-.75s-.75.34-.75.75v3c0 1.24-1.01 2.25-2.25 2.25z"/>
    </svg>
  );
}

function XLikeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.814-1.148 2.354-2.73 4.645-2.73 2.88 0 5.404 2.69 5.404 5.755 0 6.376-7.454 13.11-10.037 13.157H12z"/>
    </svg>
  );
}

function XShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M12 2.59l5.7 5.7-1.41 1.42-3.29-3.29V16.5h-2V6.42L7.71 9.71 6.3 8.29 12 2.59zm-7.25 15h14.5v1.5H4.75v-1.5z"/>
    </svg>
  );
}



