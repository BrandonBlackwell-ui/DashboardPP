/**
 * limpiar-base.js — Quita la basura que encontró revisar-base.js. Respalda antes.
 *
 *   1. Publicaciones duplicadas (misma URL en el mismo reporte). Conserva la copia
 *      con más comentarios extraídos; si empatan, la más antigua. Los comentarios de
 *      las copias borradas se van con ellas (si no, quedan huérfanos apuntando a nada).
 *   2. Análisis cuyo sentimiento no suma ~100: el modelo se equivocó al contar. Se
 *      borra el análisis (no la publicación) para rehacerlo; es preferible el hueco
 *      a un porcentaje que no cuadra.
 *   3. Reportes vacíos: sin publicaciones y sin análisis, no aportan nada.
 *
 * Uso:  node scripts/limpiar-base.js --dry-run     (por defecto simula)
 *       node scripts/limpiar-base.js --aplicar
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeywtloohrhyxvmxqzqe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const aplicar = process.argv.includes('--aplicar');
const log = (...m) => console.log('[limpiar]', ...m);
const pct = v => { const n = Math.round(parseFloat(String(v).replace(/[^0-9.-]/g, ''))); return Number.isFinite(n) ? n : 0; };

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

async function main() {
  const reps = await paginar('reports', 'id,date_key,theme_key,ai_analysis');
  const posts = await paginar('scraped_posts', '*');
  const comentarios = await paginar('scraped_comments', 'id,post_id');
  const comentariosPorPost = {};
  for (const c of comentarios) comentariosPorPost[c.post_id] = (comentariosPorPost[c.post_id] || 0) + 1;

  // ── 1. Duplicados ──────────────────────────────────────────────────────────
  const porRep = {};
  for (const p of posts) (porRep[p.report_id] ||= []).push(p);
  const aBorrar = [];
  for (const lista of Object.values(porRep)) {
    const grupos = {};
    for (const p of lista) { if (p.url) (grupos[p.url] ||= []).push(p); }
    for (const g of Object.values(grupos)) {
      if (g.length < 2) continue;
      // Se queda la que tiene más comentarios extraídos; en empate, la más antigua.
      g.sort((a, b) => (comentariosPorPost[b.id] || 0) - (comentariosPorPost[a.id] || 0)
        || String(a.created_at || '').localeCompare(String(b.created_at || '')));
      // Cada copia recuerda cuál sobrevive, para poder mudarle sus comentarios.
      for (const copia of g.slice(1)) aBorrar.push({ ...copia, _sobrevive: g[0].id });
    }
  }
  const comentariosAfectados = aBorrar.reduce((a, p) => a + (comentariosPorPost[p.id] || 0), 0);
  log(`1. duplicados a borrar: ${aBorrar.length} (arrastran ${comentariosAfectados} comentarios)`);

  // ── 2. Sentimiento que no cuadra ───────────────────────────────────────────
  const malSuma = reps.filter(r => {
    const s = r.ai_analysis?.sentimiento;
    if (!s) return false;
    const t = pct(s.favorable) + pct(s.neutral) + pct(s.critico);
    return t > 0 && Math.abs(t - 100) > 3;
  });
  log(`2. análisis con sentimiento imposible: ${malSuma.length}`);
  malSuma.forEach(r => {
    const s = r.ai_analysis.sentimiento;
    log(`     ${r.date_key} ${r.theme_key}: suma ${pct(s.favorable) + pct(s.neutral) + pct(s.critico)}`);
  });

  // ── 3. Reportes vacíos ─────────────────────────────────────────────────────
  const vacios = reps.filter(r => r.theme_key !== 'resumen' && !(porRep[r.id]?.length) && !r.ai_analysis);
  log(`3. reportes vacíos: ${vacios.length}`);

  if (!aplicar) { log('SIMULACIÓN — usa --aplicar para ejecutar'); return; }

  // Respaldo antes de borrar nada.
  const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  fs.mkdirSync('respaldo-limpieza', { recursive: true });
  const archivo = `respaldo-limpieza/limpieza-${sello}.json`;
  fs.writeFileSync(archivo, JSON.stringify({
    duplicados: aBorrar,
    comentarios: comentarios.filter(c => aBorrar.some(p => p.id === c.post_id)),
    analisis_borrados: malSuma.map(r => ({ id: r.id, date_key: r.date_key, theme_key: r.theme_key, ai_analysis: r.ai_analysis })),
    reportes_vacios: vacios,
  }, null, 2), 'utf8');
  log(`respaldo en ${archivo}`);

  const enLotes = async (ids, fn, tam = 100) => {
    for (let i = 0; i < ids.length; i += tam) await fn(ids.slice(i, i + tam));
  };

  if (aBorrar.length) {
    // Los comentarios de las copias se MUEVEN a la que sobrevive: son la materia
    // prima que cita el análisis y se scrapearon en momentos distintos, así que cada
    // copia puede traer comentarios que las otras no. Se descartan solo los repetidos.
    const textoDe = new Map(); // post que sobrevive → set de textos que ya tiene
    let movidos = 0, repetidos = 0;
    for (const p of aBorrar) {
      const sobrevive = p._sobrevive;
      if (!sobrevive) continue;
      const { data: suyos } = await supabase.from('scraped_comments').select('id,text').eq('post_id', p.id);
      if (!suyos?.length) continue;
      if (!textoDe.has(sobrevive)) {
        const { data: yaTiene } = await supabase.from('scraped_comments').select('text').eq('post_id', sobrevive);
        textoDe.set(sobrevive, new Set((yaTiene || []).map(c => String(c.text || '').trim())));
      }
      const conocidos = textoDe.get(sobrevive);
      for (const c of suyos) {
        const t = String(c.text || '').trim();
        if (conocidos.has(t)) { await supabase.from('scraped_comments').delete().eq('id', c.id); repetidos++; continue; }
        await supabase.from('scraped_comments').update({ post_id: sobrevive }).eq('id', c.id);
        conocidos.add(t); movidos++;
      }
    }
    log(`comentarios: ${movidos} movidos a la copia que se queda, ${repetidos} repetidos descartados`);
    const ids = aBorrar.map(p => p.id);
    await enLotes(ids, async lote => { await supabase.from('scraped_posts').delete().in('id', lote); });
    log(`borrados ${ids.length} duplicados`);
  }
  for (const r of malSuma) {
    await supabase.from('reports').update({ ai_analysis: null, approved: false }).eq('id', r.id);
  }
  if (malSuma.length) log(`${malSuma.length} análisis borrados: quedan como hueco para rehacer`);
  if (vacios.length) {
    await supabase.from('reports').delete().in('id', vacios.map(r => r.id));
    log(`${vacios.length} reportes vacíos borrados`);
  }
  log('listo');
}

main().catch(e => { console.error('[limpiar] fallo:', e); process.exit(1); });
