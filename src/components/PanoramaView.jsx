import { motion } from 'framer-motion';
import Donut from './Donut';
import TiltCard from './TiltCard';
import AnimatedNumber from './AnimatedNumber';
import { C, fmt, fmtK, riskMeta, pill } from '../utils/helpers';

const stagger = { hidden:{}, visible:{ transition:{ staggerChildren:0.07 } } };
const item = { hidden:{ opacity:0, y:16 }, visible:{ opacity:1, y:0, transition:{ type:'spring', stiffness:260, damping:22 } } };

function SentLegend({ pos, neu, neg }) {
  return [
    { color:C.teal, label:'Favorable', pct:Math.round(pos)+'%' },
    { color:C.slate, label:'Neutral', pct:Math.round(neu)+'%' },
    { color:C.crim, label:'Crítica', pct:Math.round(neg)+'%' },
  ].map(l => (
    <div key={l.label} style={{ display:'flex', alignItems:'center', gap:9, marginBottom:9 }}>
      <span style={{ width:8,height:8,borderRadius:'50%',flex:'none',background:l.color }} />
      <span style={{ fontSize:12.5, color:'#2A241C', flex:1 }}>{l.label}</span>
      <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:13, color:C.ink }}>{l.pct}</span>
    </div>
  ));
}

function KPIs({ kpis }) {
  return (
    <div style={{ display:'flex', gap:8 }}>
      {kpis.map(k => (
        <motion.div key={k.label} variants={item}
          style={{ flex:1, background:k.bg, border:`1px solid ${k.border}`, borderRadius:2,
            padding:'13px 13px 11px', position:'relative', overflow:'hidden' }}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, letterSpacing:'0.12em',
            textTransform:'uppercase', color:k.lblColor }}>{k.label}</div>
          <AnimatedNumber value={k.value}
            style={{ display:'block', fontSize:27, fontWeight:600, lineHeight:1.05,
              letterSpacing:'-0.02em', color:k.valColor, marginTop:4 }} />
        </motion.div>
      ))}
    </div>
  );
}

