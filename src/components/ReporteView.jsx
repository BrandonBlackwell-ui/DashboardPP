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

function QuoteCard({ text, likes, eje }) {
  return (
    <div style={{ background:paper, border:`1px solid ${border}`, borderRadius:3, padding:'11px 13px',
      display:'flex', gap:12, alignItems:'flex-start' }}>
      <div style={{ flex:1 }}>
        <p style={{ fontFamily:SANS, fontSize:12.5, color:ink, lineHeight:1.5, margin:0, fontStyle:'italic' }}>«{text}»</p>
        {eje && <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.08em', color:gold, textTransform:'uppercase', marginTop:4, display:'block' }}>{eje}</span>}
      </div>
      {likes && <span style={{ fontFamily:MONO, fontSize:10, color:muted, flex:'none', paddingTop:2 }}>♥ {likes}</span>}
    </div>
  );
}

/* ─── REPORTE 1: Álbum ───────────────────────────────────────── */
const ALBUM_SECTIONS = [
  {
    id:'01', tag:'01 · Qué se midió — Alcance y método',
    title:'Cuánto pesó el álbum en el periodo.',
    acento:'pesó',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:16 }}>
          Este reporte mide el <strong style={{color:ink}}>peso y el impacto</strong> del disco homenaje «¡Que Viva Antonio Aguilar!» dentro del total de la conversación pública sobre Pepe Aguilar, entre el <strong style={{color:ink}}>1 y el 15 de junio de 2026</strong>.
        </p>
        <Table
          headers={['Insumo','Qué aportó','Volumen']}
          rows={[
            ['Conversación total sobre Pepe','Universo base de publicaciones y comentarios en la ventana','293 publicaciones · 376 comentarios'],
            ['Menciones del álbum','Huella del disco dentro de esa conversación','71 publicaciones · 88 comentarios'],
            ['Engagement confirmado','Reproducciones del sencillo «China de los Ojos Negros» en YouTube','1.3 M de reproducciones'],
          ]}
        />
        <Callout label="Cómo leer las cifras">
          Los porcentajes son participación de la conversación (share of voice) calculada sobre la clasificación cualitativa de las publicaciones. Indican proporción y peso relativo, no la salida directa de una herramienta de social listening.
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
          Al abrir solo las publicaciones que mencionan el disco, se ve por qué su peso musical es menor que su huella: buena parte de esas menciones giran hacia las ausencias y la lectura de oportunismo.
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
          Solo cerca del <strong>38%</strong> de las menciones del álbum tratan de la música; el resto lo usa como punto de partida para el drama familiar y la figura de Pepe. El corazón musical existe —«La cama de piedra», «Triste Recuerdo», «Un Puño de Tierra»— pero convive con un peso similar de conversación no musical.
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
        <div style={{ border:`1px solid ${border}`, borderRadius:3, padding:'20px 24px', textAlign:'center',
          background:paper, margin:'8px 0 16px' }}>
          <p style={{ fontFamily:SANS, fontWeight:400, fontSize:16, fontStyle:'italic', color:ink,
            lineHeight:1.5, margin:0, letterSpacing:'-0.01em' }}>
            «El álbum se vio mucho, pero pesó poco: encendió la conversación familiar más de lo que instaló la suya propia.»
          </p>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase',
            color:muted, marginTop:12 }}>Síntesis de la ventana 1 – 15 Jun 2026</div>
        </div>
        <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.10em', textTransform:'uppercase',
          color:muted, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
          <span>Folio · BW-26-06-PA-RAPA-001</span>
          <span>Preparado por Blackwell Strategy</span>
          <span style={{ color:crim, fontWeight:600 }}>Confidencial · uso interno</span>
        </div>
      </>
    )
  },
];

