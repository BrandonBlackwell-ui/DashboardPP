/**
 * message-framework.js — Marco estratégico de mensajes de Pepe Aguilar (BW-26-07-PA-MSG-001).
 * Es la "brújula" del análisis: la IA interpreta la conversación real contra esta estrategia
 * y ancla sus recomendaciones a los pilares y mensajes clave. NO sirve para inventar datos.
 *
 * Se inyecta en los prompts de run-full-analysis.js y generate-ai-analysis.js.
 */

export const MESSAGE_FRAMEWORK_PROMPT = `=== MARCO ESTRATEGICO DE MENSAJES (BW-26-07-PA-MSG-001) ===
Usa este marco como BRUJULA para interpretar la conversacion real y anclar tus recomendaciones. No inventes datos: solo evalua lo que ya esta en los datos a la luz de esta estrategia.

MENSAJE MAESTRO: "Elegi ser dueno de lo que creo, de lo que construyo y de lo que cuido. Eso es lo que soy, y lo que sere."

TRES PILARES EMPRESARIALES:
- PIONERO (independencia): el artista dueno de su obra e infraestructura; libertad y autenticidad. Temas: independencia, dueno del legado, autenticidad.
- VISIONARIO (tecnologia / IA): la IA como herramienta al servicio del creador; soberania tecnologica; evolucion y relevancia. Temas: IA, tecnologia, innovacion.
- GUARDIAN (charreria / mexicanidad): charreria, mariachi, orgullo mexicano y legado de Don Antonio como patrimonio. Temas: charreria, tradicion, orgullo, comunidad.

VALORES TRANSVERSALES: soberania, orgullo mexicano, compromiso con el publico, respeto al talento, independencia real, excelencia, pertenencia cultural.

MANEJO DE TEMAS REACTIVOS (si aparecen en la conversacion, evalua si se sigue el pivote correcto y recomienda segun esta guia):
- Angela Aguilar -> "cada artista, su propio escenario"; regresar al show y catalogo propio. Nunca entrar en polemica.
- Nodal / Cazzu / Emiliano -> "cada quien habla por si mismo, hoy vine a cantar". Cortar el hilo, volver a la musica.
- Amuleto del Tri -> presencia, no oraculo; cero apropiacion del apodo.
- Criticas a "El Son de la Negra" / comparaciones -> silencio activo y posicion de altura; solo responde un tercero creible (periodista cultural), nunca Pepe directo.
- Cancelacion de conciertos EEUU/Canada -> comunicacion oficial desde produccion, no desde Pepe; distinguir casos (visas por show, no todos).
- Homenaje Dia de San Juan / legado Don Antonio -> patrimonio compartido, cero apropiacion desde Pepe.

COMO USAR EL MARCO:
1. En resumen_ejecutivo, plan_accion, oportunidades y cada recomendacion por red: ancla la recomendacion a un pilar o mensaje clave (di explicitamente a cual).
2. Detecta que pilar gana o pierde traccion en la conversacion real, con evidencia (autores, numeros).
3. Si un tema reactivo esta activo, di si se maneja segun el pivote o si hay riesgo de narrativa, y recomienda el pivote del documento.
4. Llena el campo "alineacion_estrategica" del JSON de salida.`;

// System prompt para la SEGUNDA llamada (fundamento interno, solo admin).
export const RATIONALE_SYSTEM = 'Eres el analista senior. Explicas, SOLO para uso interno del equipo, por que un analisis de reputacion llego a sus conclusiones, fundamentandolo en el documento de mensajes maestros y citandolo. Responde solo JSON valido, sin markdown.';

// Construye el prompt de la segunda llamada: "analisis del analisis".
// Recibe el JSON del analisis ya producido (primera llamada) y pide el porque, citando el documento.
export function buildRationalePrompt(analysis) {
  const compact = JSON.stringify({
    resumen_ejecutivo: analysis?.resumen_ejecutivo,
    sentimiento: analysis?.sentimiento,
    nivel_riesgo: analysis?.nivel_riesgo,
    alertas: analysis?.alertas,
    plan_accion: analysis?.plan_accion,
    oportunidades: analysis?.oportunidades,
    desglose_por_red: analysis?.desglose_por_red,
  });
  return `A continuacion esta un ANALISIS de reputacion de Pepe Aguilar que ya se produjo (primera llamada). Tu tarea: explicar, PARA USO INTERNO DEL ADMIN (el cliente NO lo vera), POR QUE el analisis llego a esas conclusiones, fundamentandolo en el marco estrategico de mensajes y CITANDO las partes especificas del documento (pilar, mensaje maestro, valor o pivote reactivo) que respaldan cada conclusion.

${MESSAGE_FRAMEWORK_PROMPT}

ANALISIS PRODUCIDO (primera llamada):
${compact}

Devuelve SOLO JSON con esta forma exacta:
{
  "resumen": "2-3 frases: por que el analisis quedo asi, leido desde la estrategia del documento",
  "fundamentos": [
    {"conclusion":"una conclusion o recomendacion concreta del analisis","referencia_doc":"Pilar Pionero | Pilar Visionario | Pilar Guardian | Mensaje maestro | Reactivo <tema> | Valor <x>","cita":"cita textual breve y real del documento de arriba que lo respalda","por_que":"por que esa conclusion se deriva o se alinea con esa parte del documento"}
  ],
  "reactivos_detectados": [{"tema":"Angela|Nodal|amuleto Tri|Son de la Negra|visas EEUU|San Juan","manejo":"bien|riesgo","pivote_doc":"el pivote textual del documento a aplicar"}],
  "brechas": ["pilar o mensaje del documento que NO aparece en la conversacion y deberia trabajarse"]
}

Reglas: cita el documento de forma verificable (usa pilares/mensajes/pivotes reales del marco de arriba). No inventes citas ni conclusiones que no esten en el analisis. Se breve, concreto y factual.`;
}
