/**
 * run-full-analysis.js
 * Orquestador completo: Apify público + propios → comentarios → IA por red → Panorama Opus
 *
 * Uso directo:
 *   node scripts/run-full-analysis.js <APIFY_TOKEN> <OPENROUTER_KEY> [--date=2026-07-01]
 *
 * También usado por analizar-server.js como módulo.
 */

import { createClient } from '@supabase/supabase-js';
import { MESSAGE_FRAMEWORK_PROMPT, RATIONALE_SYSTEM, buildRationalePrompt } from './message-framework.js';

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Config de cuentas propias ────────────────────────────────────────────────
const OWNED = {
  instagram: 'pepeaguilar_oficial',
  facebook:  '100044594342192',
  tiktok:    'pepeaguilar_oficial',
  youtube:   'UC-N64vzpIAqoTgKMeOxCDhA',
  x:         'https://x.com/PepeAguilar',
};

// ─── Prensa: watchlist de portales (RSS directo, GRATIS, sin Apify) ──────────
// Cada portal: { name, search: 'https://SITIO/?s={kw}&feed=rss2' } → feed de búsqueda
// WordPress (busca en el texto completo del sitio; {kw} se sustituye por cada término),
// o { name, feeds: ['url-rss-fija'] } → se filtra por NEWS_KW en título+descripción.
// trusted:true (ej. Google Alerts) NO se re-filtra: Google ya filtró por la query.
// El ORDEN importa para el dedup: portales con URL real primero, Google News RSS al final
// (sus links son redirects) para que siempre gane la mejor versión de cada nota.
const MEDIA_WATCHLIST = [
  // Verificado 2026-07-14: búsqueda WP real (término basura → 0 items). Espectáculos fuerte.
  { name: 'Tribuna', search: 'https://www.tribuna.com.mx/?s={kw}&feed=rss2' },
  // Alertas de "Pepe Aguilar" del usuario: Google ya filtró por la query → trusted (no se
  // re-filtra por keywords). Sus links vienen envueltos; unwrapGoogleUrl saca la URL real.
  { name: 'Google Alerts', trusted: true, feeds: [
    'https://www.google.com/alerts/feeds/08157044076431884555/17076835080919692837',
    'https://www.google.com/alerts/feeds/08157044076431884555/1331091741186604113',
  ] },
  { name: 'Google News RSS', search: 'https://news.google.com/rss/search?q={kw}&hl=es-419&gl=MX&ceid=MX:es-419' },
];
const WATCHLIST_SEARCH_TERMS = ['"Pepe Aguilar"', '"los Aguilar"', '"dinastía Aguilar"'];

// Páginas/perfiles de FB de medios a vigilar: [{ name, source: 'https://www.facebook.com/...' }].
// ~$0.06 por página POR CORRIDA (con el cron diario = por día). Vacío = no corre nada.
const FACEBOOK_WATCH_PAGES = [];

// Google News (actor data_xplorer): maxArticles es POR keyword y cobra ~$1/1000 resultados,
// así que el tope de gasto escala con el número de keywords para no truncar a la mitad.
const GN_KEYWORDS = ['Pepe Aguilar'];
const GN_MAX_ARTICLES = 40;
const GN_CAP = +(0.02 + GN_KEYWORDS.length * (GN_MAX_ARTICLES / 1000) * 1.6).toFixed(3);
// Días de prensa hacia atrás desde la fecha del reporte (1 = solo ese día → timeframe '1d').
const NEWS_LOOKBACK_DAYS = Math.max(1, parseInt(process.env.NEWS_LOOKBACK_DAYS, 10) || 1);

// ─── Helpers Apify ────────────────────────────────────────────────────────────
async function apifyRun(token, actorId, input, maxChargeUsd) {
  const encoded = actorId.replace('/', '~');
  const url = `https://api.apify.com/v2/acts/${encoded}/runs?token=${token}&waitForFinish=300&maxTotalChargeUsd=${maxChargeUsd}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Apify ${actorId} → ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data || data;
}

async function apifyDataset(token, datasetId, limit = 300) {
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=${limit}&clean=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Dataset ${datasetId} → ${res.status}`);
  return res.json();
}

async function runActor(token, actorId, input, maxCharge, label) {
  const run = await apifyRun(token, actorId, input, maxCharge);
  const items = await apifyDataset(token, run.defaultDatasetId);
  return items;
}

// ─── Relevancia ───────────────────────────────────────────────────────────────
// Objetivo: Pepe Aguilar. La familia solo como colectivo (familia/los/dinastia Aguilar),
// NO se monitorea a Angela ni a miembros sueltos por su cuenta, y se quita el comodín
// suelto 'aguilar' porque dejaba pasar posts que solo hablan de Angela.
const RELEVANT_KW = ['pepe aguilar','pepeaguilar',
  'familia aguilar','familiaaguilar','dinast','los aguilar','losaguilar'];
const isRelevant = t => RELEVANT_KW.some(k => (t||'').toLowerCase().includes(k));

// Google News: solo notas sobre Pepe o la familia Aguilar como colectivo.
// Excluye notas que solo mencionan a un miembro suelto (ej. solo Ángela o Nodal).
const NEWS_KW = ['pepe aguilar','pepeaguilar','los aguilar','losaguilar',
  'familia aguilar','familiaaguilar','dinastia aguilar','dinastía aguilar','clan aguilar'];
const isRelevantNews = t => NEWS_KW.some(k => (t||'').toLowerCase().includes(k));

const nextDay  = d => { const dt = new Date(d+'T12:00:00Z'); dt.setDate(dt.getDate()+1); return dt.toISOString().slice(0,10); };
const daysAgo  = (d, n) => { const dt = new Date(d+'T12:00:00Z'); dt.setDate(dt.getDate()-n); return dt.toISOString().slice(0,10); };
// Ventana exacta por timestamp (ms); 'to' exclusivo. Post sin fecha parseable se conserva
// (mejor incluir que perder por dato faltante).
const inRange    = (dateStr, fromTs, toTs) => { if (!dateStr) return true; const t = Date.parse(dateStr); return Number.isNaN(t) ? true : (t >= fromTs && t < toTs); };
const dayStartTs = d => Date.parse(d + 'T00:00:00Z');
const safeIso    = d => { const t = Date.parse(d || ''); return Number.isNaN(t) ? null : new Date(t).toISOString(); };