/* ─── REPORTE 2: Entrevistas ─────────────────────────────────── */
const ENTREV_SECTIONS = [
  {
    id:'01', tag:'01 · Qué se midió — Fuentes y alcance',
    title:'La conversación que dejaron las entrevistas.',
    acento:'entrevistas',
    render: () => (
      <>
        <p style={{ fontFamily:SANS, fontSize:13, color:muted, lineHeight:1.6, marginBottom:12 }}>
          Este reporte mide cómo reaccionó el público a las actividades de promoción del álbum <em>Que Viva Antonio Aguilar</em> durante la ventana del <strong style={{color:ink}}>3 al 10 de junio de 2026</strong>. La base analizada es de <strong style={{color:ink}}>1,388 reacciones públicas</strong> únicas.
        </p>
        <Table
          headers={['Evento','Asistentes','Tono general']}
          rows={[
            ['Press junket, 3 de junio','EFE, Imagen Noticias, N+, ADN 40, Univisión, La Mejor FM y La Ke Buena','Favorable'],
            ['Entrevistas «banqueteras», 3 de junio','Televisa Espectáculos, Venga la Alegría, El Junket, El Gordo y la Flaca','Favorable · Inclinación familiar'],
            ['Encuentro con creadores de contenido, 8 de junio','Christian Mart, David Peralta, Javibi, BYMA Media, Posta','Favorable'],
          ]}
        />
        <Callout label="Qué disparó la conversación">
          El público reaccionó más hacia el <strong>personaje vs. las canciones del álbum</strong>: el homenaje al padre, el lugar de la familia y la dinastía, y frases sueltas de las propias entrevistas. La música funcionó como punto de partida; la discusión derivó casi siempre hacia la figura pública.
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
          <BigStat num="36%" label="Positivo" sub="Talento y homenaje" color={teal} />
          <BigStat num="54%" label="Neutral" sub="informativo" color={'#6B8C7A'} />
          <BigStat num="10%" label="Negativo" sub="carácter y familia" color={crim} />
          <BigStat num="+14" label="vs. base" sub="pts. positivo" color={goldDeep} />
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
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:4 }}>
          <div>
            <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:'0.12em', textTransform:'uppercase',
              color:teal, fontWeight:600, marginBottom:10 }}>Lo que sumó</div>
            {[
              { bold:'El homenaje al padre.', text:'El disco tributo a Antonio Aguilar fue leído como acto de amor y de preservación del legado.' },
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
            <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:'0.12em', textTransform:'uppercase',
              color:crim, fontWeight:600, marginBottom:10 }}>Lo que restó</div>
            {[
              { bold:'Percepción de soberbia.', text:'El foco más duro (84% negativo): lo tachan de prepotente y de «hacerse el humilde» en cámara.' },
              { bold:'Sospecha de oportunismo.', text:'Acusaciones de «lucrar con el legado del padre» y de promoción interesada.' },
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
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {[
            { text:'Pepe… mi más profunda admiración. Tu voz es un referente de nuestra música regional.', likes:'145', eje:'Talento' },
            { text:'Pepe Aguilar es México, tradición y cultura.', likes:'81', eje:'Orgullo' },
            { text:'Es una joya este álbum y que viva Antonio Aguilar.', likes:'72', eje:'Homenaje' },
            { text:'Los haters hablando pestes de los Aguilar y ellos no paran de trabajar.', likes:'56', eje:'Defensa' },
            { text:'Es bueno, pero no se compara a su papá, el gran Don Antonio.', likes:'930', eje:'La sombra del padre' },
            { text:'Qué hueva con los Aguilar.', likes:'609', eje:'Hartazgo' },
            { text:'De esa "dinastía" a muchos mexicanos ya no nos interesa saber nada.', likes:'562', eje:'Saturación' },
            { text:'Las críticas que le hace a Cazzu no son de gratis.', likes:'177', eje:'Familia' },
            { text:'Ya aburre esa familia, ¿no habrá más cantantes que entrevistar?', likes:'148', eje:'Saturación' },
          ].map((q,i) => <QuoteCard key={i} {...q} />)}
        </div>
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
        <div style={{ border:`1px solid ${border}`, borderRadius:3, padding:'20px 24px', textAlign:'center',
          background:paper, margin:'8px 0 16px' }}>
          <p style={{ fontFamily:SANS, fontWeight:400, fontSize:16, fontStyle:'italic', color:ink,
            lineHeight:1.5, margin:0, letterSpacing:'-0.01em' }}>
            «El homenaje abre crédito; el carácter lo gasta.»
          </p>
          <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.14em', textTransform:'uppercase',
            color:muted, marginTop:12 }}>Síntesis de la ventana 3 – 10 Jun 2026</div>
        </div>
        <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.10em', textTransform:'uppercase',
          color:muted, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
          <span>Folio · BW-26-06-PPA-ENTREV-001</span>
          <span>Preparado por Blackwell Strategy</span>
          <span style={{ color:crim, fontWeight:600 }}>Confidencial · uso interno</span>
        </div>
      </>
    )
  },
];

/* ─── Main ReporteView ───────────────────────────────────────── */
export default function ReporteView({ isDesktop }) {
  const [activeReport, setActiveReport] = useState('album');
  const [sectionIdx, setSectionIdx] = useState(0);

  const sections = activeReport === 'album' ? ALBUM_SECTIONS : ENTREV_SECTIONS;
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
        <p style={{ fontSize:12, color:muted, margin:'0 0 16px' }}>Reportes de percepción sobre el álbum y las actividades de promoción.</p>

        {/* Report selector */}
        <div style={{ display:'flex', gap:6 }}>
          {[
            { key:'album', label:'Álbum · QVAA', sub:'1–15 Jun 2026' },
            { key:'entrevistas', label:'Entrevistas · QVDA', sub:'3–10 Jun 2026' },
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
