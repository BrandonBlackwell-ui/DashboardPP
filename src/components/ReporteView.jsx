import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../utils/helpers';
import ReporteIA from './ReporteIA';

/* ─── shared primitives ─────────────────────────────────────── */
const MONO = "'Geist Mono',monospace";
const SANS = "'Geist',sans-serif";
const ink = C.ink;
const gold = C.gold;
const goldDeep = C.goldDeep;
const crim = C.crim;
const teal = C.teal;
const paper = '#FBF8F1';
const muted = '#6B6253';
const border = 'rgba(33,28,23,0.13)';

function Tag({ children, color }) {
  return (
    <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.16em', textTransform:'uppercase',
      fontWeight:600, color: color||gold, marginBottom:4, display:'block' }}>{children}</span>
  );
}

function SectionTitle({ children, accent }) {
  const parts = children.split(new RegExp(`(${accent})`, 'i'));
  return (
    <h2 style={{ fontFamily:SANS, fontWeight:500, fontSize:26, letterSpacing:'-0.025em',
      color:ink, margin:'6px 0 12px', lineHeight:1.1 }}>
      {accent ? parts.map((p,i) =>
        p.toLowerCase() === accent.toLowerCase()
          ? <em key={i} style={{ fontStyle:'normal', color:goldDeep }}>{p}</em>
          : p
      ) : children}
    </h2>
  );
}

function BigStat({ num, label, sub, color }) {
  return (
    <div style={{ background:paper, border:`1px solid ${border}`, borderRadius:3, padding:'14px 16px', flex:1, minWidth:100 }}>
      <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:muted, marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:SANS, fontWeight:700, fontSize:28, color: color||ink, lineHeight:1, letterSpacing:'-0.03em' }}>{num}</div>
      {sub && <div style={{ fontFamily:MONO, fontSize:9, color:muted, marginTop:4, letterSpacing:'0.06em' }}>{sub}</div>}
    </div>
  );
}

function Table({ headers, rows, highlight }) {
  return (
    <div style={{ border:`1px solid ${border}`, borderRadius:3, overflow:'hidden' }}>
      <div style={{ display:'grid', gridTemplateColumns: headers.map(()=>'1fr').join(' '),
        background:'rgba(33,28,23,0.04)', borderBottom:`1px solid ${border}`, padding:'8px 12px' }}>
        {headers.map((h,i) => (
          <span key={i} style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:muted }}>{h}</span>
        ))}
      </div>
      {rows.map((row,ri) => (
        <div key={ri} style={{ display:'grid', gridTemplateColumns: headers.map(()=>'1fr').join(' '),
          padding:'10px 12px', borderBottom: ri < rows.length-1 ? `1px solid ${border}` : 'none',
          background: highlight && ri === highlight ? 'rgba(176,130,47,0.06)' : 'transparent' }}>
          {row.map((cell,ci) => (
            <span key={ci} style={{ fontFamily:ci===0?SANS:MONO, fontWeight:ci===0?600:400,
              fontSize:ci===0?12.5:11, color:ci===0?ink:muted, lineHeight:1.4 }}>{cell}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Callout({ label, children, color }) {
  return (
    <div style={{ border:`1px solid ${color||gold}`, borderLeft:`3px solid ${color||gold}`,
      borderRadius:3, padding:'12px 14px', background:`rgba(176,130,47,0.04)`, marginTop:16 }}>
      {label && <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase',
        color:color||gold, fontWeight:600, marginBottom:6 }}>{label}</div>}
      <p style={{ fontFamily:SANS, fontSize:13, color:ink, lineHeight:1.55, margin:0 }}>{children}</p>
    </div>
  );
}

function HBar({ label, pct, color }) {
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontFamily:SANS, fontWeight:500, fontSize:12.5, color:ink }}>{label}</span>
        <span style={{ fontFamily:MONO, fontSize:11, color:muted }}>{pct}%</span>
      </div>
      <div style={{ height:5, borderRadius:3, background:'#E3DAC6', overflow:'hidden' }}>
        <motion.div initial={{ width:0 }} animate={{ width:pct+'%' }} transition={{ duration:0.7 }}
          style={{ height:'100%', background:color||gold, borderRadius:3 }} />
      </div>
    </div>
  );
}

function QuoteCard({ text, source, tone }) {
  const toneColor = tone === 'pos' ? teal : tone === 'neg' ? crim : muted;
  return (
    <div style={{ background:paper, border:`1px solid ${border}`, borderLeft:`2px solid ${toneColor}`,
      borderRadius:3, padding:'11px 13px', display:'flex', gap:12, alignItems:'flex-start' }}>
      <div style={{ flex:1 }}>
        <p style={{ fontFamily:SANS, fontSize:12.5, color:ink, lineHeight:1.5, margin:0, fontStyle:'italic' }}>«{text}»</p>
        {source && <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.08em', color:muted, textTransform:'uppercase', marginTop:4, display:'block' }}>{source}</span>}
      </div>
    </div>
  );
}

/* ─── REPORTE NUEVO: Grupo Frontera Edinburg TX ───────────────────── */
const FRONTERA_SECTIONS = [
  {
    id: '01', tag: '01 · Generales del evento',
    title: 'Riesgo Medio para Pepe Aguilar en el concierto de Grupo Frontera.',
    acento: 'Medio',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Análisis de riesgo reputacional para <strong>Pepe Aguilar</strong> en su participación en el concierto de Grupo Frontera en Texas.
        </p>
        <Table
          headers={['Eje de información', 'Detalle']}
          rows={[
            ['Evento', 'Concierto Grupo Frontera – Triste Pero Bien C*brón Tour'],
            ['Fecha y sede', '17 de julio de 2026, Bert Ogden Arena, Edinburg, Texas'],
            ['Contexto', 'Edinburg es la ciudad de origen de Grupo Frontera'],
            ['Folio', 'BW-26-07-PA-RIESGO-001'],
          ]}
        />
        <Callout label="Semáforo Ejecutivo · Riesgo Medio" color={gold}>
          La conversación de Pepe, referente al tema de conciertos (de abril a julio) presenta un 88% de sentimiento de hostilidad derivado de la narrativa de cancelaciones y shows pospuestos. Este evento es de riesgo medio: ya que abren posibilidad a retomar temas como el contraste con su propia taquilla y el ángulo "pro-Trump" en una comunidad migrante / fronteriza.
        </Callout>
      </>
    )
  },
  {
    id: '02', tag: '02 · Principales narrativas en torno a Pepe',
    title: 'Identificación de las narrativas críticas activas.',
    acento: 'narrativas',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Se detectaron tres narrativas principales con nivel de riesgo medio que asocian la baja de ventas y posturas políticas.
        </p>
        <Table
          headers={['Narrativa', 'Origen', 'Vigencia', 'Riesgo']}
          rows={[
            ['"A mí nadie me cancela" / karma de taquilla', 'Declaración previa + baja venta y cancelación de fechas en EE.UU.', 'Vigente', 'MEDIO'],
            ['"Pepe apoya a Trump / sacar inmigrantes"', 'Clips 2025', 'Latente', 'MEDIO'],
            ['"Soberbio / prefiero a los Fernández"', 'Comparación con dinastía rival (humildad)', 'Vigente', 'MEDIO'],
          ]}
        />
      </>
    )
  },
  {
    id: '03', tag: '03 · Ejemplos de conversación',
    title: 'Muestras de la conversación en plataformas.',
    acento: 'conversación',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Ejemplos de las interacciones hostiles capturadas en torno al evento y la venta de boletos.
        </p>
        <Table
          headers={['Fecha', 'Plataforma', 'Autor', 'Resumen', 'Tono']}
          rows={[
            ['15 jul', 'TikTok', '@el_chapala_alejandro', '"Cancelan concierto de Pepe Aguilar por no vender boletos"', 'Hostil'],
            ['13 jul', 'TikTok', '@aaronmachi (21.8K v)', '"Se quedó sin fechas, lo están cancelando poco a poco"', 'Hostil'],
            ['2 may', 'Facebook', 'PAM (613 coment.)', '"El talento no se cancela, decían" — burla por bajas ventas', 'Hostil'],
            ['13 jul', 'TikTok', 'comentario (69 ♥)', '"Pero él no es humilde, apoyó al presidente de Estados Unidos"', 'Hostil'],
            ['6 jul', 'X', '@luazELF', '"Ora los MAGA de Grupo Frontera, quiéranse tantito"', 'Hostil'],
          ]}
        />
      </>
    )
  },
  {
    id: '04', tag: '04 · Escenarios de riesgo',
    title: 'Evaluación de posibles escenarios y respuestas.',
    acento: 'Escenarios',
    render: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background:paper, border:`1px solid ${border}`, borderLeft:`3px solid ${crim}`, borderRadius:3, padding:'14px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontFamily:SANS, fontWeight:600, fontSize:13.5, color:ink }}>Escenario 1 · Mayor riesgo</span>
            <span style={{ fontFamily:MONO, fontSize:9, background:`rgba(219,68,85,0.1)`, color:crim, padding:'2px 6px', borderRadius:2, fontWeight:600 }}>RIESGO ALTO</span>
          </div>
          <Table
            headers={['Variable', 'Descripción']}
            rows={[
              ['Probabilidad / Impacto', 'MEDIA-BAJA / ALTO'],
              ['Qué ocurre', 'La presencia de Pepe reactiva su ciclo hostil: "tuvo que ir de invitado porque él ya no llena conciertos y encima pro-Trump"'],
              ['Detonador / Indicadores', 'Clip de Pepe con narrativa de migración/Trump en la comunidad fronteriza. Picos de burla y menciones de Trump.'],
              ['Resultado esperado', 'Se refuerza el relato "cancelado y vendido"; daño de imagen moderado.'],
              ['Acción / Statement', 'No responder al ataque político.'],
            ]}
          />
        </div>

        <div style={{ background:paper, border:`1px solid ${border}`, borderLeft:`3px solid ${teal}`, borderRadius:3, padding:'14px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontFamily:SANS, fontWeight:600, fontSize:13.5, color:ink }}>Escenario 2 · Más probable</span>
            <span style={{ fontFamily:MONO, fontSize:9, background:`rgba(14,165,233,0.1)`, color:teal, padding:'2px 6px', borderRadius:2, fontWeight:600 }}>RIESGO BAJO</span>
          </div>
          <Table
            headers={['Variable', 'Descripción']}
            rows={[
              ['Probabilidad / Impacto', 'ALTA / BAJO'],
              ['Qué ocurre', 'Show de casa exitoso; burla contenida "¿por qué lo invitan?"'],
              ['Detonador / Indicadores', 'Anuncio o clip de su participación. Comentarios aislados negativos sin trascender a prensa seria.'],
              ['Resultado esperado', 'Ruido de 24–72h sin daño reputacional.'],
              ['Acción / Statement', 'No responder la burla. Capitalizar en silencio: días después, clip breve agradeciendo al grupo por la invitación y el cariño del público (sin tono triunfalista).'],
            ]}
          />
        </div>

        <div style={{ background:paper, border:`1px solid ${border}`, borderLeft:`3px solid ${teal}`, borderRadius:3, padding:'14px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontFamily:SANS, fontWeight:600, fontSize:13.5, color:ink }}>Escenario 3 · Mejor escenario</span>
            <span style={{ fontFamily:MONO, fontSize:9, background:`rgba(14,165,233,0.1)`, color:teal, padding:'2px 6px', borderRadius:2, fontWeight:600 }}>RIESGO BAJO</span>
          </div>
          <Table
            headers={['Variable', 'Descripción']}
            rows={[
              ['Probabilidad / Impacto', 'MEDIA / BAJO'],
              ['Qué ocurre', 'Pepe es recibido con calidez; el momento se lee como orgullo latino / del regional mexicano.'],
              ['Detonador / Indicadores', 'Casa llena, recibimiento cálido y buen momento musical junto a Grupo Frontera. Conversación de música supera a la de burla.'],
              ['Resultado esperado', 'Recupera capital simpático; minimiza el relato "ya nadie lo quiere".'],
              ['Acción / Statement', 'Aprovechar la ventana. Statement sugerido: "Gracias a Grupo Frontera y a este increíble público por abrirme su casa; la música regional mexicana es de todos." Contenido cálido y agradecido.'],
            ]}
          />
        </div>
      </div>
    )
  },
  {
    id: '05', tag: '05 · Recomendaciones por fase',
    title: 'Protocolos de acción y monitoreo preventivos.',
    acento: 'monitoreo',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Acciones prioritarias y preventivas estructuradas por fase temporal del evento.
        </p>
        <Table
          headers={['Fase', 'Acción', 'Prioridad']}
          rows={[
            ['Antes', 'Escucha en tiempo real centrada en Pepe', 'ALTA'],
            ['Durante', 'Comunicación con tono cálido y cariño', 'ALTA'],
            ['Durante', 'Foco en música y comunidad, no mencionar nada al tema político', 'MEDIA'],
            ['24h posteriores', 'Si existe conversación de "de arrimado" o ángulo político escala, no confrontar ni responder', 'ALTA'],
            ['24h posteriores', 'Capitalizar el "sí llena" con sobriedad; imágenes del público / comunidad', 'MEDIA'],
            ['72h posteriores', 'Evaluación del evento: escucha general de la conversación de Pepe en torno al evento', 'ALTA'],
          ]}
        />
      </>
    )
  },
  {
    id: '06', tag: '06 · Conclusión estratégica',
    title: 'Conclusiones clave y focos de atención.',
    acento: 'Conclusiones',
    render: () => (
      <>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ background:paper, border:`1px solid ${border}`, borderRadius:3, padding:'14px 16px' }}>
            <h4 style={{ fontFamily:SANS, fontWeight:600, fontSize:13, color:ink, margin:'0 0 6px 0' }}>¿El concierto representa un riesgo reputacional para Pepe?</h4>
            <p style={{ fontFamily:SANS, fontSize:12.5, color:muted, margin:0, lineHeight:1.5 }}>
              <strong style={{ color: goldDeep }}>MEDIO.</strong> El show añade poco riesgo nuevo y puede incluso ayudarlo de acuerdo a la respuesta del público.
            </p>
          </div>

          <div style={{ background:paper, border:`1px solid ${border}`, borderRadius:3, padding:'14px 16px' }}>
            <h4 style={{ fontFamily:SANS, fontWeight:600, fontSize:13, color:ink, margin:'0 0 6px 0' }}>¿Qué narrativa tiene mayor probabilidad de crecer?</h4>
            <p style={{ fontFamily:SANS, fontSize:12.5, color:muted, margin:0, lineHeight:1.5 }}>
              La burla <em style={{ fontStyle: 'normal', color: crim }}>"él ya no llena conciertos / de arrimado"</em> y, en menor medida, el tema Trump.
            </p>
          </div>

          <div style={{ background:paper, border:`1px solid ${border}`, borderRadius:3, padding:'14px 16px' }}>
            <h4 style={{ fontFamily:SANS, fontWeight:600, fontSize:13, color:ink, margin:'0 0 6px 0' }}>¿Cuál es el principal foco de monitoreo?</h4>
            <p style={{ fontFamily:SANS, fontSize:12.5, color:muted, margin:0, lineHeight:1.5 }}>
              La aparición de Pepe y su recepción, y cualquier intento de politizar su presencia en clave migratoria.
            </p>
          </div>
        </div>
        <div style={{ border:`1px solid ${border}`, borderRadius:3, padding:'20px 24px', textAlign:'center',
          background:paper, margin:'16px 0 12px' }}>
          <p style={{ fontFamily:SANS, fontWeight:400, fontSize:15, fontStyle:'italic', color:ink,
            lineHeight:1.55, margin:0, letterSpacing:'-0.01em' }}>
            «El show añade poco riesgo nuevo y puede incluso ayudarlo de acuerdo a la respuesta del público.»
          </p>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase',
            color:muted, marginTop:12 }}>Síntesis del Evento Grupo Frontera</div>
        </div>
        <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.10em', textTransform:'uppercase',
          color:muted, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
          <span>Folio · BW-26-07-PA-RIESGO-001</span>
          <span>Preparado por Blackwell Strategy</span>
          <span style={{ color:crim, fontWeight:600 }}>Confidencial · uso interno</span>
        </div>
      </>
    )
  }
];

