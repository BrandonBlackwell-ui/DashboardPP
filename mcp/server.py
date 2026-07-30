"""
Servidor MCP de solo lectura sobre la base de social listening de Pepe Aguilar.

Expone la información que ya vive en Supabase — publicaciones scrapeadas con Apify,
comentarios, análisis generados por IA y voces (aliados/contrarios) — como herramientas
que Claude puede consultar en conversación.

Dos audiencias en el mismo servicio, cada una en su propia ruta secreta:
  · MCP_URL_TOKEN          → vista del cliente (solo material aprobado)
  · MCP_URL_TOKEN_INTERNO  → vista del equipo (todo, incluidos borradores)

Ejecutar en local:
    MCP_URL_TOKEN=una-cadena-larga python server.py
"""

import os
from typing import Annotated, Any, Literal

import httpx
from fastmcp import FastMCP
from fastmcp.server.auth.providers.github import GitHubProvider
from fastmcp.server.auth.providers.jwt import StaticTokenVerifier
from fastmcp.server.dependencies import get_access_token
from fastmcp.server.middleware import Middleware

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://aeywtloohrhyxvmxqzqe.supabase.co").rstrip("/")
SUPABASE_KEY = os.getenv(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleXd0bG9vaHJoeXh2bXhxenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzY2NzksImV4cCI6MjA5ODQxMjY3OX0.um2x046pEAJhlK6g98brVPFbc1nKFO8ixSUzmoU8dZw",
)
REST = f"{SUPABASE_URL}/rest/v1"
HEADERS = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}

# Solo análisis publicados. Los registros viejos no traen el campo, así que null cuenta
# como aprobado (mismo criterio que usa el dashboard para el acceso del cliente).
SOLO_APROBADOS = {"or": "(approved.is.true,approved.is.null)"}


async def _get(path: str, params: dict[str, Any]) -> list[dict]:
    """GET contra PostgREST. Solo lectura: aquí nunca se escribe en la base."""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{REST}/{path}", params=params, headers=HEADERS)
        r.raise_for_status()
        return r.json()


def _corta(txt: Any, n: int = 300) -> str:
    s = " ".join(str(txt or "").split())
    return s[: n - 1] + "…" if len(s) > n else s


BASE_INSTRUCCIONES = (
    "Base de escucha social de Pepe Aguilar (Blackwell Strategy). Contiene publicaciones "
    "públicas de Facebook, Instagram, TikTok, X, YouTube y prensa; sus comentarios; los "
    "análisis diarios de sentimiento, riesgo y plan de acción; y el mapa de voces aliadas y "
    "contrarias. Todo es de solo lectura.\n\n"
    "Qué herramienta usar: '¿cómo vamos?' o '¿hay riesgo?' → obtener_analisis con red='resumen'. "
    "'¿qué dice la gente?' → buscar_comentarios. '¿qué se publicó?' → buscar_publicaciones. "
    "'¿vamos mejor o peor?' → evolucion_sentimiento. Las fechas son 'YYYY-MM-DD'.\n\n"
    "Cómo responder:\n"
    "· Cada cifra con su origen: red, fecha y sobre cuántos elementos se calculó. Un porcentaje "
    "sin base no se publica.\n"
    "· Consulta las herramientas antes de afirmar. Si un dato no está, dilo; nunca lo estimes.\n"
    "· Una métrica ausente significa que esa red no la reporta, NO que sea cero. Jamás escribas "
    "'0 views' ni deduzcas de un dato faltante que algo 'no tuvo alcance' o 'falló'.\n"
    "· Cita textualmente 1-2 comentarios reales cuando ilustren el punto; valen más que un promedio.\n"
    "· Responde en español, directo y breve, como un analista que reporta a su cliente."
)
INSTRUCCIONES_CLIENTE = (
    "\n\nEsta es la vista del cliente. No expone material interno de la agencia (borradores sin "
    "aprobar, notas de trabajo ni registros del asistente de voz), así que no menciones esos "
    "elementos ni especules sobre ellos. Tampoco describas la infraestructura: nada de "
    "proveedores de scraping, modelos, tokens ni nombres de tablas. Habla en términos de "
    "negocio: 'el monitoreo de la conversación pública'."
)
INSTRUCCIONES_INTERNAS = (
    "\n\nEsta es la vista interna del equipo de Blackwell: incluye análisis en borrador (aún sin "
    "aprobar para el cliente) y los registros del asistente de voz. Cuando cites un análisis que "
    "no esté aprobado, adviértelo explícitamente."
)


