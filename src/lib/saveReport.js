import { supabase } from './supabase';

async function si(table, rows) {
  if (!rows || !rows.length) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) console.warn(`${table} insert:`, error.message);
}

export async function saveReport({ dateKey, themeKey, themeData, filename }) {
  // 1. Delete existing report for same date+theme (children cascade via ON DELETE CASCADE)
  await supabase.from('reports').delete().eq('date_key', dateKey).eq('theme_key', themeKey);

  // 2. Insert fresh report row
  const { data: rep, error: repErr } = await supabase
    .from('reports')
    .insert({ date_key: dateKey, theme_key: themeKey, theme_label: themeData.label, filename })
    .select('id').single();
  if (repErr) { console.error('Supabase reports insert error:', repErr); throw repErr; }
  const rid = rep.id;
  console.log('Supabase: saved report', rid, themeKey, dateKey);

  const s = themeData.sentiment || {};
  const r = themeData.risk || {};

  // 3. Sentiment
  await si('sentiment', [{ report_id: rid, pos: s.pos, neu: s.neu, neg: s.neg,
    pos_count: s.posC, neu_count: s.neuC, neg_count: s.negC, risk_level: r.level }]);

  // 4. Platforms
  await si('platforms', (themeData.platforms || []).map(p => ({
    report_id: rid, platform: p.name, posts: p.posts, comments: p.comments, users: p.users,
    sent_pos: p.sent?.positivo || 0, sent_neu: p.sent?.neutral || 0, sent_neg: p.sent?.negativo || 0
  })));

  // 5. Alert posts
  const al = themeData.alerts || {};
  await si('alert_posts', (al.posts || []).map(p => ({
    report_id: rid, url: p.url, text: p.text, tipo: p.tipo, platform: p.platform,
    time: p.time, score: String(p.score || ''), razon: p.razon, engagement: p.engagement || 0, username: p.username
  })));

  // 6. Opportunity posts
  const op = themeData.opps || {};
  await si('opportunity_posts', (op.posts || []).map(p => ({
    report_id: rid, url: p.url, text: p.text, impacto: p.impacto, platform: p.platform,
    time: p.time, score: String(p.score || ''), razon: p.razon, engagement: p.engagement || 0, username: p.username
  })));

  // 7. Complaints
  const cm = themeData.complaints || {};
  await si('complaints', (cm.categories || []).map(c => ({
    report_id: rid, titulo: c.titulo, porcentaje: c.porcentaje, items: c.items
  })));

  // 8. News
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

  // 9. Trending
  await si('trending_topics', (themeData.trending || []).map((x, i) => ({
    report_id: rid, rank: i + 1, titulo: x.titulo, description: x.desc,
    views: x.metricas?.views || 0, likes: x.metricas?.likes || 0,
    pos_pct: x.sent?.positivo_porcentaje || 0, neg_pct: x.sent?.negativo_porcentaje || 0
  })));

  // 10. Influencers
  await si('influencers', (themeData.influencers?.top || []).map(p => ({
    report_id: rid, rank: p.rank, username: p.username, platform: p.platform,
    followers: p.followers || 0, sentiment: p.sentiment, categoria: p.categoria, url: p.url
  })));

  // 11. Timeline
  await si('timeline_events', (themeData.timeline?.events || []).map(e => ({
    report_id: rid, event_date: e.date || null, main: e.main,
    sentiment: e.sentiment, engagement: e.engagement, posts: e.posts || 0
  })));

  // 12. Pros/cons
  const pc = themeData.proscons || themeData.pros_cons || {};
  await si('pros_cons', [
    ...(pc.positive || []).map(item => ({ report_id: rid, type: 'pro', item: String(item) })),
    ...(pc.negative || []).map(item => ({ report_id: rid, type: 'con', item: String(item) })),
    ...(pc.neutral || []).map(item => ({ report_id: rid, type: 'neutral', item: String(item) })),
  ]);

  // 13. Reconocimientos
  await si('reconocimientos', (themeData.recon || themeData.reconocimientos || []).map(x => ({
    report_id: rid, titulo: x.titulo, description: x.desc
  })));

  // 14. Keywords
  await si('keywords', (themeData.keywords || []).map(k => ({ report_id: rid, word: k.w, count: k.n })));

  // 15. Emojis
  await si('emojis', (themeData.emojis || []).map(e => ({ report_id: rid, emoji: e.emoji, count: e.count })));

  // 16. Comments topics
  const ct = themeData.commentsTopics || themeData.comments_topics || {};
  await si('comments_topics', (ct.topics || []).map(t => ({
    report_id: rid, titulo: t.titulo, porcentaje: t.porcentaje, items: t.items
  })));

  // 17. Voice segments
  const vs = themeData.voices || {};
  await si('voice_segments', (vs.segmentos || []).map(seg => ({
    report_id: rid, label: seg.label, narrativa: seg.narrativa, sentimiento: seg.sentimiento
  })));

  // 18. Narrative gap
  const gap = themeData.gap || themeData.narrative_gap || {};
  if (gap.oficial || gap.contraste || gap.resumen) {
    await si('narrative_gap', [{ report_id: rid, oficial: gap.oficial, contraste: gap.contraste, resumen: gap.resumen }]);
  }

  return rid;
}