/* ─── REPORTE 1: Período General Jun 1–16 ───────────────────── */
const PERIODO_SECTIONS = [
  {
    id:'01', tag:'01 · Alcance del análisis',
    title:'Qué se monitoreó y cuánto.',
    acento:'monitoreó',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Análisis de la conversación pública sobre Pepe Aguilar entre el <strong style={{color:ink}}>1 y el 16 de junio de 2026</strong>, clasificada en cuatro temas: Familia, Empresas, Música y Entrevistas. Las plataformas monitoreadas incluyen TikTok, Instagram, Facebook, Twitter y Google News.
        </p>
        <Table
          headers={['Tema','Posts capturados','Plataformas principales','Riesgo predominante']}
          rows={[
            ['Familia','3,596','TikTok · Instagram · Facebook · Google News','Medio'],
            ['Empresas','472','Facebook · Google News · TikTok','Muy bajo'],
            ['Entrevistas','414','TikTok · Instagram · Facebook','Bajo–Alto'],
            ['Música','350','TikTok · Facebook · Google News','Muy bajo–Bajo'],
          ]}
        />
        <Callout label="Universo total">
          El período arrojó <strong>4,832 publicaciones</strong> clasificadas. La conversación estuvo activa los 16 días, con picos claros los fines de semana y en torno a dos eventos: el lanzamiento del álbum tributo (1–10 jun) y la inauguración del Mundial FIFA 2026 (11–13 jun).
        </Callout>
      </>
    )
  },
  {
    id:'02', tag:'02 · Distribución del volumen',
    title:'Familia concentra tres cuartas partes de la conversación.',
    acento:'Familia',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          El tema Familia —que agrupa todo lo relacionado con Ángela, Leonardo, Emiliano, la dinastía y los escándalos asociados— domina de forma abrumadora el volumen de la ventana.
        </p>
        <div style={{ marginBottom:16 }}>
          {[
            { label:'Familia', pct:74, color:crim },
            { label:'Empresas', pct:10, color:'#A9997B' },
            { label:'Entrevistas', pct:9, color:gold },
            { label:'Música', pct:7, color:teal },
          ].map(r => <HBar key={r.label} {...r} />)}
        </div>
        <Table
          headers={['Tema','Posts','Share','Promedio diario']}
          rows={[
            ['Familia','3,596','74%','~327 posts/día'],
            ['Empresas','472','10%','~39 posts/día'],
            ['Entrevistas','414','9%','~69 posts/día (solo Jun 8–13)'],
            ['Música','350','7%','~35 posts/día'],
          ]}
        />
        <Callout>
          La proporción 74% / 26% entre Familia y el resto se mantuvo estable a lo largo de todo el período. No hubo ningún día en que la conversación musical superara al tema familiar como driver principal.
        </Callout>
      </>
    )
  },
  {
    id:'03', tag:'03 · Sentimiento por tema',
    title:'La música, el terreno más seguro.',
    acento:'música',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Sentimiento promedio ponderado por volumen de posts en la ventana completa. Música es el único tema con riesgo predominantemente muy bajo; Entrevistas registró el único día de riesgo <strong style={{color:crim}}>alto</strong> (Jun 12).
        </p>
        <Table
          headers={['Tema','Positivo','Neutral','Negativo','Riesgo pico']}
          rows={[
            ['Familia','36%','30%','30%','Medio'],
            ['Entrevistas','27%','39%','35%','Alto (Jun 12)'],
            ['Música','26%','59%','15%','Bajo'],
            ['Empresas','4%','94%','2%','Muy bajo'],
          ]}
        />
        <div style={{ marginTop:16, display:'flex', gap:8, flexWrap:'wrap' }}>
          <BigStat num="36%" label="Familia · positivo" sub="alto volumen, riesgo constante" color={crim} />
          <BigStat num="26%" label="Música · positivo" sub="terreno más estable" color={teal} />
          <BigStat num="35%" label="Entrevistas · negativo" sub="pico 51% el Jun 12" color={gold} />
          <BigStat num="94%" label="Empresas · neutral" sub="tema latente, sin activación" color={muted} />
        </div>
      </>
    )
  },
  {
    id:'04', tag:'04 · Días de riesgo',
    title:'Jun 12 marcó el pico de exposición negativa.',
    acento:'pico',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          El riesgo fue acumulativo durante la semana de entrevistas (Jun 8–13). Familia se mantuvo en riesgo medio de forma estable, pero Entrevistas escaló de bajo a alto en cuatro días.
        </p>
        <Table
          headers={['Fecha','Tema más crítico','Riesgo','Detonante principal']}
          rows={[
            ['Jun 3','Familia / Música','Bajo–Medio','Acusación de copia al tributo de Vicente Fernández; cancelaciones gira'],
            ['Jun 4','Familia','Medio','Cancelaciones gira; corista denuncia; quejas de artistas'],
            ['Jun 9','Entrevistas','Medio','Declaraciones sobre Dua Lipa; hipocresía en entrevistas'],
            ['Jun 10','Entrevistas','Medio','Favoritismo familiar expuesto; Majo forzada a disculparse'],
            ['Jun 12','Entrevistas','ALTO','Comentarios en avión sobre Cazzu; polémica himno Mundial; 51% negativo'],
            ['Jun 13','Familia / Entrevistas','Medio','Declaraciones clasistas; Ángela borra post mundialista; video filtrado'],
            ['Jun 16','Familia','Medio','Contenido sensacionalista sobre rancho El Soyate; demandas Emiliano'],
          ]}
        />
        <Callout label="Jun 12 · riesgo alto" color={crim}>
          Único día con riesgo <strong>alto</strong> en toda la ventana. El 51.2% negativo en Entrevistas fue impulsado por la percepción de que Pepe se burló de Cazzu en entrevista y reaccionó negativamente a que Alejandro Fernández cantara el himno en el Mundial. El contexto del torneo amplificó el alcance.
        </Callout>
      </>
    )
  },
  {
    id:'05', tag:'05 · Quejas recurrentes',
    title:'Los mismos ejes aparecen semana a semana.',
    acento:'ejes',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Clasificando las categorías de queja más frecuentes a lo largo del período, cinco ejes se repiten de forma constante independientemente de la fecha:
        </p>
        <Table
          headers={['Eje de queja','Tema(s) afectados','Frecuencia','Peso promedio']}
          rows={[
            ['Talento cuestionado / calidad artística','Familia · Música','11 de 16 días','22–32%'],
            ['Soberbia, arrogancia, actitud','Familia · Entrevistas','10 de 16 días','14–31%'],
            ['Escándalo Angela–Nodal–Cazzu','Familia','9 de 16 días','9–27%'],
            ['Cancelaciones de gira / fracaso comercial','Familia','5 de 16 días','16–17%'],
            ['Explotación / oportunismo del legado familiar','Música · Empresas','5 de 16 días','23–38%'],
          ]}
        />
        <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:7 }}>
          <QuoteCard text="¡Cancelaciones en la gira de Pepe Aguilar! ¿Crisis en la Dinastía Aguilar?" source="TikTok · Jun 4" tone="neg" />
          <QuoteCard text="Pepe Aguilar vuelve a causar polémica porque a solo días que el disco póstumo de Vicente Fernández fuese lanzado, él hizo lo mismo con su padre Antonio Aguilar." source="TikTok · Jun 3" tone="neg" />
          <QuoteCard text="Angela Aguilar usa las influencias de Pepe para arruinar la carrera de Majo." source="TikTok · Jun 9" tone="neg" />
        </div>
      </>
    )
  },
  {
    id:'06', tag:'06 · Oportunidades detectadas',
    title:'El álbum y el Mundial abrieron espacios favorables.',
    acento:'Mundial',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          A pesar del peso negativo en Familia y Entrevistas, la ventana generó oportunidades reales de posicionamiento que se pueden consolidar en la siguiente etapa de comunicación.
        </p>
        <Table
          headers={['Oportunidad','Tema','Fecha','Por qué importa']}
          rows={[
            ['Álbum "¡Que Viva Antonio Aguilar!" · lanzamiento','Música / Empresas','Jun 1–10','Recepción musical positiva; sencillo «China de los Ojos Negros» suma tracción orgánica'],
            ['Press junket y creadores de contenido','Entrevistas','Jun 8','Cobertura favorable de legado y disciplina; entrevistas de Javibi, POSTA y Casa POSTA dominaron la narrativa positiva'],
            ['"Mi Suerte Es Ser Mexicano Vol. 2" · lanzamiento','Música','Jun 1–3','Proyecto de raíces con recepción limpia; refuerza identidad artística sin polémicas'],
            ['Presencia en inauguración del Mundial','Familia','Jun 11','Leonardo Aguilar como figura aspiracional; múltiples fans pidiendo a Pepe para el himno'],
            ['Majo Aguilar · concierto a capella bajo la lluvia','Familia','Jun 15','Momento humano que contrarresta narrativa de arrogancia familiar; sin respuesta de crisis'],
          ]}
        />
        <Callout label="Oportunidad subexplotada">
          La presencia de <strong>Leonardo y Pepe Aguilar</strong> como aficionados en la inauguración del Mundial generó contenido positivo natural (el tipo de momento que ocurre sin PR). No se amplificó desde los canales propios, lo que dejó espacio en la conversación que llenaron los críticos con la narrativa del himno.
        </Callout>
      </>
    )
  },
  {
    id:'07', tag:'07 · Síntesis ejecutiva',
    title:'La música es el activo; la familia sigue siendo el riesgo.',
    acento:'activo',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:12 }}>
          El período 1–16 de junio confirma un patrón estructural: Pepe Aguilar genera conversación positiva cuando el eje es musical o de legado, y conversación negativa cuando el eje es familiar o de carácter. Los dos lanzamientos discográficos (álbum tributo y Vol. 2 de «Mi Suerte Es Ser Mexicano») tuvieron una recepción limpia, pero quedaron opacados por el volumen del tema Familia, que cuadriplicó en posts a cualquier otro eje.
        </p>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:20 }}>
          El único día de riesgo <strong style={{color:crim}}>alto</strong> fue Jun 12, impulsado por declaraciones asociadas al Mundial y a Cazzu. El patrón no es nuevo, pero el contexto mundialista amplificó el alcance más de lo habitual.
        </p>
        <div style={{ border:`1px solid ${border}`, borderRadius:3, padding:'20px 24px', textAlign:'center',
          background:paper, margin:'8px 0 16px' }}>
          <p style={{ fontFamily:SANS, fontWeight:400, fontSize:16, fontStyle:'italic', color:ink,
            lineHeight:1.5, margin:0, letterSpacing:'-0.01em' }}>
            «La música es el terreno más seguro; la familia sigue siendo el centro de gravedad de todo lo que se dice de Pepe.»
          </p>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase',
            color:muted, marginTop:12 }}>Síntesis de la ventana 1–16 Jun 2026</div>
        </div>
        <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.10em', textTransform:'uppercase',
          color:muted, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
          <span>Folio · BW-26-06-PA-PERIODO-001</span>
          <span>Preparado por Blackwell Strategy</span>
          <span style={{ color:crim, fontWeight:600 }}>Confidencial · uso interno</span>
        </div>
      </>
    )
  },
];

