import { parseDailyCSV } from '../src/utils/csvParser.js';
import { readFileSync } from 'fs';

const files = [
  'C:/Users/Brand/Downloads/musica_pepe_aguilar_16-17jun.csv',
  'C:/Users/Brand/Downloads/familia_aguilar_16-17jun.csv',
  'C:/Users/Brand/Downloads/empresas_pepe_aguilar_16-17jun.csv',
];

for (const filepath of files) {
  const filename = filepath.split('/').pop();
  try {
    const text = readFileSync(filepath, 'utf8');
    const { dateKey, themeKey, themeData: t } = parseDailyCSV(text, filename);
    const s = t.sentiment || {};
    const r = t.risk || {};

    console.log('\n══════════════════════════════════════');
    console.log(`Archivo : ${filename}`);
    console.log(`Tema    : ${themeKey} (${t.label})`);
    console.log(`Fecha   : ${dateKey}`);
    console.log(`\n— SENTIMIENTO —`);
    console.log(`  Positivo : ${s.pos}%  (${s.posC} menciones)`);
    console.log(`  Neutral  : ${s.neu}%  (${s.neuC} menciones)`);
    console.log(`  Negativo : ${s.neg}%  (${s.negC} menciones)`);
    console.log(`  Riesgo   : ${r.level}`);
    console.log(`  Posts totales: ${t.totals?.posts || 0}`);

    console.log(`\n— PLATAFORMAS (${(t.platforms||[]).length}) —`);
    (t.platforms||[]).forEach(p => {
      console.log(`  ${p.name}: ${p.posts} posts | pos:${p.sent?.positivo||0}% neu:${p.sent?.neutral||0}% neg:${p.sent?.negativo||0}%`);
    });

    const al = t.alertometro || t.alerts || {};
    console.log(`\n— ALERTÓMETRO —`);
    console.log(`  Nivel: ${al.nivel || '—'} | Posts peligrosos: ${(al.posts||[]).length}`);

    const op = t.oportunometro || t.opps || {};
    console.log(`\n— OPORTUNÓMETRO —`);
    console.log(`  Nivel: ${op.nivel || '—'} | Posts oportunidad: ${(op.posts||[]).length}`);

    console.log(`\n— INFLUENCERS —`);
    console.log(`  Total: ${t.influencers?.total || 0} | Top: ${(t.influencers?.top||[]).length} listados`);
    (t.influencers?.top||[]).slice(0,3).forEach(i => console.log(`    @${i.username} (${i.platform}) ${i.followers} seguidores`));

    console.log(`\n— PROS/CONTRAS —`);
    console.log(`  A favor   : ${(t.pros_cons?.positive||[]).length} items`);
    console.log(`  En contra : ${(t.pros_cons?.negative||[]).length} items`);

    console.log(`\n— VOCES (segmentos) —`);
    console.log(`  Segmentos: ${(t.voices?.segmentos||[]).length}`);
    (t.voices?.segmentos||[]).forEach(v => console.log(`    [${v.sentimiento}] ${v.label}`));

    console.log(`\n— TRENDING —`);
    (t.trending||[]).slice(0,3).forEach(x => console.log(`  · ${x.titulo}`));

  } catch(e) {
    console.error(`\n✕ ${filename}: ${e.message}`);
  }
}
