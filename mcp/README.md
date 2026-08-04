# MCP · Social Listening Pepe Aguilar

Servidor MCP de **solo lectura** sobre la base de Supabase: publicaciones scrapeadas con
Apify, sus comentarios, los análisis diarios de IA y el mapa de voces aliadas/contrarias.
Conectado a Claude, permite preguntar por los datos en lenguaje natural.

## Herramientas

| Herramienta | Para qué sirve | Cliente | Interno |
|---|---|:--:|:--:|
| `listar_analisis` | Qué días tienen análisis y de qué redes | ✅ | ✅ |
| `obtener_analisis` | Sentimiento, riesgo, alertas y plan de acción de un día | ✅ | ✅ |
| `buscar_publicaciones` | Publicaciones capturadas con su alcance y URL | ✅ | ✅ |
| `buscar_comentarios` | Comentarios de la gente, ordenados por likes | ✅ | ✅ |
| `metricas_por_red` | Volumen y alcance agregados por red | ✅ | ✅ |
| `rendimiento_publicaciones_propias` | Cómo rindió el contenido de Pepe vs su promedio — base para recomendar qué publicar | ✅ | ✅ |
| `voces` | Aliados, contrarios y neutrales con su alcance | ✅ | ✅ |
| `evolucion_sentimiento` | Serie temporal de sentimiento y riesgo | ✅ | ✅ |
| `mensajes_clave` | Catálogo de la estrategia: mensaje maestro, los tres pilares y el pivote de cada tema reactivo | ✅ | ✅ |
| `sesiones_asistente` | Conversaciones del cliente con el asistente de voz (con transcripción) | ❌ | ✅ |
| `consultar_tabla` | Consulta directa de cualquier tabla, para cortes que las demás no cubren | ❌ | ✅ |

En la vista interna, `obtener_analisis` añade además el estado de aprobación y el
**fundamento interno** del análisis (por qué se concluyó eso, citando el documento de
mensajes maestros).

Nunca escribe en la base y solo reporta métricas con dato (una métrica ausente significa
que esa red no la expone, no que sea cero).

## Cómo se cuidan los números

La base guarda una captura nueva cada día que una pieza sigue viva, así que la misma
publicación aparece muchas veces (en X llegaba a 11 copias) y Facebook además reescribe el
`pfbid` de la URL entre sesiones, con lo que un mismo post llega con dos URLs distintas. Por
eso todas las herramientas **deduplican por texto normalizado** y no solo por URL, y se
quedan con la captura de mayor engagement.

Tres reglas más, todas para no publicar una cifra que no se sostiene:

- **Likes incoherentes se descartan.** Un post con cientos de miles de likes pero 124
  respuestas y 89 retweets no existe: es una lectura errónea del scraper. Si los likes no
  llegan ni a 1 interacción por cada 1000, no se reportan (la vista interna sí los ve, con
  el motivo). Sin esto, "¿en qué red tengo más engagement?" contestaba X, donde en realidad
  casi no hay actividad.
- **Las views solo se suman si las trae la mayoría** de las piezas de esa red. Sumar las de
  una de cada tres da un total que no representa nada.
- **El sentimiento global nunca viaja solo.** Incluye las cuentas propias de Pepe, favorables
  casi por definición, así que se acompaña del desglose por red y de un `terceros` calculado
  sin ellas: puede salir 75% favorable el mismo día que la prensa va 60% crítica.

`comentarios_en_publicaciones` es el contador público de cada pieza, no los comentarios
extraídos uno por uno: para leer lo que dice la gente se usa `buscar_comentarios`.

Los parámetros se validan antes de tocar la base: una fecha con diagonales, un "ayer", un
rango invertido o un texto con símbolos reciben una instrucción clara. Antes ese error subía
crudo desde PostgREST **con la URL completa de la base dentro** —proyecto, tabla, columnas y
filtros—, y esa URL terminaba en la respuesta al usuario.

## Cómo se comporta cada vista

**Cliente** — actúa como asesor de reputación: ante una decisión ("¿qué publico mañana?")
primero consulta qué funcionó, luego recomienda y justifica con la cifra y su fuente. Tiene
prohibido mencionar huecos de datos, límites de cobertura, dónde están alojados los datos,
proveedores, modelos o tablas; si algo no está, trabaja con lo que hay sin señalar la falta.

**Interno** — habla sin filtros con el equipo: señala huecos de cobertura, métricas que una
red no reporta, límites de muestra y la diferencia entre lo aprobado y el borrador.

## Dos capas de saneamiento para el cliente (no solo instrucciones)

Las instrucciones de arriba le piden tono al modelo que atiende al cliente (claude.ai), pero
un modelo puede ignorar una instrucción — no es una garantía. Por eso lo que no debe verse se
filtra **antes** de que el análisis salga del servidor, en dos pasadas sobre `obtener_analisis`:

1. **Regex** (`_sanear`, siempre activo): quita las frases ya conocidas de fuga —la "falla de
   indexación" inventada de YouTube fue el caso real que lo originó.
2. **LLM** (`_sanear_llm`, opcional): manda el análisis completo a un modelo barato con la
   instrucción de reescribir o quitar cualquier prosa que revele infraestructura (tablas,
   proveedores, tokens, modelos, estado de borrador, huecos de cobertura), **sin tocar ningún
   número, fecha o URL**. Antes de aceptar su respuesta, el servidor compara todos los valores
   numéricos del original contra el filtrado; si el LLM alteró uno solo, se descarta y se usa
   el resultado del regex. Si la llamada falla, tarda de más, o no hay `OPENROUTER_API_KEY`
   configurada, se degrada al regex sin romper la respuesta — nunca bloquea ni corrompe nada.

