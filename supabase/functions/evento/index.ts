// =====================================================================
// ConsteAi — evento
// Recoge un evento anónimo de uso. No guarda IP, ni identificador de
// usuario, ni nada que permita reconstruir quién hizo qué: solo el
// nombre del evento, la página, el dominio de procedencia y si el
// dispositivo era móvil o de escritorio.
//
// Por eso no hace falta banner de cookies: no se lee ni se escribe
// nada en el navegador del visitante.
//
// También recibe los errores no controlados de la app ("error"), con
// el mensaje recortado y sin datos personales, para enterarnos de que
// algo falla antes de que lo cuente un cliente.
//
// Límite: como no guardamos IP no podemos limitar por visitante, así
// que limitamos en global: si en el último minuto ya hay más de
// TOPE_MINUTO filas, se descarta. Protege la cuota de la base de datos
// ante un bucle o un bot sin tocar la privacidad.
//
// Verify JWT: DESACTIVADO (lo llaman visitantes sin cuenta).
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const EVENTOS_VALIDOS = new Set([
  "visita",          // alguien abre la landing o la app
  "clic_probar",     // pulsa el botón de probar desde la landing
  "prueba_inicio",   // arranca la prueba de 5 minutos
  "prueba_fin",      // agota la prueba
  "registro",        // crea una cuenta
  "clic_plan",       // pulsa "Suscribirme" en un plan
  "acta_regalo",     // un usuario gratuito usa su acta con IA de regalo
  "error",           // error no controlado en el navegador
]);

const TOPE_MINUTO = 240;
const ORIGENES = [
  "https://talentdigitalconsulting.github.io",
  "https://consteai.es",
  "https://www.consteai.es",
];

function cabeceras(req: Request) {
  const o = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGENES.includes(o) ? o : ORIGENES[0],
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const limpio = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max).replace(/[\u0000-\u001f]/g, "") : null;

/* Quita de un mensaje de error cualquier cosa que parezca un dato
   personal antes de guardarlo. */
function sinDatos(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[correo]")
    .replace(/\b(?:\+34[\s-]?)?[6-9]\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}\b/g, "[tel]")
    .replace(/\b\d{7,8}\s?-?[A-Za-z]\b/g, "[doc]")
    .replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g, "[token]");
}

Deno.serve(async (req) => {
  const cors = cabeceras(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Responde 204 siempre: la analítica nunca debe romper ni ralentizar la web.
  const ok = () => new Response(null, { status: 204, headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const evento = limpio(body.evento, 40);
    if (!evento || !EVENTOS_VALIDOS.has(evento)) return ok();

    // Del referente guardamos solo el dominio, nunca la ruta completa.
    let origen: string | null = null;
    const ref = limpio(body.origen, 300);
    if (ref) {
      try { origen = new URL(ref).hostname.slice(0, 80); } catch (_e) { origen = null; }
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const haceUnMinuto = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supa
      .from("eventos")
      .select("id", { count: "exact", head: true })
      .gte("creado", haceUnMinuto);
    if ((count ?? 0) >= TOPE_MINUTO) return ok();

    let pagina = limpio(body.pagina, 60);
    if (evento === "error") {
      // El mensaje va en "pagina": sitio + ":" + mensaje recortado y limpio.
      const msg = sinDatos(limpio(body.detalle, 200) ?? "");
      pagina = ((pagina ?? "?") + ": " + msg).slice(0, 240);
    }

    await supa.from("eventos").insert({
      evento,
      pagina,
      origen,
      disp: body.disp === "movil" ? "movil" : "escritorio",
    });
    return ok();
  } catch (e) {
    console.error("evento:", e);
    return ok();
  }
});
