import { supabase } from './supabase';
import { getWeekendDates, getFridayDateKey } from '../utils/helpers';


// Fetch all uploaded reports from Supabase and apply them to window.PA_DATA / CALENDAR_DATA
export async function loadFromSupabase() {
  try {
    const { data: reports, error } = await supabase
      .from('reports')
      .select(`
        id, date_key, theme_key, theme_label, filename, created_at,
        sentiment(*),
        platforms(*),
        alert_posts(*),
        opportunity_posts(*),
        complaints(*),
        news_items(*),
        trending_topics(*),
        influencers(*),
        timeline_events(*),
        pros_cons(*),
        reconocimientos(*),
        keywords(*),
        emojis(*),
        comments_topics(*),
        voice_segments(*),
        narrative_gap(*)
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
    // date_key is the report's content date, not upload time — ensures June 15 data wins over historical imports
    const latestByTheme = {};
    for (const rep of reports) {
      if (!latestByTheme[rep.theme_key] || rep.date_key > latestByTheme[rep.theme_key].date_key) {
        latestByTheme[rep.theme_key] = rep;
      }
    }

    // Compute aggregated (weighted average) sentiment across ALL records per theme for "todas" view
    const RISK_ORDER = ['muy_bajo','bajo','medio','alto','muy_alto'];
    const aggSent = {};
    for (const rep of reports) {
      const s = rep.sentiment?.[0] || {};
      const posts = rep.platforms?.reduce((a,p)=>a+(p.posts||0),0) || 0;
      if (!aggSent[rep.theme_key]) aggSent[rep.theme_key] = { posW:0, neuW:0, negW:0, total:0, maxRisk:'muy_bajo' };
      const a = aggSent[rep.theme_key];
      if (posts > 0) {
        a.posW += (s.pos||0) * posts;
        a.neuW += (s.neu||0) * posts;
        a.negW += (s.neg||0) * posts;
        a.total += posts;
      }
      const rIdx = RISK_ORDER.indexOf(s.risk_level||'muy_bajo');
      if (rIdx > RISK_ORDER.indexOf(a.maxRisk)) a.maxRisk = s.risk_level;
    }

    for (const rep of reports) {
      const s = rep.sentiment?.[0] || {};
      const themeData = {
        label: rep.theme_label,
        es: esLabel(rep.theme_key),
        sentiment: { pos: s.pos||0, neu: s.neu||0, neg: s.neg||0, posC: s.pos_count||0, neuC: s.neu_count||0, negC: s.neg_count||0 },
        risk: { level: s.risk_level || 'bajo', negPct: s.neg||0, attention: (s.neg||0) > 20 },
        totals: { posts: rep.platforms?.reduce((a,p)=>a+(p.posts||0),0) || 0 },
        platforms: (rep.platforms||[]).map(p => ({
          name: p.platform, posts: p.posts, comments: p.comments, users: p.users,
          sentiment: { positivo: p.sent_pos, neutral: p.sent_neu, negativo: p.sent_neg }
        })),
        alertometro: {
          total: rep.alert_posts?.length || 0, analizados: rep.alert_posts?.length || 0,
          nivel: 'bajo', recomendacion: '',
          posts: (rep.alert_posts||[]).map(p => ({ url:p.url, text:p.text, tipo:p.tipo, platform:p.platform, time:p.time, score:p.score, razon:p.razon, engagement:p.engagement, username:p.username }))
        },
        oportunometro: {
          total: rep.opportunity_posts?.length || 0, analizados: rep.opportunity_posts?.length || 0,
          nivel: 'bajo', recomendacion: '',
          posts: (rep.opportunity_posts||[]).map(p => ({ url:p.url, text:p.text, impacto:p.impacto, platform:p.platform, time:p.time, score:p.score, razon:p.razon, engagement:p.engagement, username:p.username }))
        },
        complaints: {
          total: rep.complaints?.length || 0,
          categories: (rep.complaints||[]).map(c => ({ titulo:c.titulo, porcentaje:c.porcentaje, items:c.items||[] }))
        },
        news: buildNews(rep.news_items||[]),
        trending: (rep.trending_topics||[]).map(t => ({
          titulo:t.titulo, desc:t.description,
          metricas:{ views:t.views, likes:t.likes },
          sent:{ positivo_porcentaje:t.pos_pct, negativo_porcentaje:t.neg_pct }
        })),
        influencers: {
          total: rep.influencers?.length || 0,
          top: (rep.influencers||[]).map(i => ({ rank:i.rank, username:i.username, platform:i.platform, followers:i.followers, sentiment:i.sentiment, categoria:i.categoria, url:i.url }))
        },
        timeline: {
          events: (rep.timeline_events||[]).map(e => ({ date:e.event_date, main:e.main, sentiment:e.sentiment, engagement:e.engagement, posts:e.posts }))
        },
        pros_cons: {
          positive: (rep.pros_cons||[]).filter(x=>x.type==='pro').map(x=>x.item),
          negative: (rep.pros_cons||[]).filter(x=>x.type==='con').map(x=>x.item),
          neutral: (rep.pros_cons||[]).filter(x=>x.type==='neutral').map(x=>x.item),
        },
        reconocimientos: (rep.reconocimientos||[]).map(r => ({ titulo:r.titulo, desc:r.description })),
        keywords: (rep.keywords||[]).map(k => ({ w:k.word, n:k.count })),
        emojis: (rep.emojis||[]).map(e => ({ emoji:e.emoji, count:e.count })),
        comments_topics: {
          total: rep.comments_topics?.length || 0,
          topics: (rep.comments_topics||[]).map(t => ({ titulo:t.titulo, porcentaje:t.porcentaje, items:t.items||[] }))
        },
        voices: {
          segmentos: (rep.voice_segments||[]).map(v => ({ label:v.label, narrativa:v.narrativa, sentimiento:v.sentimiento })),
          alertas: []
        },
        narrative_gap: rep.narrative_gap?.[0] || {},
      };

      // PA_DATA.themes: only apply if this is the most recently inserted record for this theme
      // Override sentiment with weighted average across all dates so "todas" is not just the latest day
      if (window.PA_DATA?.themes && latestByTheme[rep.theme_key]?.id === rep.id) {
        const a = aggSent[rep.theme_key];
        if (a && a.total > 0) {
          const pos = Math.round(a.posW / a.total * 10) / 10;
          const neg = Math.round(a.negW / a.total * 10) / 10;
          const neu = Math.round((100 - pos - neg) * 10) / 10;
          themeData.sentiment = { ...themeData.sentiment, pos, neu, neg };
          themeData.risk = { ...themeData.risk, level: a.maxRisk, negPct: neg, attention: neg > 20 };
        }
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
            topEvents: (themeData.timeline?.events||[]).slice(0,3).map(e=>e.main).filter(Boolean),
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
// Used when navigating from the calendar to a specific historical day
export async function loadThemeByDate(themeKey, dateKey) {
  const targetDateKey = getFridayDateKey(dateKey);
  try {
    const { data: reports, error } = await supabase
      .from('reports')
      .select(`
        id, date_key, theme_key, theme_label,
        sentiment(*), platforms(*), alert_posts(*), opportunity_posts(*),
        complaints(*), news_items(*), trending_topics(*), influencers(*),
        timeline_events(*), pros_cons(*), reconocimientos(*), keywords(*),
        emojis(*), comments_topics(*), voice_segments(*), narrative_gap(*)
      `)
      .eq('theme_key', themeKey)
      .eq('date_key', targetDateKey)
      .limit(1);


    if (error || !reports?.length) return false;
    const rep = reports[0];
    const s = rep.sentiment?.[0] || {};
    const themeData = {
      label: rep.theme_label,
      es: esLabel(rep.theme_key),
      sentiment: { pos: s.pos||0, neu: s.neu||0, neg: s.neg||0, posC: s.pos_count||0, neuC: s.neu_count||0, negC: s.neg_count||0 },
      risk: { level: s.risk_level || 'bajo', negPct: s.neg||0, attention: (s.neg||0) > 20 },
      totals: { posts: rep.platforms?.reduce((a,p)=>a+(p.posts||0),0) || 0 },
      platforms: (rep.platforms||[]).map(p => ({ name: p.platform, posts: p.posts, comments: p.comments, users: p.users, sentiment: { positivo: p.sent_pos, neutral: p.sent_neu, negativo: p.sent_neg } })),
      alertometro: { total: rep.alert_posts?.length||0, analizados: rep.alert_posts?.length||0, nivel: s.nivel_alerta||'bajo', recomendacion: s.rec_alerta||'', posts: (rep.alert_posts||[]).map(p=>({ url:p.url,text:p.text,tipo:p.tipo,platform:p.platform,time:p.time,score:p.score,razon:p.razon,engagement:p.engagement,username:p.username })) },
      oportunometro: { total: rep.opportunity_posts?.length||0, analizados: rep.opportunity_posts?.length||0, nivel: s.nivel_oport||'bajo', recomendacion: s.rec_oport||'', posts: (rep.opportunity_posts||[]).map(p=>({ url:p.url,text:p.text,impacto:p.impacto,platform:p.platform,time:p.time,score:p.score,razon:p.razon,engagement:p.engagement,username:p.username })) },
      complaints: { total: rep.complaints?.length||0, categories: (rep.complaints||[]).map(c=>({ titulo:c.titulo,porcentaje:c.porcentaje,items:c.items||[] })) },
      news: buildNews(rep.news_items||[]),
      trending: (rep.trending_topics||[]).map(t=>({ titulo:t.titulo,desc:t.description,metricas:{ views:t.views,likes:t.likes },sent:{ positivo_porcentaje:t.pos_pct,negativo_porcentaje:t.neg_pct } })),
      influencers: { total: rep.influencers?.length||0, top: (rep.influencers||[]).map(i=>({ rank:i.rank,username:i.username,platform:i.platform,followers:i.followers,sentiment:i.sentiment,categoria:i.categoria,url:i.url })) },
      timeline: { events: (rep.timeline_events||[]).map(e=>({ date:e.event_date,main:e.main,sentiment:e.sentiment,engagement:e.engagement,posts:e.posts })) },
      pros_cons: { positive: (rep.pros_cons||[]).filter(x=>x.type==='pro').map(x=>x.item), negative: (rep.pros_cons||[]).filter(x=>x.type==='con').map(x=>x.item), neutral: (rep.pros_cons||[]).filter(x=>x.type==='neutral').map(x=>x.item) },
      reconocimientos: (rep.reconocimientos||[]).map(r=>({ titulo:r.titulo,desc:r.description })),
      keywords: (rep.keywords||[]).map(k=>({ w:k.word,n:k.count })),
      emojis: (rep.emojis||[]).map(e=>({ emoji:e.emoji,count:e.count })),
      comments_topics: { total: rep.comments_topics?.length||0, topics: (rep.comments_topics||[]).map(t=>({ titulo:t.titulo,porcentaje:t.porcentaje,items:t.items||[] })) },
      voices: { segmentos: (rep.voice_segments||[]).map(v=>({ label:v.label,narrativa:v.narrativa,sentimiento:v.sentimiento })), alertas:[] },
      narrative_gap: rep.narrative_gap?.[0] || {},
    };
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

function buildNews(items) {
  if (!items.length) return null;
  const grupos = { positivo:[], neutral:[], negativo:[] };
  const byGroup = {};
  items.forEach(n => {
    const key = (n.rating||'neutral') + '||' + (n.group_titulo||'');
    if (!byGroup[key]) { byGroup[key] = { titulo:n.group_titulo, noticias:[], rating:n.rating||'neutral' }; }
    byGroup[key].noticias.push({ titulo:n.titulo, fuente:n.fuente, fecha:n.fecha, link:n.link });
  });
  Object.values(byGroup).forEach(g => { (grupos[g.rating] = grupos[g.rating]||[]).push(g); });
  return { grupos };
}