def crear_servidor(interno: bool) -> FastMCP:
    """Construye un servidor con el set de herramientas de una audiencia.

    Se usa una factory (y no un flag global) para que cada ruta secreta tenga su propio
    servidor: así la vista del cliente literalmente no registra las herramientas internas
    ni puede consultar borradores, en lugar de depender de un condicional por petición.
    """
    mcp = FastMCP(
        name="Social Listening · Pepe Aguilar" + (" (interno)" if interno else ""),
        instructions=BASE_INSTRUCCIONES + (INSTRUCCIONES_INTERNAS if interno else INSTRUCCIONES_CLIENTE),
        auth=AUTH,
    )
    if USUARIOS_PERMITIDOS:
        mcp.add_middleware(SoloUsuariosPermitidos())

    def aprobados(params: dict) -> dict:
        """Restringe a material publicado cuando la audiencia es el cliente."""
        if not interno:
            params.update(SOLO_APROBADOS)
        return params

    @mcp.tool
    async def listar_analisis(
        desde: Annotated[str | None, "Fecha inicial YYYY-MM-DD"] = None,
        hasta: Annotated[str | None, "Fecha final YYYY-MM-DD"] = None,
        limite: Annotated[int, "Máximo de días a devolver (1-90)"] = 30,
    ) -> dict:
        """Qué análisis existen y de qué días. Úsala primero para saber qué rango hay disponible
        antes de pedir detalles, o cuando el usuario pregunte "¿hasta cuándo hay datos?"."""
        params = aprobados({
            "select": "date_key,theme_key,theme_label",
            "order": "date_key.desc",
            "limit": str(min(max(limite, 1), 90) * 8),
        })
        if desde and hasta:
            params["and"] = f"(date_key.gte.{desde},date_key.lte.{hasta})"
        elif desde:
            params["date_key"] = f"gte.{desde}"
        elif hasta:
            params["date_key"] = f"lte.{hasta}"
        filas = await _get("reports", params)
        por_dia: dict[str, list[str]] = {}
        for f in filas:
            por_dia.setdefault(f["date_key"], []).append(f["theme_key"])
        dias = sorted(por_dia, reverse=True)[: min(max(limite, 1), 90)]
        return {
            "dias_con_analisis": len(por_dia),
            "mas_reciente": dias[0] if dias else None,
            "mas_antiguo": sorted(por_dia)[0] if por_dia else None,
            "detalle": [{"fecha": d, "redes": sorted(set(por_dia[d]))} for d in dias],
        }

    @mcp.tool
    async def obtener_analisis(
        fecha: Annotated[str | None, "Día YYYY-MM-DD. Si se omite, toma el más reciente disponible"] = None,
        red: Annotated[str, "resumen (panorama global), facebook, instagram, tiktok, x, google_news, redes_propias"] = "resumen",
    ) -> dict:
        """Análisis completo de IA de un día: sentimiento, nivel de riesgo, resumen ejecutivo,
        alertas, plan de acción, oportunidades y desglose por red. Es la fuente para "¿cómo vamos?",
        "¿hay riesgo?" o "¿qué recomienda el análisis?". red='resumen' da el panorama consolidado."""
        campos = "date_key,theme_key,theme_label,ai_analysis" + (",approved" if interno else "")
        params = aprobados({
            "select": campos,
            "theme_key": f"eq.{red}",
            "ai_analysis": "not.is.null",
            "order": "date_key.desc",
            "limit": "1",
        })
        if fecha:
            params["date_key"] = f"eq.{fecha}"
        filas = await _get("reports", params)
        if not filas:
            return {"encontrado": False, "mensaje": f"No hay análisis de '{red}'" + (f" para {fecha}" if fecha else "")}
        f = filas[0]
        out = {"encontrado": True, "fecha": f["date_key"], "red": f["theme_key"], "analisis": f.get("ai_analysis")}
        if interno:
            out["aprobado"] = f.get("approved")
        return out

    @mcp.tool
    async def buscar_publicaciones(
        texto: Annotated[str | None, "Palabra o frase a buscar en el texto de la publicación"] = None,
        red: Annotated[str | None, "facebook, instagram, tiktok, x, google_news, youtube"] = None,
        desde: Annotated[str | None, "Fecha inicial YYYY-MM-DD"] = None,
        hasta: Annotated[str | None, "Fecha final YYYY-MM-DD"] = None,
        orden: Annotated[Literal["likes", "views", "comentarios", "reciente"], "Criterio de orden"] = "likes",
        limite: Annotated[int, "Máximo de publicaciones (1-50)"] = 20,
    ) -> dict:
        """Publicaciones públicas scrapeadas sobre Pepe Aguilar, con su alcance real (views, likes,
        comentarios) y su URL. Úsala para "¿qué se publicó de X?", "¿cuál fue el post más viral?"
        o para encontrar la pieza detrás de una conversación."""
        campo = {"likes": "likes", "views": "views", "comentarios": "comments_count", "reciente": "published_date"}[orden]
        params = {
            "select": "platform,username,text,url,published_date,likes,comments_count,views,shares,sentiment",
            "order": f"{campo}.desc",
            "limit": str(min(max(limite, 1), 50)),
        }
        if texto:
            params["text"] = f"ilike.*{texto}*"
        if red:
            params["platform"] = f"eq.{red}"
        cond = []
        if desde:
            cond.append(f"published_date.gte.{desde}")
        if hasta:
            cond.append(f"published_date.lte.{hasta}T23:59:59")
        if cond:
            params["and"] = f"({','.join(cond)})"
        filas = await _get("scraped_posts", params)
        vistos, out = set(), []
        for f in filas:  # el mismo post puede estar guardado en varios días
            clave = f.get("url") or _corta(f.get("text"), 80)
            if clave in vistos:
                continue
            vistos.add(clave)
            out.append({
                "red": f["platform"], "autor": f.get("username"), "fecha": (f.get("published_date") or "")[:10],
                "texto": _corta(f.get("text")), "url": f.get("url"),
                # Solo se reportan métricas con dato: un 0 puede significar que esa red no la expone.
                **{k: v for k, v in (("likes", f.get("likes")), ("comentarios", f.get("comments_count")),
                                     ("views", f.get("views")), ("compartidos", f.get("shares"))) if v},
                **({"sentimiento": f["sentiment"]} if f.get("sentiment") else {}),
            })
        return {"total": len(out), "publicaciones": out}

    @mcp.tool
    async def buscar_comentarios(
        texto: Annotated[str | None, "Palabra o frase a buscar en los comentarios"] = None,
        desde: Annotated[str | None, "Fecha inicial YYYY-MM-DD"] = None,
        hasta: Annotated[str | None, "Fecha final YYYY-MM-DD"] = None,
        min_likes: Annotated[int, "Solo comentarios con al menos estos likes"] = 0,
        limite: Annotated[int, "Máximo de comentarios (1-100)"] = 30,
    ) -> dict:
        """Comentarios reales de la gente, ordenados por likes (los más votados son los que más
        gente ve). Es la mejor fuente para "¿qué dice la gente?", "¿qué opinan de X?" o para citar
        textualmente la voz del público."""
        params = {
            "select": "text,author,published_time,likes,url",
            "order": "likes.desc",
            "limit": str(min(max(limite, 1), 100)),
        }
        if texto:
            params["text"] = f"ilike.*{texto}*"
        cond = []
        if min_likes:
            cond.append(f"likes.gte.{min_likes}")
        if desde:
            cond.append(f"published_time.gte.{desde}")
        if hasta:
            cond.append(f"published_time.lte.{hasta}T23:59:59")
        if cond:
            params["and"] = f"({','.join(cond)})"
        filas = await _get("scraped_comments", params)
        vistos, out = set(), []
        for f in filas:
            clave = (f.get("author"), _corta(f.get("text"), 120))
            if clave in vistos:
                continue
            vistos.add(clave)
            out.append({"autor": f.get("author"), "fecha": (f.get("published_time") or "")[:10],
                        "likes": f.get("likes") or 0, "comentario": _corta(f.get("text"), 400)})
        return {"total": len(out), "comentarios": out}

    @mcp.tool
    async def metricas_por_red(
        desde: Annotated[str | None, "Fecha inicial YYYY-MM-DD"] = None,
        hasta: Annotated[str | None, "Fecha final YYYY-MM-DD"] = None,
    ) -> dict:
        """Volumen y alcance agregados por red: cuántas publicaciones, views, likes y comentarios.
        Úsala para "¿en qué red hay más conversación?" o "¿cuánto alcance tuvimos esta semana?"."""
        params = {"select": "platform,likes,comments_count,views,url", "limit": "5000"}
        cond = []
        if desde:
            cond.append(f"published_date.gte.{desde}")
        if hasta:
            cond.append(f"published_date.lte.{hasta}T23:59:59")
        if cond:
            params["and"] = f"({','.join(cond)})"
        filas = await _get("scraped_posts", params)
        agg: dict[str, dict] = {}
        vistos = set()
        for f in filas:
            clave = (f["platform"], f.get("url"))
            if f.get("url") and clave in vistos:
                continue
            vistos.add(clave)
            a = agg.setdefault(f["platform"], {"publicaciones": 0, "views": 0, "likes": 0, "comentarios": 0})
            a["publicaciones"] += 1
            a["views"] += f.get("views") or 0
            a["likes"] += f.get("likes") or 0
            a["comentarios"] += f.get("comments_count") or 0
        # Se omiten las métricas en cero: significan que la red no las expone (prensa no tiene
        # views ni likes), y mostrarlas como 0 se lee como "no tuvo alcance".
        limpio = {
            red: {k: v for k, v in datos.items() if v or k == "publicaciones"}
            for red, datos in sorted(agg.items(), key=lambda kv: -kv[1]["publicaciones"])
        }
        return {
            "ventana": {"desde": desde, "hasta": hasta},
            "nota": "publicaciones deduplicadas por URL; solo se listan métricas con dato (una métrica ausente = la red no la reporta)",
            "por_red": limpio,
        }

    @mcp.tool
    async def voces(
        tipo: Annotated[Literal["todos", "aliados", "contrarios", "neutrales"], "Qué voces traer"] = "todos",
        limite: Annotated[int, "Máximo por categoría (1-50)"] = 15,
    ) -> dict:
        """Mapa de voces: cuentas, medios y canales que hablan de Pepe, clasificados como aliados,
        contrarios o neutrales, con su alcance (seguidores/engagement) y su perfil. Úsala para
        "¿quiénes nos atacan?", "¿quiénes son aliados?" o "¿qué medios nos cubren?"."""
        mapa = {"aliados": "positive", "contrarios": "negative", "neutrales": "neutral"}
        params = {
            "select": "username,platform,sentiment,followers,total_engagement,tier,keywords,profile_url",
            "order": "total_engagement.desc",
            "limit": "400",
        }
        if tipo != "todos":
            params["sentiment"] = f"eq.{mapa[tipo]}"
        filas = await _get("allies_critics_voices", params)
        inv = {v: k for k, v in mapa.items()}
        grupos: dict[str, list] = {}
        vistos = set()
        for f in filas:
            u = (f.get("username") or "").lower().strip().lstrip("@")
            cat = inv.get(f.get("sentiment"), "neutrales")
            if not u or (cat, u) in vistos:
                continue
            vistos.add((cat, u))
            g = grupos.setdefault(cat, [])
            if len(g) >= min(max(limite, 1), 50):
                continue
            g.append({"cuenta": f.get("username"), "red": f.get("platform"),
                      "alcance": f.get("total_engagement") or f.get("followers") or 0,
                      "seguidores": f.get("followers") or 0, "nivel": f.get("tier"),
                      "temas": f.get("keywords") or [], "perfil": f.get("profile_url")})
        return {"totales": {k: len(v) for k, v in grupos.items()}, "voces": grupos}

    @mcp.tool
    async def evolucion_sentimiento(
        desde: Annotated[str | None, "Fecha inicial YYYY-MM-DD"] = None,
        hasta: Annotated[str | None, "Fecha final YYYY-MM-DD"] = None,
        red: Annotated[str, "resumen para el global, o una red concreta"] = "resumen",
    ) -> dict:
        """Serie temporal de sentimiento y nivel de riesgo, día por día. Úsala para "¿vamos mejor o
        peor?", "¿cómo evolucionó la semana?" o para comparar dos fechas."""
        params = aprobados({
            "select": "date_key,ai_analysis",
            "theme_key": f"eq.{red}",
            "ai_analysis": "not.is.null",
            "order": "date_key.asc",
            "limit": "200",
        })
        cond = []
        if desde:
            cond.append(f"date_key.gte.{desde}")
        if hasta:
            cond.append(f"date_key.lte.{hasta}")
        if cond:
            params["and"] = f"({','.join(cond)})"
        filas = await _get("reports", params)
        serie = []
        for f in filas:
            ai = f.get("ai_analysis") or {}
            s = ai.get("sentimiento") or {}

            def num(x):
                try:
                    return int(float(str(x).replace("%", "").strip()))
                except (TypeError, ValueError):
                    return None
            serie.append({"fecha": f["date_key"], "favorable": num(s.get("favorable")),
                          "neutral": num(s.get("neutral")), "critico": num(s.get("critico")),
                          "riesgo": ai.get("nivel_riesgo")})
        fav = [p["favorable"] for p in serie if p["favorable"] is not None]
        return {
            "red": red, "dias": len(serie),
            "promedio_favorable": round(sum(fav) / len(fav), 1) if fav else None,
            "primero": serie[0] if serie else None, "ultimo": serie[-1] if serie else None,
            "serie": serie,
        }

    if interno:
        @mcp.tool
        async def preguntas_al_asistente(
            limite: Annotated[int, "Máximo de sesiones (1-50)"] = 10,
        ) -> dict:
            """Qué le ha preguntado el cliente al asistente de voz (Orwell), con el resumen de cada
            conversación. Sirve como feedback: revela qué le preocupa y qué información busca.
            Uso interno del equipo."""
            filas = await _get("voice_sessions", {
                "select": "created_at,turns,user_questions,summary",
                "order": "created_at.desc",
                "limit": str(min(max(limite, 1), 50)),
            })
            return {
                "total": len(filas),
                "sesiones": [{"fecha": (f.get("created_at") or "")[:16], "turnos": f.get("turns"),
                              "resumen": f.get("summary"),
                              "preguntas": (f.get("user_questions") or [])[:10]} for f in filas],
            }

    return mcp


