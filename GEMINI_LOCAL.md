# Gemini como narrador, con la app en local

La app sigue ejecutándose en el equipo. El proxy local guarda la clave fuera del navegador y envía a Gemini solo el contexto narrativo necesario para responder cada turno.

## Antes de arrancar

- Instala Node.js 18 o posterior.
- En Google AI Studio, comprueba que el proyecto indica **Free** y que Facturación dice **No hay una cuenta de facturación**.
- No actives facturación, prepago ni límites de inversión.
- Copia la clave solo cuando vayas a iniciar la app. No la pegues en WhatsApp, en archivos del proyecto ni en el navegador.

## Arranque con un solo comando

### Windows PowerShell

Reemplaza `PEGA_AQUI_TU_CLAVE` y ejecuta esta línea desde la carpeta de ROLLAPP:

```powershell
$env:GEMINI_API_KEY='PEGA_AQUI_TU_CLAVE'; node tools/iniciar-gemini.mjs
```

### macOS o Linux

Reemplaza `PEGA_AQUI_TU_CLAVE` y ejecuta esta línea desde la carpeta de ROLLAPP:

```bash
GEMINI_API_KEY='PEGA_AQUI_TU_CLAVE' node tools/iniciar-gemini.mjs
```

Abre `http://localhost:8080/app/index.html`. En **Narrador > IA local** usa:

- Dirección: `http://127.0.0.1:11435`
- Modelo: `gemini-3.5-flash`

La web ya propone esos dos valores. Abre **Narrador**, pulsa **Probar conexión** y después **Usar IA local**. Cuando termines, pulsa `Ctrl+C`; al cerrar la terminal la clave desaparece del proceso.

Si cambias el puerto con `ROLLAPP_PORT`, el lanzador configura también el origen permitido del proxy. Para servir la web desde otro host, fija `ROLLAPP_ORIGIN` de forma explícita.

## Seguridad y capa gratuita

La clave no se guarda en el juego, `localStorage`, una partida guardada ni Git. El navegador solo habla con el proxy en `127.0.0.1`. La capa Free tiene límites y puede cambiar; comprueba su estado en AI Studio antes de usarla.
