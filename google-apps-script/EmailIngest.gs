/**
 * Blackwell Dashboard — Email Ingest
 *
 * Lee correos de emiliano@quienopina.mx con archivos CSV adjuntos
 * y los sube automáticamente al dashboard vía /api/ingest.
 *
 * SETUP:
 *  1. Ve a https://script.google.com → Nuevo proyecto
 *  2. Pega este código y guarda (Ctrl+S)
 *  3. Edita las constantes INGEST_URL e INGEST_SECRET abajo
 *  4. Clic en "Ejecutar" → "setup" para crear el trigger automático
 *  5. Autoriza los permisos de Gmail cuando te lo pida
 */

// ─── Configuración ────────────────────────────────────────────
const INGEST_URL    = 'https://dashboard-pp.vercel.app/api/ingest';  // ← URL de tu Vercel
const INGEST_SECRET = 'bw-ingest-secret-2026';                       // ← Debe coincidir con INGEST_SECRET en Vercel
const SENDER_EMAIL  = 'emiliano@quienopina.mx';
const PROCESSED_LABEL = 'bw-procesado';   // Se crea automáticamente si no existe
// ──────────────────────────────────────────────────────────────

/** Crea el trigger horario. Ejecuta esta función UNA VEZ para activar la automatización. */
function setup() {
  // Eliminar triggers existentes para evitar duplicados
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'checkAndIngest') ScriptApp.deleteTrigger(t);
  });

  // Crear trigger cada hora
  ScriptApp.newTrigger('checkAndIngest')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('✅ Trigger creado: checkAndIngest se ejecutará cada hora.');
  Logger.log('Puedes cambiar la frecuencia aquí: Editar → Triggers del proyecto actual');
}

/** Función principal: busca correos nuevos y sube los CSVs */
function checkAndIngest() {
  const label = getOrCreateLabel(PROCESSED_LABEL);

  // Buscar correos del remitente fijo que NO tengan la etiqueta "procesado"
  const query = `from:${SENDER_EMAIL} has:attachment -label:${PROCESSED_LABEL}`;
  const threads = GmailApp.search(query, 0, 20);

  if (threads.length === 0) {
    Logger.log('Sin correos nuevos de ' + SENDER_EMAIL);
    return;
  }

  Logger.log(`Encontrados ${threads.length} correo(s) sin procesar.`);

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(msg => {
      const attachments = msg.getAttachments();
      let uploaded = 0;

      attachments.forEach(att => {
        const filename = att.getName();
        // Solo procesar archivos CSV
        if (!filename.toLowerCase().endsWith('.csv')) return;

        try {
          let csvContent = att.getDataAsString('UTF-8');

          // Limpiar columna pesada e inutilizada "all_platforms_data" para evitar superar el límite de Vercel (4.5MB)
          try {
            const parsedCsv = Utilities.parseCsv(csvContent);
            if (parsedCsv.length >= 2) {
              const headers = parsedCsv[0];
              const targetIdx = headers.indexOf('all_platforms_data');
              if (targetIdx !== -1) {
                for (let r = 1; r < parsedCsv.length; r++) {
                  parsedCsv[r][targetIdx] = '{}';
                }
                csvContent = parsedCsv.map(row => 
                  row.map(cell => '"' + cell.replace(/"/g, '""') + '"').join(',')
                ).join('\n');
                Logger.log(`🧹 Removido all_platforms_data de ${filename} para reducir tamaño.`);
              }
            }
          } catch (csvErr) {
            Logger.log(`⚠ No se pudo limpiar CSV: ${csvErr.message}. Enviando original.`);
          }

          const result = postToIngest(filename, csvContent);

          if (result.ok) {
            Logger.log(`✅ ${filename} → ${result.themeKey} ${result.dateKey}`);
            uploaded++;
          } else {
            Logger.log(`❌ Error en ${filename}: ${result.error}`);
          }
        } catch (e) {
          Logger.log(`❌ Excepción procesando ${filename}: ${e.message}`);
        }
      });

      // Marcar el hilo como procesado si subimos al menos 1 archivo
      if (uploaded > 0) {
        thread.addLabel(label);
        Logger.log(`Hilo marcado como procesado (${uploaded} CSV${uploaded > 1 ? 's' : ''} subidos)`);
      }
    });
  });
}

/** Llama al endpoint /api/ingest con el CSV */
function postToIngest(filename, csvContent) {
  const payload = JSON.stringify({
    secret: INGEST_SECRET,
    filename: filename,
    csv: csvContent
  });

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true,
    timeout: 60,
  };

  try {
    const response = UrlFetchApp.fetch(INGEST_URL, options);
    const code = response.getResponseCode();
    const body = response.getContentText();

    if (code === 200) {
      return JSON.parse(body);
    } else {
      Logger.log(`HTTP ${code}: ${body}`);
      return { ok: false, error: `HTTP ${code}: ${body}` };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Obtiene o crea una etiqueta de Gmail */
function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
    Logger.log(`Etiqueta creada: "${name}"`);
  }
  return label;
}

/** Prueba manual: llama a esta función para probar sin esperar el trigger */
function testNow() {
  checkAndIngest();
}
