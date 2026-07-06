/**
 * event-report.js — Arma el "Reporte de evento" de Pepe Aguilar.
 * Flujo: (scrapear si falta) → filtrar a Pepe + query → comentarios de piezas top
 *        → contexto del último resumen → IA arma el análisis → data para report-docx.
 */
import { createClient } from '@supabase/supabase-js';
import { runFullAnalysis, scrapeCommentsForUrls, callAI } from './run-full-analysis.js';

const SUPABASE_URL = 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
const strip = s => (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const dateRange = (from, to) => { const out=[]; let d=new Date(from+'T12:00:00Z'); const end=new Date(to+'T12:00:00Z'); while(d<=end){ out.push(d.toISOString().slice(0,10)); d.setUTCDate(d.getUTCDate()+1); } return out; };
const STOP = new Set(['vs','contra','de','del','la','el','los','las','en','y','a','partido','evento','mundial','2026','con','por']);

function keywordsFrom(query){
  const words = strip(query).split(/[^a-z0-9]+/).filter(w => w.length>=4 && !STOP.has(w));
  return [...new Set([strip(query), ...words])].filter(Boolean);
}

async function hasScraped(date){
  const { data: reps } = await supabase.from('reports').select('id').eq('date_key',date).neq('theme_key','resumen');
  if(!reps?.length) return false;
  const { count } = await supabase.from('scraped_posts').select('id',{count:'exact',head:true}).in('report_id', reps.map(r=>r.id));
  return (count||0) > 0;
}

async function fetchWindowPosts(dates){
  const { data: reps } = await supabase.from('reports').select('id').in('date_key',dates).neq('theme_key','resumen');
  if(!reps?.length) return [];
  const { data: posts } = await supabase.from('scraped_posts')
    .select('id,platform,username,text,url,published_date,likes,comments_count,views').in('report_id', reps.map(r=>r.id)).limit(2000);
  const byUrl={}; for(const p of (posts||[])){ const k=p.url||p.id; if(!byUrl[k] || (p.likes+p.views)>(byUrl[k].likes+byUrl[k].views)) byUrl[k]=p; }
  return Object.values(byUrl);
}

async function latestResumen(toDate){
  const { data } = await supabase.from('reports').select('date_key,ai_analysis')
    .eq('theme_key','resumen').lte('date_key',toDate).not('ai_analysis','is',null)
    .order('date_key',{ascending:false}).limit(1);
  return data?.[0] || null;
}

const reach = p => (p.views||0) + (p.likes||0)*5;

function commentSignal(comments){
  const n = comments?.length || 0; if(!n) return null;
  const byAuthor = {}; let emoji = 0;
  for(const c of comments){ const a=(c.author||'?'); byAuthor[a]=(byAuthor[a]||0)+1; if(!/[a-záéíóúñü]/i.test(c.text||'')) emoji++; }
  const sorted = Object.entries(byAuthor).sort((a,b)=>b[1]-a[1]);
  return { n, topAuthor: sorted[0][0], topCount: sorted[0][1], topShare: Math.round(sorted[0][1]/n*100), emojiPct: Math.round(emoji/n*100) };
}

function buildPrompt({ query, from, to, cands, commentsByUrl, signalByUrl, ctx }){
  let out = `Eres analista senior de reputacion y crisis para Pepe Aguilar (Blackwell Strategy). Redacta un REPORTE ejecutivo, honesto, factual y bien escrito, SOLO sobre lo que liga a Pepe Aguilar con el evento "${query}" (ventana ${from} a ${to}). El lector es el cliente; tono profesional, directo, sin relleno.\n\n`;
  out += `REGLAS DURAS:\n`;
  out += `- Usa SOLO los datos de abajo. No inventes cifras, autores ni frases.\n`;
  out += `- Cita comentarios/posts de forma TEXTUAL y COMPLETA (no cortes a media palabra; si el texto viene truncado con "…", no lo cites o parafrasea el sentido).\n`;
  out += `- Distingue con cuidado: si la mencion es al equipo, a la familia (Angela/Nodal) o a otro tema y Pepe solo esta etiquetado, dilo y baja su relevancia. El objeto es PEPE + el evento.\n`;
  out += `- DEDUPLICA: si dos piezas cubren lo mismo (mismo evento/clip), quedate con una.\n`;
  out += `- SEÑALES DE BOTS/INFLADO: cada pieza trae una linea SEÑAL con % de comentarios de una sola cuenta y % emoji-only. Si topShare es alto (>=35%) o emojiPct alto (>=50%), trata ese "apoyo" como NO organico y decláralo explicitamente en el reporte (narrativa y riesgos).\n`;
  out += `- TONO por pieza: Positivo | Negativo | Reproche | Burla | Neutral | Critico. Se preciso, no pongas todo "Neutral".\n`;
  out += `- Si el volumen es bajo, dilo claramente (es un hallazgo valido, no lo infles).\n`;
  out += `- CARDS de comentario: la meta debe usar los datos DEL COMENTARIO (\"RED · @autor_del_comentario · N likes\"), nunca las metricas del post.\n\n`;
  if(ctx?.ai_analysis?.sentimiento){ const s=ctx.ai_analysis.sentimiento; out += `CONTEXTO (ultimo panorama ${ctx.date_key}): favorable ${s.favorable}% / neutral ${s.neutral}% / critico ${s.critico}%, riesgo ${ctx.ai_analysis.nivel_riesgo||'?'}. Usalo solo como telon de fondo.\n\n`; }
  out += `PIEZAS CANDIDATAS (elige SOLO las realmente relevantes a Pepe+evento; para la tabla usa su URL tal cual):\n`;
  cands.forEach((p,i)=>{
    out += `#${i+1} url:${p.url} | ${p.platform} | @${p.username} | ${(p.published_date||'').slice(0,10)} | likes:${p.likes} comentarios_declarados:${p.comments_count} vistas:${p.views}\n`;
    out += `   texto: "${(p.text||'').replace(/\s+/g,' ').slice(0,360)}"\n`;
    const sg = signalByUrl[p.url];
    if(sg) out += `   SEÑAL comentarios: ${sg.n} captados · cuenta top @${sg.topAuthor} aporta ${sg.topCount} (${sg.topShare}%) · emoji-only ${sg.emojiPct}%\n`;
    const cm = commentsByUrl[p.url];
    if(cm?.length){ out += `   comentarios: ` + cm.slice(0,20).map(c=>`@${c.author}(${c.likes||0}likes):"${(c.text||'').replace(/\s+/g,' ').slice(0,140)}"`).join(' | ') + `\n`; }
  });
  out += `\nDevuelve SOLO JSON valido (sin markdown fuera de los campos). Usa **negritas** dentro de los textos para enfatizar 1-2 frases clave. Estructura EXACTA:\n`;
  out += `{
 "titulo_evento": "nombre MUY corto del evento, max 4 palabras, SIN parentesis ni sufijos (ej: 'México vs Inglaterra', NO 'México vs Inglaterra (Mundial 2026) — Menciones a Pepe')",
 "metodo": "1-2 frases: que se midio y que se excluyo (menciona si el volumen fue bajo)",
 "resumen_sub": "titular corto y con gancho, con **negritas**",
 "resumen": "3-4 frases ejecutivas con **negritas**; el hallazgo principal primero",
 "piezas": [ {"url":"<de las candidatas>","titulo":"titulo corto y claro","tono":"Positivo|Negativo|Reproche|Burla|Neutral|Critico"} ],
 "narrativas": [ {"titulo":"**A · Nombre**: subtitulo","color":"blue|gold|red","intro":"1-2 frases","cards":[ {"label":"ETIQUETA MONO CORTA","quote":"cita textual completa","meta":"RED · @autor · N likes (del comentario o post citado)","accent":"blue|gold|red","metaIcon":"ig|tt|fb"} ]} ],
 "sentimiento_sub":"titular con **negritas**", "sentimiento":"2-3 frases; si el apoyo positivo no es organico (bots), dilo aqui",
 "riesgos":[ {"lead":"Titulo corto. ","rest":"detalle accionable"} ],
 "qa":[ {"tema":"pregunta/tema probable","respuesta":"linea de mensaje sugerida, lista para usar"} ]
}
Guia: 2-4 narrativas, cada una con 1-3 cards. Colores: azul=positivo/neutro, oro=matiz/fragil, rojo=negativo/alerta. Si hay bots, incluye una card o riesgo rojo que lo señale.`;
  return out;
}

// ── mini-markdown: **negritas** -> runs ──
function mdRuns(text, def={}){
  const runs=[]; const parts=String(text||'').replace(/\s+/g,' ').split(/(\*\*[^*]+\*\*)/g);
  for(let part of parts){ if(!part) continue; const m=part.match(/^\*\*([^*]+)\*\*$/);
    if(m){ runs.push({...def,t:m[1].trim(),b:true}); }
    else { part=part.replace(/\*+/g,''); if(part.trim()||/ $|^ /.test(part)) runs.push({...def,t:part}); } }
  return runs.length?runs:[{...def,t:''}];
}
const canalLabel = { instagram:'Instagram', tiktok:'TikTok', facebook:'Facebook' };

function mapToData({ query, to, analysis, cands, commentsByUrl }){
  const byUrl = Object.fromEntries(cands.map(p=>[p.url,p]));
  const chosen = (analysis.piezas||[]).map(x=>({ ...x, p:byUrl[x.url] })).filter(x=>x.p);
  const sum=(k)=>chosen.reduce((s,x)=>s+(+x.p[k]||0),0);
  const nReacc=sum('likes'), nCom=sum('comments_count'), nViews=sum('views');
  const fmt=n=> n>=1000 ? (n/1000).toFixed(1).replace(/\.0$/,'')+'K' : String(n);
  const top = chosen.slice().sort((a,b)=>reach(b.p)-reach(a.p))[0];

  const d = new Date(to+'T12:00:00Z');
  const yy=String(d.getUTCFullYear()).slice(2), mm=String(d.getUTCMonth()+1).padStart(2,'0');
  const slug = strip(analysis.titulo_evento||query).replace(/[^a-z0-9]/g,'').toUpperCase().slice(0,10) || 'EVENTO';
  const folio = `BW-${yy}-${mm}-PA-${slug}-001`;
  const fechaLabel = `${String(d.getUTCDate()).padStart(2,'0')} · ${MESES[d.getUTCMonth()]} · ${d.getUTCFullYear()}`;
  const evento = (analysis.titulo_evento || query).replace(/\s*[—–-].*$/,'').replace(/\s*\(.*$/,'').trim() || query;
  const capWords = (s, max) => { s = s.trim(); if (s.length <= max) return s; return s.slice(0, max).replace(/\s+\S*$/, '') || s.slice(0, max); };

  const canalesPresentes = [...new Set(chosen.map(x=>x.p.platform))];
  const fuentes = canalesPresentes.map(c=>({ icon:({instagram:'ig',tiktok:'tt',facebook:'fb'}[c]), label:canalLabel[c]||c }));

  return {
    meta:{
      folio, fechaLabel, kicker:`PEPE AGUILAR · ${capWords(evento, 26).toUpperCase()}`,
      tituloRuns:[{t:'Reacción pública a '},{t:'Pepe Aguilar',b:true},{t:' en torno a '},{t:evento,b:true}],
      fuentes,
    },
    metodo:{ sub:[{t:'Qué mide este reporte y '},{t:'qué se dejó fuera',b:true},{t:'.'}], paras:[ mdRuns(analysis.metodo) ] },
    resumen:{ sub:mdRuns(analysis.resumen_sub), paras:[ mdRuns(analysis.resumen) ], stats:[
      { label:'PIEZAS · PEPE', idx:'01', big:String(chosen.length), cap:'LIGADAS AL EVENTO' },
      { label:'REACCIONES', idx:'02', big:fmt(nReacc), cap:`EN ${chosen.length} PIEZAS` },
      { label:'ALCANCE', idx:'03', big:fmt(nViews)||'—', cap:`VISTAS · ${nCom} COMENT` },
    ]},
    volumen:{ sub:[{t:'Las piezas que '},{t:'ligan a Pepe con el evento',b:true},{t:'.'}],
      intro:[{t:'Totales: '},{t:`${chosen.length} piezas · ${nReacc} reacciones · ${nCom} comentarios · ${nViews} vistas`,b:true},{t:'.'}],
      piezas: chosen.slice().sort((a,b)=>reach(b.p)-reach(a.p)).map(x=>({
        titulo:x.titulo, url:x.url, canal:x.p.platform, fecha:(x.p.published_date||'').slice(5,10),
        alcance: x.p.views ? `${x.p.views.toLocaleString('en')} v` : (x.p.comments_count?`${x.p.comments_count} com`:'—'),
        reacc: (x.p.likes||0).toLocaleString('en'), tono:x.tono||'',
      })) },
    narrativas:{ sub:[{t:'Cómo se '},{t:'encuadra a Pepe',b:true},{t:'.'}],
      bloques:(analysis.narrativas||[]).map(n=>({ tituloRuns:mdRuns(n.titulo,{c:n.color||'ink'}), intro:[{t:n.intro||''}],
        cards:(n.cards||[]).map(c=>({ accent:c.accent||n.color||'blue', label:c.label||'', quote:c.quote||'', meta:c.meta||'', metaIcon:c.metaIcon })) })) },
    sentimiento:{ sub:mdRuns(analysis.sentimiento_sub), paras:[ mdRuns(analysis.sentimiento) ] },
    riesgos:{ sub:[{t:'Riesgos y '},{t:'recomendaciones',b:true},{t:'.'}], bullets:(analysis.riesgos||[]).map(b=>({ lead:b.lead||'', rest:b.rest||'' })) },
    qa:{ sub:[{t:'Líneas de mensaje '},{t:'ante coyuntura',b:true},{t:'.'}],
      filas:(analysis.qa||[]).map(f=>({ tema:f.tema||'', respuesta:[ {runs:mdRuns(f.respuesta)} ] })) },
    _stats:{ piezas:chosen.length, reacciones:nReacc, comentarios:nCom, vistas:nViews },
  };
}

export async function generateEventReport({ apifyToken, aiKey, query, from, to, emit=()=>{} }){
  const dates = dateRange(from, to);
  // 1) scrapear fechas faltantes
  for(const d of dates){
    if(await hasScraped(d)){ emit({type:'info',msg:`Datos de ${d} ya en Supabase.`}); continue; }
    emit({type:'phase',msg:`Sin datos de ${d}; scrapeando con Apify...`});
    await runFullAnalysis({ apifyToken, aiKey, date:d, emit:(e)=>emit({...e,scope:'scrape'}) });
  }
  // 2) filtrar a Pepe + evento
  const kws = keywordsFrom(query);
  const posts = await fetchWindowPosts(dates);
  const pepe = p => /pepe\s*aguilar|pepeaguilar/i.test((p.text||'')+' '+(p.username||''));
  const inWin = p => dates.includes((p.published_date||'').slice(0,10));
  const owned = p => /pepeaguilar_oficial|^pepe aguilar$/i.test((p.username||'').trim());
  let cands = posts.filter(p => inWin(p) && !owned(p) && pepe(p) && kws.some(k => strip(p.text).includes(k)))
    .sort((a,b)=>reach(b)-reach(a));
  // dedup near-duplicados (misma cuenta + mismo inicio de texto)
  const seen = new Set();
  cands = cands.filter(p => { const key=(p.username||'')+'|'+strip(p.text).slice(0,30); if(seen.has(key)) return false; seen.add(key); return true; }).slice(0,18);
  emit({type:'phase',msg:`${cands.length} piezas candidatas (Pepe + "${query}").`});
  if(!cands.length) throw new Error(`No se encontraron piezas de Pepe Aguilar ligadas a "${query}" en la ventana.`);

  // 3) comentarios de las piezas top + señales de inflado
  const top = cands.slice(0,7);
  emit({type:'phase',msg:`Bajando comentarios de ${top.length} piezas top...`});
  const cmts = await scrapeCommentsForUrls({ apifyToken, items: top.map(p=>({platform:p.platform,url:p.url})), limit:300, emit });
  const commentsByUrl = {}, signalByUrl = {};
  for(const r of cmts) if(!r.error){ commentsByUrl[r.url]=r.comments; const sg=commentSignal(r.comments); if(sg) signalByUrl[r.url]=sg; }

  // 4) contexto + 5) IA (Claude Sonnet 5 primero por calidad; GLM/Gemini de respaldo)
  const ctx = await latestResumen(to);
  emit({type:'phase',msg:'Redactando el reporte con IA...'});
  const models = ['anthropic/claude-sonnet-5','z-ai/glm-5.2','google/gemini-2.5-flash'];
  const { model, analysis } = await callAI(aiKey, buildPrompt({ query, from, to, cands, commentsByUrl, signalByUrl, ctx }), models);
  emit({type:'info',msg:`Análisis generado con ${model}.`});

  // 6) mapear a data para el docx
  const data = mapToData({ query, to, analysis, cands, commentsByUrl });
  return { data, model };
}
