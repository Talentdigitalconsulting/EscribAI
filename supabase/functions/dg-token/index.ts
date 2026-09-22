// =====================================================================
// EscribAI — dg-token
// Entrega al cliente un token temporal de Deepgram (10 min) si su plan
// lo permite y le queda cuota del mes. El audio NUNCA pasa por aquí:
// va directo del navegador a Deepgram con ese token efímero.
//
// Acciones (body JSON):
//   { "accion": "token" }                  -> { access_token, expires_in, restante_min, cuota_min }
//   { "accion": "uso", "segundos": 1234 }  -> { ok: true, restante_min }
//   { "accion": "saldo" }                  -> { restante_min, cuota_min, usados_min }
//
// Secretos necesarios: DEEPGRAM_API_KEY (+ los SUPABASE_* que ya existen)
// Verify JWT: puede quedar ACTIVADO en esta función (el cliente va autenticado).
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const CUOTA_MIN: Record<string, number> = {
  demo: 0,
  pro_mes: 600,     // 10 horas al mes
  pro_anyo: 600,    // 10 horas al mes
  empresas: 3000,   // 50 horas al mes
};

const TTL_SEGUNDOS = 600; // 10 minutos: suficiente para subir una junta larga

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth) return json({ error: "sin_sesion" }, 401);

    // 1) Identificar al usuario con su propio token
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return json({ error: "sin_sesion" }, 401);

    // 2) Leer su plan con permisos de servicio
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: perfil } = await admin
      .from("perfiles")
      .select("plan, plan_hasta")
      .eq("id", user.id)
      .maybeSingle();

    const plan = perfil?.plan ?? "demo";
    const vigente = !perfil?.plan_hasta || new Date(perfil.plan_hasta) > new Date();
    const cuota = (vigente ? CUOTA_MIN[plan] : 0) ?? 0;

    // 3) Consumo del mes en curso
    const inicioMes = new Date();
    inicioMes.setUTCDate(1);
    inicioMes.setUTCHours(0, 0, 0, 0);
    const { data: filas } = await admin
      .from("uso_transcripcion")
      .select("segundos")
      .eq("user_id", user.id)
      .gte("creado", inicioMes.toISOString());
    const usadosSeg = (filas ?? []).reduce((s, f) => s + (f.segundos ?? 0), 0);
    const usadosMin = Math.ceil(usadosSeg / 60);
    const restante = Math.max(0, cuota - usadosMin);

    const body = await req.json().catch(() => ({}));
    const accion = body.accion ?? "token";

    if (accion === "saldo") {
      return json({ plan, cuota_min: cuota, usados_min: usadosMin, restante_min: restante });
    }

    // 4) Registrar consumo declarado por el cliente
    if (accion === "uso") {
      const seg = Math.max(0, Math.min(Number(body.segundos) || 0, 6 * 3600));
      if (seg > 0) {
        await admin.from("uso_transcripcion").insert({
          user_id: user.id,
          email: user.email,
          segundos: Math.round(seg),
          origen: String(body.origen ?? "").slice(0, 20) || null,
        });
      }
      return json({ ok: true, restante_min: Math.max(0, cuota - Math.ceil((usadosSeg + seg) / 60)) });
    }

    // 5) Entregar token temporal
    if (cuota <= 0) return json({ error: "plan_insuficiente", plan }, 403);
    if (restante <= 0) return json({ error: "cuota_agotada", cuota_min: cuota, usados_min: usadosMin }, 429);

    const dg = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: "Token " + Deno.env.get("DEEPGRAM_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: TTL_SEGUNDOS }),
    });
    if (!dg.ok) {
      console.error("deepgram grant:", dg.status, (await dg.text()).slice(0, 200));
      return json({ error: "deepgram_no_disponible" }, 502);
    }
    const t = await dg.json();

    return json({
      access_token: t.access_token,
      expires_in: t.expires_in ?? TTL_SEGUNDOS,
      restante_min: restante,
      cuota_min: cuota,
    });
  } catch (e) {
    console.error("dg-token:", e);
    return json({ error: "error_interno" }, 500);
  }
});
