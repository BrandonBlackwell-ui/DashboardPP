import { supabase } from './supabase';
import { getWeekendDates, getFridayDateKey, platLabel } from '../utils/helpers';

const NEG_KW = ['chisme','chismesito','polém','polemic','escándalo','escandalo','cancela','cancelad','colad','critica','crítica','critico','crítico','horrible','vergüenza','verguenza','fraude','mentira','hipócrita','hipocrita','controver','acusac','denuncia','trampa','falso','odio','asco','decepcion','decepción','hater','malo','pésimo','pesimo','ridículo','ridiculo','reclam'];
const POS_KW = ['fan','amor','love','increíble','increible','talento','mejor','hermoso','hermosa','apoy','admiro','admira','admiración','admiracion','genio','genial','orgullo','orgullos','bravo','maravill','gracias','éxito','exito','felicit','encanta','encanto','bonit','bellísim','bellisim','viva','gozo','alegria','alegría'];

function scoreText(text) {
  const t = (text || '').toLowerCase();
  const neg = NEG_KW.filter(k => t.includes(k)).length;
  const pos = POS_KW.filter(k => t.includes(k)).length;
  return neg > pos ? 'negative' : pos > neg ? 'positive' : 'neutral';
}

function cleanPct(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function sentimentFromAi(ai) {
  if (!ai?.sentimiento) return null;
  const raw = ai.sentimiento;
  const pos = cleanPct(raw.favorable ?? raw.positivo ?? raw.positive);
  const neg = cleanPct(raw.critico ?? raw.critica ?? raw.negativo ?? raw.negative);
  const neu = cleanPct(raw.neutral, Math.max(0, 100 - pos - neg));
  const total = pos + neu + neg || 1;
  return {
    pos: Math.round(pos / total * 100),
    neu: Math.round(neu / total * 100),
    neg: Math.max(0, 100 - Math.round(pos / total * 100) - Math.round(neu / total * 100)),
  };
}

function voicesFromAi(ai) {
  const voices = ai?.analisis_voces || ai?.voces || {};
  const normalize = (item, sentiment) => ({
    username: item.username || item.usuario || item.author || 'Sin usuario',
    platform: item.platform || item.red || '',
    followers: Number(item.followers || item.seguidores || 0),
    url: item.url || item.link || item.profile_url || '',
    posts: Number(item.posts_count || item.posts || 0),
    likes: Number(item.likes_count || item.likes || 0),
    comments: Number(item.comments_count || item.comments || 0),
    engagement: Number(item.total_engagement || item.engagement || 0),
    tier: item.tier || item.tamano || item.tamaño || 'micro',
    sentiment,
    keywords: item.keywords || item.gatillos || [],
    text: item.comentario_o_post || item.text || item.mensaje || '',
    impact: item.impacto || item.impact || '',
    score: Number(item.followers || item.seguidores || 0) * 0.1 + Number(item.total_engagement || item.engagement || 0),
  });
  return {
    allies: (voices.aliados_destacados || voices.aliados || []).map(v => normalize(v, 'positive')),
    critics: (voices.criticos_destacados || voices.contrarios_destacados || voices.criticos || voices.contrarios || []).map(v => normalize(v, 'negative')),
  };
}

function platformAiMap(ai) {
  const raw = ai?.desglose_por_red || ai?.desglose_redes || ai?.redes || ai?.sentimiento_por_red;
  if (!raw) return {};
  if (Array.isArray(raw)) {
    return raw.reduce((acc, row) => {
      const key = String(row.platform || row.red || row.name || '').toLowerCase();
      if (key) acc[key] = row;
      return acc;
    }, {});
  }
  return Object.entries(raw).reduce((acc, [key, value]) => {
    acc[String(key).toLowerCase()] = value || {};
    return acc;
  }, {});
}

// Helper function to build themeData dynamically from raw scraped posts and voices
function buildThemeFromScrapedData(rep) {
  const posts = rep.scraped_posts || [];
  const voicesList = rep.allies_critics_voices || [];
  const ai = rep.ai_analysis || null;
  const aiSentiment = sentimentFromAi(ai);
  const aiVoices = voicesFromAi(ai);
  const aiNetworks = platformAiMap(ai);

  // 1. Sentiment — only from AI. Keyword scoring removed.
  let posC = 0, negC = 0, neuC = 0;
  let posPct = 0, negPct = 0, neuPct = 0;
  let riskLevel = 'bajo';

  // 2. Platform breakdown — counts from scraped posts, sentiment only from AI per-network breakdown
  const platformMap = {};
  posts.forEach(p => {
    const plat = p.platform || 'unknown';
    if (!platformMap[plat]) platformMap[plat] = { posts: 0, comments: 0 };
    platformMap[plat].posts += 1;
    platformMap[plat].comments += p.comments_count || (p.scraped_comments?.length || 0);
  });

  const platforms = Object.entries(platformMap).map(([name, pm]) => {
    const aiRow = aiNetworks[String(name).toLowerCase()];
    const aiRowSent = aiRow ? sentimentFromAi({ sentimiento: aiRow.sentimiento || aiRow.sentiment || aiRow }) : null;
    return {
      name, posts: pm.posts, comments: pm.comments, users: pm.posts,
      sent: aiRowSent
        ? { positivo: aiRowSent.pos, neutral: aiRowSent.neu, negativo: aiRowSent.neg }
        : { positivo: 0, neutral: 0, negativo: 0 }
    };
  });

  // 3. Alerts and Opportunities
  let alertPosts = posts.filter(p => p.sentiment === 'negative')
    .sort((a,b) => (b.likes||0) - (a.likes||0))
    .slice(0, 10)
    .map(p => ({
      url: p.url, text: p.text, tipo: 'Crítica', platform: p.platform,
      time: p.published_date, score: '80', razon: 'Clasificado como negativo por el análisis de sentimiento',
      engagement: p.likes || 0, username: p.username
    }));

  const oppPosts = posts.filter(p => p.sentiment === 'positive')
    .sort((a,b) => (b.likes||0) - (a.likes||0))
    .slice(0, 10)
    .map(p => ({
      url: p.url, text: p.text, impacto: 'Alto', platform: p.platform,
      time: p.published_date, score: '85', razon: 'Clasificado como positivo por el análisis de sentimiento',
      engagement: p.likes || 0, username: p.username
    }));

  // redes_propias: sentiment and alerts come exclusively from AI (see aiSentiment block below)

  // 4. Voices (Allies/Critics)
  // Normalize username: strip leading @, lowercase
  const normKey = (u) => (u || '').toLowerCase().trim().replace(/^@/, '');

  // Build lookups indexed by normalized username
  const aiVoiceMap = {};
  [...(aiVoices.allies || []), ...(aiVoices.critics || [])].forEach(v => {
    const key = normKey(v.username);
    if (key) aiVoiceMap[key] = v;
  });

  const tableVoiceMap = {};
  voicesList.forEach(v => {
    const key = normKey(v.username);
    if (key) tableVoiceMap[key] = v;
  });

  // Merge a table row with AI narrative
  const mergeVoice = (v) => {
    const key = normKey(v.username);
    const aiV = aiVoiceMap[key] || {};
    return {
      username: v.username, platform: v.platform || aiV.platform || '',
      followers: v.followers || 0,
      url: v.profile_url || '',
      posts: v.posts_count || 0,
      likes: v.likes_count || 0,
      comments: v.comments_count || 0,
      engagement: v.total_engagement || 0,
      tier: v.tier || aiV.tier || 'micro',
      sentiment: v.sentiment,
      keywords: v.keywords?.length ? v.keywords : (aiV.keywords || []),
      text: aiV.text || '',
      impact: aiV.impact || '',
    };
  };

  // Enrich an AI-only entry with table metrics when available (never show 0-data entries)
  const enrichAiVoice = (v, sentiment) => {
    const key = normKey(v.username);
    const tbl = tableVoiceMap[key];
    if (!tbl) return null; // no table data → skip, don't show ghost entry
    return {
      username: tbl.username || v.username,
      platform: tbl.platform || v.platform || '',
      followers: tbl.followers || v.followers || 0,
      url: tbl.profile_url || v.url || '',
      posts: tbl.posts_count || 0,
      likes: tbl.likes_count || v.likes || 0,
      comments: tbl.comments_count || v.comments || 0,
      engagement: tbl.total_engagement || v.engagement || 0,
      tier: tbl.tier || v.tier || 'micro',
      sentiment,
      keywords: tbl.keywords?.length ? tbl.keywords : (v.keywords || []),
      text: v.text || '',
      impact: v.impact || '',
    };
  };

  const byScore = (a, b) => (b.engagement + b.followers * 0.1) - (a.engagement + a.followers * 0.1);

  // Primary: use table classification + AI narrative
  let alliesList = voicesList.filter(v => v.sentiment !== 'negative').map(mergeVoice).sort(byScore);
  let criticsList = voicesList.filter(v => v.sentiment === 'negative').map(mergeVoice).sort(byScore);

  // If AI identified critics not in table as negative, enrich and add them only if table data exists
  if (criticsList.length === 0 && aiVoices.critics?.length) {
    criticsList = aiVoices.critics
      .map(v => enrichAiVoice(v, 'negative'))
      .filter(Boolean)
      .sort(byScore);
  }
  // Same for allies fallback
  if (alliesList.length === 0 && aiVoices.allies?.length) {
    alliesList = aiVoices.allies
      .map(v => enrichAiVoice(v, 'positive'))
      .filter(Boolean)
      .sort(byScore);
  }

  if (aiSentiment) {
    posPct = aiSentiment.pos;
    neuPct = aiSentiment.neu;
    negPct = aiSentiment.neg;
    riskLevel = ai.nivel_riesgo || ai.riesgo || riskLevel;
    alertPosts = (ai.alertas || []).map((text, idx) => ({
      url: '',
      text: typeof text === 'string' ? text : (text.text || text.alerta || ''),
      tipo: 'Alerta IA',
      platform: '',
      time: rep.date_key,
      score: String(text.score || text.peligrosidad || ''),
      razon: typeof text === 'string' ? text : (text.razon || text.porque || ''),
      engagement: 0,
      username: 'IA',
      id: `ai-alert-${idx}`,
    }));
  }

  const hasAi = !!aiSentiment;
  const alertSummary = (ai?.alertas || []).length
    ? (typeof ai.alertas[0] === 'string' ? ai.alertas[0] : (ai.alertas[0].text || ai.alertas[0].alerta || 'Alertas generadas por IA.'))
    : '';
  const totalNetworkPosts = platforms.reduce((sum, p) => sum + (Number(p.posts) || 0), 0) || 1;

  return {
    label: rep.theme_label,
    es: esLabel(rep.theme_key),
    ai_analysis: ai,
    aiDerived: hasAi,
    sentiment: { pos: posPct, neu: neuPct, neg: negPct, posC: posC, neuC: neuC, negC: negC },
    risk: { level: riskLevel, negPct: negPct, attention: negPct > 20 },
    totals: { posts: posts.length },
    platforms,
    alertometro: hasAi
      ? { total: alertPosts.length, analizados: posts.length, nivel: riskLevel, recomendacion: ai.recomendacion_riesgo || alertSummary, posts: alertPosts }
      : { total: 0, analizados: 0, nivel: '', recomendacion: '', posts: [] },
    oportunometro: hasAi
      ? { total: ai.oportunidades?.length || 0, analizados: posts.length, nivel: 'ia', recomendacion: (ai.oportunidades || []).join(' '), posts: oppPosts }
      : { total: 0, analizados: 0, nivel: '', recomendacion: '', posts: [] },
    complaints: { total: 0, categories: [] },
    news: null,
    trending: [],
    influencers: { total: 0, top: [] },
    timeline: { events: [] },
    pros_cons: { positive: [], negative: [], neutral: [] },
    reconocimientos: [],
    keywords: [],
    emojis: [],
    comments_topics: { total: 0, topics: [] },
    voices: {
      segmentos: [],
      alertas: [],
      allies: alliesList.length ? alliesList : aiVoices.allies,
      critics: criticsList.length ? criticsList : aiVoices.critics
    },
    networkStrategy: {
      title: rep.theme_key === 'redes_propias' ? 'Redes y publicaciones' : 'Mapa por red y aliados',
      itemLabel: rep.theme_key === 'redes_propias' ? 'PUBLICACIONES' : 'MENCIONES',
      totalPosts: posts.length,
      networks: platforms.map(p => ({
        key: p.name, label: platLabel(p.name), posts: p.posts, comments: p.comments, views: 0, likes: 0,
        share: Math.round((Number(p.posts) || 0) / totalNetworkPosts * 100),
        sent: p.sent, tone: p.sent.negativo > p.sent.positivo ? 'critica' : 'favorable'
      })),
      allies: aiVoices.allies.length ? aiVoices.allies : alliesList
    },
    scraped_posts: posts
  };
}

// Fetch all uploaded reports from Supabase and apply them to window.PA_DATA / CALENDAR_DATA
export async function loadFromSupabase() {
  try {
    const { data: reports, error } = await supabase
      .from('reports')
      .select(`
        id, date_key, theme_key, theme_label, filename, created_at, ai_analysis,
        scraped_posts(*, scraped_comments(*)),
        allies_critics_voices(*)
      `)
      .order('created_at', { ascending: true });

    if (error || !reports?.length) return;

    window.PA_DATA = {
      meta: {
        cliente: 'Pepe Aguilar',
        period: { start: '2026-06-01', end: '2026-06-15' },
        range_label: '1-15 jun 2026',
        source: 'supabase',
      },
      order: ['redes_propias','facebook','instagram','x','tiktok','google_news'],
      themes: {},
    };
    window.CALENDAR_DATA = {
      dateRange: { start: '2026-06-01', end: '2026-06-15' },
      days: {},
    };

    // Build a set of "theme_key:date_key" strings for calendar VER button gating
    const keys = new Set();
    for (const r of reports) {
      keys.add(`${r.theme_key}:${r.date_key}`);
      const weekend = getWeekendDates(r.date_key);
      if (weekend) {
        for (const wd of weekend) {
          keys.add(`${r.theme_key}:${wd}`);
        }
      }
    }
    window.SUPABASE_KEYS = keys;

    // For PA_DATA.themes: use the record with the latest date_key per theme
    const latestByTheme = {};
    for (const rep of reports) {
      if (!latestByTheme[rep.theme_key] || rep.date_key > latestByTheme[rep.theme_key].date_key) {
        latestByTheme[rep.theme_key] = rep;
      }
    }
    const latestAiReport = reports
      .filter(rep => rep.ai_analysis)
      .sort((a, b) => {
        const aTime = new Date(a.created_at || `${a.date_key}T00:00:00`).getTime();
        const bTime = new Date(b.created_at || `${b.date_key}T00:00:00`).getTime();
        return bTime - aTime;
      })[0];

    for (const rep of reports) {
      const themeData = buildThemeFromScrapedData(rep);

      // PA_DATA.themes: only apply if this is the most recently inserted record for this theme
      if (window.PA_DATA?.themes && latestByTheme[rep.theme_key]?.id === rep.id) {
        window.PA_DATA.themes[rep.theme_key] = themeData;
      }

      // CALENDAR_DATA: apply every record by its actual date_key (full history)
      if (window.CALENDAR_DATA) {
        const targetDates = [rep.date_key];
        const weekend = getWeekendDates(rep.date_key);
        if (weekend) targetDates.push(...weekend);

        for (const dk of targetDates) {
          if (!window.CALENDAR_DATA.days[dk]) window.CALENDAR_DATA.days[dk] = {};
          const s = themeData.sentiment || {};
          window.CALENDAR_DATA.days[dk][rep.theme_key] = {
            pos: s.pos||0, neg: s.neg||0,
            risk: themeData.risk?.level || 'bajo',
            posts: themeData.totals?.posts || 0,
            topEvents: [],
            headlines: [],
          };
        }
      }
    }

    // Build ALL_VOICES_DATA: aggregate across all reports and all dates
    const voiceAgg = {};
    const addVoiceAgg = (v, sentiment, dateKey) => {
      if (!v?.username) return;
      const k = (v.username || '').toLowerCase().trim().replace(/^@/, '');
      if (!k) return;
      if (!voiceAgg[k]) {
        voiceAgg[k] = {
          username: v.username, platform: v.platform || '',
          tier: v.tier || 'micro', posts: 0, likes: 0, comments: 0, engagement: 0,
          keywords: v.keywords || [], text: v.text || '', url: v.url || '',
          datesSeen: new Set(), positiveCount: 0, negativeCount: 0,
        };
      }
      const e = voiceAgg[k];
      e.posts      = Math.max(e.posts, Number(v.posts || 0));
      e.likes     += Number(v.likes || 0);
      e.comments  += Number(v.comments || 0);
      e.engagement+= Number(v.engagement || 0);
      e.datesSeen.add(dateKey);
      if (sentiment === 'negative') e.negativeCount++; else e.positiveCount++;
      if (!e.keywords.length && v.keywords?.length) e.keywords = v.keywords;
      if (!e.text && v.text) e.text = v.text;
      if (!e.url && v.url) e.url = v.url;
      if (v.tier === 'macro') e.tier = 'macro';
      else if (v.tier === 'medio' && e.tier === 'micro') e.tier = 'medio';
    };
    for (const rep of reports) {
      const aiV = voicesFromAi(rep.ai_analysis);
      // Table voices (most accurate, have real metrics)
      (rep.allies_critics_voices || []).forEach(v => {
        addVoiceAgg({
          username: v.username, platform: v.platform, tier: v.tier,
          posts: v.posts_count, likes: v.likes_count, comments: v.comments_count,
          engagement: v.total_engagement, keywords: v.keywords, url: v.profile_url,
        }, v.sentiment === 'negative' ? 'negative' : 'positive', rep.date_key);
      });
      // AI voices not in table
      [...(aiV.allies || []), ...(aiV.critics || [])].forEach(v => {
        const k = (v.username || '').toLowerCase().trim().replace(/^@/, '');
        if (!voiceAgg[k]) {
          addVoiceAgg(v, aiV.critics.some(c => (c.username||'').toLowerCase().replace(/^@/,'') === k) ? 'negative' : 'positive', rep.date_key);
        }
      });
    }
    const allVoicesArr = Object.values(voiceAgg).map(e => ({
      ...e, datesSeen: e.datesSeen.size,
      sentiment: e.negativeCount > e.positiveCount ? 'negative' : 'positive',
    })).sort((a, b) => b.engagement - a.engagement);
    window.ALL_VOICES_DATA = {
      allies:  allVoicesArr.filter(v => v.sentiment !== 'negative'),
      critics: allVoicesArr.filter(v => v.sentiment === 'negative'),
    };

    // ALL_MEDIA_DATA: aggregate medios_destacados across all reports/dates
    const mediaAgg = {};
    for (const rep of reports) {
      const medios = rep.ai_analysis?.analisis_voces?.medios_destacados || [];
      for (const m of medios) {
        const k = (m.nombre || '').toLowerCase().trim();
        if (!k) continue;
        if (!mediaAgg[k]) {
          mediaAgg[k] = { nombre: m.nombre, platform: m.platform || 'google_news',
            alcance: m.alcance || 'medio', notas: 0, temas: [], tono: m.tono || 'neutral',
            titular: m.titular_ejemplo || '', datesSeen: new Set() };
        }
        const e = mediaAgg[k];
        e.notas += Number(m.notas || 1);
        e.datesSeen.add(rep.date_key);
        if (m.alcance === 'macro') e.alcance = 'macro';
        (m.temas || []).forEach(t => { if (!e.temas.includes(t)) e.temas.push(t); });
        if (m.tono && m.tono !== 'neutral') e.tono = m.tono; // keep the strongest signal
        if (!e.titular && m.titular_ejemplo) e.titular = m.titular_ejemplo;
      }
    }
    window.ALL_MEDIA_DATA = Object.values(mediaAgg)
      .map(e => ({ ...e, datesSeen: e.datesSeen.size }))
      .sort((a, b) => b.notas - a.notas);

    if (latestAiReport && window.PA_DATA?.themes && !window.PA_DATA.themes.resumen?.ai_analysis) {
      window.PA_DATA.themes.resumen = {
        ...buildThemeFromScrapedData({
          ...latestAiReport,
          theme_key: 'resumen',
          theme_label: 'Panorama',
        }),
        label: 'Panorama',
        es: 'Ultimo analisis reputacional generado por IA en Supabase.',
        sourceThemeKey: latestAiReport.theme_key,
        sourceThemeLabel: latestAiReport.theme_label,
      };
    }

    // Update PA_DATA.meta with the latest date_key found across all themes
    if (window.PA_DATA?.meta) {
      const latestDateKey = Object.values(latestByTheme).map(r => r.date_key).sort().pop();
      if (latestDateKey) {
        let endKey = latestDateKey;
        const dateObj = new Date(latestDateKey + 'T12:00:00');
        if (dateObj.getDay() === 5) { // Friday
          const sun = new Date(dateObj);
          sun.setDate(dateObj.getDate() + 2);
          endKey = sun.toISOString().slice(0, 10);
        }
        window.PA_DATA.meta.period.end = endKey;
        const d = new Date(endKey + 'T12:00:00');
        const ms = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
        window.PA_DATA.meta.range_label = `${d.getDate()} ${ms[d.getMonth()]} ${d.getFullYear()}`;
      }
      if (latestAiReport) {
        window.PA_DATA.meta.latest_ai_report = {
          id: latestAiReport.id,
          date_key: latestAiReport.date_key,
          theme_key: latestAiReport.theme_key,
          theme_label: latestAiReport.theme_label,
          created_at: latestAiReport.created_at,
        };
      }
    }
  } catch (e) {
    console.warn('Supabase load failed (non-blocking):', e);
  }
}

// Load a single theme's data for a specific date_key and apply it to PA_DATA.themes
export async function loadThemeByDate(themeKey, dateKey) {
  const targetDateKey = getFridayDateKey(dateKey);
  try {
    const { data: reports, error } = await supabase
      .from('reports')
      .select(`
        id, date_key, theme_key, theme_label, ai_analysis,
        scraped_posts(*, scraped_comments(*)),
        allies_critics_voices(*)
      `)
      .eq('theme_key', themeKey)
      .eq('date_key', targetDateKey)
      .limit(1);

    if (error || !reports?.length) return false;
    const rep = reports[0];
    const themeData = buildThemeFromScrapedData(rep);
    if (window.PA_DATA?.themes) window.PA_DATA.themes[themeKey] = themeData;
    return true;
  } catch(e) {
    console.warn('loadThemeByDate failed:', e);
    return false;
  }
}

function esLabel(key) {
  return { musica:'Su obra musical, conciertos y legado artístico', entrevistas:'Apariciones en medios, entrevistas y declaraciones públicas', empresas:'Sus negocios, marca y proyectos empresariales', familia:'La dinastía Aguilar y la vida familiar pública' }[key] || '';
}
