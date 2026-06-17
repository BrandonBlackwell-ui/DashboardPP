import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const MONO = "'Geist Mono',monospace";
const SANS = "'Geist',sans-serif";
const THEMES = [
  { key:'musica',      label:'Música' },
  { key:'entrevistas', label:'Entrevistas' },
  { key:'empresas',    label:'Empresas' },
  { key:'familia',     label:'Familia' },
];
const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function fmtDate(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function esc(s) {
  return '"' + String(s == null ? '' : s).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
}

function buildRow(rep) {
  const s = rep.sentiment?.[0] || {};
  const posts = rep.platforms?.reduce((a, p) => a + (p.posts || 0), 0) || 0;
  const platforms = (rep.platforms || []).map(p => p.platform).join(' | ');
  const prosPos = (rep.pros_cons || []).filter(x => x.type === 'pro').map(x => x.item).join(' | ');
  const prosCon = (rep.pros_cons || []).filter(x => x.type === 'con').map(x => x.item).join(' | ');
  const alerts = (rep.alert_posts || []).map(p => p.text).slice(0, 3).join(' | ');
  const opps = (rep.opportunity_posts || []).map(p => p.text).slice(0, 3).join(' | ');
  const topNews = (rep.news_items || []).slice(0, 3).map(n => n.titulo).join(' | ');
  const complaints = (rep.complaints || []).map(c => `${c.titulo} (${c.porcentaje}%)`).join(' | ');
  const trending = (rep.trending_topics || []).slice(0, 3).map(t => t.titulo).join(' | ');

  return [
    rep.date_key,
    rep.theme_label,
    s.pos || 0,
    s.neu || 0,
    s.neg || 0,
    s.risk_level || 'bajo',
    posts,
    platforms,
    prosPos,
    prosCon,
    complaints,
    alerts,
    opps,
    topNews,
    trending,
  ].map(esc).join(',');
}

const CSV_HEADER = [
  'fecha', 'tema',
  'positivo_%', 'neutral_%', 'negativo_%', 'riesgo',
  'total_posts', 'plataformas',
  'a_favor', 'en_contra',
  'quejas', 'alertas', 'oportunidades',
  'noticias_principales', 'tendencias',
].map(esc).join(',');

// Static rows from Reporte PDFs
const REPORTE_ROWS = [
  // --- Álbum BW-26-06-PA-RAPA-001 ---
  ['reporte_album','01_Qué se midió','','','','','293 pub · 376 coment','TikTok | Facebook | Instagram | YouTube','','','','','','','71 menciones álbum | 1.3M reproducciones «China de los Ojos Negros»'],
  ['reporte_album','02_Peso en cifras','','','','','','','','','','','','','Huella 24% | Peso musical 13% | Engagement 1.3M | Impacto: Parcial'],
  ['reporte_album','03_El álbum frente al resto','','','','','','','','','','','','','Familia/dinastía 60% | Álbum/música 13% | Identidad nacional 12% | Otros 13% | Figura pública 2%'],
  ['reporte_album','04_Dentro de sus menciones','','','','','','','','','','','','','Recepción musical 38% | Ausencias tributo 30% | Lectura oportunismo 18% | Cobertura informativa 14%'],
  ['reporte_album','05_Impacto percepción','22','53','25','medio','','','','','','','','','Instagram más positivo | Facebook concentró crítica | TikTok neutral | YouTube el más limpio'],
  ['reporte_album','06_Conclusión','','','','','','','','','','','','','«El álbum se vio mucho pero pesó poco: encendió la conversación familiar más de lo que instaló la suya propia.» — BW-26-06-PA-RAPA-001'],
  // --- Entrevistas PPA_QVDA ---
  ['reporte_entrevistas','01_Qué se midió','','','','','1388 reacciones','Instagram | TikTok','','','','','','','Press junket 3 jun (EFE Imagen N+ ADN40 Univisión) | Entrevistas banqueteras 3 jun (Televisa Venga El Junket El Gordo) | Creadores 8 jun (Christian Mart David Peralta Javibi BYMA Posta)'],
  ['reporte_entrevistas','02_Saldo del periodo','36','54','10','bajo','','','','','','','','','Vs. base habitual: +14 pts positivo | Duplica el positivo y reduce el negativo a menos de la mitad'],
  ['reporte_entrevistas','03_Los ejes','','','','','','','Talento/música 21% (59% pos) | Homenaje/legado 11% (54% pos) | México/orgullo 8% (72% pos)','Soberbia 4% (84% neg) | Oportunismo 2% (68% neg) | Hartazgo 1% (75% neg)','Familia/dinastía 11% mixto (37% pos / 14% neg)','','','',''],
  ['reporte_entrevistas','04_Las dos caras','','','','','','','El homenaje al padre | Talento y oficio | Orgullo mexicano | Resiliencia frente a la crítica','Percepción de soberbia | Sospecha de oportunismo | La familia como peso | Saturación | La sombra del padre','','','','',''],
  ['reporte_entrevistas','05_La entrevista como objeto','','','','','','','','','907 likes: rechazo a entrevistar a Pepe | 277 likes: sospecha cobertura pagada | Punto de fricción: «y no me llega» soundbite más negativo','','','','',''],
  ['reporte_entrevistas','06_Voces del público','','','','','','','«Tu voz es un referente de nuestra música regional» 145♥ | «Pepe Aguilar es México tradición y cultura» 81♥ | «Es una joya este álbum» 72♥','«Es bueno pero no se compara a su papá el gran Don Antonio» 930♥ | «Qué hueva con los Aguilar» 609♥ | «De esa dinastía ya no nos interesa» 562♥','','','','',''],
  ['reporte_entrevistas','07_Conclusión','','','','','','','','','','','','','«El homenaje abre crédito; el carácter lo gasta.» — PPA-ENTREV-QVDA'],
  // --- Actividades Mayo–Junio BW-26-MJUN-PA-ACT-001 ---
  ['actividades_mayo_junio','01_Entregables','','','','','','','','','','','','','Resumen reputación 6 meses | Boletín Billboard Indie Power Players | Plan estratégico Mayo–Agosto | Plan lanzamiento ¡Que Viva Don Antonio! | Comunicado cancelación Teatro Esperanza Iris | Media training previo a promoción (con Karla Iberia Sánchez) | Acompañamiento press junket QVAA | Acompañamiento creadores QVAA | Retroalimentación entrevistas 1:1 y banqueteras | Social Listenings x2 | Plan Pepe Aguilar Empresario'],
  ['actividades_mayo_junio','02_Hallazgo_01','','','','','','','Los canales propios funcionan como ancla narrativa','','','','','','Cuando Pepe comunica desde sus propios canales sobre música la audiencia responde positivo. El silencio alimentaba la cobertura adversa; romperlo con voz propia revierte la conversación.'],
  ['actividades_mayo_junio','02_Hallazgo_02','','','','','','','Pepe es leído como símbolo de identidad nacional','','','','','','El álbum deja ver que el público lo asocia con mexicanidad y tradiciones nacionales.'],
  ['actividades_mayo_junio','02_Hallazgo_03','','','','','','','Existe interés mediático genuino más allá de la crisis','','','','','','Hay interés real en trayectoria y legado de PPA: hay espacio mediático para hablar desde lo positivo.'],
  ['actividades_mayo_junio','02_Hallazgo_04','','','','','','','','La conversación adversa es ruido inflado','','','','','Parte significativa del negativo proviene de bots y perfiles falsos (varios en Malasia) y notas recicladas sin verificación.'],
  ['actividades_mayo_junio','02_Hallazgo_05','','','','','','','','El ruido adverso se sostiene por desinformación','','','','','Notas negativas se apagan y reaparecen recicladas semanas después. Clips con descripciones que no coinciden con el video alimentan el ruido sin sustento.'],
  ['actividades_mayo_junio','02_Hallazgo_06','','','','','','','Pepe Empresario es la palanca para ampliar lo positivo','','','','','','La narrativa empresarial amplía cobertura positiva hacia ecosistemas nuevos (tech emprendimiento cultura deporte) y blinda desde nuevos frentes.'],
  ['actividades_mayo_junio','03_SiguientePaso_01','','','','','','','Consolidar narrativa musical desde canales propios','','','','','','Ser dueños de la narrativa de Pepe con mensajes propios. Esto ya está revirtiendo la conversación adversa.'],
  ['actividades_mayo_junio','03_SiguientePaso_02','','','','','','','Activar Pepe Empresario formalmente','','','','','','Ejecutar Plan PPA Empresario para ampliar narrativa y posicionar mensajes positivos desde nuevos frentes.'],
  ['actividades_mayo_junio','03_SiguientePaso_03','','','','','','','Capitalizar el activo de mexicanidad','','','','','','Identificar y activar momentos de mayor exposición orgánica a temas nacionalistas; activo no explotado aún.'],
  ['actividades_mayo_junio','03_LecturaEstrategica','','','','','','','','','','','','','«El silencio era lo que alimentaba la conversación adversa. La voz propia ya empezó a revertirla. La fase que sigue es empujar lo positivo no defenderse de lo negativo.» — Blackwell Strategy BW-26-MJUN-PA-ACT-001'],
].map(r => r.map(esc).join(','));

export default function ExportModal({ onClose }) {
  const [allDates, setAllDates] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!window.SUPABASE_KEYS) return;
    // Extract unique date_keys from SUPABASE_KEYS ("theme:date")
    const dates = [...new Set([...window.SUPABASE_KEYS].map(k => k.split(':')[1]))].sort();
    setAllDates(dates);
    setSelected(new Set(dates));
  }, []);

  function toggle(dateKey) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(dateKey) ? next.delete(dateKey) : next.add(dateKey);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev => prev.size === allDates.length ? new Set() : new Set(allDates));
  }

  async function handleDownload() {
    if (!selected.size) return;
    setLoading(true);
    setStatus('Cargando datos…');
    try {
      const { data: reports, error } = await supabase
        .from('reports')
        .select(`
          id, date_key, theme_key, theme_label,
          sentiment(*), platforms(*), alert_posts(*), opportunity_posts(*),
          complaints(*), news_items(*), trending_topics(*),
          pros_cons(*)
        `)
        .in('date_key', [...selected])
        .order('date_key', { ascending: true })
        .order('theme_key', { ascending: true });

      if (error) throw error;

      setStatus('Generando CSV…');
      const rows = [CSV_HEADER, ...reports.map(buildRow), '', ...REPORTE_ROWS];
      const csv = '﻿' + rows.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateRange = [...selected].sort();
      a.download = `pepe_aguilar_${dateRange[0]}_a_${dateRange[dateRange.length - 1]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      onClose();
    } catch (e) {
      setStatus('Error al cargar datos. Intenta de nuevo.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const themesForDate = (dk) =>
    THEMES.filter(t => window.SUPABASE_KEYS?.has(`${t.key}:${dk}`)).map(t => t.label).join(', ');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(33,28,23,0.55)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#FAF7F0', border: '1.5px solid #211C17', borderRadius: 4,
          width: '100%', maxWidth: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(33,28,23,0.13)' }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: C.gold, fontWeight: 600, marginBottom: 4 }}>Exportar datos</div>
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 17, color: C.ink }}>
            Selecciona las fechas a descargar
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: '#6B6253', marginTop: 4 }}>
            {selected.size} de {allDates.length} fechas seleccionadas
          </div>
        </div>

        {/* Dates list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px', scrollbarWidth: 'none' }}>
          {/* Select all */}
          <button onClick={toggleAll}
            style={{ width: '100%', textAlign: 'left', fontFamily: MONO, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase', color: C.goldDeep,
              background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0 10px',
              borderBottom: '1px solid rgba(33,28,23,0.10)', marginBottom: 8 }}>
            {selected.size === allDates.length ? '☑ Deseleccionar todo' : '☐ Seleccionar todo'}
          </button>

          {allDates.map(dk => {
            const checked = selected.has(dk);
            return (
              <button key={dk} onClick={() => toggle(dk)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                  textAlign: 'left', background: checked ? 'rgba(176,130,47,0.07)' : 'transparent',
                  border: '1px solid ' + (checked ? 'rgba(176,130,47,0.3)' : 'rgba(33,28,23,0.10)'),
                  borderRadius: 3, padding: '9px 11px', marginBottom: 6, cursor: 'pointer',
                  transition: 'all 0.12s' }}>
                <span style={{ width: 14, height: 14, borderRadius: 2, flex: 'none', marginTop: 1,
                  border: '1.5px solid ' + (checked ? C.gold : '#A9997B'),
                  background: checked ? C.gold : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checked && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
                </span>
                <div>
                  <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 13, color: C.ink }}>
                    {fmtDate(dk)}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: '#6B6253', marginTop: 2,
                    letterSpacing: '0.04em' }}>
                    {themesForDate(dk)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px 18px', borderTop: '1px solid rgba(33,28,23,0.13)',
          display: 'flex', gap: 8, alignItems: 'center' }}>
          {status && (
            <span style={{ fontFamily: MONO, fontSize: 9.5, color: '#6B6253', flex: 1 }}>{status}</span>
          )}
          {!status && <div style={{ flex: 1 }} />}
          <button onClick={onClose}
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '9px 14px', borderRadius: 2,
              border: '1px solid rgba(33,28,23,0.25)', background: 'transparent',
              color: '#6B6253', cursor: 'pointer' }}>
            Cancelar
          </button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleDownload}
            disabled={loading || !selected.size}
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '9px 16px', borderRadius: 2,
              border: `1px solid ${C.ink}`, background: C.ink,
              color: '#FBF8F1', cursor: loading || !selected.size ? 'default' : 'pointer',
              opacity: !selected.size ? 0.45 : 1, transition: 'opacity 0.15s' }}>
            {loading ? 'Cargando…' : `Descargar CSV ↓`}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
