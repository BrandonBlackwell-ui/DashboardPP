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

function buildDataPrompt({ report, posts, comments, voices, previousAnalysis }) {
  let out = `DATOS EXTRAIDOS PARA ANALISIS POST-APIFY\n`;
  out += `Reporte: ${report.theme_key} / ${report.theme_label || ''} / ${report.date_key}\n\n`;

  if (previousAnalysis) {
    out += `--- ANALISIS DEL PERIODO ANTERIOR (${previousAnalysis.date_key}) PARA COMPARAR TENDENCIA ---\n`;
    const ps = previousAnalysis.ai_analysis?.sentimiento || {};
    out += `Sentimiento anterior: favorable ${ps.favorable ?? '?'}% / neutral ${ps.neutral ?? '?'}% / critico ${ps.critico ?? '?'}%\n`;
    out += `Riesgo anterior: ${previousAnalysis.ai_analysis?.nivel_riesgo || 'desconocido'}\n`;
    const prevRedes = previousAnalysis.ai_analysis?.desglose_por_red || {};
    Object.entries(prevRedes).forEach(([red, v]) => {
      if (red === 'INSTRUCCION' || !v?.sentimiento) return;
      out += `  ${red}: fav ${v.sentimiento.favorable ?? 0}% / crit ${v.sentimiento.critico ?? 0}%\n`;
    });
    const prevAlertas = previousAnalysis.ai_analysis?.alertas || [];
    if (prevAlertas.length) {
      out += `Alertas del periodo anterior (verifica si siguen activas, escalaron o se resolvieron):\n`;
      prevAlertas.slice(0, 5).forEach(a => { out += `  - ${typeof a === 'string' ? a : (a.text || a.alerta || '')}\n`; });
    }
    out += `\n`;
  }

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
- NUNCA uses 0/100/0 como fallback. Si una red no tiene muestra suficiente para clasificar con certeza, OMITELA del desglose_por_red por completo. Solo incluye redes con evidencia real en los datos.
- Todo porcentaje de sentimiento debe estar respaldado por posts o comentarios concretos de los datos provistos.
- Aliados y contrarios deben salir de autores presentes en posts, comentarios o voces provistas.
- Clasifica como aliado a quien defiende, apoya, celebra, amplifica positivamente o abre oportunidad reputacional.
- Clasifica como contrario a quien critica, ridiculiza, acusa, amplifica riesgo o instala narrativa negativa.
- medios_destacados es EXCLUSIVAMENTE para fuentes de prensa de google_news. Cuentas de medios en redes sociales van en aliados/criticos segun tono. Formato: {"nombre","platform":"google_news","alcance":"macro|medio","notas":N,"tono":"favorable|neutral|critico","temas":[],"titular_ejemplo":""}.
- Si se te dio el analisis del periodo anterior, calcula tendencia por red (mejorando/estable/empeorando) y llena comparativa_historica con deltas reales. Si no hay periodo anterior, omite comparativa_historica y usa "estable" como tendencia.
- La lectura de cada red debe citar evidencia concreta (autores, temas, numeros de los datos), no generalidades.
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
    "INSTRUCCION": "Solo incluye redes con evidencia real en los datos. Si una red no tiene posts/comentarios suficientes para clasificar, OMITELA. No pongas 0/100/0 como placeholder.",
    "x": {
      "sentimiento": { "favorable": 12, "neutral": 71, "critico": 17 },
      "lectura": "2-3 frases: que esta pasando en esta red, quien mueve la conversacion y por que importa. Cita ejemplos concretos de los datos.",
      "focos": ["Tema o narrativa concreta detectada en esta red", "Otro foco relevante"],
      "recomendacion": "Una accion especifica para ESTA red (no generica).",
      "tendencia": "mejorando | estable | empeorando"
    },
    "instagram": { "sentimiento": { "favorable": 45, "neutral": 40, "critico": 15 }, "lectura": "...", "focos": ["..."], "recomendacion": "...", "tendencia": "estable" }
  },
  "comparativa_historica": {
    "resumen": "Si se te dio analisis del periodo anterior: 2-3 frases sobre como evoluciono la conversacion (mejoro/empeoro y por que). Si no hay periodo anterior, omite este campo.",
    "delta_favorable": 5,
    "delta_critico": -3,
    "alertas_resueltas": ["Alerta anterior que ya no aparece en los datos actuales"],
    "alertas_persistentes": ["Alerta que sigue activa"]
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
      'z-ai/glm-5.2',
      'anthropic/claude-sonnet-5',
      'google/gemini-2.5-flash',
    ];
  }
  return [
    'z-ai/glm-5.2',
    'google/gemini-2.5-flash-lite',
    'google/gemini-2.5-flash',
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
    // Strip markdown fences, then extract only the outermost JSON object
    const stripped = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end === -1) { console.warn(`${model}: no JSON object found`); continue; }
    const clean = stripped.slice(start, end + 1);
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

