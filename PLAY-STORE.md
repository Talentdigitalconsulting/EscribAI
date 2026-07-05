# 🤖 Publicar EscribAI en Google Play

Tu app ya está publicada en **https://talentdigitalconsulting.github.io/EscribAI/** — Google Play acepta apps web empaquetadas como **TWA** (Trusted Web Activity). El empaquetado lo hace gratis **PWABuilder**, de Microsoft.

## Requisitos previos

1. La app funcionando en tu URL (✅ ya está).
2. Cuenta de desarrollador de Google Play: **25 USD, pago único** → https://play.google.com/console/signup

## Pasos con PWABuilder (15 minutos)

1. Entra en **https://www.pwabuilder.com** y pega `https://talentdigitalconsulting.github.io/EscribAI/`.
2. Pulsa **Package for Stores → Android**.
3. Rellena: Package ID `com.escribai.app`, App name `EscribAI`, versión `1.0.0`. Deja "Signing key: New".
4. Descarga el paquete: obtendrás un **.aab** (para subir a Play) y un archivo **assetlinks.json**.
5. **Importante:** ese `assetlinks.json` debe subirse al repositorio en `.well-known/assetlinks.json` (sin él, la app se abre con barra de navegador). Pásaselo a tu agente y lo sube.
6. En **Play Console**: Crear aplicación → sube el `.aab` → rellena la ficha:
   - Descripción corta: "Escucha, transcribe, identifica quién habla y genera el acta automáticamente."
   - Capturas: abre la app en el móvil y haz 4-6 capturas.
   - Política de privacidad: `https://talentdigitalconsulting.github.io/EscribAI/privacidad.html`
   - Permisos: micrófono → "grabación y transcripción de voz iniciada por el usuario".
7. Envía a revisión (1-3 días).

## Cobrar

- App de pago (ej. 4,99€) en Play Console → Precio. Lo más simple.
- O app gratis + licencia Pro vendida por tu web (Stripe/Gumroad): sin comisión del 15-30% de Google.

## iPhone

PWABuilder genera paquete iOS, pero Apple exige cuenta de desarrollador (99 USD/año) y Mac. Alternativa gratis: PWA desde Safari ("Añadir a pantalla de inicio").