/* ─── REPORTE 2: Entrevistas Jun 8–13 ───────────────────────── */
const ENTREV_SECTIONS = [
  {
    id:'01', tag:'01 · Alcance · fuentes y método',
    title:'La semana de entrevistas en cifras.',
    acento:'entrevistas',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:12 }}>
          Este reporte analiza la reacción pública a las actividades de promoción del álbum «¡Que Viva Antonio Aguilar!» durante la ventana del <strong style={{color:ink}}>8 al 13 de junio de 2026</strong>. La base es de <strong style={{color:ink}}>414 publicaciones clasificadas</strong> en el eje Entrevistas.
        </p>
        <Table
          headers={['Fecha','Posts','Sentimiento','Riesgo','Evento principal']}
          rows={[
            ['Jun 8','84','36% pos · 25% neg','Bajo','Press junket álbum tributo; encuentro con creadores de contenido'],
            ['Jun 9','65','28% pos · 39% neg','Medio','Polémicas declaraciones sobre Dua Lipa; cobertura mezclada legado/familia'],
            ['Jun 10','67','22% pos · 40% neg','Medio','Favoritismo familiar; acusaciones cobertura pagada'],
            ['Jun 11','69','45% pos · 22% neg','Bajo','Homenaje Antonio Aguilar; encuentro Chicharito; inauguración Mundial'],
            ['Jun 12','65','9.5% pos · 51% neg','ALTO','Burla a Cazzu en avión; polémica himno Mundial; reacción vs Alejandro Fdz'],
            ['Jun 13','64','17% pos · 35% neg','Medio','Declaraciones clasistas amplificadas; tono cae tras pico del Jun 12'],
          ]}
        />
        <Callout label="Patrón de la semana">
          El período abre bien (Jun 8, riesgo bajo, cobertura de legado), escala en tensión del Jun 9 al 10, recupera brevemente el Jun 11 por el Mundial, y colapsa el Jun 12 con el único día de riesgo alto de toda la ventana.
        </Callout>
      </>
    )
  },
  {
    id:'02', tag:'02 · El saldo global de la semana',
    title:'La semana cerró en rojo.',
    acento:'rojo',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          En términos acumulados, la semana de entrevistas no favoreció la imagen de Pepe Aguilar. El peso del Jun 12 arrastra el saldo hacia terreno negativo.
        </p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          <BigStat num="27%" label="Positivo acumulado" sub="talento y legado" color={teal} />
          <BigStat num="38%" label="Neutral acumulado" sub="informativo" color={'#6B8C7A'} />
          <BigStat num="35%" label="Negativo acumulado" sub="carácter y familia" color={crim} />
          <BigStat num="Jun 12" label="Día más crítico" sub="riesgo alto · 51% neg" color={goldDeep} />
        </div>
        <Table
          headers={['Eje de reacción','Peso','Tono']}
          rows={[
            ['Talento y oficio artístico','21%','59% positivo'],
            ['Homenaje a Antonio Aguilar y legado','11%','54% positivo'],
            ['México y orgullo cultural','8%','72% positivo · el eje más cálido'],
            ['Familia y dinastía (Majo, Ángela, hijos)','11%','Mixto · 37% pos / 14% neg'],
            ['Soberbia y arrogancia','4%','84% negativo'],
            ['Oportunismo / cobertura pagada','2%','68% negativo'],
          ]}
        />
      </>
    )
  },
  {
    id:'03', tag:'03 · Jun 12 · el día de riesgo alto',
    title:'Tres detonantes en menos de 24 horas.',
    acento:'detonantes',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:14 }}>
          El Jun 12 concentró el peor saldo del período (9.5% positivo / 51.2% negativo). Los tres detonantes se encadenaron y se retroalimentaron durante el día:
        </p>
        <Table
          headers={['Detonante','Queja dominante','% dentro de las quejas del día']}
          rows={[
            ['Comentarios de Pepe y Ángela en avión, aparente burla a persona en situación vulnerable','Declaraciones polémicas en medios','25%'],
            ['Declaración de Pepe sobre Cazzu en entrevista («llegó siendo señorita hasta el altar»)','Presencia no invitada en conversación del Mundial','26%'],
            ['Reacción de Pepe ante Alejandro Fernández cantando el himno en el Mundial','Actitud arrogante y defensa cuestionada de Ángela','22%'],
          ]}
        />
        <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:7 }}>
          <QuoteCard text="Ciertos comentarios de Pepe Aguilar junto a Ángela en un avión han generado indignación tras burlarse de una persona y de una situación muy delicada." source="Jun 12 · publicación de alto alcance" tone="neg" />
          <QuoteCard text="¡ÚLTIMA HORA! Pepe Aguilar ESTALLA Contra Alejandro Fernández tras QUITARLE el LUGAR a Ángela Aguilar en el Mundial." source="Jun 12 · TikTok viral" tone="neg" />
          <QuoteCard text="Pepe Aguilar y Leonardo Aguilar fueron captados disfrutando de la inauguración del Mundial 2026 desde las gradas, padre e hijo vivieron como aficionados una noche llena de emoción." source="Jun 12 · contenido positivo" tone="pos" />
        </div>
        <Callout label="Contexto mundialista" color={crim}>
          El Mundial amplificó el alcance de cada declaración. Cualquier contenido sobre Pepe en esos días compitió por atención con la inauguración, lo que elevó el escrutinio sobre cada gesto y comentario público.
        </Callout>
      </>
    )
  },
  {
    id:'04', tag:'04 · Lo que sumó y lo que restó',
    title:'Legado abre crédito; carácter lo gasta.',
    acento:'crédito',
    render: () => (
      <>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:4 }}>
          <div>
            <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:'0.12em', textTransform:'uppercase',
              color:teal, fontWeight:600, marginBottom:10 }}>Lo que sumó</div>
            {[
              { bold:'El homenaje a Antonio Aguilar.', text:'El disco tributo fue leído como acto de amor y preservación del legado. El formato entrevista, anclado en el padre, funcionó bien.' },
              { bold:'Talento y trayectoria.', text:'La voz, el oficio y el rol de guardián del regional mexicano se reconocen sin disputa.' },
              { bold:'Orgullo mexicano.', text:'El eje cultural fue el más cálido de la semana: «Pepe Aguilar es México, tradición y cultura».' },
              { bold:'Encuentro con creadores (Jun 8).', text:'Javibi, POSTA y BYMA Media generaron cobertura centrada en legado y disciplina, sin polémicas.' },
            ].map((it,i) => (
              <div key={i} style={{ marginBottom:9, paddingLeft:8, borderLeft:`2px solid ${teal}` }}>
                <span style={{ fontFamily:SANS, fontWeight:600, fontSize:12, color:ink }}>{it.bold} </span>
                <span style={{ fontFamily:SANS, fontSize:12, color:muted }}>{it.text}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:'0.12em', textTransform:'uppercase',
              color:crim, fontWeight:600, marginBottom:10 }}>Lo que restó</div>
            {[
              { bold:'Declaraciones sobre Cazzu.', text:'La frase del Jun 12 se convirtió en el soundbite negativo más citado de la semana; retroalimentó la narrativa de soberbia.' },
              { bold:'Reacción al himno del Mundial.', text:'El contexto Alejandro Fernández activó narrativas de celos y de pugna con otros artistas.' },
              { bold:'La familia como ruido de fondo.', text:'Majo, Ángela, los hijos y Emiliano se cuelan incluso cuando la entrevista es sobre el disco.' },
              { bold:'Soberbia estructural.', text:'«Y no me llega» y el video en el avión son ejemplos de frases o gestos sueltos que definen la lectura de toda una aparición mediática.' },
            ].map((it,i) => (
              <div key={i} style={{ marginBottom:9, paddingLeft:8, borderLeft:`2px solid ${crim}` }}>
                <span style={{ fontFamily:SANS, fontWeight:600, fontSize:12, color:ink }}>{it.bold} </span>
                <span style={{ fontFamily:SANS, fontSize:12, color:muted }}>{it.text}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  },
  {
    id:'05', tag:'05 · Voces del público',
    title:'En sus propias palabras.',
    acento:'palabras',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:14 }}>
          Reacciones representativas de la semana, ordenadas del reconocimiento al reclamo:
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          <QuoteCard text="No entrevisté a Pepe Aguilar para hablar de polémicas. Lo entrevisté para hablar de legado. En esta conversación hablamos de Antonio Aguilar, de la disciplina que construyó una de las dinastías más importantes de la música mexicana." source="Javibi · Jun 8 · creador de contenido" tone="pos" />
          <QuoteCard text="Pepe Aguilar habló sobre la relación que mantiene con sus hijos y dejó claro el enorme amor que siente por cada uno: 'Todos aquí venimos a aprender. Los amo.'" source="Instagram · Jun 9 · tono favorable" tone="pos" />
          <QuoteCard text="Las redes sociales se encendieron luego de que Pepe Aguilar apareciera junto a Chicharito Hernández. Ver el carisma de la música de mariachi y la pasión del fútbol juntos." source="Facebook · Jun 11 · momento positivo" tone="pos" />
          <QuoteCard text="Pepe Aguilar hablando despectivamente de Dua Lipa y otras mujeres." source="TikTok · Jun 9 · alto alcance" tone="neg" />
          <QuoteCard text="¡No quieren prensa, quieren defensores! La acusación que sacude a los Aguilar." source="TikTok · Jun 10 · Jomari Goyso referenciado" tone="neg" />
          <QuoteCard text="Bajo presión: Pepe Aguilar obliga a Majo a disculparse con Ángela en público." source="TikTok · Jun 10 · publicación viral recurrente" tone="neg" />
        </div>
      </>
    )
  },
  {
    id:'06', tag:'06 · Conclusión',
    title:'El formato entrevista funciona con el guión correcto.',
    acento:'guión',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:12 }}>
          Jun 8 y Jun 11 demuestran que la entrevista como formato es favorable para Pepe cuando está anclada en legado, disciplina y música. El problema no es el formato, es la exposición a preguntas o contextos que activan las narrativas de familia, soberbia o competencia con otros artistas.
        </p>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:20 }}>
          Jun 12 fue un caso de tres detonantes simultáneos en un contexto de alta atención (Mundial). Una sola declaración fuera de guión en ese contexto es suficiente para anular tres días de cobertura positiva.
        </p>
        <div style={{ border:`1px solid ${border}`, borderRadius:3, padding:'20px 24px', textAlign:'center',
          background:paper, margin:'8px 0 16px' }}>
          <p style={{ fontFamily:SANS, fontWeight:400, fontSize:16, fontStyle:'italic', color:ink,
            lineHeight:1.5, margin:0, letterSpacing:'-0.01em' }}>
            «El legado abre crédito; el carácter lo gasta. Tres días positivos se borraron en uno.»
          </p>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase',
            color:muted, marginTop:12 }}>Síntesis de la ventana 8–13 Jun 2026</div>
        </div>
        <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.10em', textTransform:'uppercase',
          color:muted, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
          <span>Folio · BW-26-06-PA-ENTREV-002</span>
          <span>Preparado por Blackwell Strategy</span>
          <span style={{ color:crim, fontWeight:600 }}>Confidencial · uso interno</span>
        </div>
      </>
    )
  },
];

