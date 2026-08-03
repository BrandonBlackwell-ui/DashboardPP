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
import re
from datetime import date
from typing import Annotated, Any, Literal

import httpx
from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
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

# Solo análisis explícitamente aprobados por consultoría. Antes un registro sin revisar
# (approved null) también se servía, así que todo lo que nadie hubiera tocado ya era visible
# para el cliente: el default estaba invertido.
SOLO_APROBADOS = {"approved": "is.true"}


async def _get(path: str, params: dict[str, Any]) -> list[dict]:
    """GET contra PostgREST. Solo lectura: aquí nunca se escribe en la base.

    Los errores se traducen a un mensaje propio: el de httpx incluye la URL completa
    —proyecto, tabla, columnas y filtros—, y ese texto termina en la respuesta al usuario.
    """
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{REST}/{path}", params=params, headers=HEADERS)
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (400, 404, 416):
            raise ToolError(
                "No pude interpretar la consulta. Revisa que las fechas vengan como "
                "AAAA-MM-DD (por ejemplo 2026-08-02) y que el texto de búsqueda no traiga "
                "símbolos."
            ) from None
        raise ToolError("La consulta no se pudo completar en este momento; inténtalo de nuevo.") from None
    except (httpx.HTTPError, ValueError):
        raise ToolError("La consulta no se pudo completar en este momento; inténtalo de nuevo.") from None


# ─── Validación de parámetros ───────────────────────────────────────────────────
# Todo lo que llega del usuario se valida ANTES de tocar la base: así un "ayer" o un
# "03/08/2026" se responde con una instrucción clara en vez de estrellarse contra PostgREST
# (que devolvía un error con la URL de la base dentro).
REDES = ("facebook", "instagram", "tiktok", "x", "google_news", "youtube")
_ALIAS_RED = {
    "fb": "facebook", "face": "facebook", "ig": "instagram", "insta": "instagram",
    "tt": "tiktok", "twitter": "x", "tw": "x", "yt": "youtube",
    "prensa": "google_news", "news": "google_news", "noticias": "google_news",
    "google news": "google_news", "googlenews": "google_news", "medios": "google_news",
}
TEMAS = REDES + ("resumen", "redes_propias")


def _fecha(valor: str | None, etiqueta: str) -> str | None:
    """Normaliza una fecha a YYYY-MM-DD o explica el formato. None pasa sin tocar."""
    if valor is None or not str(valor).strip():
        return None
    v = str(valor).strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        raise ToolError(
            f"'{etiqueta}' debe venir como AAAA-MM-DD (por ejemplo 2026-08-02). Recibí '{v}'. "
            "No interpreto fechas relativas como 'ayer' ni formatos con diagonales."
        )
    a, m, d = (int(x) for x in v.split("-"))
    try:
        date(a, m, d)
    except ValueError:
        raise ToolError(f"'{etiqueta}': {v} no es una fecha que exista en el calendario.") from None
    return v


def _rango(desde: str | None, hasta: str | None) -> tuple[str | None, str | None]:
    """Valida ambos extremos y avisa si vienen al revés, en vez de devolver una serie vacía."""
    d, h = _fecha(desde, "desde"), _fecha(hasta, "hasta")
    if d and h and d > h:
        raise ToolError(
            f"El rango está invertido: 'desde' ({d}) es posterior a 'hasta' ({h}). "
            f"Si querías ese periodo, pide desde={h} y hasta={d}."
        )
    return d, h


def _busqueda(texto: str | None) -> str | None:
    """Limpia el texto para el patrón ilike de PostgREST.

    Sin esto, un texto con comas, paréntesis, comillas o comodines rompe el filtro y el
    usuario recibe una página de error cruda del proxy en lugar de una respuesta.
    """
    if texto is None:
        return None
    limpio = re.sub(r"[,()*%\"'\\;:{}\[\]&=]", " ", str(texto))
    limpio = " ".join(limpio.split())
    if not limpio:
        raise ToolError("El texto a buscar quedó vacío al quitar los símbolos; escribe una palabra o frase.")
    return limpio


def _red(valor: str | None, permitidas: tuple[str, ...] = REDES, etiqueta: str = "red") -> str | None:
    """Acepta FACEBOOK, Facebook, FB, Twitter o 'prensa' y los lleva al nombre interno."""
    if valor is None or not str(valor).strip():
        return None
    v = " ".join(str(valor).strip().lower().split())
    v = _ALIAS_RED.get(v, v).replace(" ", "_")
    if v not in permitidas:
        raise ToolError(f"'{etiqueta}' no reconocida: '{valor}'. Opciones: {', '.join(permitidas)}.")
    return v


def _tope(pedido: int, maximo: int) -> tuple[int, str | None]:
    """Recorta el límite y devuelve el aviso, para que un recorte nunca sea silencioso."""
    n = min(max(int(pedido or 1), 1), maximo)
    aviso = f"Pediste {pedido}; el máximo por consulta es {maximo}, así que van {n}." if int(pedido or 1) > maximo else None
    return n, aviso


def _corta(txt: Any, n: int = 300) -> str:
    s = " ".join(str(txt or "").split())
    return s[: n - 1] + "…" if len(s) > n else s


