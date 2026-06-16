import { useEffect, useRef, useState } from 'react';
import { C } from '../utils/helpers';

export default function Donut({ pos, neu, neg, size = 80, showLabel = false }) {
  const [animated, setAnimated] = useState({ pos: 0, neu: 0, neg: 0 });
  const raf = useRef(null);

  useEffect(() => {
    const target = { pos: Math.round(pos||0), neu: Math.round(neu||0), neg: Math.round(neg||0) };
    const duration = 900;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setAnimated({
        pos: target.pos * ease,
        neu: target.neu * ease,
        neg: target.neg * ease,
      });
      if (t < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [pos, neu, neg]);

  const stroke = Math.round(size * 0.15);
  const p = animated.pos, n = animated.neu;
  const gradient = `conic-gradient(${C.teal} 0 ${p}%, ${C.slate} ${p}% ${p+n}%, ${C.crim} ${p+n}% 100%)`;

  return (
    <div style={{ position:'relative', width:size, height:size, borderRadius:'50%',
      background:gradient, flex:'none',
      filter:'drop-shadow(0 2px 8px rgba(33,28,23,0.15))' }}>
      <div style={{ position:'absolute', inset:stroke, borderRadius:'50%', background:'#FBF8F1',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontFamily:"'Geist',sans-serif", fontWeight:700,
          fontSize:Math.round(size*0.26), lineHeight:1, color:C.ink, letterSpacing:'-0.02em' }}>
          {Math.round(animated.neg)}%
        </span>
        {showLabel && (
          <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:Math.max(6,Math.round(size*0.09)),
            letterSpacing:'0.1em', textTransform:'uppercase', color:'#8A7E6A', marginTop:2 }}>
            Crít.
          </span>
        )}
      </div>
    </div>
  );
}
