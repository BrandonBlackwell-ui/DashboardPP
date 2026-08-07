/**
 * reanalizar-lote.js — Corre el análisis de IA de varios días, uno por uno, contra
 * el servidor desplegado (que ya tiene la llave de OpenRouter). Así el grueso del
 * relleno no necesita traer credenciales a esta máquina.
 *
 * Uso:
 *   node scripts/reanalizar-lote.js --plan              qué días faltan y cuáles se desaprobarían
 *   node scripts/reanalizar-lote.js --correr
 *   node scripts/reanalizar-lote.js --correr --limite=5
 *   node scripts/reanalizar-lote.js --correr --dias=2026-07-18,2026-08-01
 *
 * Antes de tocar un día guarda su ai_analysis en respaldo-ia/<fecha>.json. Los
 * resúmenes migrados de junio no se pueden regenerar si se pisan sin copia.
 *
 * OJO: reanalizar un día lo deja como BORRADOR (approved=false). Es correcto —sus
 * datos cambiaron— pero hay que volver a aprobarlo para que el cliente lo vea.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SERVIDOR = process.env.ANALIZAR_SERVER || 'https://dashboardpp-production.up.railway.app';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const RESPALDO = 'respaldo-ia';

const arg = (n, d = null) => {
  const h = process.argv.find(a => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : (process.argv.includes(`--${n}`) ? true : d);
};
const log = (...m) => console.log('[reanalizar]', ...m);

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

// Días con publicaciones guardadas pero sin análisis en alguna de sus redes.
async function diasPendientes() {
  const reps = await paginar('reports', 'id,date_key,theme_key,ai_analysis,approved');
  const posts = await paginar('scraped_posts', 'report_id');
  const n = {};
  for (const p of posts) n[p.report_id] = (n[p.report_id] || 0) + 1;

  const dias = {};
  for (const r of reps) {
    const d = dias[r.date_key] ||= { fecha: r.date_key, faltan: [], aprobados: 0, migrado: false };
    if (r.approved) d.aprobados++;
    if (r.ai_analysis?._fuente === 'historico-migrado') d.migrado = true;
  }
  for (const r of reps) {
    if (r.theme_key === 'resumen') continue;
    if ((n[r.id] || 0) > 0 && !r.ai_analysis) dias[r.date_key].faltan.push(r.theme_key);
  }
  return Object.values(dias).filter(d => d.faltan.length).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
}

async function respaldar(fecha) {
  const { data } = await supabase.from('reports')
    .select('id,date_key,theme_key,approved,ai_analysis,admin_rationale').eq('date_key', fecha);
  if (!data?.length) return 0;
  fs.mkdirSync(RESPALDO, { recursive: true });
  fs.writeFileSync(path.join(RESPALDO, `${fecha}.json`), JSON.stringify(data, null, 2), 'utf8');
  return data.length;
}

// El endpoint responde SSE: se lee el stream hasta que cierra.
// `redes` limita qué se analiza: nunca se reescribe una red que ya tenía análisis.
async function reanalizarDia(fecha, redes) {
  const t0 = Date.now();
  const q = redes?.length ? `&redes=${redes.join(',')}` : '';
  const res = await fetch(`${SERVIDOR}/reanalizar?date=${fecha}${q}`);
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
  const lector = res.body.getReader();
  const dec = new TextDecoder();
  let buffer = '', hechos = [], errores = [];
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const partes = buffer.split('\n\n');
    buffer = partes.pop() || '';
    for (const p of partes) {
      const linea = p.split('\n').find(l => l.startsWith('data: '));
      if (!linea) continue;
      let ev; try { ev = JSON.parse(linea.slice(6)); } catch { continue; }
      if (ev.type === 'ai_done') {
        const s = ev.result?.sentimiento;
        hechos.push(`${ev.net}${s ? `(${s.favorable}/${s.critico})` : ''}`);
      }
      if (ev.type === 'error') errores.push(ev.msg);
    }
  }
  return { hechos, errores, seg: Math.round((Date.now() - t0) / 1000) };
}

async function main() {
  const pendientes = await diasPendientes();

  if (arg('plan') || !arg('correr')) {
    const aprobados = pendientes.filter(d => d.aprobados > 0);
    log(`${pendientes.length} días con publicaciones sin analizar`);
    log(`redes por analizar: ${pendientes.reduce((a, d) => a + d.faltan.length, 0)}`);
    // Solo se desaprueba lo que se toca: las redes que faltaban y el panorama. Las
    // redes que ya estaban analizadas y aprobadas se quedan como están.
    log(`quedarán como borrador: las ${pendientes.reduce((a, d) => a + d.faltan.length, 0)} redes nuevas + el panorama de cada día`);
    log(`${aprobados.length} de estos días tienen redes ya aprobadas, que NO se tocan`);
    log(`${pendientes.filter(d => d.migrado).length} tienen resumen migrado (se respalda antes de pisarlo)`);
    for (const d of pendientes) log(`  ${d.fecha}  faltan: ${d.faltan.join(', ')}`);
    return;
  }

  let objetivo = pendientes;
  if (arg('dias')) {
    const set = new Set(String(arg('dias')).split(',').map(s => s.trim()));
    objetivo = pendientes.filter(d => set.has(d.fecha));
  }
  const limite = Number(arg('limite', 0));
  if (limite > 0) objetivo = objetivo.slice(0, limite);

  log(`servidor: ${SERVIDOR}`);
  log(`voy a completar ${objetivo.length} días, uno por uno (solo las redes que faltan + panorama)`);
  let ok = 0, fallos = 0;
  for (const [i, d] of objetivo.entries()) {
    const nResp = await respaldar(d.fecha);
    try {
      const r = await reanalizarDia(d.fecha, d.faltan);
      log(`${i + 1}/${objetivo.length} ${d.fecha} · ${r.seg}s · respaldo ${nResp} · ${r.hechos.join(' ') || 'sin resultados'}${r.errores.length ? ` · ERRORES: ${r.errores.slice(0, 2).join('; ').slice(0, 120)}` : ''}`);
      ok++;
    } catch (e) {
      log(`${i + 1}/${objetivo.length} ${d.fecha} · FALLÓ: ${String(e.message).slice(0, 140)}`);
      fallos++;
    }
  }
  log(`listo: ${ok} días analizados, ${fallos} con problemas.`);
  log('recuerda re-aprobar en el dashboard: los días reanalizados quedan como borrador.');
}

main().catch(e => { console.error('[reanalizar] fallo:', e); process.exit(1); });