/* ─── REPORTE 3: Álbum QVAA · BW-26-06-PA-RAPA-001 ─────────── */
const ALBUM_SECTIONS = [
  {
    id:'01', tag:'01 · Qué se midió — alcance y método',
    title:'Cuánto pesó el álbum en el periodo.',
    acento:'pesó',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:12 }}>
          Este reporte mide el <strong style={{color:ink}}>peso y el impacto</strong> del disco homenaje «¡Que Viva Antonio Aguilar!» dentro del total de la conversación pública sobre Pepe Aguilar, entre el <strong style={{color:ink}}>1 y el 15 de junio de 2026</strong>. La pregunta es de proporción: frente a todo lo que se dijo de Pepe en la ventana, ¿qué tanto espacio ocupó el álbum y cómo se compara con los demás temas?
        </p>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Se rastreó toda la conversación social sobre Pepe —TikTok, Facebook, Instagram y YouTube— y, dentro de ella, cada mención del disco. Eso permite leer el álbum no de forma aislada, sino como una fracción medible del total.
        </p>
        <Table
          headers={['Insumo','Qué aportó','Volumen']}
          rows={[
            ['Conversación total sobre Pepe','Universo base de publicaciones y comentarios en la ventana','293 publicaciones · 376 comentarios'],
            ['Menciones del álbum','Huella del disco dentro de esa conversación','71 publicaciones · 88 comentarios'],
            ['Engagement confirmado','Reproducciones del sencillo «China de los Ojos Negros» en YouTube Music','1.3 M de reproducciones'],
          ]}
        />
        <Callout label="Cómo leer las cifras">
          Los porcentajes son participación de la conversación (share of voice) calculada sobre la clasificación cualitativa de las publicaciones de la ventana. Indican proporción y peso relativo, no la salida directa de una herramienta de social listening.
        </Callout>
      </>
    )
  },
  {
    id:'02', tag:'02 · El peso del álbum en cifras',
    title:'Mucha huella, peso acotado.',
    acento:'acotado',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          El álbum tuvo visibilidad, pero su peso como tema propio fue limitado. Aparece en cerca de una de cada cuatro publicaciones, mientras que como conversación estrictamente musical ocupa apenas la mitad de esa huella.
        </p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          <BigStat num="24%" label="Huella en la conversación" sub="1 de cada 4 publicaciones" color={goldDeep} />
          <BigStat num="13%" label="Peso como tema musical" sub="eje música / álbum" color={ink} />
          <BigStat num="1.3 M" label="Engagement del sencillo" sub="«China de los Ojos Negros»" color={teal} />
          <BigStat num="Parcial" label="¿Movió la aguja?" sub="visibilidad alta, peso bajo" color={muted} />
        </div>
        <Callout>
          La distancia entre el <strong>24% de huella</strong> y el <strong>13% de peso musical</strong> es el dato central: casi la mitad de las menciones del álbum no hablan de la música, sino que lo usan como gancho para la conversación familiar —sobre todo las ausencias del tributo.
        </Callout>
      </>
    )
  },
  {
    id:'03', tag:'03 · El álbum frente al resto de la conversación',
    title:'La familia domina; el álbum compite por el segundo lugar.',
    acento:'familia',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Repartida toda la conversación sobre Pepe por eje temático, la participación de cada tema quedó así:
        </p>
        <div style={{ marginBottom:16 }}>
          {[
            { label:'Familia y dinastía', pct:60, color:crim },
            { label:'Álbum y música', pct:13, color:gold },
            { label:'Identidad nacional', pct:12, color:teal },
            { label:'Otros', pct:13, color:'#A9997B' },
            { label:'Figura pública / empresario', pct:2, color:muted },
          ].map(r => <HBar key={r.label} {...r} />)}
        </div>
        <Table
          headers={['Eje','Peso','Qué lo compone']}
          rows={[
            ['Familia y dinastía','60%','Conflictos y exclusiones de la dinastía; eje dominante de la ventana'],
            ['Álbum y música','13%','El homenaje «¡Que Viva Antonio Aguilar!» y las canciones clásicas'],
            ['Identidad nacional','12%','Orgullo mexicano y defensa de la cultura ranchera'],
            ['Otros','13%','Nostalgia, rumores varios y contenido misceláneo'],
            ['Figura pública / empresario','2%','Sello, rancho y decisiones de negocio'],
          ]}
        />
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginTop:12 }}>
          Como tema musical, el álbum es el segundo eje de la conversación, pero a gran distancia del bloque familiar, que pesa más de cuatro veces. El lanzamiento atrajo visibilidad sin desplazar el centro de gravedad de lo que se habla de Pepe.
        </p>
      </>
    )
  },
  {
    id:'04', tag:'04 · Dónde pesó realmente el álbum',
    title:'Dentro de sus menciones, la música no fue mayoría.',
    acento:'música',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Al abrir solo las publicaciones que mencionan el disco, se ve por qué su peso musical es menor que su huella: buena parte de esas menciones giran hacia las ausencias y la lectura de oportunismo, no hacia las canciones.
        </p>
        <Table
          headers={['Eje dentro del álbum','Peso','Qué lo compone']}
          rows={[
            ['Recepción musical y legado','38%','Las 16 versiones, las voces invitadas y la preservación de la ranchera de Antonio'],
            ['Ausencias del tributo','30%','Majo, Christian Nodal y Emiliano fuera del disco'],
            ['Lectura de oportunismo','18%','El homenaje leído como maniobra comercial'],
            ['Cobertura informativa','14%','Entrevistas y notas de lanzamiento'],
          ]}
        />
        <Callout>
          Solo cerca del <strong>38%</strong> de las menciones del álbum tratan de la música; el resto lo usa como punto de partida para el drama familiar y la figura de Pepe. El corazón musical existe —«La cama de piedra» con Banda El Recodo, «Triste Recuerdo» con Lucero, «Un Puño de Tierra» con Carlos Rivera y <strong>Carín León</strong> como corte destacado—, pero convive con un peso similar de conversación no musical.
        </Callout>
      </>
    )
  },
  {
    id:'05', tag:'05 · Impacto en la percepción',
    title:'Visibilidad positiva, crítica en las decisiones.',
    acento:'positiva',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Medido el tono de la conversación del álbum, el impacto sobre la imagen de Pepe es favorable en lo musical y crítico en lo familiar.
        </p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          <BigStat num="22%" label="Positivo" sub="música y legado" color={teal} />
          <BigStat num="53%" label="Neutral" sub="informativo" color={'#6B8C7A'} />
          <BigStat num="25%" label="Negativo" sub="decisiones y ausencias" color={crim} />
          <BigStat num="Medio" label="Riesgo reputacional" sub="casi todo doméstico" color={gold} />
        </div>
        <Callout label="Lectura por plataforma">
          <strong>Instagram</strong> fue el más positivo —emoción por las versiones y los intérpretes—. <strong>Facebook</strong> concentró la crítica por las ausencias y el oportunismo. <strong>TikTok</strong> se mantuvo neutral con picos de rechazo. <strong>YouTube</strong> fue el terreno más limpio, encabezado por los 1.3 M de reproducciones de «China de los Ojos Negros».
        </Callout>
      </>
    )
  },
  {
    id:'06', tag:'06 · Conclusión',
    title:'Se vio mucho; pesó poco como tema propio.',
    acento:'poco',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:12 }}>
          El álbum dejó huella en la ventana: tocó cerca de una de cada cuatro publicaciones y su sencillo principal sumó 1.3 M de reproducciones. Pero como conversación autónoma su peso fue acotado —13% del total— y quedó muy por detrás del eje familiar (60%), que siguió siendo el centro de gravedad de todo lo que se habla de Pepe.
        </p>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:20 }}>
          El impacto real del disco fue más de <strong style={{color:ink}}>visibilidad que de instalación de tema</strong>: funcionó como detonante de la conversación sobre la dinastía —sobre todo por las ausencias— más que como un asunto musical capaz de mover por sí solo el centro de la conversación.
        </p>
        <Callout label="Nota metodológica">
          Los porcentajes provienen de la clasificación cualitativa de las 293 publicaciones y 376 comentarios de la ventana; la huella del álbum se calcula sobre las 71 publicaciones y 88 comentarios que lo mencionan.
        </Callout>
        <div style={{ border:`1px solid ${border}`, borderRadius:3, padding:'20px 24px', textAlign:'center', background:paper, margin:'16px 0' }}>
          <p style={{ fontFamily:SANS, fontWeight:400, fontSize:16, fontStyle:'italic', color:ink, lineHeight:1.5, margin:0, letterSpacing:'-0.01em' }}>
            «El álbum se vio mucho, pero pesó poco: encendió la conversación familiar más de lo que instaló la suya propia.»
          </p>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase', color:muted, marginTop:12 }}>Síntesis de la ventana 1 – 15 Jun 2026</div>
        </div>
        <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.10em', textTransform:'uppercase', color:muted, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
          <span>Folio · BW-26-06-PA-RAPA-001</span>
          <span>Preparado por Blackwell Strategy</span>
          <span style={{ color:crim, fontWeight:600 }}>Confidencial · uso interno</span>
        </div>
      </>
    )
  },
];

