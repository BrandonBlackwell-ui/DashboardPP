# Reglas Apify para escucha social de Pepe Aguilar

Documento de referencia local para no perder el criterio de scraping, fechas, engagement y parseo del dashboard.

No guardar API keys ni tokens en este archivo.

## Objetivo

El dashboard debe alimentarse con datos reales extraidos de Apify, sin datos inventados ni ejemplos manuales mezclados con produccion.

Flujo correcto:

1. Ejecutar actores por red social con ventana de fecha exacta.
2. Guardar la respuesta cruda de Apify.
3. Normalizar campos comunes para el dashboard.
4. Validar enlaces.
5. Aplicar filtros de relevancia y calidad.
6. Ejecutar clasificacion de IA despues del scraping, no antes.

## Regla principal de fechas

Todos los actores usados para el boton `Analizar` deben aceptar rango exacto de fechas.

No usar actores que solo aceptan valores relativos como `yesterday`, `last 7 days`, `this week` o similares para el flujo diario principal.

Para X, si se quiere analizar el dia `2026-06-26`, usar:

```json
{
  "minDate": "2026-06-26",
  "maxDate": "2026-06-27"
}
```

La fecha final se maneja como limite superior del rango. Para un solo dia, `maxDate` debe ser el dia siguiente.

## Actor recomendado para X

Actor:

```text
igolaizola/x-twitter-scraper-ppe
```

Uso:

```json
{
  "query": "\"Pepe Aguilar\"",
  "maxItems": 100,
  "minDate": "2026-06-26",
  "maxDate": "2026-06-27",
  "replies": "exclude",
  "retweets": "exclude",
  "quotes": "exclude"
}
```

Resultado de prueba:

- La prueba se hizo con `maxItems: 10`.
- Trajo 6 publicaciones de X.
- No trajo respuestas.
- No trajo retweets.
- No trajo quotes.
- Incluyo enlaces directos `permalink` confiables.
- Incluyo metricas como `comments`, `retweets`, `quotes`, `likes`.
- No incluyo vistas en la prueba.

Decision:

Usar este actor como actor principal de X para descubrimiento diario.

Configuracion de produccion:

- Iniciar con `maxItems: 100`.
- No bajar de 100 para el boton `Analizar`.
- No correr pruebas grandes sin confirmar costo.

Regla de escalamiento automatico:

- Si se pide `maxItems: 100` y Apify devuelve menos de 100 items, asumir que probablemente se obtuvo todo lo disponible para ese rango y filtros.
- Si se pide `maxItems: 100` y Apify devuelve exactamente 100 items, asumir que el resultado pudo estar cortado por limite.
- En ese caso, correr otra busqueda con un limite mayor, por ejemplo `maxItems: 250`.
- Si devuelve exactamente 250, subir a `500`.
- Repetir hasta que el total devuelto sea menor al limite pedido o hasta llegar al presupuesto maximo configurado.
- Guardar cada corrida en `apify_runs` con `maxItems`, `item_count`, `cost_usd` y `dataset_id`.

Pseudologica:

```text
limit = 100
max_limit = 1000

run_actor(limit)

while item_count == limit and limit < max_limit and budget_ok:
  limit = next_limit(limit)
  run_actor(limit)

usar la corrida mas completa
```

Escalones sugeridos:

```text
100 -> 250 -> 500 -> 1000
```

## Actor anterior de X

Actor:

```text
api-ninja/x-twitter-advanced-search
```

Prueba:

```text
"Pepe Aguilar" since:2026-06-26 until:2026-06-27
```

Resultado:

- Trajo resultados relevantes.
- Tambien trajo respuestas.
- Algunos enlaces eran confusos o llevaban a paginas no encontradas porque correspondian a respuestas o estaban mal normalizados.

Decision:

No usar como principal. Solo usar como fallback si el actor recomendado falla y se puede filtrar replies correctamente.

## Reglas para X

Configuracion obligatoria:

```json
{
  "replies": "exclude",
  "retweets": "exclude",
  "quotes": "exclude"
}
```

Campos a guardar si existen:

- `id`
- `url` o `permalink`
- `text`
- `author handle`
- `author name`
- `created_at`
- `comments`
- `retweets`
- `quotes`
- `likes`
- `views`
- `links`
- `media`
- `raw_json`

Regla de parseo:

- `views` o visualizaciones se guarda y se muestra como vistas, no como likes.
- `likes` debe coincidir con el contador del corazon en X.
- `retweets` debe coincidir con reposts/RT.
- `quotes` solo se muestra si Apify trae un campo real de quotes. No usar el campo de likes como quotes.
- Las metricas de X cambian con el tiempo; puede haber diferencias pequenas entre el scrape y lo que se ve despues en X.

Regla de engagement:

El actor recomendado no mostro un filtro directo por minimo de vistas, likes o retweets. Por ahora el filtrado debe hacerse despues de traer los datos.

Orden de relevancia:

- Si en el futuro el actor ofrece un parametro real de orden tipo `sort=top`, `sort=relevance`, `minLikes`, `minViews` o `minRetweets`, usarlo antes de subir `maxItems`.
- En el schema revisado no se confirmo un filtro nativo por engagement.
- No asumir que los primeros resultados de Apify son los mas relevantes. Pueden venir por fecha, busqueda interna de X o criterio del actor.
- Para evitar traer demasiado ruido, mantener filtros nativos de calidad: excluir replies, retweets y quotes.
- Despues de recibir resultados, ordenar localmente por score de engagement.
- Mostrar primero los posts con mas interaccion, pero conservar posts chicos si tienen riesgo o critica cuando exista clasificacion IA.

Score local sugerido:

```text
score = likes + (retweets * 3) + (quotes * 2) + (comments * 2)
```

Si se quiere mostrar solo publicaciones fuertes, usar un filtro posterior como:

```text
likes >= 50 OR retweets >= 5 OR quotes >= 10 OR comments >= 5
```

Importante: no eliminar automaticamente publicaciones chicas si son negativas o de riesgo, porque pueden ser senales tempranas.

## Google News

Actor anterior:

```text
crawlerbros/google-news-scraper
```

Ventajas:

- Acepta `dateFrom` y `dateTo`.
- Trae notas con titulo, fuente y URL.

Problema:

- La prueba fue cara comparada con redes sociales.
- Una corrida con pocos resultados costo alrededor de 2 USD.

Decision:

Funciona, pero es demasiado caro para automatizar diario si hay una alternativa viable.

Actor barato probado:

```text
easyapi/google-news-scraper
```

Input usado en prueba:

```json
{
  "maxItems": 100,
  "query": "\"Pepe Aguilar\" after:2026-06-26 before:2026-06-27"
}
```

Resultado de prueba:

- Corrida exitosa.
- Dataset: 100 items.
- Costo confirmado: 0.68 USD.
- Campos utiles: `title`, `link`, `domain`, `source`, `date`, `date_utc`, `snippet`.
- Trajo notas relevantes, pero tambien mucho ruido.
- El actor obliga o recomienda `maxItems` minimo 100, por eso no fue tan barato como una prueba de 5 o 10 items.
- No se confirmo soporte nativo de `dateFrom`/`dateTo`.
- La fecha exacta se metio en el `query` usando operadores `after:` y `before:`.

Decision provisional:

No usar `easyapi/google-news-scraper` como primera opcion. Cuesta menos que `crawlerbros`, pero trae demasiado ruido y obliga/recomienda `maxItems` minimo 100.

Actor fino recomendado:

```text
sourabhbgp/google-news-scraper
```

Input usado en prueba:

```json
{
  "urls": ["\"Pepe Aguilar\""],
  "mode": "search",
  "maxResults": 10,
  "dateFrom": "2026-06-26",
  "dateTo": "2026-06-26",
  "language": "es",
  "country": "MX",
  "includeFullText": false,
  "fullCoverage": false
}
```

