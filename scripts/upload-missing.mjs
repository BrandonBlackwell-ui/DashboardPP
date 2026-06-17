// Script: sube todos los CSVs de /Data a Supabase, cubriendo CADA día del rango
// Uso: node scripts/upload-missing.mjs
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../Data');

const supabase = createClient(
  'https://svbbhbtllzjhfoqrsaig.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YmJoYnRsbHpqaGZvcXJzYWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTM5MDIsImV4cCI6MjA5NzE4OTkwMn0.joE1Hol5tFa5opPqQMGoCzUpOj1FpB-tklnY1DUFjD4'
);

// ── CSV parser (inline, misma lógica que csvParser.js) ────────────────────────

function arr(v) { return Array.isArray(v) ? v : []; }
function parseJsonField(row, col) {
  const raw = row[col];
  if (!raw || raw.trim() === '') return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function pct(v) { return parseFloat(typeof v === 'object' && v !== null ? v.percentage ?? v.porcentaje ?? 0 : v ?? 0) || 0; }
function cnt(v) { return parseInt(typeof v === 'object' && v !== null ? v.count ?? v.cantidad ?? 0 : v ?? 0, 10) || 0; }
function pcArr(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (v.items && Array.isArray(v.items)) return v.items;
  return [];
}

function parseCsvRaw(text) {
  const rows = [];
  let cur = '', inQ = false, fields = [], i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i+1] === '"') { cur += '"'; i += 2; continue; }
      inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      fields.push(cur); cur = ''; i++; continue;
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (ch === '\r' && text[i+1] === '\n') i++;
      fields.push(cur); cur = '';
      if (fields.some(f => f.trim())) rows.push(fields);
      fields = []; i++; continue;
    } else { cur += ch; }
    i++;
  }
  if (cur || fields.length) { fields.push(cur); if (fields.some(f=>f.trim())) rows.push(fields); }
  return rows;
}

const KNOWN_COLS = ['consolidated_analysis','complaints_analysis','trending_topics_analysis',
  'timeline_analysis','news_analysis','alertometro_analysis','oportunometro_analysis',
  'reconocimientos_analysis','influencers_impact_analysis','agents_summary',
  'deep_sentiment_analysis','comments_topics_analysis','pros_and_cons',
  'narrative_gap_analysis','voices_analysis'];

function detectTheme(filename) {
  const f = filename.toLowerCase();
  if (f.includes('musica') || f.includes('música')) return { key:'musica', label:'Música', es:'Su obra musical, conciertos y legado artístico' };
  if (f.includes('entrevista')) return { key:'entrevistas', label:'Entrevistas', es:'Apariciones en medios, entrevistas y declaraciones públicas' };
  if (f.includes('empresa')) return { key:'empresas', label:'Empresas', es:'Sus negocios, marca y proyectos empresariales' };
  if (f.includes('familia') || f.includes('dinastia') || f.includes('dinastía')) return { key:'familia', label:'Familia', es:'La dinastía Aguilar y la vida familiar pública' };
  return null;
}

// Retorna TODOS los días del rango (e.g. "05-08jun" → [5,6,7,8])
function detectDateRange(filename) {
  const f = filename.toLowerCase();
  const m = f.match(/(\d{2})[-_](\d{2})[-_]?jun/) || f.match(/(\d{2})[-_](\d{2})jun/);
  if (m) {
    const start = parseInt(m[1], 10);
    const end   = parseInt(m[2], 10);
    const days = [];
    for (let d = start; d <= end; d++) days.push(`2026-06-${String(d).padStart(2,'0')}`);
    return days;
  }
  const m2 = f.match(/(\d{2})jun/);
  if (m2) return [`2026-06-${String(parseInt(m2[1],10)).padStart(2,'0')}`];
  return [new Date().toISOString().slice(0,10)];
}