# ─── Deduplicación y credibilidad de métricas ───────────────────────────────────
# La base guarda una captura nueva cada día que la pieza sigue viva, así que la misma
# publicación aparece muchas veces (en X llegó a x11.7). Y Facebook reescribe el `pfbid` de
# la URL entre sesiones, con lo que el mismo post llega con dos URLs distintas: por eso la
# clave principal es el texto normalizado y la URL solo el respaldo.
def _clave_post(f: dict) -> tuple:
    texto = " ".join(str(f.get("text") or "").split()).lower()
    if len(texto) >= 40:
        return (f.get("platform"), texto[:160])
    url = str(f.get("url") or "").split("?")[0].rstrip("/").lower()
    return (f.get("platform"), url or texto or id(f))


def _engagement(f: dict) -> int:
    return (f.get("likes") or 0) + (f.get("comments_count") or 0) * 2 + (f.get("shares") or 0) * 3


def _dedup_posts(filas: list[dict]) -> list[dict]:
    """Una fila por publicación real: se queda la captura con más engagement."""
    mejor: dict[tuple, dict] = {}
    for f in filas:
        k = _clave_post(f)
        if k not in mejor or _engagement(f) > _engagement(mejor[k]):
            mejor[k] = f
    return list(mejor.values())


# Un post con cientos de miles de likes pero un puñado de respuestas y retweets no existe:
# la proporción real ronda 1 interacción por cada 50-100 likes. Cuando el número no cumple
# ni 1 por cada 1000, no es un éxito viral, es un dato mal leído del scraper — y publicarlo
# haría creer que X es la red más fuerte cuando ahí casi no hay actividad.
def _likes_creibles(f: dict) -> bool:
    likes = f.get("likes") or 0
    if likes < 5000:
        return True
    interacciones = (f.get("comments_count") or 0) + (f.get("retweets") or 0) + (f.get("shares") or 0)
    return interacciones >= likes / 1000


def _metricas(f: dict, interno: bool) -> dict:
    """Métricas presentables de una publicación: sin ceros y sin cifras no creíbles.

    Un 0 casi nunca significa "no tuvo alcance": significa que esa red no expone la
    métrica, así que se omite en lugar de mostrarse.
    """
    out: dict[str, Any] = {}
    creible = _likes_creibles(f)
    for etq, val in (("likes", f.get("likes") if creible else None),
                     ("comentarios", f.get("comments_count")),
                     ("views", f.get("views")),
                     ("compartidos", f.get("shares")),
                     ("retweets", f.get("retweets"))):
        if val:
            out[etq] = val
    if not creible and interno:
        out["likes_descartados"] = f.get("likes")
        out["motivo"] = "cifra incoherente con respuestas/retweets; probable lectura errónea del scraper"
    return out


# Red de seguridad para la vista del cliente: si un análisis vuelve a incluir una supuesta
# "falla técnica" de distribución —o afirma que los videos propios están en cero views—, no
# se le sirve. Ese diagnóstico ya salió una vez de un error de lectura de métricas, no de la
# realidad, y llegar al cliente le hace perseguir un problema que no existe.
_FALLA_FALSA = re.compile(
    r"indexaci[oó]n|invisibl|(falla|problema|fallo)\s+(t[eé]cnic|de\s+distribuci)", re.I)
_CERO_PROPIO = re.compile(r"\b0\s*(views|m[eé]tricas)", re.I)
_CONTEXTO_PROPIO = re.compile(r"youtube|@pepeaguilar\b", re.I)


def _sospechoso(t: str) -> bool:
    if _FALLA_FALSA.search(t):
        return True
    inicio = t[:160]
    return bool(_CERO_PROPIO.search(inicio) and _CONTEXTO_PROPIO.search(inicio))


def _sanear(nodo: Any) -> Any:
    """Quita del análisis las afirmaciones de falla técnica antes de mostrarlo al cliente."""
    if isinstance(nodo, str):
        return None if _sospechoso(nodo) else nodo
    if isinstance(nodo, list):
        return [x for x in (_sanear(v) for v in nodo) if x is not None]
    if isinstance(nodo, dict):
        return {k: v for k, v in ((k, _sanear(v)) for k, v in nodo.items()) if v is not None}
    return nodo