Resultado de prueba:

- Corrida exitosa.
- Dataset: 10 items.
- Costo confirmado: 0.01 USD.
- Campos utiles: `title`, `articleUrl`, `googleUrl`, `source`, `sourceDomain`, `author`, `imageUrl`, `publishedAt`, `query`.
- Tiene fecha exacta nativa: `dateFrom` / `dateTo`.
- Trae links reales de medios, no solo redirects de Google.
- Aun asi puede traer resultados con `publishedAt` del dia anterior dentro de la busqueda, por lo que se debe filtrar localmente por fecha exacta.

Decision:

Usar `sourabhbgp/google-news-scraper` como actor principal de Google News.

Configuracion de prueba:

- Usar `maxResults: 10`.
- Usar `maxTotalChargeUsd: 0.10`.
- No activar `includeFullText` en pruebas.
- No activar `fullCoverage` en pruebas.

Configuracion de produccion inicial:

- Empezar con `maxResults: 50` o `100`, segun presupuesto.
- Mantener `includeFullText: false` al inicio.
- Post-filtrar por `publishedAt` dentro del rango exacto.
- Post-filtrar relevancia con entidades: Pepe, Aguilar, Angela, Leonardo, Emiliano, Antonio, Aneliz.

Este actor cumple mejor:

- fecha exacta nativa `dateFrom` / `dateTo`
- menor ruido que `easyapi`
- costo bajo
- links reales de articulos

Reglas:

- Usar fechas exactas si el actor las soporta de forma nativa.
- Si el actor no tiene fechas nativas, usar operadores en query: `after:YYYY-MM-DD before:YYYY-MM-DD`.
- Guardar notas crudas.
- Filtrar relevancia despues, porque puede traer notas que mencionan otros temas o artistas.
- No mostrar notas sin URL verificable como si fueran enlaces seguros.
- Excluir resultados de dominios sociales si el objetivo de la tarjeta es solo prensa/noticias.
- Excluir resultados irrelevantes aunque vengan en Google News, por ejemplo Beatles, Dragon Ball, deportes no relacionados o notas sin mencion directa a Pepe/Aguilar/Angela/Leonardo/Emiliano/Antonio.
- Para reportes diarios, descartar cualquier item cuyo `publishedAt` no caiga dentro de `date_from` y `date_to`.

## Facebook

Actor probado:

```text
igview-owner/facebook-old-posts-search
```

Input usado en prueba:

```json
{
  "query": "\"Pepe Aguilar\"",
  "startDate": "2026-06-26",
  "endDate": "2026-06-26",
  "maxResults": 10
}
```

Resultado de prueba:

- Corrida exitosa.
- Costo confirmado: 0.075 USD.
- Dataset: 11 items.
- Despues de post-filtrar por fecha exacta `2026-06-26`, quedaron 9 posts.
- Trae links reales de Facebook.
- Trae fecha ISO en `date`.
- Trae texto en `message`.
- Trae autor en `author.name` y `author.url`.
- Trae engagement fuerte:
  - `reactions_count`
  - `comments_count`
  - `reshare_count`
  - desglose de reacciones: `like`, `love`, `haha`, `wow`, `sad`, `angry`, `care`
- Puede traer resultados del borde del dia anterior aunque se use `startDate` / `endDate`.

Decision:

Usar como actor principal de Facebook para descubrimiento diario, con post-filtro local obligatorio por fecha.

Configuracion de prueba:

- `maxResults: 10`
- `maxTotalChargeUsd: 0.08`

Configuracion de produccion inicial:

- Empezar con `maxResults: 100`.
- Si devuelve exactamente 100, subir a 250, despues 500, respetando presupuesto.
- Mantener `startDate` y `endDate` exactos.
- Post-filtrar por `date` dentro de la ventana exacta.
- Post-filtrar relevancia por entidades: Pepe, Aguilar, Angela, Leonardo, Emiliano, Antonio, Aneliz.

Reglas:

- Mostrar `reactions_count` como reacciones, no como likes.
- Guardar el desglose de reacciones porque `haha`, `angry` y `sad` ayudan a detectar burla/riesgo.
- No inferir sentimiento solo por reacciones; eso lo debe hacer IA despues.
- No mostrar followers si el actor no los trae.
- Guardar `author.url` para futuras listas de aliados o fuentes repetidas.

## Instagram

Actores revisados:

```text
crawlerbros/instagram-keyword-search-scraper
```

Resultado:

- Es un actor de keyword search.
- Trae `pub_date`, `caption`, `post_url`, `like_count`, `comment_count`, media y perfil.
- Requiere cookies de Instagram.
- Rating revisado despues: 2.4 con 13 reviews.
- Estadisticas revisadas: 25K corridas totales, 1.3K usuarios, 14.8K exitosas en 30 dias.
- No muestra rango exacto `from/to` como parametro principal.
- Input confirmado por ficha:
  - `keywords`: array de keywords.
  - `maxPosts`: limite por keyword, 1 a 500.
  - `cookies`: string JSON de cookies.
  - `sessionName`: nombre de sesion.
- Precio visible: desde 3.00 USD por 1,000 resultados, con arranque de actor de 0.05 USD.

Decision:

Es mejor candidato que `crawlerbros/instagram-keyword-scraper` por uso/reseñas. Aun requiere cookies y no cumple fecha exacta nativa, asi que debe post-filtrarse por `pub_date`.

Prueba con cookie de sesion:

- Se creo cookie local temporal en JSON con solo `sessionid`.
- Primer archivo tuvo BOM UTF-8 de Windows; el actor fallo al parsearlo con: `Unexpected UTF-8 BOM`.
- Se corrigio el archivo de cookie para escribir UTF-8 sin BOM.
- Run de prueba: `qokfhDO42sQayDvP4`.
- Resultado: abortado por limite de costo `0.10 USD` antes de traer items.
- Dataset: vacio.
- Costo de prueba: `0.10329693200915059 USD`.
- Logs muestran que el actor alcanzo a iniciar navegador y navegar a `https://www.instagram.com/explore/search/keyword/?q=Pepe+Aguilar`, pero fue abortado antes de extraer.

Siguiente prueba recomendada:

- Rerun con cookie corregida sin BOM.
- `maxPosts: 1` o `maxPosts: 3`.
- `maxTotalChargeUsd: 0.20` a `0.25`, porque 0.10 no alcanza ni para completar arranque/busqueda.
- Revisar si usa nuestra cookie y si devuelve `pub_date`/`post_url`.

Segunda prueba:

- Run: `5FMSxiRJsUiflYVmk`.
- Input: `keywords: ["Pepe Aguilar"]`, `maxPosts: 1`, `maxTotalChargeUsd: 0.25`.
- Estado: `SUCCEEDED`.
- Costo: `0.20695518703334861 USD`.
- Dataset: 1 item.
- Resultado:
  - `username`: `glamourmexico`
  - `full_name`: `Glamour Mexico y Latinoamerica`
  - `post_url`: `https://www.instagram.com/p/DV9bwnxDwzb/`
  - `pub_date`: `2026-03-16T21:11:17.000Z`
  - `media_type`: `Reel`
  - `like_count`: `10784`
  - `comment_count`: `1119`
  - `caption`: publicacion de Glamour Mexico sobre Pepe Aguilar en Houston Livestock Show and Rodeo.
- Logs:
  - encontro 24 posts en la pagina de busqueda.
  - extrajo 1 post.
  - importante: el actor todavia no acepto la cookie enviada y cayo a una cookie interna del actor (`Could not parse cookies from input, falling back to MongoDB`).

Conclusion de la prueba:

- El actor funciona para descubrimiento por keyword y devuelve posts reales con link, fecha y metricas.
- No sirve por si solo para reporte diario exacto porque devolvio un post de marzo 2026 al buscar el 29 de junio 2026.
- Se debe post-filtrar por `pub_date`.
- Para uso diario, con `maxPosts: 1` no alcanza porque Instagram puede ordenar por relevancia historica; hay que pedir mas resultados y filtrar por fecha, lo cual sube costo.
- Falta resolver por que no acepta nuestra cookie o decidir usar la cookie interna del actor si se mantiene estable.

Tercera prueba:

- Run: `lorwrMMwvpld85nNQ`.
- Input: `keywords: ["Pepe Aguilar"]`, `maxPosts: 10`, `maxTotalChargeUsd: 0.30`.
- Estado: `SUCCEEDED`.
- Costo: `0.25382541271824804 USD`.
- Dataset: 10 items.
- Fechas devueltas:
  - `2026-06-27`: 2 posts.
  - `2026-06-21`: 1 post.
  - `2026-04-19`: 1 post.
  - `2026-03-31`: 1 post.
  - `2026-03-22`: 1 post.
  - `2026-03-16`: 1 post.
  - `2026-02-14`: 1 post.
  - `2026-01-24`: 1 post.
  - `2025-04-07`: 1 post.
- Posts del `2026-06-29`: 0.
- Posts recientes utiles:
  - `conciertoscolombia.oficial`, `2026-06-27`, Reel, `17443` likes, `3600` comments, link `https://www.instagram.com/p/DaFM2HbhKvV/`.
  - `juanjoguerrero`, `2026-06-27`, Reel, `2050` likes, `144` comments, link `https://www.instagram.com/p/DaFPptxy0bB/`.

Conclusion despues de 10 resultados:

- El actor no trae resultados ordenados por fecha.
- Para un reporte diario exacto, pedir 10 no basta si la busqueda prioriza relevancia historica.
- Subir a 25 o 50 podria encontrar posts del dia, pero el costo probablemente sube poco por item y mas por tiempo de enriquecimiento; probar con `maxPosts: 25` solo si Instagram es indispensable.
- Alternativa mas barata para diario: usar este actor como descubrimiento semanal y para diario combinar `instagram-profile-scraper-api` sobre cuentas/aliados conocidos.

```text
crawlerbros/instagram-keyword-scraper
```

Resultado de ficha:

- Este si es el actor mas cercano a lo pedido: buscar Instagram por `query`/keyword y devolver publicaciones.
- Input principal:
  - `keywords`: array de palabras/frases.
  - `maxPosts`: limite por keyword, de 1 a 500.
  - `cookies`: cookies de sesion de Instagram en JSON.
  - `sessionName`: nombre para reutilizar sesion.
- Output prometido:
  - `username`
  - `full_name`
  - `profile_url`
  - `post_url`
  - `pub_date`
  - `caption`
  - `mentions`
  - `hashtags`
  - `media_urls`
  - `thumbnail_url`
  - `media_type`
  - `like_count`
  - `comment_count`
  - `location`
  - `music`
  - `search_keyword`
  - `status`
- Precio visible: desde 3.00 USD por 1,000 resultados.
- Rating visible: 0 reviews.
- Estadisticas revisadas: 93 exitosos, 12 abortados, 4 timeouts en 30 dias.
- Requiere cookies porque Instagram no deja acceder bien a keyword search sin sesion.

Decision:

Candidato principal para busqueda abierta de Instagram por query, pero solo si conseguimos cookies de una cuenta dedicada de Instagram. No correr sin cookies. No usar la cuenta personal/principal del cliente.

Input tentativo:

```json
{
  "keywords": ["Pepe Aguilar", "\"Pepe Aguilar\"", "pepeaguilar"],
  "maxPosts": 20,
  "cookies": "[...]",
  "sessionName": "pepe_daily_monitor"
}
```

Reglas:

- Post-filtrar localmente `pub_date` por `date_from/date_to`, porque la ficha no muestra filtro exacto de fecha.
- Marcar `url_status: unknown` hasta validar `post_url`.
- Si `status` es `No posts found`, registrar el run como exitoso con 0 items reales.
- Usarlo con `maxPosts` bajo al inicio y subir solo si devuelve exactamente el limite.

```text
benthepythondev/instagram-intelligence-scraper
```

Resultado de ficha:

- Acepta `mode: "search"` y `searchQuery`.
- Precio visible: desde 2.50 USD por 1,000 resultados.
- Rating visible: 0 reviews.
- Puede usar modo browser sin login; tambien acepta `sessionCookie` o login opcional para mejorar acceso.
- Importante: el output documentado para `search` dice que devuelve resultados tipo `profile` o `hashtag`, con `text` y `url`; no queda claro que devuelva posts reales por query.

Decision:

Usarlo como candidato secundario para descubrir perfiles/hashtags por query, no como fuente principal de publicaciones hasta probarlo.

```text
patient_discovery/instagram-search-reels
```

Input usado en prueba:

```json
{
  "query": "Pepe Aguilar",
  "maxPages": 1
}
```

Resultado de prueba:

- Corrida exitosa.
- Costo confirmado: 0.03404 USD.
- Trajo 10 reels.
- Campos utiles: `code`, `taken_at_date`, `user.username`, `user.full_name`, `caption.text`, `ig_play_count`, `like_count`, `comment_count`, `share_count`.
- Trajo links directos construibles con `https://www.instagram.com/reel/{code}/`.
- No trajo ningun item dentro de `2026-06-26`.
- Los resultados fueron historicos, principalmente 2025 y marzo 2026.
- No se confirmo filtro exacto `from/to`.

Decision:

No cargar al dashboard diario si no hay items dentro de la fecha exacta. Usarlo solo como fallback exploratorio para reels historicos o investigacion de contenido evergreen.

Prueba adicional para `2026-06-29`:

- Corrida repetida con `query: "Pepe Aguilar"` y `maxPages: 1`.
- Volvio a traer reels historicos/relevantes, no contenido del dia.
- Aparecieron items de 2025, marzo 2026 y un item cercano de `2026-06-25`, pero ninguno de `2026-06-29`.
- Conclusion: si Instagram aparece vacio, no se puede asumir que no hubo contenido; con este actor tambien puede ser falla de descubrimiento diario.

```text
fabri-lab/instagram-hashtag-scraper-cheap-and-fast
```

Input usado en prueba:

```json
{
  "hashtags": ["pepeaguilar"],
  "contentType": "posts_and_reels",
  "maxResultsPerHashtag": 10,
  "maxResultsTotal": 10,
  "sortBy": "recent",
  "minPostDate": "2026-06-29",
  "enrichPostDetails": true,
  "publicBrowserMode": true
}
```

Resultado:

- Actor prometia contenido reciente por hashtag, sin login.
- La corrida hizo timeout despues de 180 segundos.
- Dataset vacio.
- Costo de prueba: 0.005 USD.

Decision:

No usar como actor principal todavia. La estrategia de hashtag reciente es buena, pero este actor fue inestable en la prueba.

```text
coderx/instagram-profile-scraper-api
```

Resultado de ficha:

- Actor de perfiles publicos, no de keyword search.
- Rating revisado: 4.9 con 11 reviews.
- Precio visible: desde 1.20 USD por 1,000 perfiles.
- No requiere login/cookies.
- Trae hasta 12 posts recientes por perfil con `url`, `caption`, `timestamp`, `likesCount`, `commentsCount`, `mediaType` y `productType`.

Input usado en prueba:

```json
{
  "usernames": ["pepeaguilar_oficial"]
}
```

Resultado de prueba:

- Corrida exitosa.
- Perfil encontrado: `pepeaguilar_oficial`.
- Followers: 2,999,109.
- Perfil verificado: si.
- Ultimo post devuelto: `2026-06-27T23:58:05`, sobre Neiva.
- No trajo post del `2026-06-29` para esa cuenta.
- Trajo links directos reales de Instagram y metricas de likes/comentarios.

Decision:

Usarlo como actor confiable para monitoreo de cuentas conocidas, no como descubrimiento abierto de opinion publica. Sirve para cuentas oficiales, aliados, venues, medios y fanpages que ya tengamos en una lista.

Reglas:

- Post-filtrar siempre por `taken_at_date`.
- Si no hay items en la fecha del reporte, no mostrar tarjeta de Instagram.
- No mezclar reels historicos con el reporte diario.
- Para produccion falta encontrar un actor de Instagram con fecha exacta o una estrategia alternativa por cuentas/hashtags monitoreados.
- Separar "sin contenido" de "actor no confiable": Instagram solo debe marcarse como 0 publicaciones cuando el actor usado tenga busqueda reciente verificable y rango/post-filtro por fecha.

Estrategia sugerida para Instagram:

- Monitorear hashtags fijos: `pepeaguilar`, `angelaaguilar`, `dinastiaaguilar`, `jaripeohastalosuesos`.
- Monitorear cuentas conocidas de medios/venues/clubes de fans.
- Enriquecer URLs encontradas con un actor de detalles de post/reel.
- Guardar la red como `instagram_unverified` si el origen fue busqueda externa y no un scraper directo de Instagram.
- Para cuentas monitoreadas, guardar resultados como `instagram_profile_monitor` y filtrar `latestPosts.timestamp` por la fecha exacta del reporte.

```text
apidojo/instagram-hashtag-scraper
```

Resultado de ficha:

- Actor de hashtags/keyword simple para Instagram.
- No requiere cookies/login.
- Rating revisado: 5.0 con 10 reviews en ficha API; pagina visible muestra 4.0 con 14 reviews por historial de cambios.
- Uso alto: mas de 100K corridas totales y mas de 33K exitosas en 30 dias.
- Precio visible:
  - `0.016 USD` por keyword/hashtag.
  - incluye primeros resultados.
  - `0.0004 USD` por item adicional.
- Campos utiles:
  - `url`
  - `createdAt`
  - `caption`
  - `likeCount`
  - `commentCount`
  - `video.playCount`
  - `owner.username`
  - `owner.fullName`
  - media/image/video metadata
- Input relevante:
  - `keyword`: string.
  - `until`: solo posts creados en o despues de `YYYY-MM-DD`.
  - `getPosts`: boolean.
  - `getReels`: boolean.
  - `maxItems`: numero.
- Nota de documentacion: `until` funciona mas confiable con `getPosts: true`, `getReels: false`; con reels puede venir menos ordenado.

Prueba 1:

```json
{
  "keyword": "pepeaguilar",
  "until": "2026-06-29",
  "getPosts": true,
  "getReels": false,
  "maxItems": 10
}
```

Resultado:

- Run: `ha54zOrgCryw7LTMl`.
- Estado: `SUCCEEDED`.
- Costo: `0.016 USD`.
- Dataset: 2 items.
- Ambos items fueron del `2026-06-29`.
- Items:
  - `lamejorfmmty`, `2026-06-29T16:00:06.000Z`, `8` likes, `1` comment, `https://www.instagram.com/p/DaLMqBPRgcV/`.
  - `nodalngela_fans`, `2026-06-29T02:38:12.000Z`, `575` likes, `9` comments, `https://www.instagram.com/p/DaJz97xEV5w/`.

Prueba 2:

```json
{
  "keyword": "Pepe Aguilar",
  "until": "2026-06-29",
  "getPosts": true,
  "getReels": false,
  "maxItems": 10
}
```

Resultado:

- Estado: `SUCCEEDED`.
- Dataset: 0 items.
- Conclusion: este actor no funciona bien con frase libre para esta busqueda; usar hashtags/keywords compactas.

Prueba 3:

```json
{
  "keyword": "pepeaguilar",
  "until": "2026-06-29",
  "getPosts": false,
  "getReels": true,
  "maxItems": 10
}
```

Resultado:

- Estado: `SUCCEEDED`.
- Dataset: 0 items.

Decision:

Usar como actor principal barato para Instagram diario por hashtags/keywords compactas. No sustituye busqueda semantica libre, pero si cumple el requisito operativo mas importante: traer contenido reciente por fecha con links y metricas a bajo costo.

Reglas de uso diario:

- Correr primero con `getPosts: true`, `getReels: false`.
- Usar `until` con la fecha exacta del reporte.
- `maxItems: 10` por keyword para pruebas; subir a 30 si devuelve exactamente 10.
- Keywords iniciales:
  - `pepeaguilar`
  - `angelaaguilar`
  - `familiaaguilar`
  - `dinastiaaguilar`
- Keywords opcionales por evento/campana:
  - `losaguilar`, solo con filtro estricto porque puede traer negocios no relacionados.
  - `jaripeohastalosuesos`, solo si hay evento activo.
- Post-filtrar por entidades del texto:
  - Pepe Aguilar
  - Angela Aguilar
  - Leonardo Aguilar
  - Aguilar
- Excluir por defecto si el foco del post es:
  - Cazzu
  - Christian Nodal
  - Nodal
- Excepcion: conservar un post con Cazzu/Nodal solo si Pepe Aguilar, la familia Aguilar o la dinamica familiar son el tema central del texto.
- Para hashtags amplios como `angelaaguilar`, solo guardar items que mencionen Pepe/Aguilar o que sean relevantes al briefing.
- Costo estimado inicial: `0.016 USD` por keyword. Con 5 keywords, alrededor de `0.08 USD` antes de items adicionales.
- Si se necesita reels, correr como segunda pasada separada y revisar manualmente porque el filtro de fecha es menos confiable.

Prueba completa de 5 keywords:

- Fecha: `2026-06-29`.
- Keywords:
  - `pepeaguilar`
  - `angelaaguilar`
  - `dinastiaaguilar`
  - `losaguilar`
  - `jaripeohastalosuesos`
- Input por keyword:

```json
{
  "until": "2026-06-29",
  "getPosts": true,
  "getReels": false,
  "maxItems": 10
}
```

Resultado:

- Corridas: 5.
- Costo real: `0.016 USD` por corrida, `0.08 USD` total.
- Items raw: 14.
- Items unicos: 14.
- Items en fecha `2026-06-29`: 14.
- Items relevantes por texto/hashtag: 11.
- Resultados por keyword:
  - `pepeaguilar`: 3 items.
  - `angelaaguilar`: 10 items.
  - `dinastiaaguilar`: 0 items.
  - `losaguilar`: 1 item, pero resulto ruido de taqueria.
  - `jaripeohastalosuesos`: 0 items.

Decision despues de la prueba completa:

- Mantener `pepeaguilar` y `angelaaguilar`.
- Usar tambien `familiaaguilar` y `dinastiaaguilar` aunque a veces den bajo volumen, porque son mas limpios para el briefing.
- No usar `aguilar` solo: es demasiado amplio y puede traer personas, negocios o cuentas no relacionadas.
- Agregar mas keywords solo si tienen sentido del evento o campana.
- No usar `losaguilar` sin post-filtro estricto porque trae negocios no relacionados.
- No depender de `dinastiaaguilar` o `jaripeohastalosuesos` si vuelven a dar 0 por varios dias.
- Para dashboard diario, guardar solo items post-filtrados por entidad/relevancia.
- Excluir contenido donde el centro sea Cazzu, Christian Nodal o Nodal, salvo que el texto conecte directamente con Pepe/familia Aguilar.

## TikTok

Actores revisados:

```text
clockworks/tiktok-comments-scraper
```

