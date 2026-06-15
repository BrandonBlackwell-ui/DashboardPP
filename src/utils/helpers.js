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