/* ─── REPORTE 4: Entrevistas QVDA ───────────────────────────── */
const ENTREVISTAS_PDF_SECTIONS = [
  {
    id:'01', tag:'01 · Qué se midió — fuentes y alcance',
    title:'La conversación que dejaron las entrevistas.',
    acento:'entrevistas',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:12 }}>
          Este reporte mide cómo reaccionó el público a las actividades de promoción del álbum <em>Que Viva Antonio Aguilar</em> durante la ventana del <strong style={{color:ink}}>3 al 10 de junio de 2026</strong>. La base analizada es de <strong style={{color:ink}}>1,388 reacciones públicas únicas</strong>, repartidas entre cobertura de medios en Instagram y los hilos de los creadores de TikTok.
        </p>
        <Table
          headers={['Evento','Asistentes','Tono general']}
          rows={[
            ['Press junket · 3 de junio','EFE, Imagen Noticias, N+, ADN 40, Univisión, La Mejor FM y La Ke Buena','Favorable'],
            ['Entrevistas «banqueteras» · 3 de junio','Televisa Espectáculos, Venga la Alegría, El Junket, El Gordo y la Flaca','Favorable · Inclinación por tema familiar'],
            ['Encuentro con creadores · 8 de junio','Christian Mart, David Peralta, Javibi, BYMA Media y Posta','Favorable'],
          ]}
        />
        <Callout label="Qué disparó la conversación">
          El público reaccionó más hacia el <strong>personaje que hacia las canciones del álbum</strong>: el homenaje al padre, el lugar de la familia y dinastía, y frases sueltas de las propias entrevistas. La música funcionó como punto de partida; la discusión derivó casi siempre hacia la figura pública.
        </Callout>
      </>
    )
  },
  {
    id:'02', tag:'02 · El saldo del periodo',
    title:'Más cálido de lo habitual.',
    acento:'cálido',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          En esta ventana de entrevistas el saldo es <strong style={{color:ink}}>netamente más positivo</strong> que la percepción general de Pepe como figura pública. El homenaje a Antonio Aguilar y el marco de orgullo mexicano elevaron el tono; la crítica no desapareció, pero quedó concentrada y en minoría.
        </p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          <BigStat num="36%" label="Positivo" sub="talento y homenaje" color={teal} />
          <BigStat num="54%" label="Neutral" sub="informativo" color={'#6B8C7A'} />
          <BigStat num="10%" label="Negativo" sub="carácter y familia" color={crim} />
          <BigStat num="+14" label="vs. base habitual" sub="pts. positivo" color={goldDeep} />
        </div>
        <Callout>
          Como referencia, la percepción general de Pepe como figura pública se reparte en <strong>36% positivo / 53% neutral / 10% negativo</strong>. La ventana de entrevistas casi <strong>duplica</strong> el sentimiento positivo y reduce el negativo a menos de la mitad: el formato entrevista, anclado en el disco y el padre, lo favorece.
        </Callout>
      </>
    )
  },
  {
    id:'03', tag:'03 · De qué habló el público',
    title:'Los ejes de la reacción.',
    acento:'ejes',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Clasificando las reacciones por tema, así se repartió la conversación sobre las entrevistas y su tono dentro de cada eje:
        </p>
        <Table
          headers={['Eje de la conversación','Peso','Tono dentro del eje']}
          rows={[
            ['Talento y música','21%','59% positivo · reconocimiento a la voz y el oficio'],
            ['Familia y dinastía','11%','Mixto · 37% pos / 14% neg (Majo, Ángela, hijos)'],
            ['Homenaje y legado de Antonio','11%','54% positivo · «que viva Antonio Aguilar»'],
            ['México y orgullo cultural','8%','72% positivo · el eje más cálido'],
            ['Soberbia / arrogancia','4%','84% negativo · el foco más duro'],
            ['Oportunismo / interés comercial','2%','68% negativo · «lucra con el legado»'],
            ['Hartazgo / saturación','1%','75% negativo · «ya aburre esa familia»'],
          ]}
        />
        <Callout>
          El <strong>volumen</strong> está del lado del talento, el homenaje y México; la <strong>negatividad</strong> es poca en cantidad pero muy concentrada en carácter y comercialización. Es exactamente el patrón de una figura «respetada en lo artístico y vulnerable en lo personal».
        </Callout>
      </>
    )
  },
  {
    id:'04', tag:'04 · Las dos caras',
    title:'Lo que sumó y lo que restó.',
    acento:'sumó',
    render: () => (
      <>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:'0.12em', textTransform:'uppercase', color:teal, fontWeight:600, marginBottom:10 }}>Lo que sumó</div>
            {[
              { bold:'El homenaje al padre.', text:'El disco tributo a Antonio Aguilar fue leído como acto de amor y de preservación del legado: «una joya este álbum y qué viva Antonio Aguilar».' },
              { bold:'Talento y oficio.', text:'La voz, la trayectoria y el rol de maestro del regional mexicano se reconocen casi sin disputa.' },
              { bold:'Orgullo mexicano.', text:'El marco de cultura, tradición y ranchera es el más cálido: «Pepe Aguilar es México, tradición y cultura».' },
              { bold:'Resiliencia frente a la crítica.', text:'Un sector lo defiende activamente: «los haters hablando pestes y ellos no paran de trabajar».' },
            ].map((it,i) => (
              <div key={i} style={{ marginBottom:9, paddingLeft:8, borderLeft:`2px solid ${teal}` }}>
                <span style={{ fontFamily:SANS, fontWeight:600, fontSize:12, color:ink }}>{it.bold} </span>
                <span style={{ fontFamily:SANS, fontSize:12, color:muted }}>{it.text}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:'0.12em', textTransform:'uppercase', color:crim, fontWeight:600, marginBottom:10 }}>Lo que restó</div>
            {[
              { bold:'Percepción de soberbia.', text:'El foco más duro (84% negativo): lo tachan de prepotente y de «hacerse el humilde» en cámara.' },
              { bold:'Sospecha de oportunismo.', text:'Acusaciones de «lucrar con el legado del padre» y de promoción interesada tras el homenaje a Vicente Fernández.' },
              { bold:'La familia como peso.', text:'Majo, Ángela, los hijos y el contexto Cazzu se cuelan incluso cuando la entrevista es sobre el disco.' },
              { bold:'Saturación.', text:'«Ya aburre esa familia».' },
              { bold:'La sombra del padre.', text:'«Es bueno, pero no se compara a su papá, el gran Don Antonio».' },
            ].map((it,i) => (
              <div key={i} style={{ marginBottom:9, paddingLeft:8, borderLeft:`2px solid ${crim}` }}>
                <span style={{ fontFamily:SANS, fontWeight:600, fontSize:12, color:ink }}>{it.bold} </span>
                <span style={{ fontFamily:SANS, fontSize:12, color:muted }}>{it.text}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  },
  {
    id:'05', tag:'05 · La entrevista como objeto',
    title:'Cuando el reclamo es la entrevista misma.',
    acento:'entrevista',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:14 }}>
          Parte de la crítica no apuntó a Pepe sino al <strong style={{color:ink}}>acto de entrevistarlo</strong>. Un sector del público reprochó a los conductores —sobre todo a Paola Rojas— haberle dado espacio, y anunció que no vería el contenido.
        </p>
        <Table
          headers={['Reacción representativa','♥','Lectura']}
          rows={[
            ['«Me caes de 10 Paola, pero por esta vez no veré esa entrevista…»','907','Rechazo a la entrevista, al entrevistado'],
            ['«Llevar a ese soberbio no… Paola, la cagaste.»','60','Reproche al medio'],
            ['«El compra premios.»','277','Sospecha de cobertura pagada'],
            ['«Les compra para que hablen bien de la hija, jajaja.»','83','Cobertura ligada a defender a Ángela'],
            ['«Pésimo comentario de Pepe… "y no me llega".»','168','Frase de la entrevista leída como prepotente'],
          ]}
        />
        <Callout label="Punto de fricción" color={crim}>
          La frase <strong>«y no me llega»</strong>, dicha por Pepe en la entrevista, se volvió el soundbite negativo más citado: se interpretó como «el inalcanzable» y alimentó la narrativa de soberbia. Es el tipo de declaración suelta que define la lectura de toda una entrevista.
        </Callout>
      </>
    )
  },
  {
    id:'06', tag:'06 · Voces del público',
    title:'En sus propias palabras.',
    acento:'palabras',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:14 }}>
          Reacciones representativas ordenadas por resonancia, de la admiración al reclamo:
        </p>
        <Table
          headers={['Comentario','♥','Eje']}
          rows={[
            ['«Pepe… mi más profunda admiración. Tu voz es un referente de nuestra música regional.»','145','Talento'],
            ['«Pepe Aguilar es México, tradición y cultura.»','81','Orgullo'],
            ['«Es una joya este álbum y que viva Antonio Aguilar.»','72','Homenaje'],
            ['«Los haters hablando pestes de los Aguilar y ellos no paran de trabajar.»','56','Defensa'],
            ['«Es bueno, pero no se compara a su papá, el gran Don Antonio.»','930','La sombra del padre'],
            ['«Qué hueva con los Aguilar.»','609','Hartazgo'],
            ['«De esa "dinastía" a muchos mexicanos ya no nos interesa saber nada.»','562','Saturación'],
            ['«Las críticas que le hace a Cazzu no son de gratis.»','177','Familia'],
            ['«Ya aburre esa familia, ¿no habrá más cantantes que entrevistar?»','148','Saturación'],
          ]}
        />
      </>
    )
  },
  {
    id:'07', tag:'07 · Conclusión',
    title:'El homenaje abre crédito; el carácter lo gasta.',
    acento:'crédito',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:12 }}>
          Las entrevistas funcionaron a favor de Pepe, pues se anclaron en el disco y en la figura de su padre, movieron la percepción a terreno más cálido que su imagen pública habitual. El talento, el legado y el orgullo mexicano dominaron en volumen y en tono.
        </p>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:20 }}>
          El riesgo no es musical, es <strong style={{color:ink}}>de carácter y de saturación</strong>: la minoría crítica es pequeña pero intensa. Cuidar el tono en cámara y dosificar la exposición de la familia es lo que protege la conversación.
        </p>
        <div style={{ border:`1px solid ${border}`, borderRadius:3, padding:'20px 24px', textAlign:'center', background:paper, margin:'8px 0 16px' }}>
          <p style={{ fontFamily:SANS, fontWeight:400, fontSize:16, fontStyle:'italic', color:ink, lineHeight:1.5, margin:0, letterSpacing:'-0.01em' }}>
            «El homenaje abre crédito; el carácter lo gasta.»
          </p>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase', color:muted, marginTop:12 }}>Síntesis de la ventana 3 – 10 Jun 2026</div>
        </div>
        <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.10em', textTransform:'uppercase', color:muted, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
          <span>Folio · PPA-ENTREV-QVDA</span>
          <span>Preparado por Blackwell Strategy</span>
          <span style={{ color:crim, fontWeight:600 }}>Confidencial · uso interno</span>
        </div>
      </>
    )
  },
];

