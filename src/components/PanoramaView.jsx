import { useState } from 'react';
import { motion } from 'framer-motion';
import Donut from './Donut';
import TiltCard from './TiltCard';
import AnimatedNumber from './AnimatedNumber';
import { C, fmt, fmtK, riskMeta, pill } from '../utils/helpers';

const stagger = { hidden:{}, visible:{ transition:{ staggerChildren:0.07 } } };
const item = { hidden:{ opacity:0, y:16 }, visible:{ opacity:1, y:0, transition:{ type:'spring', stiffness:260, damping:22 } } };

function fmt1(n) { return (Math.round((n||0)*10)/10).toFixed(1)+'%'; }

function SentLegend({ pos, neu, neg }) {
  return [
    { color:C.teal, label:'Favorable', pct:fmt1(pos) },
    { color:C.slate, label:'Neutral', pct:fmt1(neu) },
    { color:C.crim, label:'Crítica', pct:fmt1(neg) },
  ].map(l => (
    <div key={l.label} style={{ display:'flex', alignItems:'center', gap:9, marginBottom:9 }}>
      <span style={{ width:8,height:8,borderRadius:'50%',flex:'none',background:l.color }} />
      <span style={{ fontSize:14, color:'#2A241C', flex:1 }}>{l.label}</span>
      <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:600, fontSize:14, color:C.ink }}>{l.pct}</span>
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
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.12em',
            textTransform:'uppercase', color:k.lblColor }}>{k.label}</div>
          <AnimatedNumber value={k.value}
            style={{ display:'block', fontSize:30, fontWeight:600, lineHeight:1.05,
              letterSpacing:'-0.02em', color:k.valColor, marginTop:4 }} />
        </motion.div>
      ))}
    </div>
  );
}

