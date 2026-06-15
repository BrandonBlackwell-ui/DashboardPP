import { useEffect, useRef, useState } from 'react';

export default function AnimatedNumber({ value, style }) {
  const raw = parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;
  const suffix = String(value).replace(/[0-9.,]/g, '');
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    const duration = 1000;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(raw * ease));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [raw]);

  return (
    <span style={style}>
      {display.toLocaleString('es-MX')}{suffix}
    </span>
  );
}