/* ─── REPORTE 5: Actividades Mayo–Junio (PPTX deck) ─────────── */
const ACTIVIDADES_SECTIONS = [
  {
    id:'01', tag:'01 · Resumen · actividades mayo–junio',
    title:'Todo lo producido en el periodo.',
    acento:'producido',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Todo entregable producido entre mayo y junio operó con una sola intención: <strong style={{color:ink}}>blindar la imagen, anticipar crisis y construir criterio editorial</strong>. A continuación los entregables principales del período.
        </p>
        {[
          { num:'01', titulo:'Resumen de reputación de Pepe Aguilar en 6 meses', desc:'Reporte que analiza el estado mediático de Pepe Aguilar y que da directriz del rumbo a seguir.' },
          { num:'02', titulo:'Boletín sobre la lista Billboard Indie Power Players', desc:'Revisión y recomendaciones para el comunicado sobre la inclusión de Pepe en el listado, a fin de prevenir frentes abiertos.' },
          { num:'03', titulo:'Plan estratégico de acción Mayo–Agosto', desc:'Primer draft de plan de comunicación: benchmark de artistas con conversaciones negativas, primeras recomendaciones estratégicas, mapeo de riesgos y Q&A con posturas.' },
          { num:'04', titulo:'Plan lanzamiento ¡Que Viva Don Antonio!', desc:'Guía de narrativa y actividades respecto al lanzamiento del tributo, blindando posibles ataques mediáticos por distintos flancos.' },
          { num:'05', titulo:'Comunicado cancelación evento · Teatro Esperanza Iris', desc:'Adaptación de comunicado para anunciar la cancelación del evento en el Teatro de la Ciudad debido a factores externos.' },
          { num:'06', titulo:'Media training previo a actividades de promoción', desc:'Sesión práctica y teórica con el equipo de Blackwell Strategy y Karla Iberia Sánchez —una de las periodistas más reconocidas del país— simulando una entrevista en vivo con preguntas de riesgo.' },
          { num:'07', titulo:'Acompañamiento Press junket QVAA', desc:'Envío de briefing books de medios asistentes para anticipar riesgos y retroalimentación in situ.' },
          { num:'08', titulo:'Acompañamiento con creadores QVAA', desc:'Envío de briefing books de los creadores de contenido convocados para contención de riesgos y retroalimentación in situ.' },
          { num:'09', titulo:'Retroalimentación y análisis de entrevistas', desc:'Detección de fortalezas y áreas de mejora de las actividades con medios realizadas por el lanzamiento del álbum (entrevistas 1:1 y "banqueteras").' },
          { num:'10', titulo:'Social Listenings de actividades de promoción', desc:'Dos escuchas: la primera sobre entrevistas 1:1, "banqueteras" y encuentro con creadores; la segunda, análisis de conversación del álbum dentro del universo de conversación de Pepe Aguilar.' },
          { num:'11', titulo:'Plan Pepe Aguilar Empresario', desc:'Planteamiento de línea narrativa basada en tres pilares (músico independiente, apasionado tecnológico y charro) para sumar atributos positivos y blindar ante conversaciones adversas.' },
        ].map(e => (
          <div key={e.num} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'10px 0',
            borderBottom:`1px solid ${border}` }}>
            <span style={{ fontFamily:MONO, fontSize:10, color:gold, fontWeight:600, flex:'none', width:24, paddingTop:2 }}>{e.num}</span>
            <div>
              <div style={{ fontFamily:SANS, fontWeight:600, fontSize:13, color:ink, marginBottom:3 }}>{e.titulo}</div>
              <div style={{ fontFamily:SANS, fontSize:12, color:muted, lineHeight:1.5 }}>{e.desc}</div>
            </div>
          </div>
        ))}
      </>
    )
  },
  {
    id:'02', tag:'02 · Hallazgos · lo que estas semanas revelaron',
    title:'Seis lecturas clave de la conversación pública.',
    acento:'clave',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Cada hallazgo se desprende del listening, del press junket o del comportamiento de medios entre mayo y junio.
        </p>
        {[
          { num:'01', color:teal, titulo:'Los canales propios funcionan como ancla narrativa.', desc:'Cuando Pepe comunica desde sus propios canales sobre música, la audiencia responde positivo. El silencio era lo que alimentaba la cobertura adversa; al romper el silencio con voz propia, revierte la conversación.' },
          { num:'02', color:gold, titulo:'Pepe es leído como símbolo de identidad nacional.', desc:'La conversación del álbum deja ver que el público lo asocia con mexicanidad y con tradiciones profundamente nacionales.' },
          { num:'03', color:teal, titulo:'Existe interés mediático genuino más allá de la crisis.', desc:'Hay un interés real en Pepe Aguilar, su trayectoria y legado profesional, lo que confirma que hay espacio mediático para hablar desde lo positivo.' },
          { num:'04', color:gold, titulo:'La conversación adversa es ruido inflado.', desc:'Una parte significativa del porcentaje negativo proviene de bots y perfiles falsos (varios ubicados en Malasia), de notas recicladas y de noticias falsas que algunos medios publican sin verificación.' },
          { num:'05', color:gold, titulo:'El ruido adverso se sostiene por desinformación.', desc:'Cuando una nota negativa sale, se apaga, y semanas después vuelve a salir reciclada. En otros casos, existen clips con descripciones que no coinciden con el video y alimentan el ruido sin sustento.' },
          { num:'06', color:teal, titulo:'Pepe Empresario es la palanca para ampliar lo positivo.', desc:'La narrativa empresarial no solo balancea: también amplía la cobertura positiva hacia ecosistemas nuevos (tech, emprendimiento, cultura, deporte). Al ampliar la conversación, blinda y abre una ventana de oportunidad activa.' },
        ].map(h => (
          <div key={h.num} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'12px 0',
            borderBottom:`1px solid ${border}` }}>
            <span style={{ fontFamily:MONO, fontSize:11, color:h.color, fontWeight:700, flex:'none', width:24, paddingTop:2 }}>{h.num}</span>
            <div>
              <div style={{ fontFamily:SANS, fontWeight:600, fontSize:13, color:ink, marginBottom:4 }}>{h.titulo}</div>
              <div style={{ fontFamily:SANS, fontSize:12.5, color:muted, lineHeight:1.6 }}>{h.desc}</div>
            </div>
          </div>
        ))}
      </>
    )
  },
  {
    id:'03', tag:'03 · Siguientes pasos · ruta recomendada',
    title:'Tomar control. Ampliar lo positivo. Blindar lo adverso.',
    acento:'positivo',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          El silencio alimentaba la conversación negativa. La voz propia ya empezó a revertir esa lectura. La fase siguiente no es defensiva, es ofensiva.
        </p>
        {[
          { titulo:'Consolidar narrativa musical desde canales propios.', desc:'Ser los dueños de la narrativa de Pepe, con nuestros propios mensajes y la información que queremos compartir. Esto ya está revirtiendo la conversación adversa.', color:teal },
          { titulo:'Activar Pepe Empresario formalmente.', desc:'Ejecutar el Plan PPA Empresario para ampliar la narrativa con el objetivo de posicionar mensajes de manera positiva y blindar la conversación desde nuevos frentes.', color:gold },
          { titulo:'Capitalizar el activo de mexicanidad.', desc:'Identificar y activar los momentos donde Pepe tiene mayor exposición orgánica a temas nacionalistas para construir contenido alrededor de este tema, ya que es un activo que no se ha explotado.', color:goldDeep },
        ].map((p,i) => (
          <div key={i} style={{ borderLeft:`3px solid ${p.color}`, paddingLeft:14, marginBottom:16 }}>
            <div style={{ fontFamily:SANS, fontWeight:600, fontSize:13.5, color:ink, marginBottom:4 }}>{p.titulo}</div>
            <div style={{ fontFamily:SANS, fontSize:12.5, color:muted, lineHeight:1.6 }}>{p.desc}</div>
          </div>
        ))}
        <div style={{ border:`1px solid ${border}`, borderRadius:3, padding:'20px 24px', textAlign:'center',
          background:paper, margin:'16px 0' }}>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase',
            color:gold, fontWeight:600, marginBottom:10 }}>Lectura estratégica</div>
          <p style={{ fontFamily:SANS, fontWeight:400, fontSize:15, fontStyle:'italic', color:ink,
            lineHeight:1.55, margin:0, letterSpacing:'-0.01em' }}>
            «El silencio era lo que alimentaba la conversación adversa. La voz propia ya empezó a revertirla. La fase que sigue es empujar lo positivo, no defenderse de lo negativo.»
          </p>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase',
            color:muted, marginTop:12 }}>Blackwell Strategy · Reporte de Actividades Mayo–Junio 2026</div>
        </div>
        <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.10em', textTransform:'uppercase',
          color:muted, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
          <span>Folio · BW-26-MJUN-PA-ACT-001</span>
          <span>Preparado por Blackwell Strategy</span>
          <span style={{ color:crim, fontWeight:600 }}>Confidencial · uso interno</span>
        </div>
      </>
    )
  },
];