Por qué solo aquí y no en todas las herramientas: `obtener_analisis` es prosa generada por
IA, el único lugar donde puede aparecer una fuga con una redacción nueva que el regex no
anticipó. Las demás herramientas devuelven datos crudos (texto de posts, citas de
comentaristas reales) — dejar que un LLM los "reescriba" arriesgaría alterar lo que alguien
realmente dijo, que es peor que el problema que se quiere resolver.

Para activarlo: variable `OPENROUTER_API_KEY` en el servicio de Railway del MCP (el mismo
proveedor que ya usa el pipeline de análisis). Opcional `OPENROUTER_MODEL_SANEAMIENTO`
(default `google/gemini-2.5-flash-lite`). Sin la variable, el servidor sigue funcionando
exactamente como antes, solo con el regex.

## Desplegar en Railway

Como el repo ya tiene un servicio Node, este va **como servicio aparte**:

1. Railway → **New Service** → *GitHub Repo* → este repo.
2. En **Settings → Root Directory** pon `mcp`.
3. Genera un dominio público (**Settings → Networking → Generate Domain**) y cópialo.
4. Define las variables (ver abajo) y redespliega.

El endpoint queda en `https://TU-DOMINIO/mcp`.

## Audiencia: cara al cliente vs. interna

| `MCP_AUDIENCE` | Qué ve |
|---|---|
| *(sin definir)* o `cliente` | **Default.** Solo análisis aprobados. Sin sesiones del asistente de voz, sin estado de aprobación. Las instrucciones le piden a Claude no mencionar material interno ni infraestructura. |
| `interno` | Todo: incluye borradores sin aprobar, el campo `aprobado` y la herramienta `preguntas_al_asistente`. |

La protección está en el **servidor**, no en el prompt: lo que no debe verse no sale de la
base. Las instrucciones ayudan al tono, pero un modelo puede ignorarlas — filtrar los datos
es lo único que garantiza que no se filtren.

Si quieres las dos vistas a la vez, crea **dos servicios** en Railway apuntando al mismo
repo y root directory, uno con `MCP_AUDIENCE=interno` (y su propia URL secreta).

## Variables de entorno

Elige **uno** de los tres modos de acceso. Si defines varios, gana el de más arriba
(OAuth → ruta secreta → token).

### Opción rápida para claude.ai — ruta secreta, sin OAuth

claude.ai solo arranca el flujo OAuth cuando el servidor responde **401**. Si en cambio el
secreto viaja en la propia ruta, el servidor responde 200 en la URL correcta y **404** en
cualquier otra: nunca hay 401, así que nunca hay OAuth.

| Variable | Valor |
|---|---|
| `MCP_URL_TOKEN` | cadena secreta de 24+ caracteres aleatorios |

El endpoint queda en `https://TU-DOMINIO/mcp/EL_TOKEN` — pega **esa** URL completa en
claude.ai (Configuración → Conectores → Añadir conector personalizado). No pide login.

Trade-off honesto: **la URL completa es la credencial** (patrón "capability URL", el mismo
de un enlace de "cualquiera con el link"). No hay identidad por usuario, así que no sabrás
quién consultó, y compartir la URL es dar acceso. Si se filtra, cambia `MCP_URL_TOKEN` en
Railway y las URLs viejas empiezan a dar 404. En este modo se apagan los access logs para
que el token no quede escrito en los registros de la plataforma.

### Para conectar desde claude.ai (web) — con OAuth
claude.ai solo acepta conectores con OAuth 2.1 y registro dinámico de cliente, así que se
usa una OAuth App de GitHub como identidad:

1. GitHub → *Settings → Developer settings → OAuth Apps → New OAuth App*
   - **Homepage URL**: `https://TU-DOMINIO`
   - **Authorization callback URL**: `https://TU-DOMINIO/auth/callback`
2. En Railway:

| Variable | Valor |
|---|---|
| `GITHUB_CLIENT_ID` | el Client ID de la OAuth App |
| `GITHUB_CLIENT_SECRET` | el Client Secret |
| `PUBLIC_URL` | `https://TU-DOMINIO` (sin barra final) |
| `GITHUB_ALLOWED_USERS` | tu usuario de GitHub, p. ej. `BrandonBlackwell-ui` |

`GITHUB_ALLOWED_USERS` es importante: autenticarse con GitHub solo prueba que la cuenta
existe, no que sea tuya. Sin esa lista, cualquier cuenta de GitHub podría leer la base.

Luego en claude.ai: **Configuración → Conectores → Añadir conector personalizado**, pega
`https://TU-DOMINIO/mcp` y autoriza con GitHub.

### Para Claude Code / Desktop — basta un token
Estos clientes aceptan un bearer estático, sin OAuth:

| Variable | Valor |
|---|---|
| `MCP_TOKEN` | una cadena secreta larga (mínimo ~32 caracteres aleatorios) |

```bash
claude mcp add --transport http social-listening https://TU-DOMINIO/mcp \
  --header "Authorization: Bearer TU_MCP_TOKEN"
```

### Opcionales
| Variable | Default |
|---|---|
| `SUPABASE_URL` | el proyecto actual |
| `SUPABASE_KEY` | la anon key del proyecto |
| `PORT` | lo asigna Railway |

Si no defines ni OAuth ni `MCP_TOKEN`, el servidor **no arranca** a propósito: es preferible
un fallo visible en los logs a dejar la base accesible sin autenticación.

## Correr en local

```bash
pip install -r requirements.txt
MCP_TOKEN=una-cadena-larga PORT=8080 python server.py
```
