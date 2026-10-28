# ConsteAi — Lista antes de abrir la puerta

Guardada el 28/10/2026. El software está terminado y probado en producción;
esto es lo que queda y solo puede hacerlo Jesús, en este orden.

1. **Prueba de fuego con micrófono (15 min).** Reunión real de dos personas
   con la cuenta Pro: una vez con el motor del navegador y otra con el
   profesional en directo (Ajustes → Motor de dictado en directo). Si el
   profesional no conecta, la app cae sola al navegador y lo avisa.
2. **Pago de prueba de verdad.** Contratar el Pro mensual con tarjeta propia,
   comprobar que el plan se activa solo en segundos y cancelar desde el
   portal. 19 € que quitan la duda de si el cobro funciona.
3. **Stripe:** verificar el teléfono (lo pide la cuenta) y cambiar el
   descriptor bancario `T&DC SERVICE` por algo reconocible (`CONSTEAI TDC`).
4. **Dominio.** Comprar `consteai.es` y apuntar el DNS. CORS, CSP y enlaces de
   invitación ya contemplan ese dominio; solo hay que cambiar `APP_URL` en la
   función `despacho` y renombrar el repositorio cuando apunte.
5. **Abogado:** que lea `encargado.html` antes de que lo firme el primer despacho.
6. **Supabase Pro (25 $/mes)** cuando entre el primer cliente: el plan gratuito
   pausa el proyecto sin actividad y limita el ancho de banda.
7. **Primera semana con clientes:** mirar la tabla `eventos` cada mañana (ahí
   caen los errores reales) y anotar qué piden.
8. **Alta de autónomo** el mes del primer cobro (decisión de Jesús).

Pendientes menores que no bloquean:
- Asiento extra del plan Despacho (25 €) no existe como producto en Stripe;
  hoy se amplía a mano en la columna `asientos`.
- El webhook de Stripe vive en Supabase con el nombre `dynamic-function`.
- Borrar el token de GitHub antiguo en Settings → Developer settings si sigue listado.
- Regenerar `CODIGO-FUENTE-*-limpio.txt` (está obsoleto).
