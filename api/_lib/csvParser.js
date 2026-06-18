// Server-side CSV parser — same logic as src/utils/csvParser.js

function arr(v) { return Array.isArray(v) ? v : []; }

function parseJsonField(row, col) {
  const raw = row[col];
  if (!raw || raw.trim() === '') return null;
  try { return JSON.parse(raw); } catch { return null; }
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

function detectTheme(filename) {
  const f = filename.toLowerCase();
  if (f.includes('musica') || f.includes('música')) return { key:'musica', label:'Música', es:'Su obra musical, conciertos y legado artístico' };
  if (f.includes('entrevista')) return { key:'entrevistas', label:'Entrevistas', es:'Apariciones en medios, entrevistas y declaraciones públicas' };
  if (f.includes('empresa')) return { key:'empresas', label:'Empresas', es:'Sus negocios, marca y proyectos empresariales' };
  if (f.includes('familia') || f.includes('dinastia') || f.includes('dinastía')) return { key:'familia', label:'Familia', es:'La dinastía Aguilar y la vida familiar pública' };
  return null;
}

function detectDate(filename) {
  const f = filename.toLowerCase();
  const m = f.match(/(\d{2})[-_](\d{2})[-_]?jun/) || f.match(/(\d{2})[-_](\d{2})jun/);
  if (m) return `2026-06-${String(parseInt(m[1], 10)).padStart(2,'0')}`;
  const m2 = f.match(/(\d{2})jun/);
  if (m2) return `2026-06-${String(parseInt(m2[1],10)).padStart(2,'0')}`;
  // fallback: today
  const d = new Date();
  return d.toISOString().slice(0,10);
}

const KNOWN_COLS = ['consolidated_analysis','complaints_analysis','trending_topics_analysis',
  'timeline_analysis','news_analysis','alertometro_analysis','oportunometro_analysis',
  'reconocimientos_analysis','influencers_impact_analysis','agents_summary',
  'deep_sentiment_analysis','comments_topics_analysis','pros_and_cons',
  'narrative_gap_analysis','voices_analysis'];

export function parseDailyCSV(csvText, filename) {
  const rows = parseCsvRaw(csvText);
  if (rows.length < 2) throw new Error('CSV vacío o sin datos');

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
  if (!dataRow) throw new Error('No se encontró fila de datos');

  const row = {};
  headers.forEach((h, i) => { row[h] = (dataRow[i] || '').trim(); });

  const theme = detectTheme(filename);
  if (!theme) throw new Error('No se reconoció el tema desde el nombre del archivo: ' + filename);
  const dateKey = detectDate(filename);

  const consolidated = parseJsonField(row, 'consolidated_analysis') || {};
  const alerts = parseJsonField(row, 'alertometro_analysis') || {};
  const opps = parseJsonField(row, 'oportunometro_analysis') || {};
  const complaints = parseJsonField(row, 'complaints_analysis') || {};
  const trending = parseJsonField(row, 'trending_topics_analysis') || {};
  const timeline = parseJsonField(row, 'timeline_analysis') || {};
  const news = parseJsonField(row, 'news_analysis') || {};
  const recon = parseJsonField(row, 'reconocimientos_analysis') || {};
  const influencers = parseJsonField(row, 'influencers_impact_analysis') || {};
  const proscons = parseJsonField(row, 'pros_and_cons') || {};
  const gap = parseJsonField(row, 'narrative_gap_analysis') || {};
  const voices = parseJsonField(row, 'voices_analysis') || {};
  const commentsTopics = parseJsonField(row, 'comments_topics_analysis') || {};
  const deepSent = parseJsonField(row, 'deep_sentiment_analysis') || {};
  const agentsSummary = parseJsonField(row, 'agents_summary') || {};

  function pct(v) { return parseFloat(typeof v === 'object' && v !== null ? v.percentage ?? v.porcentaje ?? 0 : v ?? 0) || 0; }
  function cnt(v) { return parseInt(typeof v === 'object' && v !== null ? v.count ?? v.cantidad ?? 0 : v ?? 0, 10) || 0; }

  const sd = consolidated?.sentiment_distribution || consolidated?.sentiment_stats?.overall_sentiment?.overall_sentiment_distribution || {};
  const pos = pct(sd.positive_percentage ?? sd.positivo);
  const neu = pct(sd.neutral_percentage ?? sd.neutral);
  const neg = pct(sd.negative_percentage ?? sd.negativo);
  const posC = cnt(sd.positive_count ?? sd.positivo_count ?? sd.positivo);
  const neuC = cnt(sd.neutral_count ?? sd.neutral);
  const negC = cnt(sd.negative_count ?? sd.negativo_count ?? sd.negativo);

  const ra = consolidated?.risk_assessment || consolidated?.sentiment_stats?.risk_assessment || {};
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
    platformArr = Array.isArray(inner) ? inner : Object.entries(inner).map(([name, d]) => ({ ...d, _name: name }));
  }
  const platforms = platformArr.map(p => {
    const name = (p.platform || p.name || p._name || '').toLowerCase();
    const sd2 = p.sentiment_distribution || p.sentiment || p.sent || {};
    return { name, posts: p.total_posts || p.posts || 0, comments: p.total_comments || p.comments || 0,
      users: p.unique_users || p.users || 0,
      sent: { positivo: pct(sd2.positivo ?? sd2.positive_percentage ?? sd2.positive),
               neutral: pct(sd2.neutral ?? sd2.neutral_percentage),
               negativo: pct(sd2.negativo ?? sd2.negative_percentage ?? sd2.negative) } };
  });

  const alertResumen = alerts.resumen_alertas || alerts;
  const alertData = {
    nivel: alertResumen.nivel_crisis_general || alertResumen.nivel || 'sin_alertas',
    recomendacion: alertResumen.recomendacion || '',
    total: alertResumen.total_posts_con_alerta || alertResumen.total || 0,
    analizados: alertResumen.posts_analizados || alertResumen.analizados || 0,
    posts: arr(alerts.top_posts_peligrosos || alerts.high_risk_posts || alerts.posts).map(p => ({
      url: p.url || '', text: p.text || p.content || '', tipo: p.tipo_alerta || p.tipo || 'alerta',
      platform: (p.platform || '').toLowerCase(), time: p.timestamp || p.time || '',
      score: String(p.score_peligrosidad || p.score || ''), razon: p.razon || p.reason || '',
      engagement: p.engagement || 0, username: p.username || '' })),
  };

  const oppResumen = opps.resumen_oportunidades || opps;
  const oppData = {
    nivel: oppResumen.nivel_oportunidad_general || oppResumen.nivel || 'bajo',
    recomendacion: oppResumen.recomendacion || '',
    total: oppResumen.total_posts_con_oportunidad || oppResumen.total || 0,
    analizados: oppResumen.posts_analizados || oppResumen.analizados || 0,
    posts: arr(opps.top_mejores_oportunidades || opps.top_opportunities || opps.posts).map(p => ({
      url: p.url || '', text: p.text || p.content || '', impacto: p.nivel_impacto || p.impacto || '',
      platform: (p.platform || '').toLowerCase(), time: p.timestamp || p.time || '',
      score: String(p.score_oportunidad || p.score || ''), razon: p.razon || p.reason || '',
      engagement: p.engagement || 0, username: p.username || '' })),
  };

  function pcArr(v) { if (!v) return []; if (Array.isArray(v)) return v; if (v.items && Array.isArray(v.items)) return v.items; return []; }
  const pc = {
    positive: pcArr(proscons.pros || proscons.positive || proscons.a_favor),
    negative: pcArr(proscons.cons || proscons.negative || proscons.en_contra),
    neutral: pcArr(proscons.neutral || proscons.observaciones),
  };

  const cm = {
    total: complaints.total_complaints || complaints.total || 0,
    categories: arr(complaints.complaint_categories || complaints.categories).map(cat => ({
      titulo: cat.category || cat.titulo || '', porcentaje: cat.percentage || cat.porcentaje || 0,
      items: arr(cat.complaints || cat.items).map(it => ({ texto: it.complaint || it.texto || it, sources: arr(it.sources).map(s => ({ url: s.url || '', platform: s.platform || '' })) })) })),
  };

  const newsData = {};
  if (news && (news.positive_coverage || news.neutral_coverage || news.negative_coverage || news.positivo || news.neutral || news.negativo)) {
    newsData.total = news.total_news || news.total || 0;
    ['positivo','neutral','negativo'].forEach(r => {
      const src = news[r+'_coverage'] || news[r] || [];
      newsData[r] = arr(src).map(g => ({
        titulo: g.title || g.titulo || '', porcentaje: g.coverage_percentage || g.porcentaje || 0,
        noticias: arr(g.articles || g.noticias).map(n => ({ titulo: n.headline || n.titulo || '', fuente: n.source || n.fuente || '', fecha: n.date || n.fecha || '', link: n.url || n.link || '' })) }));
    });
  }

  const trendData = arr(trending.trending_topics || trending.topics || trending.tendencias || trending.temas).map(x => ({
    titulo: x.topic || x.titulo || x['título'] || '',
    desc: x.description || x.desc || x['descripción'] || x.descripcion || '',
    metricas: { views: x.metrics?.views || x.views || 0, likes: x.metrics?.likes || x.likes || 0 },
    sent: { positivo_porcentaje: x.sentiment?.positive_percentage || 0, negativo_porcentaje: x.sentiment?.negative_percentage || 0 },
  }));

  const reconData = arr(recon.recognitions || recon.reconocimientos || recon.items).map(r => ({ titulo: r.title || r.titulo || '', desc: r.description || r.desc || '' }));

  const infTop = arr(influencers.top_influencers || influencers.top || influencers.influencers).map((p, i) => ({
    rank: p.rank || i + 1, username: p.username || p.name || '',
    platform: (p.platform || '').toLowerCase(), followers: p.followers || 0,
    url: p.url || p.profile_url || '', categoria: p.category || p.categoria || '',
    sentiment: p.sentiment || p.sentimiento || 'neutral' }));

  const gapData = { oficial: gap.official_narrative || gap.oficial || {}, contraste: gap.contrast || gap.contraste || {}, resumen: gap.summary || gap.resumen || {} };

  const voicesData = {
    resumen: voices.summary || voices.resumen || '',
    segmentos: arr(voices.segments || voices.segmentos).map(s => ({ label: s.segment || s.label || '', narrativa: s.narrative || s.narrativa || '', sentimiento: s.sentiment || s.sentimiento || '' })),
    alertas: arr(voices.alerts || voices.alertas).map(a => ({ tema: a.topic || a.tema || '', descripcion: a.description || a.descripcion || '', severidad: a.severity || a.severidad || 'media' })),
  };

  const ctData = {
    total: commentsTopics.total_comments || commentsTopics.total || 0,
    topics: arr(commentsTopics.comment_topics || commentsTopics.topics).map(t => ({ titulo: t.topic || t.titulo || '', porcentaje: t.percentage || t.porcentaje || 0, items: (t.examples || t.items || []).slice(0, 4) })),
  };

  const emojiSrc = deepSent.top_emojis || deepSent.emojis || agentsSummary.top_emojis || [];
  const emojis = arr(emojiSrc).slice(0, 12).map(e => ({ emoji: e.emoji || e.symbol || '', count: e.count || e.frequency || 0 }));

  const kwSrc = deepSent.top_keywords || deepSent.keywords || agentsSummary.top_keywords || agentsSummary.hashtags || [];
  const keywords = arr(kwSrc).slice(0, 32).map(k => ({ w: k.keyword || k.word || k.hashtag || String(k), n: k.count || k.frequency || 1 })).sort((a, b) => b.n - a.n);

  const themeData = {
    label: theme.label, es: theme.es,
    sentiment: { pos, neu, neg, posC, neuC, negC },
    risk: { level: riskLevel, urgency: ra.urgency || '', negPct: neg, attention: neg > 20 },
    health: Math.round(100 - neg),
    totals, platforms,
    alerts: alertData, opps: oppData, proscons: pc, complaints: cm,
    news: Object.keys(newsData).length ? newsData : null,
    trending: trendData, recon: reconData,
    influencers: { total: influencers.total_influencers || infTop.length, top: infTop },
    gap: gapData, voices: voicesData, commentsTopics: ctData, emojis, keywords,
    timeline: {
      events: arr(timeline.daily_events || timeline.events).map(e => ({
        date: e.date || '', main: e.main_event || e.main || e.description || '',
        sentiment: e.sentiment || '', engagement: e.engagement_level || e.engagement || '',
        posts: e.post_count || e.posts || 0 })),
    },
  };

  return { dateKey, themeKey: theme.key, themeData };
}
