/**
 * cosecha.js — Relleno histórico por RED, no por día.
 *
 * Los actores devuelven varios días en una sola corrida, así que pedir 58 días por
 * separado es pagar 58 veces por datos que vienen juntos. Aquí se hacen pocas
 * cosechas grandes, se guardan en disco, y después se reparte cada pieza al día que
 * le toca por su fecha real.
 *
 * Medido el 2026-08-07 contra el 1 de agosto:
 *   facebook  ventana de 4 días → 51 piezas, 14 del día objetivo   ($0.15, el caro)
 *   x         start/end          → 47 piezas, 7 del día            ($0.02)
 *   instagram until=fecha        → 23 piezas, 3 del día            ($0.02)
 *   tiktok    datePosted=3months → 40 piezas, alcanza al 15 de jun ($0.00)
 *
 * Uso:
 *   node scripts/cosecha.js --cosechar --red=tiktok
 *   node scripts/cosecha.js --cosechar --red=todas --desde=2026-06-01 --hasta=2026-08-06
 *   node scripts/cosecha.js --repartir                    reparte lo ya descargado
 *   node scripts/cosecha.js --repartir --dry-run          dice qué haría, sin escribir
 *
 * La cosecha guarda crudo en cosecha/<red>-<sello>.json. Repartir NO vuelve a pagar:
 * lee de disco. Si algo sale mal al repartir, se corrige y se reparte otra vez.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  normX, normFacebook, normInstagram, normTikTok,
  upsertReport, insertPosts, dayStartTs,
} from './run-full-analysis.js';

process.env.STRICT_DATE = '1'; // sin fecha demostrable, la pieza no entra

const DIR = process.env.COSECHA_DIR || 'cosecha';
const arg = (n, def = null) => {
  const hit = process.argv.find(a => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : (process.argv.includes(`--${n}`) ? true : def);
};
const log = (...m) => console.log('[cosecha]', ...m);
const dormir = ms => new Promise(r => setTimeout(r, ms));

function token() {
  const archivo = '.env.backfill';
  if (!fs.existsSync(archivo)) throw new Error('falta .env.backfill con APIFY_TOKEN');
  const t = fs.readFileSync(archivo, 'utf8').split(/\r?\n/)
    .filter(l => !l.trim().startsWith('#'))
    .map(l => (l.match(/^\s*APIFY_TOKEN\s*=\s*(\S+)\s*$/) || [])[1]).find(Boolean);
  if (!t) throw new Error('APIFY_TOKEN vacío en .env.backfill');
  return t;
}

// Lanza y hace polling: una conexión cortada no tira el trabajo ya pagado.
async function correrActor(TOKEN, actor, input, cap, etiqueta) {
  const id = actor.replace('/', '~');
  log(`${etiqueta}: lanzando ${actor} (tope $${cap})`);
  const res = await fetch(`https://api.apify.com/v2/acts/${id}/runs?token=${TOKEN}&maxTotalChargeUsd=${cap}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error(`${actor} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let run = (await res.json()).data;
  for (let i = 0; i < 120 && ['READY', 'RUNNING'].includes(run.status); i++) {
    await dormir(5000);
    try {
      run = (await (await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${TOKEN}`)).json()).data;
    } catch { /* red intermitente: se reintenta */ }
  }
  const items = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${TOKEN}&limit=1000&clean=true`)).json();
  const lista = Array.isArray(items) ? items : [];
  // ABORTED = topó el límite de gasto, pero lo descargado hasta ahí sirve.
  log(`${etiqueta}: ${run.status} · ${lista.length} piezas · $${(run.usageTotalUsd || 0).toFixed(3)}`);
  return { items: lista, costo: run.usageTotalUsd || 0, estado: run.status };
}

// Ventanas de N días para Facebook: su filtro de fechas es poroso (devuelve piezas
// de 2024 en una ventana de agosto) y cobra por traerlas, así que se pide de a poco.
function ventanas(desde, hasta, dias) {
  const out = [];
  let d = new Date(desde + 'T12:00:00Z');
  const fin = new Date(hasta + 'T12:00:00Z');
  while (d <= fin) {
    const ini = d.toISOString().slice(0, 10);
    const f = new Date(d); f.setUTCDate(f.getUTCDate() + dias - 1);
    out.push({ desde: ini, hasta: (f > fin ? fin : f).toISOString().slice(0, 10) });
    d.setUTCDate(d.getUTCDate() + dias);
  }
  return out;
}

async function cosechar({ red, desde, hasta }) {
  const TOKEN = token();
  fs.mkdirSync(DIR, { recursive: true });
  const guardar = (nombre, datos, meta) => {
    const archivo = path.join(DIR, `${nombre}.json`);
    fs.writeFileSync(archivo, JSON.stringify({ meta, items: datos }, null, 2), 'utf8');
    log(`guardado ${archivo} (${datos.length} piezas)`);
  };
  let gasto = 0;

  if (red === 'tiktok' || red === 'todas') {
    // Sin fechas: solo ventanas relativas. 3months alcanza a mediados de junio.
    const r = await correrActor(TOKEN, 'sentry/tiktok-search-api', {
      keywords: ['Pepe Aguilar', 'los Aguilar'], maxVideosPerKeyword: 500, maxVideosTotal: 1000,
      sortOrder: 'mostRecent', datePosted: '3months', includePhotoPosts: false,
    }, 0.60, 'tiktok');
    gasto += r.costo; guardar('tiktok', r.items, { red: 'tiktok', desde, hasta, costo: r.costo });
  }

  if (red === 'instagram' || red === 'todas') {
    const acumulado = [];
    for (const kw of ['pepeaguilar', 'losaguilar']) {
      // 'until' = "más nuevos que": pidiendo desde el inicio del histórico llega todo.
      const r = await correrActor(TOKEN, 'apidojo/instagram-hashtag-scraper',
        { keyword: kw, until: desde, getPosts: true, getReels: true, maxItems: 500 }, 0.35, `instagram:${kw}`);
      acumulado.push(...r.items); gasto += r.costo;
    }
    guardar('instagram', acumulado, { red: 'instagram', desde, hasta, costo: gasto });
  }

  if (red === 'x' || red === 'todas') {
    const acumulado = [];
    for (const v of ventanas(desde, hasta, 15)) {
      const r = await correrActor(TOKEN, 'apidojo/tweet-scraper', {
        searchTerms: ['"Pepe Aguilar" OR "los Aguilar" -filter:retweets -filter:replies'],
        start: v.desde, end: v.hasta, sort: 'Top', maxItems: 300,
      }, 0.25, `x:${v.desde}`);
      acumulado.push(...r.items); gasto += r.costo;
    }
    guardar('x', acumulado, { red: 'x', desde, hasta, costo: gasto });
  }

  if (red === 'facebook' || red === 'todas') {
    const acumulado = [];
    for (const v of ventanas(desde, hasta, 4)) {
      try {
        const r = await correrActor(TOKEN, 'igview-owner/facebook-old-posts-search',
          { query: 'Pepe Aguilar', startDate: v.desde, endDate: v.hasta, maxResults: 60 }, 0.20, `facebook:${v.desde}`);
        acumulado.push(...r.items); gasto += r.costo;
      } catch (e) { log(`facebook ${v.desde}: falló (${e.message.slice(0, 90)}) — sigo con la siguiente ventana`); }
    }
    guardar('facebook', acumulado, { red: 'facebook', desde, hasta, costo: gasto });
  }

  log(`gasto de esta cosecha: $${gasto.toFixed(3)}`);
}

// ─── Reparto: cada pieza al día que le toca ──────────────────────────────────
const NORM = { facebook: normFacebook, instagram: normInstagram, x: normX, tiktok: normTikTok };
const ETIQUETA = { facebook: 'Facebook', instagram: 'Instagram', x: 'X/Twitter', tiktok: 'TikTok' };

async function repartir({ desde, hasta, dryRun }) {
  const archivos = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.json')) : [];
  if (!archivos.length) { log(`no hay nada en ${DIR}/ — corre --cosechar primero`); return; }

  const porRed = {};
  for (const a of archivos) {
    const red = a.replace(/\.json$/, '');
    if (!NORM[red]) { log(`salto ${a}: no sé a qué red corresponde`); continue; }
    porRed[red] = JSON.parse(fs.readFileSync(path.join(DIR, a), 'utf8')).items || [];
    log(`${red}: ${porRed[red].length} piezas crudas en disco`);
  }

  const resumen = {};
  let d = new Date(desde + 'T12:00:00Z');
  const fin = new Date(hasta + 'T12:00:00Z');
  while (d <= fin) {
    const dia = d.toISOString().slice(0, 10);
    const from = dayStartTs(dia), to = from + 86400000;
    for (const [red, crudo] of Object.entries(porRed)) {
      // Mismo normalizador y mismo filtro de ventana que la corrida diaria.
      const delDia = NORM[red](crudo, from, to).map(p => {
        // Campos de trabajo del pipeline (ej. _subs de TikTok, que en la corrida
        // diaria se consumen y se borran antes de guardar): no son columnas.
        const limpio = {};
        for (const [k, v] of Object.entries(p)) if (!k.startsWith('_')) limpio[k] = v;
        return limpio;
      });
      if (!delDia.length) continue;
      resumen[dia] ||= {};
      if (dryRun) { resumen[dia][red] = delDia.length; continue; }
      const reportId = await upsertReport(red, ETIQUETA[red], dia);
      const guardados = await insertPosts(reportId, red, delDia);
      resumen[dia][red] = guardados.length;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }

  const dias = Object.keys(resumen).sort();
  log(`${dryRun ? '[SIMULACIÓN] ' : ''}días tocados: ${dias.length}`);
  for (const dia of dias) {
    const partes = Object.entries(resumen[dia]).filter(([, n]) => n > 0).map(([r, n]) => `${r}:${n}`);
    if (partes.length) log(`  ${dia}  ${partes.join('  ')}`);
  }
  const total = dias.reduce((a, dia) => a + Object.values(resumen[dia]).reduce((x, y) => x + y, 0), 0);
  log(`${dryRun ? 'entrarían' : 'entraron'} ${total} publicaciones nuevas.`);
}

async function main() {
  const desde = arg('desde', '2026-06-01');
  const hasta = arg('hasta', new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  if (arg('cosechar')) return cosechar({ red: arg('red', 'todas'), desde, hasta });
  if (arg('repartir')) return repartir({ desde, hasta, dryRun: !!arg('dry-run') });
  log('usa --cosechar [--red=tiktok|instagram|x|facebook|todas] | --repartir [--dry-run]');
}

main().catch(e => { console.error('[cosecha] fallo:', e); process.exit(1); });
