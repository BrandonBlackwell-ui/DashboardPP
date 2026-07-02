import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../utils/helpers';
import PlatformIcon from './PlatformIcon';
import ThemeView from './ThemeView';
import TrendChart from './TrendChart';

const SOCIAL_NETS = [
  { key: 'facebook',    label: 'Facebook',    color:'#1877F2' },
  { key: 'instagram',   label: 'Instagram',   color:'#D62976' },
  { key: 'x',          label: 'X',            color:'#111111' },
  { key: 'tiktok',     label: 'TikTok',       color:'#FE2C55' },
  { key: 'google_news',label: 'Google News',  color:'#4285F4' },
];

export default function SocialListeningView({ activeNet, onNetChange, date, plat, data, isDesktop, noData, calendarSummary }) {
  const available = SOCIAL_NETS.filter(n => data?.themes?.[n.key]);

  return (
    <div>
      {/* Network switcher strip */}
      <div style={{ position:'sticky', top:0, zIndex:20, background:'#EFE9DC',
        borderBottom:'1px solid rgba(33,28,23,0.12)', padding:'0 28px' }}>
        <div style={{ display:'flex', gap:2, overflowX:'auto', scrollbarWidth:'none', paddingTop:10, paddingBottom:0 }}>
          {available.map(n => {
            const isActive = activeNet === n.key;
            return (
              <motion.button
                key={n.key}
                onClick={() => onNetChange(n.key)}
                whileTap={{ scale: 0.96 }}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px 9px',
                  fontFamily:"'Geist Mono',monospace", fontSize:10.5, fontWeight:700,
                  letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer',
                  border:'none', background:'transparent', flex:'none',
                  color: isActive ? C.ink : 'rgba(33,28,23,0.4)',
                  borderBottom: isActive ? `2px solid ${C.ink}` : '2px solid transparent',
                  transition:'all 0.15s', marginBottom:-1 }}>
                <PlatformIcon platform={n.key} size={13} />
                {n.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Tendencia — solo redes de social listening */}
      {window.CALENDAR_DATA?.days && (
        <div style={{ padding: isDesktop ? '16px 28px 0' : '14px 18px 0' }}>
          <TrendChart
            days={window.CALENDAR_DATA.days}
            topics={SOCIAL_NETS}
            title="Evolución del sentimiento · Social Listening" />
        </div>
      )}

      {/* Network content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeNet}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
          transition={{ duration:0.18 }}>
          <ThemeView
            tab={activeNet} date={date} plat={plat} data={data}
            isDesktop={isDesktop} noData={noData} calendarSummary={calendarSummary}
            isSocialListening={true} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
