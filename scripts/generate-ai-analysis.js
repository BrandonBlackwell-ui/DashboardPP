import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const apiKey = process.argv[2] || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error('ERROR: Por favor, proporciona tu API Key de OpenRouter.');
    console.error('Ejemplo: npx tsx scripts/generate-ai-analysis.js <TU_OPENROUTER_KEY>');
    process.exit(1);
  }

  console.log('Conectando a Supabase para extraer posts, comentarios y voces del último reporte...');

  // 1. Obtener el último reporte del tema "resumen"
  const { data: latestRep, error: repErr } = await supabase
    .from('reports')
    .select('id, date_key')
    .eq('theme_key', 'resumen')
    .order('date_key', { ascending: false })
    .limit(1)
    .single();

  if (repErr || !latestRep) {
    console.error('Error al obtener el último reporte:', repErr?.message || 'No se encontraron reportes');
    process.exit(1);
  }

  const reportId = latestRep.id;
  const dateKey = latestRep.date_key;
  console.log(`Procesando reporte del tema "resumen" para la fecha: ${dateKey} (ID: ${reportId})`);

  // 2. Extraer todos los posts de ese reporte
  const { data: posts, error: postErr } = await supabase
    .from('scraped_posts')
    .select('*')
    .eq('report_id', reportId);

  if (postErr) {
    console.error('Error al obtener los posts:', postErr.message);
    process.exit(1);
  }

  // 3. Extraer comentarios asociados a los posts de ese reporte
  const postIds = posts.map(p => p.id);
  let comments = [];
  if (postIds.length > 0) {
    const { data: comms, error: commErr } = await supabase
      .from('scraped_comments')
      .select('*')
      .in('post_id', postIds);
    if (commErr) {
      console.warn('Error al obtener comentarios:', commErr.message);
    } else {
      comments = comms || [];
    }
  }

  // 4. Extraer voces de la audiencia (aliados y contrarios) para esta fecha
  const { data: voices, error: voiceErr } = await supabase
    .from('allies_critics_voices')
    .select('*')
    .eq('report_id', reportId);

  if (voiceErr) {
    console.warn('Error al obtener voces:', voiceErr.message);
  }

  console.log(`Datos cargados: ${posts.length} posts, ${comments.length} comentarios, ${voices?.length || 0} perfiles de audiencia.`);

  // 5. Armar el Prompt con los datos crudos para Claude
  let dataPrompt = `DATOS EXTRAÍDOS PARA ANÁLISIS DE CRISIS (FECHA: ${dateKey}):\n\n`;
  dataPrompt += `--- PUBLICACIONES DETECTADAS ---\n`;
  posts.forEach((p, i) => {
    dataPrompt += `${i+1}. [Post] Red: ${p.platform}, Autor: @${p.username}, Likes: ${p.likes || 0}, Comentarios: ${p.comments_count || 0}, Sentimiento Preliminar: ${p.sentiment || 'neutral'}, Texto: "${p.text}"\n`;
  });

  dataPrompt += `\n--- COMENTARIOS RECIENTES DE LA AUDIENCIA ---\n`;
  comments.slice(0, 80).forEach((c, i) => {
    dataPrompt += `${i+1}. [Comentario] Autor: @${c.author}, Likes: ${c.likes || 0}, Texto: "${c.text}"\n`;
  });

  dataPrompt += `\n--- LÍDERES DE OPINIÓN / PARTICIPANTES CLAVE ---\n`;
  (voices || []).forEach((v, i) => {
    dataPrompt += `${i+1}. [Perfil] @${v.username}, Plataforma: ${v.platform}, Postura: ${v.sentiment}, Seguidores: ${v.followers || 0}, Interacción Generada: ${v.total_engagement || 0}, Gatillos asociados: ${(v.keywords || []).join(', ')}\n`;
  });

  const prompt = `Actúa como un analista y estratega senior de manejo de crisis y reputación de marca corporativa. Analiza la conversación de las redes sociales sobre Pepe Aguilar provista abajo.
  
Tu objetivo es redactar un análisis estratégico extremadamente objetivo, factual, de pocas palabras pero de alto impacto. 
NO uses lenguaje romántico, poético, metafórico o florido. Di las cosas como son, de forma directa y clara.
Explica de manera concisa el "POR QUÉ" ocurre cada foco crítico y qué hacer al respecto.

Debes devolver EXACTAMENTE un objeto JSON estructurado con el siguiente formato, sin explicaciones ni markdown fuera del JSON:

{
  "resumen_ejecutivo": [
    "Punto factual 1: Explicar qué ocurre exactamente y por qué (basado en hechos)...",
    "Punto factual 2: Explicar qué ocurre exactamente y por qué (basado en hechos)...",
    "Punto factual 3: Explicar qué ocurre exactamente y por qué (basado en hechos)...",
    "Punto factual 4: Explicar qué ocurre exactamente y por qué (basado en hechos)..."
  ],
  "sentimiento": {
    "favorable": 15,
    "neutral": 68,
    "critico": 17
  },
  "nivel_riesgo": "medio", // Opciones válidas: bajo, medio, alto, muy_alto
  "alertas": [
    "Alerta 1: Riesgo o amenaza directa + por qué ocurre...",
    "Alerta 2: Riesgo o amenaza directa + por qué ocurre...",
    "Alerta 3: Riesgo o amenaza directa + por qué ocurre...",
    "Alerta 4: Riesgo o amenaza directa + por qué ocurre..."
  ],
  "plan_accion": [
    "Acción 1: Qué hacer de forma inmediata para mitigar...",
    "Acción 2: Qué hacer de forma inmediata para mitigar...",
    "Acción 3: Qué hacer de forma inmediata para mitigar...",
    "Acción 4: Qué hacer de forma inmediata para mitigar..."
  ],
  "oportunidades": [
    "Mejora 1: Área de mejora clara y cómo capitalizarla...",
    "Mejora 2: Área de mejora clara y cómo capitalizarla...",
    "Mejora 3: Área de mejora clara y cómo capitalizarla..."
  ],
  "analisis_voces": {
    "aliados_destacados": [
      { "username": "PepeAguilar", "comentario_o_post": "Mensaje principal", "impacto": "Alto" }
    ],
    "criticos_destacados": [
      { "username": "CriticoFiel", "comentario_o_post": "Mensaje principal", "impacto": "Moderado" }
    ]
  }
}

Calcula los porcentajes de sentimiento y el nivel de riesgo de forma lógica basándote en la fuerza y volumen de las críticas de la audiencia y comentarios negativos provistos.

Aquí están los datos recopilados:
${dataPrompt}`;

  const models = [
    'anthropic/claude-3.5-sonnet',
    'google/gemini-2.5-flash',
    'meta-llama/llama-3.3-70b-instruct',
    'meta-llama/llama-3.1-8b-instruct:free'
  ];

  let parsedAnalysis = null;
  let successModel = '';

  for (const model of models) {
    console.log(`Enviando solicitud a ${model} a través de OpenRouter...`);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/BrandonBlackwell-ui/DashboardPP',
          'X-Title': 'Blackwell Dashboard'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'Eres un analista experto en reputación de marca y manejo de crisis de comunicación. Tu salida debe ser exclusivamente un JSON válido bien formateado.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: 'json_object' }
        })
      });

      const resJson = await response.json();
      if (resJson.error) {
        console.warn(`Error con el modelo ${model}:`, resJson.error.message || JSON.stringify(resJson.error));
        continue;
      }

      const aiText = resJson.choices?.[0]?.message?.content;
      if (!aiText) {
        console.warn(`No se recibió contenido para el modelo ${model}`);
        continue;
      }

      let cleanText = aiText.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.substring(7, cleanText.length - 3).trim();
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.substring(3, cleanText.length - 3).trim();
      }

      parsedAnalysis = JSON.parse(cleanText);
      successModel = model;
      break;
    } catch (err) {
      console.warn(`Error al procesar con el modelo ${model}:`, err.message);
    }
  }

  if (!parsedAnalysis) {
    console.error('ERROR: Todos los modelos de OpenRouter fallaron. Verifica tu saldo o configuración.');
    process.exit(1);
  }

  console.log(`Análisis generado exitosamente por ${successModel}.`);

  try {
    // 6. Guardar el análisis en la columna `ai_analysis` del reporte
    console.log('Guardando el análisis de IA en la tabla de reports de Supabase...');
    const { error: updateErr } = await supabase
      .from('reports')
      .update({ ai_analysis: parsedAnalysis })
      .eq('id', reportId);

    if (updateErr) {
      throw new Error(`Supabase update error: ${updateErr.message}`);
    }

    console.log('¡ÉXITO TOTAL! El análisis consolidado por IA ha sido guardado correctamente en Supabase.');
    console.log('Estructura guardada:');
    console.log(JSON.stringify(parsedAnalysis, null, 2));

  } catch (err) {
    console.error('ERROR DURANTE EL GUARDADO EN SUPABASE:', err.message);
    process.exit(1);
  }
}

run().catch(console.error);
