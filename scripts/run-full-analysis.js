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
const RELEVANT_KW = ['pepe aguilar','pepeaguilar','angela aguilar','angelaaguilar',
  'leonardo aguilar','leonardoaguilar','emiliano aguilar','aneliz','antonio aguilar',
  'familia aguilar','familiaaguilar','dinast','los aguilar','losaguilar','aguilar'];
const isRelevant = t => RELEVANT_KW.some(k => (t||'').toLowerCase().includes(k));

const nextDay  = d => { const dt = new Date(d+'T12:00:00Z'); dt.setDate(dt.getDate()+1); return dt.toISOString().slice(0,10); };
const daysAgo  = (d, n) => { const dt = new Date(d+'T12:00:00Z'); dt.setDate(dt.getDate()-n); return dt.toISOString().slice(0,10); };
const inDate   = (dateStr, from, to) => { if (!dateStr) return true; const d = dateStr.slice(0,10); return d >= from && d < to; };

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
  const rows = posts.map(p => ({ ...p, report_id: reportId, theme_key: themeKey, sentiment: null }));
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
})).filter(p => p.text && p.url && inDate(p.published_date, from, to) && isRelevant(p.text));

const normFacebook = (items, from, to) => items.map(p => {
  const rx = +(p.reactions_count || p.reactionsCount || 0);
  return {
    platform:'facebook', username: p.author?.name || p.authorName || '',
    text: p.message || p.text || '', url: p.url || p.postUrl || '',
    published_date: p.date || p.publishedAt || null,
    likes: rx || +(p.like || p.likes || 0),
    comments_count: +(p.comments_count || p.commentsCount || 0),
    shares: +(p.reshare_count || p.shares || 0), retweets:0, views:0,
  };
}).filter(p => p.text && p.url && inDate(p.published_date, from, to) && isRelevant(p.text));

const normInstagram = (items, from, to) => items.map(p => {
  const code = p.code || p.shortCode || '';
  return {
    platform:'instagram', username: p.owner?.username || p.ownerUsername || p.username || '',
    text: p.caption || p.text || '', url: p.url || p.postUrl || (code ? `https://www.instagram.com/p/${code}/` : ''),
    published_date: p.createdAt || p.taken_at_date || p.timestamp || null,
    likes: +(p.likeCount || p.likesCount || 0), comments_count: +(p.commentCount || p.commentsCount || 0),
    views: +(p.video?.playCount || p.videoPlayCount || 0), shares:0, retweets:0,
  };
}).filter(p => p.text && p.url && inDate(p.published_date, from, to) && isRelevant(p.text + p.username));

const normTikTok = (items, from, to) => items.map(p => ({
  platform:'tiktok', username: p.author || p.nickname || p.authorMeta?.name || '',
  text: p.desc || p.description || '', url: p.url || p.webVideoUrl || '',
  published_date: p.createTimeISO || p.createdAt || (p.createTime ? new Date(p.createTime*1000).toISOString() : null),
  likes: +(p.diggCount || p.likes || 0), comments_count: +(p.commentCount || p.comments || 0),
  shares: +(p.shareCount || 0), views: +(p.playCount || p.plays || 0), retweets:0,
  followers: +(p.followers || p.authorMeta?.fans || 0),
})).filter(p => p.text && p.url && inDate(p.published_date, from, to) && isRelevant(p.text + p.username));

const normGoogleNews = (items, from, to) => items.map(p => ({
  platform:'google_news', username: p.source || p.sourceDomain || '',
  text: p.title || '', url: p.articleUrl || p.link || '',
  published_date: p.publishedAt || p.date || null,
  likes:0, comments_count:0, shares:0, retweets:0, views:0,
})).filter(p => p.text && p.url && inDate(p.published_date, from, to) && isRelevant(p.text));

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

const normOwnedFacebook = (items) => items.slice(0, 5).map(p => ({
  platform:'facebook', username: p.authorName || 'Pepe Aguilar',
  text: p.text || p.message || '', url: p.permalink || p.url || '',
  published_date: p.publishTimeIso || p.date || null,
  likes: +(p.reactionCount || p.reactionsCount || 0),
  comments_count: +(p.commentCount || 0), shares:0, retweets:0, views:0,
})).filter(p => p.url);

