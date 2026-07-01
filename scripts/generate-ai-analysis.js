import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    apiKey: args.find(a => !a.startsWith('--')) || process.env.OPENROUTER_API_KEY,
    themeKey: args.find(a => a.startsWith('--theme='))?.split('=')[1] || '',
    reportId: args.find(a => a.startsWith('--report='))?.split('=')[1] || '',
    model: args.find(a => a.startsWith('--model='))?.split('=')[1] || '',
  };
}

function truncate(text, max = 420) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function buildDataPrompt({ report, posts, comments, voices }) {
  let out = `DATOS EXTRAIDOS PARA ANALISIS POST-APIFY\n`;
  out += `Reporte: ${report.theme_key} / ${report.theme_label || ''} / ${report.date_key}\n\n`;

  out += `--- PUBLICACIONES ---\n`;
  posts.forEach((p, index) => {
    out += `${index + 1}. Red: ${p.platform || 'sin red'} | Autor: @${p.username || 'sin autor'} | URL: ${p.url || 'sin url'} | Fecha: ${p.published_date || 'sin fecha'} | Likes: ${p.likes || 0} | Comentarios declarados: ${p.comments_count || 0} | Views: ${p.views || 0} | Texto: "${truncate(p.text)}"\n`;
  });

  out += `\n--- COMENTARIOS EXTRAIDOS ---\n`;
  comments.slice(0, 180).forEach((c, index) => {
    out += `${index + 1}. Autor: @${c.author || 'sin autor'} | Fecha: ${c.published_time || 'sin fecha'} | Likes: ${c.likes || 0} | URL: ${c.url || 'sin url'} | Texto: "${truncate(c.text, 320)}"\n`;
  });

  out += `\n--- VOCES YA DETECTADAS EN SUPABASE ---\n`;
  voices.forEach((v, index) => {
    out += `${index + 1}. @${v.username} | Red: ${v.platform || 'sin red'} | Sentimiento previo: ${v.sentiment || 'sin clasificar'} | Followers: ${v.followers || 0} | Engagement: ${v.total_engagement || 0} | Keywords: ${Array.isArray(v.keywords) ? v.keywords.join(', ') : ''}\n`;
  });

  return out;
}

function buildPrompt(dataPrompt) {
  return `Actua como analista senior de reputacion y crisis para Pepe Aguilar.

Tu trabajo empieza DESPUES de Apify. Apify solo entrega posts, comentarios y metricas raw. Tu debes clasificar:
- sentimiento global
- sentimiento por red
- alertometro y riesgo
- aliados potenciales
- contrarios / criticos relevantes
- recomendaciones de accion

Reglas duras:
- No inventes publicaciones, urls, autores, followers ni metricas.
- Los porcentajes globales deben sumar 100.
- Los porcentajes por red deben sumar 100.
- Si una red no tiene muestra suficiente, usa 0 favorable, 100 neutral, 0 critico y explica "sin muestra suficiente".
- Aliados y contrarios deben salir de autores presentes en posts, comentarios o voces provistas.
- Clasifica como aliado a quien defiende, apoya, celebra, amplifica positivamente o abre oportunidad reputacional.
- Clasifica como contrario a quien critica, ridiculiza, acusa, amplifica riesgo o instala narrativa negativa.
- Se factual y directo. Nada poetico.

Devuelve EXCLUSIVAMENTE JSON valido con esta forma:
{
  "resumen_ejecutivo": [
    "Punto factual 1...",
    "Punto factual 2...",
    "Punto factual 3...",
    "Punto factual 4..."
  ],
  "sentimiento": {
    "favorable": 15,
    "neutral": 68,
    "critico": 17
  },
  "nivel_riesgo": "bajo | medio | alto | muy_alto",
  "desglose_por_red": {
    "x": { "sentimiento": { "favorable": 0, "neutral": 100, "critico": 0 }, "lectura": "..." },
    "instagram": { "sentimiento": { "favorable": 0, "neutral": 100, "critico": 0 }, "lectura": "..." },
    "facebook": { "sentimiento": { "favorable": 0, "neutral": 100, "critico": 0 }, "lectura": "..." },
    "tiktok": { "sentimiento": { "favorable": 0, "neutral": 100, "critico": 0 }, "lectura": "..." },
    "youtube": { "sentimiento": { "favorable": 0, "neutral": 100, "critico": 0 }, "lectura": "..." },
    "google_news": { "sentimiento": { "favorable": 0, "neutral": 100, "critico": 0 }, "lectura": "..." }
  },
  "alertas": [
    "Alerta concreta + por que ocurre..."
  ],
  "plan_accion": [
    "Accion inmediata..."
  ],
  "oportunidades": [
    "Oportunidad concreta..."
  ],
  "analisis_voces": {
    "aliados_destacados": [
      { "username": "usuario_real", "platform": "red", "comentario_o_post": "texto base", "impacto": "Alto|Medio|Bajo", "tier": "micro|medio|macro", "keywords": ["tema"], "followers": 0, "likes": 0, "engagement": 0 }
    ],
    "criticos_destacados": [
      { "username": "usuario_real", "platform": "red", "comentario_o_post": "texto base", "impacto": "Alto|Medio|Bajo", "tier": "micro|medio|macro", "keywords": ["tema"], "followers": 0, "likes": 0, "engagement": 0 }
    ]
  }
}

Datos:
${dataPrompt}`;
}