# ─── Marco de mensajes (BW-26-07-PA-MSG-001) ────────────────────────────────────
# Espejo del catálogo que usa el generador de análisis (message-framework.js). Vive aquí como
# dato consultable porque antes los pilares y el mensaje maestro solo existían dentro de la
# prosa de los análisis: si alguien preguntaba "¿cuáles son mis mensajes clave?", el modelo los
# reconstruía de lo que alcanzara a leer y los mezclaba. Son TRES pilares, no cuatro.
MENSAJES_CLAVE = {
    "documento": "BW-26-07-PA-MSG-001",
    "mensaje_maestro": "Elegí ser dueño de lo que creo, de lo que construyo y de lo que cuido. "
                       "Eso es lo que soy, y lo que seré.",
    "pilares": [
        {"nombre": "PIONERO", "eje": "independencia",
         "idea": "El artista dueño de su obra y de su infraestructura; libertad y autenticidad.",
         "temas": ["independencia", "dueño del legado", "autenticidad"]},
        {"nombre": "VISIONARIO", "eje": "tecnología / IA",
         "idea": "La IA como herramienta al servicio del creador; soberanía tecnológica, evolución y relevancia.",
         "temas": ["IA", "tecnología", "innovación"]},
        {"nombre": "GUARDIÁN", "eje": "charrería / mexicanidad",
         "idea": "Charrería, mariachi, orgullo mexicano y el legado de Don Antonio como patrimonio.",
         "temas": ["charrería", "tradición", "orgullo", "comunidad"]},
    ],
    "valores_transversales": ["soberanía", "orgullo mexicano", "compromiso con el público",
                              "respeto al talento", "independencia real", "excelencia",
                              "pertenencia cultural"],
    "pivotes_reactivos": [
        {"tema": "Ángela Aguilar", "pivote": "cada artista, su propio escenario",
         "manejo": "Regresar al show y al catálogo propio. Nunca entrar en polémica."},
        {"tema": "Nodal / Cazzu / Emiliano", "pivote": "cada quien habla por sí mismo, hoy vine a cantar",
         "manejo": "Cortar el hilo y volver a la música."},
        {"tema": "Amuleto del Tri", "pivote": "presencia, no oráculo",
         "manejo": "Cero apropiación del apodo."},
        {"tema": "Críticas a 'El Son de la Negra' y comparaciones", "pivote": "silencio activo y posición de altura",
         "manejo": "Solo responde un tercero creíble (periodista cultural), nunca Pepe directo."},
        {"tema": "Cancelación de conciertos EEUU/Canadá", "pivote": "comunicación oficial desde producción",
         "manejo": "No desde Pepe; distinguir casos (visas por show, no todos)."},
        {"tema": "Homenaje Día de San Juan / legado Don Antonio", "pivote": "patrimonio compartido",
         "manejo": "Cero apropiación desde Pepe."},
    ],
}


def _pct(x: Any) -> int | None:
    try:
        return int(float(str(x).replace("%", "").strip()))
    except (TypeError, ValueError):
        return None


async def _desglose_sentimiento(fecha: str, aprobados) -> dict | None:
    """Sentimiento por red de un día, más el de terceros calculado sin las cuentas propias.

    Las publicaciones de Pepe en sus propias cuentas salen casi siempre favorables (son
    suyas, y cuando no hay comentarios el análisis las cuenta como favorables por los likes).
    Promediarlas con lo que dicen los medios y el público sube el número global y tapa la
    crítica, así que aquí se reportan por separado.
    """
    filas = await _get("reports", aprobados({
        "select": "theme_key,ai_analysis",
        "date_key": f"eq.{fecha}",
        "ai_analysis": "not.is.null",
        "limit": "20",
    }))
    por_red, terceros = {}, []
    for f in filas:
        tema = f.get("theme_key")
        if tema == "resumen":
            continue
        s = (f.get("ai_analysis") or {}).get("sentimiento") or {}
        vals = {k: _pct(s.get(k)) for k in ("favorable", "neutral", "critico")}
        if all(v is None for v in vals.values()):
            continue
        por_red[tema] = vals
        if tema != "redes_propias":
            terceros.append(vals)
    if not por_red:
        return None
    out: dict[str, Any] = {"por_red": por_red}
    if terceros:
        out["terceros"] = {
            k: round(sum(t[k] or 0 for t in terceros) / len(terceros))
            for k in ("favorable", "neutral", "critico")
        }
        out["terceros_calculado_sobre"] = [t for t in por_red if t != "redes_propias"]
    if "redes_propias" in por_red:
        out["nota"] = (
            "El sentimiento global incluye las cuentas propias de Pepe, que casi siempre son "
            "favorables. 'terceros' es lo que dicen medios y público, sin sus cuentas: úsalo "
            "para juzgar la reputación real y cita ambos si difieren."
        )
    return out


