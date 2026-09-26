// =====================================================================
// EscribAI — redactar-acta
// Redacta los acuerdos, tareas y plazos de una reunión a partir de la
// transcripción, en el registro formal de un acta.
//
// Qué NO hace, a propósito:
//   · No calcula nada. Los porcentajes de participación, el recuento de
//     palabras y los temas los sigue haciendo la app en local, porque
//     son aritmética y un modelo de lenguaje no es de fiar para eso.
//   · No inventa. Si no se dijo el resultado de una votación o el
//     importe, el acuerdo sale sin ese dato, nunca con uno inventado.
//
// Entrada:  { bloques: ["...", "..."], contexto: {...} }
// Salida:   { acuerdos, tareas, fechas, preguntas, destacadas, restante_mes }
//
// Secretos: OPENAI_API_KEY (+ los SUPABASE_* que ya existen)
// Verify JWT: ACTIVADO.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const PLANES_CON_IA = ["pro_mes", "pro_anyo", "empresas"];
const MAX_BLOQUES_MES = 600;
const MAX_CARACTERES = 18000;   // por bloque
const MAX_BLOQUES = 12;         // por llamada

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function instrucciones(ctx: any) {
  const nombres = (ctx?.hablantes || []).filter(Boolean).join(", ");
  return [
    "Eres secretario de actas en España. Redactas actas en español de España,",
    "en registro formal e impersonal, a partir de la transcripción literal de una reunión.",
    "",
    "TU TAREA: extraer y REDACTAR lo que se decidió, encargó y emplazó.",
    "",
    "ACUERDOS — lo que se aprueba, rechaza, autoriza o acuerda. Cada acuerdo debe",
    "ser una frase completa y entendible sin leer la transcripción, e incluir,",
    "SI SE DIJERON: el importe exacto, el plazo, el proveedor y el resultado de la",
    "votación (votos a favor, en contra y abstenciones). Redáctalo en tercera",
    "persona: «Se aprueba…», «Se acuerda…», «Se rechaza…».",
    "",
    "TAREAS — encargos concretos a una persona u órgano. Di quién hace qué y,",
    "si se dijo, para cuándo.",
    "",
    "PLAZOS — fechas y vencimientos citados, con lo que vence en cada uno.",
    "",
    "PREGUNTAS — cuestiones que quedaron planteadas sin respuesta.",
    "",
    "DESTACADAS — intervenciones relevantes que no son acuerdo ni tarea:",
    "quejas formales, advertencias, posiciones que conviene que consten.",
    "",
    "PROHIBIDO, sin excepción:",
    "- Inventar cifras, importes, fechas, porcentajes, nombres o resultados de votación.",
    "- Completar un dato que no se dijo. Si no se dijo cuántos votaron a favor,",
    "  redacta el acuerdo SIN el recuento. Es preferible un acta incompleta a una falsa.",
    "- Deducir conclusiones que nadie expresó.",
    "- Incluir conversación intrascendente, saludos o comentarios personales.",
    "- Repetir el mismo acuerdo en varios puntos.",
    "",
    "Si en el texto no hay acuerdos, devuelve la lista vacía. No rellenes por rellenar.",
    "",
    ctx?.tipo ? "Tipo de reunión: " + ctx.tipo + "." : "",
    ctx?.organizacion ? "Organización: " + ctx.organizacion + "." : "",
    ctx?.presidente ? "Preside: " + ctx.presidente + "." : "",
    ctx?.secretario ? "Secretaría: " + ctx.secretario + "." : "",
    nombres ? "Asistentes identificados: " + nombres + "." : "",
    "",
    'El campo "quien" es el nombre de quien lo propuso o lo manifestó, elegido',
    "de la lista de asistentes. Si no está claro, déjalo como cadena vacía.",
    "",
    "Devuelve SOLO este JSON:",
    '{"acuerdos":[{"quien":"","texto":""}],"tareas":[{"quien":"","texto":""}],',
    '"fechas":[{"quien":"","texto":""}],"preguntas":[{"quien":"","texto":""}],',
    '"destacadas":[{"quien":"","texto":""}]}',
  ].filter(Boolean).join("\n");
}

