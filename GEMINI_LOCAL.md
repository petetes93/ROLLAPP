# Gemini como narrador, con la app en local

La app sigue ejecutándose en el equipo. El pequeño proxy local guarda la clave fuera del navegador y envía a Gemini solo el contexto narrativo necesario para responder cada turno.

## Arranque

1. Crea una clave restringida de Gemini en Google AI Studio y mantén el proyecto en la capa Free, sin vincular facturación.
2. Define la clave solo para esta terminal:

```bash
export GEMINI_API_KEY="tu-clave"
```

En PowerShell:

```powershell
$env:GEMINI_API_KEY="tu-clave"
```

3. Arranca el proxy y la app en dos terminales:

```bash
node tools/gemini-proxy.mjs
node tools/servir.mjs
```

4. Abre `http://localhost:8080/app/index.html`. En **Narrador > IA local** usa:

- Dirección: `http://127.0.0.1:11435`
- Modelo: `gemini-3.5-flash`

Pulsa **Probar conexión** y después **Usar IA local**.

La clave no se guarda en el juego, `localStorage`, el guardado ni Git. Al cerrar la terminal del proxy desaparece del proceso. La capa Free tiene límites y puede cambiar; comprueba el estado del proyecto en AI Studio.
