// =====================================================================
// ConsteAi — redactar-acta
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

/* Solo responde a nuestras propias webs. Cualquier otro origen recibe la
   primera de la lista, con lo que su navegador bloquea la respuesta. */
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

/* El modelo de acta que el cliente ha aprendido de sus propias actas.
   No cambia QUE se extrae —eso sigue siendo literal y verificable—,
   solo COMO se redacta: el tono, la persona verbal y las formulas de su
   despacho. Las prohibiciones de inventar siguen por encima de esto. */
function bloqueEstilo(e: any): string {
  if (!e || typeof e !== "object") return "";
  const L: string[] = ["", "MODELO DE REDACCION DEL CLIENTE."];
  L.push("Imita este estilo al redactar cada frase. No cambia lo que extraes,");
  L.push("solo como lo escribes. Si el estilo pidiera un dato que no se dijo,");
  L.push("manda la prohibicion de inventar: deja el dato fuera.");
  if (e.tono) L.push("Tono: " + e.tono);
  if (e.persona) L.push("Persona verbal: " + e.persona);
  if (e.tratamiento) L.push("Tratamiento: " + e.tratamiento);
  if (e.longitud) L.push("Extension habitual de cada punto: " + e.longitud);
  const f = e.formulas || {};
  if (f.acuerdo) L.push("Formula para los acuerdos: " + f.acuerdo);
  if (f.votacion) L.push("Formula para las votaciones: " + f.votacion);
  if (f.tarea) L.push("Formula para los encargos: " + f.tarea);
  if (Array.isArray(e.convenciones) && e.convenciones.length) {
    L.push("Convenciones de forma: " + e.convenciones.slice(0, 10).join("; "));
  }
  if (Array.isArray(e.vocabulario) && e.vocabulario.length) {
    L.push("Usa su vocabulario cuando proceda: " + e.vocabulario.slice(0, 25).join(", "));
  }
  return L.join("\n");
}

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
    bloqueEstilo(ctx?.estilo),
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: perfil } = await admin
      .from("perfiles").select("plan, plan_hasta").eq("id", user.id).maybeSingle();

    const plan = perfil?.plan ?? "demo";
    const vigente = !perfil?.plan_hasta || new Date(perfil.plan_hasta) > new Date();
    const esPro = vigente && PLANES_CON_IA.includes(plan);

    /* Acta de regalo: quien no es Pro puede redactar con IA UNA vez en la
       vida de su cuenta. Es la única forma de que vea lo que está
       comprando antes de pagar. Se cuenta por filas con origen "acta":
       si ya hay alguna, se acabó el regalo. */
    let regalo = false;
    if (!esPro) {
      const { count: usadasAlgunaVez } = await admin
        .from("uso_transcripcion")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("origen", "acta");
      if ((usadasAlgunaVez ?? 0) > 0) return json({ error: "plan_insuficiente", plan }, 403);
      regalo = true;
    }

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
    // El modelo de redacción propio es una función Pro: en el acta de
    // regalo se redacta con el estilo estándar.
    if (regalo) ctx.estilo = null;
    // Un acta de regalo es una sola llamada: si la reunión fue larga,
    // se redactan los primeros bloques y se avisa.
    const bloquesUsados = regalo ? bloques.slice(0, 3) : bloques;

    // Los bloques se redactan en paralelo y luego se funden en una sola acta.
    const partes = await Promise.all(bloquesUsados.map((b) => redactarBloque(b, ctx, clave)));

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

    return json({
      ...unido,
      restante_mes: regalo ? 0 : Math.max(0, MAX_BLOQUES_MES - usados - 1),
      regalo,
      recortada: regalo && bloques.length > bloquesUsados.length,
    });
  } catch (e) {
    const msg = (e && (e as Error).message) || "";
    if (msg === "ia_no_disponible") return json({ error: "ia_no_disponible" }, 502);
    console.error("redactar-acta:", e);
    return json({ error: "error_interno" }, 500);
  }
});
