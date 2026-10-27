// ConsteAi — Eliminación de cuenta (requisito de Google Play)
// El usuario autenticado borra su propia cuenta y todos sus datos (cascada en perfiles, datos_usuario, actas, suscripciones no — es histórico de facturación).
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGENES = [
  "https://talentdigitalconsulting.github.io",
  "https://consteai.es",
  "https://www.consteai.es",
];
function cabeceras(req: Request) {
  const o = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGENES.includes(o) ? o : ORIGENES[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
let cors: Record<string, string> = cabeceras(new Request("https://x"));
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

Deno.serve(async (req) => {
  cors = cabeceras(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user }, error } = await anon.auth.getUser(token);
  if (error || !user) return new Response("no autorizado", { status: 401, headers: cors });
  const { error: e2 } = await admin.auth.admin.deleteUser(user.id);
  if (e2) return new Response("error: " + e2.message, { status: 500, headers: cors });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