Uso:

- Sirve para extraer comentarios de URLs ya conocidas.
- No sirve como descubrimiento diario de publicaciones.

Decision:

Usarlo solo como segunda etapa, cuando ya tengamos URLs de TikTok.

```text
apidojo/tiktok-scraper
```

Resultado:

- Trajo TikToks relevantes para `Pepe Aguilar`.
- Tambien trajo contenido viejo.
- No cumplio claramente con rango exacto `from/to`.

Decision:

No usar como actor principal hasta confirmar filtro exacto por fecha.

```text
scrapeforge/tiktok-posts
```

Resultado:

- Usa fechas relativas como `yesterday` o `this-week`.
- No cumple la regla de rango exacto.
- Se intento probar con `datePosted: today`, pero el actor respondio que solo acepta:
  - `yesterday`
  - `this-week`
  - `this-month`
  - `last-3-months`
  - `last-6-months`
  - `all-time`

Decision:

Descartado para el flujo diario principal.

```text
paul_44/tiktok-search
```

Ventajas:

- Soporta busqueda por keyword.
- Soporta orden por `MOST_LIKED`.
- Soporta filtro por `minPlayCount`.
- Soporta `strictKeywordMatch`.
- Trae views, likes, comments, shares, seguidores, autor y URL.

Problemas:

- No soporta rango exacto `from/to`; usa `dateRange` relativo: `today`, `yesterday`, `7days`, `1month`, etc.
- Apify exigio `maxTotalChargeUsd` minimo de 1 USD para correr, asi que no se probo con la cuenta actual.

Decision:

No usarlo como actor principal diario mientras no acepte fecha exacta. Puede ser fallback si se autoriza un costo minimo mayor y se post-filtra por `uploadedAt`.

```text
sentry/tiktok-search-api
```

Input usado en prueba:

```json
{
  "keywords": ["Pepe Aguilar"],
  "maxVideosPerKeyword": 10,
  "maxVideosTotal": 10,
  "sortOrder": "mostViews",
  "datePosted": "today",
  "includePhotoPosts": false
}
```

Resultado de prueba:

- Corrida exitosa con tope de costo bajo.
- Trajo 10 items.
- Despues de filtrar localmente por fecha exacta `2026-06-26` y relevancia real, se conservaron 6 videos.
- Campos utiles: `url`, `embedUrl`, `desc`, `createdAt`, `author`, `nickname`, `followers`, `plays`, `likes`, `comments`, `shares`, `bookmarks`, `hashtags`, `musicTitle`, `musicAuthor`.
- Trae links directos reales a TikTok.
- Puede traer resultados del dia anterior aunque se pida `today`; se debe post-filtrar por `createdAt`.
- Puede traer resultados fuzzy o sin descripcion; se deben descartar si no mencionan entidades relevantes.

Decision:

Usarlo solo como actor probado/fallback de TikTok mientras no tengamos un actor con rango exacto `from/to`.

Reglas de post-filtro para TikTok:

- Conservar solo items cuyo `createdAt` caiga dentro de la fecha exacta del reporte.
- Conservar solo items cuyo texto, hashtags, musica o metadata mencionen entidades relevantes:
  - Pepe Aguilar
  - Angela Aguilar
  - Leonardo Aguilar
  - Aguilar
- Descartar items sin descripcion si no hay otra evidencia textual clara.
- Descartar fuzzy matches que no contengan Pepe/Aguilar/Angela/Leonardo.
- Mostrar `views`, `likes`, `comments`, `shares`, `bookmarks` y `followers` solo si existen.
- No construir links manuales; usar `url` o `embedUrl` del actor.

Estado actual de TikTok:

No hay todavia actor principal que cumpla perfecto la regla de fecha exacta `from/to`. El mejor actor probado para datos reales es `sentry/tiktok-search-api`, pero usa `datePosted: today` y requiere post-filtro local.

## YouTube

Actores revisados:

```text
crawlerbros/youtube-search-scraper
```

Resultado:

- La ficha muestra filtros utiles como `uploadDate: today` y orden por fecha.
- Se intento prueba con `searchQueries: ["Pepe Aguilar"]`, `maxResults: 10`, `sortBy: "upload_date"`, `uploadDate: "today"`, `type: "video"`, `market: "MX"`.
- Con `maxTotalChargeUsd: 0.08` el run fue abortado por presupuesto antes de traer datos.
- Costo real: 0 USD.

Decision:

No correr de nuevo sin aprobar mayor presupuesto. Es candidato por filtros, pero no esta validado.

```text
scrapesmith/youtube-free-search-scraper
```

Resultado:

- La ficha parece barata y trae campos de impacto como `views`, `likes` y `comments`.
- Se probaron inputs con `searchQueries` y luego con `query`.
- En ambos casos devolvio resultados default de CNN, lo que indica que el input usado por API no quedo correcto o el actor ignora esos campos.

Decision:

No usar hasta confirmar input exacto desde la consola/schema. No cargar resultados al dashboard.

Reglas para YouTube:

- Solo cargar videos si el actor trae URL directa, fecha de publicacion y metricas de impacto.
- Preferir orden por `upload_date` para reporte diario.
- Despues ordenar localmente por `views`, `likes` y `comments` para mostrar lo mas relevante.

## Reddit

Actores revisados:

```text
benthepythondev/reddit-archive-scraper
```

Resultado de ficha:

- Promete busqueda por `searchQuery`.
- Acepta `afterDate`, `beforeDate`, `maxPosts`, `includeComments` y `maxCommentsPerPost`.
- La ficha indica que usa PullPush/Pushshift archive.

Pruebas:

- `searchQuery: "\"Pepe Aguilar\""`, `afterDate: "2026-06-29"`, `beforeDate: "2026-06-30"`, `maxPosts: 10`, `includeComments: false`: dataset vacio.
- `searchQuery: "Pepe Aguilar"`, `afterDate: "2026-06-01"`, `beforeDate: "2026-06-30"`, `maxPosts: 5`, `includeComments: false`: dataset vacio.
- Prueba de control con `searchQuery: "Taylor Swift"` en junio 2026 y `maxPosts: 1`: dataset vacio.

Decision:

No usar como actor principal todavia. Aunque la ficha promete el flujo correcto, la prueba de control tambien salio vacia, asi que no queda validado.

Reglas para Reddit:

- Empezar solo con posts, no comentarios.
- No activar `includeComments` en el analisis diario inicial porque multiplica volumen y costo.
- Si se activa comentarios despues, limitar `maxCommentsPerPost`.
- Tratar Reddit como red de bajo volumen o exploratoria hasta validar un actor que devuelva datos reales.

## Clasificacion de IA

Apify solo debe traer datos crudos. La clasificacion editorial debe venir despues.

La IA debe llenar:

- tema principal
- sentimiento: favorable, neutral, critica
- riesgo: bajo, medio, alto
- tipo de conversacion: noticia, opinion, promocion, burla, critica, fan, evento, negocio, familia, musica u otro
- resumen breve
- razon de clasificacion
- posible aliado: si/no
- nivel de aliado: micro, medio, macro
- accion sugerida

Regla:

No clasificar por categorias fijas como `familia`, `musica` o `empresas` antes de tener IA. Esas categorias deben salir del texto real o del clasificador.

## Enlaces

No mostrar boton `Abrir` si no hay URL.

Para cada mencion guardar:

```text
url_status = ok | broken | unknown
```

Reglas:

- Si Apify trae `permalink`, usarlo como link principal.
- Si el enlace falla, marcarlo como `broken`.
- Si solo hay texto y usuario, mostrar la publicacion sin boton de abrir.
- No construir busquedas de X como si fueran enlaces reales.

## Supabase sugerido

Tabla `apify_runs`:

- `id`
- `actor_id`
- `actor_name`
- `platform`
- `query`
- `date_from`
- `date_to`
- `input_json`
- `status`
- `cost_usd`
- `dataset_id`
- `item_count`
- `created_at`

Tabla `raw_social_mentions`:

- `id`
- `run_id`
- `platform`
- `external_id`
- `url`
- `url_status`
- `author_handle`
- `author_name`
- `author_url`
- `text`
- `created_at_platform`
- `collected_at`
- `is_reply`
- `is_retweet`
- `is_quote`
- `reply_to_url`
- `parent_url`
- `comments`
- `retweets`
- `quotes`
- `likes`
- `views`
- `links_json`
- `media_json`
- `raw_json`

Tabla `mention_ai_analysis`:

- `mention_id`
- `topic`
- `sentiment`
- `risk_level`
- `intent`
- `is_ally_candidate`
- `ally_tier`
- `summary`
- `recommended_action`
- `model`
- `classified_at`

## Redes propias

Esta capa va separada de la conversacion publica por query/hashtag.

Objetivo:

- Medir que dice la audiencia directa de Pepe en sus propios canales.
- Analizar comentarios en publicaciones propias.
- Detectar apoyo, quejas, preguntas frecuentes, riesgo y oportunidades de respuesta.
- Google News no entra en esta capa.

Flujo recomendado:

1. Obtener publicaciones recientes del perfil/canal oficial.
2. Filtrar por fecha exacta o por ultimas N publicaciones si la red no permite fecha.
3. Seleccionar posts para comentarios:
   - posts publicados en la fecha del reporte
   - posts con mas engagement
   - posts marcados manualmente como importantes
   - YouTube propio: descubrir primero los ultimos 5 videos del canal con RSS y despues pedir comentarios por URL.
   - TikTok propio: pedir 13 videos para compensar videos fijados y quedarse con los 10 mas utiles por fecha/engagement.
4. Extraer comentarios de esos posts.
5. Guardar raw.
   - Regla critica: los comentarios si deben filtrarse por fecha del dia de analisis.
   - Si el actor permite `from/to`, usarlo en el input.
   - Si el actor no permite `from/to`, guardar `comment_created_at` raw y post-filtrar: `comment_created_at >= day_start` y `< next_day_start`.
   - Si un comentario no trae fecha confiable, no entra al analisis diario; puede quedar en una cola `sin_fecha` para revision, pero no cuenta porcentajes ni sentimiento.
6. Clasificar con IA comentarios y posts.

Actores recomendados por red:

### Instagram propio

Publicaciones del perfil:

```text
coderx/instagram-profile-scraper-api
```

- Uso: pasar username oficial, por ejemplo `pepeaguilar_oficial`.
- Trae perfil, followers y `latestPosts`.
- Ya probado con `pepeaguilar_oficial`.
- Costo visible: `0.003 USD` actor start + `0.0012 USD` por perfil.
- Campos utiles: `followersCount`, `verified`, `latestPosts.caption`, `latestPosts.timestamp`, `latestPosts.likesCount`, `latestPosts.commentsCount`, `latestPosts.url`.
- Decision: principal para posts propios de Instagram.

Comentarios:

```text
apify/instagram-comment-scraper
```

- Uso: pasar URLs de posts/reels.
- Rating revisado: 4.6 con 50 reviews.
- Uso alto: mas de 7.7M runs.
- Costo visible: desde `0.0026 USD` por comentario en plan free.
- Campos utiles: texto, author, likes, replies, timestamp, comment URL.
- Decision: principal para comentarios propios de Instagram.

Regla de costo:

- No extraer comentarios de todos los posts.
- Limite inicial: max 50 comentarios por post, max 3 posts por dia.
- Si un post tiene riesgo o mucho engagement, subir a 100 comentarios.

### Facebook propio

Publicaciones de pagina/perfil:

```text
apify/facebook-pages-scraper
```

- Uso: pasar URL de la pagina oficial.
- Rating revisado: 4.45 con 46 reviews.
- Uso alto: mas de 27M runs.
- Costo visible: desde `0.012 USD` por page item en plan free.
- Campos utiles: page metadata, followers/likes, visible content.
- Decision: usar para metadata/base de pagina.

Alternativas para posts:

```text
scraper_one/facebook-posts-scraper
unseenuser/fb-posts
patient_discovery/facebook-page-posts
```

- `scraper_one/facebook-posts-scraper` tiene mejor volumen/reviews para posts por URL.
- `unseenuser/fb-posts` dice no login y posts/reels, pero tiene menos volumen.
- `patient_discovery/facebook-page-posts` es cookieless por page ID, pero sin reviews.

Comentarios:

```text
apify/facebook-comments-scraper
```

- Uso: pasar URLs de publicaciones/reels/videos.
- Rating revisado: 4.73 con 76 reviews.
- Uso alto: mas de 8.7M runs.
- Costo visible: actor start `0.001 USD` + desde `0.0025 USD` por comentario en plan free.
- Tiene add-on de filtro de fecha.
- Decision: principal para comentarios propios de Facebook.

Regla de costo:

- Extraer comentarios solo de posts propios nuevos o top engagement.
- Limite inicial: 50 comentarios por post.

### YouTube propio

Videos/canal:

```text
viralanalyzer/youtube-fast-scraper
```

- Uso: pasar canal, playlist o URLs de videos.
- Rating revisado: 5.0 con 3 reviews.
- Costo visible: desde `0.004 USD` por video en plan free.
- Campos utiles: views, likes, comment count, title, description, upload date, hashtags, thumbnails.
- Decision: candidato principal para videos/canal propio.

Comentarios:

```text
code-node-tools/youtube-comments-scraper
```

- Uso: pasar URLs de videos, canales o playlists.
- Rating revisado: 5.0 con 1 review.
- Costo visible: actor start `0.04 USD` + desde `0.0024 USD` por comentario.
- Puede hacer sentiment/language detection, pero no usar sentiment del actor como verdad final; clasificar con nuestra IA.
- Decision: candidato principal para comentarios de YouTube, pero probar con pocos comentarios por costo.

Regla de costo:

- Extraer comentarios de max 3 videos recientes/top.
- Limite inicial: 50 comentarios por video.
- No activar sentiment del actor en pruebas; hacerlo con IA propia despues.

### TikTok propio

Perfil/videos:

```text
andok/tiktok-intelligence
```

- Uso: pasar URL de perfil o videos.
- Rating: sin reviews, pero 0 fallos recientes.
- Costo visible: actor start `0.05 USD` + `0.005 USD` por profile scan/dataset item.
- Campos utiles: video URL, play count, likes, comments, shares, createdAt, author metadata, caption/hashtags.
- Decision: candidato para posts propios de TikTok.

Comentarios:

```text
andok/tiktok-comments-extractor
```

- Uso: pasar URLs de videos.
- Costo visible: actor start `0.01 USD` + `0.001 USD` por comentario.
- Campos utiles: comment text, author, likes, replies, created timestamp.
- Decision: candidato para comentarios propios de TikTok.

Regla de costo:

- Extraer comentarios de max 3 videos recientes/top.
- Limite inicial: 50 comentarios por video.

### X propio

Posts del perfil:

```text
scraper_one/x-profile-posts-scraper
```

- Uso: pasar URL del perfil oficial de X.
- Rating revisado: 5.0 con 2 reviews.
- Uso alto: mas de 198K runs.
- Costo visible: init desde `0.025 USD` en free + desde `0.0014 USD` por item.
- Campos utiles: texto, URL, fecha, media, author metadata, replies, quotes, reposts, likes.
- Decision: principal para posts propios de X.

Replies:

```text
scraper_one/x-post-replies-scraper
```

