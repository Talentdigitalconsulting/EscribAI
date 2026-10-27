// =====================================================================
// ConsteAi — analizar-estilo
// El cliente manda dos o tres actas suyas. Deducimos cómo las escribe
// —tono, secciones, fórmulas, vocabulario— y guardamos esa deducción
// como «modelo de acta» para que las actas futuras salgan ya con la voz
// de su despacho.
//
// Lo que NO se guarda, a propósito: las actas de ejemplo. Entran, se
// analizan y se descartan en esta misma llamada. En ellas vienen
// nombres de vecinos, importes y direcciones que no tenemos por qué
// almacenar ni queremos custodiar.
//
// Entrada:  { nombre:"...", muestras:["texto1","texto2","texto3"] }
//           { accion:"listar" } | { accion:"borrar", id:"..." }
// Salida:   { id, nombre, analisis }
//
// Secretos: OPENAI_API_KEY (+ los SUPABASE_* que ya existen)
// Verify JWT: ACTIVADO.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const PLANES_CON_ESTILO = ["pro_mes", "pro_anyo", "empresas"];
const MAX_MUESTRAS = 3;
const MAX_CARACTERES = 14000;   // por muestra
const MIN_CARACTERES = 300;     // menos que esto no es un acta

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const INSTRUCCIONES = [
  "Eres un analista de estilo documental. Recibes entre una y tres actas reales",
  "de un mismo despacho o administrador de fincas español.",
  "",
  "TU TAREA: describir CÓMO están escritas, para que otro redactor pueda imitarlas.",
  "No resumas su contenido. No copies datos concretos.",
  "",
  "PROHIBIDO, sin excepción:",
  "- Reproducir nombres de personas, direcciones, importes, números de finca,",
  "  matrículas, DNI o cualquier dato identificativo que aparezca en las actas.",
  "- Copiar párrafos enteros. Las fórmulas que extraigas deben ir con huecos,",
  '  por ejemplo: «En [localidad], siendo las [hora] del [fecha]…».',
  "- Inventar secciones que no aparezcan en las muestras.",
  "",
  "Si las tres actas difieren entre sí, describe lo que tienen en común y",
  'anótalo en "notas".',
  "",
  "Devuelve SOLO este JSON:",
  "{",
  '  "tono":"una frase: formal/notarial, llano, técnico…",',
  '  "tratamiento":"usted | tuteo | impersonal",',
  '  "persona":"cómo se refiere a los acuerdos: tercera persona impersonal, primera del plural…",',
  '  "secciones":[{"titulo":"","proposito":""}],',
  '  "formulas":{"apertura":"","cierre":"","acuerdo":"","votacion":"","tarea":""},',
  '  "numeracion":"cómo numera puntos y acuerdos",',
  '  "convenciones":["reglas de forma observadas: mayúsculas, negritas, cómo escribe las cifras, los plazos, las fechas…"],',
  '  "vocabulario":["términos propios que repite, sin datos personales"],',
  '  "longitud":"breve | media | extensa",',
  '  "notas":""',
  "}",
].join("\n");

/* Quita del análisis cualquier dato personal que se hubiera colado pese
   a las instrucciones. Cinturón además de tirantes. */
const RE_DNI = /\b\d{7,8}\s?-?[A-Za-z]\b/g;
const RE_IBAN = /\b[A-Z]{2}\d{2}[\s\d]{10,30}\b/g;
const RE_EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g;
const RE_TEL = /\b(?:\+34[\s-]?)?[6-9]\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}\b/g;

function despersonalizar(s: string): string {
  return String(s ?? "")
    .replace(RE_DNI, "[documento]")
    .replace(RE_IBAN, "[cuenta]")
    .replace(RE_EMAIL, "[correo]")
    .replace(RE_TEL, "[teléfono]")
    .slice(0, 600);
}

