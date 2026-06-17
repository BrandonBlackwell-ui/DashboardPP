import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../utils/helpers';

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

/* ─── REPORTE 3: Actividades Mayo–Junio (PPTX deck) ─────────── */
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

/* ─── Main ReporteView ───────────────────────────────────────── */
export default function ReporteView({ isDesktop }) {
  const [activeReport, setActiveReport] = useState('periodo');
  const [sectionIdx, setSectionIdx] = useState(0);

  const sections = activeReport === 'periodo' ? PERIODO_SECTIONS : activeReport === 'entrevistas' ? ENTREV_SECTIONS : ACTIVIDADES_SECTIONS;
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
            { key:'periodo', label:'Período · Jun 1–16', sub:'resumen general' },
            { key:'entrevistas', label:'Entrevistas · Jun 8–13', sub:'ciclo de promo álbum' },
            { key:'actividades', label:'Actividades · May–Jun', sub:'entregables y hallazgos' },
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

    </div>
  );
}