# ─── Autenticación ──────────────────────────────────────────────────────────────
# Tres modos, porque los clientes de Claude no piden lo mismo:
#   · Ruta secreta (MCP_URL_TOKEN): el secreto viaja en el path y el servidor no exige
#     cabecera, así que nunca responde 401 —lo que hace a claude.ai iniciar OAuth— sino 404
#     en cualquier ruta que no acierte el token. Patrón "capability URL".
#   · OAuth de GitHub: identidad real por persona, para cuando importe saber quién consulta.
#   · Bearer estático (MCP_TOKEN): lo aceptan Claude Code y Desktop.
# Sin ninguno NO arranca: este servidor queda público y preferimos fallar visible en los
# logs antes que dejar la base al alcance de cualquiera.
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
PUBLIC_URL = (os.getenv("PUBLIC_URL") or "").rstrip("/")
MCP_TOKEN = os.getenv("MCP_TOKEN")
MCP_URL_TOKEN = os.getenv("MCP_URL_TOKEN")
MCP_URL_TOKEN_INTERNO = os.getenv("MCP_URL_TOKEN_INTERNO")
# Con OAuth, autenticarse solo prueba "soy alguien de GitHub". Esta lista limita quién
# puede leer la base; vacía, cualquier cuenta de GitHub entraría.
USUARIOS_PERMITIDOS = {u.strip().lower() for u in (os.getenv("GITHUB_ALLOWED_USERS") or "").split(",") if u.strip()}


