/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · app/efectos.js
 * ---------------------------------------------------------------------------
 * La capa de efectos visuales del juego.
 *
 * Dos principios gobiernan todo lo de aquí:
 *
 * **Un efecto sirve para que algo se entienda, no para que se vea bonito.**
 * El dado rueda porque el pilar del juego es que el motor decide a la vista; si
 * el resultado aparece ya hecho, el jugador no ve que hubo tirada. Los números
 * de daño salen porque una barra que baja no dice cuánto.
 *
 * **Nada bloquea al jugador.** Ningún efecto retrasa una decisión ni se puede
 * quedar colgado: todos se autodestruyen y todos respetan
 * `prefers-reduced-motion`, que aquí no es una concesión sino una salida
 * completa — el juego se entiende igual sin una sola animación.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════════════
   PREFERENCIAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ¿El sistema pide movimiento reducido?
 *
 * Se consulta en cada efecto y no se cachea: el usuario puede cambiarlo con el
 * juego abierto, y quien activa esto suele hacerlo justo porque algo le está
 * molestando ahora mismo.
 *
 * @returns {boolean}
 */
function sinMovimiento() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Programa una limpieza que se ejecuta pase lo que pase. */
function retirar(nodo, ms) {
  setTimeout(() => nodo.remove(), ms);
}

/* ═══════════════════════════════════════════════════════════════════════════
   EL DADO
   ═══════════════════════════════════════════════════════════════════════════ */

/** Cuánto rueda el dado antes de asentarse, en ms. */
const RUEDA_MS = 620;

/** Cada cuánto cambia la cara mientras rueda, en ms. */
const CARA_MS = 55;

/**
 * Hace rodar un d20 antes de enseñar su resultado.
 *
 * El número final YA está decidido por el motor: esto no elige nada, solo
 * retrasa el momento en que se lee. Es importante entenderlo así, porque la
 * tentación de un efecto como este es dejar que decida, y eso rompería el
 * pilar central del juego.
 *
 * Mientras rueda muestra caras al azar; al asentarse, fija la natural y deja
 * que el veredicto aparezca después, que es donde está la tensión.
 *
 * @param {HTMLElement} nodo Elemento que muestra la cara del dado.
 * @param {number} natural Resultado real, el que queda.
 * @param {Function} [alTerminar] Se llama cuando el dado se ha asentado.
 */
export function rodarDado(nodo, natural, alTerminar) {
  if (!nodo) return;

  const fijar = (n) => { nodo.textContent = `d20 ${n}`; };

  if (sinMovimiento()) {
    fijar(natural);
    alTerminar?.();
    return;
  }

  nodo.classList.add('tirada__dado--rodando');

  const fin = Date.now() + RUEDA_MS;

  const tic = setInterval(() => {
    if (Date.now() >= fin) {
      clearInterval(tic);
      fijar(natural);
      nodo.classList.remove('tirada__dado--rodando');
      nodo.classList.add('tirada__dado--asienta');
      alTerminar?.();
      return;
    }

    // Caras al azar mientras gira. Nunca se queda en ninguna: el valor real
    // lo pone el motor al terminar.
    fijar(1 + Math.floor(Math.random() * 20));
  }, CARA_MS);
}

/* ═══════════════════════════════════════════════════════════════════════════
   IMPACTOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Lanza un número de daño que sube y se desvanece.
 *
 * Sale del elemento golpeado, no del centro de la pantalla: así el jugador ve
 * A QUIÉN le pasó, que es la mitad de la información. Una barra que baja dice
 * que algo ocurrió; este número dice cuánto y a quién.
 *
 * @param {HTMLElement} origen Elemento sobre el que aparece.
 * @param {number} cantidad
 * @param {Object} [opciones]
 * @param {boolean} [opciones.critico]
 * @param {boolean} [opciones.esJugador] Si lo recibe el jugador, tira a rojo.
 */
export function numeroDano(origen, cantidad, opciones = {}) {
  if (!origen || !Number.isFinite(cantidad) || cantidad <= 0) return;
  if (sinMovimiento()) return;

  const caja = origen.getBoundingClientRect();

  const n = document.createElement('span');
  n.className = 'dano-flotante'
    + (opciones.critico ? ' dano-flotante--critico' : '')
    + (opciones.esJugador ? ' dano-flotante--propio' : '');
  n.textContent = `−${Math.round(cantidad)}`;

  // Dispersión horizontal para que dos golpes seguidos no se pisen.
  const desvio = (Math.random() - 0.5) * 42;

  n.style.left = `${caja.left + caja.width / 2 + desvio}px`;
  n.style.top = `${caja.top + caja.height * 0.35}px`;

  document.body.append(n);
  retirar(n, 1200);
}

/**
 * Sacude un elemento. Reservado al golpe que importa.
 *
 * Si todo sacude, nada sacude: se usa en críticos, pifias y en el golpe que
 * derriba. Un combate entero temblando cansa y deja de informar.
 *
 * @param {HTMLElement} nodo
 * @param {'suave'|'fuerte'} [fuerza]
 */
export function sacudir(nodo, fuerza = 'suave') {
  if (!nodo || sinMovimiento()) return;

  const clase = fuerza === 'fuerte' ? 'se-sacude--fuerte' : 'se-sacude';

  nodo.classList.remove('se-sacude', 'se-sacude--fuerte');
  void nodo.offsetWidth;           // reinicia la animación si ya estaba puesta
  nodo.classList.add(clase);

  setTimeout(() => nodo.classList.remove(clase), 520);
}

/**
 * Destello sobre un elemento golpeado.
 *
 * @param {HTMLElement} nodo
 * @param {'dano'|'cura'} [tipo]
 */
export function destello(nodo, tipo = 'dano') {
  if (!nodo || sinMovimiento()) return;

  const clase = tipo === 'cura' ? 'destella--cura' : 'destella--dano';

  nodo.classList.remove('destella--dano', 'destella--cura');
  void nodo.offsetWidth;
  nodo.classList.add(clase);

  setTimeout(() => nodo.classList.remove(clase), 460);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOMENTOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Rótulo a pantalla completa para lo que marca un antes y un después.
 *
 * Nivel, derrota, entrada a un lugar nuevo. Se usa con cuentagotas: el cuarto
 * rótulo de una sesión ya no se lee, se espera a que pase.
 *
 * @param {string} texto
 * @param {string} [matiz] `oro` (por defecto), `sangre`.
 */
export function rotuloMomento(texto, matiz = 'oro') {
  if (!texto) return;

  const n = document.createElement('div');
  n.className = `momento momento--${matiz}`;
  n.setAttribute('role', 'status');
  n.textContent = texto;

  document.body.append(n);

  // Aunque no haya animación, el rótulo aparece: es información, no adorno.
  retirar(n, sinMovimiento() ? 1600 : 2400);
}

/**
 * Marca un elemento como recién cambiado, para que el ojo lo encuentre.
 *
 * @param {HTMLElement} nodo
 */
export function acentuar(nodo) {
  if (!nodo || sinMovimiento()) return;

  nodo.classList.remove('se-acentua');
  void nodo.offsetWidth;
  nodo.classList.add('se-acentua');

  setTimeout(() => nodo.classList.remove('se-acentua'), 900);
}
