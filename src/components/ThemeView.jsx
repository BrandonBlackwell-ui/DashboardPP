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
  if (themeData.voices?.allies?.length || themeData.voices?.critics?.length) {
    return {
      allies: themeData.voices.allies || [],
      critics: themeData.voices.critics || []
    };
  }
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
      authorMap[key] = { 
        username: p.username, 
        platform: p.platform, 
        followers: p.followers || 0, 
        posts: 0, 
        engagement: 0, 
        likes: 0, 
        comments: 0, 
        toneVotes: { positive: 0, neutral: 0, negative: 0 }, 
        postTexts: [], 
        url: p.url || '' 
      };
    }
    const a = authorMap[key];
    a.posts++;
    a.engagement += eng;
    a.likes += p.likes || 0;
    a.comments += p.comments || 0;
    a.followers = Math.max(a.followers, p.followers || 0);
    a.toneVotes[tone]++;
    if (p.text) a.postTexts.push(p.text);
    if (p.url && !a.url) a.url = p.url;
  });

  const voices = Object.values(authorMap).map(a => {
    const followers = a.followers;
    const tv = a.toneVotes;
    const dominant = tv.negative > tv.positive && tv.negative >= tv.neutral ? 'negative'
                   : tv.positive > tv.negative && tv.positive >= tv.neutral ? 'positive'
                   : 'neutral';

    // Find triggers
    const allText = a.postTexts.join(' ');
    const matchedPos = POS_KW.filter(kw => allText.toLowerCase().includes(kw));
    const matchedNeg = NEG_KW.filter(kw => allText.toLowerCase().includes(kw));
    const keywordsUsed = dominant === 'negative' ? matchedNeg : matchedPos;

    return {
      username: a.username,
      platform: a.platform,
      followers,
      url: a.url,
      posts: a.posts,
      engagement: Math.round(a.engagement),
      likes: a.likes,
      comments: a.comments,
      sentiment: dominant,
      tier: followers >= 500000 ? 'macro' : followers >= 50000 ? 'medio' : 'micro',
      score: a.engagement, // Sort purely by engagement/reach
      keywords: keywordsUsed.slice(0, 4)
    };
  }).sort((a, b) => b.score - a.score);

  return {
    allies: voices.filter(v => v.sentiment !== 'negative').slice(0, 10),
    critics: voices.filter(v => v.sentiment === 'negative').slice(0, 10),
  };
}

function formatSpanishDate(dateStr) {
  if (!dateStr) return '';
  try {
    const cleanStr = dateStr.replace('T', ' ');
    const parts = cleanStr.split(' ');
    const datePart = parts[0]; // YYYY-MM-DD
    const timePart = parts[1]; // HH:MM:SS
    
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})/.exec(datePart);
    if (dateRegex) {
      const year = dateRegex[1];
      const monthIndex = parseInt(dateRegex[2], 10) - 1;
      const day = parseInt(dateRegex[3], 10);
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const monthName = months[monthIndex] || '';
      
      let timeStr = '';
      if (timePart) {
        const timeRegex = /^(\d{2}):(\d{2})/.exec(timePart);
        if (timeRegex) {
          timeStr = ` a las ${timeRegex[1]}:${timeRegex[2]}`;
        }
      }
      return `${day} ${monthName} ${year}${timeStr}`;
    }
    
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
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
      comments:post.comments || post.comments_count || post.scraped_comments?.length || 0,
      shares:post.shares || 0,
      retweets:post.retweets || 0,
      quotes:post.quotes || 0,
      bookmarks:post.bookmarks || 0,
      followers:post.followers || 0,
      type:post.type || '',
      fbLike: post.fb_like || post.like || 0,
      fbLove: post.fb_love || post.love || 0,
      fbHaha: post.fb_haha || post.haha || 0,
      fbWow:  post.fb_wow  || post.wow  || 0,
      fbSad:  post.fb_sad  || post.sad  || 0,
      fbAngry:post.fb_angry|| post.angry|| 0,
      commentsExtracted:post.commentsExtracted || post.scraped_comments?.length || 0,
      commentsList:(post.commentsList || post.scraped_comments || []).map(c => ({
        id:c.id,
        author:c.author || c.username || '',
        text:c.text || '',
        publishedTime:c.publishedTime || c.published_time || c.time || '',
        likes:c.likes || 0,
        replies:c.replies || 0,
        views:c.views || 0,
        url:c.url || '',
      })),
      thumbnail:post.thumbnail || post.image || post.coverUrl || thumbnailFromUrl(post.url),
    });
  };

  if (themeData.scraped_posts) {
    themeData.scraped_posts.forEach(p => {
      add(p.platform, {
        url: p.url,
        text: p.text,
        username: p.username,
        platform: p.platform,
        time: p.published_date,
        likes: p.likes,
        comments: p.comments_count,
        shares: p.shares,
        retweets: p.retweets,
        bookmarks: p.bookmarks,
        views: p.views,
        followers: p.followers,
        thumbnail: p.thumbnail,
        sentiment: p.sentiment,
        scraped_comments: p.scraped_comments || []
      });
    });
    return buckets;
  }

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