// ─── Supabase helpers ─────────────────────────────────────────────────────────
async function upsertReport(themeKey, themeLabel, dateKey) {
  const { data: ex } = await supabase.from('reports').select('id').eq('date_key', dateKey).eq('theme_key', themeKey).limit(1);
  if (ex?.length) return ex[0].id;
  const { data, error } = await supabase.from('reports')
    .insert({ date_key: dateKey, theme_key: themeKey, theme_label: themeLabel, filename: `apify-${themeKey}-${dateKey}` })
    .select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function insertPosts(reportId, themeKey, posts) {
  if (!posts.length) return [];
  // 1) Dedup dentro del lote por URL (el scraper a veces repite la misma nota).
  const seenUrl = new Set();
  let unique = posts.filter(p => {
    const k = (p.url || '').trim();
    if (!k || seenUrl.has(k)) return false;
    seenUrl.add(k);
    return true;
  });
  // 2) Dedup contra lo ya guardado en este reporte (evita duplicar en re-corridas).
  const { data: existing } = await supabase.from('scraped_posts').select('url').eq('report_id', reportId);
  const have = new Set((existing || []).map(e => e.url));
  unique = unique.filter(p => !have.has(p.url));
  if (!unique.length) return [];
  const rows = unique.map(({ domain, descr, via, ...p }) => ({ ...p, report_id: reportId, theme_key: themeKey, sentiment: null }));
  const { data, error } = await supabase.from('scraped_posts').insert(rows).select('id, url, likes, comments_count');
  if (error) throw new Error(error.message);
  return data || [];
}

async function insertComments(postId, comments) {
  if (!comments.length) return;
  const rows = comments.map(c => ({ ...c, post_id: postId }));
  const { error } = await supabase.from('scraped_comments').insert(rows);
  if (error) throw new Error(error.message);
}

// ─── Normalizadores ───────────────────────────────────────────────────────────
const normX = (items, from, to) => items.map(p => ({
  platform:'x', username: p.author?.userName || p.user?.screen_name || '',
  text: p.full_text || p.text || '', url: p.permalink || p.url || '',
  published_date: p.created_at || p.createdAt || null,
  likes: +( p.likeCount || p.likes || 0), comments_count: +(p.replyCount || p.comments || 0),
  retweets: +(p.retweetCount || p.retweets || 0), views: +(p.viewCount || p.views || 0), shares: 0,
})).filter(p => p.text && p.url && inRange(p.published_date, from, to) && isRelevant(p.text));

const normFacebook = (items, from, to) => items.map(p => {
  const rx = +(p.reactions_count || p.reactionsCount || 0);
  return {
    platform:'facebook', username: p.author?.name || p.authorName || '',
    text: p.message || p.text || '', url: p.url || p.postUrl || '',
    published_date: p.date || p.publishedAt || null,
    likes: rx || +(p.like || p.likes || 0),
    comments_count: +(p.comments_count || p.commentsCount || 0),
    shares: +(p.reshare_count || p.shares || 0), retweets:0, views:0,
    fb_like:  +(p.like || p.likeCount || 0),
    fb_love:  +(p.love || p.loveCount || 0),
    fb_haha:  +(p.haha || p.hahaCount || 0),
    fb_wow:   +(p.wow  || p.wowCount  || 0),
    fb_sad:   +(p.sad  || p.sadCount  || 0),
    fb_angry: +(p.angry|| p.angryCount|| 0),
  };
}).filter(p => p.text && p.url && inRange(p.published_date, from, to) && isRelevant(p.text));

const normInstagram = (items, from, to) => items.map(p => {
  const code = p.code || p.shortCode || '';
  return {
    platform:'instagram', username: p.owner?.username || p.ownerUsername || p.username || '',
    text: p.caption || p.text || '', url: p.url || p.postUrl || (code ? `https://www.instagram.com/p/${code}/` : ''),
    published_date: p.createdAt || p.taken_at_date || p.timestamp || null,
    likes: +(p.likeCount || p.likesCount || 0), comments_count: +(p.commentCount || p.commentsCount || 0),
    views: +(p.video?.playCount || p.videoPlayCount || 0), shares:0, retweets:0,
  };
}).filter(p => p.text && p.url && inRange(p.published_date, from, to) && isRelevant(p.text + p.username));

const normTikTok = (items, from, to) => items.map(p => ({
  platform:'tiktok', username: p.author || p.nickname || p.authorMeta?.name || '',
  text: p.desc || p.description || '', url: p.url || p.webVideoUrl || '',
  published_date: p.createTimeISO || p.createdAt || (p.createTime ? new Date(p.createTime*1000).toISOString() : null),
  likes: +(p.diggCount || p.likes || 0), comments_count: +(p.commentCount || p.comments || 0),
  shares: +(p.shareCount || 0), views: +(p.playCount || p.plays || 0), retweets:0,
  followers: +(p.followers || p.authorMeta?.fans || 0),
  _subs: p.videoMeta?.subtitleLinks || p.subtitleLinks || null,
})).filter(p => p.text && p.url && inRange(p.published_date, from, to) && isRelevant(p.text + p.username));

// Limpia el nombre de la fuente ("Ir a Milenio" -> "Milenio") y saca el dominio del URL.
const cleanSource = s => (s || '').replace(/^\s*ir a\s+/i, '').replace(/\s+/g, ' ').trim();
const domainFromUrl = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const tsToIso = ts => { const n = +ts; if (!n) return null; return new Date(n > 1e12 ? n : n * 1000).toISOString(); };
const normGoogleNews = (items, from, to) => {
  const seen = new Set();
  return items.map(p => {
    const url = p.url || p.articleUrl || p.link || '';   // decodeUrls:true → URL real del medio
    const domain = p.domain || domainFromUrl(url);
    return {
      platform:'google_news',
      username: cleanSource(p.source || p.sourceDomain) || domain,
      domain, descr: p.description || '',
      text: p.title || '', url,
      published_date: p.publishedAt || p.date || tsToIso(p.publishedTimestamp),
      likes:0, comments_count:0, shares:0, retweets:0, views:0,
    };
  }).filter(p => {
    if (!p.text || !p.url) return false;
    if (!inRange(p.published_date, from, to)) return false;
    if (!isRelevantNews(p.text + ' ' + (p.descr || ''))) return false;
    if (seen.has(p.url)) return false; // varias keywords pueden repetir la misma nota
    seen.add(p.url);
    return true;
  });
};

// ─── Prensa local: watchlist de portales por RSS directo (GRATIS, sin Apify) ──
const stripCdata = s => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
// Dos pasadas de quitar tags: Google Alerts (Atom) escapa el HTML dentro del título
// (&lt;b&gt;...), así que hay que decodificar entidades y volver a quitar tags.
const stripTags  = s => stripCdata(s).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"')
  .replace(/&#8220;|&#8221;/g, '"').replace(/&nbsp;/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function parseRssItems(xml) {
  const blocks = [...xml.matchAll(/<(item|entry)[\s>]([\s\S]*?)<\/\1>/g)].map(m => m[2]);
  return blocks.map(b => {
    const pick = tag => (b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')) || [])[1] || '';
    const linkAttr = (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '';
    const sourceName = stripTags(pick('source')); // Google News RSS: nombre del medio real
    let title = stripTags(pick('title'));
    // Google News RSS pone "Titular - Medio"; quita el sufijo si coincide con el source
    if (sourceName && title.toLowerCase().endsWith(' - ' + sourceName.toLowerCase())) {
      title = title.slice(0, -(sourceName.length + 3)).trim();
    }
    return {
      title, sourceName,
      url: stripTags(pick('link')) || linkAttr || stripTags(pick('guid')),
      description: stripTags(pick('description') || pick('summary') || pick('content:encoded')).slice(0, 400),
      published_date: stripTags(pick('pubDate') || pick('published') || pick('dc:date') || pick('updated')) || null,
    };
  }).filter(i => i.title && i.url);
}

// Google Alerts envuelve los links: google.com/url?...&url=REAL → desenvuelve.
// El feed trae el href con entidades escapadas (&amp;), hay que decodificar antes de parsear.
const unwrapGoogleUrl = u => {
  const decoded = (u || '').replace(/&amp;/g, '&');
  try {
    const parsed = new URL(decoded);
    if (/(^|\.)google\.com$/.test(parsed.hostname) && parsed.pathname === '/url') {
      return parsed.searchParams.get('url') || parsed.searchParams.get('q') || decoded;
    }
  } catch { /* keep original */ }
  return decoded;
};

async function fetchFeed(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return parseRssItems(await res.text());
  } catch (e) {
    if (attempt < 2) return fetchFeed(url, attempt + 1); // 1 reintento (timeouts intermitentes)
    throw e;
  }
}

// Las notas salen como platform 'google_news' para integrarse a la misma sección de
// prensa/medios del dashboard; 'via' y 'domain' son auxiliares (no se insertan a Supabase).
async function scrapeWatchlist(portals, searchTerms, fromTs, toTs, isRelevantFeed, log) {
  const seen = new Set();
  const out = [];
  const toPost = (item, portalName) => {
    const url = unwrapGoogleUrl(item.url);
    const domain = domainFromUrl(url);
    return {
      platform: 'google_news',
      // sourceName (Google News RSS) > dominio real (Alerts) > nombre del portal
      username: item.sourceName || (portalName && !/google/i.test(portalName) ? portalName : domain) || domain,
      domain, via: portalName,
      text: item.title, descr: item.description, url,
      published_date: safeIso(item.published_date),
      likes: 0, comments_count: 0, shares: 0, retweets: 0, views: 0,
    };
  };
  for (const portal of portals) {
    const jobs = [];
    // Feed de búsqueda (una petición por término): el sitio ya buscó en texto completo
    if (portal.search) {
      for (const kw of searchTerms) {
        jobs.push(fetchFeed(portal.search.replace('{kw}', encodeURIComponent(kw)))
          .then(items => items.map(i => ({ i, filtered: false }))));
      }
    }
    // Feeds fijos: se filtran por keywords, salvo trusted:true (ej. Google Alerts)
    for (const f of (portal.feeds || [])) {
      jobs.push(fetchFeed(f).then(items => items.map(i => ({ i, filtered: !portal.trusted }))));
    }
    const results = await Promise.allSettled(jobs);
    let count = 0;
    for (const r of results) {
      if (r.status === 'rejected') { log(`✗ prensa ${portal.name}: ${r.reason?.message}`); continue; }
      for (const { i, filtered } of r.value) {
        const post = toPost(i, portal.name);
        if (!inRange(post.published_date, fromTs, toTs)) continue;
        if (filtered && !isRelevantFeed(post.text + ' ' + post.descr)) continue;
        if (seen.has(post.url)) continue;
        seen.add(post.url);
        out.push(post); count++;
      }
    }
    log(`prensa ${portal.name}: ${count} notas`);
  }
  return out;
}

// Páginas/perfiles de FB vigilados (medios). Mismo actor que redes propias,
// pero filtrando por ventana + relevancia.
const normWatchFacebook = (items, pageName, from, to) => items.map(p => ({
  platform: 'facebook', username: p.authorName || pageName,
  text: p.text || p.message || '', url: p.permalink || p.url || '',
  published_date: p.publishTimeIso || p.date || null,
  likes: +(p.reactionCount || p.reactionsCount || 0), comments_count: +(p.commentCount || 0),
  shares: +(p.shareCount || p.sharesCount || 0), retweets: 0, views: 0,
})).filter(p => p.text && p.url && inRange(p.published_date, from, to) && isRelevant(p.text));

// Dedup de prensa multi-vía: la misma nota puede llegar por portal directo, actor de GN
// y Google News RSS. Claves: URL exacta y título+medio normalizados. Se conserva la
// PRIMERA aparición → pasar primero las fuentes con URL real.
const dedupePress = (posts) => {
  const seen = new Set();
  return posts.filter(p => {
    const t = (p.text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const s = (p.username || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const keys = [p.url, t && s ? `${t}|${s}` : null].filter(Boolean);
    if (keys.some(k => seen.has(k))) return false;
    keys.forEach(k => seen.add(k));
    return true;
  });
};

// Owned normalizers — sin filtro de fecha, últimos 5 posts del perfil
const normOwnedInstagram = (items) => {
  const posts = items.flatMap(profile => (profile.latestPosts || []));
  return posts.slice(0, 5).map(p => ({
    platform:'instagram', username: items[0]?.username || 'pepeaguilar_oficial',
    text: p.caption || p.alt || '', url: p.url || '',
    published_date: p.timestamp || p.taken_at_date || null,
    likes: +(p.likesCount || p.likeCount || 0), comments_count: +(p.commentsCount || p.commentCount || 0),
    views: +(p.videoViewCount || 0), shares:0, retweets:0,
  })).filter(p => p.url);
};

// apify/facebook-posts-scraper ($2/1000): trae el desglose real de reacciones por post
// (reactionLikeCount, reactionLoveCount, reactionHahaCount, reactionWowCount,
// reactionSadCount, reactionAngryCount). Fallbacks del actor anterior por tolerancia.
const normOwnedFacebook = (items) => items.slice(0, 5).map(p => {
  const rx = p.reactions || p.reactionsBreakdown || {};
  return {
    platform:'facebook', username: p.user?.name || p.pageName || p.authorName || 'Pepe Aguilar',
    text: p.text || p.message || '', url: p.url || p.topLevelUrl || p.permalink || '',
    published_date: p.time || p.publishTimeIso || p.date || null,
    likes: +(p.likes || p.reactionCount || p.reactionsCount || 0),
    comments_count: +(p.comments || p.commentCount || 0),
    shares: +(p.shares || p.shareCount || 0), retweets:0, views:0,
    fb_like:  +(p.reactionLikeCount  || p.like  || rx.like  || 0),
    fb_love:  +(p.reactionLoveCount  || p.love  || rx.love  || 0),
    fb_haha:  +(p.reactionHahaCount  || p.haha  || rx.haha  || 0),
    fb_wow:   +(p.reactionWowCount   || p.wow   || rx.wow   || 0),
    fb_sad:   +(p.reactionSadCount   || p.sad   || rx.sad   || 0),
    fb_angry: +(p.reactionAngryCount || p.angry || rx.angry || 0),
  };
}).filter(p => p.url);

const normOwnedTikTok = (items) => items
  .filter(p => !p.isPinned)
  .slice(0, 5)
  .map(p => ({
    platform:'tiktok', username: p.authorMeta?.name || 'pepeaguilar_oficial',
    text: p.text || p.desc || '', url: p.webVideoUrl || '',
    published_date: p.createTimeISO || (p.createTime ? new Date(p.createTime*1000).toISOString() : null),
    likes: +(p.diggCount || 0), comments_count: +(p.commentCount || 0),
    shares: +(p.shareCount || 0), views: +(p.playCount || 0), retweets:0,
    _subs: p.videoMeta?.subtitleLinks || p.subtitleLinks || null,
  })).filter(p => p.url);

// Descarga los subtitulos automaticos de TikTok (WebVTT, gratis) y los anexa al texto del post.
// Solo los top N por views para no alargar la corrida.
async function attachTikTokTranscripts(posts, maxVideos = 10) {
  const candidates = posts.filter(p => Array.isArray(p._subs) && p._subs.length)
    .sort((a,b) => (b.views||0) - (a.views||0))
    .slice(0, maxVideos);
  for (const p of candidates) {
    try {
      const sub = p._subs.find(s => /^(es|spa)/i.test(s.language || s.lang || s.languageCode || ''))
        || p._subs.find(s => /^(en|eng)/i.test(s.language || s.lang || s.languageCode || ''))
        || p._subs[0];
      const vttUrl = sub?.downloadLink || sub?.url || (typeof sub === 'string' ? sub : null);
      if (!vttUrl) continue;
      const res = await fetch(vttUrl);
      if (!res.ok) continue;
      const vtt = await res.text();
      const text = vtt
        .replace(/^WEBVTT[^\n]*\n/,'')
        .replace(/^\d+\s*$/gm,'')
        .replace(/\d{2}:\d{2}[:.,\d]*\s*-->\s*[\d:.,]+[^\n]*/g,'')
        .replace(/<[^>]+>/g,'')
        .split('\n').map(l => l.trim()).filter(Boolean)
        // Collapse consecutive duplicate lines (VTT repeats them)
        .filter((l, i, arr) => l !== arr[i-1])
        .join(' ')
        .replace(/\s+/g,' ').trim();
      if (text) p.text = `${p.text}\n[TRANSCRIPCION DEL VIDEO]: ${text.slice(0, 900)}`;
    } catch { /* transcript is best-effort */ }
  }
  posts.forEach(p => { delete p._subs; });
  return posts;
}

const normOwnedX = (items) => items.slice(0, 5).map(p => ({
  platform:'x', username: p.author?.screenName || 'PepeAguilar',
  text: p.postText || p.text || p.full_text || '',
  url: p.postUrl || p.url || p.permalink || '',
  published_date: p.timestamp ? new Date(p.timestamp).toISOString() : (p.created_at || p.createdAt || null),
  likes: +(p.favouriteCount || p.likeCount || p.likes || 0),
  comments_count: +(p.replyCount || p.replies || 0),
  retweets: +(p.repostCount || p.retweetCount || p.retweets || 0),
  views: +(p.viewCount || p.views || 0), shares:0,
})).filter(p => p.url);

async function fetchYouTubeRSS() {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${OWNED.youtube}`;
  const res = await fetch(feedUrl);
  const xml = await res.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => m[1]);
  return entries.slice(0, 5).map(e => {
    const videoId = (e.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1] || '';
    const title   = (e.match(/<title>(.*?)<\/title>/)           || [])[1] || '';
    const pub     = (e.match(/<published>(.*?)<\/published>/)    || [])[1] || '';
    return {
      platform:'youtube', username:'PepeAguilar',
      text: title, url: `https://www.youtube.com/watch?v=${videoId}`,
      published_date: pub, likes:0, comments_count:0, shares:0, retweets:0, views:0,
    };
  }).filter(p => p.url && p.text);
}

// ─── Comment normalizers ──────────────────────────────────────────────────────
const normCommentIG = items => items.map(c => ({
  text: c.text || c.ownerText || '', author: c.ownerUsername || c.owner?.username || '',
  published_time: c.timestamp || null, likes: +(c.likesCount || 0), replies:0, url: c.url || '',
})).filter(c => c.text);

const normCommentFB = items => items.map(c => ({
  text: c.text || '', author: c.profileName || c.authorName || '',
  published_time: c.date || null, likes: +(c.likesCount || 0), replies:0, url: c.commentUrl || '',
})).filter(c => c.text);

const normCommentTT = items => items.map(c => ({
  text: c.text || '', author: c.uniqueId || c.user?.uniqueId || '',
  published_time: c.createTimeISO || null, likes: +(c.diggCount || 0),
  replies: +(c.replyCommentTotal || 0), url: '',
})).filter(c => c.text);

// El actor de YouTube a veces devuelve author como objeto {id,name,thumbnails};
// hay que extraer .name para no guardar el JSON crudo como autor.
const authorName = a => { const n = (a && typeof a === 'object') ? (a.name || a.title || a.text || '') : (a || ''); return String(n).replace(/^@/, ''); };
const normCommentYT = items => items.map(c => ({
  text: c.text || c.commentText || '', author: c.authorText || authorName(c.author) || '',
  published_time: null, likes: +(c.voteCount || c.likeCount || 0), replies: +(c.replyCount || 0), url: c.commentUrl || '',
})).filter(c => c.text);

const normCommentX = items => items.map(c => ({
  text: c.replyText || c.text || '', author: c.author?.userName || '',
  published_time: c.created_at || c.createdAt || null, likes: +(c.likeCount || c.likes || 0),
  replies: +(c.replyCount || 0), url: c.replyUrl || c.url || '',
})).filter(c => c.text);

// ─── AI analysis helpers ──────────────────────────────────────────────────────
function truncate(text, max = 420) {
  const clean = String(text||'').replace(/\s+/g,' ').trim();
  return clean.length > max ? clean.slice(0, max)+'...' : clean;
}

function buildDataPrompt({ report, posts, comments, previousAnalysis }) {
  let out = `DATOS EXTRAIDOS PARA ANALISIS — ${report.theme_key} / ${report.date_key}\n\n`;
  if (previousAnalysis) {
    out += `--- ANALISIS DEL PERIODO ANTERIOR (${previousAnalysis.date_key}) PARA COMPARAR TENDENCIA ---\n`;
    const ps = previousAnalysis.ai_analysis?.sentimiento || {};
    out += `Sentimiento anterior: favorable ${ps.favorable ?? '?'}% / neutral ${ps.neutral ?? '?'}% / critico ${ps.critico ?? '?'}%\n`;
    out += `Riesgo anterior: ${previousAnalysis.ai_analysis?.nivel_riesgo || 'desconocido'}\n`;
    const prevAlertas = previousAnalysis.ai_analysis?.alertas || [];
    if (prevAlertas.length) {
      out += `Alertas anteriores (verifica si siguen activas o se resolvieron):\n`;
      prevAlertas.slice(0,5).forEach(a => { out += `  - ${typeof a === 'string' ? a : (a.text || a.alerta || '')}\n`; });
    }
    out += `\n`;
  }
  // Redes propias: los posts son los más recientes del perfil (pueden ser de días
  // previos), pero los COMENTARIOS son del día del reporte. La lectura debe centrarse
  // en la conversación de HOY, no en el engagement acumulado de un post viejo.
  const isOwned = report.theme_key === 'redes_propias';
  if (isOwned) {
    const hoy = report.date_key;
    const publicoHoy = posts.some(p => (p.published_date || '').slice(0, 10) === hoy);
    out += `--- MARCO REDES PROPIAS (reporte del ${hoy}) ---\n`;
    out += `Estas son las publicaciones más recientes de Pepe; la etiqueta [HOY] marca las publicadas el ${hoy}. Los comentarios de abajo son EXCLUSIVAMENTE del ${hoy}.\n`;
    out += publicoHoy
      ? `Reglas: Pepe SÍ publicó el ${hoy} — esa(s) publicación(es) [HOY] son lo más importante del día; analízalas a fondo. Para posts de días previos, enfócate en qué comenta la gente HOY sobre ellos.\n\n`
      : `Reglas: Pepe NO publicó el ${hoy}. Su última publicación es de días atrás. Lo relevante hoy es la CONVERSACIÓN del día: enmarca la lectura como "hoy la gente sigue comentando tu post del [fecha del post]", y saca alertas/oportunidades de esos comentarios del ${hoy}, NO del engagement acumulado del post viejo.\n\n`;
  }
  out += `--- PUBLICACIONES (${posts.length}) ---\n`;
  posts.forEach((p, i) => {
    // Desglose de reacciones de FB cuando existe: haha/angry/sad altos son señal de
    // burla o molestia que el total de likes esconde — la IA debe poder verlo.
    const rxTotal = (p.fb_like||0)+(p.fb_love||0)+(p.fb_haha||0)+(p.fb_wow||0)+(p.fb_sad||0)+(p.fb_angry||0);
    const rx = rxTotal ? ` reacciones[👍${p.fb_like||0} ❤️${p.fb_love||0} 😂${p.fb_haha||0} 😮${p.fb_wow||0} 😢${p.fb_sad||0} 😡${p.fb_angry||0}]` : '';
    const esHoy = isOwned && (p.published_date || '').slice(0, 10) === report.date_key ? ' [HOY]' : '';
    out += `${i+1}.${esHoy} [${p.platform}] @${p.username} | ${p.published_date?.slice(0,10)} | likes:${p.likes} comentarios:${p.comments_count} views:${p.views}${rx} | "${truncate(p.text)}" | ${p.url}\n`;
  });
  if (comments.length) {
    // Muestra representativa: los más gustados primero (no todos, para no inflar el prompt)
    const sample = [...comments].sort((a,b) => (b.likes||0)-(a.likes||0)).slice(0, 40);
    out += `\n--- MUESTRA DE COMENTARIOS (${sample.length} de ${comments.length}, ordenados por likes) ---\n`;
    sample.forEach((c,i) => {
      out += `${i+1}. @${c.author} | likes:${c.likes} | "${truncate(c.text, 300)}"\n`;
    });
  }
  return out;
}

// Panorama: consolida los resultados YA analizados por red (no re-analiza comentarios crudos)
function buildResumenPrompt({ networkResults, previousAnalysis }) {
  const asList = x => Array.isArray(x) ? x : (x ? [x] : []);
  let out = `RESULTADOS DE ANALISIS POR RED (ya procesados por la IA de cada red). Tu trabajo: CONSOLIDAR un panorama global a partir de estos resultados. NO tienes comentarios crudos y no los necesitas; confía en estos análisis.\n\n`;
  if (previousAnalysis) {
    const ps = previousAnalysis.ai_analysis?.sentimiento || {};
    out += `--- PERIODO ANTERIOR (${previousAnalysis.date_key}) PARA COMPARAR ---\n`;
    out += `Sentimiento anterior: favorable ${ps.favorable ?? '?'}% / neutral ${ps.neutral ?? '?'}% / critico ${ps.critico ?? '?'}%. Riesgo: ${previousAnalysis.ai_analysis?.nivel_riesgo || '?'}.\n`;
    asList(previousAnalysis.ai_analysis?.alertas).slice(0,5).forEach(a => { out += `  Alerta previa: ${typeof a === 'string' ? a : (a.text||a.alerta||'')}\n`; });
    out += `\n`;
  }
  for (const { theme, ai } of networkResults) {
    if (!ai) continue;
    const s = ai.sentimiento || {};
    out += `## ${theme.toUpperCase()} — favorable ${s.favorable ?? '?'}% / neutral ${s.neutral ?? '?'}% / critico ${s.critico ?? '?'}%. Riesgo: ${ai.nivel_riesgo || '?'}.\n`;
    asList(ai.resumen_ejecutivo).forEach(p => { out += `  · ${p}\n`; });
    const lect = ai.desglose_por_red?.[theme]?.lectura;
    if (lect) out += `  Lectura: ${lect}\n`;
    asList(ai.alertas).slice(0,4).forEach(a => { out += `  Alerta: ${typeof a === 'string' ? a : (a.text||a.alerta||'')}\n`; });
    asList(ai.oportunidades).slice(0,3).forEach(o => { out += `  Oportunidad: ${o}\n`; });
    const al = asList(ai.analisis_voces?.aliados_destacados).slice(0,5).map(v => v.username).filter(Boolean);
    const cr = asList(ai.analisis_voces?.criticos_destacados).slice(0,5).map(v => v.username).filter(Boolean);
    const md = asList(ai.analisis_voces?.medios_destacados).map(m => m.nombre).filter(Boolean);
    if (al.length) out += `  Aliados: ${al.join(', ')}\n`;
    if (cr.length) out += `  Contrarios: ${cr.join(', ')}\n`;
    if (md.length) out += `  Medios: ${md.join(', ')}\n`;
    out += `\n`;
  }
  return out;
}

const AI_PROMPT_SYSTEM = 'Eres un analista senior de reputacion y crisis para Pepe Aguilar. Responde solo JSON valido, sin markdown.';

const AI_PROMPT_TEMPLATE = (dataPrompt) => `Analiza los datos y devuelve SOLO JSON con esta estructura exacta.
ATENCION: los numeros de abajo son marcadores de posicion ("__CALCULA__"). DEBES reemplazarlos contando los posts/comentarios reales de los datos. Si entregas 15/68/17 o cualquier numero del ejemplo sin haberlo calculado, la respuesta es invalida.
{
  "resumen_ejecutivo": ["punto 1","punto 2","punto 3","punto 4"],
  "sentimiento": {"favorable":"__CALCULA__","neutral":"__CALCULA__","critico":"__CALCULA__"},
  "nivel_riesgo": "bajo|medio|alto|muy_alto (segun los datos)",
  "desglose_por_red": {
    "facebook":{"sentimiento":{"favorable":"__CALCULA__","neutral":"__CALCULA__","critico":"__CALCULA__"},"lectura":"2-3 frases: que pasa en esta red, quien mueve la conversacion, con ejemplos concretos de los datos","focos":["narrativa concreta detectada"],"recomendacion":"accion especifica para ESTA red","tendencia":"mejorando | estable | empeorando"}
  },
  "comparativa_historica": {
    "resumen": "2-3 frases de como evoluciono vs el periodo anterior (solo si se dio analisis anterior; si no, omite este campo)",
    "delta_favorable": 5,
    "delta_critico": -3,
    "alertas_resueltas": ["alerta anterior que ya no aparece"],
    "alertas_persistentes": ["alerta que sigue activa"]
  },
  "alertas": ["alerta 1"],
  "plan_accion": ["accion 1"],
  "oportunidades": ["oportunidad 1"],
  "analisis_voces": {
    "aliados_destacados": [{"username":"","platform":"","comentario_o_post":"","impacto":"Alto","tier":"micro","keywords":[],"followers":0,"likes":0,"engagement":0}],
    "criticos_destacados": [{"username":"","platform":"","comentario_o_post":"","impacto":"Medio","tier":"micro","keywords":[],"followers":0,"likes":0,"engagement":0}],
    "medios_destacados": [{"nombre":"El Heraldo de Mexico","dominio":"heraldodemexico.com.mx","platform":"google_news","alcance":"macro","notas":7,"tono":"neutral","temas":["cobertura Mundial","Nodal-Angela"],"titular_ejemplo":"titular real de una de sus notas"}]
  }
}

Reglas duras:
- No inventes datos. Aliados/criticos deben existir en los datos. Los porcentajes suman 100.
- CUANDO UN POST TRAIGA reacciones[👍 ❤️ 😂 😮 😢 😡]: usa el desglose como señal. Si 😂 (haha) o 😡 (angry) dominan o superan a 👍, es probable burla/molestia aunque el total de reacciones sea alto — menciónalo en la lectura con los números (ej: "el reel juntó 4,777 reacciones pero 2,664 son 😂 vs 1,400 👍: la gente se rie, no aplaude"). No infieras sentimiento SOLO por reacciones: crúzalo con los comentarios.
- NO incluyas las cuentas propias de Pepe Aguilar (pepeaguilar_oficial, PepeAguilar, etc.) ni a él mismo como aliado o contrario: él es el sujeto del análisis, no una voz externa.
- SE ESPECIFICO SIEMPRE: cada punto del resumen_ejecutivo, cada alerta y cada oportunidad debe decir QUIEN (autor con @ o nombre del medio), DONDE (en que red), CUANDO (fecha) y CUANTO (numeros reales: likes, comentarios, views, cantidad de notas o posts). Prohibido lo ambiguo tipo "se confirma X" o "hay criticas" sin decir quien lo publico, en que red y con que engagement. Ejemplo MAL: "Se confirma la realizacion de conciertos en Colombia". Ejemplo BIEN: "El Heraldo de Mexico publico el 1 jul la confirmacion de conciertos en Neiva, Colombia; la nota fue replicada en 3 medios mas y el post de @radioformula en X junto 5,839 likes".
- CUANDO HAYA COMENTARIOS EXTRAIDOS: cita 1-2 comentarios textualmente (entre comillas, breves) que representen lo que dijo la gente, para no quedarte solo en la metrica. Ejemplo: "el post junto 450k likes; los comentarios celebran ('por fin unidos como familia') aunque algunos critican ('puro show mediatico')". Prioriza citar comentarios reales por encima de generalizar.
- LOS NUMEROS DEL EJEMPLO SON ILUSTRATIVOS. NO los copies. Calcula los porcentajes REALES: cuenta cuantos posts/comentarios son favorables, neutrales y criticos en los datos y convierte a porcentaje. Muestra tu conteo en la lectura (ej: "de 45 comentarios, 12 favorables, 8 criticos").
- NUNCA uses 0/100/0 como fallback. Si una red no tiene muestra suficiente para clasificar, OMITELA del desglose_por_red. Solo incluye redes con evidencia real.
- La lectura de cada red debe citar evidencia concreta (autores, temas, numeros), no generalidades.
- medios_destacados es EXCLUSIVAMENTE para fuentes de prensa de google_news (notas de prensa). NO pongas ahi cuentas de Instagram/Facebook/X/TikTok aunque sean paginas de medios o espectaculos — esas van en aliados_destacados o criticos_destacados segun su tono. Incluye toda fuente de google_news con al menos 1 nota: nombre, dominio web del medio (ej "heraldodemexico.com.mx" — deducelo de la URL de la nota si esta en los datos), platform "google_news", alcance ("macro" nacional, "medio" regional), cuantas notas, tono y temas.
- Si se dio analisis del periodo anterior, calcula tendencia por red y llena comparativa_historica con deltas reales. Si no, omite comparativa_historica y usa "estable".
- ANCLA EL ANALISIS AL MARCO ESTRATEGICO de abajo: cada recomendacion (resumen_ejecutivo, plan_accion, oportunidades, recomendacion por red) debe estar guiada por los pilares y mensajes clave. Si un tema reactivo (Angela, Nodal, amuleto Tri, etc.) aparece, considera el pivote del marco al recomendar. No agregues campos extra al JSON: el marco guia el CONTENIDO del analisis normal, no cambia su estructura.

${MESSAGE_FRAMEWORK_PROMPT}

${dataPrompt}`;

export async function callAI(apiKey, prompt, models, systemPrompt = AI_PROMPT_SYSTEM) {
  const AI_TIMEOUT_MS = 90000; // corta un modelo colgado en vez de bloquear toda la corrida
  for (const model of models) {
    // 2 intentos por modelo (timeouts intermitentes), luego pasa al siguiente modelo.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/BrandonBlackwell-ui/DashboardPP',
            'X-Title': 'Blackwell Dashboard',
          },
          body: JSON.stringify({
            model, response_format: { type: 'json_object' },
            messages: [
              { role:'system', content: systemPrompt },
              { role:'user', content: prompt },
            ],
          }),
          signal: AbortSignal.timeout(AI_TIMEOUT_MS),
        });
        const json = await res.json();
        if (json.error) { console.warn(`${model} falló: ${json.error.message}`); break; }
        const text = json.choices?.[0]?.message?.content;
        if (!text) break;
        const start = text.indexOf('{'); const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) break;
        return { model, analysis: JSON.parse(text.slice(start, end+1)) };
      } catch (e) {
        const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
        console.warn(`${model} intento ${attempt} ${timedOut ? 'timeout' : 'error'}: ${e?.message || e}`);
        if (attempt >= 2) break; // agotó reintentos → siguiente modelo
      }
    }
  }
  throw new Error('Todos los modelos AI fallaron');
}

