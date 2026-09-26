// =====================================================================
// EscribAI — evento
// Recoge un evento anónimo de uso. No guarda IP, ni identificador de
// usuario, ni nada que permita reconstruir quién hizo qué: solo el
// nombre del evento, la página, el dominio de procedencia y si el
// dispositivo era móvil o de escritorio.
//
// Por eso no hace falta banner de cookies: no se lee ni se escribe
// nada en el navegador del visitante.
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
]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const limpio = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max).replace(/[\u0000-\u001f]/g, "") : null;

Deno.serve(async (req) => {
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
    await supa.from("eventos").insert({
      evento,
      pagina: limpio(body.pagina, 60),
      origen,
      disp: body.disp === "movil" ? "movil" : "escritorio",
    });
    return ok();
  } catch (e) {
    console.error("evento:", e);
    return ok();
  }
});
