/**
 * backfill.js — Rellena los días incompletos o caídos del análisis diario.
 *
 * Corre el MISMO pipeline que el cron, pero para fechas pasadas y de a una por vez
 * (en paralelo se rebasa el límite de memoria de Apify y fallan los actores).
 *
 * Uso:
 *   node scripts/backfill.js --plan                 → qué días faltan y por qué, sin gastar
 *   node scripts/backfill.js --dias=2026-08-01,2026-08-02
 *   node scripts/backfill.js --solo=sin_redes       → una categoría completa
 *   node scripts/backfill.js --solo=parcial --limite=5
 *
 * Categorías:
 *   sin_reporte  el análisis no corrió ese día (no hay ni una fila)
 *   sin_redes    corrió pero ninguna red social entró (Apify caído)
 *   parcial      entraron 1 o 2 redes de 4
 *   migrado      solo existe un resumen importado, sin desglose ni piezas
 *
 * Salvaguardas:
 *   - STRICT_DATE=1: una pieza sin fecha demostrable NO se guarda. Sin esto, el
 *     scraper devuelve lo que encuentra hoy y entraría fechado en julio.
 *   - Respaldo en disco del ai_analysis de cada día ANTES de tocarlo (los resúmenes
 *     migrados de junio son irrecuperables si se sobrescriben).
 *   - Marca cada reporte tocado con _backfill: lo que se recupera hoy trae el
 *     engagement acumulado hasta hoy, no el que tenía ese día.
 *   - Se detiene sola si Apify responde que se acabó la cuota.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { runFullAnalysis } from './run-full-analysis.js';

process.env.STRICT_DATE = '1';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const REDES_SOCIALES = ['facebook', 'instagram', 'x', 'tiktok'];
const RESPALDO_DIR = process.env.BACKFILL_RESPALDO || 'backfill-respaldo';

const arg = (name, def = null) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : (process.argv.includes(`--${name}`) ? true : def);
};
const log = (...m) => console.log(`[backfill]`, ...m);

// ─── Diagnóstico de cobertura ────────────────────────────────────────────────
async function coberturaActual() {
  const paginar = async (tabla, select, extra = '') => {
    let out = [], desde = 0;
    for (;;) {
      const { data, error } = await supabase.from(tabla).select(select).range(desde, desde + 999)
        .order('id', { ascending: true });
      if (error) throw new Error(`${tabla}: ${error.message}`);
      if (!data?.length) break;
      out = out.concat(data);
      if (data.length < 1000) break;
      desde += 1000;
    }
    return out;
  };

  const reports = await paginar('reports', 'id,date_key,theme_key,approved,ai_analysis');
  const posts = await paginar('scraped_posts', 'id,report_id');
  const nPosts = {};
  for (const p of posts) nPosts[p.report_id] = (nPosts[p.report_id] || 0) + 1;

  const dias = {};
  for (const r of reports) {
    const d = dias[r.date_key] ||= { fecha: r.date_key, redes: {}, migrado: false, reportes: 0 };
    d.redes[r.theme_key] = (d.redes[r.theme_key] || 0) + (nPosts[r.id] || 0);
    d.reportes++;
    if (r.ai_analysis?._fuente === 'historico-migrado') d.migrado = true;
  }
  return dias;
}

function clasificar(dias, desde, hasta) {
  const out = [];
  const ini = new Date(desde + 'T12:00:00Z'), fin = new Date(hasta + 'T12:00:00Z');
  for (let d = new Date(ini); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
    const fecha = d.toISOString().slice(0, 10);
    const info = dias[fecha];
    if (!info) { out.push({ fecha, categoria: 'sin_reporte', detalle: 'no corrió' }); continue; }
    if (info.migrado) { out.push({ fecha, categoria: 'migrado', detalle: 'solo resumen importado' }); continue; }
    const conDatos = REDES_SOCIALES.filter(r => (info.redes[r] || 0) > 0);
    if (!conDatos.length) out.push({ fecha, categoria: 'sin_redes', detalle: 'ninguna red social' });
    else if (conDatos.length < 3) out.push({ fecha, categoria: 'parcial', detalle: `solo ${conDatos.join(', ')}` });
  }
  return out;
}

// ─── Respaldo y marcado ──────────────────────────────────────────────────────
async function respaldar(fecha) {
  const { data, error } = await supabase.from('reports')
    .select('id,date_key,theme_key,approved,ai_analysis,admin_rationale').eq('date_key', fecha);
  if (error) throw new Error(`respaldo ${fecha}: ${error.message}`);
  if (!data?.length) return 0;
  fs.mkdirSync(RESPALDO_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESPALDO_DIR, `${fecha}.json`), JSON.stringify(data, null, 2), 'utf8');
  return data.length;
}

// Deja constancia en el propio dato: quien lea este día tiene que saber que las
// métricas se capturaron después, no ese día.
async function marcarBackfill(fecha) {
  const { data } = await supabase.from('reports').select('id,ai_analysis').eq('date_key', fecha);
  let n = 0;
  for (const r of data || []) {
    if (!r.ai_analysis) continue;
    const ai = {
      ...r.ai_analysis,
      _backfill: {
        recuperado: new Date().toISOString().slice(0, 10),
        nota: 'Día recuperado después de la fecha. Las métricas (likes, views, comentarios) son las acumuladas al momento de la recuperación, no las que tenía ese día; no las compares de igual a igual con días capturados en vivo.',
      },
    };
    const { error } = await supabase.from('reports').update({ ai_analysis: ai }).eq('id', r.id);
    if (!error) n++;
  }
  return n;
}

// ─── Corrida de un día ───────────────────────────────────────────────────────
const esCuotaAgotada = (e) => /monthly usage hard limit|platform-feature-disabled|402|403/i.test(String(e?.message || e));

async function rellenarDia(fecha, { apifyToken, aiKey }) {
  const t0 = Date.now();
  const nRespaldo = await respaldar(fecha);
  log(`${fecha} · respaldados ${nRespaldo} reportes → ${RESPALDO_DIR}/${fecha}.json`);

  const errores = [];
  const emit = (ev) => {
    if (ev.type === 'saved') log(`${fecha} ·   ${ev.net}: ${ev.count} publicaciones`);
    if (ev.type === 'error') { errores.push(ev.msg); log(`${fecha} ·   ERROR ${String(ev.msg).slice(0, 120)}`); }
  };

  const resumen = await runFullAnalysis({ apifyToken, aiKey, date: fecha, emit });
  const marcados = await marcarBackfill(fecha);

  const guardados = Object.entries(resumen.posts || {})
    .filter(([, v]) => v?.count > 0)
    .map(([k, v]) => `${k}:${v.count}`);
  const cuota = errores.some(esCuotaAgotada);
  log(`${fecha} · listo en ${Math.round((Date.now() - t0) / 1000)}s | ${guardados.join(' ') || 'NADA NUEVO'} | ${marcados} reportes marcados`);
  return { fecha, guardados, errores, cuota, segundos: Math.round((Date.now() - t0) / 1000) };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const desde = arg('desde', '2026-06-01');
  // Hasta ayer: el día de hoy lo analiza el cron mañana (corre con un día de desfase),
  // así que no es un hueco — todavía no le toca.
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const hasta = arg('hasta', ayer);
  const dias = await coberturaActual();
  const pendientes = clasificar(dias, desde, hasta);

  if (arg('plan')) {
    const porCat = {};
    for (const p of pendientes) (porCat[p.categoria] ||= []).push(p.fecha);
    log(`ventana ${desde} → ${hasta}`);
    for (const [cat, fechas] of Object.entries(porCat)) {
      log(`${cat.padEnd(12)} ${String(fechas.length).padStart(3)} días: ${fechas.join(', ')}`);
    }
    log(`TOTAL a rellenar: ${pendientes.length} días`);
    return;
  }

  const apifyToken = process.env.APIFY_TOKEN;
  const aiKey = process.env.OPENROUTER_API_KEY;
  if (!apifyToken) throw new Error('Falta APIFY_TOKEN en el entorno.');
  if (!aiKey) throw new Error('Falta OPENROUTER_API_KEY en el entorno.');

  let objetivo = pendientes;
  const soloDias = arg('dias');
  if (soloDias) {
    const set = new Set(String(soloDias).split(',').map(s => s.trim()));
    objetivo = [...set].map(f => pendientes.find(p => p.fecha === f) || { fecha: f, categoria: 'manual', detalle: 'pedido a mano' });
  } else if (arg('solo')) {
    const cats = new Set(String(arg('solo')).split(',').map(s => s.trim()));
    objetivo = pendientes.filter(p => cats.has(p.categoria));
  }
  const limite = Number(arg('limite', 0));
  if (limite > 0) objetivo = objetivo.slice(0, limite);

  log(`voy a rellenar ${objetivo.length} días: ${objetivo.map(o => o.fecha).join(', ')}`);
  const resultados = [];
  for (const [i, dia] of objetivo.entries()) {
    log(`── ${i + 1}/${objetivo.length} · ${dia.fecha} (${dia.categoria}: ${dia.detalle}) ──`);
    try {
      const r = await rellenarDia(dia.fecha, { apifyToken, aiKey });
      resultados.push({ ...r, categoria: dia.categoria });
      // Sin cuota no tiene sentido seguir quemando días: cada uno saldría vacío.
      if (r.cuota) { log('APIFY SIN CUOTA — me detengo para no llenar días vacíos.'); break; }
    } catch (e) {
      log(`${dia.fecha} · FALLÓ: ${e?.message || e}`);
      resultados.push({ fecha: dia.fecha, error: String(e?.message || e) });
      if (esCuotaAgotada(e)) { log('APIFY SIN CUOTA — me detengo.'); break; }
    }
  }

  log('═══ RESUMEN ═══');
  for (const r of resultados) {
    log(`${r.fecha} ${r.error ? 'ERROR: ' + r.error.slice(0, 90) : (r.guardados?.join(' ') || 'sin datos nuevos')}`);
  }
  const conDatos = resultados.filter(r => r.guardados?.length).length;
  log(`${conDatos}/${resultados.length} días con datos nuevos.`);
}

main().catch(e => { console.error('[backfill] fallo:', e); process.exit(1); });