async function enrichAndSaveAI(apiKey, themeKey, dateKey, allPostsByTheme) {
  const { data: rep } = await supabase.from('reports').select('id,theme_key,date_key').eq('date_key', dateKey).eq('theme_key', themeKey).limit(1);
  if (!rep?.length) return null;
  const report = rep[0];

  const models = themeKey === 'resumen'
    ? ['z-ai/glm-5.2', 'anthropic/claude-sonnet-5', 'google/gemini-2.5-flash']
    : ['z-ai/glm-5.2', 'google/gemini-2.5-flash-lite', 'google/gemini-2.5-flash'];

  // Análisis del período anterior → deja calcular tendencia real
  let previousAnalysis = null;
  {
    const { data: prev } = await supabase.from('reports')
      .select('date_key, ai_analysis')
      .eq('theme_key', themeKey)
      .lt('date_key', dateKey)
      .not('ai_analysis', 'is', null)
      .order('date_key', { ascending: false })
      .limit(1);
    if (prev?.length) previousAnalysis = prev[0];
  }

  let posts = [];
  let prompt;

  if (themeKey === 'resumen') {
    // Panorama: consolida los resultados YA analizados por red (no re-lee comentarios crudos)
    const { data: netReps } = await supabase.from('reports')
      .select('theme_key, ai_analysis')
      .eq('date_key', dateKey)
      .neq('theme_key', 'resumen')
      .not('ai_analysis', 'is', null);
    const networkResults = (netReps || [])
      .map(r => ({ theme: r.theme_key, ai: r.ai_analysis }))
      .filter(r => r.ai);
    // Posts (sin comentarios) solo para enriquecer métricas de voces
    const { data: allReps } = await supabase.from('reports').select('id').eq('date_key', dateKey).neq('theme_key', 'resumen');
    const allRepIds = (allReps || []).map(r => r.id);
    if (allRepIds.length) {
      const { data: allPostRecs } = await supabase.from('scraped_posts')
        .select('platform,username,text,url,published_date,likes,comments_count,views,followers')
        .in('report_id', allRepIds);
      posts = allPostRecs || [];
    }
    prompt = AI_PROMPT_TEMPLATE(buildResumenPrompt({ networkResults, previousAnalysis }));
  } else {
    // Red individual: posts + muestra de comentarios crudos.
    // Preferir SIEMPRE los registros de la BD: traen texto, red y el desglose de
    // reacciones fb_*; los posts en memoria (insertPosts) solo traen id/url/likes.
    const { data: postRecs } = await supabase.from('scraped_posts')
      .select('id,platform,username,text,url,published_date,likes,comments_count,views,followers,fb_like,fb_love,fb_haha,fb_wow,fb_sad,fb_angry')
      .eq('report_id', report.id);
    const postIds = (postRecs || []).map(p => p.id);
    posts = postRecs?.length ? postRecs : (allPostsByTheme[themeKey] || []);
    let comments = [];
    if (postIds.length) {
      const { data: cmts } = await supabase.from('scraped_comments').select('*').in('post_id', postIds);
      comments = cmts || [];
    }
    prompt = AI_PROMPT_TEMPLATE(buildDataPrompt({ report, posts, comments, previousAnalysis }));
  }

  const { model, analysis } = await callAI(apiKey, prompt, models);

  // Normaliza sentimiento a enteros (GLM a veces devuelve "33", "25%" o "37.5")
  const toInt = v => { const n = Math.round(parseFloat(String(v).replace(/[^0-9.-]/g, ''))); return Number.isFinite(n) ? n : 0; };
  const fixSent = s => {
    if (!s || typeof s !== 'object') return s;
    return { favorable: toInt(s.favorable), neutral: toInt(s.neutral), critico: toInt(s.critico) };
  };
  if (analysis.sentimiento) analysis.sentimiento = fixSent(analysis.sentimiento);
  if (analysis.desglose_por_red) {
    for (const k of Object.keys(analysis.desglose_por_red)) {
      const red = analysis.desglose_por_red[k];
      if (red?.sentimiento) red.sentimiento = fixSent(red.sentimiento);
    }
  }
  if (analysis.comparativa_historica) {
    analysis.comparativa_historica.delta_favorable = toInt(analysis.comparativa_historica.delta_favorable);
    analysis.comparativa_historica.delta_critico = toInt(analysis.comparativa_historica.delta_critico);
  }

  // Enrich voice metrics from real scraped data
  const metricsMap = {};
  posts.forEach(p => {
    const key = (p.username||'').toLowerCase().replace(/^@/,'');
    if (!key) return;
    if (!metricsMap[key]) metricsMap[key] = { likes:0, comments:0, views:0, followers:0, engagement:0 };
    metricsMap[key].likes    += +(p.likes||0);
    metricsMap[key].comments += +(p.comments_count||0);
    metricsMap[key].views    += +(p.views||0);
    metricsMap[key].followers = Math.max(metricsMap[key].followers, +(p.followers||0));
    metricsMap[key].engagement = metricsMap[key].likes + metricsMap[key].comments*2 + metricsMap[key].views*0.01;
  });
  const enrich = v => {
    const m = metricsMap[(v.username||'').toLowerCase().replace(/^@/,'')] || {};
    return { ...v, followers: m.followers||v.followers||0, likes: m.likes||v.likes||0, engagement: Math.round(m.engagement||v.engagement||0) };
  };
  if (analysis.analisis_voces?.aliados_destacados) analysis.analisis_voces.aliados_destacados = analysis.analisis_voces.aliados_destacados.map(enrich);
  if (analysis.analisis_voces?.criticos_destacados) analysis.analisis_voces.criticos_destacados = analysis.analisis_voces.criticos_destacados.map(enrich);

  // Nuevo análisis = borrador; el admin debe aprobarlo para que lo vea el cliente.
  // Resiliente por si la columna 'approved' aún no existe en Supabase.
  const { error: upErr } = await supabase.from('reports').update({ ai_analysis: analysis, approved: false }).eq('id', report.id);
  if (upErr) await supabase.from('reports').update({ ai_analysis: analysis }).eq('id', report.id);

  // Segunda llamada — SOLO en el panorama: "analisis del analisis" que explica el porque
  // citando el documento de mensajes. Es de uso interno (admin); el cliente no lo ve.
  if (themeKey === 'resumen') {
    try {
      const { analysis: rationale } = await callAI(apiKey, buildRationalePrompt(analysis), models, RATIONALE_SYSTEM);
      const { error: rErr } = await supabase.from('reports').update({ admin_rationale: rationale }).eq('id', report.id);
      if (rErr) console.warn(`[analisis] no se pudo guardar admin_rationale (¿existe la columna?): ${rErr.message}`);
    } catch (e) { console.warn(`[analisis] fundamento admin falló: ${e?.message || e}`); }
  }

  return { themeKey, model, sentimiento: analysis.sentimiento, nivel_riesgo: analysis.nivel_riesgo };
}

