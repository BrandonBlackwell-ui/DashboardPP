import { useState } from 'react';
import { motion } from 'framer-motion';

const CORRECT_PW = 'pp2026';

const GRID_BG = {
  backgroundImage: 'linear-gradient(rgba(33,28,23,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(33,28,23,0.07) 1px,transparent 1px)',
  backgroundSize: '24px 24px',
};

export default function LoginGate({ onAuth }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [showPw, setShowPw] = useState(false);

  function submit() {
    if (pw === CORRECT_PW) {
      sessionStorage.setItem('bw_auth', '1');
      onAuth();
    } else {
      setError('Contraseña incorrecta');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') submit();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#241E18',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Geist', system-ui, sans-serif",
    }}>
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: '#EFE9DC',
          borderRadius: 4,
          width: '100%',
          maxWidth: 360,
          padding: '40px 36px 36px',
          position: 'relative',
          overflow: 'hidden',
          ...GRID_BG,
        }}
      >
        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontFamily: "'Geist', sans-serif",
            fontWeight: 900,
            letterSpacing: '-0.04em',
            fontSize: 28,
            color: '#211C17',
            lineHeight: 1,
          }}>
            Blackwell
          </div>
          <div style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#B0822F',
            marginTop: 5,
          }}>
            Strategy · Acceso privado
          </div>
        </div>

        {/* Input */}
        <motion.div
          animate={shake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.5 }}
          style={{ position: 'relative', marginBottom: 8 }}
        >
          <input
            type={showPw ? 'text' : 'password'}
            value={pw}
            onChange={e => { setPw(e.target.value); setError(''); }}
            onKeyDown={handleKey}
            placeholder="Contraseña de acceso"
            autoFocus
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '11px 44px 11px 14px',
              border: error ? '1.5px solid #9B3331' : '1.5px solid #C8BCA8',
              borderRadius: 3,
              background: '#FAF7F2',
              fontFamily: "'Geist', sans-serif",
              fontSize: 14,
              color: '#211C17',
              outline: 'none',
              letterSpacing: showPw ? 'normal' : '0.12em',
            }}
          />
          <button
            onClick={() => setShowPw(v => !v)}
            tabIndex={-1}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, color: '#8A7E6E', lineHeight: 1, padding: 0,
            }}
            aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPw ? '●' : '○'}
          </button>
        </motion.div>

        {/* Error */}
        <div style={{
          minHeight: 18,
          fontFamily: "'Geist Mono', monospace",
          fontSize: 10.5,
          letterSpacing: '0.04em',
          color: '#9B3331',
          marginBottom: 18,
          textAlign: 'center',
        }}>
          {error}
        </div>

        {/* Submit button */}
        <button
          onClick={submit}
          style={{
            width: '100%',
            padding: '11px 0',
            background: '#211C17',
            color: '#EFE9DC',
            border: 'none',
            borderRadius: 3,
            fontFamily: "'Geist', sans-serif",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Ingresar
        </button>
      </motion.div>
    </div>
  );
}