class SoloUsuariosPermitidos(Middleware):
    """Corta la llamada si el usuario autenticado no está en la allowlist.

    El proxy de OAuth valida que la cuenta de GitHub sea real, pero no que sea la tuya;
    sin este filtro cualquier cuenta del mundo podría consultar la base.
    """

    async def on_call_tool(self, context, call_next):
        if USUARIOS_PERMITIDOS:
            token = get_access_token()
            claims = getattr(token, "claims", None) or {}
            login = str(claims.get("login") or claims.get("preferred_username") or claims.get("sub") or "").lower()
            if login not in USUARIOS_PERMITIDOS:
                raise PermissionError(f"Usuario '{login or 'desconocido'}' sin acceso a esta base.")
        return await call_next(context)


AUTH = None
MODO_AUTH = ""
if GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET:
    if not PUBLIC_URL:
        raise SystemExit("Con OAuth de GitHub falta PUBLIC_URL (la URL pública del servicio, p. ej. https://mi-mcp.up.railway.app).")
    AUTH = GitHubProvider(client_id=GITHUB_CLIENT_ID, client_secret=GITHUB_CLIENT_SECRET, base_url=PUBLIC_URL)
    MODO_AUTH = f"OAuth GitHub · usuarios permitidos: {', '.join(sorted(USUARIOS_PERMITIDOS)) or 'TODOS (define GITHUB_ALLOWED_USERS)'}"
