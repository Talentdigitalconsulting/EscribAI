// =====================================================================
// ConsteAi — despacho
// Gestión del plan Despacho: crear el despacho, invitar compañeros,
// aceptar invitaciones, expulsar, salir y consultar el estado.
//
// Acciones (body JSON):
//   { accion:"estado" }                       -> despacho, miembros, invitaciones, horas
//   { accion:"crear",    nombre:"..." }       -> crea el despacho (sin pagar aún) con el usuario como admin
//   { accion:"renombrar",nombre:"..." }       -> solo admin
//   { accion:"invitar",  email:"..." }        -> solo admin; devuelve el enlace de invitación
//   { accion:"revocar",  id:"..." }           -> solo admin; anula una invitación pendiente
//   { accion:"aceptar",  token:"..." }        -> el invitado se une
//   { accion:"expulsar", user_id:"..." }      -> solo admin; no al propietario
//   { accion:"salir" }                        -> cualquier miembro salvo el propietario
//
// Las invitaciones son un enlace con token aleatorio de un solo uso que
// caduca a los 7 días. El cliente no lee nunca la tabla de invitaciones.
//
// Verify JWT: ACTIVADO.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const DIAS_INVITACION = 7;
const MINUTOS_POR_ASIENTO = 480;   // 8 horas
const APP_URL = "https://talentdigitalconsulting.github.io/EscribAI/index.html";

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
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function tokenAleatorio(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  cors = cabeceras(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth) return json({ error: "sin_sesion" }, 401);
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return json({ error: "sin_sesion" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const accion = String(body.accion || "estado");

    // Mi pertenencia actual (una persona, como mucho un despacho).
    const { data: mio } = await admin
      .from("miembros").select("despacho_id, rol").eq("user_id", user.id).maybeSingle();

    // ---------------------------------------------------------- aceptar
    if (accion === "aceptar") {
      const token = String(body.token || "").trim();
      if (!token) return json({ error: "sin_token" }, 400);
      const { data: inv } = await admin
        .from("invitaciones").select("*").eq("token", token).maybeSingle();
      if (!inv || inv.usado) return json({ error: "invitacion_invalida" }, 404);
      if (new Date(inv.caduca) < new Date()) return json({ error: "invitacion_caducada" }, 410);
      if (mio && mio.despacho_id !== inv.despacho_id) return json({ error: "ya_en_otro_despacho" }, 409);
      if (!mio) {
        const { count } = await admin.from("miembros").select("*", { count: "exact", head: true })
          .eq("despacho_id", inv.despacho_id);
        const { data: d } = await admin.from("despachos").select("asientos").eq("id", inv.despacho_id).maybeSingle();
        if ((count ?? 0) >= (d?.asientos ?? 0)) return json({ error: "sin_asientos" }, 409);
        const { error } = await admin.from("miembros")
          .insert({ despacho_id: inv.despacho_id, user_id: user.id, email: user.email, rol: "miembro" });
        if (error) throw error;
      }
      await admin.from("invitaciones").update({ usado: true }).eq("id", inv.id);
      return await estado(admin, user, inv.despacho_id);
    }

    // ------------------------------------------------------------ crear
    if (accion === "crear") {
      if (mio) return json({ error: "ya_tienes_despacho" }, 409);
      const nombre = String(body.nombre || "").trim().slice(0, 80) || "Mi despacho";
      const { data: d, error } = await admin.from("despachos")
        .insert({ nombre, propietario: user.id }).select("id").single();
      if (error) throw error;
      const { error: e2 } = await admin.from("miembros")
        .insert({ despacho_id: d.id, user_id: user.id, email: user.email, rol: "admin" });
      if (e2) throw e2;
      return await estado(admin, user, d.id);
    }

    if (!mio) return json({ despacho: null });
    const esAdmin = mio.rol === "admin";

    // ----------------------------------------------------------- estado
    if (accion === "estado") return await estado(admin, user, mio.despacho_id);

    // -------------------------------------------------------- renombrar
    if (accion === "renombrar") {
      if (!esAdmin) return json({ error: "solo_admin" }, 403);
      const nombre = String(body.nombre || "").trim().slice(0, 80);
      if (!nombre) return json({ error: "sin_nombre" }, 400);
      await admin.from("despachos").update({ nombre }).eq("id", mio.despacho_id);
      return await estado(admin, user, mio.despacho_id);
    }

    // ---------------------------------------------------------- invitar
    if (accion === "invitar") {
      if (!esAdmin) return json({ error: "solo_admin" }, 403);
      const email = String(body.email || "").trim().toLowerCase();
      if (!emailValido(email)) return json({ error: "email_invalido" }, 400);
      const { data: d } = await admin.from("despachos").select("asientos, nombre").eq("id", mio.despacho_id).single();
      const { count: nMiembros } = await admin.from("miembros").select("*", { count: "exact", head: true })
        .eq("despacho_id", mio.despacho_id);
      const { count: nPendientes } = await admin.from("invitaciones").select("*", { count: "exact", head: true })
        .eq("despacho_id", mio.despacho_id).eq("usado", false).gt("caduca", new Date().toISOString());
      if ((nMiembros ?? 0) + (nPendientes ?? 0) >= (d?.asientos ?? 0)) return json({ error: "sin_asientos", asientos: d?.asientos }, 409);
      const { data: yaMiembro } = await admin.from("miembros").select("user_id")
        .eq("despacho_id", mio.despacho_id).ilike("email", email).maybeSingle();
      if (yaMiembro) return json({ error: "ya_es_miembro" }, 409);

      // Si ya había una invitación viva para ese correo, se reutiliza.
      await admin.from("invitaciones").update({ usado: true })
        .eq("despacho_id", mio.despacho_id).ilike("email", email).eq("usado", false);
      const token = tokenAleatorio();
      const caduca = new Date(Date.now() + DIAS_INVITACION * 86400000).toISOString();
      const { error } = await admin.from("invitaciones")
        .insert({ despacho_id: mio.despacho_id, email, token, caduca });
      if (error) throw error;
      const enlace = APP_URL + "?invitacion=" + token;
      return json({ ok: true, email, enlace, caduca, despacho: d?.nombre });
    }

    // ---------------------------------------------------------- revocar
    if (accion === "revocar") {
      if (!esAdmin) return json({ error: "solo_admin" }, 403);
      const id = String(body.id || "");
      await admin.from("invitaciones").update({ usado: true }).eq("id", id).eq("despacho_id", mio.despacho_id);
      return await estado(admin, user, mio.despacho_id);
    }

    // --------------------------------------------------------- expulsar
    if (accion === "expulsar") {
      if (!esAdmin) return json({ error: "solo_admin" }, 403);
      const uid = String(body.user_id || "");
      const { data: d } = await admin.from("despachos").select("propietario").eq("id", mio.despacho_id).single();
      if (uid === d?.propietario) return json({ error: "no_al_propietario" }, 409);
      await admin.from("miembros").delete().eq("despacho_id", mio.despacho_id).eq("user_id", uid);
      return await estado(admin, user, mio.despacho_id);
    }

    // ------------------------------------------------------------ salir
    if (accion === "salir") {
      const { data: d } = await admin.from("despachos").select("propietario").eq("id", mio.despacho_id).single();
      if (user.id === d?.propietario) return json({ error: "propietario_no_sale" }, 409);
      await admin.from("miembros").delete().eq("despacho_id", mio.despacho_id).eq("user_id", user.id);
      return json({ despacho: null, ok: true });
    }

    return json({ error: "accion_desconocida" }, 400);
  } catch (e) {
    console.error("despacho:", e);
    return json({ error: "error_interno" }, 500);
  }
});

