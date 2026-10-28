/* =====================================================================
   ConsteAi · ayuda.js — el asistente de uso de la app

   Responde preguntas sobre cómo usar y configurar ConsteAi. Nada más.

   Cómo funciona, y por qué cuesta cero:
   1. Una base de conocimiento escrita a mano (abajo) con las preguntas
      que la gente hace de verdad y sus respuestas.
   2. Un buscador local: normaliza la pregunta (sin tildes, sin plurales,
      con sinónimos) y puntúa cada entrada. Si hay una respuesta clara,
      la da al instante, sin salir del navegador y sin coste.
   3. Solo si no entiende la pregunta, y el usuario lo pide, consulta a la
      IA con esta misma base como único material (función «ayuda»,
      limitada por día). Así la IA no inventa funciones que no existen.
===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------ base */
  /* Cada entrada: id, preguntas (variantes con las que la gente lo
     pide), claves (palabras que pesan más), respuesta, y opcionalmente
     una acción que lleva al sitio: {tab:"settings"} o {fn:"nombre"}. */
  var BASE = [
    { id: "empezar", preguntas: ["cómo empiezo", "cómo se usa", "por dónde empiezo", "primeros pasos", "cómo funciona la app", "qué hace consteai"],
      claves: ["empezar", "empiezo", "funciona", "usar"],
      respuesta: "Tres pasos: 1) añade a los asistentes con «＋ Añadir hablante» (o no, si vas a usar el motor profesional); 2) elige la organización en la barra lateral; 3) pulsa el micrófono grande. Al terminar, «Redactar acta con IA» o «Resumen rápido», y «Guardar sesión» para archivarla en la biblioteca.",
      accion: { tab: "record" } },

    { id: "microfono", preguntas: ["qué micrófono uso", "no distingue las voces", "confunde las voces", "reconoce mal quién habla", "se mezclan los hablantes", "necesito micrófono externo"],
      claves: ["microfono", "voces", "voz", "distingue", "confunde", "reconoce", "hablante"],
      respuesta: "Para distinguir voces, usa un micrófono externo: de mesa (omnidireccional) para una sala, o de solapa para una persona. El micrófono del portátil capta la sala de forma plana y las voces se parecen más. Además: calibra a cada persona 9 segundos cerca del micro, y si confunde a dos personas, corrige con el botón 👤 de la burbuja. Para juntas grandes, no calibres: graba y pulsa «Mejorar con IA», que separa las voces solo." },

    { id: "calibrar", preguntas: ["cómo calibro una voz", "calibrar hablante", "qué es calibrar", "cuánto dura la calibración", "hay que calibrar a todos"],
      claves: ["calibrar", "calibracion", "calibro", "huella"],
      respuesta: "Pulsa «Calibrar» junto al nombre del hablante y que lea la frase en voz alta durante 9 segundos, cerca del micrófono y con voz natural. La app guarda once rasgos de su voz y la reconoce en las próximas reuniones de esa organización sin repetir. No hace falta calibrar a todos: en juntas grandes es mejor «Mejorar con IA» al terminar." },

    { id: "sensibilidad", preguntas: ["qué es la sensibilidad de cambio de hablante", "cambia de hablante demasiado", "no cambia de hablante", "sensibilidad alta media baja"],
      claves: ["sensibilidad", "hablante"],
      respuesta: "Ajustes → «Sensibilidad de cambio de hablante». Alta cambia de persona con facilidad (útil si se interrumpen mucho); Baja solo cambia con diferencias claras de voz (útil si la app salta de nombre sin motivo). Media es la recomendada.", accion: { tab: "settings" } },

    { id: "juntas-grandes", preguntas: ["junta con muchos vecinos", "cuarenta asistentes", "muchas personas", "no puedo calibrar a todos", "junta de propietarios grande"],
      claves: ["junta", "vecinos", "muchos", "asistentes", "grande"],
      respuesta: "No calibres. Graba la junta entera y, al terminar, pulsa «🤖 Mejorar con IA»: el motor profesional separa las voces por sí solo y tú les pones nombre después con el botón 👤. Con el plan Pro también puedes activar en Ajustes el motor profesional en directo, que separa las voces mientras se habla." },

    { id: "motor-vivo", preguntas: ["motor profesional en directo", "motor de dictado", "navegador o profesional", "transcripción en vivo profesional", "qué motor elijo"],
      claves: ["motor", "directo", "vivo", "navegador", "profesional", "dictado"],
      respuesta: "Ajustes → «Motor de dictado en directo». El del navegador es gratuito e ilimitado pero no separa voces solo. El profesional (Pro) envía el audio según se habla, es más preciso y separa las voces sin calibrar; gasta de las horas mensuales del plan. Si la conexión falla, la app vuelve sola al navegador sin cortar la reunión.", accion: { tab: "settings" } },

    { id: "horas", preguntas: ["cuántas horas tengo", "cuota de transcripción", "se me han acabado las horas", "cuándo se renuevan las horas", "qué gasta horas"],
      claves: ["horas", "cuota", "renuevan", "gasta", "minutos"],
      respuesta: "El plan Pro incluye 10 horas al mes de transcripción profesional; el plan Despacho, 8 horas por asiento en bolsa común (40 h con 5 personas). Se renuevan el día 1. Gastan horas: «Transcribir archivo», «Mejorar con IA», las juntas online y el motor profesional en directo. El dictado del navegador no gasta nada. El medidor está en la barra lateral." },

    { id: "acta-ia", preguntas: ["cómo redacto el acta", "redactar acta con ia", "el acta no sale", "diferencia entre resumen rápido y acta con ia", "acta de regalo"],
      claves: ["acta", "redactar", "ia", "resumen", "regalo"],
      respuesta: "«Redactar acta con IA» lee la transcripción y redacta acuerdos, tareas, plazos y preguntas en registro formal, sin inventar cifras ni votaciones que no se dijeron. «Resumen rápido» hace lo mismo con reglas locales, gratis y al instante, pero más tosco. La IA es Pro; toda cuenta gratuita tiene un acta con IA de regalo para probarla.", accion: { tab: "summary" } },

    { id: "modelos-acta", preguntas: ["cómo le enseño mi estilo", "modelos de acta", "subir mis actas de ejemplo", "que escriba como yo", "aprender mi estilo"],
      claves: ["modelo", "modelos", "estilo", "ejemplo", "aprender", "escribe"],
      respuesta: "Ajustes → «Mis modelos de acta» (Pro). Sube o pega entre una y tres actas tuyas (.txt o .docx). La app deduce tono, secciones y fórmulas, y guarda solo esa descripción: las actas de ejemplo no se almacenan. Después asigna el modelo a cada organización en su ficha y las actas saldrán redactadas a tu manera. Consejo: usa actas antiguas o con los nombres tachados.", accion: { tab: "settings" } },

    { id: "plantillas", preguntas: ["qué plantilla elijo", "plantilla de junta de propietarios", "cambiar el tipo de acta", "mis plantillas", "plantilla propia"],
      claves: ["plantilla", "plantillas", "tipo", "formato"],
      respuesta: "El desplegable «Acta general / Junta de propietarios / …» elige la estructura del documento. Cada organización puede tener su plantilla por defecto. En «✏️ Mis plantillas…» (Pro) creas la tuya con tus secciones y cabecera. Y si quieres TU Word con membrete, sube el .docx con marcadores {{ACUERDOS}}, {{FECHA}}… en «Modelo Word propio»." },

    { id: "word", preguntas: ["exportar a word", "mi modelo de word", "marcadores del word", "membrete", "descargar el acta en word"],
      claves: ["word", "docx", "membrete", "marcador", "marcadores"],
      respuesta: "«⬇ Word» descarga el acta como documento de Word. Si subes tu propio .docx en «Mis plantillas» → «Modelo Word propio» con marcadores como {{ACUERDOS}}, {{TAREAS}}, {{FECHA}}, {{PARTICIPANTES}} o {{TRANSCRIPCION}}, te devuelve TU documento con el formato intacto. Escribe cada marcador de una vez, sin cambiar de fuente a mitad." },

    { id: "organizaciones", preguntas: ["qué es una organización", "crear una comunidad", "añadir organización", "cambiar de comunidad", "destinatarios del acta"],
      claves: ["organizacion", "comunidad", "ficha", "destinatarios", "presidente", "secretario"],
      respuesta: "Una organización es la ficha de quien se reúne: comunidad, consejo, asociación, cliente. Guarda nombre, presidente, secretario, plantilla, modelo de redacción y los correos a los que se envía el acta. Créala con «＋ Nueva organización» en la barra lateral y elígela antes de grabar: el acta sale sellada con sus datos y se archiva a su nombre. Gratis incluye 1; Pro, ilimitadas." },

    { id: "enviar", preguntas: ["cómo envío el acta", "enviar acta por correo", "a quién se envía", "los vecinos no reciben el acta"],
      claves: ["enviar", "envio", "correo", "email", "destinatarios"],
      respuesta: "«📧 Enviar acta» abre tu correo con el acta y los destinatarios de la organización en copia oculta, y te pide confirmar a qué comunidad va. Los destinatarios se editan en la ficha de la organización. Antes de grabar, «📢 Aviso a los asistentes» te da el texto legal para informar de que se graba." },

    { id: "guardar", preguntas: ["cómo guardo la reunión", "dónde está la biblioteca", "se guarda el audio", "recuperar una reunión", "descargar carpeta completa"],
      claves: ["guardar", "biblioteca", "audio", "recuperar", "carpeta", "zip", "cerrado", "cerro", "perdido"],
      respuesta: "«💾 Guardar sesión» archiva la reunión en la carpeta de su organización con la fecha como título. En Biblioteca abres cualquier acta y, con 📦, descargas la carpeta completa (acta, transcripción y audio) en ZIP. El acta y la transcripción viajan con tu cuenta; el audio se queda en el equipo donde grabaste. Si el navegador se cierra a mitad de reunión, al volver a abrir la app te ofrece recuperarla.", accion: { tab: "history" } },

    { id: "online", preguntas: ["junta por zoom", "reunión por meet", "teams", "junta online", "compartir audio de la pestaña", "no se oye la videollamada"],
      claves: ["zoom", "meet", "teams", "online", "videollamada", "pestaña"],
      respuesta: "Pulsa «💻 Junta online». El navegador pide qué compartir: elige la pestaña de la videollamada y marca «También compartir el audio de la pestaña» antes de aceptar; sin esa casilla no se oye nada. La app mezcla la reunión con tu micrófono. Al terminar, «⏹️ Terminar junta online» y se transcribe sola. Necesita Chrome o Edge en ordenador y gasta horas del plan." },

    { id: "archivo", preguntas: ["transcribir un audio grabado", "subir un archivo", "audio del móvil", "transcribir archivo", "audio de whatsapp"],
      claves: ["archivo", "subir", "grabado", "mp3", "whatsapp", "video"],
      respuesta: "«📂 Transcribir archivo» acepta audios y vídeos ya grabados (la junta con la grabadora del móvil, un audio de WhatsApp…). Los transcribe con el motor profesional separando las voces. Es Pro y gasta horas del plan." },

    { id: "mejorar-ia", preguntas: ["qué hace mejorar con ia", "rediarizar", "mejorar la transcripción", "la transcripción tiene errores", "pulir texto"],
      claves: ["mejorar", "pulir", "errores", "corregir", "diarizacion"],
      respuesta: "«🤖 Mejorar con IA» vuelve a procesar el audio de la sesión con el motor profesional: separa las voces de verdad y mejora el texto. «✨ Pulir texto» solo corrige ortografía y puntuación de lo transcrito, sin tocar el audio. Ambas son Pro." },

    { id: "corregir-hablante", preguntas: ["cambiar el hablante de una frase", "editar la transcripción", "borrar una frase", "la frase es de otra persona"],
      claves: ["corregir", "cambiar", "editar", "borrar", "frase", "burbuja"],
      respuesta: "En cada burbuja: ✏️ edita el texto, 👤 cambia el hablante y 🗑 la elimina. En ordenador aparecen al pasar el cursor; en el móvil se ven siempre. Corrige antes de redactar el acta y los cambios se reflejan." },

    { id: "movil", preguntas: ["funciona en el móvil", "instalar en el móvil", "añadir a pantalla de inicio", "iphone", "android"],
      claves: ["movil", "telefono", "instalar", "android", "iphone", "ipad", "tablet"],
      respuesta: "Sí. Abre la app en Chrome (Android) o Safari (iPhone) y usa «Añadir a pantalla de inicio». Durante la grabación mantiene la pantalla encendida y si el sistema corta el micrófono se reconecta sola. En iPhone el dictado en directo no está disponible: graba con la grabadora y sube el audio con «Transcribir archivo». Las juntas online solo funcionan en ordenador." },

    { id: "navegador", preguntas: ["qué navegador uso", "no funciona en firefox", "safari no transcribe", "no reconoce la voz"],
      claves: ["navegador", "chrome", "edge", "firefox", "safari", "soporta"],
      respuesta: "Para el dictado en directo usa Google Chrome o Microsoft Edge. Firefox y Safari no incorporan el motor de dictado; en ellos puedes grabar con cualquier grabadora y subir el audio con «Transcribir archivo»." },

    { id: "planes", preguntas: ["cuánto cuesta", "qué incluye el plan pro", "precio", "diferencia entre gratis y pro", "plan despacho"],
      claves: ["precio", "cuesta", "plan", "planes", "pro", "gratis", "despacho", "suscripcion"],
      respuesta: "Gratis: transcripción en directo ilimitada, 2 voces, 1 organización, resumen rápido y un acta con IA de regalo. Pro, 19 €/mes (o 190 €/año): comunidades y voces ilimitadas, acta con IA, modelos de acta propios, Word con tu formato, biblioteca en la nube y 10 h/mes de transcripción profesional. Despacho, 149 €/mes: 5 personas, comunidades y modelos compartidos, 40 h/mes en bolsa común. IVA incluido, sin permanencia.", accion: { tab: "plans" } },

    { id: "cancelar", preguntas: ["cómo cancelo la suscripción", "cambiar la tarjeta", "descargar facturas", "darme de baja"],
      claves: ["cancelar", "baja", "tarjeta", "factura", "facturas", "gestionar"],
      respuesta: "Planes → «⚙️ Gestionar / cancelar suscripción» abre el portal seguro de Stripe: cambiar la tarjeta, descargar facturas o cancelar cuando quieras. Al cancelar vuelves al plan gratis sin perder tus datos.", accion: { tab: "plans" } },

    { id: "despacho", preguntas: ["cómo creo un despacho", "invitar a un compañero", "compartir comunidades con mi equipo", "plan de equipo", "cuántos asientos"],
      claves: ["despacho", "equipo", "invitar", "compañero", "asientos", "compartir"],
      respuesta: "Ajustes → «Mi despacho»: crea el despacho (gratis), invita a tus compañeros por correo (se genera un enlace que caduca en 7 días) y activa el plan Despacho cuando quieras. Las comunidades marcadas «Compartir con mi despacho», las voces calibradas y los modelos de acta los ven todos; las actas del equipo aparecen en la biblioteca de todos. 5 asientos y 40 h/mes en bolsa común.", accion: { tab: "settings" } },

    { id: "privacidad", preguntas: ["dónde se guardan mis datos", "el audio sale de mi ordenador", "es seguro", "rgpd", "quién ve mis actas"],
      claves: ["privacidad", "datos", "seguro", "rgpd", "servidor", "nube", "proteccion"],
      respuesta: "El audio se procesa en tu dispositivo y nunca se guarda en nuestros servidores. Cuando usas una función profesional, el audio va directo de tu navegador al proveedor de transcripción con un permiso temporal de 10 minutos. Las actas y transcripciones se guardan cifradas en tu cuenta, y cada cuenta solo ve lo suyo o lo de su despacho. Tienes la política de privacidad y el contrato de encargado del tratamiento en el pie de la web." },

    { id: "aviso", preguntas: ["tengo que avisar de que grabo", "aviso legal a los asistentes", "consentimiento para grabar", "es legal grabar la junta"],
      claves: ["aviso", "avisar", "legal", "consentimiento", "grabar", "informar"],
      respuesta: "Sí, hay que informar a los asistentes. El botón «📢 Aviso a los asistentes», junto a «Junta online», te da el texto preparado con la organización y el responsable: léelo al empezar, cópialo o envíalo a los destinatarios con la convocatoria." },

    { id: "palabras", preguntas: ["siempre transcribe mal un apellido", "añadir palabras", "vocabulario", "corrige mal el nombre de la comunidad", "correcciones"],
      claves: ["palabra", "palabras", "apellido", "vocabulario", "corrige", "correcciones", "termino"],
      respuesta: "Ajustes → «Palabras y nombres propios»: apunta los apellidos, el nombre de la comunidad y los tecnicismos que salen mal. La app los corrige sobre la marcha y se los avisa al motor profesional para que los acierte.", accion: { tab: "settings" } },

    { id: "borrar", preguntas: ["borrar todo", "eliminar mi cuenta", "borrar mis datos", "exportar todos los datos"],
      claves: ["borrar", "eliminar", "cuenta", "exportar", "datos"],
      respuesta: "Ajustes → Datos. «Exportar todos los datos» descarga una copia. «Borrar todo» limpia este dispositivo (antes descarga un ZIP completo y pide escribir BORRAR). «Eliminar mi cuenta» borra de forma inmediata y permanente tu cuenta y todo lo guardado en la nube.", accion: { tab: "settings" } },

    { id: "contrasena", preguntas: ["olvidé la contraseña", "no puedo entrar", "cambiar contraseña", "crear cuenta"],
      claves: ["contraseña", "password", "entrar", "acceso", "cuenta", "registro"],
      respuesta: "En la pantalla de acceso escribe tu correo y pulsa «¿Has olvidado tu contraseña?»: recibirás un enlace para crear una nueva. Para crear cuenta vale cualquier correo; no hace falta Google. Entra con el mismo correo en el PC y el móvil y lo tendrás todo." },

    { id: "pausa", preguntas: ["cómo pauso la grabación", "parar la grabación", "terminar la sesión", "se ha cortado la grabación"],
      claves: ["pausa", "pausar", "parar", "terminar", "cortado", "detener"],
      respuesta: "El botón ⏸ pausa y reanuda. Volver a pulsar el micrófono grande termina la sesión. Mientras grabas, la transcripción se guarda sola cada 15 segundos: si el navegador se cierra, al volver te ofrece recuperarla." },

    { id: "tutorial", preguntas: ["ver el tutorial", "guía paso a paso", "manual"],
      claves: ["tutorial", "guia", "manual", "paso"],
      respuesta: "Aquí tienes el tutorial completo por capítulos.", accion: { fn: "tutorial" } }
  ];

  /* --------------------------------------------------- normalización */
  var SINONIMOS = {
    micro: "microfono", mic: "microfono", microfono: "microfono",
    reunion: "junta", sesion: "junta", asamblea: "junta",
    comunidad: "organizacion", finca: "organizacion", empresa: "organizacion", cliente: "organizacion",
    hablantes: "hablante", participante: "hablante", participantes: "hablante", persona: "hablante", personas: "hablante", asistente: "hablante", asistentes: "hablante",
    email: "correo", mail: "correo", correos: "correo",
    dinero: "precio", cuesta: "precio", vale: "precio", pagar: "precio", coste: "precio",
    celular: "movil", telefono: "movil", smartphone: "movil",
    ia: "ia", inteligencia: "ia",
    transcripcion: "transcribir", transcribe: "transcribir", transcribo: "transcribir",
    grabacion: "grabar", grabo: "grabar", graba: "grabar",
    guarda: "guardar", guardo: "guardar", archivar: "guardar", archiva: "guardar",
    equipo: "despacho", oficina: "despacho",
    estilo: "modelo", estilos: "modelo", modelos: "modelo",
    voces: "voz", timbre: "voz",
    calibracion: "calibrar", calibro: "calibrar", calibra: "calibrar",
    doc: "word", docx: "word",
    suscripcion: "plan", suscribirme: "plan",
    zoom: "online", meet: "online", teams: "online", videollamada: "online"
  };
  var VACIAS = new Set("el la los las un una unos unas de del al a en y o que se me mi mis tu tus su sus es son para por con sin como cuando donde cual cuales quien hay hace hacer puedo puede pueden tengo tiene tener quiero esta este esto eso esa ese lo le les si no muy mas pero ya tambien algo nada todo todos aqui ahi alli entonces".split(" "));

  function sinTildes(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function raiz(w) {
    if (w.length > 5 && /(ciones|siones)$/.test(w)) return w.replace(/(c|s)iones$/, "$1ion");
    if (w.length > 4 && /es$/.test(w) && !/[aeiou]es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function tokens(s) {
    return sinTildes(String(s || "").toLowerCase())
      .replace(/[^a-z0-9ñ\s]/g, " ").split(/\s+/)
      .filter(function (w) { return w && !VACIAS.has(w); })
      .map(function (w) { var r = raiz(w); return SINONIMOS[w] || SINONIMOS[r] || r; });
  }

  /* Índice precalculado por entrada. */
  var INDICE = BASE.map(function (e) {
    var t = new Set();
    e.preguntas.forEach(function (p) { tokens(p).forEach(function (w) { t.add(w); }); });
    var c = new Set(tokens(e.claves.join(" ")));
    var r = new Set(tokens(e.respuesta));
    return { e: e, preg: t, claves: c, resp: r };
  });

  function puntuar(pregunta) {
    var q = tokens(pregunta);
    if (!q.length) return [];
    return INDICE.map(function (ix) {
      var s = 0;
      q.forEach(function (w) {
        if (ix.claves.has(w)) s += 3;
        else if (ix.preg.has(w)) s += 2;
        else if (ix.resp.has(w)) s += 0.5;
      });
      return { e: ix.e, s: s / Math.sqrt(q.length) };
    }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; });
  }

  /* -------------------------------------------------------- respuesta */
  var UMBRAL_SEGURO = 2.0, UMBRAL_DUDA = 1.1;

  function responderLocal(pregunta) {
    var r = puntuar(pregunta);
    if (!r.length) return { tipo: "nada", sugerencias: [] };
    var top = r[0];
    var otras = r.slice(1, 4).filter(function (x) { return x.s >= UMBRAL_DUDA * 0.6; }).map(function (x) { return x.e; });
    if (top.s >= UMBRAL_SEGURO) return { tipo: "segura", entrada: top.e, sugerencias: otras };
    if (top.s >= UMBRAL_DUDA) return { tipo: "duda", entrada: top.e, sugerencias: otras };
    return { tipo: "nada", sugerencias: r.slice(0, 3).map(function (x) { return x.e; }) };
  }

  /* Texto de la base para la IA: solo lo que la app hace de verdad. */
  function baseParaIA() {
    return BASE.map(function (e) { return "- " + e.preguntas[0] + ": " + e.respuesta; }).join("\n");
  }

  async function responderIA(pregunta) {
    if (typeof window.tokenSesion !== "function") throw new Error("sin_sesion");
    var tok = await window.tokenSesion();
    if (!tok) throw new Error("sin_sesion");
    var r = await fetch(SB_URL + "/functions/v1/ayuda", {
      method: "POST",
      headers: { Authorization: "Bearer " + tok, apikey: SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ pregunta: pregunta, contexto: baseParaIA() })
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || "error");
    return j.respuesta;
  }

  /* -------------------------------------------------------------- UI */
  var CHIPS = ["¿Cómo empiezo?", "¿Qué micrófono uso?", "Junta con muchos vecinos", "¿Cómo redacto el acta?", "Junta por Zoom o Meet", "¿Cuánto cuesta?"];

  function $1(s) { return document.querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function montar() {
    if ($1("#asisPanel")) return;
    var css = document.createElement("style");
    css.textContent =
      "#asisPanel{position:fixed;right:18px;bottom:18px;width:380px;max-width:calc(100vw - 24px);height:560px;max-height:calc(100vh - 40px);" +
      "background:#0e1420;border:1px solid #232d47;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.55);z-index:300;display:flex;flex-direction:column;overflow:hidden}" +
      "#asisPanel.hide{display:none}" +
      "#asisCab{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #232d47;background:#0a0e1a}" +
      "#asisCab b{font-size:14px}#asisCab .sub{font-size:11px;color:#6f7894;margin:0}" +
      "#asisCab button{margin-left:auto;background:none;border:0;color:#8b96b3;font-size:18px;cursor:pointer}" +
      "#asisHilo{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}" +
      ".asisMsg{max-width:88%;padding:10px 12px;border-radius:12px;font-size:13.5px;line-height:1.5;white-space:pre-wrap}" +
      ".asisMsg.yo{align-self:flex-end;background:#3D7BFF;color:#fff;border-bottom-right-radius:4px}" +
      ".asisMsg.el{align-self:flex-start;background:#161c2e;color:#e5eaf5;border-bottom-left-radius:4px}" +
      ".asisMsg .ir{display:inline-block;margin-top:8px;padding:5px 10px;border-radius:8px;background:#0a0e1a;border:1px solid #3D7BFF;color:#9db9ff;font-size:12px;cursor:pointer}" +
      "#asisChips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px}" +
      "#asisChips button{background:#161c2e;border:1px solid #232d47;color:#c9d1e3;border-radius:999px;padding:5px 10px;font-size:12px;cursor:pointer}" +
      "#asisForm{display:flex;gap:8px;padding:10px 14px 14px;border-top:1px solid #232d47}" +
      "#asisForm input{flex:1;background:#0a0e1a;border:1px solid #232d47;border-radius:10px;color:#e5eaf5;padding:10px 12px;font-size:13.5px}" +
      "#asisForm button{background:#3D7BFF;color:#fff;border:0;border-radius:10px;padding:0 14px;font-weight:600;cursor:pointer}" +
      "#asisBoton{position:fixed;right:18px;bottom:18px;z-index:299;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#3D7BFF,#22d3ee);" +
      "color:#05070f;border:0;font-size:22px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(61,123,255,.45)}" +
      "#asisBoton.hide{display:none}" +
      "@media(max-width:600px){#asisPanel{right:8px;bottom:8px;width:calc(100vw - 16px);height:calc(100vh - 16px)}}";
    document.head.appendChild(css);

    var b = document.createElement("button");
    b.id = "asisBoton"; b.title = "Asistente de ConsteAi"; b.textContent = "?";
    b.onclick = abrir;
    document.body.appendChild(b);

    var p = document.createElement("div");
    p.id = "asisPanel"; p.className = "hide";
    p.innerHTML =
      '<div id="asisCab"><div><b>Asistente de ConsteAi</b><p class="sub">Pregúntame cómo usar o configurar la app</p></div><button id="asisCerrar" title="Cerrar">✕</button></div>' +
      '<div id="asisHilo"></div>' +
      '<div id="asisChips"></div>' +
      '<form id="asisForm"><input id="asisIn" placeholder="Escribe tu pregunta…" autocomplete="off"><button type="submit">Enviar</button></form>';
    document.body.appendChild(p);
    $1("#asisCerrar").onclick = cerrar;
    $1("#asisForm").onsubmit = function (ev) { ev.preventDefault(); var v = $1("#asisIn").value.trim(); if (v) { $1("#asisIn").value = ""; preguntar(v); } };
    pintarChips(CHIPS);
    burbuja("el", "Hola. Soy el asistente de ConsteAi: respondo dudas sobre cómo usar y configurar la app. Pregunta con tus palabras o elige una de abajo.");
  }

  function pintarChips(lista) {
    var c = $1("#asisChips"); c.innerHTML = "";
    lista.forEach(function (t) {
      var b = document.createElement("button"); b.textContent = t;
      b.onclick = function () { preguntar(t); };
      c.appendChild(b);
    });
  }

  function burbuja(quien, texto, accion) {
    var h = $1("#asisHilo");
    var d = document.createElement("div"); d.className = "asisMsg " + quien;
    d.textContent = texto;
    if (accion) {
      var ir = document.createElement("span"); ir.className = "ir";
      ir.textContent = accion.fn === "tutorial" ? "Abrir el tutorial" : "Llévame ahí";
      ir.onclick = function () { ejecutar(accion); };
      d.appendChild(document.createElement("br")); d.appendChild(ir);
    }
    h.appendChild(d); h.scrollTop = h.scrollHeight;
    return d;
  }

  function ejecutar(a) {
    if (!a) return;
    if (a.fn === "tutorial" && typeof abrirTutorial === "function") { cerrar(); abrirTutorial(0); return; }
    if (a.tab) {
      var b = document.querySelector('nav button[data-tab="' + a.tab + '"]');
      if (b) b.click();
      if (window.innerWidth < 700) cerrar();
    }
  }

  var ocupado = false;
  async function preguntar(texto) {
    if (ocupado) return;
    burbuja("yo", texto);
    if (window.aEvento) window.aEvento("ayuda");
    var r = responderLocal(texto);
    if (r.tipo === "segura" || r.tipo === "duda") {
      burbuja("el", (r.tipo === "duda" ? "Creo que preguntas por esto:\n\n" : "") + r.entrada.respuesta, r.entrada.accion);
      if (r.sugerencias.length) pintarChips(r.sugerencias.map(function (e) { return e.preguntas[0]; }).concat(["Otra pregunta"]));
      else pintarChips(CHIPS);
      return;
    }
    // No lo entiende: sugiere lo más parecido y ofrece la IA si hay sesión.
    var sug = r.sugerencias.map(function (e) { return e.preguntas[0]; });
    if (window.sesionActiva) {
      ocupado = true;
      var pensando = burbuja("el", "Déjame mirarlo…");
      try {
        var resp = await responderIA(texto);
        pensando.textContent = resp || "No he encontrado nada sobre eso en la app.";
      } catch (e) {
        var m = e && e.message;
        pensando.textContent =
          m === "limite" ? "Has llegado al máximo de preguntas a la IA por hoy. Prueba con otras palabras o mira el tutorial." :
          m === "fuera_de_tema" ? "Solo puedo ayudarte con el uso y la configuración de ConsteAi." :
          "No he sabido responder a eso. ¿Quizá preguntabas por alguna de estas?";
      }
      ocupado = false;
    } else {
      burbuja("el", "No he entendido la pregunta. ¿Quizá es alguna de estas? (Con sesión iniciada también puedo consultar a la IA.)");
    }
    pintarChips(sug.length ? sug.concat(["Ver el tutorial"]) : CHIPS);
  }

  function abrir() { montar(); $1("#asisPanel").classList.remove("hide"); $1("#asisBoton").classList.add("hide"); setTimeout(function () { var i = $1("#asisIn"); if (i) i.focus(); }, 50); }
  function cerrar() { $1("#asisPanel").classList.add("hide"); $1("#asisBoton").classList.remove("hide"); }

  window.abrirAsistente = function (pregunta) { abrir(); if (pregunta) preguntar(pregunta); };
  window.__asistente = { responderLocal: responderLocal, base: BASE };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
  else montar();
})();
