import { supabase } from './supabase';
import { getWeekendDates, getFridayDateKey, platLabel } from '../utils/helpers';

// Helper function to build themeData dynamically from raw scraped posts and voices
function buildThemeFromScrapedData(rep) {
  const posts = rep.scraped_posts || [];
  const voicesList = rep.allies_critics_voices || [];

  // 1. Sentiment counts
  const posC = posts.filter(p => p.sentiment === 'positive').length;
  const negC = posts.filter(p => p.sentiment === 'negative').length;
  const neuC = posts.filter(p => p.sentiment === 'neutral' || !p.sentiment).length;
  const total = posC + negC + neuC || 1;
  const posPct = Math.round(posC / total * 100);
  const negPct = Math.round(negC / total * 100);
  const neuPct = 100 - posPct - negPct;

  // 2. Risk level approximation
  let riskLevel = 'bajo';
  if (negPct > 40) riskLevel = 'muy_alto';
  else if (negPct > 25) riskLevel = 'alto';
  else if (negPct > 15) riskLevel = 'medio';

  // 3. Platform breakdown
  const platformMap = {};
  posts.forEach(p => {
    const plat = p.platform || 'unknown';
    if (!platformMap[plat]) platformMap[plat] = { posts: 0, comments: 0, pos: 0, neu: 0, neg: 0 };
    const pm = platformMap[plat];
    pm.posts += 1;
    pm.comments += p.comments_count || 0;
    if (p.sentiment === 'positive') pm.pos += 1;
    else if (p.sentiment === 'negative') pm.neg += 1;
    else pm.neu += 1;
  });
  const platforms = Object.entries(platformMap).map(([name, pm]) => {
    const tot = pm.pos + pm.neu + pm.neg || 1;
    return {
      name, posts: pm.posts, comments: pm.comments, users: pm.posts,
      sent: { positivo: Math.round(pm.pos/tot*100), neutral: Math.round(pm.neu/tot*100), negativo: Math.round(pm.neg/tot*100) }
    };
  });

  // 4. Alerts and Opportunities
  const alertPosts = posts.filter(p => p.sentiment === 'negative')
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

  // 5. Voices (Allies/Critics)
  const alliesList = voicesList.filter(v => v.sentiment !== 'negative')
    .map(v => ({
      username: v.username, platform: v.platform, followers: v.followers, url: v.profile_url,
      posts: v.posts_count, likes: v.likes_count, comments: v.comments_count, engagement: v.total_engagement,
      tier: v.tier, sentiment: v.sentiment, keywords: v.keywords || []
    }));

  const criticsList = voicesList.filter(v => v.sentiment === 'negative')
    .map(v => ({
      username: v.username, platform: v.platform, followers: v.followers, url: v.profile_url,
      posts: v.posts_count, likes: v.likes_count, comments: v.comments_count, engagement: v.total_engagement,
      tier: v.tier, sentiment: v.sentiment, keywords: v.keywords || []
    }));

  return {
    label: rep.theme_label,
    es: esLabel(rep.theme_key),
    sentiment: { pos: posPct, neu: neuPct, neg: negPct, posC: posC, neuC: neuC, negC: negC },
    risk: { level: riskLevel, negPct: negPct, attention: negPct > 20 },
    totals: { posts: posts.length },
    platforms,
    alertometro: { total: alertPosts.length, analizados: alertPosts.length, nivel: riskLevel, recomendacion: '', posts: alertPosts },
    oportunometro: { total: oppPosts.length, analizados: oppPosts.length, nivel: 'bajo', recomendacion: '', posts: oppPosts },
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
      allies: alliesList,
      critics: criticsList
    },
    networkStrategy: {
      totalPosts: posts.length,
      networks: platforms.map(p => ({
        key: p.name, label: platLabel(p.name), posts: p.posts, comments: p.comments, views: 0, likes: 0,
        sent: p.sent, tone: p.sent.negativo > p.sent.positivo ? 'critica' : 'favorable'
      })),
      allies: alliesList
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
        id, date_key, theme_key, theme_label, filename, created_at,
        scraped_posts(*),
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
        id, date_key, theme_key, theme_label,
        scraped_posts(*),
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