- Uso: pasar URLs de posts propios.
- Rating revisado: 4.96 con 4 reviews.
- Uso alto: mas de 812K runs.
- Costo visible: init desde `0.025 USD` en free + desde `0.00125 USD` por reply.
- Campos utiles: reply text, author, timestamp, media, likes, views, conversation context.
- Decision: principal para replies a posts propios de X.

Regla de costo:

- Primero extraer posts propios.
- Solo extraer replies de posts del dia o top engagement.
- Limite inicial: 50 replies por post.

### Modelo de datos sugerido para redes propias

Tabla `owned_social_profiles`:

- `id`
- `platform`
- `profile_url`
- `handle`
- `display_name`
- `is_active`
- `raw_json`
- `updated_at`

Tabla `owned_social_posts`:

- `id`
- `run_id`
- `platform`
- `profile_id`
- `external_id`
- `url`
- `text`
- `created_at_platform`
- `likes`
- `comments_count`
- `shares`
- `views`
- `raw_json`
- `collected_at`

Tabla `owned_social_comments`:

- `id`
- `run_id`
- `platform`
- `post_id`
- `external_id`
- `url`
- `author_handle`
- `author_name`
- `text`
- `created_at_platform`
- `comment_created_at`
- `date_window_start`
- `date_window_end`
- `is_in_report_window`
- `has_reliable_date`
- `likes`
- `reply_count`
- `parent_comment_id`
- `raw_json`
- `collected_at`

Tabla `owned_comment_ai_analysis`:

- `comment_id`
- `sentiment`
- `topic`
- `risk_level`
- `question_or_request`
- `is_fan_support`
- `is_complaint`
- `is_reply_candidate`
- `summary`
- `recommended_response`
- `model`
- `classified_at`

Seccion de dashboard sugerida:

- Nombre: `Audiencia propia` o `Redes propias`.
- Vista 1: posts propios por red.
- Vista 2: comentarios por post.
- Vista 3: temas recurrentes de comentarios.
- Vista 4: alertas y oportunidades de respuesta.
- Vista 5: mejores posts por engagement.

Estado local aplicado:

- Se agrego la vista `Redes propias` al menu local.
- Perfiles oficiales configurados:
  - Instagram: `https://www.instagram.com/pepeaguilar_oficial/`
  - Facebook: `https://www.facebook.com/pepeaguilaroficial/?locale=es_LA`
  - TikTok: `https://www.tiktok.com/@pepeaguilar_oficial?lang=es`
  - YouTube: `https://www.youtube.com/channel/UC-N64vzpIAqoTgKMeOxCDhA`
  - X: `https://x.com/PepeAguilar?lang=es`
- Incluye posts reales ya probados de:
  - Instagram: 1 post desde `coderx/instagram-profile-scraper-api`.
  - TikTok: 10 videos desde `clockworks/tiktok-profile-scraper`; siguiente corrida pide 13 para cubrir videos fijados.
  - X: 10 posts desde `scraper_one/x-profile-posts-scraper`.
  - YouTube: 5 videos desde el feed oficial RSS del canal, sin costo Apify.
- Facebook tiene metadata real de pagina desde `apify/facebook-pages-scraper`, pero ese actor no trae posts.
- YouTube con `viralanalyzer/youtube-fast-scraper` quedo bloqueado por anti-bot de YouTube, pidio cookies y se aborto sin costo. Para listar videos propios usar RSS primero.
- No se muestran comentarios todavia: primero se extraen posts propios, despues se eligen los ultimos 5 videos de YouTube y hasta 10 posts por red para correr comentarios con limite bajo. Los comentarios deben filtrarse por fecha del dia del reporte.
- Google News queda fuera de esta capa.

Costos de prueba reales:

- X profile posts: `0.0025 USD`, 10 posts.
- Facebook page metadata: `0.0082 USD`, 1 pagina.
- TikTok profile videos: `0.02 USD`, 10 videos; configurar pruebas siguientes a 13 videos.
- YouTube channel RSS: `0 USD`, 5 videos.
- YouTube channel videos con actor: `0 USD`, 0 videos, abortado por anti-bot.

Payloads de prueba para posts propios:

YouTube posts/videos:

```json
{
  "source": "youtube-channel-rss",
  "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UC-N64vzpIAqoTgKMeOxCDhA",
  "limit": 5,
  "note": "No consume Apify. Trae titulo, videoId, URL y fecha; no trae views, likes ni comentarios."
}
```

X posts propios:

```json
{
  "actor": "scraper_one/x-profile-posts-scraper",
  "maxTotalChargeUsd": 0.04,
  "input": {
    "profileUrls": ["https://x.com/PepeAguilar"],
    "resultsLimit": 10,
    "skipPinnedPosts": true
  }
}
```

Facebook pagina propia:

```json
{
  "actor": "apify/facebook-pages-scraper",
  "maxTotalChargeUsd": 0.04,
  "input": {
    "startUrls": [
      { "url": "https://www.facebook.com/pepeaguilaroficial/?locale=es_LA" }
    ],
    "maxItems": 1
  }
}
```

TikTok perfil propio:

```json
{
  "actor": "clockworks/tiktok-profile-scraper",
  "maxTotalChargeUsd": 0.03,
  "input": {
    "profiles": ["pepeaguilar_oficial"],
    "resultsPerPage": 13,
    "shouldDownloadCovers": false,
    "shouldDownloadSlideshowImages": false,
    "shouldDownloadSubtitles": false,
    "shouldDownloadVideos": false
  }
}
```

Nota de ejecucion:

- El primer intento del runner local fallo porque se uso `$Input` como nombre de parametro de PowerShell; `$input` es variable automatica. Se corrigio a `$ActorInput`.
- `andok/tiktok-intelligence` no sirvio para este perfil: devolvio `No videos found in the expected rehydration state`.
- `clockworks/tiktok-profile-scraper` si sirvio para TikTok y es el actor recomendado para perfil propio.
- `clockworks/tiktok-profile-scraper` puede devolver videos fijados junto con recientes. Pedir 13, guardar el campo `isPinned` y ordenar por `createTime` cuando se quiera leer cronologia.
- YouTube con `viralanalyzer/youtube-fast-scraper` si recibio input, pero yt-dlp fue bloqueado: `Sign in to confirm you're not a bot`. No usar diario sin resolver cookies/otro actor.
- Para YouTube propio, usar RSS del canal para detectar los ultimos 5 videos y despues correr comentarios por URL con limite bajo.
- Candidato barato para comentarios YouTube: `apidojo/youtube-comments-scraper`.
  - Store: `https://apify.com/apidojo/youtube-comments-scraper`
  - Reviews al 2026-06-29: 12.
  - Rating listado en store: ~4.6.
  - Costo listado: `0.001 USD` por video query + `0.0005 USD` por comentario.
  - Prueba real ejecutada el 2026-06-30: 1 video, `maxItems=20`, `sort=latest`, run `Ei5U6wb9gwBSqJtkm`, costo reportado `0.001 USD`, 20 comentarios.
  - Payload validado:
    ```json
    {
      "startUrls": ["https://www.youtube.com/watch?v=yza5Tpl1SG0"],
      "sort": "latest",
      "maxItems": 20,
      "includeReplies": false
    }
    ```
  - Limitacion importante: el actor trae `publishedTime` relativo (`7 days ago`, `3 weeks ago`, etc.), no fecha exacta confiable. No usar estos comentarios para el corte diario hasta resolver fecha exacta o normalizacion confiable.