async function pickReport({ themeKey, reportId }) {
  let query = supabase
    .from('reports')
    .select('id, date_key, theme_key, theme_label, created_at')
    .order('date_key', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);

  if (reportId) query = query.eq('id', reportId);
  if (themeKey) query = query.eq('theme_key', themeKey);

  const { data, error } = await query;
  if (error || !data?.length) {
    throw new Error(error?.message || 'No se encontro reporte para analizar');
  }
  return data[0];
}

async function fetchReportData(report) {
  const { data: posts, error: postsError } = await supabase
    .from('scraped_posts')
    .select('*')
    .eq('report_id', report.id);
  if (postsError) throw new Error(postsError.message);

  const postIds = (posts || []).map(p => p.id);
  let comments = [];
  if (postIds.length) {
    const { data, error } = await supabase
      .from('scraped_comments')
      .select('*')
      .in('post_id', postIds);
    if (error) throw new Error(error.message);
    comments = data || [];
  }

  const { data: voices, error: voicesError } = await supabase
    .from('allies_critics_voices')
    .select('*')
    .eq('report_id', report.id);
  if (voicesError) throw new Error(voicesError.message);

  return { posts: posts || [], comments, voices: voices || [] };
}

function modelsForReport({ report, overrideModel }) {
  if (overrideModel) return [overrideModel];
  if (report.theme_key === 'resumen') {
    return [
      'anthropic/claude-opus-4.6',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-3.1-flash-lite',
    ];
  }
  return [
    'google/gemini-3.1-flash-lite',
    'google/gemini-2.5-flash',
    'anthropic/claude-3.5-sonnet',
  ];
}

async function callOpenRouter({ apiKey, prompt, models }) {

  for (const model of models) {
    console.log(`Solicitando analisis a ${model}...`);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/BrandonBlackwell-ui/DashboardPP',
        'X-Title': 'Blackwell Dashboard',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Eres un analista experto en reputacion, opinion publica y crisis. Responde solo JSON valido.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    const json = await response.json();
    if (json.error) {
      console.warn(`${model} fallo: ${json.error.message || JSON.stringify(json.error)}`);
      continue;
    }

    const text = json.choices?.[0]?.message?.content;
    if (!text) continue;
    const clean = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    return { model, analysis: JSON.parse(clean) };
  }

  throw new Error('Todos los modelos fallaron');
}

