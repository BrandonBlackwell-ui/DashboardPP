import { useState } from 'react';
import { motion } from 'framer-motion';
import Donut from './Donut';
import Semaforo from './Semaforo';
import { C, pill } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } } };

const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fmtDateKey(dk) {
  if (!dk) return '';
  const d = new Date(dk + 'T12:00:00');
  if (isNaN(d)) return dk;
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

const asLines = x => (Array.isArray(x) ? x : (x ? [x] : []))
  .map(a => typeof a === 'string' ? a : (a?.text || a?.alerta || '')).filter(Boolean).join('\n');

export default function PanoramaView({ data, isDesktop }) {
  const resumenTheme = data?.themes?.resumen;
  const ai = resumenTheme?.ai_analysis;
  const reportDateKey = data?.meta?.latest_ai_report?.date_key || resumenTheme?.sourceThemeKey && data?.meta?.period?.end;

  const isAdmin = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('bw_role') === 'admin');
  const meta = data?.meta?.latest_ai_report;
  const isDraft = meta?.approved === false;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState(null); // {resumen, alertas, plan, oportunidades} como texto

  const openEditor = () => {
    setDraft({
      resumen: asLines(ai?.resumen_ejecutivo),
      alertas: asLines(ai?.alertas),
      plan: asLines(ai?.plan_accion),
      oportunidades: asLines(ai?.oportunidades),
    });
    setEditing(true);
  };

  const toArr = s => (s || '').split('\n').map(l => l.trim()).filter(Boolean);

  const saveEdits = async ({ approve } = {}) => {
    if (!meta?.id) return;
    setBusy(approve ? 'Aprobando…' : 'Guardando…');
    try {
      const updated = draft ? {
        ...ai,
        resumen_ejecutivo: toArr(draft.resumen),
        alertas: toArr(draft.alertas),
        plan_accion: toArr(draft.plan),
        oportunidades: toArr(draft.oportunidades),
      } : ai;
      // Guarda el panorama editado
      if (draft) {
        await supabase.from('reports').update({ ai_analysis: updated }).eq('id', meta.id);
        if (resumenTheme) resumenTheme.ai_analysis = updated;
      }
      // Aprobar = publicar todo el día para el cliente
      if (approve) {
        await supabase.from('reports').update({ approved: true }).eq('date_key', meta.date_key);
        window.location.reload();
        return;
      }
      setEditing(false);
    } finally { setBusy(''); }
  };

  const InlineEditorDisabled = ({ field, label }) => {
    if (!isAdmin || !editing || !draft) return null;
    const value = draft[field] || '';
    return (
      <div style={{ marginTop:14, background:'#FAF8F5',
        border:'1px solid rgba(176,130,47,0.22)', borderRadius:3, padding:12 }}>
        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.11em',
          textTransform:'uppercase', color:C.goldDeep, fontWeight:700, marginBottom:7 }}>
          Editando esta seccion · una linea = un punto
        </div>
        <label style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.08em',
          textTransform:'uppercase', color:'#6B6253', display:'block', marginBottom:6 }}>
          {label}
        </label>
        <textarea
          value={value}
          onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))}
          rows={Math.max(3, (value.match(/\n/g) || []).length + 1)}
          style={{ width:'100%', fontFamily:"'Geist',sans-serif", fontSize:13.5, lineHeight:1.5,
            color:C.ink, background:'#FFFDF9', border:'1px solid rgba(33,28,23,0.15)',
            borderRadius:3, padding:'9px 11px', resize:'vertical', boxSizing:'border-box' }}
        />
      </div>
    );
  };

  const draftLines = (field, fallback) => {
    if (editing && draft) {
      const lines = (draft[field] || '').split('\n');
      return lines.length ? lines : [''];
    }
    return Array.isArray(fallback) ? fallback : (fallback ? [fallback] : []);
  };

  const updateDraftLine = (field, idx, value) => {
    setDraft(d => {
      const lines = (d?.[field] || '').split('\n');
      lines[idx] = value;
      return { ...d, [field]: lines.join('\n') };
    });
  };

  const editableTextStyle = {
    width:'100%',
    minHeight:34,
    border:'1px solid rgba(176,130,47,0.32)',
    borderRadius:3,
    background:'#FFFDF9',
    color:'#2A241C',
    fontFamily:"'Geist',sans-serif",
    fontSize:14,
    lineHeight:1.5,
    padding:'8px 10px',
    resize:'vertical',
    boxSizing:'border-box'
  };

  // Fallback if no AI analysis is generated yet
  if (!ai) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          padding: isDesktop ? '40px 36px' : '24px 20px',
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        <h1 style={{
          fontFamily: "'Geist',sans-serif",
          fontWeight: 500,
          fontSize: isDesktop ? 32 : 28,
          letterSpacing: '-0.025em',
          color: C.ink,
          margin: '0 0 8px 0'
        }}>
          Panorama General.
        </h1>
        <p style={{
          fontSize: 14.5,
          lineHeight: 1.55,
          color: '#8A7E6A',
          maxWidth: 440,
          margin: 0,
          fontFamily: "'Geist',sans-serif"
        }}>
          Todavia no hay un analisis reputacional consolidado guardado en Supabase para mostrar aqui.
        </p>
      </motion.div>
    );
    return (
      <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{ 
          padding: isDesktop ? '40px 36px' : '24px 20px', 
          minHeight: '70vh', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          textAlign: 'center' 
        }}
      >
        <div style={{
          background: 'rgba(176,130,47,0.08)',
          border: '1px solid rgba(176,130,47,0.22)',
          borderRadius: '50%',
          width: 72,
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 22,
          boxShadow: '0 8px 24px rgba(176,130,47,0.04)'
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.goldDeep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
          </svg>
        </div>

        <h1 style={{
          fontFamily: "'Geist',sans-serif",
          fontWeight: 500,
          fontSize: isDesktop ? 32 : 28,
          letterSpacing: '-0.025em',
          color: C.ink,
          margin: '0 0 8px 0'
        }}>
          Panorama General (IA)
        </h1>

        <p style={{
          fontSize: 14.5,
          lineHeight: 1.55,
          color: '#8A7E6A',
          maxWidth: 440,
          margin: '0 0 28px 0',
          fontFamily: "'Geist',sans-serif"
        }}>
          El análisis reputacional consolidado aún no ha sido procesado por Sonnet 4.6 en Supabase para esta fecha.
        </p>

        {/* Executive Info Box */}
        <div style={{
          background: C.card,
          border: '1px solid rgba(33,28,23,0.13)',
          borderRadius: 4,
          padding: '18px 22px',
          maxWidth: 485,
          boxShadow: '0 4px 12px rgba(33,28,23,0.02)'
        }}>
          <div style={{
            fontFamily: "'Geist Mono',monospace",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: C.goldDeep,
            marginBottom: 6,
            textAlign: 'left'
          }}>
            Instrucciones para Generar
          </div>
          <div style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: '#6B6253',
            textAlign: 'left'
          }}>
            Para correr el análisis experto en crisis con tu clave de OpenRouter, ejecuta el siguiente comando en tu terminal de control:
            <code style={{
              display: 'block',
              background: '#F1EAD8',
              padding: '8px 10px',
              borderRadius: 3,
              fontFamily: "'Geist Mono',monospace",
              fontSize: 11.5,
              marginTop: 8,
              color: C.ink,
              wordBreak: 'break-all'
            }}>
              Analisis pendiente
            </code>
          </div>
        </div>
      </motion.div>
    );
  }

  // AI analysis loaded successfully!
  const sent = ai.sentimiento || { favorable: 0, neutral: 100, critico: 0 };

  // Volumen de menciones del período (posts + comentarios de todas las redes) para el semáforo.
  const convVolume = Object.entries(data?.themes || {})
    .filter(([k]) => k !== 'resumen')
    .reduce((sum, [, t]) => sum
      + (Number(t?.totals?.posts) || 0)
      + (t?.platforms || []).reduce((s, p) => s + (Number(p.comments) || 0), 0), 0);
  // La "Crítica" del semáforo combina favorable+neutral vs crítica: favorable = fav+neutral.
  const semFav = (Number(sent.favorable) || 0) + (Number(sent.neutral) || 0);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible"
      style={{ padding: isDesktop ? '32px 36px 36px' : '20px 18px 36px' }}>

      {/* Barra de revisión del admin */}
      {isAdmin && (
        <motion.div variants={item} style={{ marginBottom: 18, borderRadius: 4,
          border: `1.5px solid ${isDraft ? C.goldDeep : C.tealBd}`,
          background: isDraft ? 'rgba(176,130,47,0.08)' : C.tealBg, padding: '13px 16px',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, letterSpacing: '0.12em',
              textTransform: 'uppercase', fontWeight: 700, color: isDraft ? C.goldDeep : C.teal }}>
              {isDraft ? '● Borrador · pendiente de aprobar' : '✓ Publicado · visible para el cliente'}
            </div>
            <div style={{ fontSize: 12, color: '#6B6253', marginTop: 3 }}>
              {isDraft
                ? 'El cliente (pp2026) NO ve este análisis todavía. Revísalo, edítalo y apruébalo.'
                : 'Este análisis ya es visible para el cliente. Puedes editarlo y volver a aprobar.'}
            </div>
          </div>
          {!editing ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={openEditor} disabled={!!busy}
                style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', padding: '9px 14px', borderRadius: 2, cursor: 'pointer',
                  border: `1px solid ${C.ink}`, background: 'transparent', color: C.ink }}>
                ✎ Editar
              </button>
              <button onClick={() => saveEdits({ approve: true })} disabled={!!busy}
                style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', padding: '9px 16px', borderRadius: 2, cursor: 'pointer',
                  border: `1px solid ${C.teal}`, background: C.teal, color: '#fff' }}>
                {busy || (isDraft ? '✓ Aprobar y publicar' : '↻ Re-aprobar')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(false)} disabled={!!busy}
                style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', padding: '9px 14px', borderRadius: 2, cursor: 'pointer',
                  border: '1px solid rgba(33,28,23,0.25)', background: 'transparent', color: '#6B6253' }}>
                Cancelar
              </button>
              <button onClick={() => saveEdits()} disabled={!!busy}
                style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', padding: '9px 14px', borderRadius: 2, cursor: 'pointer',
                  border: `1px solid ${C.ink}`, background: 'transparent', color: C.ink }}>
                {busy || 'Guardar'}
              </button>
              <button onClick={() => saveEdits({ approve: true })} disabled={!!busy}
                style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', padding: '9px 16px', borderRadius: 2, cursor: 'pointer',
                  border: `1px solid ${C.teal}`, background: C.teal, color: '#fff' }}>
                {busy || 'Guardar y aprobar'}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Editor del panorama (admin) */}
      {false && isAdmin && editing && draft && (
        <motion.div variants={item} style={{ marginBottom: 20, background: C.card,
          border: '1px solid rgba(33,28,23,0.13)', borderRadius: 4, padding: 18 }}>
          <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: C.goldDeep, fontWeight: 700, marginBottom: 12 }}>
            Editar panorama · una línea = un punto
          </div>
          {[
            { key: 'resumen', label: 'Resumen ejecutivo' },
            { key: 'alertas', label: 'Alertas' },
            { key: 'plan', label: 'Plan de acción' },
            { key: 'oportunidades', label: 'Oportunidades' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#6B6253', display: 'block', marginBottom: 5 }}>{f.label}</label>
              <textarea value={draft[f.key]}
                onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                rows={Math.max(3, (draft[f.key].match(/\n/g) || []).length + 1)}
                style={{ width: '100%', fontFamily: "'Geist',sans-serif", fontSize: 13.5, lineHeight: 1.5,
                  color: C.ink, background: '#FAF8F5', border: '1px solid rgba(33,28,23,0.15)',
                  borderRadius: 3, padding: '9px 11px', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          ))}
        </motion.div>
      )}

      {/* Header section */}
      <motion.div variants={item} style={{ display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:24, borderBottom:'1px solid #E3DAC6', paddingBottom:16 }}>
        <div>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.16em', textTransform:'uppercase', color:C.gold, fontWeight:600 }}>
            Análisis de Crisis y Reputación · IA{reportDateKey ? ` · ${fmtDateKey(reportDateKey)}` : ''}
          </div>
          <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:isDesktop ? 34 : 29, lineHeight:1.05, letterSpacing:'-0.025em', color:C.ink, margin:'8px 0 0' }}>
            Panorama General.
          </h1>
        </div>
      </motion.div>

      {/* Donut and Risk level cards */}
      <motion.div variants={item} style={{ display:'grid', gridTemplateColumns:isDesktop ? '1.5fr 1fr' : '1fr', gap:16, marginBottom:20 }}>
        
        {/* Donut Card */}
        <div style={{ display:'flex', alignItems:'center', gap:22, background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:20 }}>
          <Donut pos={sent.favorable} neu={sent.neutral} neg={sent.critico} size={120} showLabel />
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', color:'#6B6253', marginBottom:12 }}>Sentimiento Calculado por IA</div>
            {[
              { color: C.teal, label: 'Favorable', val: sent.favorable },
              { color: C.slate, label: 'Neutral', val: sent.neutral },
              { color: C.crim, label: 'Crítico', val: sent.critico },
            ].map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:9, marginBottom:6 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:l.color }} />
                <span style={{ fontSize:13.5, color:'#2A241C', flex:1 }}>{l.label}</span>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:13.5, color:C.ink }}>{l.val}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Semáforo — Estado de la Conversación (reemplaza la tarjeta de riesgo, mismo espacio) */}
        <Semaforo favorable={semFav} critico={sent.critico} volume={convVolume} isDesktop={isDesktop} compact />

      </motion.div>

      {/* Executive Summary Card */}
      <motion.div variants={item} style={{ marginBottom:20 }}>
        <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.goldDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <h2 style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:19, color:C.ink, margin:0 }}>Resumen Ejecutivo de Reputación</h2>
          </div>
          
          {editing && draft ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {draftLines('resumen', ai.resumen_ejecutivo).map((bullet, idx) => (
                <div key={idx} style={{ display:'flex', gap:12, alignItems:'flex-start', background:'#FAF8F5', border:'1px solid rgba(33,28,23,0.06)', padding:'12px 14px', borderRadius:3 }}>
                  <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:C.goldDeep, fontWeight:700, paddingTop:8 }}>0{idx+1}</span>
                  <textarea
                    value={bullet}
                    onChange={e => updateDraftLine('resumen', idx, e.target.value)}
                    rows={Math.max(2, Math.ceil((bullet || '').length / 110))}
                    style={editableTextStyle}
                  />
                </div>
              ))}
            </div>
          ) : Array.isArray(ai.resumen_ejecutivo) ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {ai.resumen_ejecutivo.map((bullet, idx) => (
                <div key={idx} style={{ display:'flex', gap:12, alignItems:'flex-start', background:'#FAF8F5', border:'1px solid rgba(33,28,23,0.06)', padding:'12px 14px', borderRadius:3 }}>
                  <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:C.goldDeep, fontWeight:700 }}>0{idx+1}</span>
                  <span style={{ fontSize:14, lineHeight:1.5, color:'#2A241C' }}>{bullet}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize:15, lineHeight:1.65, color:'#2A241C', whiteSpace:'pre-line' }}>
              {ai.resumen_ejecutivo}
            </div>
          )}
        </div>
      </motion.div>

      {/* Fundamento del análisis — SOLO ADMIN (el cliente pp2026 nunca lo ve).
          Segunda llamada a la IA que explica POR QUÉ se analizó así, citando BW-26-07-PA-MSG-001. */}
      {isAdmin && resumenTheme?.admin_rationale && (() => {
        const ar = resumenTheme.admin_rationale;
        return (
          <motion.div variants={item} style={{ marginBottom: 20 }}>
            <div style={{ background: 'rgba(176,130,47,0.06)', border: `1px solid ${C.amberBd}`, borderRadius: 4, padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ ...pill(C.goldDeep, C.amberBg, C.amberBd) }}>SOLO ADMIN · NO VISIBLE PARA EL CLIENTE</span>
              </div>
              <h2 style={{ fontFamily: "'Geist',sans-serif", fontWeight: 600, fontSize: 18, color: C.ink, margin: '4px 0 4px' }}>
                Por qué se analizó así
              </h2>
              <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A7E6A', marginBottom: 14 }}>
                Fundamento citando BW-26-07-PA-MSG-001 (Mensajes Maestros)
              </div>

              {ar.resumen && (
                <div style={{ fontSize: 14, lineHeight: 1.55, color: '#2A241C', marginBottom: 16 }}>{ar.resumen}</div>
              )}

              {Array.isArray(ar.fundamentos) && ar.fundamentos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {ar.fundamentos.map((f, i) => (
                    <div key={i} style={{ background: '#FFFDF9', border: '1px solid rgba(176,130,47,0.18)', borderRadius: 3, padding: '12px 14px' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{f.conclusion}</div>
                      {f.referencia_doc && (
                        <span style={{ ...pill(C.goldDeep, C.amberBg, C.amberBd), marginBottom: 6 }}>{f.referencia_doc}</span>
                      )}
                      {f.cita && (
                        <div style={{ fontSize: 12.5, fontStyle: 'italic', color: '#5A5044', margin: '6px 0', paddingLeft: 10, borderLeft: `2px solid ${C.gold}` }}>
                          “{f.cita}”
                        </div>
                      )}
                      {f.por_que && <div style={{ fontSize: 13, lineHeight: 1.45, color: '#3A332A' }}>{f.por_que}</div>}
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(ar.reactivos_detectados) && ar.reactivos_detectados.length > 0 && (
                <div style={{ marginBottom: Array.isArray(ar.brechas) && ar.brechas.length ? 14 : 0 }}>
                  <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8A7E6A', fontWeight: 600, marginBottom: 8 }}>Temas reactivos detectados</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ar.reactivos_detectados.map((r, i) => {
                      const riesgo = (r.manejo || '').toLowerCase() === 'riesgo';
                      const m = riesgo ? { c: C.crim, bg: C.crimBg, bd: C.crimBd } : { c: C.teal, bg: C.tealBg, bd: C.tealBd };
                      return (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9.5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: m.c, background: m.bg, border: `1px solid ${m.bd}`, borderRadius: 999, padding: '2px 8px', flexShrink: 0, marginTop: 1 }}>{r.manejo || '—'}</span>
                          <span style={{ fontSize: 13, lineHeight: 1.45, color: '#2A241C' }}><b>{r.tema}:</b> {r.pivote_doc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {Array.isArray(ar.brechas) && ar.brechas.length > 0 && (
                <div>
                  <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8A7E6A', fontWeight: 600, marginBottom: 8 }}>Brechas vs el documento</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ar.brechas.map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                        <span style={{ color: C.goldDeep, fontWeight: 'bold', fontSize: 13, flexShrink: 0, marginTop: 1 }}>›</span>
                        <span style={{ fontSize: 13, lineHeight: 1.45, color: '#2A241C' }}>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        );
      })()}

      {/* Alerts / Red Flags Block */}
      {ai.alertas && ai.alertas.length > 0 && (
        <motion.div variants={item} style={{ marginBottom:20 }}>
          <div style={{ background:'rgba(220,53,69,0.02)', border:`1px solid ${C.crimBd}`, borderRadius:3, padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.crim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <h2 style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:18, color:C.crim, margin:0 }}>Alertas de Crisis & Focos Rojos</h2>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {draftLines('alertas', ai.alertas).map((a, i) => (
                <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', background:'#FFF8F7', border:'1px solid rgba(220,53,69,0.08)', padding:'12px 14px', borderRadius:3 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:C.crim, marginTop:7, flexShrink:0 }} />
                  {editing && draft ? (
                    <textarea
                      value={a}
                      onChange={e => updateDraftLine('alertas', i, e.target.value)}
                      rows={Math.max(2, Math.ceil((a || '').length / 105))}
                      style={{ ...editableTextStyle, fontSize:13.5 }}
                    />
                  ) : (
                    <span style={{ fontSize:13.5, lineHeight:1.45, color:'#4A2C2A' }}>{a}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Action Plan vs Opportunities (2 Columns) */}
      <motion.div variants={item} style={{ display:'grid', gridTemplateColumns:isDesktop ? '1fr 1fr' : '1fr', gap:16, marginBottom:20 }}>
        
        {/* Action Plan */}
        <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <span style={{ ...pill(C.ink,'#EDE6D8','#C8BBA0') }}>PLAN DE ACCIÓN</span>
            <h3 style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:17, color:C.ink, margin:0 }}>Cosas por Hacer</h3>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {draftLines('plan', ai.plan_accion).map((act, idx) => (
              <div key={idx} style={{ display:'flex', gap:10, alignItems:'flex-start', background:'#F5F8F5', border:'1px solid rgba(40,167,69,0.06)', padding:'10px 12px', borderRadius:3 }}>
                <span style={{ color:C.teal, fontWeight:'bold', fontSize:14, flexShrink:0, marginTop:1 }}>✓</span>
                {editing && draft ? (
                  <textarea
                    value={act}
                    onChange={e => updateDraftLine('plan', idx, e.target.value)}
                    rows={Math.max(2, Math.ceil((act || '').length / 70))}
                    style={{ ...editableTextStyle, fontSize:13 }}
                  />
                ) : (
                  <span style={{ fontSize:13, lineHeight:1.45, color:'#2A241C' }}>{act}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Areas of Opportunity */}
        <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <span style={{ ...pill(C.teal,C.tealBg,C.tealBd) }}>RECOMENDACIÓN</span>
            <h3 style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:17, color:C.ink, margin:0 }}>Mejoras y Oportunidades</h3>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {draftLines('oportunidades', ai.oportunidades).map((op, idx) => (
              <div key={idx} style={{ display:'flex', gap:10, alignItems:'flex-start', background:'#FDF9F2', border:'1px solid rgba(176,130,47,0.10)', padding:'10px 12px', borderRadius:3 }}>
                <span style={{ color:C.goldDeep, fontWeight:'bold', fontSize:14, flexShrink:0, marginTop:1 }}>✦</span>
                {editing && draft ? (
                  <textarea
                    value={op}
                    onChange={e => updateDraftLine('oportunidades', idx, e.target.value)}
                    rows={Math.max(2, Math.ceil((op || '').length / 70))}
                    style={{ ...editableTextStyle, fontSize:13 }}
                  />
                ) : (
                  <span style={{ fontSize:13, lineHeight:1.45, color:'#2A241C' }}>{op}</span>
                )}
              </div>
            ))}
          </div>
        </div>

      </motion.div>


    </motion.div>
  );
}