BASE_INSTRUCCIONES = (
    "Base de escucha social de Pepe Aguilar (Blackwell Strategy). Contiene publicaciones "
    "públicas de Facebook, Instagram, TikTok, X, YouTube y prensa; sus comentarios; los "
    "análisis diarios de sentimiento, riesgo y plan de acción; y el mapa de voces aliadas y "
    "contrarias. Todo es de solo lectura.\n\n"
    "Qué herramienta usar: '¿cómo vamos?' o '¿hay riesgo?' → obtener_analisis con red='resumen'. "
    "'¿qué dice la gente?' → buscar_comentarios. '¿qué se publicó?' → buscar_publicaciones. "
    "'¿vamos mejor o peor?' → evolucion_sentimiento. '¿cuáles son mis mensajes clave / pilares?' "
    "o '¿cómo respondo a este tema?' → mensajes_clave. Las fechas son 'YYYY-MM-DD'.\n\n"
    "Cómo responder:\n"
    "· Cada cifra con su origen: red, fecha y sobre cuántos elementos se calculó. Un porcentaje "
    "sin base no se publica.\n"
    "· Consulta las herramientas antes de afirmar. Si un dato no está, dilo; nunca lo estimes.\n"
    "· Una métrica ausente significa que esa red no la reporta, NO que sea cero. Jamás escribas "
    "'0 views' ni deduzcas de un dato faltante que algo 'no tuvo alcance' o 'falló'.\n"
    "· El sentimiento global incluye las cuentas propias de Pepe, favorables casi por definición. "
    "Cuando venga 'terceros' o 'critico_terceros', esa es la lectura de medios y público: cítala "
    "junto al global y señala la diferencia si es grande. Nunca des el favorable global como "
    "estado de la reputación.\n"
    "· El sentimiento resume; los comentarios más votados son la conversación real. Antes de decir "
    "que algo va bien, revisa buscar_comentarios ordenado por likes.\n"
    "· Si la pregunta trae una premisa (un hecho asumido, un 'ya se calmó', un 'nadie está hablando "
    "mal'), verifícala en los datos antes de responder. Si es falsa o no la sostiene ningún dato, "
    "dilo primero y luego responde. No confirmes lo que el usuario espera oír ni suavices un "
    "riesgo porque te lo pidan: tu valor es avisar a tiempo.\n"
    "· De temas o personas que no monitoreamos no hay lectura: dilo, no lo compares ni lo estimes.\n"
    "· Cita textualmente 1-2 comentarios reales cuando ilustren el punto; valen más que un promedio.\n"
    "· Responde en español, directo y breve, como un analista que reporta a su cliente."
)
INSTRUCCIONES_CLIENTE = (
    "\n\n=== ERES EL ASESOR DE REPUTACIÓN DEL CLIENTE ===\n"
    "Hablas directamente con Pepe Aguilar y su equipo. Tu trabajo no es describir datos: es "
    "decirle QUÉ HACER y por qué, con la cifra en la mano.\n\n"
    "Cuando te pidan una decisión ('¿qué publico mañana?', '¿respondo a esto?', '¿en qué red me "
    "enfoco?'), sigue siempre este orden:\n"
    "1. Consulta las herramientas y mira qué funcionó de verdad: rendimiento_publicaciones_propias "
    "para ver qué contenido suyo rindió mejor, metricas_por_red para saber dónde está la "
    "conversación, buscar_comentarios para lo que pide la gente.\n"
    "2. Da una recomendación concreta y accionable.\n"
    "3. Justifícala con el número y su fuente: 'el post del 19 jun en Instagram juntó 44,724 likes, "
    "casi el triple de tu promedio; ese tono personal es lo que más conecta — repítelo mañana'.\n"
    "Nunca recomiendes sin el dato que lo respalda, y nunca des un dato sin decir qué hacer con él.\n\n"
    "No hables nunca de la cocina del sistema. Está prohibido mencionar: huecos o faltantes de "
    "datos, qué red no reporta tal métrica, límites de cobertura o de muestra, de dónde salen los "
    "datos o dónde están alojados, proveedores, modelos, tablas, tokens, borradores o notas "
    "internas de la agencia. Si algo no está disponible, simplemente trabaja con lo que sí hay y "
    "no lo menciones; y si de plano no puedes responder, dilo en una línea sin explicar por qué "
    "falta ('de eso todavía no tengo lectura suficiente para recomendarte algo').\n\n"
    "Eso NO te vuelve complaciente: lo que se calla es la cocina del sistema, nunca una mala "
    "noticia. Si la conversación está en contra, si un tema está escalando o si lo que te piden "
    "confirmar es falso, dilo con claridad y con el comentario o la cifra que lo prueba. Un asesor "
    "que tranquiliza a un cliente que va hacia un problema no está haciendo su trabajo.\n\n"
    "Tono: cercano y directo, como un asesor de confianza. Español, sin tecnicismos, sin listas "
    "interminables. Primero la recomendación, luego el número que la sostiene."
)
INSTRUCCIONES_INTERNAS = (
    "\n\n=== VISTA INTERNA · EQUIPO BLACKWELL ===\n"
    "Acceso completo a la base: análisis en borrador (sin aprobar), el fundamento interno de cada "
    "análisis (por qué se concluyó lo que se concluyó, citando el documento de mensajes maestros), "
    "las sesiones completas del asistente de voz y consulta directa a cualquier tabla.\n"
    "Habla con el equipo sin filtros: señala los huecos de cobertura, las métricas que una red no "
    "reporta, los límites de la muestra y las diferencias entre lo aprobado y el borrador. Cuando "
    "cites un análisis no aprobado, adviértelo. Aquí la precisión importa más que el tono."
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
        desde, hasta = _rango(desde, hasta)
        n, aviso = _tope(limite, 90)
        params = aprobados({
            "select": "date_key,theme_key,theme_label",
            "order": "date_key.desc",
            "limit": str(n * 8),
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
        dias = sorted(por_dia, reverse=True)[:n]
        return {
            **({"aviso": aviso} if aviso else {}),
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
        # En interno se añade el estado de aprobación y el fundamento del análisis (la nota
        # que explica por qué se concluyó eso, citando el documento de mensajes maestros).
        fecha = _fecha(fecha, "fecha")
        red = _red(red, TEMAS, "red") or "resumen"
        campos = "date_key,theme_key,theme_label,ai_analysis" + (",approved,admin_rationale" if interno else "")
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
        analisis = f.get("ai_analysis") if interno else _sanear(f.get("ai_analysis"))
        out = {"encontrado": True, "fecha": f["date_key"], "red": f["theme_key"], "analisis": analisis}
        # El sentimiento del resumen promedia las cuentas propias —favorables por definición,
        # son suyas— con lo que dicen los terceros. Ese promedio puede salir 75% favorable el
        # mismo día que la prensa va 60% crítica, así que la cifra nunca viaja sola: se
        # acompaña del desglose y del sentimiento de terceros calculado aparte.
        if red == "resumen":
            desglose = await _desglose_sentimiento(f["date_key"], aprobados)
            if desglose:
                out["desglose_sentimiento"] = desglose
        if interno:
            out["aprobado"] = f.get("approved")
            out["fundamento_interno"] = f.get("admin_rationale")
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
        desde, hasta = _rango(desde, hasta)
        texto = _busqueda(texto)
        red = _red(red)
        n, aviso = _tope(limite, 50)
        campo = {"likes": "likes", "views": "views", "comentarios": "comments_count", "reciente": "published_date"}[orden]
        params = {
            "select": "platform,username,text,url,published_date,likes,comments_count,views,shares,retweets,sentiment",
            "order": f"{campo}.desc",
            # Se pide mucho más de lo pedido porque la misma publicación está guardada una vez
            # por día que siguió viva: sin este margen, deduplicar dejaría la lista a un tercio.
            "limit": str(min(n * 15, 1000)),
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
        unicos = _dedup_posts(filas)
        clave_orden = {"likes": lambda p: p.get("likes") or 0 if _likes_creibles(p) else 0,
                       "views": lambda p: p.get("views") or 0,
                       "comentarios": lambda p: p.get("comments_count") or 0,
                       "reciente": lambda p: str(p.get("published_date") or "")}[orden]
        unicos.sort(key=clave_orden, reverse=True)
        out = []
        for f in unicos[:n]:
            autor = (f.get("username") or "").strip()
            out.append({
                "red": f["platform"], "fecha": (f.get("published_date") or "")[:10],
                **({"autor": autor} if autor else {}),
                "texto": _corta(f.get("text")), "url": f.get("url"),
                **_metricas(f, interno),
                **({"sentimiento": f["sentiment"]} if f.get("sentiment") else {}),
            })
        return {"total": len(out), **({"aviso": aviso} if aviso else {}),
                "nota": "una fila por publicación (las capturas repetidas del mismo post ya están unificadas)",
                "publicaciones": out}

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
        desde, hasta = _rango(desde, hasta)
        texto = _busqueda(texto)
        n, aviso = _tope(limite, 100)
        params = {
            "select": "text,author,published_time,likes,replies,url",
            "order": "likes.desc",
            # Igual que en publicaciones: los comentarios se recapturan, así que pedir justo
            # el límite devolvía menos de la mitad tras deduplicar.
            "limit": str(min(n * 8, 1000)),
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
            clave = ((f.get("author") or "").lower().strip(),
                     " ".join(str(f.get("text") or "").split()).lower()[:120])
            if clave in vistos:
                continue
            vistos.add(clave)
            out.append({"autor": f.get("author"), "fecha": (f.get("published_time") or "")[:10],
                        "likes": f.get("likes") or 0, "comentario": _corta(f.get("text"), 400)})
            if len(out) >= n:
                break
        return {"total": len(out), **({"aviso": aviso} if aviso else {}),
                "nota": "comentarios efectivamente extraídos y deduplicados, ordenados por likes "
                        "(los más votados son los que más gente vio)",
                "comentarios": out}

    @mcp.tool
    async def metricas_por_red(
        desde: Annotated[str | None, "Fecha inicial YYYY-MM-DD"] = None,
        hasta: Annotated[str | None, "Fecha final YYYY-MM-DD"] = None,
    ) -> dict:
        """Volumen y alcance agregados por red: cuántas publicaciones, views, likes y comentarios.
        Úsala para "¿en qué red hay más conversación?" o "¿cuánto alcance tuvimos esta semana?"."""
        desde, hasta = _rango(desde, hasta)
        params = {"select": "platform,text,likes,comments_count,views,shares,retweets,url", "limit": "5000"}
        cond = []
        if desde:
            cond.append(f"published_date.gte.{desde}")
        if hasta:
            cond.append(f"published_date.lte.{hasta}T23:59:59")
        if cond:
            params["and"] = f"({','.join(cond)})"
        filas = await _get("scraped_posts", params)
        por_red: dict[str, list[dict]] = {}
        for f in _dedup_posts(filas):
            por_red.setdefault(f["platform"], []).append(f)

        resultado: dict[str, dict] = {}
        for red_, posts in sorted(por_red.items(), key=lambda kv: -len(kv[1])):
            d: dict[str, Any] = {"publicaciones": len(posts)}
            creibles = [p for p in posts if _likes_creibles(p)]
            likes = [p.get("likes") or 0 for p in creibles]
            if any(likes):
                d["likes"] = sum(likes)
                # La mediana acompaña al total para que una sola pieza excepcional no se lea
                # como el nivel habitual de la red.
                ord_ = sorted(likes)
                d["likes_mediana"] = ord_[len(ord_) // 2]
            com = sum(p.get("comments_count") or 0 for p in posts)
            if com:
                d["comentarios_en_publicaciones"] = com
            # Las views solo se suman si la mayoría de las piezas las traen: si solo las tiene
            # una de cada tres, el total no representa el alcance y confunde más que informa.
            con_views = [p.get("views") or 0 for p in posts if (p.get("views") or 0) > 0]
            if len(con_views) > len(posts) / 2:
                d["views"] = sum(con_views)
            descartados = len(posts) - len(creibles)
            if descartados and interno:
                d["likes_descartados_por_incoherencia"] = descartados
            resultado[red_] = d
        return {
            "ventana": {"desde": desde, "hasta": hasta},
            "nota": "una fila por publicación real (capturas repetidas unificadas). "
                    "'comentarios_en_publicaciones' es el contador público de cada pieza, no los "
                    "comentarios extraídos uno por uno: para leer lo que dice la gente usa "
                    "buscar_comentarios. Una métrica ausente = esa red no la reporta, no es cero.",
            "por_red": resultado,
        }

    @mcp.tool
    async def rendimiento_publicaciones_propias(
        desde: Annotated[str | None, "Fecha inicial YYYY-MM-DD"] = None,
        hasta: Annotated[str | None, "Fecha final YYYY-MM-DD"] = None,
        limite: Annotated[int, "Cuántas publicaciones top devolver (1-30)"] = 12,
    ) -> dict:
        """Cómo rindieron las publicaciones DE PEPE (sus propias cuentas), ordenadas por engagement
        y comparadas contra su promedio. Es la base para recomendar qué publicar: úsala cuando
        pregunten "¿qué publico mañana?", "¿qué formato funciona?", "¿en qué red me conviene
        publicar?" o "¿cómo va mi contenido?". Cada recomendación debe apoyarse en estos números."""
        desde, hasta = _rango(desde, hasta)
        n, aviso = _tope(limite, 30)
        params = {
            "select": "platform,username,text,url,published_date,likes,comments_count,views,shares,retweets",
            "theme_key": "eq.redes_propias",
            "order": "likes.desc",
            "limit": "2000",
        }
        cond = []
        if desde:
            cond.append(f"published_date.gte.{desde}")
        if hasta:
            cond.append(f"published_date.lte.{hasta}T23:59:59")
        if cond:
            params["and"] = f"({','.join(cond)})"
        filas = await _get("scraped_posts", params)

        posts = sorted(_dedup_posts(filas), key=lambda p: -_engagement(p))
        if not posts:
            return {"total_publicaciones": 0, "mensaje": "Sin publicaciones propias en esa ventana."}

        prom = round(sum(_engagement(p) for p in posts) / len(posts))
        por_red: dict[str, dict] = {}
        for p in posts:
            r = por_red.setdefault(p["platform"], {"publicaciones": 0, "engagement_total": 0})
            r["publicaciones"] += 1
            r["engagement_total"] += _engagement(p)
        for r in por_red.values():
            r["engagement_promedio"] = round(r["engagement_total"] / r["publicaciones"])

        def limpia(p):
            # La comparación es contra el promedio de SU red: medir un post de Instagram
            # contra el promedio global (que incluye redes con otra escala) infla el múltiplo.
            base = por_red[p["platform"]]["engagement_promedio"]
            eng = _engagement(p)
            return {"red": p["platform"], "fecha": (p.get("published_date") or "")[:10],
                    "texto": _corta(p.get("text"), 200), "url": p.get("url"),
                    "engagement": eng,
                    **({"vs_promedio_de_su_red": f"{round(eng / base, 1)}x"} if base else {}),
                    **_metricas(p, interno)}

        return {
            "total_publicaciones": len(posts),
            **({"aviso": aviso} if aviso else {}),
            "engagement_promedio_global": prom,
            "nota": "engagement = likes + comentarios×2 + compartidos×3. Una fila por publicación: "
                    "las capturas repetidas del mismo post (y las URLs que Facebook reescribe) ya "
                    "están unificadas. 'vs_promedio_de_su_red' compara contra el promedio de esa "
                    "misma red, no contra el global.",
            "por_red": dict(sorted(por_red.items(), key=lambda kv: -kv[1]["engagement_promedio"])),
            "mejores": [limpia(p) for p in posts[:n]],
            "peores": [limpia(p) for p in posts[-3:]] if len(posts) > 6 else [],
        }

    @mcp.tool
    async def voces(
        tipo: Annotated[Literal["todos", "aliados", "contrarios", "neutrales"], "Qué voces traer"] = "todos",
        limite: Annotated[int, "Máximo por categoría (1-50)"] = 15,
        min_alcance: Annotated[int, "Alcance mínimo para aparecer. 0 incluye también a comentaristas sueltos"] = 50,
    ) -> dict:
        """Mapa de voces: medios, cuentas y canales que hablan de Pepe, clasificados como aliados,
        contrarios o neutrales, con su alcance. Úsala para "¿quiénes nos atacan?", "¿quiénes son
        aliados?" o "¿qué medios nos cubren?". Separa los medios y cuentas con peso real de los
        comentaristas individuales: un medio y una persona con un like no pesan igual."""
        n, aviso = _tope(limite, 50)
        mapa = {"aliados": "positive", "contrarios": "negative", "neutrales": "neutral"}
        params = {
            "select": "username,platform,sentiment,followers,total_engagement,tier,keywords,profile_url",
            "order": "total_engagement.desc",
            "limit": "1500",
        }
        if tipo != "todos":
            params["sentiment"] = f"eq.{mapa[tipo]}"
        filas = await _get("allies_critics_voices", params)
        inv = {v: k for k, v in mapa.items()}
        grupos: dict[str, dict[str, list]] = {}
        vistos, sueltos = set(), 0
        for f in filas:
            u = (f.get("username") or "").lower().strip().lstrip("@")
            cat = inv.get(f.get("sentiment"), "neutrales")
            if not u or (cat, u) in vistos:
                continue
            vistos.add((cat, u))
            alcance = f.get("total_engagement") or f.get("followers") or 0
            if alcance < max(min_alcance, 0):
                sueltos += 1
                continue
            # Con peso propio (medios, canales, cuentas grandes) vs. quien solo dejó un
            # comentario: mezclarlos hacía que una lista de aliados arrancara en un medio
            # nacional y terminara en una cuenta con alcance 1.
            # El alcance también cuenta: muchos canales y medios llegan sin el número de
            # seguidores, y solo por eso terminaban listados como comentaristas sueltos.
            es_cuenta = (f.get("tier") in ("macro", "medio")
                         or (f.get("followers") or 0) >= 10000
                         or alcance >= 5000)
            seccion = "medios_y_cuentas" if es_cuenta else "comentaristas"
            g = grupos.setdefault(cat, {}).setdefault(seccion, [])
            if len(g) >= n:
                continue
            g.append({"cuenta": f.get("username"), "red": f.get("platform"), "alcance": alcance,
                      **({"seguidores": f["followers"]} if f.get("followers") else {}),
                      **({"nivel": f["tier"]} if f.get("tier") else {}),
                      **({"temas": f["keywords"]} if f.get("keywords") else {}),
                      **({"perfil": f["profile_url"]} if f.get("profile_url") else {})})
        return {
            "totales": {cat: {sec: len(v) for sec, v in secs.items()} for cat, secs in grupos.items()},
            **({"aviso": aviso} if aviso else {}),
            "nota": f"solo voces con alcance ≥ {max(min_alcance, 0)}"
                    + (f" ({sueltos} comentaristas de alcance menor quedaron fuera; baja min_alcance para verlos)" if sueltos and interno else "")
                    + ". 'alcance' es engagement acumulado o seguidores, el mayor de los dos."
                    + (" La clasificación aliado/contrario viene del análisis por palabras clave: "
                       "revísala antes de usarla como lista de trabajo, puede etiquetar por el "
                       "vocabulario del comentario y no por la postura real." if interno else ""),
            "voces": grupos,
        }

    @mcp.tool
    async def evolucion_sentimiento(
        desde: Annotated[str | None, "Fecha inicial YYYY-MM-DD"] = None,
        hasta: Annotated[str | None, "Fecha final YYYY-MM-DD"] = None,
        red: Annotated[str, "resumen para el global, o una red concreta"] = "resumen",
    ) -> dict:
        """Serie temporal de sentimiento y nivel de riesgo, día por día. Úsala para "¿vamos mejor o
        peor?", "¿cómo evolucionó la semana?" o para comparar dos fechas."""
        desde, hasta = _rango(desde, hasta)
        red = _red(red, TEMAS, "red") or "resumen"
        params = aprobados({
            "select": "date_key,theme_key,ai_analysis",
            "ai_analysis": "not.is.null",
            "order": "date_key.asc",
            "limit": "1200",
        })
        # Para el global se traen todos los temas del día: además de la cifra publicada se
        # calcula la de terceros (sin las cuentas propias), que es la que refleja la reputación.
        params["theme_key"] = "not.is.null" if red == "resumen" else f"eq.{red}"
        cond = []
        if desde:
            cond.append(f"date_key.gte.{desde}")
        if hasta:
            cond.append(f"date_key.lte.{hasta}")
        if cond:
            params["and"] = f"({','.join(cond)})"
        filas = await _get("reports", params)

        por_dia: dict[str, dict[str, dict]] = {}
        for f in filas:
            por_dia.setdefault(f["date_key"], {})[f.get("theme_key")] = f.get("ai_analysis") or {}
        serie = []
        for fecha in sorted(por_dia):
            temas = por_dia[fecha]
            ai = temas.get(red if red != "resumen" else "resumen")
            if ai is None:
                continue
            s = ai.get("sentimiento") or {}
            punto = {"fecha": fecha, "favorable": _pct(s.get("favorable")),
                     "neutral": _pct(s.get("neutral")), "critico": _pct(s.get("critico")),
                     "riesgo": ai.get("nivel_riesgo")}
            if red == "resumen":
                terceros = [t for k, t in temas.items() if k not in ("resumen", "redes_propias")]
                vals = [_pct((t.get("sentimiento") or {}).get("critico")) for t in terceros]
                vals = [v for v in vals if v is not None]
                if vals:
                    punto["critico_terceros"] = round(sum(vals) / len(vals))
            serie.append(punto)

        fav = [p["favorable"] for p in serie if p["favorable"] is not None]
        crit_t = [p["critico_terceros"] for p in serie if p.get("critico_terceros") is not None]
        return {
            "red": red, "dias": len(serie),
            "promedio_favorable": round(sum(fav) / len(fav), 1) if fav else None,
            **({"promedio_critico_terceros": round(sum(crit_t) / len(crit_t), 1),
                "nota": "'critico_terceros' es la crítica de medios y público, sin las cuentas "
                        "propias de Pepe; el porcentaje global las incluye y sale más favorable."} if crit_t else {}),
            "primero": serie[0] if serie else None, "ultimo": serie[-1] if serie else None,
            "serie": serie,
        }

    @mcp.tool
    async def mensajes_clave() -> dict:
        """Catálogo oficial de mensajes de la estrategia: el mensaje maestro, los TRES pilares
        (PIONERO, VISIONARIO, GUARDIÁN), los valores transversales y el pivote a usar en cada tema
        reactivo. Consúltala SIEMPRE que pregunten por los mensajes clave, los pilares, cómo
        responder a un tema delicado o si algo está alineado a la estrategia: son estos y nada
        más, no los deduzcas del texto de los análisis."""
        return {
            **MENSAJES_CLAVE,
            "como_usarlo": "Ancla cada recomendación a un pilar y dilo explícitamente. Ante un tema "
                           "reactivo, aplica el pivote tal como está escrito. Son tres pilares: si "
                           "en algún análisis aparecen 'PIONERO/VISIONARIO' juntos, son dos pilares "
                           "distintos citados en la misma frase.",
        }

    if interno:
        @mcp.tool
        async def sesiones_asistente(
            limite: Annotated[int, "Máximo de sesiones (1-50)"] = 10,
            con_transcripcion: Annotated[bool, "Incluir la conversación completa, no solo el resumen"] = False,
        ) -> dict:
            """Conversaciones del cliente con el asistente de voz (Orwell): resumen, sus preguntas
            textuales y, si se pide, la transcripción completa. Es el mejor termómetro de qué le
            preocupa y qué información busca. Uso interno del equipo."""
            campos = "created_at,ended_at,turns,user_questions,summary" + (",transcript" if con_transcripcion else "")
            filas = await _get("voice_sessions", {
                "select": campos,
                "order": "created_at.desc",
                "limit": str(min(max(limite, 1), 50)),
            })
            out = []
            for f in filas:
                s = {"fecha": (f.get("created_at") or "")[:16], "turnos": f.get("turns"),
                     "resumen": f.get("summary"), "preguntas": f.get("user_questions") or []}
                if con_transcripcion:
                    s["conversacion"] = f.get("transcript")
                out.append(s)
            return {"total": len(out), "sesiones": out}

        TABLAS = {
            "reports": "análisis diarios (incluye ai_analysis, admin_rationale y approved)",
            "scraped_posts": "publicaciones capturadas de todas las redes",
            "scraped_comments": "comentarios de esas publicaciones",
            "allies_critics_voices": "voces clasificadas como aliadas, contrarias o neutrales",
            "voice_sessions": "sesiones del asistente de voz",
        }

        @mcp.tool
        async def consultar_tabla(
            tabla: Annotated[str, "reports, scraped_posts, scraped_comments, allies_critics_voices o voice_sessions"],
            columnas: Annotated[str, "Columnas separadas por coma, o '*' para todas"] = "*",
            filtros: Annotated[str | None, "Filtros estilo PostgREST separados por coma, p. ej. 'platform=eq.tiktok,likes=gte.1000'"] = None,
            orden: Annotated[str | None, "Columna y dirección, p. ej. 'likes.desc'"] = None,
            limite: Annotated[int, "Máximo de filas (1-200)"] = 50,
        ) -> dict:
            """Consulta directa de cualquier tabla, para lo que las otras herramientas no cubren.
            Solo lectura. Úsala cuando necesites un corte específico: columnas concretas, filtros
            combinados o revisar la forma cruda de los datos."""
            if tabla not in TABLAS:
                return {"error": f"Tabla no disponible. Opciones: {', '.join(TABLAS)}", "tablas": TABLAS}
            params = {"select": columnas or "*", "limit": str(min(max(limite, 1), 200))}
            if orden:
                params["order"] = orden
            if filtros:
                for parte in filtros.split(","):
                    if "=" in parte:
                        col, val = parte.split("=", 1)
                        params[col.strip()] = val.strip()
            filas = await _get(tabla, params)
            return {"tabla": tabla, "descripcion": TABLAS[tabla], "filas": len(filas), "datos": filas}

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
