# Pruebas

ARCANVEIL no tiene pruebas automáticas. Es una decisión deliberada: montar un
entorno de pruebas exigiría una dependencia de desarrollo, y el proyecto se
define por no tener ninguna. A cambio, aquí está el guion de lo que hay que
comprobar a mano, con el orden que encuentra los fallos antes.

Cada bloque tiene un **criterio de fallo**: qué significa que algo esté mal, no
solo qué hacer. Sin eso, un guion de pruebas se convierte en una lista de clics.

---

## Antes de empezar

```bash
node tools/servir.mjs
```

Abre `http://localhost:8080` y ten la consola del navegador visible. **Cualquier
error en rojo durante las pruebas es un fallo**, aunque el juego siga
funcionando.

La consola expone `window.ARCANVEIL` con los atajos que se usan más abajo.

---

## 1 · Arranque

| Comprobar | Criterio de fallo |
|---|---|
| La pantalla de inicio aparece en menos de dos segundos | Pantalla en blanco o error de módulo en consola |
| No hay errores en consola | Cualquier excepción no capturada |
| «Continuar» está oculto si no hay partidas | Aparece y al pulsarlo falla |

**Comprobación de arranque limpio:**

```js
ARCANVEIL.ver('meta.fase')     // 'menu'
ARCANVEIL.inspeccionar()       // todos los sistemas 'arrancado'
```

Si algún sistema aparece como `pendiente` o `fallido`, el orden de registro en
`main.js` está mal. `TurnResolver` debe ir último y `World` después de sus
subsistemas.

---

## 2 · Creación de personaje

La entrevista conversacional es la parte más frágil del flujo, porque interpreta
texto libre. Prueba estas cuatro entradas:

**Entrada explícita.** Debería deducir todo sin preguntar.

> *«Soy Kelra, una ferrana herrera que dejó su clan por una deuda que no era
> suya.»*

**Entrada vaga.** Debería preguntar lo que falte.

> *«Alguien que huye de algo.»*

**Entrada contradictoria.** Debería elegir lo más probable y no romperse.

> *«Un enano élfico que es a la vez guerrero y mago.»*

**Entrada vacía.** El botón «Créamelo tú» debe generar un personaje completo.

| Comprobar | Criterio de fallo |
|---|---|
| El reparto de atributos suma exactamente lo previsto | Puntos que no cuadran o negativos |
| La vista previa refleja los cambios en vivo | Se queda desincronizada |
| Al confirmar, el personaje entra con equipo inicial | Inventario vacío |
| El lugar de partida corresponde al linaje | Un ferrano que empieza en el pantano |

```js
ARCANVEIL.ver('player')        // nombre, raza, clase, atributos completos
ARCANVEIL.ver('world.ubicacion')
```

---

## 3 · Turno básico

Escribe estas cinco acciones seguidas y observa:

1. `mira alrededor`
2. `exploro con cuidado`
3. `registro el sitio a fondo`
4. `descanso un rato`
5. `avanzo hacia el norte`

| Comprobar | Criterio de fallo |
|---|---|
| Cada acción produce narración distinta | Texto repetido literalmente |
| Las tiradas aparecen antes de la narración | La narración contradice la tirada |
| El reloj avanza | Se queda parado |
| El hambre y la sed bajan | No se mueven en veinte turnos |

**La prueba crítica de este bloque** es que la narración nunca contradiga el
dado. Si la tirada dice fracaso y el texto dice que lo consigues, la promesa
central del motor está rota. Comprueba varias veces con:

```js
ARCANVEIL.jugar('intento forzar la puerta')
```

---

## 4 · Inventario

```js
ARCANVEIL.dar('pocion_curacion', 3)
ARCANVEIL.dar('espada_corta')
ARCANVEIL.dar('cota_ligera')
ARCANVEIL.botin('jefe')
```

