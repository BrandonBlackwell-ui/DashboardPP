import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useData } from './hooks/useData';
import { useBreakpoint } from './hooks/useBreakpoint';
import Header from './components/Header';
import SubBar from './components/SubBar';
import DesktopShell from './components/DesktopShell';
import PanoramaView from './components/PanoramaView';
import ThemeView from './components/ThemeView';
import CalendarView from './components/CalendarView';
import UploadModal, { applyStoredExtra } from './components/UploadModal';

const INK_SVG = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><filter id="bw-ink" x="-3%" y="-15%" width="106%" height="130%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="4" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="bw-ink-rough" x="-3%" y="-80%" width="106%" height="260%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.04 0.5" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>`;

function esc(s) { return '"' + String(s==null?'':s).replace(/"/g,'""').replace(/\r?\n/g,' ') + '"'; }
function buildCsv(keys, D) {
  const T = D.themes;
  const rows = [['tema','modulo','elemento','detalle','clasificacion','valor','fuente','fecha','link']];
  const push = a => rows.push(a.map(x => esc(x)));
  for (const k of keys) {
    const t=T[k]; const lbl=t.label;
    if(t.sentiment){ push([lbl,'Sentimiento','Positivo','','favorable',t.sentiment.pos+'%','','','']); push([lbl,'Sentimiento','Negativo','','critica',t.sentiment.neg+'%','','','']); }
    (t.proscons?.positive||[]).forEach(x=>push([lbl,'Pros','A favor',x,'favorable','','','','']));
    (t.proscons?.negative||[]).forEach(x=>push([lbl,'Pros','En contra',x,'critica','','','','']));
    (t.complaints?.categories||[]).forEach(cat=>(cat.items||[]).forEach(it=>{const src=(it.sources&&it.sources[0])||{};push([lbl,'Quejas',cat.titulo,it.texto,'critica',cat.porcentaje+'%',src.platform||'','',src.url||'']);}));
    (t.opps?.posts||[]).forEach(p=>push([lbl,'Oportunidad',p.platform||'',p.text,'favorable','impacto '+(p.impacto||''),p.username||'',(p.time||'').slice(0,10),p.url||'']));
    (t.alerts?.posts||[]).forEach(p=>push([lbl,'Alerta',p.tipo||'',p.text,'critica','peligrosidad '+(p.score||''),p.username||'',(p.time||'').slice(0,10),p.url||'']));
    if(t.news){['positivo','neutral','negativo'].forEach(r=>(t.news[r]||[]).forEach(g=>(g.noticias||[]).forEach(n=>push([lbl,'Noticia',g.titulo,n.titulo,r,g.porcentaje+'%',n.fuente||'',n.fecha||'',n.link||'']))));}
    (t.trending||[]).forEach(x=>push([lbl,'Tendencia',x.titulo,x.desc||'','',(x.metricas?.views||0)+' views','','','']));
    (t.recon||[]).forEach(x=>push([lbl,'Reconocimiento',x.titulo,x.desc||'','favorable','','','','']));
    (t.influencers?.top||[]).forEach(p=>push([lbl,'Influencer',p.username,'#'+p.rank,p.sentiment||'',p.followers+' seguidores',p.platform||'','',p.url||'']));
  }
  return rows.map(r=>r.join(',')).join('\r\n');
}

function Loading() {
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#EFE9DC', gap:16 }}>
      <motion.div animate={{ opacity:[0.4,1,0.4] }} transition={{ repeat:Infinity, duration:1.8 }}>
        <span style={{ fontFamily:"'Geist',sans-serif", fontWeight:900, letterSpacing:'-0.04em', color:'#211C17', fontSize:32, display:'inline-block', lineHeight:1 }}>Blackwell</span>
      </motion.div>
      <div style={{ fontFamily:"'Geist Mono',monospace", fontSize:10.5, letterSpacing:'0.16em', textTransform:'uppercase', color:'#B0822F' }}>Cargando tu brief…</div>
    </div>
  );
}

export default function App() {
  const { data, calData } = useData();
  const isDesktop = useBreakpoint();
  const [tab, setTab] = useState('panorama');
  const [pano, setPano] = useState('editorial');
  const [date, setDate] = useState('todas');
  const [plat, setPlat] = useState('todas');
  const [showUpload, setShowUpload] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  // Apply any previously uploaded CSVs from localStorage on startup
  useEffect(() => { if (data && calData) { applyStoredExtra(); setDataVersion(v => v+1); } }, [data, calData]);

  function handleTabChange(t) { setTab(t); setDate('todas'); setPlat('todas'); window.scrollTo(0,0); }
  function handleUpload() { setShowUpload(true); }
  function handleDataUpdated() { setDataVersion(v => v+1); }

  function handleExport() {
    if (!data) return;
    const isPano = tab==='panorama'||tab==='historico';
    const keys = isPano ? data.order : [tab];
    const csv = '﻿' + buildCsv(keys, data);
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pepe_aguilar_${isPano?'completo':tab}_13-15jun2026.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  }

  const isTheme = !['panorama','historico'].includes(tab);

  const viewContent = data && (
    <>
      <div style={{ padding:'0 0 56px' }}>
        <AnimatePresence mode="wait">
          {tab==='panorama' && (
            <motion.div key="panorama" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }}>
              <PanoramaView pano={pano} data={data} onGoTheme={handleTabChange} isDesktop={isDesktop} />
            </motion.div>
          )}
          {isTheme && (
            <motion.div key={tab} initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }}>
              <ThemeView tab={tab} date={date} plat={plat} data={data} isDesktop={isDesktop} />
            </motion.div>
          )}
          {tab==='historico' && (
            <motion.div key="historico" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }}>
              <CalendarView calData={calData} onGoTheme={handleTabChange} isDesktop={isDesktop} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ margin:'24px 18px 0', padding:'13px 0', borderTop:'2px solid #211C17', display:'flex', flexWrap:'wrap', gap:8, justifyContent:'space-between', fontFamily:"'Geist Mono',monospace", fontSize:9.5, letterSpacing:'0.06em', textTransform:'uppercase', color:'#B0822F' }}>
        <span>Doc. ref · BW-PA-BRIEF-1315JUN26</span>
        <span>Preparado por Blackwell Strategy</span>
        <span style={{ color:'#9B3331', fontWeight:600 }}>Confidencial · uso interno</span>
      </div>
    </>
  );

  if (isDesktop) {
    return (
      <div style={{ minHeight:'100vh', background:'#241E18', fontFamily:"'Geist', system-ui, sans-serif" }}>
        <div dangerouslySetInnerHTML={{ __html: INK_SVG }} />
        <AnimatePresence>
          {showUpload && <UploadModal onClose={() => setShowUpload(false)} onDataUpdated={handleDataUpdated} />}
        </AnimatePresence>
        {!data && <Loading />}
        {data && (
          <DesktopShell
            tab={tab} data={data} pano={pano}
            onTabChange={handleTabChange} onExport={handleExport} onUpload={handleUpload}>
            {/* SubBar as sticky strip inside content */}
            <SubBar tab={tab} pano={pano} date={date} plat={plat} data={data}
              onPanoChange={setPano} onDateChange={setDate} onPlatChange={setPlat} isDesktop />
            {viewContent}
          </DesktopShell>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#241E18', display:'flex', justifyContent:'center', fontFamily:"'Geist', system-ui, sans-serif" }}>
      <div dangerouslySetInnerHTML={{ __html: INK_SVG }} />
      <AnimatePresence>
        {showUpload && <UploadModal onClose={() => setShowUpload(false)} onDataUpdated={handleDataUpdated} />}
      </AnimatePresence>
      <div style={{ width:'100%', maxWidth:468, minHeight:'100vh', background:'#EFE9DC',
        backgroundImage:'linear-gradient(rgba(33,28,23,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(33,28,23,0.05) 1px,transparent 1px)',
        backgroundSize:'24px 24px', position:'relative', overflow:'hidden' }}>

        {!data && <Loading />}

        {data && (<>
          <Header tab={tab} data={data} onExport={handleExport} onTabChange={handleTabChange} onUpload={handleUpload} />
          <SubBar tab={tab} pano={pano} date={date} plat={plat} data={data}
            onPanoChange={setPano} onDateChange={setDate} onPlatChange={setPlat} />
          {viewContent}
        </>)}
      </div>
    </div>
  );
}
