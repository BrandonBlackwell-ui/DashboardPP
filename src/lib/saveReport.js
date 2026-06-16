import { supabase } from './supabase';

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
  await supabase.from('sentiment').insert({
    report_id: rid, pos: s.pos, neu: s.neu, neg: s.neg,
    pos_count: s.posC, neu_count: s.neuC, neg_count: s.negC, risk_level: r.level
  }).catch(e => console.warn('child insert error:', e));

  // 4. Platforms
  const pls = (themeData.platforms || []).map(p => ({
    report_id: rid, platform: p.name, posts: p.posts, comments: p.comments, users: p.users,
    sent_pos: p.sent?.positivo || p.sentiment?.positivo || 0, sent_neu: p.sent?.neutral || p.sentiment?.neutral || 0, sent_neg: p.sent?.negativo || p.sentiment?.negativo || 0
  }));
  if (pls.length) await supabase.from('platforms').insert(pls).catch(e => console.warn('child insert error:', e));

  // 5. Alert posts
  const al = themeData.alertometro || themeData.alerts || {};
  const alPosts = (al.posts || []).map(p => ({
    report_id: rid, url: p.url, text: p.text, tipo: p.tipo, platform: p.platform,
    time: p.time, score: String(p.score||''), razon: p.razon, engagement: p.engagement||0, username: p.username
  }));
  if (alPosts.length) await supabase.from('alert_posts').insert(alPosts).catch(e => console.warn('child insert error:', e));

  // 6. Opportunity posts
  const op = themeData.oportunometro || themeData.opps || {};
  const opPosts = (op.posts || []).map(p => ({
    report_id: rid, url: p.url, text: p.text, impacto: p.impacto, platform: p.platform,
    time: p.time, score: String(p.score||''), razon: p.razon, engagement: p.engagement||0, username: p.username
  }));
  if (opPosts.length) await supabase.from('opportunity_posts').insert(opPosts).catch(e => console.warn('child insert error:', e));

  // 7. Complaints
  const cm = themeData.complaints || {};
  const cats = (cm.categories || []).map(c => ({
    report_id: rid, titulo: c.titulo, porcentaje: c.porcentaje, items: c.items
  }));
  if (cats.length) await supabase.from('complaints').insert(cats).catch(e => console.warn('child insert error:', e));

  // 8. News
  const news = themeData.news || {};
  const newsRows = [];
  ['positivo','neutral','negativo'].forEach(rating => {
    const groups = news.grupos?.[rating] || news[rating] || [];
    groups.forEach(g => {
      (g.noticias || []).forEach(n => {
        newsRows.push({ report_id: rid, rating, group_titulo: g.titulo,
          titulo: n.titulo, fuente: n.fuente, fecha: n.fecha, link: n.link });
      });
    });
  });
  if (newsRows.length) await supabase.from('news_items').insert(newsRows).catch(e => console.warn('child insert error:', e));

  // 9. Trending
  const trendRows = (themeData.trending || []).map((x, i) => ({
    report_id: rid, rank: i+1, titulo: x.titulo, description: x.desc,
    views: x.metricas?.views||0, likes: x.metricas?.likes||0,
    pos_pct: x.sent?.positivo_porcentaje||0, neg_pct: x.sent?.negativo_porcentaje||0
  }));
  if (trendRows.length) await supabase.from('trending_topics').insert(trendRows).catch(e => console.warn('child insert error:', e));

  // 10. Influencers
  const infRows = (themeData.influencers?.top || []).map(p => ({
    report_id: rid, rank: p.rank, username: p.username, platform: p.platform,
    followers: p.followers||0, sentiment: p.sentiment, categoria: p.categoria, url: p.url
  }));
  if (infRows.length) await supabase.from('influencers').insert(infRows).catch(e => console.warn('child insert error:', e));

  // 11. Timeline
  const tlRows = (themeData.timeline?.events || []).map(e => ({
    report_id: rid, event_date: e.date||null, main: e.main,
    sentiment: e.sentiment, engagement: e.engagement, posts: e.posts||0
  }));
  if (tlRows.length) await supabase.from('timeline_events').insert(tlRows).catch(e => console.warn('child insert error:', e));

  // 12. Pros/cons
  const pc = themeData.pros_cons || themeData.proscons || {};
  const pcRows = [
    ...(pc.positive||[]).map(item=>({report_id:rid, type:'pro', item:String(item)})),
    ...(pc.negative||[]).map(item=>({report_id:rid, type:'con', item:String(item)})),
    ...(pc.neutral||[]).map(item=>({report_id:rid, type:'neutral', item:String(item)})),
  ];
  if (pcRows.length) await supabase.from('pros_cons').insert(pcRows).catch(e => console.warn('child insert error:', e));

  // 13. Reconocimientos
  const rcRows = (themeData.reconocimientos || themeData.recon || []).map(x => ({
    report_id: rid, titulo: x.titulo, description: x.desc
  }));
  if (rcRows.length) await supabase.from('reconocimientos').insert(rcRows).catch(e => console.warn('child insert error:', e));

  // 14. Keywords
  const kwRows = (themeData.keywords || []).map(k => ({ report_id: rid, word: k.w, count: k.n }));
  if (kwRows.length) await supabase.from('keywords').insert(kwRows).catch(e => console.warn('child insert error:', e));

  // 15. Emojis
  const emojiRows = (themeData.emojis || []).map(e => ({ report_id: rid, emoji: e.emoji, count: e.count }));
  if (emojiRows.length) await supabase.from('emojis').insert(emojiRows).catch(e => console.warn('child insert error:', e));

  // 16. Comments topics
  const ctRows = (themeData.comments_topics?.topics || themeData.commentsTopics?.topics || []).map(t => ({
    report_id: rid, titulo: t.titulo, porcentaje: t.porcentaje, items: t.items
  }));
  if (ctRows.length) await supabase.from('comments_topics').insert(ctRows).catch(e => console.warn('child insert error:', e));

  // 17. Voice segments
  const vs = themeData.voices || {};
  const vsRows = (vs.segmentos || []).map(s => ({
    report_id: rid, label: s.label, narrativa: s.narrativa, sentimiento: s.sentimiento
  }));
  if (vsRows.length) await supabase.from('voice_segments').insert(vsRows).catch(e => console.warn('child insert error:', e));

  // 18. Narrative gap
  const gap = themeData.narrative_gap || themeData.gap || {};
  if (gap && (gap.oficial || gap.contraste || gap.resumen)) {
    await supabase.from('narrative_gap').insert({
      report_id: rid, oficial: gap.oficial, contraste: gap.contraste, resumen: gap.resumen
    }).catch(e => console.warn('child insert error:', e));
  }

  return rid;
}
