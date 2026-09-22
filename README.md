# ARCANVEIL · ARCANVEIL

Juego de rol narrativo para navegador web. Alta fantasía clásica, sin servidor y sin base de datos.

Se abre en el navegador, se juega escribiendo. Un director de juego narra, y el
motor resuelve las reglas.

## Qué es

- **100 % local.** No hay backend, ni Docker, ni base de datos. Los archivos se
  sirven estáticos y todo corre en el navegador.
- **HTML + CSS + JavaScript.** Módulos ES6, sin frameworks ni dependencias.
- **El mundo parece crearse mientras juegas.** Retratos personalizados, escenas corrientes, clima, luz, partículas y criaturas se dibujan de forma procedural a partir del personaje y del estado vivo. Las ilustraciones originales solo refuerzan hitos de campaña.
- **Cuatro directores de juego** intercambiables: uno procedural que funciona sin
  red ni claves, un puente manual para copiar y pegar en cualquier asistente, un
  modelo local y una API remota.
- **El motor tira los dados.** El director narra el resultado, nunca lo decide.
  Un modelo de lenguaje no puede hacer que aciertes cuando has fallado.

## Arrancar

Los módulos ES6 no funcionan abriendo el `index.html` a pelo: hacen falta unos
segundos de servidor estático.

```bash
node tools/servir.mjs
```

Y abrir `http://localhost:8080/app/index.html`.

Sirve cualquier servidor estático, pero este manda `Cache-Control: no-store`.
Los que cachean —`python -m http.server`, entre otros— hacen que después de
editar un módulo el navegador siga ejecutando el de antes, y eso cuesta horas
de buscar fallos que ya están arreglados.

## Archivo único

Los módulos ES6 no funcionan desde `file://`, así que durante el desarrollo hace
falta el servidor estático de arriba. Para jugar sin él:

```bash
node tools/bundle.mjs
```

Genera `dist/arcanveil.html`: un solo archivo que se abre con doble clic, sin
servidor y sin dependencias. Node solo hace falta para construirlo, no para
jugarlo.

Para empaquetar la app con interfaz gráfica:

```bash
node tools/bundle.mjs --entrada app/app.js --html app/index.html \
     --sin-estilos --salida dist/app.html
```

El arte viaja dentro: son unos kilobytes de código, no megas de imágenes.

## Pruebas

La regresión web automatizada no necesita dependencias: arranca Chrome, crea un personaje con descripción y lore, comprueba que el retrato interpreta sus rasgos y que el canon abre hilos de campaña, juega 20 turnos, vigila la gramática de acciones libres y verifica la recarga offline.

```bash
node tools/regresion-app.mjs --desktop --capturas
node tools/regresion-app.mjs --mobile --capturas
```

El guion ampliado sigue en [TESTING.md](TESTING.md).

## Estructura

```
arcanveil/
├── app/                    LA WEB QUE SE JUEGA: index.html + app.js
├── index.html              Portada: redirige al juego
├── clasico.html            Shell de tres paneles (interfaz original)
├── assets/                 Vacía; puerta para meter imágenes (ver su README)
├── styles/                 CSS por capas (@layer)
├── tools/                  servir · bundle · lamina-arte · auditar-*
└── src/
    ├── config/             Configuración: balance, IA, interfaz
    ├── core/               Store, EventBus, RNG, dados, validación
    ├── utils/              Utilidades puras
    ├── data/               Contenido: razas, clases, objetos, lugares…
    ├── art/                Arte generado: paisaje, retrato, criatura
    ├── player/             Personaje: atributos, vitales, progresión
    ├── inventory/          Inventario, durabilidad, rarezas, botín
    ├── ai/                 Directores de juego y contexto
    ├── engine/             Reglas, turno, intenciones, consecuencias
    ├── combat/             Combate por turnos
    ├── world/              Mapa, viaje, clima, eventos
    ├── npc/                Personajes, facciones, diálogo
    ├── quests/             Misiones y objetivos
    ├── economy/            Precios y comercio
    └── ui/                 Componentes y pantallas
```

## El arte

Nada de esto son archivos de imagen: los dibuja `src/art/` en el navegador.

| Qué | De dónde salen las diferencias |
|---|---|
| Retratos personalizados | linaje, semilla y descripción libre (pelo, ojos, cicatriz, parche, barba y capucha) |
| 13 criaturas | `tipo` y `tamano` de `enemies.data.js` |
| 19 paisajes | `terreno` y `tipo` de `locations.data.js` |

El paisaje además responde a la franja horaria y al clima: 56 variantes por
lugar. Una paleta única y un solo ángulo de luz, en `src/art/paleta.js`, hacen
que las 40 piezas parezcan del mismo juego.

Para verlas todas juntas:

```bash
node tools/lamina-arte.mjs --franja ocaso --clima lluvia --horas
```

Si prefieres imágenes de verdad, `assets/README.md` explica cómo sustituir
cualquier pieza por un `.webp` sin tocar código.

## Directores de juego

| Modo | Necesita | Calidad narrativa |
|---|---|---|
| Procedural | nada | funcional, coherente, previsible |
| Puente manual | copiar y pegar | alta |
| Gemini por proxy local | `GEMINI_API_KEY` solo en el proceso del PC | alta |
| API remota | una clave | alta |

El procedural es el suelo del sistema: siempre está disponible y actúa como
respaldo si cualquier otro falla. **La partida nunca se queda colgada.**

### Sobre las credenciales

La clave de la API remota vive en una variable de módulo, fuera del estado del
juego. No toca `localStorage`, ni `sessionStorage`, ni cookies, ni la URL. Al
recargar la pestaña desaparece y hay que volver a introducirla. Caduca sola por
inactividad.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Núcleo | ✅ |
| 2 | Interfaz base | ✅ |
| 3 | Personaje | ✅ |
| 4 | Inventario | ✅ |
| 5 | Director procedural | ✅ |
| 6 | Motor de IA | ✅ |
| 7 | Combate | ✅ |
| 8a | Mundo y exploración | ✅ |
| 8b | Gente, misiones y economía | ✅ |
| 9 | Progresión y guardado | ✅ |
| 10 | Pulido | ✅ |

## Depuración

La consola expone `window.ARCANVEIL`:

```js
ARCANVEIL.mundo()              // dónde estás, qué hora, qué tiempo
ARCANVEIL.jugar('exploro')     // fuerza un turno
ARCANVEIL.ir('forja_alta')     // viaja
ARCANVEIL.pelear('lobo_ceniciento', 3)
ARCANVEIL.dar('pocion_curacion', 3)
ARCANVEIL.evento('feria')      // fuerza un evento del mundo
ARCANVEIL.dias(90)             // cambia la estación
```

## Contenido

El contenido original —razas, clases, lugares, criaturas— es propio.
El paquete opcional del SRD se rige por su propia licencia: ver
[ATTRIBUTION.md](ATTRIBUTION.md).
