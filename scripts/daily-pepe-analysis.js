/**
 * Railway cron entrypoint for Pepe Aguilar's daily full analysis.
 *
 * Runs once, stores the full analysis in Supabase through runFullAnalysis, and exits.
 */

import { runFullAnalysis } from './run-full-analysis.js';

const TIME_ZONE = process.env.DAILY_ANALYSIS_TIME_ZONE || 'America/Mexico_City';
const DATE_OFFSET_DAYS = Number.parseInt(process.env.DAILY_ANALYSIS_DATE_OFFSET_DAYS || '1', 10);

function zonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function dateInZoneWithOffset({ now = new Date(), timeZone = TIME_ZONE, offsetDays = DATE_OFFSET_DAYS } = {}) {
  const { year, month, day } = zonedDateParts(now, timeZone);
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12));
  utcNoon.setUTCDate(utcNoon.getUTCDate() - offsetDays);
  return utcNoon.toISOString().slice(0, 10);
}

function getArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta variable de entorno: ${name}`);
  return value;
}

const emit = event => {
  if (event.type === 'phase') {
    console.log(`[daily-pepe] FASE ${event.phase}: ${event.msg}`);
    return;
  }
  if (event.type === 'phase_done') {
    console.log(`[daily-pepe] OK: ${event.msg}`);
    return;
  }
  if (event.type === 'saved') {
    console.log(`[daily-pepe] ${event.net}: ${event.count} posts guardados`);
    return;
  }
  if (event.type === 'ai_done') {
    const sentiment = event.result?.sentimiento ? JSON.stringify(event.result.sentimiento) : event.result?.error;
    console.log(`[daily-pepe] AI ${event.net}: ${sentiment || 'completado'}`);
    return;
  }
  if (event.type === 'error') {
    console.error(`[daily-pepe] ERROR: ${event.msg}`);
    return;
  }
  if (event.type === 'done') {
    console.log(`[daily-pepe] COMPLETO: ${JSON.stringify(event.summary)}`);
  }
};

async function main() {
  const apifyToken = requireEnv('APIFY_TOKEN');
  const aiKey = requireEnv('OPENROUTER_API_KEY');
  const date = getArg('date') || process.env.DAILY_ANALYSIS_DATE || dateInZoneWithOffset();

  console.log(`[daily-pepe] Iniciando analisis completo para ${date}`);
  console.log(`[daily-pepe] Zona base: ${TIME_ZONE}; offset dias: ${DATE_OFFSET_DAYS}`);

  const summary = await runFullAnalysis({ apifyToken, aiKey, date, emit });
  console.log(`[daily-pepe] Analisis guardado en Supabase para ${summary.date}`);
}

main().catch(error => {
  console.error('[daily-pepe] Fallo el analisis diario:', error);
  process.exit(1);
});
