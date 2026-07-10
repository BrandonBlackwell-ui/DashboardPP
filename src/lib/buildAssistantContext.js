// Arma el contexto completo que el asistente de voz conoce: todo lo que hay en el
// front (PA_DATA, voces, medios) + el histórico (CALENDAR_DATA) para comparativas.
// Es texto plano; se envía como systemInstruction a Gemini Live.

import { conversationState } from '../utils/helpers';

const NET_LABEL = {
  facebook: 'Facebook', instagram: 'Instagram', x: 'X/Twitter', tiktok: 'TikTok',
  google_news: 'Google News', redes_propias: 'Redes Propias', resumen: 'Panorama',
};
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const fdate = dk => { if (!dk) return ''; const d = new Date(dk+'T12:00:00'); return isNaN(d) ? dk : `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; };
const arr = x => Array.isArray(x) ? x : (x ? [x] : []);

export function buildAssistantContext() {
  const D = window.PA_DATA || {};
  const themes = D.themes || {};
  const cal = window.CALENDAR_DATA?.days || {};
  const voices = window.ALL_VOICES_DATA || { allies: [], critics: [] };
  const media = window.ALL_MEDIA_DATA || [];
  const L = [];

  L.push('Te llamas ORWELL, el asistente de voz del dashboard de reputación de Pepe Aguilar, hecho por Blackwell Strategy. Si te preguntan tu nombre, responde que eres Orwell.');
  L.push('Estás hablando DIRECTAMENTE con Pepe Aguilar. Dirígete a él siempre como "Pepe". Sé amable, cordial, servicial y cercano; suena humano y cálido, nunca robótico.');
  L.push('Respondes SOLO con los datos de este contexto (monitoreo de redes y prensa sobre Pepe Aguilar y su familia). No inventes cifras. Si te preguntan algo fuera de estos datos, acláralo con amabilidad. Responde breve, directo y en español, como un analista de confianza que reporta a su cliente.');
  L.push('MUY IMPORTANTE — tu PRIMERA intervención de la conversación: sin importar lo que diga Pepe (aunque solo salude con un "hola"), salúdalo por su nombre con calidez y dale de inmediato un resumen rápido del panorama general (sentimiento favorable/crítico, nivel de riesgo y lo más relevante del día). Ejemplo de tono: "¡Hola Pepe, soy Orwell, qué gusto escucharte hoy! Te traigo el análisis: en general estás en [X]% favorable, con riesgo [nivel], y lo más importante es [...]". Después de ese resumen inicial, responde puntual a lo que te pregunte.');
  L.push(`Fecha del último análisis: ${fdate(D.meta?.latest_ai_report?.date_key) || D.meta?.range_label || 'reciente'}.`);
  L.push('');

  // Panorama consolidado
  const res = themes.resumen?.ai_analysis;
  if (res) {
    const s = res.sentimiento || {};

    // Semáforo "Estado de la Conversación" (umbrales BW-26-07-PA-KPI-002).
    const sem = conversationState({
      favorable: (Number(s.favorable) || 0) + (Number(s.neutral) || 0),
      critico: s.critico,
    });
    L.push('=== SEMÁFORO · ESTADO DE LA CONVERSACIÓN ===');
    L.push(`El semáforo está en ${sem.tag.toUpperCase()} — "${sem.label}" (${sem.riesgo}). Favorable+neutral ${sem.favorable}%, crítica ${sem.critico}%. ${sem.meaning}`);
    L.push(`Si Pepe pregunta "¿cómo voy?", "¿hay riesgo?" o "¿qué significan los números?", explícale este semáforo en lenguaje simple: verde = zona sana, amarillo = pide atención, rojo = protocolo de crisis. El color lo manda la peor de las dos lecturas. Acción a seguir en este nivel: ${sem.actions.join(' ')}`);
    L.push('Regla: el nivel oficial es el promedio de la semana; si un solo día toca rojo, se activa alerta de crisis.');
    L.push('');

    L.push('=== PANORAMA CONSOLIDADO (IA) ===');
    L.push(`Sentimiento general: ${s.favorable ?? '?'}% favorable, ${s.neutral ?? '?'}% neutral, ${s.critico ?? '?'}% crítico. Nivel de riesgo: ${res.nivel_riesgo || '?'}.`);
    if (arr(res.resumen_ejecutivo).length) L.push('Resumen ejecutivo:\n- ' + arr(res.resumen_ejecutivo).join('\n- '));
    if (arr(res.alertas).length) L.push('Alertas:\n- ' + arr(res.alertas).map(a => typeof a === 'string' ? a : (a.text||a.alerta||'')).join('\n- '));
    if (arr(res.plan_accion).length) L.push('Plan de acción:\n- ' + arr(res.plan_accion).join('\n- '));
    if (arr(res.oportunidades).length) L.push('Oportunidades:\n- ' + arr(res.oportunidades).join('\n- '));
    if (res.comparativa_historica?.resumen) L.push('Comparativa vs período anterior: ' + res.comparativa_historica.resumen);
    L.push('');
  }

  // Detalle por red
  L.push('=== DETALLE POR RED ===');
  for (const key of (D.order || Object.keys(themes))) {
    const t = themes[key];
    if (!t || key === 'resumen') continue;
    const ai = t.ai_analysis;
    const s = t.sentiment || ai?.sentimiento || {};
    const posts = t.totals?.posts ?? t.networkStrategy?.totalPosts ?? '?';
    L.push(`# ${NET_LABEL[key] || key} — ${posts} publicaciones. Sentimiento: ${s.pos ?? s.favorable ?? '?'}% favorable, ${s.neg ?? s.critico ?? '?'}% crítico.`);
    const red = ai?.desglose_por_red?.[key];
    if (red?.lectura) L.push(`  Lectura: ${red.lectura}`);
    if (red?.tendencia) L.push(`  Tendencia: ${red.tendencia}.`);
    if (arr(red?.focos).length) L.push(`  Focos: ${arr(red.focos).join(', ')}.`);
    if (red?.recomendacion) L.push(`  Recomendación: ${red.recomendacion}`);
  }
  L.push('');

  // Aliados y contrarios
  const topAllies = voices.allies.slice(0, 12);
  const topCritics = voices.critics.slice(0, 12);
  if (topAllies.length || topCritics.length) {
    L.push('=== ALIADOS Y CONTRARIOS (histórico acumulado) ===');
    if (topAllies.length) L.push('Aliados principales: ' + topAllies.map(v => `${v.username} (${NET_LABEL[v.platform]||v.platform}, alcance ${Math.round(v.engagement||0)})`).join('; '));
    if (topCritics.length) L.push('Contrarios principales: ' + topCritics.map(v => `${v.username} (${NET_LABEL[v.platform]||v.platform}, alcance ${Math.round(v.engagement||0)})`).join('; '));
    L.push('');
  }

  // Medios de comunicación
  if (media.length) {
    L.push('=== MEDIOS DE COMUNICACIÓN ===');
    media.forEach(m => L.push(`- ${m.nombre} (${m.alcance === 'macro' ? 'nacional' : 'regional'}): ${m.notas} nota(s), tono ${m.tono}${arr(m.temas).length ? ', temas: ' + arr(m.temas).join(', ') : ''}.`));
    L.push('');
  }

  // Histórico día por día (para comparativas)
  const dayKeys = Object.keys(cal).sort();
  if (dayKeys.length) {
    L.push('=== HISTÓRICO DÍA POR DÍA (para comparar evolución) ===');
    L.push('Formato: fecha | red: favorable%/crítico% (riesgo).');
    for (const dk of dayKeys) {
      const parts = Object.entries(cal[dk] || {})
        .filter(([tk]) => tk !== 'resumen')
        .map(([tk, v]) => `${NET_LABEL[tk]||tk}: ${v.pos||0}%/${v.neg||0}% (${v.risk||'bajo'})`);
      if (parts.length) L.push(`${fdate(dk)} | ${parts.join(' · ')}`);
    }
    L.push('');
  }

  L.push('Cuando te pregunten "cómo vamos" o comparaciones entre fechas/redes, usa el histórico de arriba. Da el número y una lectura corta de qué significa.');

  return L.join('\n');
}
