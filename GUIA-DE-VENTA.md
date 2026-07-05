# 💰 Guía para vender EscribAI

## Lo que ya tienes

- `index.html` — la aplicación completa (el producto).
- `venta.html` — landing de venta con planes Básico (0€) / Pro (9,99€/mes) / Empresas (29€/mes).
- `VozScribe.bat` — lanzador de escritorio para Windows (puedes incluirlo como "versión PC" del producto).
- PWA instalable en móvil (ver `INSTALAR-EN-MOVIL.md`).

## Plan de lanzamiento en 4 pasos

### 1. Publica (día 1)
Sube la carpeta a Netlify (gratis, ver INSTALAR-EN-MOVIL.md). Configura `venta.html` como página principal: renómbrala a `index.html` y a la app llámala `app.html` (o usa un subdominio `app.tudominio.com`). Compra un dominio (~10€/año, ej. `vozscribe.es` en Namecheap o Porkbun).

### 2. Cobra (día 2)
La forma más simple sin programar backend: **Stripe Payment Links**.
1. Crea cuenta en stripe.com → Productos → añade "EscribAI 9,99€/mes".
2. Genera el Payment Link y pégalo en `venta.html` donde pone `#ENLACE-STRIPE-PRO`.
3. En "después del pago", redirige a una página con la app completa (ej. `app.html?plan=pro`).

Alternativas sin Stripe: Gumroad o Lemon Squeezy (gestionan IVA europeo por ti — recomendable al principio).

### 3. Diferénciate (semana 1)
- Activa el plan Empresas con tu clave de Deepgram en un mini-backend (Cloudflare Workers gratis) para no exponer la key: el navegador envía el audio a tu worker y este a Deepgram. Coste real: ~0,25€/hora de audio; cóbralo a 29€/mes.
- El gancho de venta: **privacidad** (nada sale del dispositivo) + **español de España** + **identificación de hablantes**. Otter, Fireflies y compañía son en inglés, caros y suben todo a la nube.

### 4. Vende (continuo)
Clientes ideales: gestorías y despachos (actas de junta), clínicas y psicólogos (notas de consulta, privacidad clave), formadores y academias, ayuntamientos y comunidades de vecinos (actas), periodistas (entrevistas).
Canales: LinkedIn con vídeo demo de 30 s, grupos de Facebook de gestores/administradores de fincas, Google Ads para "transcribir reunión español".

## Precios sugeridos (validados con el mercado)

| Plan | Precio | Margen |
|---|---|---|
| Básico | 0€ | Captación |
| Pro | 9,99€/mes o 79€/año | ~100% (sin costes variables) |
| Empresas | 29€/mes | Alto (Deepgram cuesta céntimos) |
| Licencia de por vida (lanzamiento) | 49€ pago único | Ideal para las primeras 100 ventas |

## Aviso legal mínimo

Antes de cobrar: aviso legal + política de privacidad en la web (hay generadores gratuitos), alta de autónomo o facturación por cooperativa, y RGPD: como los datos se quedan en el dispositivo del cliente, tu exposición es mínima — es tu mejor argumento de venta.

*Nota: esto es orientación general, no asesoramiento legal o fiscal; para tu caso concreto consulta con una gestoría.*