function parseDailyCSV(csvText, filename) {
  const rows = parseCsvRaw(csvText);
  if (rows.length < 2) throw new Error('CSV vacío');

  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const normalized = rows[i].map(h => h.trim().toLowerCase());
    if (KNOWN_COLS.some(c => normalized.includes(c))) { headerIdx = i; break; }
  }
  const headers = rows[headerIdx].map(h => h.trim().replace(/^﻿/, ''));
  let dataRow = null;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    if (rows[i].length >= 3 && rows[i].some(f => f.trim())) { dataRow = rows[i]; break; }
  }
  if (!dataRow) throw new Error('No hay fila de datos');

  const row = {};
  headers.forEach((h, i) => { row[h] = (dataRow[i] || '').trim(); });

  const theme = detectTheme(filename);
  if (!theme) throw new Error('Tema no reconocido: ' + filename);

  const consolidated = parseJsonField(row, 'consolidated_analysis') || {};
  const alerts    = parseJsonField(row, 'alertometro_analysis') || {};
  const opps      = parseJsonField(row, 'oportunometro_analysis') || {};
  const complaints= parseJsonField(row, 'complaints_analysis') || {};
  const trending  = parseJsonField(row, 'trending_topics_analysis') || {};
  const timeline  = parseJsonField(row, 'timeline_analysis') || {};
  const news      = parseJsonField(row, 'news_analysis') || {};
  const recon     = parseJsonField(row, 'reconocimientos_analysis') || {};
  const influencers = parseJsonField(row, 'influencers_impact_analysis') || {};
  const proscons  = parseJsonField(row, 'pros_and_cons') || {};
  const gap       = parseJsonField(row, 'narrative_gap_analysis') || {};
  const voices    = parseJsonField(row, 'voices_analysis') || {};
  const commentsTopics = parseJsonField(row, 'comments_topics_analysis') || {};
  const deepSent  = parseJsonField(row, 'deep_sentiment_analysis') || {};
  const agentsSummary = parseJsonField(row, 'agents_summary') || {};

  const sd = consolidated?.sentiment_distribution
    || consolidated?.sentiment_stats?.overall_sentiment?.overall_sentiment_distribution || {};
  const pos = pct(sd.positive_percentage ?? sd.positivo);
  const neu = pct(sd.neutral_percentage ?? sd.neutral);
  const neg = pct(sd.negative_percentage ?? sd.negativo);
  const posC = cnt(sd.positive_count ?? sd.positivo_count ?? sd.positivo);
  const neuC = cnt(sd.neutral_count ?? sd.neutral);
  const negC = cnt(sd.negative_count ?? sd.negativo_count ?? sd.negativo);

  const ra = consolidated?.risk_assessment
    || consolidated?.sentiment_stats?.risk_assessment || {};
  const riskLevel = (ra.overall_risk_level || ra.risk_level || ra.nivel || 'bajo').toLowerCase();

  const sentsOverall = consolidated?.sentiment_stats?.overall_sentiment || {};
  const totals = {
    posts: consolidated?.post_count || consolidated?.total_posts || sentsOverall.posts_analyzed || 0,
    users: consolidated?.unique_users || 0,
  };

  const rawPB = consolidated?.platform_breakdown || consolidated?.platforms || [];
  let platformArr = [];
  if (Array.isArray(rawPB)) { platformArr = rawPB; }
  else if (rawPB && typeof rawPB === 'object') {
    const inner = rawPB.platforms || rawPB;
    if (Array.isArray(inner)) platformArr = inner;
    else if (inner && typeof inner === 'object') platformArr = Object.entries(inner).map(([name, d]) => ({ ...d, _name: name }));
  }
  const platforms = platformArr.map(p => {
    const name = (p.platform || p.name || p._name || '').toLowerCase();
    const sd2 = p.sentiment_distribution || p.sentiment || p.sent || {};
    return { name, posts: p.total_posts||p.posts||0, comments: p.total_comments||p.comments||0,
      users: p.unique_users||p.users||0, engagement: p.avg_engagement||p.engagement||0,
      sent: { positivo: pct(sd2.positivo??sd2.positive_percentage??sd2.positive),
        neutral: pct(sd2.neutral??sd2.neutral_percentage), negativo: pct(sd2.negativo??sd2.negative_percentage??sd2.negative) } };
  });

  const alertResumen = alerts.resumen_alertas || alerts;
  const alertData = {
    nivel: alertResumen.nivel_crisis_general || alertResumen.nivel || alerts.alert_level || 'sin_alertas',
    total: alertResumen.total_posts_con_alerta || alertResumen.total_alerts || alertResumen.total || 0,
    posts: arr(alerts.top_posts_peligrosos || alerts.high_risk_posts || alerts.posts).map(p => ({
      url: p.url||p.link||'', text: p.text||p.content||'', tipo: p.tipo_alerta||p.tipo||p.alert_type||'alerta',
      platform: (p.platform||'').toLowerCase(), time: p.timestamp||p.time||p.date||'',
      score: String(p.score_peligrosidad||p.danger_score||p.score||''), razon: p.razon||p.reason||'',
      engagement: p.engagement||0, username: p.username||p.user||'' })),
  };
  const oppResumen = opps.resumen_oportunidades || opps;
  const oppData = {
    nivel: oppResumen.nivel_oportunidad_general || oppResumen.opportunity_level || oppResumen.nivel || 'bajo',
    total: oppResumen.total_posts_con_oportunidad || oppResumen.total_opportunities || oppResumen.total || 0,
    posts: arr(opps.top_mejores_oportunidades || opps.top_opportunities || opps.posts).map(p => ({
      url: p.url||p.link||'', text: p.text||p.content||'', impacto: p.nivel_impacto||p.impact_level||p.impacto||'',
      platform: (p.platform||'').toLowerCase(), time: p.timestamp||p.time||p.date||'',
      score: String(p.score_oportunidad||p.opportunity_score||p.score||''), razon: p.razon||p.reason||'',
      engagement: p.engagement||0, username: p.username||p.user||'' })),
  };
  const pc = {
    positive: pcArr(proscons.pros || proscons.positive || proscons.a_favor),
    negative: pcArr(proscons.cons || proscons.negative || proscons.en_contra),
    neutral:  pcArr(proscons.neutral || proscons.observaciones),
  };
  const cm = {
    total: complaints.total_complaints || complaints.total || 0,
    categories: arr(complaints.complaint_categories || complaints.categories).map(cat => ({
      titulo: cat.category||cat.titulo||'', porcentaje: cat.percentage||cat.porcentaje||0,
      items: arr(cat.complaints||cat.items).map(it => ({
        texto: it.complaint||it.texto||it,
        sources: arr(it.sources).map(s => ({ url: s.url||s.link||'', platform: s.platform||'' })) })) })),
  };
  const newsData = {};
  if (news && (news.positive_coverage||news.neutral_coverage||news.negative_coverage||news.positivo||news.neutral||news.negativo)) {
    newsData.total = news.total_news||news.total||0;
    ['positivo','neutral','negativo'].forEach(r => {
      const src = news[r+'_coverage'] || news[r] || [];
      newsData[r] = arr(src).map(g => ({
        titulo: g.title||g.titulo||'', porcentaje: g.coverage_percentage||g.porcentaje||0,
        noticias: arr(g.articles||g.noticias).map(n => ({
          titulo: n.headline||n.titulo||n.title||'', fuente: n.source||n.fuente||'',
          fecha: n.date||n.fecha||'', link: n.url||n.link||n.href||'' })) }));
    });
  }
  const trendData = arr(trending.trending_topics||trending.topics||trending.tendencias||trending.temas).map(x => ({
    titulo: x.topic||x.titulo||x['título']||x.title||'',
    desc: x.description||x.desc||x['descripción']||x.descripcion||'',
    metricas: { views: x.metrics?.views||x.views||x.metricas?.views||x.metricas?.reproducciones||x.alcance||0,
      likes: x.metrics?.likes||x.likes||x.metricas?.likes||x.metricas?.me_gusta||0 },
    sent: { positivo_porcentaje: x.sentiment?.positive_percentage||x.sent?.positivo_porcentaje||x.analisis_sentimiento?.positivo||0,
      negativo_porcentaje: x.sentiment?.negative_percentage||x.sent?.negativo_porcentaje||x.analisis_sentimiento?.negativo||0 },
  }));
  const reconData = arr(recon.recognitions||recon.reconocimientos||recon.items).map(r => ({
    titulo: r.title||r.titulo||'', desc: r.description||r.desc||'',
    metricas: { views: r.metrics?.views||r.views||0 } }));
  const infTop = arr(influencers.top_influencers||influencers.top||influencers.influencers).map((p, i) => ({
    rank: p.rank||i+1, username: p.username||p.name||'', platform: (p.platform||'').toLowerCase(),
    followers: p.followers||p.follower_count||0, pic: p.profile_pic||p.pic||p.avatar||'',
    url: p.url||p.profile_url||'', categoria: p.category||p.categoria||'', sentiment: p.sentiment||p.sentimiento||'neutral' }));
  const gapData = { oficial: gap.official_narrative||gap.oficial||{}, contraste: gap.contrast||gap.contraste||{}, resumen: gap.summary||gap.resumen||{} };
  const voicesData = {
    resumen: voices.summary||voices.resumen||'',
    segmentos: arr(voices.segments||voices.segmentos).map(s => ({ label: s.segment||s.label||'', narrativa: s.narrative||s.narrativa||'', sentimiento: s.sentiment||s.sentimiento||'' })),
    alertas: arr(voices.alerts||voices.alertas).map(a => ({ tema: a.topic||a.tema||'', descripcion: a.description||a.descripcion||'', severidad: a.severity||a.severidad||'media' })) };
  const ctData = { total: commentsTopics.total_comments||commentsTopics.total||0,
    topics: arr(commentsTopics.comment_topics||commentsTopics.topics).map(t => ({
      titulo: t.topic||t.titulo||'', porcentaje: t.percentage||t.porcentaje||0, items: (t.examples||t.items||[]).slice(0,4) })) };
  const emojiSrc = deepSent.top_emojis||deepSent.emojis||agentsSummary.top_emojis||[];
  const emojis = arr(emojiSrc).slice(0,12).map(e => ({ emoji: e.emoji||e.symbol||'', count: e.count||e.frequency||0 }));
  const kwSrc = deepSent.top_keywords||deepSent.keywords||agentsSummary.top_keywords||agentsSummary.hashtags||[];
  const keywords = arr(kwSrc).slice(0,32).map(k => ({ w: k.keyword||k.word||k.hashtag||k.w||String(k), n: k.count||k.frequency||k.n||1 })).sort((a,b)=>b.n-a.n);

  const themeData = {
    label: theme.label, es: theme.es,
    sentiment: { pos, neu, neg, posC, neuC, negC },
    risk: { level: riskLevel, urgency: ra.urgency||'', negPct: neg, attention: neg > 20 },
    health: Math.round(100 - neg), totals, platforms,
    alerts: alertData, opps: oppData, proscons: pc, complaints: cm,
    news: Object.keys(newsData).length ? newsData : null,
    trending: trendData, recon: reconData,
    influencers: { total: influencers.total_influencers||influencers.total||infTop.length, top: infTop },
    gap: gapData, voices: voicesData, commentsTopics: ctData, emojis, keywords,
    timeline: { events: arr(timeline.daily_events||timeline.events).map(e => ({
      date: e.date||'', main: e.main_event||e.main||e.description||'',
      sentiment: e.sentiment||'', engagement: e.engagement_level||e.engagement||'', posts: e.post_count||e.posts||0 })) },
  };

  return { themeKey: theme.key, themeData, dateRange: detectDateRange(filename) };
}

