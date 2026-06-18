// Vercel serverless function — receives CSV from Google Apps Script and saves to Supabase
import { parseDailyCSV } from './_lib/csvParser.js';
import { saveReport } from './_lib/saveReport.js';

const INGEST_SECRET = process.env.INGEST_SECRET || '';

export default async function handler(req, res) {
  // CORS headers so the Apps Script can POST
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secret, filename, csv } = req.body || {};

  // Auth check — only skip if INGEST_SECRET is not yet configured (dev mode)
  if (INGEST_SECRET && secret !== INGEST_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!filename || !csv) {
    return res.status(400).json({ error: 'Missing filename or csv' });
  }

  try {
    const { dateKey, themeKey, themeData } = parseDailyCSV(csv, filename);
    const reportId = await saveReport({ dateKey, themeKey, themeData, filename });
    console.log(`Ingested: ${themeKey} ${dateKey} (${filename})`);
    return res.status(200).json({ ok: true, dateKey, themeKey, reportId });
  } catch (err) {
    console.error('Ingest error:', err);
    return res.status(500).json({ error: err.message });
  }
}