| Comprobar | Criterio de fallo |
|---|---|
| Las pociones se apilan en una entrada | Aparecen tres entradas |
| Al equipar la cota, la barra de carga cambia de color | No reacciona |
| Alt+clic abre el menú contextual | No aparece |
| El tooltip muestra daño, peso y valor | Faltan datos |
| Tirar un objeto de misión se rechaza | Se puede tirar |

**Prueba de durabilidad:**

```js
// Provoca combates hasta que el arma se desgaste
ARCANVEIL.pelear('rata_gigante', 1)
```

Repite hasta ver el aro de durabilidad amarillo. Debe avisar al cruzar cada
umbral, no en cada golpe.

---

## 5 · Combate

```js
ARCANVEIL.pelear('lobo_ceniciento', 3)
```

| Comprobar | Criterio de fallo |
|---|---|
| Los lobos coordinan: van al mismo objetivo | Cada uno ataca a su aire |
| Los turnos enemigos se encadenan solos | Hay que pulsar entre cada uno |
| El panel se sacude al recibir daño | No hay señal visual |
| Al bajar del 25 %, algún lobo huye | Pelean hasta morir todos |
| Al ganar, llega experiencia y botín | No llega nada |

**Combate contra jefe:**

```js
ARCANVEIL.pelear('guardian_de_la_puerta')
```

| Comprobar | Criterio de fallo |
|---|---|
| La barra grande muestra las marcas de fase | No aparecen |
| Al 60 % cambia de comportamiento y lo anuncia | Pasa sin avisar |
| Se sacude los aturdimientos a veces | Se puede encadenar indefinidamente |
| Usa acciones legendarias fuera de su turno | Nunca actúa entre turnos |

**Prueba de estados:**

```js
ARCANVEIL.pelear('tejedora_de_umbral')
```

El veneno debe hacer daño **al inicio** de tu turno, antes de que actúes. Si
hace daño al final, el orden está invertido.

---

## 6 · Mundo y viaje

```js
ARCANVEIL.mundo()
ARCANVEIL.ir('camino_norte')
```

| Comprobar | Criterio de fallo |
|---|---|
| El viaje avisa del coste antes de emprenderlo | Sale sin decir nada |
| Se consumen raciones y odres de verdad | El inventario no cambia |
| Un encuentro interrumpe el viaje y se puede continuar | Hay que empezar de cero |
| Al llegar, el mapa se actualiza | El nodo no se marca |

**Prueba de clima:**

```js
ARCANVEIL.clima('niebla')
ARCANVEIL.prueba('percepcion')   // debe mostrar -4 por niebla
ARCANVEIL.prueba('sigilo')       // debe mostrar +3
```

**Prueba de estaciones:**

```js
ARCANVEIL.dias(90)
```

Al entrar el invierno, las rutas de montaña con peligro alto deben cerrarse.
Intenta `ARCANVEIL.ir('forja_alta')` desde el paso: debe negarse.

**Prueba de eventos:**

```js
ARCANVEIL.evento('feria')
```

Los precios deben bajar. Comprueba con un mercader antes y después.

---

## 7 · Gente

Habla con alguien presente y observa:

```js
ARCANVEIL.ver('npcs.presentes')
```

| Comprobar | Criterio de fallo |
|---|---|
| El PNJ tiene nombre, oficio y rasgo coherentes | Un herrero en el pantano |
| Al volver al mismo lugar, es el mismo PNJ | Se genera otro |
| Su actitud se muestra en palabras, no en cifras | Aparece «-30» |
| Pedirle algo que odia se rechaza sin tirada | Deja tirar y a veces cede |

**Prueba de propagación.** En un asentamiento pequeño, intimida a alguien y
comprueba que los demás presentes bajan de actitud. En una ciudad grande,
apenas debería notarse.

**Prueba de conocimiento.** Pregunta por la zona. Si el PNJ revela un lugar,
**ese lugar debe aparecer en el mapa de verdad**. Si solo lo menciona en el
texto, el enlace entre diálogo y mundo está roto.

---

## 8 · Comercio

```js
ARCANVEIL.ver('npcs.presentes')   // busca un mercader
```

