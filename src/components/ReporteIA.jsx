import { motion } from 'framer-motion';
import Donut from './Donut';
import PlatformIcon from './PlatformIcon';
import { C, riskMeta, fmt, fmtK, platLabel } from '../utils/helpers';

const MONO = "'Geist Mono',monospace";
const SANS = "'Geist',sans-serif";
const border = 'rgba(33,28,23,0.13)';
const muted = '#6B6253';

const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fmtDateKey(dk) {
  if (!dk) return '';
  const d = new Date(dk + 'T12:00:00');
  if (isNaN(d)) return dk;
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

const TREND_META = {
  mejorando:  { icon: '▲', color: C.teal,     label: 'Mejorando' },
  estable:    { icon: '—', color: '#8A7E6A',  label: 'Estable' },
  empeorando: { icon: '▼', color: C.crim,     label: 'Empeorando' },
};

function Card({ children, accent, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${border}`,
      borderLeft: accent ? `3px solid ${accent}` : `1px solid ${border}`,
      borderRadius: 3, padding: '16px 18px', ...style }}>
      {children}
    </div>
  );
}

function CardTitle({ children, color }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: color || C.goldDeep, fontWeight: 700, marginBottom: 12 }}>
      {children}
    </div>
  );
}

// Mini sentiment trend from CALENDAR_DATA
function MiniTrend({ calDays, isDesktop }) {
  const dayKeys = Object.keys(calDays || {}).sort();
  if (dayKeys.length < 2) return null;

  const points = dayKeys.map(dk => {
    const entries = Object.values(calDays[dk] || {});
    if (!entries.length) return null;
    const pos = entries.reduce((s, e) => s + (e.pos || 0), 0) / entries.length;
    const neg = entries.reduce((s, e) => s + (e.neg || 0), 0) / entries.length;
    return { dk, pos, neg };
  }).filter(Boolean);
  if (points.length < 2) return null;

  const W = 600, H = 90, PX = 6, PY = 10;
  const x = i => PX + (i / Math.max(1, points.length - 1)) * (W - PX * 2);
  const y = v => H - PY - (v / 100) * (H - PY * 2);
  const path = key => points.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');

  const first = points[0], last = points[points.length - 1];
  const deltaPos = Math.round(last.pos - first.pos);
  const deltaNeg = Math.round(last.neg - first.neg);

  return (
    <Card>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:8 }}>
        <CardTitle color={C.ink}>Evolución del período · {fmtDateKey(first.dk)} → {fmtDateKey(last.dk)}</CardTitle>
        <div style={{ display:'flex', gap:14 }}>
          <span style={{ fontFamily:MONO, fontSize:10.5, color: deltaPos >= 0 ? C.teal : C.crim, fontWeight:700 }}>
            Favorable {deltaPos >= 0 ? '+' : ''}{deltaPos} pts
          </span>
          <span style={{ fontFamily:MONO, fontSize:10.5, color: deltaNeg <= 0 ? C.teal : C.crim, fontWeight:700 }}>
            Crítico {deltaNeg >= 0 ? '+' : ''}{deltaNeg} pts
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block' }}>
        {[0, 50, 100].map(v => (
          <line key={v} x1={PX} x2={W-PX} y1={y(v)} y2={y(v)} stroke="rgba(33,28,23,0.07)" strokeWidth="1" />
        ))}
        <path d={path('pos')} fill="none" stroke={C.teal} strokeWidth="2" strokeLinejoin="round" />
        <path d={path('neg')} fill="none" stroke={C.crim} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </Card>
  );
}

export default function ReporteIA({ data, isDesktop }) {
  const resumen = data?.themes?.resumen;
  const ai = resumen?.ai_analysis;
  const meta = data?.meta?.latest_ai_report;
  const calDays = window.CALENDAR_DATA?.days || {};
  const allVoices = window.ALL_VOICES_DATA || { allies: [], critics: [] };

  if (!ai) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: C.goldDeep, fontWeight: 700, marginBottom: 10 }}>
          Reporte en preparación
        </div>
        <p style={{ fontSize: 13.5, color: muted, maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}>
          El reporte consolidado de esta fecha aún no está disponible.
        </p>
      </div>
    );
  }

  const sent = ai.sentimiento || { favorable: 0, neutral: 100, critico: 0 };
  const rm = riskMeta(ai.nivel_riesgo);
  const redes = Object.entries(ai.desglose_por_red || {}).filter(([k, v]) => k !== 'INSTRUCCION' && v?.sentimiento);
  const comp = ai.comparativa_historica;
  const totalPosts = Object.values(data?.themes || {})
    .filter(t => t !== resumen)
    .reduce((s, t) => s + (t.totals?.posts || 0), 0);

  const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } } };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible"
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* KPI row */}
      <motion.div variants={item} style={{ display: 'grid',
        gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Fecha del análisis', value: fmtDateKey(meta?.date_key), color: C.ink },
          { label: 'Publicaciones', value: totalPosts ? fmt(totalPosts) : '—', color: C.ink },
          { label: 'Favorable', value: `${sent.favorable}%`, color: C.teal },
          { label: 'Crítico', value: `${sent.critico}%`, color: C.crim },
        ].map(k => (
          <div key={k.label} style={{ background: C.card, border: `1px solid ${border}`, borderRadius: 3, padding: '12px 14px' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 22, color: k.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </motion.div>

      {/* Sentiment + Risk */}
      <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1.4fr 1fr' : '1fr', gap: 14 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Donut pos={sent.favorable} neu={sent.neutral} neg={sent.critico} size={96} showLabel />
            <div style={{ flex: 1 }}>
              <CardTitle color={muted}>Sentimiento consolidado</CardTitle>
              {[
                { color: C.teal, label: 'Favorable', val: sent.favorable },
                { color: C.slate, label: 'Neutral', val: sent.neutral },
                { color: C.crim, label: 'Crítico', val: sent.critico },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flex: 'none' }} />
                  <span style={{ fontSize: 12.5, color: '#2A241C', flex: 1 }}>{l.label}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 13, color: C.ink }}>{l.val}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <div style={{ background: rm.bg, border: `1px solid ${rm.bd}`, borderRadius: 3, padding: '16px 18px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: rm.ink }}>
            Nivel de riesgo
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, color: rm.ink, marginTop: 4, textTransform: 'capitalize' }}>
            {rm.label.replace('_', ' ')}
          </div>
          {comp?.resumen && (
            <p style={{ fontSize: 12, color: rm.ink, opacity: 0.85, margin: '8px 0 0', lineHeight: 1.45 }}>{comp.resumen}</p>
          )}
        </div>
      </motion.div>

      {/* Trend */}
      <motion.div variants={item}>
        <MiniTrend calDays={calDays} isDesktop={isDesktop} />
      </motion.div>

      {/* Executive summary */}
      {Array.isArray(ai.resumen_ejecutivo) && ai.resumen_ejecutivo.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardTitle>Resumen ejecutivo</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ai.resumen_ejecutivo.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.goldDeep, fontWeight: 700, flex: 'none', marginTop: 2 }}>0{i+1}</span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.5, color: '#2A241C' }}>{b}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Per-network breakdown */}
      {redes.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardTitle>Desglose por red</CardTitle>
            <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 10 }}>
              {redes.map(([red, v]) => {
                const s = v.sentimiento || {};
                const tm = TREND_META[v.tendencia] || null;
                return (
                  <div key={red} style={{ background: 'rgba(33,28,23,0.035)', border: '1px solid rgba(33,28,23,0.08)',
                    borderRadius: 3, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <PlatformIcon platform={red} size={15} />
                      <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 13.5, color: C.ink, flex: 1 }}>{platLabel(red)}</span>
                      {tm && (
                        <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: tm.color,
                          textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {tm.icon} {tm.label}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', height: 5, borderRadius: 2, overflow: 'hidden', background: '#E3DAC6', marginBottom: 8 }}>
                      <div style={{ width: `${s.favorable || 0}%`, background: C.teal }} />
                      <div style={{ width: `${s.neutral || 0}%`, background: C.slate }} />
                      <div style={{ width: `${s.critico || 0}%`, background: C.crim }} />
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 9.5, color: muted, marginBottom: v.lectura ? 8 : 0 }}>
                      {s.favorable || 0}% FAV · {s.neutral || 0}% NEU · {s.critico || 0}% CRIT
                    </div>
                    {v.lectura && (
                      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: '#2A241C', margin: '0 0 6px' }}>{v.lectura}</p>
                    )}
                    {(v.focos || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: v.recomendacion ? 8 : 0 }}>
                        {v.focos.map((f, i) => (
                          <span key={i} style={{ fontFamily: MONO, fontSize: 9, padding: '2px 7px', borderRadius: 2,
                            background: 'rgba(176,130,47,0.08)', color: C.goldDeep,
                            border: '1px solid rgba(176,130,47,0.18)' }}>{f}</span>
                        ))}
                      </div>
                    )}
                    {v.recomendacion && (
                      <div style={{ borderTop: '1px dotted rgba(33,28,23,0.12)', paddingTop: 7, display: 'flex', gap: 7 }}>
                        <span style={{ color: C.teal, fontWeight: 700, fontSize: 12, flex: 'none' }}>→</span>
                        <span style={{ fontSize: 12, lineHeight: 1.45, color: '#2A241C', fontWeight: 500 }}>{v.recomendacion}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Alerts + historical comparison */}
      <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: isDesktop && comp ? '1fr 1fr' : '1fr', gap: 14 }}>
        {(ai.alertas || []).length > 0 && (
          <Card accent={C.crim}>
            <CardTitle color={C.crim}>Alertas activas</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {ai.alertas.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.crim, marginTop: 6, flex: 'none' }} />
                  <span style={{ fontSize: 12.5, lineHeight: 1.45, color: '#4A2C2A' }}>
                    {typeof a === 'string' ? a : (a.text || a.alerta || '')}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {comp && ((comp.alertas_resueltas || []).length > 0 || (comp.alertas_persistentes || []).length > 0) && (
          <Card accent={C.goldDeep}>
            <CardTitle>Seguimiento vs período anterior</CardTitle>
            {(comp.alertas_persistentes || []).map((a, i) => (
              <div key={`p-${i}`} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: C.crim, flex: 'none',
                  textTransform: 'uppercase', marginTop: 3, letterSpacing: '0.04em' }}>Sigue</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.45, color: '#2A241C' }}>{a}</span>
              </div>
            ))}
            {(comp.alertas_resueltas || []).map((a, i) => (
              <div key={`r-${i}`} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: C.teal, flex: 'none',
                  textTransform: 'uppercase', marginTop: 3, letterSpacing: '0.04em' }}>Resuelta</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.45, color: '#6B6253', textDecoration: 'line-through' }}>{a}</span>
              </div>
            ))}
          </Card>
        )}
      </motion.div>

      {/* Action plan + opportunities */}
      <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 14 }}>
        {(ai.plan_accion || []).length > 0 && (
          <Card accent={C.teal}>
            <CardTitle color={C.teal}>Plan de acción</CardTitle>
            {ai.plan_accion.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, marginBottom: 7, alignItems: 'flex-start' }}>
                <span style={{ color: C.teal, fontWeight: 700, fontSize: 13, flex: 'none' }}>✓</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.45, color: '#2A241C' }}>{a}</span>
              </div>
            ))}
          </Card>
        )}
        {(ai.oportunidades || []).length > 0 && (
          <Card accent={C.goldDeep}>
            <CardTitle>Oportunidades</CardTitle>
            {ai.oportunidades.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, marginBottom: 7, alignItems: 'flex-start' }}>
                <span style={{ color: C.goldDeep, fontWeight: 700, fontSize: 13, flex: 'none' }}>✦</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.45, color: '#2A241C' }}>{o}</span>
              </div>
            ))}
          </Card>
        )}
      </motion.div>

      {/* Top voices */}
      {(allVoices.allies.length > 0 || allVoices.critics.length > 0) && (
        <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 14 }}>
          {[
            { list: allVoices.allies.slice(0, 5), label: 'Top aliados históricos', color: C.teal },
            { list: allVoices.critics.slice(0, 5), label: 'Top contrarios históricos', color: C.crim },
          ].map(g => g.list.length > 0 && (
            <Card key={g.label} accent={g.color}>
              <CardTitle color={g.color}>{g.label}</CardTitle>
              {g.list.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: muted, width: 14, flex: 'none' }}>{i+1}</span>
                  <PlatformIcon platform={v.platform} size={12} />
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: C.ink, flex: 1, minWidth: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.username}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: g.color, fontWeight: 700 }}>{fmtK(v.engagement)}</span>
                </div>
              ))}
            </Card>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