elif MCP_URL_TOKEN or MCP_URL_TOKEN_INTERNO:
    for nombre, valor in (("MCP_URL_TOKEN", MCP_URL_TOKEN), ("MCP_URL_TOKEN_INTERNO", MCP_URL_TOKEN_INTERNO)):
        if valor and len(valor) < 24:
            raise SystemExit(f"{nombre} es la credencial completa: usa al menos 24 caracteres aleatorios.")
    if MCP_URL_TOKEN and MCP_URL_TOKEN == MCP_URL_TOKEN_INTERNO:
        raise SystemExit("MCP_URL_TOKEN y MCP_URL_TOKEN_INTERNO deben ser distintos: si no, ambas vistas comparten la misma puerta.")
    rutas = [n for n, v in (("cliente", MCP_URL_TOKEN), ("interno", MCP_URL_TOKEN_INTERNO)) if v]
    MODO_AUTH = f"ruta secreta (la URL es la credencial) · vistas activas: {', '.join(rutas)}"
elif MCP_TOKEN:
    AUTH = StaticTokenVerifier(tokens={MCP_TOKEN: {"client_id": "blackwell", "scopes": ["read"]}})
    MODO_AUTH = "token estático (sirve en Claude Code/Desktop; claude.ai web necesita ruta secreta u OAuth)"
