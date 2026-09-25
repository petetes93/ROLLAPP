# Control de calidad de arte

Todo el catálogo raster es original de ARCANVEIL. No usa el ejemplo de Pixabay ni activos, logos, monstruos o personajes de terceros.

## Gate antes de publicar

Cada imagen se revisa a tamaño completo, ampliada al 100-200% y en su recorte real del juego:

- **la ficha manda**: la imagen representa lo que dice su ficha (`enemies.data.js`, `locations.data.js`, `rasgos.data.js`): especie, silueta, escala, equipo, materiales, arquitectura. Estar asignada al `refId` correcto no basta;
- anatomía: manos, dedos, ojos, boca, extremidades y uniones;
- simetría y continuidad: cuernos, alas, armadura, ropa, armas y joyas;
- perspectiva, arquitectura, luz y silueta;
- texto, marcas, símbolos espurios y artefactos de generación;
- coherencia de paleta: índigo/ciruela, bronce, pergamino y luz cálida;
- lectura móvil dentro de 5:6, 5:2 o 1:1, según el tipo, y en el recorte de verdad (cabecera apaisada, miniatura de combate).

Una pieza que no pase se regenera o se descarta. Si no hay una imagen fiel, se usa el dibujo vectorial de respaldo: engaña menos una silueta neutra que una imagen que contradice la ficha.

## Revisión semántica · 25-sep-2026

El gate anterior no comprobaba la fidelidad a la ficha, y el catálogo no la pasa. Revisión completa, pieza por pieza y con el texto de la ficha: [ART_REVISION.md](ART_REVISION.md).

| | coincide | coincide parcialmente | no coincide |
|---|---|---|---|
| Criaturas (13) | 1 | 5 | 7 |
| Paisajes (19) | 0 | 8 | 11 |

- **Fuera del manifiesto** (vuelve el vector hasta tener una imagen fiel): las criaturas `carronero`, `saqueador`, `guardia_corrupto`, `tejedora_de_umbral`, `ejecutor_albar`, `guardian_de_la_puerta` y `senora_del_pantano`, y los paisajes `vado_yunque`, `camino_norte`, `saucedo`, `tumbas_bajas`, `linde_cenizo`, `senda_raices`, `forja_alta`, `galerias_hondas`, `pilotes_brumal`, `umbral_albar` y `pozos_hondos`. Los archivos se conservan para regenerarlos; en ART_REVISION.md está lo que debería mostrar cada uno.
- **Se quedan** las que coinciden o coinciden en parte. Varias parciales merecen regenerarse (ver la tabla).
- Unos 16 de los 19 paisajes repiten la misma vista épica (terraza, castillos, cascadas, atardecer); ninguno de los pueblos humildes parece humilde.
- **No verificado**: que el dibujo vectorial de respaldo respete cada ficha. Es una silueta genérica por tipo y tamaño; en combate se amplía para que se reconozca.

## Lote en el repositorio

- 19 escenas jugables, 800×320 WebP (8 en el manifiesto).
- 13 enemigos jugables, 320×320 WebP (6 en el manifiesto).
- Los 8 retratos canónicos de linaje se retiraron del repositorio: competían con la cara que el jugador describe.

Los personajes descritos por el jugador usan el retrato generado a partir de su descripción, con opción de pedir otra versión o quedarse con el dibujado; sin descripción, el vectorial del linaje.
