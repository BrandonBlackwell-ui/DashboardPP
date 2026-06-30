import { motion } from 'framer-motion';
import Donut from './Donut';
import { C, riskMeta, pill } from '../utils/helpers';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } } };

export default function PanoramaView({ data, isDesktop }) {
  const resumenTheme = data?.themes?.resumen;
  const ai = resumenTheme?.ai_analysis;

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
          El análisis reputacional consolidado aún no ha sido procesado por Claude 3.5 Sonnet en Supabase para esta fecha.
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
              npx tsx scripts/generate-ai-analysis.js TU_OPENROUTER_KEY
            </code>
          </div>
        </div>
      </motion.div>
    );
  }

  // AI analysis loaded successfully!
  const sent = ai.sentimiento || { favorable: 0, neutral: 100, critico: 0 };
  const rm = riskMeta(ai.nivel_riesgo);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible"
      style={{ padding: isDesktop ? '32px 36px 36px' : '20px 18px 36px' }}>

      {/* Header section */}
      <motion.div variants={item} style={{ display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:24, borderBottom:'1px solid #E3DAC6', paddingBottom:16 }}>
        <div>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.16em', textTransform:'uppercase', color:C.gold, fontWeight:600 }}>
            Análisis de Crisis y Reputación · IA
          </div>
          <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:isDesktop ? 34 : 29, lineHeight:1.05, letterSpacing:'-0.025em', color:C.ink, margin:'8px 0 0' }}>
            Panorama General.
          </h1>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:C.card, border:'1px solid rgba(176,130,47,0.22)', padding:'6px 12px', borderRadius:3 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:C.teal, display:'inline-block', boxShadow:`0 0 8px ${C.teal}` }} />
          <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, fontWeight:600, color:C.goldDeep, textTransform:'uppercase' }}>Claude 3.5 Sonnet Activo</span>
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

        {/* Risk Card */}
        <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', background:rm.bg, border:`1px solid ${rm.bd}`, borderRadius:3, padding:20, position:'relative', overflow:'hidden' }}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:rm.ink }}>NIVEL DE RIESGO DE CRISIS</div>
          <div style={{ fontSize:32, fontWeight:600, color:rm.ink, marginTop:4, textTransform:'capitalize' }}>
            {rm.label.replace('_', ' ')}
          </div>
          <div style={{ fontSize:13, color:'#6B6253', marginTop:6, lineHeight:1.4 }}>
            Evaluación experta basada en el impacto de los focos críticos detectados.
          </div>
        </div>

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
          <div style={{ fontSize:15, lineHeight:1.65, color:'#2A241C', whiteSpace:'pre-line' }}>
            {ai.resumen_ejecutivo}
          </div>
        </div>
      </motion.div>

      {/* Alerts / Red Flags Block */}
      {ai.alertas && ai.alertas.length > 0 && (
        <motion.div variants={item} style={{ marginBottom:20 }}>
          <div style={{ background:'rgba(220,53,69,0.03)', border:`1px solid ${C.crimBd}`, borderRadius:3, padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.crim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <h2 style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:18, color:C.crim, margin:0 }}>Alertas de Crisis & Focos Rojos</h2>
            </div>
            <ul style={{ margin:0, paddingLeft:20, display:'flex', flexDirection:'column', gap:8 }}>
              {ai.alertas.map((a, i) => (
                <li key={i} style={{ fontSize:14.5, lineHeight:1.5, color:'#4A2C2A' }}>
                  {a}
                </li>
              ))}
            </ul>
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
          <ul style={{ margin:0, paddingLeft:20, display:'flex', flexDirection:'column', gap:10 }}>
            {ai.plan_accion?.map((item, idx) => (
              <li key={idx} style={{ fontSize:14, lineHeight:1.45, color:'#2A241C' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Areas of Opportunity */}
        <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <span style={{ ...pill(C.teal,C.tealBg,C.tealBd) }}>RECOMENDACIÓN</span>
            <h3 style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:17, color:C.ink, margin:0 }}>Mejoras y Oportunidades</h3>
          </div>
          <ul style={{ margin:0, paddingLeft:20, display:'flex', flexDirection:'column', gap:10 }}>
            {ai.oportunidades?.map((item, idx) => (
              <li key={idx} style={{ fontSize:14, lineHeight:1.45, color:'#2A241C' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

      </motion.div>

      {/* Voices Summary (Allies and Critics) */}
      {ai.analisis_voces && (
        <motion.div variants={item}>
          <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:20 }}>
            <h2 style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:19, color:C.ink, margin:'0 0 16px 0', borderBottom:'1px solid rgba(33,28,23,0.08)', paddingBottom:8 }}>
              Líderes de Opinión Relevantes (Resumen de Voces)
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:isDesktop ? '1fr 1fr' : '1fr', gap:16 }}>
              
              {/* Allies */}
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:C.teal }} />
                  <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, fontWeight:700, color:C.teal, textTransform:'uppercase' }}>Aliados Destacados</span>
                </div>
                {ai.analisis_voces.aliados_destacados?.map((v, i) => (
                  <div key={i} style={{ background:'#F8F4EA', border:'1px solid rgba(33,28,23,0.06)', borderRadius:3, padding:12, marginBottom:8 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:C.ink }}>@{v.username}</div>
                    <div style={{ fontSize:12.5, color:'#6B6253', marginTop:4, fontStyle:'italic' }}>"{v.comentario_o_post}"</div>
                    <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:C.teal, marginTop:6, textTransform:'uppercase' }}>IMPACTO: {v.impacto}</div>
                  </div>
                ))}
              </div>

              {/* Critics */}
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:C.crim }} />
                  <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, fontWeight:700, color:C.crim, textTransform:'uppercase' }}>Críticos Destacados</span>
                </div>
                {ai.analisis_voces.criticos_destacados?.map((v, i) => (
                  <div key={i} style={{ background:'#FAF0EE', border:'1px solid rgba(220,53,69,0.06)', borderRadius:3, padding:12, marginBottom:8 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:C.ink }}>@{v.username}</div>
                    <div style={{ fontSize:12.5, color:'#6B6253', marginTop:4, fontStyle:'italic' }}>"{v.comentario_o_post}"</div>
                    <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, color:C.crim, marginTop:6, textTransform:'uppercase' }}>IMPACTO: {v.impacto}</div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </motion.div>
      )}

    </motion.div>
  );
}
