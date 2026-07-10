import { motion } from 'framer-motion';
import { C, conversationState, SEMAFORO_MIN_VOLUME, fmt } from '../utils/helpers';

const LIGHTS = [
  { rank: 2, on: C.crim, off: 'rgba(155,51,49,0.16)' },   // rojo arriba
  { rank: 1, on: C.amber, off: 'rgba(176,130,47,0.16)' }, // amarillo
  { rank: 0, on: C.teal, off: 'rgba(78,115,81,0.16)' },   // verde abajo
];

const mono = { fontFamily: "'Geist Mono',monospace" };

function ReadingBadge({ titulo, valor, level, colors }) {
  const meta = colors[level];
  return (
    <div style={{ flex: 1, minWidth: 150, background: '#FFFDF9', border: '1px solid rgba(33,28,23,0.10)',
      borderRadius: 3, padding: '11px 13px' }}>
      <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: '#8A7E6A', marginBottom: 6 }}>{titulo}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ ...mono, fontSize: 26, fontWeight: 600, color: meta.ink, lineHeight: 1 }}>{valor}%</span>
        <span style={{ ...mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: meta.ink, background: meta.bg, border: `1px solid ${meta.bd}`, borderRadius: 999, padding: '2px 8px' }}>
          {meta.tag}
        </span>
      </div>
    </div>
  );
}