const normOwnedTikTok = (items) => items
  .filter(p => !p.isPinned)
  .slice(0, 5)
  .map(p => ({
    platform:'tiktok', username: p.authorMeta?.name || 'pepeaguilar_oficial',
    text: p.text || p.desc || '', url: p.webVideoUrl || '',
    published_date: p.createTimeISO || (p.createTime ? new Date(p.createTime*1000).toISOString() : null),
    likes: +(p.diggCount || 0), comments_count: +(p.commentCount || 0),
    shares: +(p.shareCount || 0), views: +(p.playCount || 0), retweets:0,
  })).filter(p => p.url);

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

const normCommentYT = items => items.map(c => ({
  text: c.text || c.commentText || '', author: c.authorText || c.author || '',
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

function buildDataPrompt({ report, posts, comments }) {
  let out = `DATOS EXTRAIDOS PARA ANALISIS — ${report.theme_key} / ${report.date_key}\n\n`;
  out += `--- PUBLICACIONES (${posts.length}) ---\n`;
  posts.forEach((p, i) => {
    out += `${i+1}. [${p.platform}] @${p.username} | ${p.published_date?.slice(0,10)} | likes:${p.likes} comentarios:${p.comments_count} views:${p.views} | "${truncate(p.text)}" | ${p.url}\n`;
  });
  if (comments.length) {
    out += `\n--- COMENTARIOS EXTRAIDOS (${comments.length}) ---\n`;
    comments.slice(0,150).forEach((c,i) => {
      out += `${i+1}. @${c.author} | likes:${c.likes} | "${truncate(c.text, 300)}"\n`;
    });
  }
  return out;
}

const AI_PROMPT_SYSTEM = 'Eres un analista senior de reputacion y crisis para Pepe Aguilar. Responde solo JSON valido, sin markdown.';

const AI_PROMPT_TEMPLATE = (dataPrompt) => `Analiza los datos y devuelve SOLO JSON con esta estructura exacta:
{
  "resumen_ejecutivo": ["punto 1","punto 2","punto 3","punto 4"],
  "sentimiento": {"favorable":0,"neutral":100,"critico":0},
  "nivel_riesgo": "bajo",
  "desglose_por_red": {
    "facebook":{"sentimiento":{"favorable":0,"neutral":100,"critico":0},"lectura":"..."},
    "instagram":{"sentimiento":{"favorable":0,"neutral":100,"critico":0},"lectura":"..."},
    "x":{"sentimiento":{"favorable":0,"neutral":100,"critico":0},"lectura":"..."},
    "tiktok":{"sentimiento":{"favorable":0,"neutral":100,"critico":0},"lectura":"..."},
    "google_news":{"sentimiento":{"favorable":0,"neutral":100,"critico":0},"lectura":"..."}
  },
  "alertas": ["alerta 1"],
  "plan_accion": ["accion 1"],
  "oportunidades": ["oportunidad 1"],
  "analisis_voces": {
    "aliados_destacados": [{"username":"","platform":"","comentario_o_post":"","impacto":"Alto","tier":"micro","keywords":[],"followers":0,"likes":0,"engagement":0}],
    "criticos_destacados": [{"username":"","platform":"","comentario_o_post":"","impacto":"Medio","tier":"micro","keywords":[],"followers":0,"likes":0,"engagement":0}]
  }
}

Reglas: No inventes datos. Aliados/criticos deben existir en los datos. Los porcentajes suman 100.

${dataPrompt}`;

async function callAI(apiKey, prompt, models) {
  for (const model of models) {
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
          { role:'system', content: AI_PROMPT_SYSTEM },
          { role:'user', content: prompt },
        ],
      }),
    });
    const json = await res.json();
    if (json.error) { console.warn(`${model} falló: ${json.error.message}`); continue; }
    const text = json.choices?.[0]?.message?.content;
    if (!text) continue;
    const start = text.indexOf('{'); const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) continue;
    try { return { model, analysis: JSON.parse(text.slice(start, end+1)) }; }
    catch { continue; }
  }
  throw new Error('Todos los modelos AI fallaron');
}

