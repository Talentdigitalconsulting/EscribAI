// =====================================================================
// EscribAI — ping
// Endpoint público que toca la base de datos para que Supabase no
// considere el proyecto inactivo y lo pause (plan gratuito).
// Un servicio de monitorización (UptimeRobot, cron-job.org...) lo llama
// cada 15 minutos. No devuelve ningún dato: solo "ok".
//
// Verify JWT: DESACTIVADO (tiene que poder llamarse sin sesión).
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async () => {
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Consulta mínima: solo cuenta filas, no devuelve contenido.
    const { error } = await supa.from("perfiles").select("id", { count: "exact", head: true });
    if (error) {
      console.error("ping:", error.message);
      return new Response("error", { status: 500 });
    }
    return new Response("ok", {
      status: 200,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("ping:", e);
    return new Response("error", { status: 500 });
  }
});