const LISTAS = ["acuerdos", "tareas", "fechas", "preguntas", "destacadas"] as const;

/* Normaliza lo que devuelve el modelo y descarta lo que no encaje. */
function limpiarRespuesta(bruto: any) {
  const salida: Record<string, { quien: string; texto: string }[]> = {};
  for (const k of LISTAS) {
    const lista = Array.isArray(bruto?.[k]) ? bruto[k] : [];
    salida[k] = lista
      .map((x: any) => ({
        quien: String(x?.quien ?? "").slice(0, 60),
        texto: String(x?.texto ?? "").trim().slice(0, 800),
      }))
      .filter((x: any) => x.texto.length > 5)
      .slice(0, 40);
  }
  return salida;
}

async function redactarBloque(texto: string, ctx: any, clave: string) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + clave, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: instrucciones(ctx) },
        { role: "user", content: texto },
      ],
    }),
  });
  if (!r.ok) {
    console.error("openai:", r.status, (await r.text()).slice(0, 300));
    throw new Error("ia_no_disponible");
  }
  const data = await r.json();
  try {
    return limpiarRespuesta(JSON.parse(data.choices?.[0]?.message?.content ?? "{}"));
  } catch (_e) {
    return limpiarRespuesta({});
  }
}

Deno.serve(async (req) => {
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: perfil } = await admin
      .from("perfiles").select("plan, plan_hasta").eq("id", user.id).maybeSingle();

    const plan = perfil?.plan ?? "demo";
    const vigente = !perfil?.plan_hasta || new Date(perfil.plan_hasta) > new Date();
    if (!vigente || !PLANES_CON_IA.includes(plan)) return json({ error: "plan_insuficiente", plan }, 403);

    const inicioMes = new Date();
    inicioMes.setUTCDate(1); inicioMes.setUTCHours(0, 0, 0, 0);
    const { count } = await admin
      .from("uso_transcripcion")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("origen", "acta")
      .gte("creado", inicioMes.toISOString());
    const usados = count ?? 0;
    if (usados >= MAX_BLOQUES_MES) return json({ error: "cuota_agotada" }, 429);

    const body = await req.json().catch(() => ({}));
    const bloques: string[] = (Array.isArray(body.bloques) ? body.bloques : [])
      .map((b: any) => String(b || "").slice(0, MAX_CARACTERES))
      .filter((b: string) => b.trim().length > 40)
      .slice(0, MAX_BLOQUES);
    if (!bloques.length) return json({ error: "sin_texto" }, 400);

    const clave = Deno.env.get("OPENAI_API_KEY")!;
    const ctx = body.contexto || {};

    // Los bloques se redactan en paralelo y luego se funden en una sola acta.
    const partes = await Promise.all(bloques.map((b) => redactarBloque(b, ctx, clave)));

    const unido: Record<string, { quien: string; texto: string }[]> = {};
    for (const k of LISTAS) {
      const vistos = new Set<string>();
      unido[k] = [];
      for (const p of partes) {
        for (const item of p[k]) {
          const huella = item.texto.toLowerCase().replace(/\s+/g, " ").trim();
          if (vistos.has(huella)) continue;
          vistos.add(huella);
          unido[k].push(item);
        }
      }
      unido[k] = unido[k].slice(0, 60);
    }

    await admin.from("uso_transcripcion").insert({
      user_id: user.id, email: user.email, segundos: 0, origen: "acta",
    });

    return json({ ...unido, restante_mes: Math.max(0, MAX_BLOQUES_MES - usados - 1) });
  } catch (e) {
    const msg = (e && (e as Error).message) || "";
    if (msg === "ia_no_disponible") return json({ error: "ia_no_disponible" }, 502);
    console.error("redactar-acta:", e);
    return json({ error: "error_interno" }, 500);
  }
});