// ─── Exportable orchestrator ──────────────────────────────────────────────────
export async function runFullAnalysis({ apifyToken, aiKey, date, from, to, emit = console.log }) {
  const DATE       = date || new Date().toISOString().slice(0,10);
  const DNEXT      = nextDay(DATE);
  const OWNED_FROM = daysAgo(DATE, 7); // propios: últimos 7 días

  // Ventana exacta opcional (ISO con zona, ej. '2026-07-14T17:00:00-06:00'): si viene,
  // TODAS las fuentes recortan por timestamp exacto; sin ella, el día completo DATE.
  const hasWindow = !!(from && to && !Number.isNaN(Date.parse(from)) && !Number.isNaN(Date.parse(to)));
  const fromTs = hasWindow ? Date.parse(from) : dayStartTs(DATE);
  const toTs   = hasWindow ? Date.parse(to)   : dayStartTs(DNEXT);

  // Prensa: ventana propia (lookback de N días) y timeframe relativo del actor de GN.
  // El actor filtra relativo a HOY; elegimos el bucket mínimo que cubre la ventana y
  // el recorte exacto lo hace inRange().
  const newsFromTs = hasWindow ? fromTs : dayStartTs(NEWS_LOOKBACK_DAYS > 1 ? daysAgo(DATE, NEWS_LOOKBACK_DAYS - 1) : DATE);
  const newsToTs   = toTs;
  const newsDaysBack = Math.max(0, Math.ceil((Date.now() - newsFromTs) / 86400000));
  const newsTimeframe = newsDaysBack <= 1 ? '1d' : newsDaysBack <= 7 ? '7d' : newsDaysBack <= 30 ? '30d' : newsDaysBack <= 365 ? '1y' : 'all';

  const summary = { date: DATE, window: hasWindow ? { from, to } : { day: DATE }, phases: {}, posts: {}, comments: {}, ai: {}, startedAt: new Date().toISOString() };
  const allSavedPosts = {}; // themeKey → array of saved post records {id, url, likes, comments_count}

  // ── FASE A: Todo Apify en paralelo ─────────────────────────────────────────
  emit({ type:'phase', phase:'A', msg:'Iniciando scraping en paralelo (público + propios)...' });

  const [fbR, igR, xR, ttR, gnR, ownIgR, ownFbR, ownTtR, ownYtR, ownXR, wlR, fbwR] = await Promise.allSettled([
    // Público
    runActor(apifyToken, 'igview-owner/facebook-old-posts-search',
      { query:'"Pepe Aguilar" OR "los Aguilar"', startDate:DATE, endDate:DATE, maxResults:50 }, 0.12, 'fb_search'),
    runActor(apifyToken, 'apidojo/instagram-hashtag-scraper',
      { keyword:'pepeaguilar', until:DATE, getPosts:true, getReels:false, maxItems:25 }, 0.05, 'ig_hash1').then(async r1 => {
        const r3 = await runActor(apifyToken, 'apidojo/instagram-hashtag-scraper',
          { keyword:'losaguilar', until:DATE, getPosts:true, getReels:false, maxItems:25 }, 0.05, 'ig_hash3');
        return [...r1, ...r3];
      }),
    runActor(apifyToken, 'apidojo/tweet-scraper',
      { searchTerms:[`"Pepe Aguilar" OR "los Aguilar" -filter:retweets -filter:replies since:${DATE} until:${DNEXT}`],
        sort:'Top', maxItems:100 }, 0.10, 'x_search'),
    runActor(apifyToken, 'sentry/tiktok-search-api',
      { keywords:['Pepe Aguilar', 'los Aguilar'], maxVideosPerKeyword:15, maxVideosTotal:30, sortOrder:'mostViews', datePosted:'today', includePhotoPosts:false }, 0.15, 'tt_search'),
    runActor(apifyToken, 'data_xplorer/google-news-scraper-fast',
      { keywords: GN_KEYWORDS, region_language: process.env.GOOGLE_NEWS_REGION || 'MX:es-419', timeframe: newsTimeframe,
        maxArticles: GN_MAX_ARTICLES, decodeUrls:true, extractDescriptions:true, extractImages:false,
        proxyConfiguration: { useApifyProxy: true } }, GN_CAP, 'gn'),
    // Propios
    runActor(apifyToken, 'coderx/instagram-profile-scraper-api',
      { usernames:[OWNED.instagram] }, 0.03, 'own_ig'),
    // apify/facebook-posts-scraper ($2/1000, más barato que unseenuser $5/1000) y con
    // desglose de reacciones por post — verificado 2026-07-15 con la página de Pepe.
    runActor(apifyToken, 'apify/facebook-posts-scraper',
      { startUrls: [{ url: `https://www.facebook.com/${OWNED.facebook}` }], resultsLimit: 5 }, 0.05, 'own_fb'),
    runActor(apifyToken, 'clockworks/tiktok-profile-scraper',
      { profiles:[OWNED.tiktok], resultsPerPage:13, shouldDownloadCovers:false, shouldDownloadSlideshowImages:false, shouldDownloadSubtitles:false, shouldDownloadVideos:false }, 0.04, 'own_tt'),
    fetchYouTubeRSS(),
    runActor(apifyToken, 'scraper_one/x-profile-posts-scraper',
      { profileUrls:[OWNED.x], resultsLimit:10, skipPinnedPosts:true }, 0.05, 'own_x'),
    // Prensa gratis: watchlist RSS (portales + Google News RSS). Sin Apify, $0.
    scrapeWatchlist(MEDIA_WATCHLIST, WATCHLIST_SEARCH_TERMS, newsFromTs, newsToTs, isRelevantNews,
      m => emit({ type:'log', msg: m })),
    // Páginas de FB de medios vigiladas (~$0.06 c/u). Lista vacía → no corre nada.
    FACEBOOK_WATCH_PAGES.length ? (async () => {
      const rs = await Promise.allSettled(FACEBOOK_WATCH_PAGES.map(pg =>
        runActor(apifyToken, 'unseenuser/fb-posts',
          { mode:'profile', sources:[pg.source], maxPosts:20, includeTopComments:false,
            fetchAllComments:false, fetchCommentReplies:false, enrichSinglePostFields:false }, 0.06, `fbw:${pg.name}`)
          .then(items => ({ pg, items }))));
      const out = [];
      for (const r of rs) {
        if (r.status === 'rejected') { emit({ type:'error', msg:`fb_page: ${r.reason?.message}` }); continue; }
        const posts = normWatchFacebook(r.value.items, r.value.pg.name, fromTs, toTs);
        emit({ type:'log', msg:`fb_page ${r.value.pg.name}: ${posts.length} posts (de ${r.value.items.length} recientes)` });
        out.push(...posts);
      }
      return out;
    })() : Promise.resolve([]),
  ]);

  emit({ type:'phase_done', phase:'A', msg:'Scraping completado. Guardando en Supabase...' });

  // Prensa combinada multi-vía, en orden de calidad de URL para el dedup:
  // portales de la watchlist (URL real) → actor de GN (URL decodificada) → Google News RSS (redirects).
  const wlPosts = wlR.status === 'fulfilled' ? (wlR.value || []) : [];
  if (wlR.status === 'rejected') emit({ type:'error', msg:`prensa_watchlist: ${wlR.reason?.message}` });
  const wlPortals   = wlPosts.filter(p => !/google news rss/i.test(p.via || ''));
  const wlGoogleRss = wlPosts.filter(p =>  /google news rss/i.test(p.via || ''));
  const gnPosts = gnR.status === 'fulfilled' ? normGoogleNews(gnR.value, newsFromTs, newsToTs) : [];
  const pressPosts = dedupePress([...wlPortals, ...gnPosts, ...wlGoogleRss]);
  if (wlPosts.length) emit({ type:'log', msg:`prensa: ${pressPosts.length} notas únicas (${wlPortals.length} portales + ${gnPosts.length} actor GN + ${wlGoogleRss.length} GN RSS, antes de dedup)` });

  // Posts de páginas de FB vigiladas → se integran a la red Facebook.
  const fbwPosts = fbwR.status === 'fulfilled' ? (fbwR.value || []) : [];

  // Normalizar y guardar — público
  const nets = [
    { key:'facebook',    result:fbR,  norm: items => [...normFacebook(items, fromTs, toTs), ...fbwPosts], label:'Facebook', cap:50 },
    { key:'instagram',   result:igR,  norm: items => normInstagram(items, fromTs, toTs),  label:'Instagram',   cap:75  },
    { key:'x',           result:xR,   norm: items => normX(items, fromTs, toTs),          label:'X',           cap:100 },
    { key:'tiktok',      result:ttR,  norm: items => normTikTok(items, fromTs, toTs),     label:'TikTok',      cap:30  },
    // La prensa ya viene normalizada y deduplicada (actor + watchlist); si el actor de GN
    // falló pero la watchlist trajo notas, la red no se cae.
    { key:'google_news', result: (gnR.status === 'fulfilled' || wlPosts.length) ? { status:'fulfilled', value: pressPosts } : gnR,
      norm: items => items, label:'Google News', cap:0 },
  ];

  for (const { key, result, norm, label, cap } of nets) {
    if (result.status === 'rejected') { summary.posts[key] = { error: result.reason?.message }; continue; }
    const rawCount = Array.isArray(result.value) ? result.value.length : 0;
    const posts = norm(result.value);
    if (key === 'tiktok') await attachTikTokTranscripts(posts);
    const truncated = cap && rawCount >= cap;
    summary.posts[key] = { count: posts.length, raw: rawCount, truncated };
    emit({ type:'saved', net:key, count:posts.length });
    if (truncated) {
      emit({ type:'warn', net:key, msg:`${label} llegó al tope de ${cap} resultados — probablemente hay más publicaciones de este día que no se extrajeron.` });
    }
    if (!posts.length) continue;
    const reportId = await upsertReport(key, label, DATE);
    const saved = await insertPosts(reportId, key, posts);
    allSavedPosts[key] = saved;
  }

  // Normalizar y guardar — propios
  const ownedNorms = [
    { key:'instagram', result:ownIgR, norm: items => normOwnedInstagram(items) },
    { key:'facebook',  result:ownFbR, norm: items => normOwnedFacebook(items) },
    { key:'tiktok',    result:ownTtR, norm: items => normOwnedTikTok(items) },
    { key:'youtube',   result:ownYtR, norm: items => items }, // already normalized by fetchYouTubeRSS
    { key:'x',         result:ownXR,  norm: items => normOwnedX(items) },
  ];

  const ownedPostsByPlatform = {};
  const reportIdOwned = await upsertReport('redes_propias', 'Redes Propias', DATE);

  for (const { key, result, norm } of ownedNorms) {
    if (result.status === 'rejected') {
      const errMsg = result.reason?.message || String(result.reason);
      summary.posts[`owned_${key}`] = { error: errMsg };
      emit({ type:'error', msg:`owned_${key}: ${errMsg}` });
      continue;
    }
    const rawCount = Array.isArray(result.value) ? result.value.length : 0;
    const posts = norm(result.value);
    if (key === 'tiktok') await attachTikTokTranscripts(posts);
    summary.posts[`owned_${key}`] = { count: posts.length, raw: rawCount };
    emit({ type:'saved', net:`owned_${key}`, count:posts.length });
    if (!posts.length) continue;
    const saved = await insertPosts(reportIdOwned, 'redes_propias', posts);
    ownedPostsByPlatform[key] = saved; // [{id, url, likes, comments_count}]
  }

  // ── FASE B: Comentarios propios en paralelo ───────────────────────────────
  emit({ type:'phase', phase:'B', msg:'Scraping comentarios de redes propias...' });

  const selectTopPosts = (posts, n=3) =>
    [...(posts||[])].sort((a,b) => (b.likes+b.comments_count*2) - (a.likes+a.comments_count*2)).slice(0, n);

  const commentJobs = [];

  // Filtra comentarios al día de análisis (para redes propias)
  const filterCommentsByDate = (comments, dateKey) =>
    comments.filter(c => !c.published_time || c.published_time.slice(0,10) === dateKey);

  const addCommentJob = (label, posts, actorId, inputFn, maxCharge, normFn, filterByDate = false) => {
    if (!posts.length) return;
    commentJobs.push(
      Promise.allSettled(posts.map(p =>
        runActor(apifyToken, actorId, inputFn(p), maxCharge, `cmnt_${label}`)
          .then(items => {
            let normed = normFn(items);
            if (filterByDate) normed = filterCommentsByDate(normed, DATE);
            emit({ type:'comments_scraped', net:label, url:p.url, count:normed.length });
            summary.comments[label] = (summary.comments[label] || 0) + normed.length;
            return insertComments(p.id, normed);
          })
          .catch(e => emit({ type:'error', msg:`cmnt_${label}: ${e.message}` }))
      ))
    );
  };

  const ownedIgPosts = selectTopPosts(ownedPostsByPlatform.instagram);
  const ownedFbPosts = selectTopPosts(ownedPostsByPlatform.facebook);
  const ownedTtPosts = selectTopPosts(ownedPostsByPlatform.tiktok);
  const ownedYtPosts = selectTopPosts(ownedPostsByPlatform.youtube);
  const ownedXPosts  = selectTopPosts(ownedPostsByPlatform.x);

  // Propios: solo comentarios de hoy (filterByDate = true)
  addCommentJob('owned_ig', ownedIgPosts, 'apify/instagram-comment-scraper',
    p => ({ directUrls:[p.url], resultsLimit:50, includeNestedComments:false }), 0.08, normCommentIG, true);

  addCommentJob('owned_fb', ownedFbPosts, 'apify/facebook-comments-scraper',
    p => ({ startUrls:[{url:p.url}], resultsLimit:50, includeNestedComments:false }), 0.05, normCommentFB, true);

  addCommentJob('owned_tt', ownedTtPosts, 'clockworks/tiktok-comments-scraper',
    p => ({ postURLs:[p.url], commentsPerPost:50, maxRepliesPerComment:0 }), 0.05, normCommentTT, true);

  // YouTube no devuelve fecha en comentarios — tomamos los 20 más recientes sin filtro
  addCommentJob('owned_yt', ownedYtPosts, 'apidojo/youtube-comments-scraper',
    p => ({ startUrls:[p.url], sort:'latest', maxItems:20, includeReplies:false }), 0.03, normCommentYT, false);

  addCommentJob('owned_x', ownedXPosts, 'scraper_one/x-post-replies-scraper',
    p => ({ postUrls:[p.url], maxItems:50 }), 0.05, normCommentX, true);

  // También: top posts de social listening por comentarios (FB, IG, TikTok)
  const selectTopByComments = (posts, n=3) =>
    [...(posts||[])].sort((a,b) => b.comments_count - a.comments_count).slice(0, n);

  // SL: top 3 por engagement (likes + comentarios×2), max 20 comentarios c/u
  const slFbPosts  = selectTopPosts(allSavedPosts.facebook);
  const slIgPosts  = selectTopPosts(allSavedPosts.instagram);
  const slTtPosts  = selectTopPosts(allSavedPosts.tiktok);
  const slXPosts   = selectTopPosts(allSavedPosts.x);

  // SL: sin filtro de fecha — queremos los 20 comentarios más recientes del post
  addCommentJob('sl_fb', slFbPosts, 'apify/facebook-comments-scraper',
    p => ({ startUrls:[{url:p.url}], resultsLimit:20, includeNestedComments:false }), 0.05, normCommentFB, false);

  addCommentJob('sl_ig', slIgPosts, 'apify/instagram-comment-scraper',
    p => ({ directUrls:[p.url], resultsLimit:20, includeNestedComments:false }), 0.08, normCommentIG, false);

  addCommentJob('sl_tt', slTtPosts, 'clockworks/tiktok-comments-scraper',
    p => ({ postURLs:[p.url], commentsPerPost:20, maxRepliesPerComment:0 }), 0.05, normCommentTT, false);

  addCommentJob('sl_x', slXPosts, 'scraper_one/x-post-replies-scraper',
    p => ({ postUrls:[p.url], maxItems:25 }), 0.05, normCommentX, false);

  await Promise.allSettled(commentJobs);
  emit({ type:'phase_done', phase:'B', msg:'Comentarios guardados (propios + social listening).' });

  // ── FASE C: AI por red en paralelo (Gemini) ───────────────────────────────
  emit({ type:'phase', phase:'C', msg:'Análisis IA por red (paralelo)...' });

  const aiNets = ['facebook','instagram','x','tiktok','google_news','redes_propias'];
  const aiResults = await Promise.allSettled(
    aiNets.map(net => enrichAndSaveAI(aiKey, net, DATE, allSavedPosts).then(r => { emit({ type:'ai_done', net, result:r }); return r; }))
  );

  aiResults.forEach((r, i) => {
    summary.ai[aiNets[i]] = r.status === 'fulfilled' ? r.value : { error: r.reason?.message };
  });
  emit({ type:'phase_done', phase:'C', msg:'Análisis IA por red completado.' });

  // ── FASE D: Panorama Opus ─────────────────────────────────────────────────
  emit({ type:'phase', phase:'D', msg:'Panorama consolidado con Opus...' });
  try {
    // Ensure resumen report exists
    await upsertReport('resumen', 'Panorama Consolidado', DATE);
    const panorama = await enrichAndSaveAI(aiKey, 'resumen', DATE, allSavedPosts);
    summary.ai.resumen = panorama;
    emit({ type:'ai_done', net:'resumen', result:panorama });
  } catch(e) {
    summary.ai.resumen = { error: e.message };
    emit({ type:'error', phase:'D', msg:e.message });
  }

  summary.finishedAt = new Date().toISOString();
  emit({ type:'done', summary });
  return summary;
}

