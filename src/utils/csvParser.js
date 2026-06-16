// Parses a Pepe Aguilar daily report CSV (same format as historical files)
// Returns { dateKey, themeKey, themeData } or throws on error

function arr(v) { return Array.isArray(v) ? v : []; }

function parseJsonField(row, col) {
  const raw = row[col];
  if (!raw || raw.trim() === '') return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : ''; }

function platLabel(p) {
  return ({ tiktok:'TikTok', facebook:'Facebook', instagram:'Instagram', twitter:'X', google_news:'Google News' })[p]
    || (p ? p.charAt(0).toUpperCase() + p.slice(1) : '—');
}

// Parse a CSV string that has JSON blobs in cells (handles multi-line JSON inside quoted fields)
export function parseCsvRaw(text) {
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
    } else {
      cur += ch;
    }
    i++;
  }
  if (cur || fields.length) { fields.push(cur); if (fields.some(f=>f.trim())) rows.push(fields); }
  return rows;
}

// Detect theme key and label from filename
export function detectTheme(filename) {
  const f = filename.toLowerCase();
  if (f.includes('musica') || f.includes('música')) return { key:'musica', label:'Música', es:'Su obra musical, conciertos y legado artístico' };
  if (f.includes('entrevista')) return { key:'entrevistas', label:'Entrevistas', es:'Apariciones en medios, entrevistas y declaraciones públicas' };
  if (f.includes('empresa')) return { key:'empresas', label:'Empresas', es:'Sus negocios, marca y proyectos empresariales' };
  if (f.includes('familia') || f.includes('dinastia') || f.includes('dinastía')) return { key:'familia', label:'Familia', es:'La dinastía Aguilar y la vida familiar pública' };
  return null;
}

// Detect date range from filename, returns the END date as the primary date key
export function detectDate(filename) {
  const f = filename.toLowerCase();
  // patterns: 13-15jun, 09_10jun, 01_02_jun, etc.
  const m = f.match(/(\d{2})[-_](\d{2})[-_]?jun/) || f.match(/(\d{2})[-_](\d{2})jun/);
  if (m) {
    const end = parseInt(m[2], 10);
    return `2026-06-${String(end).padStart(2,'0')}`;
  }
  const m2 = f.match(/(\d{2})jun/);
  if (m2) return `2026-06-${String(parseInt(m2[1],10)).padStart(2,'0')}`;
  // fallback: today
  return new Date().toISOString().slice(0,10);
}

// Known column names that identify the real header row
const KNOWN_COLS = ['consolidated_analysis','complaints_analysis','trending_topics_analysis',
  'timeline_analysis','news_analysis','alertometro_analysis','oportunometro_analysis',
  'reconocimientos_analysis','influencers_impact_analysis','agents_summary',
  'deep_sentiment_analysis','comments_topics_analysis','pros_and_cons',
  'narrative_gap_analysis','voices_analysis'];