/* ─── REPORTE 6: Briefs Medios · Neiva Colombia ──────────────── */
const NEIVA_SECTIONS = [
  {
    id:'01', tag:'01 · Clasificación de Medios',
    title:'Categorías de cobertura para el concierto.',
    acento:'cobertura',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Se realizó una clasificación de los medios potenciales a dar cobertura al concierto en Neiva considerando la cobertura previa que han realizado acerca de Pepe Aguilar y la familia Aguilar para determinar su posible ángulo de publicación.
        </p>
        <Table
          headers={['Categoría','Criterio de clasificación y protocolo']}
          rows={[
            ['VERDE', 'Cobertura previa favorable o estrictamente musical. Alineado a los pilares del plan.'],
            ['AMARILLO', 'Cobertura mixta o que puede pedir ángulo familiar o personal. Manejable con brief firme y redirección a música.'],
            ['ROJO', 'Línea editorial sensacionalista o cobertura previa con tono adverso. Acceso solo bajo protocolo de contención.'],
          ]}
        />
        <Callout label="Objetivo de la clasificación">
          Determinar de manera anticipada el posible ángulo de los medios acreditados para mitigar riesgos reputacionales y asegurar que la cobertura se mantenga lo más cercana posible al ámbito artístico.
        </Callout>
      </>
    )
  },
  {
    id:'02', tag:'02 · Estrategia',
    title:'Estrategia de comunicación individual para Pepe.',
    acento:'individual',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Pepe y Ángela se presentan en el mismo festival. Es crucial reforzar una estrategia de comunicación en la que se separen marcas y se blinden los frentes abiertos:
        </p>
        {[
          { num:'01', titulo:'Centrarnos totalmente en Pepe', desc:'Toda la comunicación se realiza exclusivamente alrededor de Pepe. Las entrevistas se realizarán previas al concierto, en un espacio alterno para fortalecer el enfoque en Pepe, su show y sus mensajes clave.' },
          { num:'02', titulo:'Mexicanidad como fortaleza', desc:'Generar una narrativa con foco en la mexicanidad de Pepe, con su trayectoria, su historia y su raíz cultural, elementos que son respetados y valorados en Colombia.' },
          { num:'03', titulo:'Cariño colombiano', desc:'Generar contenido capitalizando el partido de Colombia en el Mundial. La narrativa debe enfocarse en la hermandad y la solidaridad de la comunidad latina y servir como puente para anunciar su llegada a Neiva.' },
          { num:'04', titulo:'Filtrado de medios', desc:'Se revisará minuciosamente la lista de medios acreditados para seleccionar y controlar a quiénes se les concede entrevista.' },
          { num:'05', titulo:'Protocolo de preguntas familiares', desc:'Ante preguntas del entorno familiar, redirigir la conversación al tema musical mediante pivotes al orgullo mexicano, el cariño por Colombia y su público. No defender, no aclarar.' },
        ].map(e => (
          <div key={e.num} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'10px 0',
            borderBottom:`1px solid ${border}` }}>
            <span style={{ fontFamily:MONO, fontSize:10, color:gold, fontWeight:600, flex:'none', width:24, paddingTop:2 }}>{e.num}</span>
            <div>
              <div style={{ fontFamily:SANS, fontWeight:600, fontSize:13, color:ink, marginBottom:3 }}>{e.titulo}</div>
              <div style={{ fontFamily:SANS, fontSize:12, color:muted, lineHeight:1.5 }}>{e.desc}</div>
            </div>
          </div>
        ))}
      </>
    )
  },
  {
    id:'03', tag:'03 · Objetivos de Comunicación',
    title:'Blindar y maximizar la voz de Pepe.',
    acento:'maximizar',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          La estrategia en Neiva se compone de dos objetivos centrales diseñados para mitigar el ruido y potenciar el posicionamiento artístico:
        </p>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
          <div style={{ flex:'1 1 280px', background:paper, border:`1px solid ${border}`, borderRadius:3, padding:'14px 16px' }}>
            <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:crim, fontWeight:600, marginBottom:6 }}>OBJ 01 · BLINDAR</div>
            <div style={{ fontFamily:SANS, fontWeight:600, fontSize:14, color:ink, marginBottom:6 }}>Cerrar los frentes abiertos</div>
            <p style={{ fontFamily:SANS, fontSize:12.5, color:muted, lineHeight:1.5, margin:0 }}>
              Asegurar que la conversación mediática se mantenga alineada con el posicionamiento artístico de Pepe, priorizando espacios enfocados en trayectoria, vigencia, legado musical y propuesta actual. Establecer un marco de comunicación claro.
            </p>
          </div>
          <div style={{ flex:'1 1 280px', background:paper, border:`1px solid ${border}`, borderRadius:3, padding:'14px 16px' }}>
            <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:teal, fontWeight:600, marginBottom:6 }}>OBJ 02 · MAXIMIZAR</div>
            <div style={{ fontFamily:SANS, fontWeight:600, fontSize:14, color:ink, marginBottom:6 }}>Capitalizar la voz propia</div>
            <p style={{ fontFamily:SANS, fontSize:12.5, color:muted, lineHeight:1.5, margin:0 }}>
              Capitalizar la voz propia de Pepe en un público que lo quiere. Consolidar una narrativa propia centrada en Pepe como figura principal. Capitalizar la conexión sólida y afectiva con el público colombiano, destacando catálogo, relación histórica, vínculo cultural México–Colombia y su rol de exponente de la mexicanidad.
            </p>
          </div>
        </div>
      </>
    )
  },
  {
    id:'04', tag:'04 · Mensajes Clave',
    title:'Cuatro anclas para el show.',
    acento:'anclas',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Mensajes diseñados como anclas narrativas para el show de Neiva. Incluye respuestas sugeridas para temas sensibles:
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
          {[
            { num:'01', label:'EL SHOW · "Vine a cantar para mi gente"', quote:'"Vine a Neiva a cantar para mi público. Colombia me ha acompañado por años y vengo a dar un show propio, con mi banda, mi catálogo y la energía que siempre me han pedido."' },
            { num:'02', label:'COLOMBIA · "Una relación de años"', quote:'"Colombia me ha tratado con un cariño que no he encontrado en muchos lados. Lo que canto esta noche está hecho con respeto a esa gente que me espera desde hace tanto."' },
            { num:'03', label:'ÁNGELA · "Cada artista, su propio escenario"', quote:'"Tuve el honor de ser su coach, su manager y su maestro en el camino. Hoy Ángela ya es una mujer, que lleva el entrenamiento de dos generaciones que con mucho orgullo le compartí. Ahora el camino es completamente suyo y de su público."' },
            { num:'04', label:'MÉXICO · "Representar a México es mi mayor orgullo"', quote:'"Para mí es un orgullo representar a México. Es la identidad que vive en mi sangre charra, en más de 30 discos de mariachi, en el legado que honro cada día. Es una fortuna que asumo con la responsabilidad que merece."' }
          ].map(m => (
            <div key={m.num} style={{ background:paper, border:`1px solid ${border}`, borderRadius:3, padding:'12px 14px' }}>
              <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.15em', color:gold, fontWeight:600, marginBottom:4 }}>{m.label}</div>
              <p style={{ fontFamily:SANS, fontSize:12.5, color:ink, lineHeight:1.5, margin:0, fontStyle:'italic' }}>{m.quote}</p>
            </div>
          ))}
        </div>
        <Callout label="Sobre Nodal, Cazzu, Emiliano" color={crim}>
          <strong>Respuesta unificada:</strong> "Cada quien habla por sí mismo. Hoy vine a cantar." Y regresar inmediatamente a la conversación sobre la música.
        </Callout>
      </>
    )
  },
  {
    id:'05', tag:'05 · Brief de Medios (01 de 03)',
    title:'Caracol Colombia · Categoría Amarillo',
    acento:'Amarillo',
    render: () => (
      <>
        <div style={{ background:paper, border:`1px solid ${border}`, borderRadius:3, padding:'14px 16px', marginBottom:16 }}>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:muted, marginBottom:4 }}>Contexto del medio</div>
          <p style={{ fontFamily:SANS, fontSize:12.5, color:ink, lineHeight:1.5, margin:0 }}>
            Es la cadena de televisión privada más grande de Colombia. Opera Noticias Caracol (noticiero nacional con franjas matutina y nocturna), Caracol TV (canal de entretenimiento y novelas) y portales digitales.
          </p>
          <div style={{ fontFamily:MONO, fontSize:9, color:muted, marginTop:8, letterSpacing:'0.06em' }}>
            <strong>Audiencia:</strong> Cobertura nacional en Colombia más la diáspora colombiana en EE. UU. vía Caracol Internacional.
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <div style={{ fontFamily:MONO, fontSize:10, color:gold, fontWeight:600, marginBottom:8 }}>Cinco cosas que saber:</div>
          {[
            'Medio tradicional masivo de Colombia.',
            'Línea editorial profesional pero amplia: cubre tanto música como controversia familiar.',
            'Pepe ya dio entrevista a Caracol TV en visitas anteriores. Hay antecedente de pregunta familiar.',
            'Caracol cubrió el show de los Aguilar en Movistar Arena Bogotá (oct 2024) con cobertura mixta.',
            'Acceso a programa estelar de noticias y a programa de entretenimiento del canal.'
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'6px 0', borderBottom:`1px solid ${border}` }}>
              <span style={{ color:gold, fontSize:12 }}>–</span>
              <span style={{ fontFamily:SANS, fontSize:12.5, color:muted, lineHeight:1.4 }}>{item}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontFamily:MONO, fontSize:10, color:gold, fontWeight:600, marginBottom:8 }}>Cobertura previa relevante:</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <QuoteCard text="¿Quién pagó la boda de Nodal y Ángela Aguilar? Pepe Aguilar respondió." source="Noticias Caracol · Entrevista a Pepe (Tono profesional pero pregunta directa familiar)" tone="neg" />
            <QuoteCard text="Cobertura del primer show de Los Aguilar en Bogotá con la sorpresa de Nodal subiendo al escenario." source="Caracol TV · Cobertura Movistar Arena 2024 (Cobertura mixta)" tone="neutral" />
            <QuoteCard text="Sección dedicada con videos, fotos y notas. Cubre con frecuencia tanto música como contexto familiar." source="Caracol TV · Sección Ángela Aguilar" tone="neutral" />
          </div>
        </div>
      </>
    )
  },
  {
    id:'06', tag:'06 · Brief de Medios (02 de 03)',
    title:'Publimetro Colombia · Categoría Amarillo',
    acento:'Amarillo',
    render: () => (
      <>
        <div style={{ background:paper, border:`1px solid ${border}`, borderRadius:3, padding:'14px 16px', marginBottom:16 }}>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:muted, marginBottom:4 }}>Contexto del medio</div>
          <p style={{ fontFamily:SANS, fontSize:12.5, color:ink, lineHeight:1.5, margin:0 }}>
            Grupo editorial con ediciones en varios países hispanohablantes (México, Chile, Colombia). Su sección de entretenimiento tiende al sensacionalismo y clickbait con titulares enfáticos en su portal y redes. Comparte marca con Publimetro México pero con redacción independiente.
          </p>
        </div>

        <div style={{ marginBottom:16 }}>
          <div style={{ fontFamily:MONO, fontSize:10, color:gold, fontWeight:600, marginBottom:8 }}>Cinco cosas que saber:</div>
          {[
            'Cobertura editorial centrada en figuras locales (Karol G, Jessi Uribe, Cepeda, etc.) y reality shows colombianos.',
            'No se localizaron piezas previas de Publimetro Colombia sobre Pepe Aguilar.',
            'Comparte marca con Publimetro México pero opera con redacción independiente (tono más informativo y menos clickbait que la edición nacional mexicana).',
            'Secciones de entretenimiento, cultura, estilo de vida y Publimetro TV. Su presencia en el festival se lee como ángulo cultural urbano.',
            'Posibilidad: cualquier declaración/soundbite de Pepe en Neiva puede ser editada o sacada de contexto en los titulares.'
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'6px 0', borderBottom:`1px solid ${border}` }}>
              <span style={{ color:gold, fontSize:12 }}>–</span>
              <span style={{ fontFamily:SANS, fontSize:12.5, color:muted, lineHeight:1.4 }}>{item}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontFamily:MONO, fontSize:10, color:gold, fontWeight:600, marginBottom:8 }}>Cobertura previa relevante:</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <QuoteCard text="Pepe Aguilar revela bochornoso detalle de la boda de Ángela." source="Publimetro Colombia · 2024" tone="neg" />
            <QuoteCard text="Pepe Aguilar le hizo emotiva promesa a Javier Acosta." source="Publimetro Colombia · 2024" tone="pos" />
          </div>
        </div>
      </>
    )
  },
  {
    id:'07', tag:'07 · Brief de Medios (03 de 03)',
    title:'Billboard Colombia · Categoría Verde',
    acento:'Verde',
    render: () => (
      <>
        <div style={{ background:paper, border:`1px solid ${border}`, borderRadius:3, padding:'14px 16px', marginBottom:16 }}>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:muted, marginBottom:4 }}>Contexto del medio</div>
          <p style={{ fontFamily:SANS, fontSize:12.5, color:ink, lineHeight:1.5, margin:0 }}>
            Publicación de referencia para la industria musical hispana y global. Opera bajo la línea de Billboard Español, enfocándose en la obra, charts, premios y entrevistas en profundidad sin sesgo personal ni enfoque en controversias familiares.
          </p>
        </div>

        <div style={{ marginBottom:16 }}>
          <div style={{ fontFamily:MONO, fontSize:10, color:gold, fontWeight:600, marginBottom:8 }}>Cinco cosas que saber:</div>
          {[
            'Billboard otorgó a Pepe Aguilar el Hall of Fame Award en los Billboard Latin Music Awards 2024 (relación institucional sólida y favorable).',
            'Cobertura previa amplia de la trayectoria de Pepe en español e inglés. Excelente para hablar de su show, catálogo en vivo y relación histórica con Colombia.',
            'Tono editorial de análisis musical puro, sin entrar en controversia familiar.',
            'Cobertura previa de Ángela en Women in Music 2025 (Breakthrough Award) enfocada en su trabajo como productora.',
            'Es calificado como uno de los mejores medios para accionar durante el festival.'
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'6px 0', borderBottom:`1px solid ${border}` }}>
              <span style={{ color:gold, fontSize:12 }}>–</span>
              <span style={{ fontFamily:SANS, fontSize:12.5, color:muted, lineHeight:1.4 }}>{item}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontFamily:MONO, fontSize:10, color:gold, fontWeight:600, marginBottom:8 }}>Cobertura previa relevante:</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <QuoteCard text="Pepe Aguilar to Receive the Billboard Hall of Fame Award at the 2024 Billboard Latin Music Awards." source="Billboard · 2024 (Reconocimiento institucional al catálogo)" tone="pos" />
            <QuoteCard text="¡Que Viva Antonio Aguilar! Pieza extensa con cobertura editorial del proyecto y la relación histórica de Don Antonio con Colombia." source="Billboard · 2026 (Buen anclaje para hablar del show)" tone="pos" />
            <QuoteCard text="Ángela Aguilar on Family, Producing Her Music & Supporting Women." source="Billboard · 2025 (Enfoque en producción musical)" tone="pos" />
          </div>
        </div>
      </>
    )
  },
  {
    id:'08', tag:'08 · Anexo · Filtrado de Medios',
    title:'Westwood · Lista de medios acreditados del festival.',
    acento:'Westwood',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Se revisará minuciosamente la lista de acreditados con acceso a la zona de prensa con el objetivo de filtrar a qué medios se les concede entrevista con Pepe antes de su llegada a Neiva.
        </p>

        <div style={{ background:paper, border:`1px solid ${border}`, borderRadius:3, padding:'14px 16px', marginBottom:16 }}>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:crim, fontWeight:600, marginBottom:4 }}>Situación Identificada</div>
          <p style={{ fontFamily:SANS, fontSize:12.5, color:ink, lineHeight:1.5, margin:0 }}>
            Reporteros colombianos operando como corresponsales encubiertos de medios de espectáculos mexicanos (venden la nota al mejor postor).
          </p>
        </div>

        <Callout label="Antecedente Verificado" color={crim}>
          En el tour anterior, un medio colombiano entrevistó a Pepe y luego mostró el cubo de <strong>Ventaneando</strong>. La nota llegó a México como "exclusiva de Ventaneando con Pepe Aguilar" cuando nunca se concedió tal entrevista.
        </Callout>

        <div style={{ marginTop:16 }}>
          <div style={{ fontFamily:MONO, fontSize:10, color:gold, fontWeight:600, marginBottom:8 }}>Reglas Operativas:</div>
          {[
            'Patrón conocido: hay reporteros colombianos que fungen como corresponsales de Imagen Televisión (Gustavo Adolfo Infante), Ventaneando y otros medios mexicanos.',
            'Regla de oro: si un medio colombiano no está explícitamente en la lista autorizada, NO se le concede entrevista.',
            'Cruces accidentales: si Pepe se cruza en zona común con un reportero no filtrado, debe usar una frase única de salida y continuar avanzando.'
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'6px 0', borderBottom:`1px solid ${border}` }}>
              <span style={{ color:gold, fontSize:12 }}>–</span>
              <span style={{ fontFamily:SANS, fontSize:12.5, color:muted, lineHeight:1.4 }}>{item}</span>
            </div>
          ))}
        </div>
      </>
    )
  }
];

