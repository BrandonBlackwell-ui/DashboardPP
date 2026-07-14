/**
 * run-daily-social-listening.js
 * Runs Apify actors for public social listening and saves raw results to Supabase.
 *
 * Usage:
 *   node scripts/run-daily-social-listening.js <APIFY_TOKEN> [--date=2026-07-01]
 *
 * Runs all 5 networks: facebook, instagram, x, tiktok, google_news
 * Or a single one:     node ... TOKEN --date=2026-07-01 --only=facebook
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const argv = process.argv.slice(2);
const APIFY_TOKEN = argv.find(a => !a.startsWith('--')) || process.env.APIFY_TOKEN;
const TARGET_DATE = argv.find(a => a.startsWith('--date='))?.split('=')[1]
  || new Date().toISOString().slice(0, 10);
const ONLY = argv.find(a => a.startsWith('--only='))?.split('=')[1] || null;

if (!APIFY_TOKEN) {
  console.error('ERROR: Pasa el token de Apify como primer argumento o variable APIFY_TOKEN');
  process.exit(1);
}

// Next day string (for exclusive upper bounds)
const nextDay = (d) => {
  const dt = new Date(d + 'T12:00:00Z');
  dt.setDate(dt.getDate() + 1);
  return dt.toISOString().slice(0, 10);
};
const DATE_NEXT = nextDay(TARGET_DATE);

// Relevance keywords (any post must contain at least one)
// Objetivo: Pepe Aguilar. La familia solo como colectivo (familia/los/dinastia Aguilar),
// NO se monitorea a Angela ni a miembros sueltos por su cuenta, y se quita el comodín
// suelto 'aguilar' porque dejaba pasar posts que solo hablan de Angela.
const RELEVANT = ['pepe aguilar', 'pepeaguilar',
  'familia aguilar', 'familiaaguilar', 'los aguilar', 'losaguilar', 'dinast'];
const isRelevant = (text) => {
  const t = (text || '').toLowerCase();
  return RELEVANT.some(k => t.includes(k));
};

// ─── Apify helpers ────────────────────────────────────────────────────────────
async function apifyRun(actorId, input, maxChargeUsd) {
  const encoded = actorId.replace('/', '~');
  const url = `https://api.apify.com/v2/acts/${encoded}/runs?token=${APIFY_TOKEN}&waitForFinish=300&maxTotalChargeUsd=${maxChargeUsd}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Apify run failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function apifyDataset(datasetId, limit = 200) {
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}&clean=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  return res.json();
}

async function runAndFetch(actorId, input, maxChargeUsd) {
  console.log(`  ↳ Corriendo actor ${actorId}...`);
  const run = await apifyRun(actorId, input, maxChargeUsd);
  const runData = run.data || run;
  const status = runData.status || 'UNKNOWN';
  const datasetId = runData.defaultDatasetId;
  const cost = runData.stats?.computeUnits != null
    ? `~${runData.stats.computeUnits} CU` : '?';
  console.log(`  ↳ Status: ${status} | Dataset: ${datasetId} | Costo: ${cost}`);

  if (status !== 'SUCCEEDED' && status !== 'READY') {
    console.warn(`  ⚠ Actor terminó con status ${status}. Se intenta leer dataset de todas formas.`);
  }
  if (!datasetId) throw new Error('No defaultDatasetId en la respuesta');
  const items = await apifyDataset(datasetId, 250);
  console.log(`  ↳ Items crudos: ${items.length}`);
  return items;
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeX(items) {
  return items
    .map(p => ({
      platform: 'x',
      username: p.author?.userName || p.user?.screen_name || p.authorName || '',
      text: p.full_text || p.text || p.tweet || '',
      url: p.permalink || p.url || p.tweetUrl || '',
      published_date: p.created_at || p.createdAt || p.publishedAt || null,
      likes: Number(p.likeCount || p.likes || p.favorite_count || 0),
      comments_count: Number(p.replyCount || p.comments || p.reply_count || 0),
      retweets: Number(p.retweetCount || p.retweets || p.retweet_count || 0),
      views: Number(p.viewCount || p.views || p.views_count || 0),
      shares: 0,
    }))
    .filter(p => p.text && p.url)
    .filter(p => {
      if (!p.published_date) return true;
      const d = p.published_date.slice(0, 10);
      return d >= TARGET_DATE && d < DATE_NEXT;
    })
    .filter(p => isRelevant(p.text));
}

function normalizeFacebook(items) {
  return items
    .map(p => {
      const reactions = Number(p.reactions_count || p.reactionsCount || 0);
      const thumbsUp = Number(p.like || p.likes || 0);
      return {
        platform: 'facebook',
        username: p.author?.name || p.authorName || p.pageName || '',
        text: p.message || p.text || p.caption || '',
        url: p.url || p.postUrl || p.permalink || '',
        published_date: p.date || p.publishedAt || p.created_at || null,
        // Use total reactions_count per rules doc, NOT just thumbs-up likes
        likes: reactions > 0 ? reactions : thumbsUp,
        comments_count: Number(p.comments_count || p.commentsCount || p.comments || 0),
        shares: Number(p.reshare_count || p.shares || 0),
        retweets: 0,
        views: 0,
        // Store reaction breakdown as metadata in the text for now (until schema adds columns)
        _reactions: {
          total: reactions,
          like: Number(p.like || 0),
          love: Number(p.love || 0),
          haha: Number(p.haha || 0),
          wow: Number(p.wow || 0),
          sad: Number(p.sad || 0),
          angry: Number(p.angry || 0),
          care: Number(p.care || 0),
        },
      };
    })
    .filter(p => p.text && p.url)
    .filter(p => {
      if (!p.published_date) return true;
      const d = p.published_date.slice(0, 10);
      return d >= TARGET_DATE && d < DATE_NEXT;
    })
    .filter(p => isRelevant(p.text));
}

function normalizeTikTok(items) {
  return items
    .map(p => ({
      platform: 'tiktok',
      username: p.author || p.nickname || p.authorMeta?.name || '',
      text: p.desc || p.description || p.text || '',
      url: p.url || p.webVideoUrl || p.embedUrl || '',
      published_date: p.createTimeISO || p.createdAt || (p.createTime ? new Date(p.createTime * 1000).toISOString() : null),
      likes: Number(p.diggCount || p.likes || p.likeCount || 0),
      comments_count: Number(p.commentCount || p.comments || 0),
      shares: Number(p.shareCount || p.shares || 0),
      views: Number(p.playCount || p.plays || p.viewCount || 0),
      retweets: 0,
      followers: Number(p.followers || p.authorMeta?.fans || 0),
    }))
    .filter(p => p.text && p.url)
    .filter(p => {
      if (!p.published_date) return true;
      const d = p.published_date.slice(0, 10);
      return d >= TARGET_DATE && d < DATE_NEXT;
    })
    .filter(p => isRelevant(p.text + ' ' + (p.username || '')));
}

function normalizeInstagram(items) {
  return items
    .map(p => {
      const code = p.code || p.shortCode || '';
      const builtUrl = code ? `https://www.instagram.com/p/${code}/` : '';
      return {
        platform: 'instagram',
        username: p.owner?.username || p.ownerUsername || p.authorUsername || p.username || '',
        text: p.caption || p.text || p.description || '',
        url: p.url || p.postUrl || builtUrl || '',
        published_date: p.createdAt || p.taken_at_date || p.timestamp || null,
        likes: Number(p.likeCount || p.likesCount || p.likes || 0),
        comments_count: Number(p.commentCount || p.commentsCount || p.comments || 0),
        views: Number(p.video?.playCount || p.videoPlayCount || p.plays || 0),
        shares: 0,
        retweets: 0,
      };
    })
    .filter(p => p.text && p.url)
    .filter(p => {
      if (!p.published_date) return true;
      const d = p.published_date.slice(0, 10);
      return d >= TARGET_DATE && d < DATE_NEXT;
    })
    .filter(p => isRelevant(p.text + ' ' + (p.username || '')));
}

function normalizeGoogleNews(items) {
  const cleanSource = s => (s || '').replace(/^\s*ir a\s+/i, '').replace(/\s+/g, ' ').trim();
  const domainFromUrl = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
  return items
    .map(p => {
      const url = p.url || p.articleUrl || p.link || '';   // decodeUrls:true → URL real del medio
      const domain = p.domain || domainFromUrl(url);
      return {
      platform: 'google_news',
      username: cleanSource(p.source || p.sourceDomain || p.author) || domain,
      domain,
      text: p.title || p.headline || '',
      descr: p.description || '',
      url,
      published_date: p.publishedAt || p.date || p.pubDate || null,
      likes: 0,
      comments_count: 0,
      shares: 0,
      retweets: 0,
      views: 0,
      };
    })
    .filter(p => p.text && p.url)
    .filter(p => {
      if (!p.published_date) return true;
      const d = p.published_date.slice(0, 10);
      return d >= TARGET_DATE && d < DATE_NEXT;
    })
    .filter(p => isRelevant(p.text + ' ' + (p.descr || '')));
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function upsertReport(themeKey, themeLabel) {
  // Check if a report already exists for this date + theme
  const { data: existing } = await supabase
    .from('reports')
    .select('id')
    .eq('date_key', TARGET_DATE)
    .eq('theme_key', themeKey)
    .limit(1);

  if (existing?.length) {
    console.log(`  ↳ Reporte existente reutilizado: ${existing[0].id}`);
    return existing[0].id;
  }

  const { data, error } = await supabase.from('reports').insert({
    date_key: TARGET_DATE,
    theme_key: themeKey,
    theme_label: themeLabel,
    filename: `apify-${themeKey}-${TARGET_DATE}`,
  }).select('id').single();

  if (error) throw new Error(`reports insert error: ${error.message}`);
  console.log(`  ↳ Reporte creado: ${data.id}`);
  return data.id;
}

async function insertPosts(reportId, themeKey, posts) {
  if (!posts.length) {
    console.log('  ↳ 0 posts relevantes — nada que guardar');
    return;
  }
  // domain/descr son auxiliares (relevancia/etiqueta de medio); no son columnas de scraped_posts.
  const rows = posts.map(({ _reactions, domain, descr, ...p }) => ({
    ...p,
    report_id: reportId,
    theme_key: themeKey,
    sentiment: null,
  }));

  const { error } = await supabase.from('scraped_posts').insert(rows);
  if (error) throw new Error(`scraped_posts insert error: ${error.message}`);
  console.log(`  ↳ ${rows.length} posts guardados en Supabase ✓`);
}

// ─── Per-network runners ──────────────────────────────────────────────────────

async function runFacebook() {
  console.log('\n📘 FACEBOOK');
  const raw = await runAndFetch(
    'igview-owner/facebook-old-posts-search',
    { query: '"Pepe Aguilar"', startDate: TARGET_DATE, endDate: TARGET_DATE, maxResults: 50 },
    0.12,
  );
  const posts = normalizeFacebook(raw);
  console.log(`  ↳ Posts relevantes post-filtro: ${posts.length}`);
  const reportId = await upsertReport('facebook', 'Facebook');
  await insertPosts(reportId, 'facebook', posts);
}

async function runInstagram() {
  console.log('\n📸 INSTAGRAM');
  const KEYWORDS = ['pepeaguilar', 'familiaaguilar', 'dinastiaaguilar'];
  const all = [];
  const seen = new Set();

  for (const kw of KEYWORDS) {
    try {
      console.log(`  ↳ Keyword: ${kw}`);
      const raw = await runAndFetch(
        'apidojo/instagram-hashtag-scraper',
        { keyword: kw, until: TARGET_DATE, getPosts: true, getReels: false, maxItems: 10 },
        0.05,
      );
      for (const item of raw) {
        const key = item.url || item.code || JSON.stringify(item).slice(0, 80);
        if (!seen.has(key)) { seen.add(key); all.push(item); }
      }
    } catch (e) {
      console.warn(`  ⚠ keyword ${kw} falló: ${e.message}`);
    }
  }

  const posts = normalizeInstagram(all);
  console.log(`  ↳ Posts relevantes post-filtro: ${posts.length}`);
  const reportId = await upsertReport('instagram', 'Instagram');
  await insertPosts(reportId, 'instagram', posts);
}

async function runX() {
  console.log('\n🐦 X (Twitter)');
  const raw = await runAndFetch(
    'igolaizola/x-twitter-scraper-ppe',
    {
      query: '"Pepe Aguilar"',
      maxItems: 100,
      minDate: TARGET_DATE,
      maxDate: DATE_NEXT,
      replies: 'exclude',
      retweets: 'exclude',
      quotes: 'exclude',
    },
    1.00,
  );
  const posts = normalizeX(raw);
  console.log(`  ↳ Posts relevantes post-filtro: ${posts.length}`);
  const reportId = await upsertReport('x', 'X');
  await insertPosts(reportId, 'x', posts);
}

async function runTikTok() {
  console.log('\n🎵 TIKTOK');
  const raw = await runAndFetch(
    'sentry/tiktok-search-api',
    {
      keywords: ['Pepe Aguilar'],
      maxVideosPerKeyword: 15,
      maxVideosTotal: 15,
      sortOrder: 'mostViews',
      datePosted: 'today',
      includePhotoPosts: false,
    },
    0.10,
  );
  const posts = normalizeTikTok(raw);
  console.log(`  ↳ Posts relevantes post-filtro: ${posts.length}`);
  const reportId = await upsertReport('tiktok', 'TikTok');
  await insertPosts(reportId, 'tiktok', posts);
}

async function runGoogleNews() {
  console.log('\n📰 GOOGLE NEWS');
  const raw = await runAndFetch(
    'data_xplorer/google-news-scraper-fast',
    {
      keywords: ['Pepe Aguilar'],
      region_language: process.env.GOOGLE_NEWS_REGION || 'MX:es-419',
      timeframe: '1d', // últimas 24h; el reporte diario corre sobre "hoy"
      maxArticles: 40,
      decodeUrls: true,
      extractDescriptions: true,
      extractImages: false,
    },
    0.08,
  );
  const posts = normalizeGoogleNews(raw);
  console.log(`  ↳ Artículos relevantes post-filtro: ${posts.length}`);
  const reportId = await upsertReport('google_news', 'Google News');
  await insertPosts(reportId, 'google_news', posts);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const RUNNERS = {
  facebook: runFacebook,
  instagram: runInstagram,
  x: runX,
  tiktok: runTikTok,
  google_news: runGoogleNews,
};

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Social Listening Runner — Pepe Aguilar`);
  console.log(`  Fecha: ${TARGET_DATE}  |  Siguiente: ${DATE_NEXT}`);
  console.log(`  Red:   ${ONLY || 'todas'}`);
  console.log('═══════════════════════════════════════════════════════');

  const toRun = ONLY ? [ONLY] : Object.keys(RUNNERS);
  const results = [];

  for (const net of toRun) {
    if (!RUNNERS[net]) {
      console.warn(`⚠ Red desconocida: ${net}`);
      continue;
    }
    try {
      await RUNNERS[net]();
      results.push({ net, ok: true });
    } catch (e) {
      console.error(`\n✗ ${net.toUpperCase()} ERROR: ${e.message}`);
      results.push({ net, ok: false, error: e.message });
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Resumen:');
  results.forEach(r => {
    const icon = r.ok ? '✓' : '✗';
    const msg = r.ok ? 'OK' : `ERROR: ${r.error}`;
    console.log(`  ${icon} ${r.net.padEnd(14)} ${msg}`);
  });
  console.log('═══════════════════════════════════════════════════════');
  console.log('\nSiguiente paso: node scripts/generate-ai-analysis.js <OPENROUTER_KEY>');
}

main().catch(e => { console.error(e); process.exit(1); });
