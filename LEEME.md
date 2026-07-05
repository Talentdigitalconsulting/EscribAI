# 🎙️ EscribAI

Transcripción de reuniones en español con identificación de hablantes y resúmenes automáticos. PWA instalable, 100% local por defecto (sin costes ni servidores).

## Cómo usarla

**Opción rápida:** abre `index.html` con **Google Chrome o Microsoft Edge** (el reconocimiento de voz no funciona en Firefox/Safari).

**Como app instalable (PWA):** la instalación requiere servirla por HTTP:

1. Local: en la carpeta, ejecuta `python -m http.server 8080` y abre `http://localhost:8080`.
2. O súbela gratis a Netlify, Vercel o GitHub Pages (arrastra la carpeta).
3. En Chrome aparecerá el botón **"Instalar"** en la barra de direcciones → se instala como app con su icono.

## Flujo de trabajo

1. **Ajustes** → elige idioma (es-ES por defecto, cubre todos los acentos de España).
2. **＋ Añadir hablante** → nombre, color y calibración de voz (6 s leyendo una frase). La app extrae el timbre (frecuencia fundamental y brillo espectral) de cada voz.
3. Pulsa el **micrófono** → transcribe en tiempo real y asigna cada intervención al hablante cuyo perfil de voz coincide. Puedes corregir hablante o texto pasando el ratón sobre cada burbuja.
4. **✨ Generar resumen** → decisiones, tareas, fechas, preguntas abiertas, temas y participación por hablante.
5. Exporta: **TXT**, **Acta en Markdown**, **JSON**, **audio (.webm)** o guarda la sesión en el historial.

## Modo IA (opcional)

En Ajustes puedes guardar una API key de **Deepgram** (recomendado: diarización profesional en español) u **OpenAI Whisper**. El botón **🤖 Mejorar con IA** reprocesa el audio grabado con diarización de nivel profesional. Sin key, todo funciona local y gratis.

## Privacidad

Todo (perfiles de voz, sesiones, ajustes) se guarda solo en el dispositivo (localStorage). Nada sale del equipo salvo que uses el modo IA.

## Nota técnica para venderla

- El reconocimiento en vivo usa la Web Speech API del navegador (Chrome la procesa en sus servidores; gratuita e ilimitada para el usuario).
- La identificación local de hablantes es una aproximación por tono/timbre: funciona bien con voces diferenciadas (ej. hombre/mujer o registros distintos). Para precisión comercial garantizada, activa el modo Deepgram.
- Para monetizar: despliega en un dominio propio, añade login + Stripe, y usa tu key de Deepgram en un pequeño backend (para no exponerla).
