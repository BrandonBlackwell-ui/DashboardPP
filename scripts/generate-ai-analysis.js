import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

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

  // 1. Obtener el último reporte del tema "resumen" (o el más reciente de todos)
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

  // 5. Armar el Prompt con los datos crudos para Claude 3.5 Sonnet
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

  const prompt = `Actúa como un director de relaciones públicas y manejo de crisis de comunicación digital de élite. Analiza la conversación de las redes sociales sobre Pepe Aguilar provista abajo.
  
Tu objetivo es redactar un análisis detallado, estratégico y accionable. Debe sonar sumamente profesional, agudo y corporativo (estilo consultoría internacional de primer nivel).

Debes devolver EXACTAMENTE un objeto JSON estructurado con el siguiente formato, sin explicaciones ni markdown fuera del JSON:

{
  "resumen_ejecutivo": "Un texto analítico largo y profundo que resuma la situación general, tensiones clave, reputación y clima de opinión.",
  "sentimiento": {
    "favorable": 15,
    "neutral": 68,
    "critico": 17
  },
  "nivel_riesgo": "medio", // Opciones válidas: bajo, medio, alto, muy_alto
  "alertas": [
    "Descripción detallada de la primera alerta crítica...",
    "Descripción detallada de la segunda alerta crítica..."
  ],
  "plan_accion": [
    "Acción 1: Recomendación estratégica sobre qué hacer...",
    "Acción 2: Recomendación estratégica sobre qué hacer..."
  ],
  "oportunidades": [
    "Área de oportunidad 1: Qué capitalizar...",
    "Área de oportunidad 2: Qué capitalizar..."
  ],
  "analisis_voces": {
    "aliados_destacados": [
      { "username": "PepeAguilar", "comentario_o_post": "Mensaje favorable principal", "impacto": "Alto impacto en red social" }
    ],
    "criticos_destacados": [
      { "username": "CriticoFiel", "comentario_o_post": "Mensaje negativo principal", "impacto": "Moderado, posible viralización" }
    ]
  }
}

Calcula los porcentajes de sentimiento y el nivel de riesgo de forma lógica basándote en la fuerza y volumen de las críticas de la audiencia y comentarios negativos provistos.

Aquí están los datos recopilados:
${dataPrompt}`;

  console.log('Enviando solicitud a Claude 3.5 Sonnet a través de OpenRouter...');

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
        model: 'anthropic/claude-3.5-sonnet',
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
      throw new Error(`OpenRouter Error: ${JSON.stringify(resJson.error)}`);
    }

    const aiText = resJson.choices?.[0]?.message?.content;
    if (!aiText) {
      throw new Error('No se recibió contenido del modelo.');
    }

    // Limpiar posibles bloques de markdown antes de parsear
    let cleanText = aiText.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7, cleanText.length - 3).trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3, cleanText.length - 3).trim();
    }

    const parsedAnalysis = JSON.parse(cleanText);
    console.log('Análisis generado exitosamente por Claude 3.5 Sonnet.');

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
    console.error('ERROR DURANTE EL PROCESAMIENTO:', err.message);
    process.exit(1);
  }
}

run().catch(console.error);