async function enrichAndSaveAI(apiKey, themeKey, dateKey, allPostsByTheme) {
  // Pick posts for this theme
  let posts = allPostsByTheme[themeKey] || [];
  let comments = [];

  if (themeKey === 'resumen') {
    posts = Object.values(allPostsByTheme).flat();
  }

  const { data: rep } = await supabase.from('reports').select('id,theme_key,date_key').eq('date_key', dateKey).eq('theme_key', themeKey).limit(1);
  if (!rep?.length) return null;
  const report = rep[0];

  // Load comments — for resumen: pull from ALL reports of this date (social + propias)
  let postIds = [];
  if (themeKey === 'resumen') {
    const { data: allReps } = await supabase.from('reports').select('id').eq('date_key', dateKey);
    const allRepIds = (allReps || []).map(r => r.id);
    if (allRepIds.length) {
      const { data: allPostRecs } = await supabase.from('scraped_posts').select('id').in('report_id', allRepIds);
      postIds = (allPostRecs || []).map(p => p.id);
    }
    // Also add owned posts to the posts array for the AI prompt
    const { data: ownedPosts } = await supabase.from('scraped_posts')
      .select('platform,username,text,url,published_date,likes,comments_count,views')
      .in('report_id', allRepIds);
    const ownedOnly = (ownedPosts || []).filter(p => !posts.find(sp => sp.url === p.url));
    posts = [...posts, ...ownedOnly];
  } else {
    const postRecs = await supabase.from('scraped_posts').select('id').eq('report_id', report.id);
    postIds = (postRecs.data || []).map(p => p.id);
  }

  if (postIds.length) {
    const { data: cmts } = await supabase.from('scraped_comments').select('*').in('post_id', postIds);
    comments = cmts || [];
  }

  const models = themeKey === 'resumen'
    ? ['anthropic/claude-opus-4-8', 'anthropic/claude-sonnet-5', 'google/gemini-2.5-flash']
    : ['google/gemini-2.5-flash-lite', 'google/gemini-2.5-flash', 'anthropic/claude-haiku-4-5'];

  const prompt = AI_PROMPT_TEMPLATE(buildDataPrompt({ report, posts, comments }));
  const { model, analysis } = await callAI(apiKey, prompt, models);

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

  await supabase.from('reports').update({ ai_analysis: analysis }).eq('id', report.id);
  return { themeKey, model, sentimiento: analysis.sentimiento, nivel_riesgo: analysis.nivel_riesgo };
}