/* Foto completa del despacho para el cliente. */
async function estado(admin: any, user: any, despachoId: string) {
  const { data: d } = await admin.from("despachos")
    .select("id, nombre, propietario, asientos, plan_hasta, creado").eq("id", despachoId).single();
  if (!d) return json({ despacho: null });
  const { data: miembros } = await admin.from("miembros")
    .select("user_id, email, rol, unido").eq("despacho_id", despachoId).order("unido");
  const { data: pendientes } = await admin.from("invitaciones")
    .select("id, email, caduca").eq("despacho_id", despachoId).eq("usado", false)
    .gt("caduca", new Date().toISOString()).order("creado");

  const inicioMes = new Date(); inicioMes.setUTCDate(1); inicioMes.setUTCHours(0, 0, 0, 0);
  const { data: uso } = await admin.from("uso_transcripcion").select("segundos")
    .eq("despacho_id", despachoId).gte("creado", inicioMes.toISOString());
  const usadosMin = Math.ceil(((uso ?? []).reduce((s: number, f: any) => s + (f.segundos ?? 0), 0)) / 60);
  const cuotaMin = (d.asientos ?? 0) * MINUTOS_POR_ASIENTO;
  const vigente = !!d.plan_hasta && new Date(d.plan_hasta) > new Date();
  const yo = (miembros ?? []).find((m: any) => m.user_id === user.id);

  return json({
    despacho: {
      id: d.id, nombre: d.nombre, asientos: d.asientos, plan_hasta: d.plan_hasta,
      vigente, propietario: d.propietario,
      soy_admin: yo?.rol === "admin", soy_propietario: d.propietario === user.id,
      cuota_min: cuotaMin, usados_min: usadosMin, restante_min: Math.max(0, cuotaMin - usadosMin),
    },
    miembros: (miembros ?? []).map((m: any) => ({ user_id: m.user_id, email: m.email, rol: m.rol, unido: m.unido })),
    invitaciones: pendientes ?? [],
  });
}