async function upsertResumenReport(dateKey) {
  const { data: existing } = await supabase
    .from('reports')
    .select('id')
    .eq('date_key', dateKey)
    .eq('theme_key', 'resumen')
    .limit(1);
  if (existing?.length) return existing[0];

  const { data, error } = await supabase
    .from('reports')
    .insert({ date_key: dateKey, theme_key: 'resumen', theme_label: 'Panorama Consolidado' })
    .select('id, date_key, theme_key, theme_label, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function fetchAllPostsForDate(dateKey) {
  const { data: reports } = await supabase
    .from('reports')
    .select('id, theme_key')
    .eq('date_key', dateKey)
    .neq('theme_key', 'resumen');

  if (!reports?.length) return { posts: [], comments: [], voices: [] };

  const reportIds = reports.map(r => r.id);
  const { data: posts } = await supabase
    .from('scraped_posts')
    .select('*')
    .in('report_id', reportIds);

  const postIds = (posts || []).map(p => p.id);
  let comments = [];
  if (postIds.length) {
    const { data } = await supabase.from('scraped_comments').select('*').in('post_id', postIds);
    comments = data || [];
  }

  const { data: voices } = await supabase
    .from('allies_critics_voices')
    .select('*')
    .in('report_id', reportIds);

  return { posts: posts || [], comments, voices: voices || [] };
}

async function run() {
  const args = parseArgs();
  if (!args.apiKey) {
    throw new Error('Falta OPENROUTER_API_KEY o pasar la llave como primer argumento');
  }

  let report, posts, comments, voices;

  if (args.themeKey === 'resumen') {
    // Consolidated cross-network analysis using Opus
    const dateKey = new Date().toISOString().slice(0, 10);
    report = await upsertResumenReport(dateKey);
    const allData = await fetchAllPostsForDate(dateKey);
    posts = allData.posts;
    comments = allData.comments;
    voices = allData.voices;
  } else {
    report = await pickReport(args);
    const data = await fetchReportData(report);
    posts = data.posts;
    comments = data.comments;
    voices = data.voices;
  }
  console.log(`Reporte: ${report.theme_key} ${report.date_key}. Datos: ${posts.length} posts, ${comments.length} comentarios, ${voices.length} voces.`);

  // Fetch the previous analyzed report of the same theme so the AI can compare trends
  let previousAnalysis = null;
  {
    const { data: prev } = await supabase
      .from('reports')
      .select('date_key, ai_analysis')
      .eq('theme_key', report.theme_key)
      .lt('date_key', report.date_key)
      .not('ai_analysis', 'is', null)
      .order('date_key', { ascending: false })
      .limit(1);
    if (prev?.length) {
      previousAnalysis = prev[0];
      console.log(`Comparando contra analisis anterior del ${previousAnalysis.date_key}.`);
    }
  }

  const prompt = buildPrompt(buildDataPrompt({ report, posts, comments, voices, previousAnalysis }));
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