// ─── Re-análisis IA sin scraping — usa los posts/comentarios ya guardados en Supabase ──
export async function runAIOnly({ aiKey, date, emit = () => {} }) {
  const DATE = date || new Date().toISOString().slice(0, 10);
  const summary = { date: DATE, ai: {}, mode: 'ai-only', startedAt: new Date().toISOString() };

  emit({ type:'phase', phase:'C', msg:`Re-análisis IA con data existente del ${DATE} (sin Apify)...` });
  const aiNets = ['facebook','instagram','x','tiktok','google_news','redes_propias'];
  const results = await Promise.allSettled(
    aiNets.map(net => enrichAndSaveAI(aiKey, net, DATE, {}).then(r => { emit({ type:'ai_done', net, result:r }); return r; }))
  );
  results.forEach((r, i) => {
    summary.ai[aiNets[i]] = r.status === 'fulfilled' ? r.value : { error: r.reason?.message };
  });

  emit({ type:'phase', phase:'D', msg:'Panorama consolidado...' });
  try {
    await upsertReport('resumen', 'Panorama Consolidado', DATE);
    const panorama = await enrichAndSaveAI(aiKey, 'resumen', DATE, {});
    summary.ai.resumen = panorama;
    emit({ type:'ai_done', net:'resumen', result:panorama });
  } catch(e) {
    summary.ai.resumen = { error: e.message };
    emit({ type:'error', phase:'D', msg:e.message });
  }

  summary.finishedAt = new Date().toISOString();
  emit({ type:'done', summary });
  return summary;
}

