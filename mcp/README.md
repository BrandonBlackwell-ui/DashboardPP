# MCP · Social Listening Pepe Aguilar

Servidor MCP de **solo lectura** sobre la base de Supabase: publicaciones scrapeadas con
Apify, sus comentarios, los análisis diarios de IA y el mapa de voces aliadas/contrarias.
Conectado a Claude, permite preguntar por los datos en lenguaje natural.

## Herramientas

| Herramienta | Para qué sirve |
|---|---|
| `listar_analisis` | Qué días tienen análisis y de qué redes |
| `obtener_analisis` | Análisis completo de un día: sentimiento, riesgo, alertas, plan de acción |
| `buscar_publicaciones` | Publicaciones scrapeadas con su alcance real y URL |
| `buscar_comentarios` | Comentarios de la gente, ordenados por likes |
| `metricas_por_red` | Volumen y alcance agregados por red |
| `voces` | Aliados, contrarios y neutrales con su alcance |
| `evolucion_sentimiento` | Serie temporal de sentimiento y riesgo |
| `preguntas_al_asistente` | Qué le ha preguntado el cliente al asistente de voz |

Nunca escribe en la base y solo reporta métricas con dato (una métrica ausente significa
que esa red no la expone, no que sea cero).

## Desplegar en Railway

Como el repo ya tiene un servicio Node, este va **como servicio aparte**:

1. Railway → **New Service** → *GitHub Repo* → este repo.
2. En **Settings → Root Directory** pon `mcp`.
3. Genera un dominio público (**Settings → Networking → Generate Domain**) y cópialo.
4. Define las variables (ver abajo) y redespliega.

El endpoint queda en `https://TU-DOMINIO/mcp`.

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
