# Retratos generados localmente

ROLLAPP puede sustituir el retrato procedural por una pintura generada en tu PC a partir del linaje, la descripción libre y una semilla estable. Si el generador está apagado, la app conserva el retrato procedural y nunca queda en blanco.

## Backend recomendado: ComfyUI

1. Instala y abre ComfyUI en Windows. Debe responder en `http://127.0.0.1:8188`.
2. Coloca un checkpoint compatible en `ComfyUI/models/checkpoints`. Por defecto el puente busca `sd_xl_base_1.0.safetensors`.
3. Desde la carpeta de ROLLAPP ejecuta:

```powershell
$env:ROLLAPP_IMAGE_MODEL='sd_xl_base_1.0.safetensors'; node tools/imagen-local-proxy.mjs
```

4. Abre ROLLAPP normalmente. Al escribir al menos 8 caracteres en la descripción, la vista procedural aparece de inmediato y la pintura local la sustituye al terminar. La primera generación tarda más; las siguientes con los mismos criterios salen de `.rollapp-images`.

Variables opcionales:
- `COMFY_URL`: dirección de ComfyUI. Predeterminada `http://127.0.0.1:8188`.
- `ROLLAPP_IMAGE_PORT`: puerto del puente. Predeterminado `11436`.
- `ROLLAPP_IMAGE_MODEL`: nombre exacto del checkpoint instalado.

Todo ocurre en loopback y en el PC. No hay claves, cuenta, API remota ni coste por imagen.