// ── Supabase save (misma lógica que saveReport.js) ────────────────────────────

async function si(table, rows) {
  if (!rows || !rows.length) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) console.warn(`  ⚠ ${table}:`, error.message);
}

async function saveReport(dateKey, themeKey, themeData, filename) {
  await supabase.from('reports').delete().eq('date_key', dateKey).eq('theme_key', themeKey);
  const { data: rep, error: repErr } = await supabase.from('reports')
    .insert({ date_key: dateKey, theme_key: themeKey, theme_label: themeData.label, filename })
    .select('id').single();
  if (repErr) throw repErr;
  const rid = rep.id;

  const s = themeData.sentiment || {};
  const r = themeData.risk || {};
  await si('sentiment', [{ report_id: rid, pos: s.pos, neu: s.neu, neg: s.neg,
    pos_count: s.posC, neu_count: s.neuC, neg_count: s.negC, risk_level: r.level }]);
  await si('platforms', (themeData.platforms||[]).map(p => ({
    report_id: rid, platform: p.name, posts: p.posts, comments: p.comments, users: p.users,
    sent_pos: p.sent?.positivo||0, sent_neu: p.sent?.neutral||0, sent_neg: p.sent?.negativo||0 })));
  const al = themeData.alerts || {};
  await si('alert_posts', (al.posts||[]).map(p => ({
    report_id: rid, url: p.url, text: p.text, tipo: p.tipo, platform: p.platform,
    time: p.time, score: String(p.score||''), razon: p.razon, engagement: p.engagement||0, username: p.username })));
  const op = themeData.opps || {};
  await si('opportunity_posts', (op.posts||[]).map(p => ({
    report_id: rid, url: p.url, text: p.text, impacto: p.impacto, platform: p.platform,
    time: p.time, score: String(p.score||''), razon: p.razon, engagement: p.engagement||0, username: p.username })));
  const cm = themeData.complaints || {};
  await si('complaints', (cm.categories||[]).map(c => ({ report_id: rid, titulo: c.titulo, porcentaje: c.porcentaje, items: c.items })));
  const news = themeData.news || {};
  const newsRows = [];
  ['positivo','neutral','negativo'].forEach(rating => {
    (news[rating]||[]).forEach(g => (g.noticias||[]).forEach(n =>
      newsRows.push({ report_id: rid, rating, group_titulo: g.titulo, titulo: n.titulo, fuente: n.fuente, fecha: n.fecha, link: n.link }) ));
  });
  await si('news_items', newsRows);
  await si('trending_topics', (themeData.trending||[]).map((x,i) => ({
    report_id: rid, rank: i+1, titulo: x.titulo, description: x.desc,
    views: x.metricas?.views||0, likes: x.metricas?.likes||0,
    pos_pct: x.sent?.positivo_porcentaje||0, neg_pct: x.sent?.negativo_porcentaje||0 })));
  await si('influencers', (themeData.influencers?.top||[]).map(p => ({
    report_id: rid, rank: p.rank, username: p.username, platform: p.platform,
    followers: p.followers||0, sentiment: p.sentiment, categoria: p.categoria, url: p.url })));
  await si('timeline_events', (themeData.timeline?.events||[]).map(e => ({
    report_id: rid, event_date: e.date||null, main: e.main, sentiment: e.sentiment, engagement: e.engagement, posts: e.posts||0 })));
  const pc = themeData.proscons || {};
  await si('pros_cons', [
    ...(pc.positive||[]).map(item => ({ report_id: rid, type: 'pro', item: String(item) })),
    ...(pc.negative||[]).map(item => ({ report_id: rid, type: 'con', item: String(item) })),
    ...(pc.neutral||[]).map(item => ({ report_id: rid, type: 'neutral', item: String(item) })),
  ]);
  await si('reconocimientos', (themeData.recon||[]).map(x => ({ report_id: rid, titulo: x.titulo, description: x.desc })));
  await si('keywords', (themeData.keywords||[]).map(k => ({ report_id: rid, word: k.w, count: k.n })));
  await si('emojis', (themeData.emojis||[]).map(e => ({ report_id: rid, emoji: e.emoji, count: e.count })));
  const ct = themeData.commentsTopics || {};
  await si('comments_topics', (ct.topics||[]).map(t => ({ report_id: rid, titulo: t.titulo, porcentaje: t.porcentaje, items: t.items })));
  const vs = themeData.voices || {};
  await si('voice_segments', (vs.segmentos||[]).map(seg => ({ report_id: rid, label: seg.label, narrativa: seg.narrativa, sentimiento: seg.sentimiento })));
  const gap = themeData.gap || {};
  if (gap.oficial || gap.contraste || gap.resumen)
    await si('narrative_gap', [{ report_id: rid, oficial: gap.oficial, contraste: gap.contraste, resumen: gap.resumen }]);

  return rid;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
console.log(`\nArchivos CSV encontrados: ${files.length}\n`);

// Obtener registros ya existentes en Supabase
const { data: existing } = await supabase.from('reports').select('date_key, theme_key');
const existingSet = new Set((existing||[]).map(r => `${r.theme_key}:${r.date_key}`));
console.log(`Registros actuales en Supabase: ${existingSet.size}`);

let uploaded = 0, skipped = 0, errors = 0;

for (const file of files) {
  const theme = detectTheme(file);
  if (!theme) { console.log(`⏭  ${file} — tema no reconocido`); continue; }

  let csvText;
  try {
    csvText = readFileSync(join(DATA_DIR, file), 'utf-8');
  } catch {
    console.log(`⚠  No se pudo leer: ${file}`); continue;
  }

  let parsed;
  try {
    parsed = parseDailyCSV(csvText, file);
  } catch (e) {
    console.log(`✗  ${file} — parse error: ${e.message}`); errors++; continue;
  }

  const { themeKey, themeData, dateRange } = parsed;

  // Subir para CADA día del rango
  for (const dateKey of dateRange) {
    const key = `${themeKey}:${dateKey}`;
    if (existingSet.has(key)) {
      // Ya existe — solo subir si es una fecha "nueva" (no en el rango original)
      // Si el rango tiene más de 1 día, los días adicionales al inicio son los nuevos
      const isStartDate = dateKey === dateRange[0];
      if (isStartDate) { skipped++; process.stdout.write('.'); continue; }
    }
    try {
      await saveReport(dateKey, themeKey, themeData, file);
      existingSet.add(key);
      uploaded++;
      console.log(`✓  ${themeKey} ${dateKey}  (${file})`);
    } catch(e) {
      console.log(`✗  ${themeKey} ${dateKey} — ${e.message}`); errors++;
    }
  }
}

console.log(`\n─────────────────────────────────────`);
console.log(`✓ Subidos: ${uploaded}`);
console.log(`· Ya existían: ${skipped}`);
console.log(`✗ Errores: ${errors}`);
console.log(`─────────────────────────────────────\n`);