| Comprobar | Criterio de fallo |
|---|---|
| Comprar y vender lo mismo siempre pierde dinero | Se puede hacer bucle de oro |
| Un herrero rechaza pociones | Compra de todo |
| El mercader se queda sin oro al venderle mucho | Paga infinitamente |
| El agua cuesta el triple en el desierto | Precio igual en todas partes |

**Prueba de reputación en precios.** Sube la reputación con una facción y
comprueba que sus mercaderes cobran menos:

```js
ARCANVEIL.inspeccionar('reputation')
```

---

## 9 · Misiones

Habla con gente hasta que te ofrezcan algo, o fuerza:

```js
ARCANVEIL.inspeccionar('quests')
```

| Comprobar | Criterio de fallo |
|---|---|
| La misión la propone un PNJ, no una notificación | Aparece sola en el registro |
| Un objetivo de matar avanza al matar | Hay que marcarlo a mano |
| Un objetivo de recoger baja si vendes lo recogido | Se queda cumplido |
| Al cumplir todo, avisa de que se puede cobrar | Silencio |
| Fallar el plazo hace fracasar la misión | Se queda activa indefinidamente |

**La prueba más importante de este bloque:** acepta una misión de recogida,
consigue los objetos, véndelos y comprueba que el progreso **baja**. Si se
queda cumplido, se puede completar la misión y quedarse con el pago y la
mercancía.

---

## 10 · Guardado

Activa el guardado en Ajustes primero.

| Comprobar | Criterio de fallo |
|---|---|
| Guardar y cargar devuelve el estado exacto | Algo se pierde |
| El autoguardado no pisa las ranuras manuales | Sobrescribe la activa |
| Exportar descarga un `.json` legible | Falla o sale ilegible |
| Importar ese archivo restaura la partida | No carga |
| Borrar pide confirmación | Borra directo |

**Prueba de credenciales.** Esta es obligatoria y no negociable:

```js
// Introduce una clave de API en Ajustes, guarda, y luego:
localStorage.getItem('arcanveil:save:1')
```

Busca la clave en el texto. **Si aparece, es un fallo grave.** No debería estar
en ninguna parte del guardado.

```js
// Comprobación adicional
ARCANVEIL.inspeccionar('saves')   // credencialPersistida debe ser false
```

**Prueba de migración.** Edita a mano un guardado exportado y cambia
`"version": 5` por `"version": 1`. Al importarlo debe migrar y avisar de las
conversiones aplicadas, no fallar.

---

## 11 · Directores de juego

Prueba los cuatro modos en Ajustes.

### Procedural

| Comprobar | Criterio de fallo |
|---|---|
| Funciona sin red y sin claves | Pide algo |
| No repite frases en veinte turnos | Se repite antes |
| Describe el entorno al cambiar de terreno | No lo menciona nunca |

### Puente manual

| Comprobar | Criterio de fallo |
|---|---|
| El prompt se copia solo al abrirse | Hay que pulsar |
| Pegar un JSON válido lo aplica al vuelo | Hay que pulsar «Aplicar» |
| Pegar algo mal formado explica qué falla | Dice «error» sin más |
| Un JSON malo no cancela el turno | Se pierde el turno |
| El primer prompt lleva instrucciones; el segundo es corto | Ambos igual de largos |

### Modelo local y API remota

| Comprobar | Criterio de fallo |
|---|---|
| Sin configurar, avisa de qué falta | Falla en silencio |
| Con la URL mal, el mensaje es concreto | «Error de red» genérico |
| Tras tres fallos, cae al director interno | La partida se cuelga |
| Al reintroducir la clave, vuelve al proveedor elegido | Se queda en el interno |

**Prueba de degradación.** Configura la API remota con una URL inválida y juega
tres turnos. El juego debe seguir funcionando con el director interno y
avisarlo una vez, sin insistir.

---

## 12 · Blindaje contra el director

Estas pruebas requieren el puente manual y pegar JSON a mano. Comprueban que el
motor no acepta lo que no debe.

**Daño excesivo:**