- Comentarios Instagram propios probados:
  - Actor recomendado: `apify/instagram-comment-scraper`.
  - Prueba real ejecutada el 2026-06-30 sobre `https://www.instagram.com/p/DaG8ym3DMxL/`.
  - Run `xGdVKzx5SM8vlHc25`, dataset `BoIwCEOxBjGZRWUDm`, costo reportado `0.046 USD`, 20 comentarios.
  - Payload validado:
    ```json
    {
      "directUrls": ["https://www.instagram.com/p/DaG8ym3DMxL/"],
      "resultsLimit": 20,
      "includeNestedComments": false
    }
    ```
  - Si trae fecha exacta ISO en `timestamp`; sirve para filtro diario por comentario.
- Comentarios TikTok propios probados:
  - Actor recomendado: `clockworks/tiktok-comments-scraper`.
  - Razon: mas de 9M runs, 80 reviews, rating aprox. 4.76; cobra por comentario.
  - Prueba real ejecutada el 2026-06-30 sobre `https://www.tiktok.com/@pepeaguilar_oficial/video/7650181751595109663`.
  - Run `imT9yocJUiBd1IoWa`, dataset `ifEYO1xcLKPCuqtxf`, 20 comentarios. Costo reportado por API: `0 USD` en esta prueba.
  - Payload validado:
    ```json
    {
      "postURLs": ["https://www.tiktok.com/@pepeaguilar_oficial/video/7650181751595109663"],
      "commentsPerPost": 20,
      "maxRepliesPerComment": 0
    }
    ```
  - Si trae fecha exacta ISO en `createTimeISO`; sirve para filtro diario por comentario.
  - `andok/tiktok-comments-extractor` se descarta por ahora: rechazo `maxComments` y no expone schema publico.
- Replies de X propios probados:
  - Actor recomendado: `scraper_one/x-post-replies-scraper`.
  - Razon: muchas corridas, rating aprox. 4.96, costo bajo por reply.
  - Prueba real ejecutada el 2026-06-30 sobre `https://x.com/PepeAguilar/status/2054314384152056001`.
  - Run `zichgB1sHf1IObjif`, dataset `NE00frJ5Nf1OA4r21`, 20 replies. Costo reportado por API: `0 USD` en esta prueba.
  - Payload validado:
    ```json
    {
      "postUrls": ["https://x.com/PepeAguilar/status/2054314384152056001"],
      "maxItems": 20
    }
    ```
  - Trae `replyUrl`, `replyText`, autor, followers, replies, reposts, likes, views y timestamp Unix; sirve para links reales y filtro diario.
- Facebook propios:
  - `patient_discovery/facebook-page-posts` no es confiable con el input probado: con `pageUrl` de Pepe devolvio posts de la pagina Facebook generica. No usar para Pepe hasta validar input exacto.
  - `unseenuser/fb-posts` exige `maxPosts >= 3`; la prueba con 3 posts fallo sin costo y sin resultados.
  - Prueba corregida: `unseenuser/fb-posts` si funciona cuando se usa `mode: "profile"` y `sources` con el pageId oficial `100044594342192`.
  - Run posts `aJFqyf79PO2WJa7CE`, dataset `dazvCoMiQeMVpLGSS`, 3 posts/reels reales, costo reportado `0 USD`.
  - Payload validado para posts propios:
    ```json
    {
      "mode": "profile",
      "sources": ["100044594342192"],
      "maxPosts": 3,
      "includeTopComments": true,
      "fetchAllComments": false,
      "fetchCommentReplies": false,
      "enrichSinglePostFields": false
    }
    ```
  - Campos utiles de posts: `url`, `permalink`, `text`, `authorName`, `authorId`, `reactionCount`, `commentCount`, `publishTimeIso`, `videoThumbnailUrl`, `topComments`.
  - Comentarios Facebook probados con `apify/facebook-comments-scraper`.
  - Run comentarios `w4ZHQeDMNNbp650g2`, dataset `5QaQo1orrsRz1p6gA`, 20 comentarios, costo reportado `0.001 USD`.
  - Payload validado para comentarios:
    ```json
    {
      "startUrls": [
        { "url": "https://www.facebook.com/reel/1986719605537457/" }
      ],
      "resultsLimit": 20,
      "includeNestedComments": false
    }
    ```
  - Campos utiles de comentarios: `commentUrl`, `commentId`, `date`, `text`, `profileName`, `profileUrl`, `likesCount`, `facebookId`, `postTitle`.
  - Si trae fecha exacta ISO en `date`; sirve para filtro diario por comentario.
  - Regla: para diario, primero correr posts con `maxPosts: 3` o `10`, filtrar por fecha exacta localmente y luego correr comentarios solo sobre posts nuevos/top engagement.
- No subir el token a archivos ni commits.

## Estado local actual

El dashboard esta en modo local Apify:

```text
src/App.jsx
src/data/localApifyData.js
src/components/PanoramaView.jsx
src/components/SubBar.jsx
src/components/ThemeView.jsx
```

Los datos anteriores de CSV/Supabase no deben mezclarse con este modo local.

La pantalla `Panorama` debe priorizar:

1. tarjetas por red social
2. porcentaje por red
3. publicaciones reales clickeables cuando hay link
4. metricas reales disponibles

No mostrar campos vacios como `0 seguidores` si Apify no trajo ese dato.

## Presupuesto diario del boton Analizar

Configuracion activa en codigo:

```text
src/data/apifyDailyPlan.js
```

Politica:

- Tope duro diario: `1.25 USD`.
- Soft stop: `1.05 USD`.
- Reserva minima antes de ampliar limites: `0.20 USD`.
- Comentarios base por post: `20`.
- Comentarios boosted por post con alto engagement/riesgo: `50`.
- Comentarios maximos por post solo con riesgo y presupuesto: `100`.
- Maximo de posts comentados por red en corrida normal: `3`.
- Posts propios objetivo por red: `5`.
- TikTok se raspa con `13` videos para compensar videos fijados, pero se muestran/analizan los `5` utiles mas recientes despues de excluir fijados.
- En muestras locales puede aparecer menos de `5/5` si aun no se corrio esa red con el limite nuevo. No rellenar con datos inventados.

Distribucion recomendada:

- Escucha publica: hasta `0.38 USD`.
- Posts propios: hasta `0.18 USD`.
- Comentarios propios: hasta `0.49 USD`.
- Clasificacion IA: hasta `0.20 USD`.

Reglas de escalado:

- Si un post llega con `comments >= 100`, `reactions >= 1000`, `views >= 25000` o `likes >= 2500`, subir comentarios de `20` a `50` solo para ese post.
- Si el clasificador o una revision manual marca riesgo, subir de `50` a `100` solo si queda presupuesto despues de la reserva.
- Si un post tiene menos de `10` comentarios, menos de `100` reacciones y menos de `5000` views, no extraer comentarios salvo que sea un post oficial critico.
- No iniciar un actor si `gasto_estimado + cap_del_actor > 1.25`.
- No ampliar `maxItems` cuando `item_count == limit` si no queda al menos `0.20 USD` de reserva.
- No correr comentarios sobre posts sin URL real o sin fecha usable.
- No contar comentarios sin fecha exacta en porcentajes diarios.

## Pendientes

- Buscar y probar un actor de TikTok que acepte rango exacto `from/to`.
- Mantener `sourabhbgp/google-news-scraper` como Google News barato probado; buscar alternativa solo si necesitamos impacto/alcance.
- Armar lista de cuentas Instagram a monitorear con `coderx/instagram-profile-scraper-api`.
- Seguir buscando actor de Instagram por keyword/hashtag que sea estable y reciente.
- Validar YouTube con presupuesto aprobado o input/schema correcto.
- Validar otro actor de Reddit porque `benthepythondev/reddit-archive-scraper` salio vacio incluso en prueba de control.
- Agregar validacion automatica de links.
- Crear llamada de IA para clasificar despues de guardar raw data.
- Conectar el boton `Analizar` para ejecutar actores uno por uno con limite de costo.
