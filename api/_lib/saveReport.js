// Server-side Supabase save — same logic as src/lib/saveReport.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';

function getClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function si(supabase, table, rows) {
  if (!rows || !rows.length) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) console.warn(`${table} insert:`, error.message);
}

export async function saveReport({ dateKey, themeKey, themeData, filename }) {
  const supabase = getClient();

  await supabase.from('reports').delete().eq('date_key', dateKey).eq('theme_key', themeKey);

  const { data: rep, error: repErr } = await supabase
    .from('reports')
    .insert({ date_key: dateKey, theme_key: themeKey, theme_label: themeData.label, filename })
    .select('id').single();
  if (repErr) throw repErr;
  const rid = rep.id;

  const s = themeData.sentiment || {};
  const r = themeData.risk || {};

  await si(supabase, 'sentiment', [{ report_id: rid, pos: s.pos, neu: s.neu, neg: s.neg,
    pos_count: s.posC, neu_count: s.neuC, neg_count: s.negC, risk_level: r.level }]);

  await si(supabase, 'platforms', (themeData.platforms || []).map(p => ({
    report_id: rid, platform: p.name, posts: p.posts, comments: p.comments, users: p.users,
    sent_pos: p.sent?.positivo || 0, sent_neu: p.sent?.neutral || 0, sent_neg: p.sent?.negativo || 0 })));

  const al = themeData.alerts || {};
  await si(supabase, 'alert_posts', (al.posts || []).map(p => ({
    report_id: rid, url: p.url, text: p.text, tipo: p.tipo, platform: p.platform,
    time: p.time, score: String(p.score || ''), razon: p.razon, engagement: p.engagement || 0, username: p.username })));

  const op = themeData.opps || {};
  await si(supabase, 'opportunity_posts', (op.posts || []).map(p => ({
    report_id: rid, url: p.url, text: p.text, impacto: p.impacto, platform: p.platform,
    time: p.time, score: String(p.score || ''), razon: p.razon, engagement: p.engagement || 0, username: p.username })));

  const cm = themeData.complaints || {};
  await si(supabase, 'complaints', (cm.categories || []).map(c => ({
    report_id: rid, titulo: c.titulo, porcentaje: c.porcentaje, items: c.items })));

  const newsRows = [];
  const news = themeData.news || {};
  ['positivo','neutral','negativo'].forEach(rating => {
    const groups = news[rating] || [];
    groups.forEach(g => {
      (g.noticias || []).forEach(n => {
        newsRows.push({ report_id: rid, group_titulo: g.titulo, rating, titulo: n.titulo, fuente: n.fuente, fecha: n.fecha, link: n.link });
      });
    });
  });
  await si(supabase, 'news_items', newsRows);

  await si(supabase, 'trending_topics', (themeData.trending || []).map(t => ({
    report_id: rid, titulo: t.titulo, description: t.desc,
    views: t.metricas?.views || 0, likes: t.metricas?.likes || 0,
    pos_pct: t.sent?.positivo_porcentaje || 0, neg_pct: t.sent?.negativo_porcentaje || 0 })));

  await si(supabase, 'reconocimientos', (themeData.recon || []).map(r => ({
    report_id: rid, titulo: r.titulo, description: r.desc })));

  const inf = themeData.influencers || {};
  await si(supabase, 'influencers', (inf.top || []).map(p => ({
    report_id: rid, rank: p.rank, username: p.username, platform: p.platform,
    followers: p.followers, sentiment: p.sentiment, categoria: p.categoria, url: p.url })));

  const tl = themeData.timeline || {};
  await si(supabase, 'timeline_events', (tl.events || []).map(e => ({
    report_id: rid, event_date: e.date, main: e.main,
    sentiment: e.sentiment, engagement: e.engagement, posts: e.posts || 0 })));

  const pc = themeData.proscons || {};
  const pcRows = [
    ...(pc.positive || []).map(item => ({ report_id: rid, type: 'pro', item })),
    ...(pc.negative || []).map(item => ({ report_id: rid, type: 'con', item })),
    ...(pc.neutral || []).map(item => ({ report_id: rid, type: 'neutral', item })),
  ];
  await si(supabase, 'pros_cons', pcRows);

  await si(supabase, 'keywords', (themeData.keywords || []).map(k => ({ report_id: rid, word: k.w, count: k.n })));
  await si(supabase, 'emojis', (themeData.emojis || []).map(e => ({ report_id: rid, emoji: e.emoji, count: e.count })));

  const ct = themeData.commentsTopics || {};
  await si(supabase, 'comments_topics', (ct.topics || []).map(t => ({
    report_id: rid, titulo: t.titulo, porcentaje: t.porcentaje, items: t.items })));

  const vs = themeData.voices || {};
  await si(supabase, 'voice_segments', (vs.segmentos || []).map(s => ({
    report_id: rid, label: s.label, narrativa: s.narrativa, sentimiento: s.sentimiento })));

  const gp = themeData.gap || {};
  if (gp.oficial || gp.contraste || gp.resumen) {
    await si(supabase, 'narrative_gap', [{ report_id: rid, oficial: gp.oficial, contraste: gp.contraste, resumen: gp.resumen }]);
  }

  console.log('Supabase: saved report', rid, themeKey, dateKey);
  return rid;
}