export default function PanoramaView({ pano, data, onGoTheme, isDesktop }) {
  const T = data.themes, order = data.order;

  let p=0,n=0,g=0;
  order.forEach(k => { const s=T[k].sentiment; if(s){p+=s.posC||0;n+=s.neuC||0;g+=s.negC||0;} });
  const tot=p+n+g||1;
  const aPos=Math.round(p/tot*100), aNeg=Math.round(g/tot*100), aNeu=100-aPos-aNeg;

  let totPosts=0, totInf=0;
  order.forEach(k => { totPosts+=T[k].totals?.posts||0; totInf+=T[k].influencers?.total||0; });

  const kpis = [
    { label:'Menciones', value:fmt(tot), bg:C.ink, border:C.ink, lblColor:'rgba(255,255,255,0.65)', valColor:'#FBF8F1' },
    { label:'Posts', value:fmt(totPosts), bg:C.card, border:'rgba(33,28,23,0.13)', lblColor:'#6B6253', valColor:C.ink },
    { label:'Influencers', value:fmt(totInf), bg:C.card, border:'rgba(33,28,23,0.13)', lblColor:'#6B6253', valColor:C.ink },
  ];

  const cards = order.map(k => {
    const t=T[k]; const s=t.sentiment||{pos:0,neu:0,neg:0}; const rm=riskMeta(t.risk?.level);
    return { key:k, label:t.label, es:t.es, accent:rm.c, pos:s.pos, neu:s.neu, neg:s.neg,
      riskLabel:rm.label, pillStyle:rm, metaLine:fmt(t.totals?.posts||0)+' posts · '+(t.influencers?.total||0)+' influencers',
      onClick:()=>onGoTheme(k) };
  });

  const attention = [...cards].sort((a,b) => b.neg - a.neg);

  return (
    <motion.div key={pano} variants={stagger} initial="hidden" animate="visible"
      style={{ padding: isDesktop ? '24px 28px 6px' : '20px 18px 6px' }}>

      {/* Editorial */}
      {pano==='editorial' && (<>
        <motion.div variants={item}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.16em',
            textTransform:'uppercase', color:C.gold, fontWeight:600 }}>
            Resumen del periodo · {data.meta.range_label}
          </div>
          <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:31, lineHeight:1.05,
            letterSpacing:'-0.025em', color:C.ink, margin:'9px 0 10px' }}>
            Estado de la <em style={{ fontStyle:'normal', color:C.goldDeep }}>conversación</em>.
          </h1>
          <p style={{ fontSize:14, lineHeight:1.6, color:'#6B6253', margin:'0 0 18px' }}>
            {aPos}% de la conversación es favorable y {aNeg}% crítica, sobre {fmt(tot)} menciones en cuatro temas.
          </p>
        </motion.div>

        <motion.div variants={item}
          style={{ display:'flex', alignItems:'center', gap:18, background:C.card,
            border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:18 }}>
          <Donut pos={aPos} neu={aNeu} neg={aNeg} size={104} showLabel />
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9.5, letterSpacing:'0.14em',
              textTransform:'uppercase', color:'#6B6253', marginBottom:10 }}>Sentimiento agregado</div>
            <SentLegend pos={aPos} neu={aNeu} neg={aNeg} />
          </div>
        </motion.div>

        <motion.div variants={item} style={{ marginTop:12 }}>
          <KPIs kpis={kpis} />
        </motion.div>

        <motion.div variants={item} style={{ marginTop:22, borderTop:`2px solid ${C.ink}`, paddingTop:13 }}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.16em',
            textTransform:'uppercase', color:C.gold, fontWeight:600, marginBottom:11 }}>Temas monitoreados</div>
          <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap:9 }}>
            {cards.map(c => (
              <TiltCard key={c.key} onClick={c.onClick}
                style={{ display:'flex', alignItems:'center', gap:14, background:C.card,
                  border:'1px solid rgba(33,28,23,0.13)', borderLeft:`3px solid ${c.accent}`,
                  borderRadius:3, padding:'13px 15px', width:'100%', textAlign:'left' }}>
                <Donut pos={c.pos} neu={c.neu} neg={c.neg} size={52} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:17,
                      letterSpacing:'-0.01em', color:C.ink }}>{c.label}</span>
                    <span style={{ ...pill(c.pillStyle.ink,c.pillStyle.bg,c.pillStyle.bd) }}>{c.riskLabel}</span>
                  </div>
                  <div style={{ fontSize:11.5, color:'#6B6253', marginTop:4, lineHeight:1.4 }}>{c.es}</div>
                  <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.05em',
                    color:'#8A7E6A', marginTop:6, textTransform:'uppercase' }}>{c.metaLine}</div>
                </div>
                <span style={{ fontFamily:"'Geist Mono',monospace", color:C.gold, fontSize:13 }}>→</span>
              </TiltCard>
            ))}
          </div>
        </motion.div>
      </>)}

      {/* Mosaico */}
      {pano==='mosaico' && (<>
        <motion.div variants={item}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.16em',
            textTransform:'uppercase', color:C.gold, fontWeight:600 }}>Cuatro temas · {data.meta.range_label}</div>
          <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:27, lineHeight:1.05,
            letterSpacing:'-0.025em', color:C.ink, margin:'8px 0 16px' }}>
            Vista por <em style={{ fontStyle:'normal', color:C.goldDeep }}>tema</em>.
          </h1>
        </motion.div>
        <div style={{ display:'grid', gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : '1fr 1fr', gap:9 }}>
          {cards.map(c => (
            <TiltCard key={c.key} onClick={c.onClick}
              style={{ textAlign:'left', background:C.card, border:'1px solid rgba(33,28,23,0.13)',
                borderTop:`3px solid ${c.accent}`, borderRadius:3, padding:'15px 13px',
                display:'flex', flexDirection:'column', alignItems:'center' }}>
              <Donut pos={c.pos} neu={c.neu} neg={c.neg} size={76} showLabel />
              <div style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:17,
                letterSpacing:'-0.01em', color:C.ink, marginTop:12 }}>{c.label}</div>
              <span style={{ ...pill(c.pillStyle.ink,c.pillStyle.bg,c.pillStyle.bd), marginTop:7 }}>{c.riskLabel}</span>
              <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:9, letterSpacing:'0.05em',
                color:'#8A7E6A', marginTop:9, textAlign:'center', textTransform:'uppercase' }}>{c.metaLine}</div>
            </TiltCard>
          ))}
        </div>
        <motion.div variants={item} style={{ marginTop:12 }}><KPIs kpis={kpis} /></motion.div>
      </>)}

      {/* Resumen */}
      {pano==='resumen' && (<>
        <motion.div variants={item}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.16em',
            textTransform:'uppercase', color:C.gold, fontWeight:600 }}>Priorización · {data.meta.range_label}</div>
          <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:27, lineHeight:1.05,
            letterSpacing:'-0.025em', color:C.ink, margin:'8px 0 4px' }}>
            Lo que <em style={{ fontStyle:'normal', color:C.goldDeep }}>requiere atención</em>.
          </h1>
          <p style={{ fontSize:13, color:'#6B6253', margin:'0 0 16px' }}>Temas ordenados por nivel de riesgo.</p>
        </motion.div>
        <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap:8, marginBottom:8 }}>
        {attention.map((a, i) => (
          <TiltCard key={a.key} onClick={a.onClick}
            style={{ width:'100%', textAlign:'left', display:'flex', gap:13, alignItems:'flex-start',
              background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderLeft:`3px solid ${a.accent}`,
              borderRadius:3, padding:14 }}>
            <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#8A7E6A',
              flex:'none', paddingTop:2 }}>{String(i+1).padStart(2,'0')}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:16,
                  letterSpacing:'-0.01em', color:C.ink }}>{a.label}</span>
                <span style={{ ...pill(a.pillStyle.ink,a.pillStyle.bg,a.pillStyle.bd) }}>{a.riskLabel}</span>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:9, alignItems:'center' }}>
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, fontWeight:500,
                  color:C.teal, letterSpacing:'0.04em' }}>{Math.round(a.pos)}% FAVORABLE</span>
                <span style={{ width:3,height:3,borderRadius:'50%',background:'#A9997B' }} />
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, fontWeight:500,
                  color:C.crim, letterSpacing:'0.04em' }}>{Math.round(a.neg)}% CRÍTICA</span>
              </div>
            </div>
            <span style={{ fontFamily:"'Geist Mono',monospace", color:C.gold, fontSize:13 }}>→</span>
          </TiltCard>
        ))}
        </div>
        <motion.div variants={item} style={{ marginTop:6 }}><KPIs kpis={kpis} /></motion.div>
      </>)}
    </motion.div>
  );
}