else:
    raise SystemExit(
        "Falta configurar autenticación. Elige una:\n"
        "  · claude.ai sin OAuth → MCP_URL_TOKEN (vista cliente) y opcionalmente MCP_URL_TOKEN_INTERNO (vista equipo)\n"
        "  · claude.ai con OAuth → GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, PUBLIC_URL y GITHUB_ALLOWED_USERS\n"
        "  · Claude Code/Desktop → MCP_TOKEN con una cadena secreta larga"
    )


def construir_app():
    """Devuelve (app_o_servidor, ruta_principal, es_asgi).

    Con dos rutas secretas hay que montar dos servidores en una sola app ASGI; con una sola
    vista basta el servidor de FastMCP, que ya sabe correrse solo.
    """
    if MCP_URL_TOKEN and MCP_URL_TOKEN_INTERNO:
        from contextlib import AsyncExitStack, asynccontextmanager

        from starlette.applications import Starlette
        from starlette.routing import Mount  # noqa: F401 (queda por si se necesita montar)

        # Se le da a cada sub-app su ruta COMPLETA: así registra una ruta exacta y no un
        # montaje, que redirigiría (307) cuando la URL llega sin barra final. Luego se
        # combinan ambas rutas en una sola app para servirlas en el mismo puerto.
        sub_cliente = crear_servidor(False).http_app(path=f"/mcp/{MCP_URL_TOKEN}")
        sub_interno = crear_servidor(True).http_app(path=f"/mcp/{MCP_URL_TOKEN_INTERNO}")

        @asynccontextmanager
        async def lifespan(app):
            # Cada sub-app trae su propio lifespan (gestor de sesiones MCP): hay que abrir los dos.
            async with AsyncExitStack() as stack:
                await stack.enter_async_context(sub_cliente.router.lifespan_context(sub_cliente))
                await stack.enter_async_context(sub_interno.router.lifespan_context(sub_interno))
                yield

        app = Starlette(routes=[*sub_cliente.routes, *sub_interno.routes], lifespan=lifespan)
        return app, f"/mcp/{MCP_URL_TOKEN}", True

    interno = bool(MCP_URL_TOKEN_INTERNO and not MCP_URL_TOKEN)
    ruta = f"/mcp/{MCP_URL_TOKEN_INTERNO or MCP_URL_TOKEN}" if (MCP_URL_TOKEN or MCP_URL_TOKEN_INTERNO) else "/mcp"
    return crear_servidor(interno), ruta, False


if __name__ == "__main__":
    puerto = int(os.getenv("PORT", "8080"))
    servidor, ruta, es_asgi = construir_app()
    # Con ruta secreta el token va en el path: se apagan los access logs para que no quede
    # escrito en los registros de la plataforma.
    oculta = bool(MCP_URL_TOKEN or MCP_URL_TOKEN_INTERNO)
    print(f"MCP escuchando en 0.0.0.0:{puerto}{'/mcp/<token oculto>' if oculta else ruta}", flush=True)
    print(f"  auth: {MODO_AUTH}", flush=True)
    print(f"  supabase: {SUPABASE_URL}", flush=True)
    if es_asgi:
        import uvicorn
        uvicorn.run(servidor, host="0.0.0.0", port=puerto, access_log=False, log_level="warning")
    else:
        servidor.run(transport="http", host="0.0.0.0", port=puerto, path=ruta,
                     uvicorn_config={"access_log": not oculta})
