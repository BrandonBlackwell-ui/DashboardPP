import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../utils/helpers';
import PlatformIcon from './PlatformIcon';
import ThemeView from './ThemeView';

const SOCIAL_NETS = [
  { key: 'facebook',    label: 'Facebook' },
  { key: 'instagram',   label: 'Instagram' },
  { key: 'x',          label: 'X' },
  { key: 'tiktok',     label: 'TikTok' },
  { key: 'google_news',label: 'Google News' },
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

      {/* Network content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeNet}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
          transition={{ duration:0.18 }}>
          <ThemeView
            tab={activeNet} date={date} plat={plat} data={data}
            isDesktop={isDesktop} noData={noData} calendarSummary={calendarSummary} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
