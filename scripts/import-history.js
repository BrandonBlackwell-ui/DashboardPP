// Node.js script: read all CSVs from Data folder, parse, save to Supabase
// Run from dashboard-react root: node scripts/import-history.js
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { parseDailyCSV } from '../src/utils/csvParser.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://svbbhbtllzjhfoqrsaig.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YmJoYnRsbHpqaGZvcXJzYWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTM5MDIsImV4cCI6MjA5NzE4OTkwMn0.joE1Hol5tFa5opPqQMGoCzUpOj1FpB-tklnY1DUFjD4';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const DATA_DIR = resolve('C:/Users/Brand/OneDrive/Desktop/BW/PP/Data');

async function si(table, rows) {
  if (!rows || !rows.length) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) console.warn(`  ⚠ ${table} insert:`, error.message);
}

async function saveReport({ dateKey, themeKey, themeData, filename }) {
  // Delete existing for same date+theme
  await supabase.from('reports').delete().eq('date_key', dateKey).eq('theme_key', themeKey);

  const { data: rep, error: repErr } = await supabase
    .from('reports')
    .insert({ date_key: dateKey, theme_key: themeKey, theme_label: themeData.label, filename })
    .select('id').single();
  if (repErr) throw repErr;
  const rid = rep.id;

  const s = themeData.sentiment || {};
  const r = themeData.risk || {};
  await si('sentiment', [{ report_id: rid, pos: s.pos, neu: s.neu, neg: s.neg,
    pos_count: s.posC, neu_count: s.neuC, neg_count: s.negC, risk_level: r.level }]);

  await si('platforms', (themeData.platforms || []).map(p => ({
    report_id: rid, platform: p.name, posts: p.posts, comments: p.comments, users: p.users,
    sent_pos: p.sent?.positivo || 0, sent_neu: p.sent?.neutral || 0, sent_neg: p.sent?.negativo || 0
  })));

  const al = themeData.alerts || themeData.alertometro || {};
  await si('alert_posts', (al.posts || []).map(p => ({
    report_id: rid, url: p.url, text: p.text, tipo: p.tipo, platform: p.platform,
    time: p.time, score: String(p.score || ''), razon: p.razon, engagement: p.engagement || 0, username: p.username
  })));

  const op = themeData.opps || themeData.oportunometro || {};
  await si('opportunity_posts', (op.posts || []).map(p => ({
    report_id: rid, url: p.url, text: p.text, impacto: p.impacto, platform: p.platform,
    time: p.time, score: String(p.score || ''), razon: p.razon, engagement: p.engagement || 0, username: p.username
  })));

  const cm = themeData.complaints || {};
  await si('complaints', (cm.categories || []).map(c => ({
    report_id: rid, titulo: c.titulo, porcentaje: c.porcentaje, items: c.items
  })));

  const news = themeData.news || {};
  const newsRows = [];
  ['positivo', 'neutral', 'negativo'].forEach(rating => {
    const groups = news.grupos?.[rating] || news[rating] || [];
    groups.forEach(g => {
      (g.noticias || []).forEach(n => {
        newsRows.push({ report_id: rid, rating, group_titulo: g.titulo,
          titulo: n.titulo, fuente: n.fuente, fecha: n.fecha, link: n.link });
      });
    });
  });
  await si('news_items', newsRows);

  await si('trending_topics', (themeData.trending || []).map((x, i) => ({
    report_id: rid, rank: i + 1, titulo: x.titulo, description: x.desc,
    views: x.metricas?.views || 0, likes: x.metricas?.likes || 0,
    pos_pct: x.sent?.positivo_porcentaje || 0, neg_pct: x.sent?.negativo_porcentaje || 0
  })));

  await si('influencers', (themeData.influencers?.top || []).map(p => ({
    report_id: rid, rank: p.rank, username: p.username, platform: p.platform,
    followers: p.followers || 0, sentiment: p.sentiment, categoria: p.categoria, url: p.url
  })));

  await si('timeline_events', (themeData.timeline?.events || []).map(e => ({
    report_id: rid, event_date: e.date || null, main: e.main,
    sentiment: e.sentiment, engagement: e.engagement, posts: e.posts || 0
  })));

  const pc = themeData.pros_cons || themeData.proscons || {};
  await si('pros_cons', [
    ...(pc.positive || []).map(item => ({ report_id: rid, type: 'pro', item: String(item) })),
    ...(pc.negative || []).map(item => ({ report_id: rid, type: 'con', item: String(item) })),
    ...(pc.neutral || []).map(item => ({ report_id: rid, type: 'neutral', item: String(item) })),
  ]);

  await si('reconocimientos', (themeData.recon || themeData.reconocimientos || []).map(x => ({
    report_id: rid, titulo: x.titulo, description: x.desc
  })));

  await si('keywords', (themeData.keywords || []).map(k => ({ report_id: rid, word: k.w, count: k.n })));
  await si('emojis', (themeData.emojis || []).map(e => ({ report_id: rid, emoji: e.emoji, count: e.count })));

  const ct = themeData.commentsTopics || themeData.comments_topics || {};
  await si('comments_topics', (ct.topics || []).map(t => ({
    report_id: rid, titulo: t.titulo, porcentaje: t.porcentaje, items: t.items
  })));

  const vs = themeData.voices || {};
  await si('voice_segments', (vs.segmentos || []).map(seg => ({
    report_id: rid, label: seg.label, narrativa: seg.narrativa, sentimiento: seg.sentimiento
  })));

  const gap = themeData.gap || themeData.narrative_gap || {};
  if (gap.oficial || gap.contraste || gap.resumen) {
    await si('narrative_gap', [{ report_id: rid, oficial: gap.oficial, contraste: gap.contraste, resumen: gap.resumen }]);
  }

  return rid;
}

async function main() {
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.csv')).sort();
  console.log(`\nEncontrados ${files.length} archivos CSV\n`);

  const results = { ok: [], skip: [], err: [] };

  for (const filename of files) {
    const filepath = join(DATA_DIR, filename);
    try {
      const text = readFileSync(filepath, 'utf8');
      const { dateKey, themeKey, themeData } = parseDailyCSV(text, filename);
      await saveReport({ dateKey, themeKey, themeData, filename });
      console.log(`  ✓ ${filename} → ${themeKey} ${dateKey}  pos:${themeData.sentiment?.pos||0}% neg:${themeData.sentiment?.neg||0}%`);
      results.ok.push({ filename, dateKey, themeKey, pos: themeData.sentiment?.pos||0, neg: themeData.sentiment?.neg||0 });
    } catch (e) {
      console.error(`  ✕ ${filename}: ${e.message}`);
      results.err.push({ filename, error: e.message });
    }
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`✓ OK:    ${results.ok.length}`);
  console.log(`✕ Error: ${results.err.length}`);
  if (results.err.length) {
    console.log('\nErrores:');
    results.err.forEach(r => console.log(`  ${r.filename}: ${r.error}`));
  }
}

main().catch(console.error);
