/**
 * marcar-backfill.js — Deja constancia de qué se recuperó después de la fecha.
 *
 * Un día rellenado NO es comparable con uno capturado en vivo:
 *   - sus métricas (likes, views, comentarios) son las acumuladas al momento de
 *     recuperarlo, no las que tenía ese día;
 *   - trae menos piezas, porque la búsqueda de hoy favorece lo reciente.
 * Sin esta marca, en tres meses nadie puede distinguirlos y el asistente los
 * compara de igual a igual.
 *
 * Marca por REPORTE (no por día): solo los que recibieron piezas recuperadas, con
 * cuántas. El panorama del día se marca si alguna de sus redes lo está.
 *
 * Uso:  node scripts/marcar-backfill.js --desde=2026-08-07 [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const arg = (n, d = null) => {
  const h = process.argv.find(a => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : (process.argv.includes(`--${n}`) ? true : d);
};
const log = (...m) => console.log('[marcar]', ...m);

const NOTA_RED = 'Piezas recuperadas después de la fecha: sus métricas son las acumuladas al momento del rescate, no las de ese día, y la muestra es más chica que la de un día capturado en vivo. No compares sus cifras de igual a igual con otros días.';
const NOTA_DIA = 'Día reconstruido: parte de sus publicaciones se recuperaron después de la fecha. El sentimiento es válido como lectura de lo que se dijo, pero el volumen y las métricas no son comparables con un día capturado en vivo.';

async function paginar(tabla, select, filtro = '') {
  let out = [], desde = 0;
  for (;;) {
    let q = supabase.from(tabla).select(select).range(desde, desde + 999);
    if (filtro) q = q.gte('created_at', filtro);
    const { data, error } = await q;
    if (error) throw new Error(`${tabla}: ${error.message}`);
    if (!data?.length) break;
    out = out.concat(data);
    if (data.length < 1000) break;
    desde += 1000;
  }
  return out;
}

async function main() {
  const desde = arg('desde', new Date().toISOString().slice(0, 10));
  const dryRun = !!arg('dry-run');

  // Publicaciones guardadas a partir de la fecha del rescate.
  const recuperadas = await paginar('scraped_posts', 'id,report_id,created_at', desde);
  if (!recuperadas.length) { log(`no hay publicaciones guardadas desde ${desde}`); return; }
  const porReporte = {};
  for (const p of recuperadas) porReporte[p.report_id] = (porReporte[p.report_id] || 0) + 1;
  log(`${recuperadas.length} publicaciones recuperadas en ${Object.keys(porReporte).length} reportes`);

  const { data: reps } = await supabase.from('reports')
    .select('id,date_key,theme_key,ai_analysis').in('id', Object.keys(porReporte));
  const diasTocados = new Set((reps || []).map(r => r.date_key));

  let redes = 0, panoramas = 0;
  for (const r of reps || []) {
    if (!r.ai_analysis) continue;
    const ai = { ...r.ai_analysis, _backfill: { recuperado: desde, piezas_recuperadas: porReporte[r.id], nota: NOTA_RED } };
    if (!dryRun) await supabase.from('reports').update({ ai_analysis: ai }).eq('id', r.id);
    redes++;
  }

  // El panorama del día hereda la advertencia: se calculó con esas piezas.
  const { data: resumenes } = await supabase.from('reports')
    .select('id,date_key,ai_analysis').eq('theme_key', 'resumen').in('date_key', [...diasTocados]);
  for (const r of resumenes || []) {
    if (!r.ai_analysis) continue;
    const ai = { ...r.ai_analysis, _backfill: { recuperado: desde, nota: NOTA_DIA } };
    if (!dryRun) await supabase.from('reports').update({ ai_analysis: ai }).eq('id', r.id);
    panoramas++;
  }

  log(`${dryRun ? '[SIMULACIÓN] ' : ''}marcados ${redes} reportes por red y ${panoramas} panoramas, en ${diasTocados.size} días`);
}

main().catch(e => { console.error('[marcar] fallo:', e); process.exit(1); });