function limpiarAnalisis(b: any) {
  const texto = (x: any) => despersonalizar(String(x ?? "").trim());
  const lista = (x: any, n: number) =>
    (Array.isArray(x) ? x : []).map((y: any) => texto(y)).filter(Boolean).slice(0, n);
  const secciones = (Array.isArray(b?.secciones) ? b.secciones : [])
    .map((s: any) => ({ titulo: texto(s?.titulo).slice(0, 120), proposito: texto(s?.proposito) }))
    .filter((s: any) => s.titulo)
    .slice(0, 20);
  const f = b?.formulas || {};
  return {
    tono: texto(b?.tono),
    tratamiento: texto(b?.tratamiento).slice(0, 40),
    persona: texto(b?.persona).slice(0, 160),
    secciones,
    formulas: {
      apertura: texto(f.apertura),
      cierre: texto(f.cierre),
      acuerdo: texto(f.acuerdo),
      votacion: texto(f.votacion),
      tarea: texto(f.tarea),
    },
    numeracion: texto(b?.numeracion).slice(0, 200),
    convenciones: lista(b?.convenciones, 15),
    vocabulario: lista(b?.vocabulario, 40),
    longitud: texto(b?.longitud).slice(0, 20),
    notas: texto(b?.notas),
  };
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

    const body = await req.json().catch(() => ({}));
    const accion = String(body.accion || "analizar");

    // Listar y borrar van con la sesión del cliente: la RLS ya aísla cada cuenta.
    if (accion === "listar") {
      const { data, error } = await anon
        .from("estilos_acta").select("id,nombre,analisis,muestras,actualizado")
        .order("actualizado", { ascending: false });
      if (error) throw error;
      return json({ estilos: data ?? [] });
    }
    if (accion === "borrar") {
      const id = String(body.id || "");
      if (!id) return json({ error: "sin_id" }, 400);
      const { error } = await anon.from("estilos_acta").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    // Analizar sí es de pago: es lo que más cuesta y más diferencia a la app.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: perfil } = await admin
      .from("perfiles").select("plan, plan_hasta").eq("id", user.id).maybeSingle();
    const plan = perfil?.plan ?? "demo";
    const vigente = !perfil?.plan_hasta || new Date(perfil.plan_hasta) > new Date();
    if (!vigente || !PLANES_CON_ESTILO.includes(plan)) {
      return json({ error: "plan_insuficiente", plan }, 403);
    }

    const nombre = String(body.nombre || "").trim().slice(0, 80) || "Mi modelo de acta";
    const muestras: string[] = (Array.isArray(body.muestras) ? body.muestras : [])
      .map((m: any) => String(m || "").slice(0, MAX_CARACTERES))
      .filter((m: string) => m.trim().length >= MIN_CARACTERES)
      .slice(0, MAX_MUESTRAS);
    if (!muestras.length) return json({ error: "sin_muestras" }, 400);

    const entrada = muestras
      .map((m, i) => "===== ACTA DE EJEMPLO " + (i + 1) + " =====\n" + m)
      .join("\n\n");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + Deno.env.get("OPENAI_API_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: INSTRUCCIONES },
          { role: "user", content: entrada },
        ],
      }),
    });
    if (!r.ok) {
      console.error("openai:", r.status, (await r.text()).slice(0, 300));
      return json({ error: "ia_no_disponible" }, 502);
    }
    const data = await r.json();
    let bruto: any = {};
    try { bruto = JSON.parse(data.choices?.[0]?.message?.content ?? "{}"); } catch (_e) { bruto = {}; }
    const analisis = limpiarAnalisis(bruto);
    if (!analisis.secciones.length && !analisis.tono) {
      return json({ error: "no_reconocido" }, 422);
    }

    const id = String(body.id || "");
    let fila;
    if (id) {
      const { data: d, error } = await anon
        .from("estilos_acta")
        .update({ nombre, analisis, muestras: muestras.length, actualizado: new Date().toISOString() })
        .eq("id", id).select("id,nombre,analisis,muestras").maybeSingle();
      if (error) throw error;
      fila = d;
    } else {
      const { data: d, error } = await anon
        .from("estilos_acta")
        .insert({ user_id: user.id, nombre, analisis, muestras: muestras.length })
        .select("id,nombre,analisis,muestras").maybeSingle();
      if (error) {
        if (String(error.message || "").includes("limite_estilos")) {
          return json({ error: "limite_estilos" }, 409);
        }
        throw error;
      }
      fila = d;
    }

    return json(fila);
  } catch (e) {
    console.error("analizar-estilo:", e);
    return json({ error: "error_interno" }, 500);
  }
});