// ─── Scrape dirigido de TODOS los comentarios de URLs específicas (deep-dive) ──
// items: [{ platform:'instagram'|'tiktok'|'facebook', url }]. Devuelve todos los comentarios por pieza.
export async function scrapeCommentsForUrls({ apifyToken, items, limit = 300, emit = () => {} }) {
  const out = [];
  for (const { platform, url } of (items || [])) {
    try {
      let raw = [], comments = [];
      if (platform === 'instagram') {
        raw = await runActor(apifyToken, 'apify/instagram-comment-scraper',
          { directUrls:[url], resultsLimit:limit, includeNestedComments:false }, 0.30, 'dc_ig');
        comments = normCommentIG(raw);
      } else if (platform === 'tiktok') {
        raw = await runActor(apifyToken, 'clockworks/tiktok-comments-scraper',
          { postURLs:[url], commentsPerPost:limit, maxRepliesPerComment:0 }, 0.30, 'dc_tt');
        comments = normCommentTT(raw);
      } else if (platform === 'facebook') {
        raw = await runActor(apifyToken, 'apify/facebook-comments-scraper',
          { startUrls:[{ url }], resultsLimit:limit, includeNestedComments:false }, 0.25, 'dc_fb');
        comments = normCommentFB(raw);
      } else {
        throw new Error(`plataforma no soportada: ${platform}`);
      }
      comments.sort((a,b) => (b.likes||0) - (a.likes||0));
      emit({ type:'comments', platform, url, count: comments.length });
      out.push({ platform, url, count: comments.length, comments });
    } catch (e) {
      emit({ type:'error', platform, url, msg: e.message });
      out.push({ platform, url, error: e.message });
    }
  }
  return out;
}

