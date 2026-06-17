import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const MONO = "'Geist Mono',monospace";
const SANS = "'Geist',sans-serif";
const THEMES = [
  { key:'musica',      label:'Música' },
  { key:'entrevistas', label:'Entrevistas' },
  { key:'empresas',    label:'Empresas' },
  { key:'familia',     label:'Familia' },
];
const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function fmtDate(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function esc(s) {
  return '"' + String(s == null ? '' : s).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
}

function buildRow(rep) {
  const s = rep.sentiment?.[0] || {};
  const posts = rep.platforms?.reduce((a, p) => a + (p.posts || 0), 0) || 0;
  const platforms = (rep.platforms || []).map(p => p.platform).join(' | ');
  const prosPos = (rep.pros_cons || []).filter(x => x.type === 'pro').map(x => x.item).join(' | ');
  const prosCon = (rep.pros_cons || []).filter(x => x.type === 'con').map(x => x.item).join(' | ');
  const alerts = (rep.alert_posts || []).map(p => p.text).slice(0, 3).join(' | ');
  const opps = (rep.opportunity_posts || []).map(p => p.text).slice(0, 3).join(' | ');
  const topNews = (rep.news_items || []).slice(0, 3).map(n => n.titulo).join(' | ');
  const complaints = (rep.complaints || []).map(c => `${c.titulo} (${c.porcentaje}%)`).join(' | ');
  const trending = (rep.trending_topics || []).slice(0, 3).map(t => t.titulo).join(' | ');

  return [
    rep.date_key,
    rep.theme_label,
    s.pos || 0,
    s.neu || 0,
    s.neg || 0,
    s.risk_level || 'bajo',
    posts,
    platforms,
    prosPos,
    prosCon,
    complaints,
    alerts,
    opps,
    topNews,
    trending,
  ].map(esc).join(',');
}

const CSV_HEADER = [
  'fecha', 'tema',
  'positivo_%', 'neutral_%', 'negativo_%', 'riesgo',
  'total_posts', 'plataformas',
  'a_favor', 'en_contra',
  'quejas', 'alertas', 'oportunidades',
  'noticias_principales', 'tendencias',
].map(esc).join(',');

export default function ExportModal({ onClose }) {
  const [allDates, setAllDates] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!window.SUPABASE_KEYS) return;
    // Extract unique date_keys from SUPABASE_KEYS ("theme:date")
    const dates = [...new Set([...window.SUPABASE_KEYS].map(k => k.split(':')[1]))].sort();
    setAllDates(dates);
    setSelected(new Set(dates));
  }, []);

  function toggle(dateKey) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(dateKey) ? next.delete(dateKey) : next.add(dateKey);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev => prev.size === allDates.length ? new Set() : new Set(allDates));
  }

  async function handleDownload() {
    if (!selected.size) return;
    setLoading(true);
    setStatus('Cargando datos…');
    try {
      const { data: reports, error } = await supabase
        .from('reports')
        .select(`
          id, date_key, theme_key, theme_label,
          sentiment(*), platforms(*), alert_posts(*), opportunity_posts(*),
          complaints(*), news_items(*), trending_topics(*),
          pros_cons(*)
        `)
        .in('date_key', [...selected])
        .order('date_key', { ascending: true })
        .order('theme_key', { ascending: true });

      if (error) throw error;

      setStatus('Generando CSV…');
      const rows = [CSV_HEADER, ...reports.map(buildRow)];
      const csv = '﻿' + rows.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateRange = [...selected].sort();
      a.download = `pepe_aguilar_${dateRange[0]}_a_${dateRange[dateRange.length - 1]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      onClose();
    } catch (e) {
      setStatus('Error al cargar datos. Intenta de nuevo.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const themesForDate = (dk) =>
    THEMES.filter(t => window.SUPABASE_KEYS?.has(`${t.key}:${dk}`)).map(t => t.label).join(', ');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(33,28,23,0.55)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#FAF7F0', border: '1.5px solid #211C17', borderRadius: 4,
          width: '100%', maxWidth: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(33,28,23,0.13)' }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: C.gold, fontWeight: 600, marginBottom: 4 }}>Exportar datos</div>
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 17, color: C.ink }}>
            Selecciona las fechas a descargar
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: '#6B6253', marginTop: 4 }}>
            {selected.size} de {allDates.length} fechas seleccionadas
          </div>
        </div>

        {/* Dates list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px', scrollbarWidth: 'none' }}>
          {/* Select all */}
          <button onClick={toggleAll}
            style={{ width: '100%', textAlign: 'left', fontFamily: MONO, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase', color: C.goldDeep,
              background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0 10px',
              borderBottom: '1px solid rgba(33,28,23,0.10)', marginBottom: 8 }}>
            {selected.size === allDates.length ? '☑ Deseleccionar todo' : '☐ Seleccionar todo'}
          </button>

          {allDates.map(dk => {
            const checked = selected.has(dk);
            return (
              <button key={dk} onClick={() => toggle(dk)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                  textAlign: 'left', background: checked ? 'rgba(176,130,47,0.07)' : 'transparent',
                  border: '1px solid ' + (checked ? 'rgba(176,130,47,0.3)' : 'rgba(33,28,23,0.10)'),
                  borderRadius: 3, padding: '9px 11px', marginBottom: 6, cursor: 'pointer',
                  transition: 'all 0.12s' }}>
                <span style={{ width: 14, height: 14, borderRadius: 2, flex: 'none', marginTop: 1,
                  border: '1.5px solid ' + (checked ? C.gold : '#A9997B'),
                  background: checked ? C.gold : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checked && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
                </span>
                <div>
                  <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 13, color: C.ink }}>
                    {fmtDate(dk)}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: '#6B6253', marginTop: 2,
                    letterSpacing: '0.04em' }}>
                    {themesForDate(dk)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px 18px', borderTop: '1px solid rgba(33,28,23,0.13)',
          display: 'flex', gap: 8, alignItems: 'center' }}>
          {status && (
            <span style={{ fontFamily: MONO, fontSize: 9.5, color: '#6B6253', flex: 1 }}>{status}</span>
          )}
          {!status && <div style={{ flex: 1 }} />}
          <button onClick={onClose}
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '9px 14px', borderRadius: 2,
              border: '1px solid rgba(33,28,23,0.25)', background: 'transparent',
              color: '#6B6253', cursor: 'pointer' }}>
            Cancelar
          </button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleDownload}
            disabled={loading || !selected.size}
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '9px 16px', borderRadius: 2,
              border: `1px solid ${C.ink}`, background: C.ink,
              color: '#FBF8F1', cursor: loading || !selected.size ? 'default' : 'pointer',
              opacity: !selected.size ? 0.45 : 1, transition: 'opacity 0.15s' }}>
            {loading ? 'Cargando…' : `Descargar CSV ↓`}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