// Enrich AI-identified allies/critics with real metrics from Apify scraped posts
// The AI names who they are; we fill in the numbers directly from the source data.
function enrichVoicesWithRealMetrics(analysis, posts, voices) {
  // Build lookup: username (lowercase) -> real metrics from scraped posts
  const postMetrics = {};
  for (const p of posts) {
    const key = (p.username || '').toLowerCase().trim().replace(/^@/, '');
    if (!key) continue;
    if (!postMetrics[key]) {
      postMetrics[key] = { followers: 0, likes: 0, comments: 0, views: 0, engagement: 0 };
    }
    const m = postMetrics[key];
    m.likes += Number(p.likes || 0);
    m.comments += Number(p.comments_count || 0);
    m.views += Number(p.views || 0);
    m.followers = Math.max(m.followers, Number(p.followers || p.author_followers || 0));
    m.engagement = m.likes + m.comments * 2 + m.views * 0.01;
  }
  // Also pull from pre-existing voices table (has follower data for TikTok etc.)
  for (const v of voices) {
    const key = (v.username || '').toLowerCase().trim().replace(/^@/, '');
    if (!key) continue;
    if (!postMetrics[key]) postMetrics[key] = { followers: 0, likes: 0, comments: 0, views: 0, engagement: 0 };
    const m = postMetrics[key];
    m.followers = Math.max(m.followers, Number(v.followers || 0));
    if (!m.likes) m.likes = Number(v.likes_count || 0);
    if (!m.engagement) m.engagement = Number(v.total_engagement || 0);
  }

  const enrich = (entry) => {
    const key = (entry.username || '').toLowerCase().trim().replace(/^@/, '');
    const m = postMetrics[key] || {};
    return {
      ...entry,
      followers: m.followers || entry.followers || 0,
      likes: m.likes || entry.likes || 0,
      comments: m.comments || entry.comments || 0,
      views: m.views || entry.views || 0,
      engagement: m.engagement || entry.engagement || 0,
    };
  };

  if (analysis.analisis_voces?.aliados_destacados) {
    analysis.analisis_voces.aliados_destacados = analysis.analisis_voces.aliados_destacados.map(enrich);
  }
  if (analysis.analisis_voces?.criticos_destacados) {
    analysis.analisis_voces.criticos_destacados = analysis.analisis_voces.criticos_destacados.map(enrich);
  }
  return analysis;
}

async function run() {
  const args = parseArgs();
  if (!args.apiKey) {
    throw new Error('Falta OPENROUTER_API_KEY o pasar la llave como primer argumento');
  }

  const report = await pickReport(args);
  const { posts, comments, voices } = await fetchReportData(report);
  console.log(`Reporte: ${report.theme_key} ${report.date_key}. Datos: ${posts.length} posts, ${comments.length} comentarios, ${voices.length} voces.`);

  const prompt = buildPrompt(buildDataPrompt({ report, posts, comments, voices }));
  const models = modelsForReport({ report, overrideModel: args.model });
  console.log(`Ruta de modelo: ${report.theme_key === 'resumen' ? 'resumen global' : 'red individual'} -> ${models[0]}`);
  const { model, analysis: rawAnalysis } = await callOpenRouter({ apiKey: args.apiKey, prompt, models });

  // Enrich AI voice entries with real Apify metrics (the AI names them, we fill the numbers)
  const analysis = enrichVoicesWithRealMetrics(rawAnalysis, posts, voices);

  const enrichedAllies = analysis.analisis_voces?.aliados_destacados || [];
  const enrichedCritics = analysis.analisis_voces?.criticos_destacados || [];
  console.log(`Metricas reales inyectadas en ${enrichedAllies.length} aliados y ${enrichedCritics.length} criticos.`);
  enrichedAllies.concat(enrichedCritics).forEach(v => {
    console.log(`  ${v.username}: followers=${v.followers} likes=${v.likes} engagement=${Math.round(v.engagement)}`);
  });

  const { error } = await supabase
    .from('reports')
    .update({ ai_analysis: analysis })
    .eq('id', report.id);
  if (error) throw new Error(error.message);

  console.log(`Analisis guardado en Supabase con ${model}.`);
  console.log(JSON.stringify({
    report_id: report.id,
    theme_key: report.theme_key,
    date_key: report.date_key,
    sentimiento: analysis.sentimiento,
    nivel_riesgo: analysis.nivel_riesgo,
    aliados: enrichedAllies.length,
    criticos: enrichedCritics.length,
  }, null, 2));
}

run().catch(error => {
  console.error(error.message);
  process.exit(1);
});
