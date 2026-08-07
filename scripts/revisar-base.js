/**
 * revisar-base.js — Auditoría de salud de la base. No escribe nada.
 *
 * Busca lo que ensucia sin hacer ruido:
 *   1. Análisis inventados (estimación por palabras clave marcada _fallback)
 *   2. Reportes con publicaciones pero sin análisis (huecos por reintentar)
 *   3. Reportes fantasma: sin publicaciones y sin análisis
 *   4. Publicaciones duplicadas (misma URL en el mismo día)
 *   5. Análisis con sentimiento que no suma ~100
 *   6. Publicaciones sin fecha o fuera del día de su reporte
 *
 * Uso:  node scripts/revisar-base.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const log = (...m) => console.log(...m);

async function paginar(tabla, select) {
  let out = [], desde = 0;
  for (;;) {
    const { data, error } = await supabase.from(tabla).select(select).range(desde, desde + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    if (!data?.length) break;
    out = out.concat(data);
    if (data.length < 1000) break;
    desde += 1000;
  }
  return out;
}

const pct = v => { const n = Math.round(parseFloat(String(v).replace(/[^0-9.-]/g, ''))); return Number.isFinite(n) ? n : 0; };

async function main() {
  const reps = await paginar('reports', 'id,date_key,theme_key,ai_analysis,approved');
  const posts = await paginar('scraped_posts', 'id,report_id,url,published_date');
  const porReporte = {};
  for (const p of posts) (porReporte[p.report_id] ||= []).push(p);
  const rep = new Map(reps.map(r => [r.id, r]));

  log(`base: ${reps.length} reportes · ${posts.length} publicaciones · ${new Set(reps.map(r => r.date_key)).size} días\n`);
  let problemas = 0;

  // 1. Análisis inventados
  const falsos = reps.filter(r => r.ai_analysis?._fallback);
  log(`1. Análisis inventados (estimación por palabras clave): ${falsos.length}`);
  falsos.forEach(r => log(`     ${r.date_key} ${r.theme_key}`));
  problemas += falsos.length;

  // 2. Huecos: hay material pero nadie lo analizó
  const huecos = reps.filter(r => (porReporte[r.id]?.length || 0) > 0 && !r.ai_analysis);
  log(`2. Reportes con publicaciones y SIN análisis: ${huecos.length}`);
  huecos.slice(0, 20).forEach(r => log(`     ${r.date_key} ${r.theme_key} (${porReporte[r.id].length} piezas)`));
  if (huecos.length > 20) log(`     … y ${huecos.length - 20} más`);
  problemas += huecos.length;

  // 3. Reportes fantasma
  const fantasma = reps.filter(r => r.theme_key !== 'resumen' && !(porReporte[r.id]?.length) && !r.ai_analysis);
  log(`3. Reportes vacíos (sin publicaciones y sin análisis): ${fantasma.length}`);
  const porRed = {};
  fantasma.forEach(r => porRed[r.theme_key] = (porRed[r.theme_key] || 0) + 1);
  if (fantasma.length) log(`     por red: ${Object.entries(porRed).map(([k, v]) => k + ':' + v).join(' ')}`);

  // 4. URLs duplicadas dentro del mismo reporte
  let dup = 0;
  for (const [id, lista] of Object.entries(porReporte)) {
    const urls = lista.map(p => p.url).filter(Boolean);
    dup += urls.length - new Set(urls).size;
  }
  log(`4. Publicaciones duplicadas por URL en un mismo reporte: ${dup}`);
  problemas += dup;

  // 5. Sentimiento que no cuadra
  const malSuma = reps.filter(r => {
    const s = r.ai_analysis?.sentimiento;
    if (!s) return false;
    const t = pct(s.favorable) + pct(s.neutral) + pct(s.critico);
    return t > 0 && Math.abs(t - 100) > 3;
  });
  log(`5. Análisis cuyo sentimiento no suma 100: ${malSuma.length}`);
  malSuma.slice(0, 10).forEach(r => {
    const s = r.ai_analysis.sentimiento;
    log(`     ${r.date_key} ${r.theme_key}: ${pct(s.favorable)}+${pct(s.neutral)}+${pct(s.critico)} = ${pct(s.favorable) + pct(s.neutral) + pct(s.critico)}`);
  });
  problemas += malSuma.length;

  // 6. Publicaciones fuera del día de su reporte
  let fuera = 0, sinFecha = 0;
  for (const p of posts) {
    const r = rep.get(p.report_id);
    if (!r) continue;
    if (!p.published_date) { sinFecha++; continue; }
    if (String(p.published_date).slice(0, 10) !== r.date_key) fuera++;
  }
  log(`6. Publicaciones sin fecha: ${sinFecha} · con fecha distinta a la de su reporte: ${fuera}`);
  problemas += sinFecha;

  log(`\n${problemas === 0 ? 'BASE LIMPIA' : `${problemas} cosas que revisar`}`);
}

main().catch(e => { console.error('[revisar] fallo:', e); process.exit(1); });
