export const C = {
  teal:'#4E7351', tealBg:'rgba(78,115,81,0.12)', tealBd:'rgba(78,115,81,0.38)',
  amber:'#B0822F', amberBg:'rgba(176,130,47,0.12)', amberBd:'rgba(176,130,47,0.38)',
  crim:'#9B3331', crimBg:'rgba(155,51,49,0.12)', crimBd:'rgba(155,51,49,0.38)',
  slate:'#A9997B', slateBg:'rgba(169,153,123,0.16)', slateBd:'rgba(169,153,123,0.42)',
  ink:'#211C17', paper:'#EFE9DC', card:'#FBF8F1', sub:'#F3EDE0',
  gold:'#B0822F', goldDeep:'#9A6F1C'
};

export function fmt(n) {
  if (n==null||isNaN(n)) return '0';
  return Math.round(n).toLocaleString('es-MX');
}
export function fmtK(n) {
  if (n==null) return '0';
  if (n>=1e6) return (n/1e6).toFixed(n>=1e7?0:1).replace('.0','')+'M';
  if (n>=1e3) return (n/1e3).toFixed(n>=1e4?0:1).replace('.0','')+'K';
  return String(Math.round(n));
}
// Clasifica el tono de UNA nota de prensa hacia Pepe. Usa el sentiment real de la nota
// si existe (lo llena la IA); si no, estima por palabras clave del titular.
// Compartido por la agregación de medios (loadFromSupabase) y el panel de detalle.
const NOTE_NEG = ['pelea','golpes','burla','burl','exhibe','roba','robar','escándalo','escandalo','crític','critic','polémic','polemic','demanda','ataca','ataque','arremete','calvicie','bullying','se rapa','cancel','hunde','humilla','acusa','plagio','deuda','drama','tunde','funa','destroza',"can't",'cant stop','vs ','contra ','pleito','indirecta','desubicad','inmadur'];
const NOTE_POS = ['reconocid','nominad','homenaje','éxito','exito','orgullo','respald','leyenda','celebra','triunfo','aplauso','gala','premi','honra','emotiv','emociona','gran ','maravill','brilla','arrasa','conquista','aplaude','elogi'];
export function classifyNote(note) {
  const s = (note.sentiment || '').toLowerCase();
  if (['favorable', 'positive', 'positivo'].includes(s)) return 'pos';
  if (['critico', 'crítico', 'negative', 'negativo'].includes(s)) return 'neg';
  if (s === 'neutral') return 'neu';
  const t = (note.text || '').toLowerCase();
  const neg = NOTE_NEG.some(k => t.includes(k));
  const pos = NOTE_POS.some(k => t.includes(k));
  return neg && !pos ? 'neg' : pos && !neg ? 'pos' : 'neu';
}

export function platLabel(p) {
  return ({tiktok:'TikTok',facebook:'Facebook',instagram:'Instagram',twitter:'X',google_news:'Google News'})[p]
    || (p ? p.charAt(0).toUpperCase()+p.slice(1) : '—');
}
export function cap(s) {
  return s ? s.charAt(0).toUpperCase()+s.slice(1).replace(/_/g,' ') : '';
}

export function riskMeta(level) {
  if (level==='muy_bajo'||level==='bajo') return {label:'Riesgo bajo',ink:C.teal,bg:C.tealBg,bd:C.tealBd,c:C.teal};
  if (level==='medio'||level==='moderada') return {label:'Riesgo medio',ink:C.amber,bg:C.amberBg,bd:C.amberBd,c:C.amber};
  if (level==='alto'||level==='critico') return {label:'Riesgo alto',ink:C.crim,bg:C.crimBg,bd:C.crimBd,c:C.crim};
  return {label:'Sin datos',ink:'#8A7E6A',bg:C.slateBg,bd:C.slateBd,c:C.slate};
}
export function sentMeta(s) {
  s=(s||'').toLowerCase();
  if (s.includes('posit')) return {ink:C.teal,bg:C.tealBg,bd:C.tealBd,c:C.teal};
  if (s.includes('negat')||s.includes('crit')) return {ink:C.crim,bg:C.crimBg,bd:C.crimBd,c:C.crim};
  if (s.includes('mixto')) return {ink:C.amber,bg:C.amberBg,bd:C.amberBd,c:C.amber};
  return {ink:'#8A7E6A',bg:C.slateBg,bd:C.slateBd,c:C.slate};
}
export function sevMeta(s) {
  s=(s||'').toLowerCase();
  if (s.includes('alta')||s.includes('crit')) return {ink:C.crim,bg:C.crimBg,bd:C.crimBd,c:C.crim};
  if (s.includes('media')) return {ink:C.amber,bg:C.amberBg,bd:C.amberBd,c:C.amber};
  return {ink:'#8A7E6A',bg:C.slateBg,bd:C.slateBd,c:C.slate};
}
export function pill(ink,bg,bd) {
  return { display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:'999px',
    fontFamily:"'Geist Mono',monospace",fontSize:'9px',fontWeight:500,letterSpacing:'0.06em',
    textTransform:'uppercase',whiteSpace:'nowrap',color:ink,background:bg,border:`1px solid ${bd}` };
}

