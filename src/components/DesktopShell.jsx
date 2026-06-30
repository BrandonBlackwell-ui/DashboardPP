import { motion } from 'framer-motion';
import ParticleBackground from './ParticleBackground';
import { C } from '../utils/helpers';

const SIDEBAR_W = 240;

export default function DesktopShell({ tab, data, pano, onTabChange, onExport, children }) {
  const T = data?.themes || {};
  const order = data?.order || [];
  const rawMode = data?.meta?.source === 'apify_local' || T?.resumen?.rawOnly;

  const tabs = [
    { key: 'panorama', label: 'Panorama' },
    ...order.map(k => ({ key: k, label: T[k]?.label || k })),
    ...(!rawMode ? [
      { key: 'historico', label: 'Histórico' },
      { key: 'reporte', label: 'Reporte' },
    ] : []),
  ].filter(t => T[t.key] || t.key === 'panorama' || !rawMode);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Sidebar */}
      <div style={{
        width: SIDEBAR_W,
        minWidth: SIDEBAR_W,
        background: '#211C17',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        overflow: 'hidden',
      }}>
        <ParticleBackground />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Wordmark */}
          <div style={{ padding: '22px 20px 18px' }}>
            <motion.span
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{ display: 'inline-block', lineHeight: 1 }}>
              <span style={{
                fontFamily: "'Geist',sans-serif", fontWeight: 900, letterSpacing: '-0.04em',
                color: '#EFE9DC', fontSize: 22, display: 'inline-block', lineHeight: 1,
              }}>Blackwell</span>
              <span style={{ display: 'block', height: 2, width: '100%', background: '#EFE9DC', borderRadius: 1, marginTop: 2 }} />
            </motion.span>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9 }}>
              <motion.span
                animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                style={{ width: 6, height: 6, background: C.gold, borderRadius: '50%', flex: 'none' }} />
              <span style={{
                fontFamily: "'Geist Mono',monospace", fontSize: 9.5, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: C.gold, fontWeight: 600, lineHeight: 1.3,
              }}>
                Brief Diario · Pepe Aguilar
              </span>
            </motion.div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 20px' }} />

          {/* Nav label */}
          <div style={{
            fontFamily: "'Geist Mono',monospace", fontSize: 8.5, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', padding: '14px 20px 8px',
          }}>Navegación</div>

          {/* Tabs */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '0 12px', scrollbarWidth: 'none' }}>
            {tabs.map(t => {
              const isActive = tab === t.key;
              return (
                <motion.button
                  key={t.key}
                  onClick={() => onTabChange(t.key)}
                  whileHover={!isActive ? { background: 'rgba(255,255,255,0.06)' } : {}}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    fontFamily: "'Geist Mono',monospace", fontWeight: 600,
                    fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '10px 12px', borderRadius: 3, cursor: 'pointer',
                    border: 'none', marginBottom: 2,
                    background: isActive ? C.gold : 'transparent',
                    color: isActive ? '#FBF8F1' : 'rgba(239,233,220,0.65)',
                    transition: 'all 0.15s',
                  }}>
                  {t.label}
                </motion.button>
              );
            })}
          </nav>

          {/* Bottom buttons */}
          <div style={{ padding: '16px 12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <motion.button
              whileHover={{ background: '#EFE9DC', color: '#211C17' }} whileTap={{ scale: 0.95 }}
              onClick={onExport}
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                fontFamily: "'Geist Mono',monospace", fontSize: 10, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '9px 12px', borderRadius: 2, cursor: 'pointer',
                border: '1px solid rgba(239,233,220,0.45)', background: 'transparent',
                color: '#EFE9DC', marginBottom: 7, transition: 'all 0.15s',
              }}>
              Exportar ↓
            </motion.button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div style={{
        marginLeft: SIDEBAR_W,
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 900,
          minHeight: '100vh',
          background: '#EFE9DC',
          backgroundImage: 'linear-gradient(rgba(33,28,23,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(33,28,23,0.05) 1px,transparent 1px)',
          backgroundSize: '24px 24px',
          position: 'relative',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