export default function ThemeView({ tab, date, plat, data, isDesktop, noData, calendarSummary, ownedNet, isSocialListening }) {
  const T = data.themes;
  const t = T[tab];
  const isOwned = tab === 'redes_propias';
  const [activeNetwork, setActiveNetwork] = useState(ownedNet || null);
  const [activePostKey, setActivePostKey] = useState(null);

  // Sync activeNetwork with ownedNet prop when tab is redes_propias
  if (isOwned && ownedNet && activeNetwork !== ownedNet) {
    setActiveNetwork(ownedNet);
    setActivePostKey(null);
  }

  if (!t) return null;

  if (noData) {
    const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const dateLabel = (() => {
      if (!date || date === 'todas') return '';
      const d = new Date(date + 'T12:00:00');
      if (isNaN(d)) return date;
      return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
    })();
    return (
      <div style={{ padding:'40px 24px', textAlign:'center' }}>
        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, letterSpacing:'0.18em',
          textTransform:'uppercase', color:'#B0822F', fontWeight:600, marginBottom:12 }}>
          {dateLabel}
        </div>
        <div style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:22,
          color:'#211C17', marginBottom:8 }}>Sin datos para esta fecha.</div>
        <p style={{ fontSize:13, color:'#6B6253' }}>
          No se subió un reporte de <strong>{t.label}</strong> para el {dayInt} de junio.
        </p>
      </div>
    );
  }

  // For redes_propias: use per-network sentiment from desglose_por_red when a network is selected
  let s = t.sentiment || { pos:0, neu:0, neg:0 };
  if (isOwned && ownedNet) {
    const dpr = t.ai_analysis?.desglose_por_red?.[ownedNet];
    if (dpr?.sentimiento) {
      const ds = dpr.sentimiento;
      s = {
        pos: Number(ds.favorable || ds.positivo || 0),
        neu: Number(ds.neutral || 0),
        neg: Number(ds.critico || ds.negativo || 0),
      };
    }
  }
  const hasAiAnalysis = !!t.aiDerived || !!t.ai_analysis;
  const rm = riskMeta(t.risk?.level);

  const targetDays = date && date !== 'todas' ? [date] : [];

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
  const aiVoices = t.voices?.allies?.length || t.voices?.critics?.length;
  const voices = aiVoices
    ? { allies: t.voices.allies || [], critics: t.voices.critics || [] }
    : deriveVoices(t, networkPostsByKey);
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
  // For redes_propias: only show selected network in the grid
  const visibleNetworks = isOwned && ownedNet
    ? strategyNetworks.filter(n => n.key === ownedNet)
    : strategyNetworks;
  const renderNetworkMap = (compact = false) => visibleNetworks.length > 0 && (
    <Section title={isOwned && ownedNet ? platLabel(ownedNet) : networkMapTitle} px={compact ? '16px 0 6px' : sectionPx}
      right={<span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:'#8A7E6A' }}>{fmt(isOwned && ownedNet ? (networkPostsByKey[ownedNet]?.length || 0) : (networkStrategy.totalPosts||0))} {networkMapItemLabel}</span>}>
      {!isOwned && <div style={{ display:'grid', gridTemplateColumns: compact ? 'repeat(2, minmax(0, 1fr))' : isDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap:8 }}>
        {visibleNetworks.map(n => (
          <button key={n.key} onClick={() => { setActiveNetwork(activeNetwork === n.key ? null : n.key); setActivePostKey(null); }}
            style={{ textAlign:'left', cursor:'pointer', background:C.card,
              border:selectedNetwork === n.key ? `1px solid ${C.gold}` : '1px solid rgba(33,28,23,0.13)',
              boxShadow:selectedNetwork === n.key ? '0 0 0 1px rgba(176,130,47,0.18)' : 'none',
              borderRadius:3, padding:compact ? 12 : 16, font:'inherit' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:compact ? 8 : 10 }}>
              <PlatformIcon platform={n.key} size={compact ? 22 : 24} />
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
      </div>}

      {(() => {
        const allPosts = Object.values(networkPostsByKey).flat().sort((a,b) => {
          const engA = (a.likes||0) + (a.comments||0)*2 + (a.shares||0)*3;
          const engB = (b.likes||0) + (b.comments||0)*2 + (b.shares||0)*3;
          return engB - engA;
        });
        // For redes_propias: use only selected network's posts
        const ownedPosts = isOwned && ownedNet ? (networkPostsByKey[ownedNet] || []) : null;
        if (!ownedPosts && allPosts.length === 0) return null;

        const selectedPosts = isOwned && ownedNet ? ownedPosts : (activeNetwork ? (networkPostsByKey[activeNetwork] || []) : allPosts);
        const isPublicListening = t.networkStrategy?.title === 'Redes monitoreadas' || tab !== 'redes_propias';

        if (isPublicListening) {
          return (
            <div style={{ marginTop:10 }}>
              {/* Header bar */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 4px', marginBottom:10 }}>
                {activeNetwork ? <PlatformIcon platform={activeNetwork} size={16} /> : null}
                <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.ink }}>
                  {activeNetwork ? `${platLabel(activeNetwork)}` : 'Todas las redes'}
                </span>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A' }}>
                  · {selectedPosts.length} publicaciones
                </span>
              </div>
              {/* Post cards grid */}
              {selectedPosts.length > 0 ? (
                <div style={{ display:'grid', gridTemplateColumns: compact || !isDesktop ? '1fr' : 'repeat(2, minmax(0,1fr))', gap:8 }}>
                  {selectedPosts.map((p, i) => {
                    const key = postKey(p, i);
                    const engagement = (p.likes||0) + (p.comments||0)*2 + (p.shares||0)*3;
                    const engHigh = engagement > 1000;
                    return (
                      <div key={key} style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, overflow:'hidden', display:'flex', flexDirection:'column' }}>
                        {/* Thumbnail */}
                        {p.thumbnail && (
                          <a href={p.url || undefined} target={p.url ? '_blank' : undefined} rel="noopener noreferrer"
                            style={{ display:'block', width:'100%', height:140, overflow:'hidden', background:'rgba(33,28,23,0.06)', flexShrink:0 }}>
                            <img src={p.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading="lazy" />
                          </a>
                        )}
                        {/* Body */}
                        <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                          {/* Author row */}
                          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                            <PlatformIcon platform={p.platform} size={13} />
                            {p.username && <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:700, fontSize:10.5, color:C.goldDeep, textTransform:'uppercase', letterSpacing:'0.06em', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>@{p.username}</span>}
                            {p.date && <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, color:'#8A7E6A', flexShrink:0 }}>{formatSpanishDate(p.date)}</span>}
                          </div>
                          {/* Text */}
                          <p style={{ fontSize:13.5, lineHeight:1.45, color:C.ink, margin:0, wordBreak:'break-word',
                            display:'-webkit-box', WebkitLineClamp:4, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                            {p.text || '[Sin texto]'}
                          </p>
                          {/* Metrics + link */}
                          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:'auto' }}>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px', fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', textTransform:'uppercase', flex:1 }}>
                              {p.likes ? <span style={{ color: engHigh ? C.goldDeep : '#8A7E6A', fontWeight: engHigh ? 700 : 400 }}>{fmt(p.likes)} ♥</span> : null}
                              {p.comments ? <span>{fmt(p.comments)} 💬</span> : null}
                              {p.shares ? <span>{fmt(p.shares)} ↗</span> : null}
                              {p.metric ? <span>{p.metric}</span> : null}
                            </div>
                            {p.url && (
                              <a href={p.url} target="_blank" rel="noopener"
                                style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:C.goldDeep, fontWeight:700, textDecoration:'none', padding:'5px 10px', border:'1px solid rgba(176,130,47,0.3)', borderRadius:2, whiteSpace:'nowrap', flexShrink:0 }}>
                                ABRIR ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding:'12px', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', textTransform:'uppercase' }}>
                  No hay publicaciones para esta red.
                </div>
              )}
            </div>
          );
        }

        const currentNetwork = activeNetwork || strategyNetworks[0]?.key;
        if (!currentNetwork) return null;

        const networkPosts = networkPostsByKey[currentNetwork] || [];
        const selectedPost = networkPosts.find((p, idx) => postKey(p, idx) === activePostKey) || networkPosts[0];
        const selectedComments = selectedPost?.commentsList || [];
        const showCommentsPanel = isDesktop && !compact && t.networkStrategy?.title !== 'Redes monitoreadas';
        return (
        <div style={{ marginTop:10, display:'grid', gridTemplateColumns: showCommentsPanel ? 'minmax(0,1fr) minmax(0,1.1fr) minmax(0,1fr)' : isDesktop && !compact ? 'minmax(0, 0.95fr) minmax(0, 1.05fr)' : '1fr', gap:10 }}>
          {/* Column 1: Posts list */}
          <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(33,28,23,0.04)', borderBottom:'1px solid rgba(33,28,23,0.10)' }}>
              <PlatformIcon platform={currentNetwork} size={16} />
              <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.ink }}>
                Publicaciones de {platLabel(currentNetwork)}
              </span>
              <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', marginLeft:'auto' }}>
                {networkPosts.length} visibles
              </span>
            </div>
            {networkPosts.length > 0 ? networkPosts.map((p, i) => {
              const key = postKey(p, i);
              const isSelected = key === postKey(selectedPost, networkPosts.indexOf(selectedPost));
              return (
                <button key={key} onClick={() => setActivePostKey(key)}
                  style={{ display:'grid', gridTemplateColumns:p.thumbnail && !compact ? '76px 1fr' : '1fr', gap:10, width:'100%', padding:'11px 12px', textAlign:'left',
                    background:isSelected ? 'rgba(176,130,47,0.10)' : C.card, border:0, borderBottom:i<networkPosts.length-1?'1px solid rgba(33,28,23,0.08)':'none', cursor:'pointer', font:'inherit' }}>
                  {p.thumbnail && !compact && (
                    <span style={{ width:76, height:48, borderRadius:3, overflow:'hidden', background:'rgba(33,28,23,0.08)', display:'block' }}>
                      <img src={p.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading="lazy" />
                    </span>
                  )}
                  <span style={{ minWidth:0 }}>
                    <span style={{ display:'block', fontSize:13.5, lineHeight:1.35, color:C.ink }}>{p.text || p.url}</span>
                    <span style={{ display:'block', fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', marginTop:5, textTransform:'uppercase' }}>
                      {[p.username, p.metric,
                        p.platform === 'facebook' && (p.fbHaha||p.fbLove||p.fbLike||p.fbWow||p.fbSad||p.fbAngry)
                          ? [p.fbHaha?`😂${fmt(p.fbHaha)}`:'', p.fbLove?`❤️${fmt(p.fbLove)}`:'', p.fbLike?`👍${fmt(p.fbLike)}`:'', p.fbWow?`😮${fmt(p.fbWow)}`:'', p.fbSad?`😢${fmt(p.fbSad)}`:'', p.fbAngry?`😡${fmt(p.fbAngry)}`:''].filter(Boolean).join(' ')
                          : p.likes ? `${fmt(p.likes)} Me gusta` : '',
                        p.comments ? `${fmt(p.comments)} com.` : '', p.shares ? `${fmt(p.shares)} compartidos` : '', p.bookmarks ? `${fmt(p.bookmarks)} guardados` : '', formatSpanishDate(p.date)].filter(Boolean).join(' - ')}
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

          {/* Column 2: Post detail */}
          <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, overflow:'hidden' }}>
            {selectedPost ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(33,28,23,0.04)', borderBottom:'1px solid rgba(33,28,23,0.10)' }}>
                  <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.ink }}>
                    Publicación seleccionada
                  </span>
                  {selectedPost.url && <a href={selectedPost.url} target="_blank" rel="noopener" style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:C.goldDeep, fontWeight:700, textDecoration:'none', marginLeft:'auto' }}>ABRIR ↗</a>}
                </div>
                {selectedPost.thumbnail && !compact && (
                  <div style={{ width:'100%', maxHeight:220, overflow:'hidden', background:'rgba(33,28,23,0.06)' }}>
                    <img src={selectedPost.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', maxHeight:220 }} loading="lazy" />
                  </div>
                )}
                <div style={{ padding:'12px 14px' }}>
                  <p style={{ fontSize:14.5, lineHeight:1.5, color:C.ink, margin:'0 0 10px', wordBreak:'break-word' }}>{selectedPost.text || selectedPost.url}</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'5px 10px', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', textTransform:'uppercase' }}>
                    {selectedPost.username && <span style={{ fontWeight:600, color:C.goldDeep }}>@{selectedPost.username}</span>}
                    {selectedPost.platform === 'facebook' && (selectedPost.fbHaha||selectedPost.fbLove||selectedPost.fbLike||selectedPost.fbWow||selectedPost.fbSad||selectedPost.fbAngry)
                      ? [['😂','Jaja',selectedPost.fbHaha],['❤️','Me encanta',selectedPost.fbLove],['👍','Me gusta',selectedPost.fbLike],['😮','Asombro',selectedPost.fbWow],['😢','Tristeza',selectedPost.fbSad],['😡','Enojo',selectedPost.fbAngry]].filter(([,,n])=>n>0).map(([e,l,n])=><span key={l}>{e} {fmt(n)} {l}</span>)
                      : selectedPost.likes ? <span>{fmt(selectedPost.likes)} Me gusta</span> : null}
                    {selectedPost.comments ? <span>{fmt(selectedPost.comments)} comentarios</span> : null}
                    {selectedPost.commentsExtracted ? <span>{fmt(selectedPost.commentsExtracted)} extraídos</span> : null}
                    {selectedPost.shares ? <span>{fmt(selectedPost.shares)} compartidos</span> : null}
                    {selectedPost.bookmarks ? <span>{fmt(selectedPost.bookmarks)} guardados</span> : null}
                    {selectedPost.metric && <span>{selectedPost.metric}</span>}
                    {selectedPost.date && <span>{formatSpanishDate(selectedPost.date)}</span>}
                  </div>
                </div>
                {/* Comments inline (mobile / monitored) */}
                {!showCommentsPanel && (selectedComments.length > 0 || t.networkStrategy?.title !== 'Redes monitoreadas') && (
                <div style={{ padding:'0 14px 14px' }}>
                  <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.goldDeep, marginBottom:8 }}>
                    {selectedComments.length ? `${selectedComments.length} comentarios extraidos` : 'Sin comentarios extraidos'}
                  </div>
                  {selectedComments.length ? selectedComments.slice(0, 12).map(comment => (
                    <a key={comment.id} href={comment.url || undefined} target={comment.url ? '_blank' : undefined} rel={comment.url ? 'noopener' : undefined}
                      style={{ display:'block', marginBottom:8, padding:'9px 10px', background:'rgba(33,28,23,0.035)', border:'1px solid rgba(33,28,23,0.07)', borderRadius:3, textDecoration:'none' }}>
                      <span style={{ display:'block', fontSize:12.8, lineHeight:1.38, color:'#2A241C' }}>{comment.text || '[Sin texto]'}</span>
                      <span style={{ display:'block', marginTop:5, fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', textTransform:'uppercase' }}>
                        {[comment.author, formatSpanishDate(comment.publishedTime), comment.likes ? `${fmt(comment.likes)} Me gusta` : '', comment.replies ? `${fmt(comment.replies)} respuestas` : '', comment.url ? 'abrir comentario' : ''].filter(Boolean).join(' - ')}
                      </span>
                    </a>
                  )) : (
                    <div style={{ padding:'8px 0 4px', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', textTransform:'uppercase' }}>
                      Esta publicacion aun no tiene comentarios raspados en la muestra local.
                    </div>
                  )}
                </div>
                )}
              </>
            ) : (
              <div style={{ padding:12, fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', textTransform:'uppercase' }}>Selecciona una publicacion.</div>
            )}
          </div>

          {/* Column 3: Comments panel (desktop, redes propias only) */}
          {showCommentsPanel && (
          <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(33,28,23,0.04)', borderBottom:'1px solid rgba(33,28,23,0.10)', flexShrink:0 }}>
              <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:C.ink }}>
                Comentarios
              </span>
              {selectedComments.length > 0 && (
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', marginLeft:'auto' }}>
                  {selectedComments.length} extraídos
                </span>
              )}
            </div>
            <div style={{ overflowY:'auto', flex:1, padding:'10px 12px' }}>
              {!selectedPost ? (
                <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', textTransform:'uppercase', paddingTop:4 }}>
                  Selecciona una publicación para ver sus comentarios.
                </div>
              ) : selectedComments.length ? selectedComments.slice(0, 20).map(comment => (
                <a key={comment.id} href={comment.url || undefined} target={comment.url ? '_blank' : undefined} rel={comment.url ? 'noopener' : undefined}
                  style={{ display:'block', marginBottom:8, padding:'9px 10px', background:'rgba(33,28,23,0.035)', border:'1px solid rgba(33,28,23,0.07)', borderRadius:3, textDecoration:'none' }}>
                  <span style={{ display:'block', fontSize:12.8, lineHeight:1.38, color:'#2A241C' }}>{comment.text || '[Sin texto]'}</span>
                  <span style={{ display:'block', marginTop:5, fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', textTransform:'uppercase' }}>
                    {[comment.author, formatSpanishDate(comment.publishedTime), comment.likes ? `${fmt(comment.likes)} Me gusta` : '', comment.replies ? `${fmt(comment.replies)} respuestas` : '', comment.url ? 'abrir' : ''].filter(Boolean).join(' - ')}
                  </span>
                </a>
              )) : (
                <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', textTransform:'uppercase', paddingTop:4 }}>
                  Esta publicación aún no tiene comentarios raspados.
                </div>
              )}
            </div>
          </div>
          )}
        </div>
        );
      })()}
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
          {tab !== 'redes_propias' && tab !== 'social_listening' && !isSocialListening && (voices.allies.length > 0 || voices.critics.length > 0) && (() => {
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
                  style={{ display:'block', padding:'12px 14px', textDecoration:'none',
                    background:C.card, borderRadius:3, marginBottom:8,
                    border:`1px solid rgba(33,28,23,0.10)`, borderLeftWidth:3, borderLeftColor:accentColor, borderLeftStyle:'solid' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <PlatformIcon platform={v.platform} size={15} />
                    <span style={{ fontWeight:600, fontSize:13.5, color:C.ink, flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.username}</span>
                    <span style={{ ...pill(tierInk, tierBg, tierBd), flexShrink:0 }}>{tierLabel}</span>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 8px', fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', textTransform:'uppercase', marginBottom:5 }}>
                    <span>{v.posts || 0} {(v.posts || 0) === 1 ? 'publicación' : 'publicaciones'}</span>
                    {v.likes ? <span>👍 {fmt(v.likes)}</span> : null}
                    {v.comments ? <span>💬 {fmt(v.comments)}</span> : null}
                    {v.engagement ? <span style={{ color:C.goldDeep, fontWeight:600 }}>Alcance: {fmt(v.engagement)}</span> : null}
                    {v.impact ? <span style={{ color: isAlly ? C.teal : C.crim }}>Impacto: {v.impact}</span> : null}
                  </div>
                  {v.text && (
                    <div style={{ fontSize:12, lineHeight:1.45, color:'#5A4E3C', fontStyle:'italic', marginBottom:6, paddingLeft:2 }}>
                      "{v.text.length > 120 ? v.text.slice(0, 120) + '…' : v.text}"
                    </div>
                  )}
                  {v.keywords && v.keywords.length > 0 && (
                    <div style={{ borderTop:'1px dotted rgba(33,28,23,0.08)', paddingTop:6, marginTop:4, display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
                      <span style={{ fontSize:9.5, color:'#8A7E6A', fontFamily:"'Geist Mono',monospace", textTransform:'uppercase' }}>Gatillos:</span>
                      {v.keywords.map((kw, idx) => (
                        <span key={idx} style={{ fontSize:9.5, background:isAlly ? 'rgba(40,167,69,0.08)' : 'rgba(220,53,69,0.08)', color:accentColor, padding:'2px 5px', borderRadius:2, border:`1px solid ${isAlly ? 'rgba(40,167,69,0.15)' : 'rgba(220,53,69,0.15)'}`, fontFamily:"'Geist Mono',monospace" }}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
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
      ) : !hasAiAnalysis ? (
        <div style={{ paddingBottom:24 }}>
          <motion.div variants={item} style={{ padding:sectionPx }}>
            <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:18 }}>
              <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:C.goldDeep, fontWeight:600 }}>
                Analisis IA pendiente
              </div>
              <div style={{ fontSize:14, lineHeight:1.5, color:'#2A241C', marginTop:8 }}>
                Aqui solo se muestran publicaciones y comentarios extraidos. Sentimiento, riesgo, alertas, aliados y contrarios se llenan cuando el analisis IA queda guardado en Supabase.
              </div>
            </div>
          </motion.div>
          {renderNetworkMap(false)}
        </div>
      ) : isOwned ? (
        /* ── Redes Propias layout: sentiment+alertómetro top, posts below ── */
        <div style={{ padding:'0 28px', paddingBottom:24 }}>
          {/* Top row */}
          <motion.div variants={item} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, paddingTop:16, paddingBottom:14 }}>
            {/* Donut card */}
            <div style={{ display:'flex', alignItems:'center', gap:16, background:C.card,
              border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:18 }}>
              <Donut pos={s.pos} neu={s.neu} neg={s.neg} size={100} showLabel />
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
            {/* Alertómetro card */}
            <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderLeft:`3px solid ${rm.c}`, borderRadius:3, padding:18 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <span style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:16, color:C.ink }}>Alertómetro &amp; riesgo</span>
                <Pill rm={rm} />
              </div>
              <div style={{ display:'flex', gap:0, marginBottom:12 }}>
                <div style={{ flex:1, borderRight:'1px solid rgba(33,28,23,0.10)', paddingRight:12 }}>
                  <div style={{ fontSize:24, fontWeight:600, color:C.ink, lineHeight:1 }}>{Math.round(t.risk?.negPct||s.neg||0)}<span style={{ fontSize:13 }}>%</span></div>
                  <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase', color:'#6B6253', marginTop:5 }}>Conv. crítica</div>
                </div>
                <div style={{ flex:1, paddingLeft:14 }}>
                  <div style={{ fontSize:24, fontWeight:600, color:C.ink, lineHeight:1 }}>{al.total||0}</div>
                  <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase', color:'#6B6253', marginTop:5 }}>Posts con alerta / {al.analizados||0}</div>
                </div>
              </div>
              <div style={{ fontSize:13, lineHeight:1.5, color:'#2A241C', paddingTop:10, borderTop:'1px solid rgba(33,28,23,0.10)' }}>
                {al.recomendacion||'No se encontraron posts negativos'}
              </div>
            </div>
          </motion.div>
          {/* Posts full width */}
          {renderNetworkMap(false)}
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
      {!t.rawOnly && tab !== 'redes_propias' && tab !== 'social_listening' && !isSocialListening && (voices.allies.length > 0 || voices.critics.length > 0) && (() => {
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
              style={{ display:'block', padding:'12px 14px', textDecoration:'none', background:C.card,
                borderRadius:3, marginBottom:8, border:`1px solid rgba(33,28,23,0.10)`,
                borderLeftWidth:3, borderLeftColor:accentColor, borderLeftStyle:'solid' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <PlatformIcon platform={v.platform} size={15} />
                <span style={{ fontWeight:600, fontSize:13.5, color:C.ink, flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.username}</span>
                <span style={{ ...pill(tierInk, tierBg, tierBd), flexShrink:0 }}>{tierLabel}</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 8px', fontFamily:"'Geist Mono',monospace", fontSize:10, color:'#8A7E6A', textTransform:'uppercase', marginBottom:5 }}>
                {v.followers ? <span>{fmtK(v.followers)} seg.</span> : null}
                <span>{v.posts} {v.posts === 1 ? 'post' : 'posts'}</span>
                {v.likes ? <span>👍 {fmt(v.likes)}</span> : null}
                {v.comments ? <span>💬 {fmt(v.comments)}</span> : null}
                {v.engagement ? <span style={{ color:C.goldDeep, fontWeight:600 }}>Alcance: {fmt(v.engagement)}</span> : null}
              </div>
              {v.keywords && v.keywords.length > 0 && (
                <div style={{ borderTop:'1px dotted rgba(33,28,23,0.08)', paddingTop:6, marginTop:4, display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
                  <span style={{ fontSize:9.5, color:'#8A7E6A', fontFamily:"'Geist Mono',monospace", textTransform:'uppercase' }}>Gatillos:</span>
                  {v.keywords.map((kw, idx) => (
                    <span key={idx} style={{ fontSize:9.5, background:isAlly ? 'rgba(40,167,69,0.08)' : 'rgba(220,53,69,0.08)', color:accentColor, padding:'2px 5px', borderRadius:2, border:`1px solid ${isAlly ? 'rgba(40,167,69,0.15)' : 'rgba(220,53,69,0.15)'}`, fontFamily:"'Geist Mono',monospace" }}>
                      {kw}
                    </span>
                  ))}
                </div>
              )}
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
