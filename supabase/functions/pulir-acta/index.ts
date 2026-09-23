// =====================================================================
// EscribAI — pulir-acta
// Corrige un bloque de intervenciones transcritas: ortografía, puntuación
// y palabras mal oídas, deduciéndolas por el contexto. No resume, no
// interpreta y no inventa: solo arregla lo que el dictado entendió mal.
//
// Entrada:  { bloque: [{i, spk, text}], contexto: {tipo, organizacion, nombres[]} }
// Salida:   { textos: [{i, text}], restante_mes: n }
//
// Secretos necesarios: OPENAI_API_KEY (+ los SUPABASE_* que ya existen)
// Verify JWT: ACTIVADO (lo llama un cliente con sesión).
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const PLANES_CON_IA = ["pro_mes", "pro_anyo", "empresas"];
const MAX_BLOQUES_MES = 400;          // ~40 actas largas al mes
const MAX_CARACTERES = 20000;         // por bloque

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function instrucciones(ctx: any) {
  const nombres = (ctx?.nombres || []).filter(Boolean).join(", ");
  return [
    "Eres un corrector de transcripciones de reuniones en español de España.",
    "Recibes intervenciones transcritas automáticamente, con errores del reconocimiento de voz.",
    "",
    "TU ÚNICA TAREA es devolver cada intervención corregida:",
    "- Arregla ortografía, acentuación, mayúsculas y signos de puntuación.",
    "- Corrige palabras mal transcritas deduciéndolas por el contexto de la frase.",
    "- Separa en frases con puntos cuando el dictado las haya pegado.",
    "- Elimina repeticiones evidentes del reconocedor (la misma frase dos veces seguidas).",
    "",
    "PROHIBIDO:",
    "- Resumir, acortar, reordenar o reformular el contenido.",
    "- Añadir información, conclusiones o palabras que nadie dijo.",
    "- Traducir, cambiar el registro o corregir la forma de hablar de la gente.",
    "- Cambiar cifras, fechas, importes o resultados de votaciones.",
    "Si una intervención es ininteligible, devuélvela tal cual.",
    "",
    ctx?.tipo ? "Contexto: es " + ctx.tipo + "." : "",
    ctx?.organizacion ? "Organización: " + ctx.organizacion + "." : "",
    nombres ? "Nombres propios que aparecen (respeta esta grafía): " + nombres + "." : "",
    "",
    'Devuelve SOLO un JSON con esta forma: {"textos":[{"i":0,"text":"..."}]}',
    "Incluye todos los elementos recibidos, con el mismo campo i.",
  ].filter(Boolean).join("\n");
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

    // Tope mensual de uso
    const inicioMes = new Date();
    inicioMes.setUTCDate(1); inicioMes.setUTCHours(0, 0, 0, 0);
    const { count } = await admin
      .from("uso_transcripcion")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("origen", "pulido")
      .gte("creado", inicioMes.toISOString());
    const usados = count ?? 0;
    if (usados >= MAX_BLOQUES_MES) return json({ error: "cuota_agotada" }, 429);

    const body = await req.json().catch(() => ({}));
    const bloque = Array.isArray(body.bloque) ? body.bloque : [];
    if (!bloque.length) return json({ error: "sin_texto" }, 400);

    const largo = bloque.reduce((s: number, x: any) => s + String(x.text || "").length, 0);
    if (largo > MAX_CARACTERES) return json({ error: "bloque_demasiado_grande" }, 413);

    const entrada = bloque.map((x: any) => ({ i: x.i, text: String(x.text || "").slice(0, 2000) }));

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + Deno.env.get("OPENAI_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: instrucciones(body.contexto) },
          { role: "user", content: JSON.stringify({ intervenciones: entrada }) },
        ],
      }),
    });

    if (!r.ok) {
      console.error("openai:", r.status, (await r.text()).slice(0, 300));
      return json({ error: "ia_no_disponible" }, 502);
    }

    const data = await r.json();
    let textos: any[] = [];
    try {
      const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
      textos = Array.isArray(parsed.textos) ? parsed.textos : [];
    } catch (_e) { /* respuesta no parseable */ }
    if (!textos.length) return json({ error: "respuesta_vacia" }, 502);

    await admin.from("uso_transcripcion").insert({
      user_id: user.id, email: user.email, segundos: 0, origen: "pulido",
    });

    return json({ textos, restante_mes: Math.max(0, MAX_BLOQUES_MES - usados - 1) });
  } catch (e) {
    console.error("pulir-acta:", e);
    return json({ error: "error_interno" }, 500);
  }
});