/* ─── Main ReporteView ───────────────────────────────────────── */
export default function ReporteView({ isDesktop, data }) {
  const hasAiReport = !!data?.themes?.resumen?.ai_analysis;
  const [activeReport, setActiveReport] = useState(hasAiReport ? 'ia' : 'frontera');
  const [sectionIdx, setSectionIdx] = useState(0);

  const sections =
    activeReport === 'frontera' ? FRONTERA_SECTIONS :
    activeReport === 'periodo' ? PERIODO_SECTIONS :
    activeReport === 'entrevistas' ? ENTREV_SECTIONS :
    activeReport === 'actividades' ? ACTIVIDADES_SECTIONS :
    activeReport === 'album' ? ALBUM_SECTIONS :
    activeReport === 'neiva' ? NEIVA_SECTIONS :
    ENTREVISTAS_PDF_SECTIONS;
  
  const section = sections[sectionIdx];

  function switchReport(key) {
    setActiveReport(key);
    setSectionIdx(0);
  }

  return (
    <div style={{ padding: isDesktop ? '24px 28px 40px' : '20px 18px 40px' }}>

      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'0.18em', textTransform:'uppercase',
          color:gold, fontWeight:600 }}>Reporte · Percepción Pública</div>
        <h1 style={{ fontFamily:SANS, fontWeight:500, fontSize:28, letterSpacing:'-0.025em',
          color:ink, margin:'8px 0 4px', lineHeight:1.05 }}>
          Análisis de <em style={{ fontStyle:'normal', color:goldDeep }}>conversación</em>.
        </h1>
        <p style={{ fontSize:12, color:muted, margin:'0 0 16px' }}>
          Jun 1–16 · 4,832 publicaciones · cuatro temas monitoreados.
        </p>

        {/* Report selector */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {[
            ...(hasAiReport ? [{ key:'ia', label:'⚡ Reporte IA · Actual', sub:'generado del último análisis' }] : []),
            { key:'frontera', label:'Riesgo · Grupo Frontera', sub:'Edinburg, TX · 17 Jul 2026' },
            { key:'neiva', label:'Briefs Medios · Neiva', sub:'Colombia · 19 Jun 2026' },
            { key:'actividades', label:'Actividades · May–Jun', sub:'entregables y hallazgos' },
            { key:'album', label:'Álbum · QVAA', sub:'BW-26-06-PA-RAPA-001' },
            { key:'qvda', label:'Entrevistas · QVDA', sub:'PPA · 3–10 Jun 2026' },
          ].map(r => (
            <button key={r.key} onClick={() => switchReport(r.key)}
              style={{ padding:'9px 14px', borderRadius:3, cursor:'pointer',
                border: activeReport===r.key ? `1px solid ${gold}` : `1px solid ${border}`,
                background: activeReport===r.key ? gold : 'transparent',
                color: activeReport===r.key ? '#FBF8F1' : muted,
                fontFamily:MONO, fontSize:10, fontWeight:600, letterSpacing:'0.08em',
                textTransform:'uppercase', transition:'all 0.15s' }}>
              {r.label}
              <span style={{ display:'block', fontWeight:400, fontSize:8.5, opacity:0.75, marginTop:2 }}>{r.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {activeReport === 'ia' ? (
        <ReporteIA data={data} isDesktop={isDesktop} />
      ) : (
      <>
      {/* Section pills */}
      <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none', marginBottom:16, paddingBottom:4 }}>
        {sections.map((s,i) => (
          <button key={s.id} onClick={() => setSectionIdx(i)}
            style={{ flex:'none', fontFamily:MONO, fontSize:9.5, fontWeight:600, letterSpacing:'0.08em',
              padding:'5px 10px', borderRadius:999, cursor:'pointer', whiteSpace:'nowrap',
              border: i===sectionIdx ? `1px solid ${ink}` : `1px solid ${border}`,
              background: i===sectionIdx ? ink : 'transparent',
              color: i===sectionIdx ? '#FBF8F1' : muted,
              transition:'all 0.15s' }}>
            {s.id}
          </button>
        ))}
      </div>

      {/* Section card */}
      <AnimatePresence mode="wait">
        <motion.div key={`${activeReport}-${sectionIdx}`}
          initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
          transition={{ duration:0.22 }}
          style={{ background:'#FAF7F0', border:`1px solid ${border}`, borderRadius:4,
            padding: isDesktop ? '22px 24px' : '18px 16px' }}>

          <Tag>{section.tag}</Tag>
          <SectionTitle accent={section.acento}>{section.title}</SectionTitle>

          {section.render()}
        </motion.div>
      </AnimatePresence>

      {/* Prev / Next navigation */}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:14 }}>
        <button onClick={() => setSectionIdx(i => Math.max(0, i-1))}
          disabled={sectionIdx===0}
          style={{ fontFamily:MONO, fontSize:10, fontWeight:600, letterSpacing:'0.08em',
            padding:'8px 14px', borderRadius:2, cursor: sectionIdx===0 ? 'default' : 'pointer',
            border:`1px solid ${border}`, background:'transparent',
            color: sectionIdx===0 ? '#C4B89A' : ink, transition:'all 0.15s' }}>
          ← Anterior
        </button>
        <span style={{ fontFamily:MONO, fontSize:9.5, color:muted, alignSelf:'center' }}>
          {sectionIdx+1} / {sections.length}
        </span>
        <button onClick={() => setSectionIdx(i => Math.min(sections.length-1, i+1))}
          disabled={sectionIdx===sections.length-1}
          style={{ fontFamily:MONO, fontSize:10, fontWeight:600, letterSpacing:'0.08em',
            padding:'8px 14px', borderRadius:2, cursor: sectionIdx===sections.length-1 ? 'default' : 'pointer',
            border:`1px solid ${border}`, background:'transparent',
            color: sectionIdx===sections.length-1 ? '#C4B89A' : ink, transition:'all 0.15s' }}>
          Siguiente →
        </button>
      </div>
      </>
      )}

    </div>
  );
}