// ─── CLI directo ──────────────────────────────────────────────────────────────
if (process.argv[1]?.endsWith('run-full-analysis.js')) {
  const args  = process.argv.slice(2);
  const apify = args.find(a => !a.startsWith('--'));
  const ai    = args.filter(a => !a.startsWith('--'))[1];
  const date  = args.find(a => a.startsWith('--date='))?.split('=')[1];

  if (!apify || !ai) {
    console.error('Uso: node scripts/run-full-analysis.js <APIFY_TOKEN> <OPENROUTER_KEY> [--date=YYYY-MM-DD]');
    process.exit(1);
  }

  const emit = ev => {
    if (ev.type === 'phase')      console.log(`\n▶ FASE ${ev.phase}: ${ev.msg}`);
    else if (ev.type === 'phase_done') console.log(`✓ ${ev.msg}`);
    else if (ev.type === 'saved') console.log(`  └ ${ev.net}: ${ev.count} posts guardados`);
    else if (ev.type === 'ai_done') console.log(`  └ AI ${ev.net}: ${ev.result?.sentimiento ? JSON.stringify(ev.result.sentimiento) : ev.result?.error}`);
    else if (ev.type === 'error') console.error(`  ✗ ${ev.msg}`);
    else if (ev.type === 'done')  console.log('\n═══ ANÁLISIS COMPLETO ═══\n', JSON.stringify(ev.summary, null, 2));
  };

  runFullAnalysis({ apifyToken: apify, aiKey: ai, date, emit }).catch(e => { console.error(e); process.exit(1); });
}

// Exportados para pruebas (la watchlist es RSS gratis y se puede validar sin Apify).
export { scrapeWatchlist, parseRssItems, fetchFeed, dedupePress, normOwnedFacebook, MEDIA_WATCHLIST, WATCHLIST_SEARCH_TERMS };