```json
{ "story": "Te caes.", "playerUpdates": { "hp": { "delta": -9999 } } }
```

Debe recortarse al máximo permitido, no matarte.

**Matar fuera de combate:**

```json
{ "story": "Mueres.", "playerUpdates": { "hp": { "delta": -1000 } } }
```

Debe dejarte a 1 punto de vida, no a cero.

**Objeto imposible:**

```json
{ "story": "Encuentras algo.", "newItems": [{ "nombre": "Espada divina", "rareza": "legendario" }] }
```

Sin hito narrativo, la rareza debe recortarse.

**Resucitar a un muerto:**

```json
{ "story": "Aparece Brenwen.", "npcs": [{ "refId": "npc_brenwen", "nombre": "Brenwen" }] }
```

Si Brenwen está muerta, debe rechazarse.

**Respuesta en prosa:**

> *Te adentras en el bosque y la luz se filtra entre las hojas...*

Sin JSON, debe **rescatar la narración** e inferir opciones, no descartarla.

---

## 13 · Accesibilidad

| Comprobar | Criterio de fallo |
|---|---|
| Todo es alcanzable con Tab | Hay controles inaccesibles |
| El anillo de foco es visible siempre | Desaparece en algún sitio |
| Con `prefers-reduced-motion`, nada se mueve | Sigue animando |
| Con letra al 130 %, nada se solapa | Se rompe el diseño |
| En móvil, los botones son pulsables sin fallar | Hay que apuntar |

**Prueba de movimiento reducido.** En las herramientas de desarrollo del
navegador, fuerza `prefers-reduced-motion: reduce` y recarga. Las animaciones
deben desaparecer; las transiciones de opacidad pueden quedarse.

**Prueba de teclado en combate.** Las teclas 1 a 4 deben ejecutar las acciones
y Tab debe cambiar de objetivo.

---

## 14 · Archivo único

```bash
node tools/bundle.mjs
```

| Comprobar | Criterio de fallo |
|---|---|
| Genera `dist/arcanveil.html` sin avisos | Reporta módulos ausentes |
| Se abre con doble clic, sin servidor | Pantalla en blanco |
| Funciona igual que la versión servida | Falta algo |
| Pesa menos de un megabyte | Excede |

Si el empaquetado avisa de módulos ausentes, faltan archivos del proyecto.
Consulta `PENDIENTE.md`.

---

## 15 · Sesión larga

La última prueba y la que más encuentra: **juega cuarenta turnos seguidos** sin
usar la consola. Sin forzar nada.

Presta atención a:

- **Repetición.** ¿Empieza a sonar igual?
- **Ritmo.** ¿Hay tramos muertos de diez turnos sin nada?
- **Coherencia.** ¿El director recuerda lo que prometiste?
- **Rendimiento.** ¿Se ralentiza?
- **Memoria.** ¿Crece el consumo sin parar?

```js
// Al terminar
ARCANVEIL.inspeccionar('turns')      // memoria: hechos, hilos, resúmenes
ARCANVEIL.inspeccionar('pacing')     // ritmo y directriz actual
performance.memory                 // en Chromium
```

**Criterio de fallo del bloque:** si a los cuarenta turnos el juego se siente
repetitivo o el director ha olvidado algo importante que dijiste, el problema no
es un error de código. Es de diseño, y está en `MemoryStore` o en
`DifficultyDirector`.

---

## Qué hacer con un fallo

1. **Anota la reproducción exacta.** Los fallos que dependen del azar son los
   peores; la semilla ayuda: `ARCANVEIL.ver('meta.semilla')`.
2. **Mira el canal correcto del registro.** `ARCANVEIL.log.volcar('combate')`
   filtra por sistema.
3. **Comprueba si es de blindaje.** Si el director propuso algo raro,
   `ARCANVEIL.inspeccionar('effects')` muestra los ajustes recortados.
4. **Si el estado quedó inconsistente**, es lo más grave. Las transacciones del
   store deberían impedirlo: revisa si algún sistema despacha fuera de una.
