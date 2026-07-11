// EscribAI — Eliminación de cuenta (requisito de Google Play)
// El usuario autenticado borra su propia cuenta y todos sus datos (cascada en perfiles, datos_usuario, actas, suscripciones no — es histórico de facturación).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user }, error } = await anon.auth.getUser(token);
  if (error || !user) return new Response("no autorizado", { status: 401, headers: cors });
  const { error: e2 } = await admin.auth.admin.deleteUser(user.id);
  if (e2) return new Response("error: " + e2.message, { status: 500, headers: cors });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
