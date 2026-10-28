// =====================================================================
// ConsteAi — ayuda
// Respaldo con IA del asistente de uso. Solo entra en juego cuando el
// buscador local de ayuda.js no ha entendido la pregunta.
//
// Para que cueste casi nada y no invente funciones:
//   · Solo con sesión iniciada y con un tope diario por usuario.
//   · El modelo recibe la base de conocimiento de la app como ÚNICO
//     material y tiene prohibido responder fuera de ella.
//   · Respuestas cortas (máx. 180 tokens de salida). Cada consulta sale a
//     una fracción de céntimo.
//
// Entrada:  { pregunta:"...", contexto:"- pregunta: respuesta\n..." }
// Salida:   { respuesta:"..." }  |  { error:"limite"|"fuera_de_tema"|... }
//
// Secretos: OPENAI_API_KEY. Verify JWT: ACTIVADO.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const TOPE_DIA = 15;
const MAX_PREGUNTA = 400;
const MAX_CONTEXTO = 16000;

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

function instrucciones(contexto: string) {
  return [
    "Eres el asistente de uso de ConsteAi, una aplicación web en español para",
    "transcribir reuniones y redactar actas. Respondes SOLO sobre cómo usar y",
    "configurar la aplicación.",
    "",
    "Tu único material es la siguiente base de conocimiento. Si la pregunta no",
    "se puede responder con ella, responde exactamente: FUERA_DE_TEMA",
    "",
    "REGLAS:",
    "- No inventes funciones, botones, menús ni precios que no estén en la base.",
    "- Responde en español de España, en 2 a 5 frases, con el nombre exacto de",
    "  los botones o pestañas entre comillas tal y como aparecen en la base.",
    "- Si la pregunta es sobre otra cosa (derecho, informática general, chistes,",
    "  otras aplicaciones, tu propia naturaleza), responde FUERA_DE_TEMA.",
    "- Nunca pidas ni repitas datos personales.",
    "",
    "BASE DE CONOCIMIENTO:",
    contexto,
  ].join("\n");
}

Deno.serve(async (req) => {
  cors = cabeceras(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth) return json({ error: "sin_sesion" }, 401);
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return json({ error: "sin_sesion" }, 401);

    const body = await req.json().catch(() => ({}));
    const pregunta = String(body.pregunta || "").trim().slice(0, MAX_PREGUNTA);
    const contexto = String(body.contexto || "").slice(0, MAX_CONTEXTO);
    if (pregunta.length < 3 || contexto.length < 200) return json({ error: "sin_texto" }, 400);

    // Tope diario por usuario, apuntado en uso_transcripcion con origen "ayuda".
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hoy = new Date(); hoy.setUTCHours(0, 0, 0, 0);
    const { count } = await admin.from("uso_transcripcion")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("origen", "ayuda").gte("creado", hoy.toISOString());
    if ((count ?? 0) >= TOPE_DIA) return json({ error: "limite" }, 429);

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + Deno.env.get("OPENAI_API_KEY")!, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 180,
        messages: [
          { role: "system", content: instrucciones(contexto) },
          { role: "user", content: pregunta },
        ],
      }),
    });
    if (!r.ok) {
      console.error("openai:", r.status, (await r.text()).slice(0, 200));
      return json({ error: "ia_no_disponible" }, 502);
    }
    const data = await r.json();
    const texto = String(data.choices?.[0]?.message?.content ?? "").trim();

    await admin.from("uso_transcripcion").insert({ user_id: user.id, email: user.email, segundos: 0, origen: "ayuda" });

    if (!texto || /FUERA_DE_TEMA/i.test(texto)) return json({ error: "fuera_de_tema" }, 422);
    return json({ respuesta: texto.slice(0, 900) });
  } catch (e) {
    console.error("ayuda:", e);
    return json({ error: "error_interno" }, 500);
  }
});