function RawNetworkIcon({ platform }) {
  const p = (platform || '').toLowerCase();
  if (p === 'x') return <span style={{ width:24, height:24, borderRadius:5, background:'#000', color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14 }}>X</span>;
  if (p === 'google_news') return <span style={{ width:24, height:24, borderRadius:5, background:'#fff', border:'1px solid rgba(33,28,23,0.14)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>G</span>;
  if (p === 'facebook') return <span style={{ width:24, height:24, borderRadius:5, background:'#1877F2', color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:17 }}>f</span>;
  if (p === 'instagram') return <span style={{ width:24, height:24, borderRadius:5, background:'linear-gradient(135deg,#f58529 0%,#dd2a7b 45%,#8134af 75%,#515bd4 100%)', color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13 }}>◎</span>;
  if (p === 'tiktok') return <span style={{ width:24, height:24, borderRadius:5, background:'#050505', color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14 }}>♪</span>;
  return <span style={{ width:24, height:24, borderRadius:5, background:C.ink, display:'inline-block' }} />;
}

function RawApifyPanorama({ data, isDesktop }) {
  const networks = data.themes?.resumen?.networkStrategy?.networks || [];
  const [selected, setSelected] = useState(networks[0]?.key || null);
  const active = networks.find(n => n.key === selected) || networks[0];
  const posts = active?.postsList || [];
  const actors = data.themes?.resumen?.sourceMeta?.actors || [];
  const actor = actors.find(a => a.platform === active?.key);
  const totals = networks.reduce((sum, n) => sum + (n.posts || 0), 0);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible"
      style={{ padding:isDesktop ? '24px 28px 28px' : '20px 18px 28px' }}>
      <motion.div variants={item}>
        <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.16em', textTransform:'uppercase', color:C.gold, fontWeight:600 }}>
          Apify raw · {data.meta.range_label}
        </div>
        <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:isDesktop ? 36 : 31, lineHeight:1.05, letterSpacing:'-0.025em', color:C.ink, margin:'9px 0 8px' }}>
          Publicaciones por red.
        </h1>
        <p style={{ fontSize:14, lineHeight:1.55, color:'#6B6253', margin:'0 0 18px' }}>
          Extraccion directa de Apify. Sin clasificacion de IA, sentimiento, riesgo ni aliados.
        </p>
      </motion.div>

      <motion.div variants={item} style={{ display:'grid', gridTemplateColumns:isDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap:9 }}>
        {networks.map(n => {
          const activeCard = n.key === active?.key;
          return (
            <button key={n.key} onClick={() => setSelected(n.key)}
              style={{ background:C.card, border:activeCard ? `1px solid ${C.gold}` : '1px solid rgba(33,28,23,0.13)',
                borderRadius:3, padding:16, textAlign:'left', cursor:'pointer', boxShadow:activeCard ? '0 0 0 1px rgba(176,130,47,0.18)' : 'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <RawNetworkIcon platform={n.key} />
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Geist Mono',monospace", fontWeight:700, fontSize:12, letterSpacing:'0.08em', color:C.ink, textTransform:'uppercase' }}>{n.label}</div>
                  <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, color:'#8A7E6A', marginTop:3 }}>{fmt(n.posts)} publicaciones</div>
                </div>
                <div style={{ fontFamily:"'Geist Mono',monospace", fontWeight:700, fontSize:24, color:C.ink }}>{n.share}%</div>
              </div>
            </button>
          );
        })}
      </motion.div>

      <motion.div variants={item} style={{ marginTop:12, display:'grid', gridTemplateColumns:isDesktop ? '1fr 1fr 1fr 1.35fr' : '1fr', gap:8 }}>
        <div style={{ background:C.ink, color:'#FBF8F1', borderRadius:3, padding:'14px 15px' }}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(255,255,255,0.65)' }}>Total raw</div>
          <div style={{ fontSize:30, fontWeight:600, lineHeight:1, marginTop:5 }}>{fmt(totals)}</div>
        </div>
        <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:'14px 15px' }}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8A7E6A' }}>Actor</div>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:C.ink, marginTop:7, overflowWrap:'anywhere' }}>{actor?.name || 'Sin actor'}</div>
        </div>
        <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:'14px 15px' }}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8A7E6A' }}>Costo prueba</div>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:C.ink, marginTop:7 }}>{actor?.cost || 'Sin dato'}</div>
        </div>
        <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:'14px 15px' }}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8A7E6A' }}>Criterio</div>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11.5, lineHeight:1.35, color:C.ink, marginTop:7 }}>{actor?.status || 'Sin criterio'}</div>
        </div>
      </motion.div>

      <motion.div variants={item} style={{ marginTop:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:12, marginBottom:10 }}>
          <h2 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:24, color:C.ink, margin:0 }}>
            Publicaciones de {active?.label || ''}
          </h2>
          <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, color:'#8A7E6A' }}>{fmt(posts.length)} items</span>
        </div>
        <div style={{ background:C.card, border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, overflow:'hidden' }}>
          {[...posts].sort((a, b) => ((b.reactions || b.likes || 0) + (b.retweets || 0) * 3 + (b.quotes || 0) * 2 + (b.comments || 0) * 2 + (b.shares || 0) * 3 + (b.bookmarks || 0)) - ((a.reactions || a.likes || 0) + (a.retweets || 0) * 3 + (a.quotes || 0) * 2 + (a.comments || 0) * 2 + (a.shares || 0) * 3 + (a.bookmarks || 0))).map((p, i) => {
            const directHref = p.url || p.sourceUrl || '';
            const searchHref = !directHref && active?.key === 'x'
              ? `https://x.com/search?q=${encodeURIComponent(`${p.username || ''} ${p.text || ''}`)}&src=typed_query&f=live`
              : '';
            const href = directHref || searchHref;
            const clickable = !!href;
            const linkLabel = directHref ? (p.urlVerified ? 'link verificado' : 'link Apify') : searchHref ? (p.type === 'reply' ? 'buscar respuesta' : 'buscar en X') : 'sin link';
            const actionLabel = directHref ? 'ABRIR' : searchHref ? (p.type === 'reply' ? 'BUSCAR REPLY' : 'BUSCAR') : 'NO LINK';
            const RowTag = clickable ? 'a' : 'div';
            return (
              <RowTag key={`${p.username}-${p.time}-${i}`} href={clickable ? href : undefined} target={clickable ? '_blank' : undefined} rel={clickable ? 'noopener' : undefined}
                style={{ display:'grid', gridTemplateColumns:isDesktop ? '1fr 150px 86px' : '1fr', gap:10, padding:'13px 15px',
                  textDecoration:'none', borderBottom:i<posts.length-1?'1px solid rgba(33,28,23,0.08)':'none' }}>
                <span style={{ minWidth:0 }}>
                  <span style={{ display:'block', fontSize:14, color:C.ink, lineHeight:1.4 }}>{p.text}</span>
                  {p.type === 'reply' && (
                    <span style={{ display:'block', fontSize:12, color:'#6B6253', lineHeight:1.35, marginTop:6 }}>
                      Respuesta en hilo{p.contextAuthor ? ` de @${p.contextAuthor}` : ''}{p.contextText ? ` · ${p.contextText}` : ''}
                    </span>
                  )}
                  <span style={{ display:'block', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', marginTop:5, textTransform:'uppercase' }}>
                    {[p.authorName || p.username, p.username ? `@${p.username}` : '', (p.time || '').slice(0,10), p.followers ? `${fmtK(p.followers)} seguidores` : '', p.views ? `${fmtK(p.views)} views` : '', p.reactions ? `${fmtK(p.reactions)} reacciones` : '', !p.reactions && p.likes ? `${fmtK(p.likes)} likes` : '', p.retweets ? `${fmtK(p.retweets)} rt` : '', p.shares ? `${fmtK(p.shares)} shares` : '', p.bookmarks ? `${fmtK(p.bookmarks)} guardados` : '', p.quotes ? `${fmtK(p.quotes)} quotes` : '', p.comments ? `${fmtK(p.comments)} replies` : ''].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {isDesktop && <span style={{ alignSelf:'center', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:'#8A7E6A', textTransform:'uppercase' }}>{linkLabel}</span>}
                {isDesktop && <span style={{ alignSelf:'center', justifySelf:'end', fontFamily:"'Geist Mono',monospace", fontSize:10.5, color:clickable ? C.goldDeep : '#8A7E6A', fontWeight:600 }}>{actionLabel}</span>}
              </RowTag>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function PanoramaView({ pano, data, onGoTheme, isDesktop, panoramaDate, calData }) {
  const T = data.themes, order = data.order;
  if (data.meta?.source === 'apify_local' || T?.resumen?.rawOnly) {
    return <RawApifyPanorama data={data} isDesktop={isDesktop} />;
  }
  const byDay = panoramaDate && panoramaDate !== 'todas' && calData?.days?.[`2026-06-${panoramaDate}`];

  // Build cards — per-day from calData if a date is selected, otherwise full aggregate from PA_DATA
  const cards = order.map(k => {
    const t = T[k];
    if (byDay) {
      const d = byDay[k];
      if (!d) {
        return { key:k, label:t.label, es:t.es, accent:'#C8BBA0', pos:0, neu:0, neg:0,
          riskLabel:'Sin datos', pillStyle:{ ink:'#8A7E6A', bg:'#EDE6D8', bd:'#C8BBA0' },
          metaLine:'sin datos para esta fecha', noData:true, onClick:()=>onGoTheme(k) };
      }
      const neu = Math.round(100 - (d.pos||0) - (d.neg||0));
      const rm = riskMeta(d.risk);
      return { key:k, label:t.label, es:t.es, accent:rm.c, pos:d.pos||0, neu, neg:d.neg||0,
        riskLabel:rm.label, pillStyle:rm, metaLine:fmt(d.posts||0)+' posts',
        noData:false, onClick:()=>onGoTheme(k) };
    }
    const s = t.sentiment||{pos:0,neu:0,neg:0}; const rm = riskMeta(t.risk?.level);
    return { key:k, label:t.label, es:t.es, accent:rm.c, pos:s.pos, neu:s.neu, neg:s.neg,
      riskLabel:rm.label, pillStyle:rm, metaLine:fmt(t.totals?.posts||0)+' posts · '+(t.influencers?.total||0)+' influencers',
      noData:false, onClick:()=>onGoTheme(k) };
  });

  // Aggregate sentiment — only from cards that have data
  let p=0,n=0,g=0,tot=0;
  if (byDay) {
    cards.filter(c=>!c.noData).forEach(c => {
      const posts = byDay[c.key]?.posts || 0;
      p += c.pos * posts; n += c.neu * posts; g += c.neg * posts; tot += posts;
    });
    if (tot > 0) { p = Math.round(p/tot); g = Math.round(g/tot); n = 100-p-g; }
  } else {
    order.forEach(k => { const s=T[k].sentiment; if(s){p+=s.posC||0;n+=s.neuC||0;g+=s.negC||0;} });
    tot=p+n+g||1;
    p=Math.round(p/tot*100); g=Math.round(g/tot*100); n=100-p-g; tot=p+n+g||1;
  }
  const aPos=p, aNeg=g, aNeu=n;
  const totPosts = byDay
    ? cards.filter(c=>!c.noData).reduce((a,c)=>a+(byDay[c.key]?.posts||0),0)
    : order.reduce((a,k)=>a+(T[k].totals?.posts||0),0);
  const totMenciones = byDay
    ? null
    : order.reduce((a,k)=>{ const s=T[k].sentiment; return a+(s?(s.posC||0)+(s.neuC||0)+(s.negC||0):0); },0);

  const kpis = byDay
    ? [{ label:'Posts', value:fmt(totPosts), bg:C.ink, border:C.ink, lblColor:'rgba(255,255,255,0.65)', valColor:'#FBF8F1' }]
    : [
        { label:'Menciones', value:fmt(totMenciones), bg:C.ink, border:C.ink, lblColor:'rgba(255,255,255,0.65)', valColor:'#FBF8F1' },
        { label:'Posts', value:fmt(totPosts), bg:C.card, border:'rgba(33,28,23,0.13)', lblColor:'#6B6253', valColor:C.ink },
      ];

  const attention = [...cards].sort((a,b) => b.neg - a.neg);

  return (
    <motion.div key={pano} variants={stagger} initial="hidden" animate="visible"
      style={{ padding: isDesktop ? '24px 28px 6px' : '20px 18px 6px' }}>

      {/* Editorial */}
      {pano==='editorial' && (<>
        <motion.div variants={item}>
          <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10, letterSpacing:'0.16em',
            textTransform:'uppercase', color:C.gold, fontWeight:600 }}>
            Datos al · {data.meta.range_label}
          </div>
          <h1 style={{ fontFamily:"'Geist',sans-serif", fontWeight:500, fontSize:34, lineHeight:1.05,
            letterSpacing:'-0.025em', color:C.ink, margin:'9px 0 10px' }}>
            Estado de la <em style={{ fontStyle:'normal', color:C.goldDeep }}>conversación</em>.
          </h1>
          <p style={{ fontSize:15, lineHeight:1.6, color:'#6B6253', margin:'0 0 18px' }}>
            {fmt1(aPos)} de la conversación es favorable y {fmt1(aNeg)} crítica, sobre {fmt(tot)} menciones en cuatro temas.
          </p>
        </motion.div>

        <motion.div variants={item}
          style={{ display:'flex', alignItems:'center', gap:18, background:C.card,
            border:'1px solid rgba(33,28,23,0.13)', borderRadius:3, padding:18 }}>
          <Donut pos={aPos} neu={aNeu} neg={aNeg} size={116} showLabel />
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.14em',
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
                style={{ display:'flex', alignItems:'center', gap:14,
                  background: c.noData ? 'rgba(33,28,23,0.04)' : C.card,
                  border:'1px solid rgba(33,28,23,0.13)', borderLeft:`3px solid ${c.accent}`,
                  borderRadius:3, padding:'13px 15px', width:'100%', textAlign:'left',
                  opacity: c.noData ? 0.6 : 1 }}>
                <Donut pos={c.pos} neu={c.neu} neg={c.neg} size={52} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontFamily:"'Geist',sans-serif", fontWeight:600, fontSize:17,
                      letterSpacing:'-0.01em', color:C.ink }}>{c.label}</span>
                    <span style={{ ...pill(c.pillStyle.ink,c.pillStyle.bg,c.pillStyle.bd) }}>{c.riskLabel}</span>
                  </div>
                  <div style={{ fontSize:14, color:'#6B6253', marginTop:4, lineHeight:1.4 }}>{c.es}</div>
                  <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.05em',
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
              <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:11, letterSpacing:'0.05em',
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
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, fontWeight:500,
                  color:C.teal, letterSpacing:'0.04em' }}>{Math.round(a.pos)}% FAVORABLE</span>
                <span style={{ width:3,height:3,borderRadius:'50%',background:'#A9997B' }} />
                <span style={{ fontFamily:"'Geist Mono',monospace", fontSize:12, fontWeight:500,
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


