import { supabase } from './supabase';

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

    // For PA_DATA.themes: use the most recently inserted record per theme (created_at wins)
    // This prevents stale records with wrong dates from overwriting fresh uploads
    const latestByTheme = {};
    for (const rep of reports) {
      if (!latestByTheme[rep.theme_key] || rep.created_at > latestByTheme[rep.theme_key].created_at) {
        latestByTheme[rep.theme_key] = rep;
      }
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
      if (window.PA_DATA?.themes && latestByTheme[rep.theme_key]?.id === rep.id) {
        window.PA_DATA.themes[rep.theme_key] = themeData;
      }

      // CALENDAR_DATA: apply every record by its actual date_key (full history)
      if (window.CALENDAR_DATA) {
        if (!window.CALENDAR_DATA.days[rep.date_key]) window.CALENDAR_DATA.days[rep.date_key] = {};
        const s = themeData.sentiment || {};
        window.CALENDAR_DATA.days[rep.date_key][rep.theme_key] = {
          pos: s.pos||0, neg: s.neg||0,
          risk: themeData.risk?.level || 'bajo',
          posts: themeData.totals?.posts || 0,
          topEvents: (themeData.timeline?.events||[]).slice(0,3).map(e=>e.main).filter(Boolean),
          headlines: [],
        };
      }
    }
  } catch (e) {
    console.warn('Supabase load failed (non-blocking):', e);
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
