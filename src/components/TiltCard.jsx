import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function TiltCard({ children, style, onClick, className }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  function handleMove(e) {
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: dy * -6, y: dx * 6 });
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setTilt({ x:0, y:0 }); setHovered(false); }}
      animate={{
        rotateX: tilt.x,
        rotateY: tilt.y,
        scale: hovered ? 1.015 : 1,
        boxShadow: hovered
          ? '0 12px 32px rgba(33,28,23,0.18), 0 2px 8px rgba(33,28,23,0.10)'
          : '0 2px 8px rgba(33,28,23,0.08)',
      }}
      transition={{ type:'spring', stiffness:300, damping:25 }}
      style={{ ...style, transformStyle:'preserve-3d', cursor: onClick ? 'pointer' : 'default' }}
    >
      {children}
    </motion.div>
  );
}