// Main parser: takes CSV text + filename, returns structured theme data
export function parseDailyCSV(csvText, filename) {
  const rows = parseCsvRaw(csvText);
  if (rows.length < 2) throw new Error('CSV vacío o sin datos');

  // Find the real header row (handles 3-row offset format with report_id metadata)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const normalized = rows[i].map(h => h.trim().toLowerCase());
    if (KNOWN_COLS.some(c => normalized.includes(c))) { headerIdx = i; break; }
  }
  const headers = rows[headerIdx].map(h => h.trim().replace(/^﻿/, ''));

  // Find data row after headers (skip empty rows)
  let dataRow = null;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    if (rows[i].length >= 3 && rows[i].some(f => f.trim())) { dataRow = rows[i]; break; }
  }
  if (!dataRow) throw new Error('No se encontró fila de datos');

  const row = {};
  headers.forEach((h, i) => { row[h] = (dataRow[i] || '').trim(); });

  const theme = detectTheme(filename);
  if (!theme) throw new Error('No se reconoció el tema desde el nombre del archivo');
  const dateKey = detectDate(filename);

  // Parse all JSON columns
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

  // Extract sentiment
  const sd = consolidated?.sentiment_distribution || consolidated?.sentiment_stats?.overall_sentiment?.overall_sentiment_distribution || {};
  const pos = parseFloat(sd.positive_percentage || sd.positivo || 0);
  const neu = parseFloat(sd.neutral_percentage || sd.neutral || 0);
  const neg = parseFloat(sd.negative_percentage || sd.negativo || 0);
  const posC = parseInt(sd.positive_count || sd.positivo_count || 0, 10);
  const neuC = parseInt(sd.neutral_count || 0, 10);
  const negC = parseInt(sd.negative_count || sd.negativo_count || 0, 10);

  // Risk
  const ra = consolidated?.risk_assessment || {};
  const riskLevel = (ra.risk_level || ra.nivel || 'bajo').toLowerCase();

  // Totals
  const totals = {
    posts: consolidated?.post_count || consolidated?.total_posts || 0,
    users: consolidated?.unique_users || 0,
    platforms: consolidated?.platform_count || 0,
    engagement: consolidated?.avg_engagement || 0,
  };

  // Platforms
  const platforms = arr(consolidated?.platform_breakdown || consolidated?.platforms).map(p => ({
    name: (p.platform || p.name || '').toLowerCase(),
    posts: p.total_posts || p.posts || 0,
    comments: p.total_comments || p.comments || 0,
    users: p.unique_users || p.users || 0,
    engagement: p.avg_engagement || p.engagement || 0,
    sent: {
      positivo: p.sentiment?.positive_percentage || p.sent?.positivo || 0,
      neutral: p.sentiment?.neutral_percentage || p.sent?.neutral || 0,
      negativo: p.sentiment?.negative_percentage || p.sent?.negativo || 0,
    }
  }));

  // Alerts
  const alertData = {
    nivel: alerts.nivel || alerts.alert_level || 'sin_alertas',
    recomendacion: alerts.recomendacion || alerts.recommendation || '',
    total: alerts.total_alerts || alerts.total || 0,
    analizados: alerts.posts_analyzed || alerts.analizados || 0,
    posts: arr(alerts.high_risk_posts || alerts.posts).map(p => ({
      url: p.url || p.link || '',
      text: p.text || p.content || '',
      tipo: p.tipo || p.alert_type || p.type || 'alerta',
      platform: (p.platform || '').toLowerCase(),
      time: p.timestamp || p.time || p.date || '',
      score: p.danger_score || p.score || p.peligrosidad || '',
      razon: p.razon || p.reason || '',
      engagement: p.engagement || 0,
      username: p.username || p.user || '',
    })),
  };

  // Opportunities
  const oppData = {
    nivel: opps.opportunity_level || opps.nivel || 'bajo',
    recomendacion: opps.recomendacion || opps.recommendation || '',
    total: opps.total_opportunities || opps.total || 0,
    analizados: opps.posts_analyzed || opps.analizados || 0,
    posts: arr(opps.top_opportunities || opps.posts).map(p => ({
      url: p.url || p.link || '',
      text: p.text || p.content || '',
      impacto: p.impact_level || p.impacto || '',
      platform: (p.platform || '').toLowerCase(),
      time: p.timestamp || p.time || p.date || '',
      score: p.opportunity_score || p.score || '',
      razon: p.razon || p.reason || '',
      engagement: p.engagement || 0,
      username: p.username || p.user || '',
    })),
  };

  // Pros & cons
  const pc = {
    positive: arr(proscons.pros || proscons.positive || proscons.a_favor),
    negative: arr(proscons.cons || proscons.negative || proscons.en_contra),
    neutral: arr(proscons.neutral || proscons.observaciones),
  };

  // Complaints
  const cm = {
    total: complaints.total_complaints || complaints.total || 0,
    categories: arr(complaints.complaint_categories || complaints.categories).map(cat => ({
      titulo: cat.category || cat.titulo || '',
      porcentaje: cat.percentage || cat.porcentaje || 0,
      items: arr(cat.complaints || cat.items).map(it => ({
        texto: it.complaint || it.texto || it,
        sources: arr(it.sources).map(s => ({ url: s.url || s.link || '', platform: s.platform || '' })),
      })),
    })),
  };

  // News
  const newsData = {};
  if (news && (news.positive_coverage || news.neutral_coverage || news.negative_coverage || news.positivo || news.neutral || news.negativo)) {
    newsData.total = news.total_news || news.total || 0;
    ['positivo','neutral','negativo'].forEach(r => {
      const src = news[r+'_coverage'] || news[r] || [];
      newsData[r] = arr(src).map(g => ({
        titulo: g.title || g.titulo || '',
        descripcion: g.description || g.descripcion || '',
        porcentaje: g.coverage_percentage || g.porcentaje || 0,
        noticias: arr(g.articles || g.noticias).map(n => ({
          titulo: n.headline || n.titulo || n.title || '',
          fuente: n.source || n.fuente || '',
          fecha: n.date || n.fecha || '',
          link: n.url || n.link || n.href || '',
        })),
      }));
    });
  }

  // Trending
  const trendData = arr(trending.trending_topics || trending.topics || trending.tendencias).map(x => ({
    titulo: x.topic || x.titulo || x.title || '',
    desc: x.description || x.desc || '',
    metricas: { views: x.metrics?.views || x.views || x.metricas?.views || 0, likes: x.metrics?.likes || x.likes || x.metricas?.likes || 0 },
    sent: { positivo_porcentaje: x.sentiment?.positive_percentage || x.sent?.positivo_porcentaje || 0, negativo_porcentaje: x.sentiment?.negative_percentage || x.sent?.negativo_porcentaje || 0 },
  }));

  // Reconocimientos
  const reconData = arr(recon.recognitions || recon.reconocimientos || recon.items).map(r => ({
    titulo: r.title || r.titulo || '',
    desc: r.description || r.desc || '',
    metricas: { views: r.metrics?.views || r.views || 0 },
  }));

  // Influencers
  const infTop = arr(influencers.top_influencers || influencers.top || influencers.influencers).map((p, i) => ({
    rank: p.rank || i + 1,
    username: p.username || p.name || '',
    platform: (p.platform || '').toLowerCase(),
    followers: p.followers || p.follower_count || 0,
    pic: p.profile_pic || p.pic || p.avatar || '',
    url: p.url || p.profile_url || '',
    categoria: p.category || p.categoria || '',
    sentiment: p.sentiment || p.sentimiento || 'neutral',
  }));

  // Gap
  const gapData = {
    oficial: gap.official_narrative || gap.oficial || {},
    contraste: gap.contrast || gap.contraste || {},
    resumen: gap.summary || gap.resumen || {},
  };

  // Voices
  const voicesData = {
    resumen: voices.summary || voices.resumen || '',
    segmentos: arr(voices.segments || voices.segmentos).map(s => ({
      label: s.segment || s.label || '',
      narrativa: s.narrative || s.narrativa || '',
      sentimiento: s.sentiment || s.sentimiento || '',
    })),
    alertas: arr(voices.alerts || voices.alertas).map(a => ({
      tema: a.topic || a.tema || '',
      descripcion: a.description || a.descripcion || '',
      severidad: a.severity || a.severidad || 'media',
    })),
  };

  // Comments topics
  const ctData = {
    total: commentsTopics.total_comments || commentsTopics.total || 0,
    topics: arr(commentsTopics.comment_topics || commentsTopics.topics).map(t => ({
      titulo: t.topic || t.titulo || '',
      porcentaje: t.percentage || t.porcentaje || 0,
      items: (t.examples || t.items || []).slice(0, 4),
    })),
  };

  // Emojis & keywords from deep sentiment or agents summary
  const emojiSrc = deepSent.top_emojis || deepSent.emojis || agentsSummary.top_emojis || [];
  const emojis = arr(emojiSrc).slice(0, 12).map(e => ({ emoji: e.emoji || e.symbol || '', count: e.count || e.frequency || 0 }));

  const kwSrc = deepSent.top_keywords || deepSent.keywords || agentsSummary.top_keywords || agentsSummary.hashtags || [];
  const keywords = arr(kwSrc).slice(0, 32).map(k => ({
    w: k.keyword || k.word || k.hashtag || k.w || String(k),
    n: k.count || k.frequency || k.n || 1,
  })).sort((a, b) => b.n - a.n);

  const themeData = {
    label: theme.label, es: theme.es,
    sentiment: { pos, neu, neg, posC, neuC, negC },
    risk: { level: riskLevel, urgency: ra.urgency || '', negPct: neg, attention: neg > 20 },
    health: Math.round(100 - neg),
    totals, platforms,
    alerts: alertData,
    opps: oppData,
    proscons: pc,
    complaints: cm,
    news: Object.keys(newsData).length ? newsData : null,
    trending: trendData,
    recon: reconData,
    influencers: { total: influencers.total_influencers || influencers.total || infTop.length, top: infTop },
    gap: gapData,
    voices: voicesData,
    commentsTopics: ctData,
    emojis, keywords,
    timeline: {
      events: arr(timeline.daily_events || timeline.events).map(e => ({
        date: e.date || '', main: e.main_event || e.main || e.description || '',
        sentiment: e.sentiment || '', engagement: e.engagement_level || e.engagement || '',
        posts: e.post_count || e.posts || 0,
      })),
    },
  };

  return { dateKey, themeKey: theme.key, themeData };
}
