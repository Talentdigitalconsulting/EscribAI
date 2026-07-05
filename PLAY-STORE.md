# 🤖 Publicar VozScribe Pro en Google Play (desde GitHub Pages)

Una vez la app esté en tu URL de GitHub Pages (`https://TU-USUARIO.github.io/vozscribe/`), Google Play acepta apps web empaquetadas como **TWA** (Trusted Web Activity). El empaquetado lo hace gratis **PWABuilder**, de Microsoft.

## Requisitos previos

1. La app funcionando en tu URL de GitHub Pages (eso lo dejamos hecho).
2. Cuenta de desarrollador de Google Play: **25 USD, pago único** → https://play.google.com/console/signup

## Pasos con PWABuilder (15 minutos)

1. Entra en **https://www.pwabuilder.com** y pega tu URL de GitHub Pages.
2. Pulsa **Package for Stores → Android**.
3. Rellena: Package ID `com.vozscribe.app`, App name `VozScribe Pro`, versión `1.0.0`. Deja "Signing key: New" (PWABuilder genera la firma).
4. Descarga el paquete: obtendrás un **.aab** (para subir a Play) y un archivo **assetlinks.json**.
5. **Importante:** sube ese `assetlinks.json` al repositorio en la ruta `.well-known/assetlinks.json` (esto verifica que la app y la web son tuyas; sin él, la app se abre con barra de navegador). Pídemelo y lo subo yo al repo.
6. En **Play Console**: Crear aplicación → sube el `.aab` en Producción → rellena la ficha:
   - Descripción corta: "Transcribe reuniones, identifica quién habla y genera el acta automáticamente."
   - Capturas: abre la app en el móvil y haz 4-6 capturas.
   - **Política de privacidad:** usa tu URL `https://TU-USUARIO.github.io/vozscribe/privacidad.html` (ya incluida en el repo).
   - Declaración de permisos: micrófono → "grabación y transcripción de voz iniciada por el usuario".
7. Envía a revisión (suele tardar 1-3 días).

## Cobrar en Play Store

- App de pago (ej. 4,99€): lo configuras en Play Console → Precio. Lo más simple.
- O app gratis + suscripción Pro con Google Play Billing: requiere programación adicional; para empezar, más sencillo cobrar la suscripción vía web (Stripe) y dejar la app de Play como puerta de entrada.

## iPhone (App Store)

PWABuilder también genera paquete iOS, pero Apple exige cuenta de desarrollador (99 USD/año) y Mac para firmar. Alternativa sin coste: los usuarios de iPhone instalan la PWA desde Safari ("Añadir a pantalla de inicio").