// ─── Semáforo · Estado de la Conversación (spec BW-26-07-PA-KPI-002) ───────────
// Dos lecturas simultáneas: favorable (mayor = mejor) y crítica (menor = mejor).
// El color general es la PEOR de las dos. Nivel = promedio semanal (evaluación),
// el dashboard corre a diario para monitoreo operativo.
export const SEMAFORO_MIN_VOLUME = 500;

const numPct = (x) => {
  const n = Number(String(x ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
};

// Rangos del PDF. Favorable: >=60 verde · 40-59 amarillo · <40 rojo.
export function convLevelFavorable(fav) {
  if (fav >= 60) return 0;
  if (fav >= 40) return 1;
  return 2;
}
// Crítica: <=30 verde · 31-39 amarillo · >=40 rojo.
export function convLevelCritica(crit) {
  if (crit <= 30) return 0;
  if (crit < 40) return 1;
  return 2;
}

const SEMAFORO_META = {
  0: { key:'verde', label:'Zona sana', tag:'Verde', c:C.teal, bg:C.tealBg, bd:C.tealBd,
       meaning:'La conversación está a favor y la crítica no domina la agenda. La lectura pública se mueve en el rango deseado.',
       riesgo:'Riesgo bajo',
       actions:[
         'Mantener el ritmo de contenido y replicar los comentarios positivos.',
         'Reaccionar con likes a menciones de valor y comentar posts que refuercen la narrativa.',
         'Documentar las publicaciones que funcionaron para repetir el patrón.',
         'Monitorear temas y detectar riesgos potenciales antes de que escalen.',
       ] },
  1: { key:'amarillo', label:'Observación · pide atención', tag:'Amarillo', c:C.amber, bg:C.amberBg, bd:C.amberBd,
       meaning:'La conversación favorable se desacelera o la crítica escaló en algún pico con foco identificable. Todavía no es alerta, pero pide atención.',
       riesgo:'Riesgo medio',
       actions:[
         'Diagnosticar los temas que hacen girar la conversación.',
         'Apuntalar contenido positivo desde las cuentas corporativas (Machin).',
         'Evaluar posibles posturas reactivas.',
         'Responder a los comentarios que generan volumen de conversación.',
       ] },
  2: { key:'rojo', label:'Crítica · protocolo', tag:'Rojo', c:C.crim, bg:C.crimBg, bd:C.crimBd,
       meaning:'La crítica domina la conversación y marca la agenda mediática; la conversación se movió a terreno negativo.',
       riesgo:'Riesgo alto',
       actions:[
         'Coordinación inmediata interagencias.',
         'Redacción de postura oficial sobre el foco identificado.',
         'Entrevistas estratégicas con medios aliados para reencuadrar y activación de voces aliadas (columnistas, creadores).',
         'Pausa de contenido comercial 48 horas.',
       ] },
};

export function conversationState({ favorable = 0, critico = 0, volume = null, minVolume = SEMAFORO_MIN_VOLUME } = {}) {
  const fav = numPct(favorable);
  const crit = numPct(critico);
  const favLevel = convLevelFavorable(fav);
  const critLevel = convLevelCritica(crit);
  const rank = Math.max(favLevel, critLevel);
  const insufficient = volume != null && volume < minVolume;
  return {
    rank,
    favorable: fav,
    critico: crit,
    favLevel,
    critLevel,
    driver: critLevel >= favLevel ? 'critica' : 'favorable', // qué lectura empuja el color
    insufficient,
    volume,
    minVolume,
    ...SEMAFORO_META[rank],
  };
}

export function getWeekendDates(dateStr) {
  const dateObj = new Date(dateStr + 'T12:00:00');
  if (dateObj.getDay() === 5) { // 5 is Friday
    const sat = new Date(dateObj);
    sat.setDate(dateObj.getDate() + 1);
    const sun = new Date(dateObj);
    sun.setDate(dateObj.getDate() + 2);
    return [
      sat.toISOString().slice(0, 10),
      sun.toISOString().slice(0, 10)
    ];
  }
  return null;
}

export function getFridayDateKey(dateKey) {
  const dateObj = new Date(dateKey + 'T12:00:00');
  const day = dateObj.getDay();
  if (day === 6) { // Saturday
    const fri = new Date(dateObj);
    fri.setDate(dateObj.getDate() - 1);
    return fri.toISOString().slice(0, 10);
  }
  if (day === 0) { // Sunday
    const fri = new Date(dateObj);
    fri.setDate(dateObj.getDate() - 2);
    return fri.toISOString().slice(0, 10);
  }
  return dateKey;
}