export default function Semaforo({ favorable = 0, critico = 0, volume = null, isDesktop, compact = false }) {
  const s = conversationState({ favorable, critico, volume });

  // Metadatos de color por nivel para los badges de cada lectura.
  const lvlColors = {
    0: { tag: 'Verde', ink: C.teal, bg: C.tealBg, bd: C.tealBd },
    1: { tag: 'Amarillo', ink: C.amber, bg: C.amberBg, bd: C.amberBd },
    2: { tag: 'Rojo', ink: C.crim, bg: C.crimBg, bd: C.crimBd },
  };
  const insuf = s.insufficient;
  const activeRank = insuf ? -1 : s.rank;

  // ── Modo compacto: reemplaza la tarjeta de riesgo, mismo espacio, sin mover el layout ──
  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center',
        background: insuf ? C.slateBg : s.bg, border: `1px solid ${insuf ? C.slateBd : s.bd}`,
        borderRadius: 3, padding: '13px 15px', height: '100%', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: '0.11em', textTransform: 'uppercase',
            color: insuf ? '#6B6253' : s.c }}>Estado de la Conversación</div>
          {/* Semáforo horizontal compacto */}
          <div style={{ display: 'flex', gap: 5, background: '#211C17', borderRadius: 999, padding: '4px 7px' }}>
            {LIGHTS.map(l => {
              const active = l.rank === activeRank;
              return (
                <span key={l.rank} style={{ width: 10, height: 10, borderRadius: '50%',
                  background: active ? l.on : l.off,
                  boxShadow: active ? `0 0 7px 1px ${l.on}` : 'none' }} />
              );
            })}
          </div>
        </div>

        {insuf ? (
          <>
            <div style={{ fontSize: 19, fontWeight: 600, color: '#6B6253' }}>Muestra insuficiente</div>
            <div style={{ fontSize: 11.5, color: '#6B6253', marginTop: 4, lineHeight: 1.35 }}>
              Volumen bajo el mínimo de {SEMAFORO_MIN_VOLUME} menciones. No se reporta color.
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: isDesktop ? 22 : 20, fontWeight: 600, color: s.c, lineHeight: 1.1 }}>
                {s.label}
              </span>
              <span style={{ ...mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                textTransform: 'uppercase', color: s.c }}>{s.riesgo}</span>
            </div>
            <div style={{ fontSize: 11.5, color: '#5A5044', marginTop: 5, lineHeight: 1.4 }}>{s.meaning}</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 9, paddingTop: 8,
              borderTop: '1px solid rgba(33,28,23,0.10)' }}>
              {[
                { t: 'Fav + Neutral', v: s.favorable, l: s.favLevel },
                { t: 'Crítica', v: s.critico, l: s.critLevel },
              ].map(r => (
                <div key={r.t} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ ...mono, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: '#8A7E6A' }}>{r.t}</span>
                  <span style={{ ...mono, fontSize: 16, fontWeight: 600, color: lvlColors[r.l].ink }}>{r.v}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${insuf ? 'rgba(33,28,23,0.16)' : s.bd}`,
      borderRadius: 3, padding: isDesktop ? 24 : 18, position: 'relative', overflow: 'hidden' }}>

      {/* Franja de color superior */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: insuf ? C.slate : s.c }} />

      <div style={{ display: 'flex', gap: isDesktop ? 24 : 16, flexWrap: 'wrap' }}>

        {/* Semáforo físico */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
          background: '#211C17', borderRadius: 12, padding: '14px 12px', alignSelf: 'flex-start' }}>
          {LIGHTS.map(l => {
            const active = l.rank === activeRank;
            return (
              <div key={l.rank} style={{ width: 30, height: 30, borderRadius: '50%',
                background: active ? l.on : l.off,
                boxShadow: active ? `0 0 14px 2px ${l.on}, inset 0 -2px 4px rgba(0,0,0,0.3)` : 'inset 0 -2px 4px rgba(0,0,0,0.4)',
                border: active ? `1px solid ${l.on}` : '1px solid rgba(255,255,255,0.05)',
                transition: 'all .3s ease' }} />
            );
          })}
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ ...mono, fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: C.gold, fontWeight: 600 }}>
            Estado de la Conversación
          </div>

          {insuf ? (
            <>
              <h2 style={{ fontFamily: "'Geist',sans-serif", fontWeight: 600, fontSize: isDesktop ? 26 : 22,
                color: '#6B6253', margin: '6px 0 8px', letterSpacing: '-0.02em' }}>
                Muestra insuficiente
              </h2>
              <p style={{ fontSize: 13.5, lineHeight: 1.5, color: '#6B6253', margin: 0 }}>
                El volumen ({fmt(volume)} menciones) está por debajo del mínimo de {SEMAFORO_MIN_VOLUME} para
                reportar color con confianza. Se evita marcar un semáforo con datos que darían falsos positivos.
              </p>
            </>
          ) : (
            <>
              <h2 style={{ fontFamily: "'Geist',sans-serif", fontWeight: 600, fontSize: isDesktop ? 27 : 22,
                color: s.c, margin: '6px 0 4px', letterSpacing: '-0.02em' }}>
                {s.label}
              </h2>
              <div style={{ ...mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: s.c, marginBottom: 10 }}>
                {s.riesgo}
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: '#3A332A', margin: '0 0 14px' }}>
                {s.meaning}
              </p>
            </>
          )}

          {/* Dos lecturas */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <ReadingBadge titulo="Favorable + Neutral" valor={s.favorable} level={s.favLevel} colors={lvlColors} />
            <ReadingBadge titulo="Crítica" valor={s.critico} level={s.critLevel} colors={lvlColors} />
          </div>

          {/* Acciones a seguir */}
          {!insuf && (
            <div>
              <div style={{ ...mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#8A7E6A', fontWeight: 600, marginBottom: 8 }}>
                Acción a seguir
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {s.actions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.c,
                      marginTop: 6, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, lineHeight: 1.45, color: '#3A332A' }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reglas operativas */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(33,28,23,0.08)',
        ...mono, fontSize: 10.5, lineHeight: 1.6, color: '#8A7E6A' }}>
        El nivel oficial se evalúa sobre el <b style={{ color: '#6B6253' }}>promedio semanal</b>; el dashboard corre a diario para monitoreo operativo.
        Si un solo día toca <b style={{ color: C.crim }}>rojo</b>, se activa alerta bajo protocolo de crisis.
      </div>
    </div>
  );
}
