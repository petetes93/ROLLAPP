# Imágenes

Esta carpeta está vacía a propósito. **El juego no la necesita**: todo el arte
lo genera `src/art/` como SVG, en el navegador, sin red y sin archivos.

Lo que hay aquí es la puerta para sustituir ese arte vectorial por imágenes de
verdad —dibujadas o generadas— sin tocar una línea de código.

## Cómo meter una imagen

1. Deja el archivo en la subcarpeta que le toque.
2. Decláralo en `manifest.json`.
3. Recarga. Nada más.

```
assets/
  manifest.json
  paisajes/vado_yunque.webp
  retratos/griscuerno.webp
  criaturas/lobo_ceniciento.webp
```

```json
{
  "paisajes":  { "vado_yunque": "paisajes/vado_yunque.webp" },
  "retratos":  { "griscuerno": "retratos/griscuerno.webp" },
  "criaturas": { "lobo_ceniciento": "criaturas/lobo_ceniciento.webp" }
}
```

Las rutas se resuelven **contra el propio `manifest.json`**, no contra la
página, así que `paisajes/vado_yunque.webp` es `assets/paisajes/vado_yunque.webp`
sin importar desde dónde se abra el juego.

Las claves son los `refId` de los catálogos: `src/data/locations.data.js`,
`races.data.js` y `enemies.data.js`. Un `refId` sin entrada en el manifiesto
sigue saliendo en vector, así que se puede ir sustituyendo de una en una.

## Cómo se comporta el cargador

El SVG se pinta **siempre primero** y la imagen lo sustituye después, ya
cargada. Al revés se vería un hueco mientras carga, y si el archivo falta, el
hueco se quedaría. Un icono de imagen rota es peor que un vector.

Si un archivo declarado no carga, se apunta y no se reintenta: el vector se
queda y no hay una petición fallida por turno.

## Lo que se pierde al pasar a imágenes

El paisaje vectorial **reacciona al estado del mundo**: el mismo lugar cambia
con la franja horaria y con el clima. Son 7 franjas × 8 climas = 56 variantes
por lugar, generadas al vuelo.

Una imagen fija sustituye las 56 por una. Si eso importa, se puede declarar
solo el retrato y la criatura y dejar el paisaje en vector, que es donde el
código gana.

## Dos salidas de empaquetado

- **Carpeta servida por HTTP** — las imágenes de `assets/` se cargan.
- **Archivo único** (`node tools/bundle.mjs`) — no hay `assets/` que valga,
  así que todo sale en vector. Es lo previsto: el archivo único se abre con
  doble clic y no puede depender de archivos sueltos al lado.

## Formato recomendado

WebP, calidad 82. Retratos 400×480, criaturas 320×320, paisajes 800×320: son
las proporciones de los lienzos de `src/art/`, y respetarlas evita recortes.
