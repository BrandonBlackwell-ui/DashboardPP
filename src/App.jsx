import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useData } from './hooks/useData';
import { useBreakpoint } from './hooks/useBreakpoint';
import Header from './components/Header';
import SubBar from './components/SubBar';
import DesktopShell from './components/DesktopShell';
import PanoramaView from './components/PanoramaView';
import ThemeView from './components/ThemeView';
import CalendarView from './components/CalendarView';
import ReporteView from './components/ReporteView';
import AliadosView from './components/AliadosView';
import SocialListeningView from './components/SocialListeningView';
import VoiceAssistant from './components/VoiceAssistant';

const SOCIAL_KEYS = ['facebook', 'instagram', 'x', 'tiktok', 'google_news'];
import ExportModal from './components/ExportModal';
import LoginGate from './components/LoginGate';
import { loadFromSupabase, loadThemeByDate } from './lib/loadFromSupabase';
import { getFridayDateKey } from './utils/helpers';
import { applyLocalApifyData, LOCAL_APIFY_DATE_KEY, buildThemes } from './data/localApifyData';
import { saveReport } from './lib/saveReport';

const LOCAL_APIFY_MODE = false;

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
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('bw_auth') === '1');
  const isAdmin = sessionStorage.getItem('bw_role') === 'admin';
  const { data, calData, refreshData } = useData();
  const isDesktop = useBreakpoint();
  const [tab, setTab] = useState('panorama');
  const [socialNet, setSocialNet] = useState('facebook');
  const [ownedNet, setOwnedNet] = useState('instagram');
  const [pano, setPano] = useState('editorial');
  const [date, setDate] = useState('todas');
  const [plat, setPlat] = useState('todas');
  const [panoramaDate, setPanoramaDate] = useState('todas');
  const [showExport, setShowExport] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [dataVersion, setDataVersion] = useState(0);
  const initialLoadDone = useRef(false);
  const todasCache = useRef({});

  // On startup only: apply localStorage cache, then load from Supabase (authoritative)
  // useRef guard prevents re-running when refreshData() creates a new data reference
  useEffect(() => {
    if (!authed || !data || !calData) return;
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    
    // Always apply local Apify data as the default fallback
    applyLocalApifyData();
    refreshData();

    if (LOCAL_APIFY_MODE) {
      setDataVersion(v => v+1);
      setBootLoading(false);
      return;
    }
    
    setDataVersion(v => v+1);
    loadFromSupabase().then(() => {
      if (window.CALENDAR_DATA?.days) {
        const dayKeys = Object.keys(window.CALENDAR_DATA.days).sort();
        const latestKey = dayKeys.pop();
        if (latestKey) {
          setDate(latestKey);
          setPanoramaDate(latestKey);
        }
      }
      refreshData();
      setDataVersion(v => v+1);
    }).finally(() => {
      setBootLoading(false);
    });
  }, [authed, data, calData]);

  if (!authed) return <LoginGate onAuth={() => setAuthed(true)} />;

  if (bootLoading || !data) {
    return (
      <div style={{ minHeight:'100vh', background:'#EFE9DC', position:'relative', fontFamily:"'Geist', system-ui, sans-serif" }}>
        <div dangerouslySetInnerHTML={{ __html: INK_SVG }} />
        <Loading />
      </div>
    );
  }

  // Build a minimal themeData from CALENDAR_DATA when no Supabase record exists
  // (e.g. weekend consolidated reports that weren't uploaded per-day)
  function buildThemeFromCalendar(themeKey, dateKey) {
    const calDay = calData?.days?.[dateKey]?.[themeKey];
    if (!calDay) return false;
    const LABELS = { musica:'Música', entrevistas:'Entrevistas', empresas:'Empresas', familia:'Familia' };
    const ES = { musica:'Su obra musical, conciertos y legado artístico', entrevistas:'Apariciones en medios, entrevistas y declaraciones públicas', empresas:'Sus negocios, marca y proyectos empresariales', familia:'La dinastía Aguilar y la vida familiar pública' };
    const minimal = {
      label: LABELS[themeKey] || themeKey,
      es: ES[themeKey] || '',
      sentiment: { pos: calDay.pos||0, neu: Math.max(0,100-(calDay.pos||0)-(calDay.neg||0)), neg: calDay.neg||0 },
      risk: { level: calDay.risk || 'bajo', negPct: calDay.neg||0, attention: (calDay.neg||0) > 20 },
      totals: { posts: calDay.posts || 0 },
      platforms: [], alerts: { total:0, posts:[] }, opps: { total:0, posts:[] },
      complaints: { total:0, categories:[] }, news: null, trending: [],
      influencers: { total:0, top:[] },
      timeline: { events: (calDay.topEvents||[]).map(e => ({ main: e, date: dateKey })) },
      pros_cons: { positive:[], negative:[], neutral:[] },
      reconocimientos: [], keywords: [], emojis: [],
      comments_topics: { total:0, topics:[] },
      voices: { segmentos:[], alertas:[] },
      narrative_gap: {},
      _calendarSummary: true,
    };
    if (window.PA_DATA?.themes) window.PA_DATA.themes[themeKey] = minimal;
    return true;
  }

  async function handleSocialNetChange(net) {
    setSocialNet(net);
    const latestDateKey = LOCAL_APIFY_MODE ? LOCAL_APIFY_DATE_KEY : (calData ? Object.keys(calData.days).sort().pop() : null);
    const targetDateKey = latestDateKey ? getFridayDateKey(latestDateKey) : null;
    if (targetDateKey && !LOCAL_APIFY_MODE) await loadThemeByDate(net, targetDateKey);
    refreshData();
    window.scrollTo(0, 0);
  }

  async function handleTabChange(t) {
    if (t === 'panorama' || t === 'historico' || t === 'aliados' || t === 'reporte') {
      setTab(t); setDate('todas'); setPlat('todas');
      window.scrollTo(0, 0);
      return;
    }
    if (t === 'social_listening') {
      setTab(t);
      window.scrollTo(0, 0);
      // Load the currently active social network
      const latestDateKey = LOCAL_APIFY_MODE ? LOCAL_APIFY_DATE_KEY : (calData ? Object.keys(calData.days).sort().pop() : null);
      const targetDateKey = latestDateKey ? getFridayDateKey(latestDateKey) : null;
      if (targetDateKey && !LOCAL_APIFY_MODE) await loadThemeByDate(socialNet, targetDateKey);
      refreshData();
      return;
    }
    const latestDateKey = LOCAL_APIFY_MODE ? LOCAL_APIFY_DATE_KEY : (calData ? Object.keys(calData.days).sort().pop() : null);
    const targetDateKey = latestDateKey ? getFridayDateKey(latestDateKey) : null;
    const hasDataForLatest = targetDateKey && window.SUPABASE_KEYS?.has(`${t}:${targetDateKey}`);
    if (hasDataForLatest) {
      // Cache "todas" state before overwriting with latest date
      if (window.PA_DATA?.themes?.[t] && !todasCache.current[t]) {
        todasCache.current[t] = window.PA_DATA.themes[t];
      }
      if (!LOCAL_APIFY_MODE) await loadThemeByDate(t, targetDateKey);
      refreshData();
    }
    setTab(t); setDate(targetDateKey || 'todas'); setPlat('todas');
    window.scrollTo(0, 0);
  }
  async function handleGoFromCalendar(themeKey, dateKey) {
    const targetDateKey = getFridayDateKey(dateKey);
    const loaded = LOCAL_APIFY_MODE
      ? !!window.PA_DATA?.themes?.[themeKey]
      : await loadThemeByDate(themeKey, targetDateKey);
    if (!loaded) buildThemeFromCalendar(themeKey, targetDateKey);
    refreshData();
    setTab(themeKey);
    setDate(targetDateKey);
    setPlat('todas');
    window.scrollTo(0, 0);
  }

  async function handleDateChange(newDate) {
    setDate(newDate);
    if (!isTheme) return;
    if (newDate === 'todas') {
      // Restore "todas" cached data if available
      if (todasCache.current[tab] && window.PA_DATA?.themes) {
        window.PA_DATA.themes[tab] = todasCache.current[tab];
        refreshData();
      }
    } else {
      // Cache current "todas" state before overwriting (only first time per tab)
      if (window.PA_DATA?.themes?.[tab] && !todasCache.current[tab]) {
        todasCache.current[tab] = window.PA_DATA.themes[tab];
      }
      const dateKey = newDate; // full ISO date key e.g. 2026-07-01
      const loaded = LOCAL_APIFY_MODE
        ? !!window.PA_DATA?.themes?.[tab]
        : await loadThemeByDate(tab, dateKey);
      if (!loaded) buildThemeFromCalendar(tab, dateKey);
      refreshData();
    }
  }
  function handleExport() {
    setShowExport(true);
  }


  const isTheme = !['panorama','historico','aliados','reporte','social_listening'].includes(tab);

  // Build date options from calData — keys are full ISO dates (2026-07-01), labels are dynamic
  const MONTH_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const dateOptions = (() => {
    if (!calData) return [['todas', 'Todas']];
    const dayKeys = Object.keys(calData.days).sort();
    const optsMap = new Map();

    dayKeys.forEach(dk => {
      const dateObj = new Date(dk + 'T12:00:00');
      const dayOfWeek = dateObj.getDay();
      const dayInt = parseInt(dk.slice(8), 10);
      const mon = MONTH_ES[dateObj.getMonth()];

      if (dayOfWeek === 5) {
        optsMap.set(dk, `${dayInt}-${dayInt + 2} ${mon}`);
      } else if (dayOfWeek === 6) {
        const fridayKey = new Date(dateObj); fridayKey.setDate(fridayKey.getDate() - 1);
        const fdk = fridayKey.toISOString().slice(0,10);
        optsMap.set(fdk, `${dayInt - 1}-${dayInt + 1} ${mon}`);
      } else if (dayOfWeek === 0) {
        const fridayKey = new Date(dateObj); fridayKey.setDate(fridayKey.getDate() - 2);
        const fdk = fridayKey.toISOString().slice(0,10);
        optsMap.set(fdk, `${dayInt - 2}-${dayInt} ${mon}`);
      } else {
        optsMap.set(dk, `${dayInt} ${mon}`);
      }
    });

    const allOpts = Array.from(optsMap.entries()).slice(-7);
    const opts = [['todas', 'Todas'], ...allOpts];

    if (date !== 'todas' && !opts.find(([k]) => k === date)) {
      const d = new Date(date + 'T12:00:00');
      opts.splice(1, 0, [date, `${d.getDate()} ${MONTH_ES[d.getMonth()]}`]);
    }
    return opts;
  })();

  const viewContent = data && (
    <>
      <div style={{ padding:'0 0 56px' }}>
        <AnimatePresence mode="wait">
          {tab==='panorama' && (
            <motion.div key="panorama" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }}>
              <PanoramaView pano={pano} data={data} onGoTheme={handleTabChange} isDesktop={isDesktop} panoramaDate={panoramaDate} calData={calData} />
            </motion.div>
          )}
          {isTheme && (
            <motion.div key={tab} initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }}>
              <ThemeView tab={tab} date={date} plat={plat} data={data} isDesktop={isDesktop} ownedNet={ownedNet}
                noData={date !== 'todas' && !!window.SUPABASE_KEYS && !window.SUPABASE_KEYS.has(`${tab}:${date}`) && !calData?.days?.[date]?.[tab]}
                calendarSummary={date !== 'todas' && !!window.SUPABASE_KEYS && !window.SUPABASE_KEYS.has(`${tab}:${date}`) && !!calData?.days?.[date]?.[tab]} />
            </motion.div>
          )}
          {tab==='historico' && (
            <motion.div key="historico" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }}>
              <CalendarView calData={calData} onGoTheme={handleGoFromCalendar} isDesktop={isDesktop} supabaseKeys={window.SUPABASE_KEYS} />
            </motion.div>
          )}
          {tab==='aliados' && (
            <motion.div key="aliados" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }}>
              <AliadosView data={data} isDesktop={isDesktop} />
            </motion.div>
          )}
          {tab==='social_listening' && (
            <motion.div key="social_listening" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }}>
              <SocialListeningView
                activeNet={socialNet} onNetChange={handleSocialNetChange}
                date={date} plat={plat} data={data} isDesktop={isDesktop}
                noData={date !== 'todas' && !!window.SUPABASE_KEYS && !window.SUPABASE_KEYS.has(`${socialNet}:${date}`) && !calData?.days?.[date]?.[socialNet]}
                calendarSummary={date !== 'todas' && !!window.SUPABASE_KEYS && !window.SUPABASE_KEYS.has(`${socialNet}:${date}`) && !!calData?.days?.[date]?.[socialNet]} />
            </motion.div>
          )}
          {tab==='reporte' && (
            <motion.div key="reporte" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }}>
              <ReporteView isDesktop={isDesktop} data={data} />
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
          {showExport && <ExportModal onClose={() => setShowExport(false)} />}
        </AnimatePresence>
        {!data && <Loading />}
        {data && (
          <DesktopShell
            tab={tab} data={data} pano={pano}
            onTabChange={handleTabChange} onExport={handleExport}>
            {/* SubBar as sticky strip inside content */}
            <SubBar tab={tab} pano={pano} date={date} plat={plat} data={data}
              dateOptions={dateOptions} onPanoChange={setPano} onDateChange={handleDateChange} onPlatChange={setPlat} isDesktop
              ownedNet={ownedNet} onOwnedNetChange={setOwnedNet}
              panoramaDate={panoramaDate} onPanoramaDateChange={setPanoramaDate} />
            {viewContent}
          </DesktopShell>
        )}
        {data && isAdmin && <VoiceAssistant />}
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#241E18', display:'flex', justifyContent:'center', fontFamily:"'Geist', system-ui, sans-serif" }}>
      <div dangerouslySetInnerHTML={{ __html: INK_SVG }} />
      <AnimatePresence>
        {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      </AnimatePresence>
      <div style={{ width:'100%', maxWidth:468, minHeight:'100vh', background:'#EFE9DC',
        backgroundImage:'linear-gradient(rgba(33,28,23,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(33,28,23,0.05) 1px,transparent 1px)',
        backgroundSize:'24px 24px', position:'relative', overflow:'hidden' }}>

        {!data && <Loading />}

        {data && (<>
          <Header tab={tab} data={data} onExport={handleExport} onTabChange={handleTabChange} />
          <SubBar tab={tab} pano={pano} date={date} plat={plat} data={data}
            dateOptions={dateOptions} onPanoChange={setPano} onDateChange={handleDateChange} onPlatChange={setPlat}
            panoramaDate={panoramaDate} onPanoramaDateChange={setPanoramaDate} />
          {viewContent}
          {isAdmin && <VoiceAssistant />}
        </>)}
      </div>
    </div>
  );
}