// ─── Exportable orchestrator ──────────────────────────────────────────────────
export async function runFullAnalysis({ apifyToken, aiKey, date, emit = console.log }) {
  const DATE       = date || new Date().toISOString().slice(0,10);
  const DNEXT      = nextDay(DATE);
  const OWNED_FROM = daysAgo(DATE, 7); // propios: últimos 7 días

  const summary = { date: DATE, phases: {}, posts: {}, comments: {}, ai: {}, startedAt: new Date().toISOString() };
  const allSavedPosts = {}; // themeKey → array of saved post records {id, url, likes, comments_count}

  // ── FASE A: Todo Apify en paralelo ─────────────────────────────────────────
  emit({ type:'phase', phase:'A', msg:'Iniciando scraping en paralelo (público + propios)...' });

  const [fbR, igR, xR, ttR, gnR, ownIgR, ownFbR, ownTtR, ownYtR, ownXR] = await Promise.allSettled([
    // Público
    runActor(apifyToken, 'igview-owner/facebook-old-posts-search',
      { query:'"Pepe Aguilar" OR "los Aguilar"', startDate:DATE, endDate:DATE, maxResults:50 }, 0.12, 'fb_search'),
    runActor(apifyToken, 'apidojo/instagram-hashtag-scraper',
      { keyword:'pepeaguilar', until:DATE, getPosts:true, getReels:false, maxItems:10 }, 0.05, 'ig_hash1').then(async r1 => {
        const r2 = await runActor(apifyToken, 'apidojo/instagram-hashtag-scraper',
          { keyword:'angelaaguilar', until:DATE, getPosts:true, getReels:false, maxItems:10 }, 0.05, 'ig_hash2');
        const r3 = await runActor(apifyToken, 'apidojo/instagram-hashtag-scraper',
          { keyword:'losaguilar', until:DATE, getPosts:true, getReels:false, maxItems:10 }, 0.05, 'ig_hash3');
        return [...r1, ...r2, ...r3];
      }),
    runActor(apifyToken, 'igolaizola/x-twitter-scraper-ppe',
      { query:'"Pepe Aguilar" OR "los Aguilar"', maxItems:100, minDate:DATE, maxDate:DNEXT, replies:'exclude', retweets:'exclude', quotes:'exclude' }, 1.00, 'x_search'),
    runActor(apifyToken, 'sentry/tiktok-search-api',
      { keywords:['Pepe Aguilar', 'los Aguilar'], maxVideosPerKeyword:10, maxVideosTotal:20, sortOrder:'mostViews', datePosted:'today', includePhotoPosts:false }, 0.10, 'tt_search'),
    runActor(apifyToken, 'sourabhbgp/google-news-scraper',
      { urls:['"Pepe Aguilar"'], mode:'search', maxResults:20, dateFrom:DATE, dateTo:DATE, language:'es', country:'MX', includeFullText:false, fullCoverage:false }, 0.04, 'gn'),
    // Propios
    runActor(apifyToken, 'coderx/instagram-profile-scraper-api',
      { usernames:[OWNED.instagram] }, 0.03, 'own_ig'),
    runActor(apifyToken, 'unseenuser/fb-posts',
      { mode:'profile', sources:[OWNED.facebook], maxPosts:5, includeTopComments:false, fetchAllComments:false, fetchCommentReplies:false, enrichSinglePostFields:false }, 0.05, 'own_fb'),
    runActor(apifyToken, 'clockworks/tiktok-profile-scraper',
      { profiles:[OWNED.tiktok], resultsPerPage:13, shouldDownloadCovers:false, shouldDownloadSlideshowImages:false, shouldDownloadSubtitles:false, shouldDownloadVideos:false }, 0.04, 'own_tt'),
    fetchYouTubeRSS(),
    runActor(apifyToken, 'scraper_one/x-profile-posts-scraper',
      { profileUrls:[OWNED.x], resultsLimit:10, skipPinnedPosts:true }, 0.05, 'own_x'),
  ]);

  emit({ type:'phase_done', phase:'A', msg:'Scraping completado. Guardando en Supabase...' });

  // Normalizar y guardar — público
  const nets = [
    { key:'facebook',    result:fbR,  norm: items => normFacebook(items, DATE, DNEXT),   label:'Facebook' },
    { key:'instagram',   result:igR,  norm: items => normInstagram(items, DATE, DNEXT),  label:'Instagram' },
    { key:'x',           result:xR,   norm: items => normX(items, DATE, DNEXT),          label:'X' },
    { key:'tiktok',      result:ttR,  norm: items => normTikTok(items, DATE, DNEXT),     label:'TikTok' },
    { key:'google_news', result:gnR,  norm: items => normGoogleNews(items, DATE, DNEXT), label:'Google News' },
  ];

  for (const { key, result, norm, label } of nets) {
    if (result.status === 'rejected') { summary.posts[key] = { error: result.reason?.message }; continue; }
    const posts = norm(result.value);
    summary.posts[key] = { count: posts.length };
    emit({ type:'saved', net:key, count:posts.length });
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

  // SL: sin filtro de fecha — queremos los 20 comentarios más recientes del post
  addCommentJob('sl_fb', slFbPosts, 'apify/facebook-comments-scraper',
    p => ({ startUrls:[{url:p.url}], resultsLimit:20, includeNestedComments:false }), 0.05, normCommentFB, false);

  addCommentJob('sl_ig', slIgPosts, 'apify/instagram-comment-scraper',
    p => ({ directUrls:[p.url], resultsLimit:20, includeNestedComments:false }), 0.08, normCommentIG, false);

  addCommentJob('sl_tt', slTtPosts, 'clockworks/tiktok-comments-scraper',
    p => ({ postURLs:[p.url], commentsPerPost:20, maxRepliesPerComment:0 }), 0.05, normCommentTT, false);

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

// ─── CLI directo ──────────────────────────────────────────────────────────────
if (process.argv[1].endsWith('run-full-analysis.js')) {
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
