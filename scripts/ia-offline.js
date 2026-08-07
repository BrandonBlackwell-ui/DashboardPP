/**
 * ia-offline.js — Aplica análisis escritos fuera de OpenRouter.
 *
 * Flujo:
 *   1. El backfill corre con AI_MODE=archivo → deja los prompts en ia-pendiente/
 *      con nombre <fecha>__<red>.json  (ej. 2026-08-01__tiktok.json)
 *   2. El analista los contesta y guarda el JSON del análisis en ia-respuestas/
 *      con EL MISMO nombre.
 *   3. Este script los valida, normaliza igual que el pipeline y los guarda.
 *
 * Uso:
 *   node scripts/ia-offline.js --pendientes          qué falta contestar
 *   node scripts/ia-offline.js --aplicar             sube todo lo contestado
 *   node scripts/ia-offline.js --aplicar --dry-run   valida sin escribir
 *   node scripts/ia-offline.js --panoramas           genera los prompts de panorama
 *                                                    de los días que ya tienen sus redes
 *
 * El panorama va aparte porque su prompt se construye a partir de los análisis por
 * red ya guardados: primero se aplican las redes, después se pide el panorama.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DIR_PENDIENTES = process.env.IA_PENDIENTES_DIR || 'ia-pendiente';
const DIR_RESPUESTAS = process.env.IA_RESPUESTAS_DIR || 'ia-respuestas';

const tiene = f => process.argv.includes(`--${f}`);
const log = (...m) => console.log('[ia-offline]', ...m);
const listar = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')) : [];

// ─── Normalización idéntica a la del pipeline ────────────────────────────────
const toInt = v => { const n = Math.round(parseFloat(String(v).replace(/[^0-9.-]/g, ''))); return Number.isFinite(n) ? n : 0; };
const fixSent = s => (s && typeof s === 'object')
  ? { favorable: toInt(s.favorable), neutral: toInt(s.neutral), critico: toInt(s.critico) }
  : s;

function normalizar(analysis) {
  const a = { ...analysis };
  if (a.sentimiento) a.sentimiento = fixSent(a.sentimiento);
  if (a.desglose_por_red) {
    for (const k of Object.keys(a.desglose_por_red)) {
      if (a.desglose_por_red[k]?.sentimiento) a.desglose_por_red[k].sentimiento = fixSent(a.desglose_por_red[k].sentimiento);
    }
  }
  if (a.comparativa_historica) {
    a.comparativa_historica.delta_favorable = toInt(a.comparativa_historica.delta_favorable);
    a.comparativa_historica.delta_critico = toInt(a.comparativa_historica.delta_critico);
  }
  return a;
}

// Las métricas de las voces NO se le creen al analista: se recalculan de los posts
// reales, igual que hace el pipeline. Un nombre puede venir del texto; su alcance no.
async function enriquecerVoces(analysis, reportId, dateKey, themeKey) {
  const q = themeKey === 'resumen'
    ? supabase.from('reports').select('id').eq('date_key', dateKey).neq('theme_key', 'resumen')
    : null;
  let ids = [reportId];
  if (q) { const { data } = await q; ids = (data || []).map(r => r.id); }
  if (!ids.length) return analysis;
  const { data: posts } = await supabase.from('scraped_posts')
    .select('username,likes,comments_count,views,followers').in('report_id', ids);
  const m = {};
  for (const p of posts || []) {
    const k = (p.username || '').toLowerCase().replace(/^@/, '');
    if (!k) continue;
    m[k] ||= { likes: 0, comments: 0, views: 0, followers: 0 };
    m[k].likes += +(p.likes || 0);
    m[k].comments += +(p.comments_count || 0);
    m[k].views += +(p.views || 0);
    m[k].followers = Math.max(m[k].followers, +(p.followers || 0));
  }
  const enrich = v => {
    const x = m[(v.username || '').toLowerCase().replace(/^@/, '')] || {};
    return { ...v, followers: x.followers || v.followers || 0, likes: x.likes || v.likes || 0,
      engagement: Math.round((x.likes || 0) + (x.comments || 0) * 2 + (x.views || 0) * 0.01) || v.engagement || 0 };
  };
  if (analysis.analisis_voces?.aliados_destacados) analysis.analisis_voces.aliados_destacados = analysis.analisis_voces.aliados_destacados.map(enrich);
  if (analysis.analisis_voces?.criticos_destacados) analysis.analisis_voces.criticos_destacados = analysis.analisis_voces.criticos_destacados.map(enrich);
  return analysis;
}

function validar(etiqueta, analysis) {
  const problemas = [];
  if (!analysis || typeof analysis !== 'object') return ['no es un objeto JSON'];
  const s = analysis.sentimiento;
  if (!s) problemas.push('falta sentimiento');
  else {
    const suma = toInt(s.favorable) + toInt(s.neutral) + toInt(s.critico);
    if (Math.abs(suma - 100) > 2) problemas.push(`el sentimiento suma ${suma}, no 100`);
  }
  if (!analysis.nivel_riesgo) problemas.push('falta nivel_riesgo');
  else if (!['muy_bajo','bajo','medio','alto','muy_alto'].includes(analysis.nivel_riesgo))
    problemas.push(`nivel_riesgo inválido: ${analysis.nivel_riesgo}`);
  if (!analysis.resumen_ejecutivo) problemas.push('falta resumen_ejecutivo');
  return problemas;
}

// ─── Comandos ────────────────────────────────────────────────────────────────
function pendientes() {
  const pend = listar(DIR_PENDIENTES).map(f => f.replace(/\.json$/, ''));
  const resp = new Set(listar(DIR_RESPUESTAS).map(f => f.replace(/\.json$/, '')));
  const faltan = pend.filter(p => !resp.has(p));
  const porDia = {};
  for (const p of faltan) { const [d, t] = p.split('__'); (porDia[d] ||= []).push(t); }
  log(`${pend.length} prompts generados · ${resp.size} contestados · ${faltan.length} pendientes`);
  for (const d of Object.keys(porDia).sort()) log(`  ${d}: ${porDia[d].join(', ')}`);
  if (!faltan.length && pend.length) log('todo contestado — corre --aplicar');
  return faltan;
}

async function aplicar({ dryRun }) {
  const resp = listar(DIR_RESPUESTAS);
  if (!resp.length) { log(`no hay nada en ${DIR_RESPUESTAS}/`); return; }
  let ok = 0, fallos = 0;
  for (const archivo of resp.sort()) {
    const etiqueta = archivo.replace(/\.json$/, '');
    const [dateKey, themeKey] = etiqueta.split('__');
    if (!dateKey || !themeKey) { log(`SALTO ${archivo}: el nombre debe ser <fecha>__<red>.json`); fallos++; continue; }

    let analysis;
    try { analysis = JSON.parse(fs.readFileSync(path.join(DIR_RESPUESTAS, archivo), 'utf8')); }
    catch (e) { log(`ERROR ${etiqueta}: JSON inválido (${e.message})`); fallos++; continue; }

    const problemas = validar(etiqueta, analysis);
    if (problemas.length) { log(`ERROR ${etiqueta}: ${problemas.join('; ')}`); fallos++; continue; }

    const { data: rep } = await supabase.from('reports').select('id')
      .eq('date_key', dateKey).eq('theme_key', themeKey).limit(1);
    if (!rep?.length) { log(`ERROR ${etiqueta}: no existe el reporte en la base`); fallos++; continue; }

    let final = normalizar(analysis);
    final = await enriquecerVoces(final, rep[0].id, dateKey, themeKey);
    final._analista = 'offline';   // no lo generó un modelo vía OpenRouter

    if (dryRun) { log(`OK (simulado) ${etiqueta}: ${JSON.stringify(final.sentimiento)} riesgo ${final.nivel_riesgo}`); ok++; continue; }
    const { error } = await supabase.from('reports')
      .update({ ai_analysis: final, approved: false }).eq('id', rep[0].id);
    if (error) { log(`ERROR ${etiqueta}: ${error.message}`); fallos++; continue; }
    log(`aplicado ${etiqueta}: ${JSON.stringify(final.sentimiento)} riesgo ${final.nivel_riesgo}`);
    ok++;
  }
  log(`${ok} aplicados, ${fallos} con problemas.${dryRun ? ' (simulación: no se escribió nada)' : ''}`);
}

// Genera los prompts de panorama de los días cuyas redes ya están analizadas.
async function panoramas() {
  process.env.AI_MODE = 'archivo';
  const { runAIOnly } = await import('./run-full-analysis.js');
  const dias = [...new Set(listar(DIR_RESPUESTAS).map(f => f.split('__')[0]))].sort();
  if (!dias.length) { log('primero aplica los análisis por red'); return; }
  for (const dia of dias) {
    const { data: reps } = await supabase.from('reports')
      .select('theme_key,ai_analysis').eq('date_key', dia);
    const redes = (reps || []).filter(r => r.theme_key !== 'resumen');
    const sinAnalisis = redes.filter(r => !r.ai_analysis).map(r => r.theme_key);
    if (sinAnalisis.length) { log(`${dia}: faltan ${sinAnalisis.join(', ')} — lo salto`); continue; }
    const yaTiene = (reps || []).find(r => r.theme_key === 'resumen')?.ai_analysis;
    if (yaTiene) { log(`${dia}: el panorama ya está`); continue; }
    log(`${dia}: generando prompt de panorama...`);
    await runAIOnly({ aiKey: 'no-usada-en-modo-archivo', date: dia, emit: () => {} });
  }
  log('listo — revisa ia-pendiente/ por los <fecha>__resumen.json');
}

const main = async () => {
  if (tiene('pendientes')) return pendientes();
  if (tiene('panoramas')) return panoramas();
  if (tiene('aplicar')) return aplicar({ dryRun: tiene('dry-run') });
  log('usa --pendientes | --aplicar [--dry-run] | --panoramas');
};

main().catch(e => { console.error('[ia-offline] fallo:', e); process.exit(1); });
