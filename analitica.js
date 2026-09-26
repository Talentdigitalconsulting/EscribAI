/* =====================================================================
   EscribAI · analitica.js — medición sin cookies

   No usa cookies, ni localStorage, ni sessionStorage, ni huellas de
   dispositivo. No identifica a nadie ni sigue a la gente entre webs:
   solo cuenta cuántas veces ocurre cada cosa. Por eso la web no
   necesita banner de consentimiento.

   Uso:  aEvento("clic_probar")
===================================================================== */
(function () {
  "use strict";
  var URL_EVENTO = "https://tbaliejmtaeniffmqgif.supabase.co/functions/v1/evento";

  function pagina() {
    var p = (location.pathname || "").split("/").pop() || "index.html";
    return p.slice(0, 60);
  }
  function dispositivo() {
    return (window.matchMedia && window.matchMedia("(max-width: 780px)").matches) ? "movil" : "escritorio";
  }

  window.aEvento = function (nombre) {
    try {
      var datos = JSON.stringify({
        evento: nombre,
        pagina: pagina(),
        origen: document.referrer || "",
        disp: dispositivo()
      });
      // sendBeacon no bloquea la navegación ni retrasa la página.
      // IMPORTANTE: el tipo tiene que ser text/plain. Con application/json
      // el navegador exige una comprobación previa de CORS que sendBeacon
      // no sabe hacer, y descarta el envío sin avisar. El servidor lee el
      // cuerpo como JSON igualmente.
      var enviado = false;
      if (navigator.sendBeacon) {
        enviado = navigator.sendBeacon(
          URL_EVENTO,
          new Blob([datos], { type: "text/plain;charset=UTF-8" })
        );
      }
      if (!enviado) {
        fetch(URL_EVENTO, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: datos,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) { /* la analítica jamás debe romper la app */ }
  };

  // Visita: una sola vez por carga de página.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { window.aEvento("visita"); });
  } else {
    window.aEvento("visita");
  }
})();
