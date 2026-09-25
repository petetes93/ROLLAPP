# Gemini: ruta heredada y desactivada

**No es la vía del juego.** La narración con IA va por Groq: mira [GROQ_LOCAL.md](GROQ_LOCAL.md).

Esta ruta se conserva como código separado y **no** aparece en el selector ni actúa como respaldo de nada. Los términos de la API gratuita de Gemini reservan a los servicios de pago los clientes con usuarios en el EEE, Suiza y el Reino Unido. Por eso no sirve para un juego publicado en España.

Si aun así quieres probarla en tu equipo:

1. En Google AI Studio, comprueba que el proyecto está en **Free** y que no hay cuenta de facturación.
2. Desde la carpeta de ARCANVEIL:

   ```powershell
   node tools/iniciar-gemini.mjs
   ```

   La clave se pide **sin eco**: no se ve al pegarla, no queda en el historial de la terminal y no se escribe en disco. Solo la recibe el proceso del proxy, no el servidor de la app.
3. En el juego, abre **Narrador › Modelo instalado en este PC** y pon `http://127.0.0.1:11435` y el modelo `gemini-3.5-flash`.

Aviso: el proxy de Gemini no tiene las protecciones del de Groq (comprobación de Host y Origin, topes, trazas sin contenido). Es otra razón para no usarlo más que en pruebas.

Ya no se enseña a poner la clave en una variable con `$env:GEMINI_API_KEY='…'`: esa línea queda guardada en el historial de PowerShell.
