/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · player/creation/CharacterInterview.js
 * ---------------------------------------------------------------------------
 * Motor de la entrevista de creación de personaje.
 *
 * Convierte texto libre en un personaje mecánicamente válido, preguntando solo
 * lo que sigue faltando.
 *
 * Funcionamiento:
 *   1. El jugador describe a su personaje con sus palabras.
 *   2. `interpretar()` analiza el texto contra los léxicos de linajes,
 *      vocaciones y trasfondos, y propone lo que puede deducir.
 *   3. `siguientePregunta()` devuelve la primera pregunta cuya información no
 *      esté ya resuelta con suficiente confianza.
 *   4. Cada respuesta vuelve a alimentar al intérprete: contestar una cosa
 *      puede resolver otras.
 *   5. `completar()` rellena automáticamente lo que quede pendiente.
 *
 * El texto original se conserva íntegro en `retrato`. Ese texto viaja al
 * director en cada prompt y es lo que hace que la partida sea del jugador
 * desde el primer turno, no de una plantilla.
 *
 * Dependencias: datos de razas/clases/trasfondos, entrevista, RNG, Logger, utils.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { LEXICO_RAZAS, obtenerRaza, listarRazas, subrazasDe, nombreSugerido } from '../../data/races.data.js';
import { LEXICO_CLASES, obtenerClase, listarClases } from '../../data/classes.data.js';
import { LEXICO_TRASFONDOS, obtenerTrasfondo, listarTrasfondos } from '../../data/backgrounds.data.js';
import {
  APERTURA, SEMILLAS, PREGUNTAS, ATAJOS, TEXTOS_ENTREVISTA,
  PLANTILLAS_ATRIBUTOS, PLANTILLA_POR_CLASE,
} from '../../data/interview.data.js';
import { crearCanal } from '../../core/Logger.js';
import { sinAcentos, limpiar, capitalizar } from '../../utils/text.js';

const log = crearCanal('core');

/** Confianza mínima para dar por resuelto un campo sin preguntar. */
const UMBRAL_AUTO = 0.72;

/** Confianza mínima para proponerlo como confirmación. */
const UMBRAL_PROPUESTA = 0.45;

/** Palabras vacías que no aportan señal al análisis. */
const VACIAS = new Set([
  'de', 'la', 'el', 'que', 'y', 'a', 'en', 'un', 'una', 'los', 'las', 'con',
  'por', 'para', 'su', 'sus', 'se', 'me', 'mi', 'es', 'del', 'al', 'lo',
  'como', 'más', 'mas', 'pero', 'muy', 'ha', 'he', 'no', 'sí', 'si', 'este',
  'esta', 'ser', 'quiero', 'personaje',
]);

export class CharacterInterview {
  /**
   * @param {Object} [opciones]
   * @param {import('../../core/RNG.js').Flujo} [opciones.rng] Para sugerencias reproducibles.
   * @param {Object} [opciones.director] Intérprete por IA, si está disponible.
   */
  constructor(opciones = {}) {
    this.rng = opciones.rng ?? null;
    this.director = opciones.director ?? null;

    /**
     * Borrador del personaje. Se rellena por análisis y por respuestas.
     * @type {Object}
     */
    this.borrador = this._borradorVacio();

    /**
     * Historial de la conversación, para poder retroceder.
     * @type {Array<{pregunta: string, respuesta: string}>}
     */
    this.historial = [];

    /** Identificadores de preguntas ya formuladas. @type {Set<string>} */
    this.formuladas = new Set();

    /** Pregunta pendiente de respuesta. @type {Object|null} */
    this.actual = null;
  }

  /**
   * @returns {Object}
   * @private
   */
  _borradorVacio() {
    return {
      // Texto original del jugador, íntegro. Nunca se sobrescribe.
      retrato: '',

      nombre: null,
      raza: null,
      subraza: null,
      clase: null,
      trasfondo: null,

      motivacion: null,
      gancho: null,
      detalle: null,
      principio: null,

      atributos: null,

      /** Deducciones con su confianza. @private */
      _propuestas: {},
      /** Marcadores auxiliares para las condiciones de omisión. */
      _tieneSubrazas: false,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     APERTURA
     ═══════════════════════════════════════════════════════════════════════ */

  /** @returns {Object} Datos de la pantalla de apertura. */
  apertura() {
    return {
      ...APERTURA,
      semillas: this._elegirVarios(SEMILLAS, 3),
    };
  }

  /**
   * Procesa la descripción inicial del jugador.
   *
   * @param {string} texto
   * @returns {Promise<{propuestas: Object, resueltos: string[]}>}
   */
  async describir(texto) {
    const limpio = limpiar(texto);
    this.borrador.retrato = limpio;

    await this.interpretar(limpio);

    const resueltos = ['raza', 'clase', 'trasfondo'].filter((c) => this.borrador[c]);
    log.info(`Entrevista: descripción analizada, ${resueltos.length} campos resueltos`);

    return { propuestas: this.borrador._propuestas, resueltos };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     INTERPRETACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Analiza un texto y actualiza las propuestas del borrador.
   *
   * Si hay un director de IA disponible, se le consulta primero; su lectura es
   * mucho más fina que el léxico. Si no lo hay o falla, el análisis procedural
   * hace el trabajo. En ambos casos el resultado tiene la misma forma.
   *
   * @param {string} texto
   * @returns {Promise<void>}
   */
  async interpretar(texto) {
    if (this.director) {
      try {
        const lectura = await this.director.interpretarPersonaje(texto, this.borrador);
        if (lectura) {
          this._aplicarPropuestas(lectura);
          return;
        }
      } catch (e) {
        log.aviso('El director no pudo interpretar el texto; se usa el análisis interno');
      }
    }

    this._aplicarPropuestas(this._interpretarProcedural(texto));
  }

  /**
   * Análisis por léxico ponderado.
   *
   * @param {string} texto
   * @returns {Object}
   * @private
   */
  _interpretarProcedural(texto) {
    const palabras = this._tokenizar(texto);

    const raza = this._puntuar(palabras, LEXICO_RAZAS);
    const clase = this._puntuar(palabras, LEXICO_CLASES);
    const trasfondo = this._puntuar(palabras, LEXICO_TRASFONDOS);

    return {
      raza: raza.mejor,
      clase: clase.mejor,
      trasfondo: trasfondo.mejor,
      nombre: this._extraerNombre(texto),
      motivacion: this._extraerMotivacion(texto),
      detalle: this._extraerDetalle(texto),
    };
  }

  /**
   * Descompone el texto en unidades de análisis: palabras sueltas y bigramas.
   * Los bigramas capturan expresiones como «alto elfo» o «piel gris».
   *
   * @param {string} texto
   * @returns {string[]}
   * @private
   */
  _tokenizar(texto) {
    const base = sinAcentos(texto.toLowerCase())
      .replace(/[^\wáéíóúñü\s]/g, ' ')
      .split(/\s+/)
      .filter((p) => p.length > 2 && !VACIAS.has(p));

    const bigramas = [];
    for (let i = 0; i < base.length - 1; i++) {
      bigramas.push(`${base[i]} ${base[i + 1]}`);
    }

    return [...base, ...bigramas];
  }

  /**
   * Puntúa las coincidencias contra un léxico y normaliza el resultado.
   *
   * La confianza se calcula como la ventaja del primero sobre el segundo. Que
   * un candidato saque 20 puntos importa poco si el siguiente saca 19: eso
   * significa ambigüedad, y conviene preguntar.
   *
   * @param {string[]} palabras
   * @param {Map<string, Array<{refId: string, peso: number, subraza?: string}>>} lexico
   * @returns {{mejor: Object|null, todos: Array}}
   * @private
   */
  _puntuar(palabras, lexico) {
    /** @type {Map<string, {puntos: number, subraza?: string}>} */
    const marcador = new Map();

    for (const palabra of palabras) {
      const entradas = lexico.get(palabra);
      if (!entradas) continue;

      for (const entrada of entradas) {
        const previo = marcador.get(entrada.refId) ?? { puntos: 0 };
        previo.puntos += entrada.peso;
        if (entrada.subraza) previo.subraza = entrada.subraza;
        marcador.set(entrada.refId, previo);
      }
    }

    if (!marcador.size) return { mejor: null, todos: [] };

    const orden = [...marcador.entries()]
      .map(([refId, d]) => ({ refId, puntos: d.puntos, subraza: d.subraza }))
      .sort((a, b) => b.puntos - a.puntos);

    const primero = orden[0];
    const segundo = orden[1];

    // Ventaja relativa sobre el siguiente candidato, acotada a [0, 1].
    const ventaja = segundo
      ? (primero.puntos - segundo.puntos) / primero.puntos
      : 1;

    // Se combina con la fuerza absoluta: una sola coincidencia débil no basta.
    const fuerza = Math.min(primero.puntos / 15, 1);
    const confianza = Math.min(ventaja * 0.55 + fuerza * 0.45, 1);

    return {
      mejor: { refId: primero.refId, subraza: primero.subraza, confianza },
      todos: orden.slice(0, 4),
    };
  }

  /**
   * Aplica las propuestas al borrador: lo que supera el umbral alto se da por
   * resuelto; el resto queda como propuesta a confirmar.
   *
   * @param {Object} lectura
   * @private
   */
  _aplicarPropuestas(lectura) {
    for (const campo of ['raza', 'clase', 'trasfondo']) {
      const p = lectura[campo];
      if (!p?.refId) continue;

      this.borrador._propuestas[campo] = p;

      if (p.confianza >= UMBRAL_AUTO && !this.borrador[campo]) {
        this.borrador[campo] = p.refId;
        if (campo === 'raza' && p.subraza) this.borrador.subraza = p.subraza;
      }
    }

    // Campos de texto libre: se aceptan tal cual si aún están vacíos.
    for (const campo of ['nombre', 'motivacion', 'detalle']) {
      if (lectura[campo] && !this.borrador[campo]) this.borrador[campo] = lectura[campo];
    }

    // Marcador auxiliar para saber si procede preguntar por la subraza.
    if (this.borrador.raza) {
      this.borrador._tieneSubrazas = subrazasDe(this.borrador.raza).length > 0;
    }
  }

  /* ─── Extractores de texto libre ──────────────────────────────────────── */

  /**
   * Busca un nombre propio declarado explícitamente.
   * Solo acepta construcciones inequívocas: adivinar nombres a partir de
   * mayúsculas sueltas produce más errores que aciertos.
   *
   * @param {string} texto
   * @returns {string|null}
   * @private
   */
  _extraerNombre(texto) {
    const patrones = [
      /\bse llama\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)/,
      /\bllamad[oa]\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)/,
      /\bmi nombre es\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)/i,
      /\bnombre:\s*([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)/i,
    ];
    for (const p of patrones) {
      const m = texto.match(p);
      if (m) return capitalizar(m[1]);
    }
    return null;
  }

  /**
   * Localiza la frase que expresa el motivo del personaje.
   * @param {string} texto
   * @returns {string|null}
   * @private
   */
  _extraerMotivacion(texto) {
    const patrones = [
      /\b(?:busca|buscando|persigue|quiere encontrar)\s+([^.,;]{8,90})/i,
      /\b(?:huye|huyendo|escapa|escapando)\s+(?:de\s+)?([^.,;]{8,90})/i,
      /\b(?:para\s+(?:vengar|encontrar|recuperar|salvar))\s+([^.,;]{5,90})/i,
    ];
    for (const p of patrones) {
      const m = texto.match(p);
      if (m) return limpiar(m[0]);
    }
    return null;
  }

  /**
   * Localiza un rasgo físico o de carácter distintivo.
   * @param {string} texto
   * @returns {string|null}
   * @private
   */
  _extraerDetalle(texto) {
    const patrones = [
      /\b(?:cicatriz|tatuaje|marca|parche|manco|cojea|tuerto)[^.,;]{0,60}/i,
      /\b(?:siempre|nunca)\s+(?:lleva|viste|habla|mira)[^.,;]{0,60}/i,
    ];
    for (const p of patrones) {
      const m = texto.match(p);
      if (m) return limpiar(m[0]);
    }
    return null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     FLUJO DE PREGUNTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Devuelve la siguiente pregunta pendiente, ya resuelta y lista para mostrar.
   *
   * @returns {Object|null} null cuando no queda nada por preguntar.
   */
  siguientePregunta() {
    const candidatas = PREGUNTAS
      .filter((p) => !this.formuladas.has(p.id))
      .filter((p) => !p.omitirSi || !p.omitirSi(this.borrador))
      .sort((a, b) => a.prioridad - b.prioridad);

    const pregunta = candidatas[0];
    if (!pregunta) {
      this.actual = null;
      return null;
    }

    this.actual = this._materializar(pregunta);
    return this.actual;
  }

  /**
   * Convierte una definición de pregunta en la pregunta concreta que se
   * mostrará: resuelve marcadores, adjunta opciones y añade la ayuda.
   *
   * @param {Object} definicion
   * @returns {Object}
   * @private
   */
  _materializar(definicion) {
    const salida = { ...definicion };

    // Marcadores de la propuesta a confirmar.
    if (definicion.tipo === 'confirmar') {
      const propuesta = this.borrador._propuestas[definicion.necesita];
      const entidad = this._entidad(definicion.necesita, propuesta?.refId);

      salida.texto = definicion.texto
        .replace('{propuesta}', entidad?.nombre ?? '—')
        .replace('{descripcionBreve}', entidad?.lema ?? '');

      salida.propuestaRefId = propuesta?.refId ?? null;
      salida.confianza = propuesta?.confianza ?? 0;
      salida.entidad = entidad;
    }

    // Preguntas heredadas del contenido: una pregunta de vocación o trasfondo.
    if (definicion.usaPreguntaDeContenido) {
      salida.texto = definicion.texto.replace(
        '{preguntaEspecifica}',
        this._preguntaDeContenido(),
      );
    }

    // Opciones a mostrar.
    if (definicion.fuenteOpciones) {
      salida.opciones = this._opciones(definicion.fuenteOpciones);
    }

    return salida;
  }

  /**
   * Elige una pregunta específica del contenido ya deducido. Es lo que hace
   * que la entrevista pregunte «¿qué juraste?» a un custodio y «¿qué robaste?»
   * a una sombra.
   *
   * @returns {string}
   * @private
   */
  _preguntaDeContenido() {
    const fuentes = [];

    const clase = obtenerClase(this.borrador.clase);
    if (clase?.preguntasPropias) fuentes.push(...clase.preguntasPropias);

    const trasfondo = obtenerTrasfondo(this.borrador.trasfondo);
    if (trasfondo?.preguntas) fuentes.push(...trasfondo.preguntas);

    const raza = obtenerRaza(this.borrador.raza);
    if (raza?.preguntasPropias) fuentes.push(...raza.preguntasPropias);

    if (!fuentes.length) return '¿hay algo de su pasado que siga pesándole?';

    return this._elegirUno(fuentes).toLowerCase();
  }

  /**
   * Construye la lista de opciones de una pregunta.
   * Las propuestas del intérprete se colocan primero y quedan marcadas.
   *
   * @param {string} fuente
   * @returns {Array<Object>}
   * @private
   */
  _opciones(fuente) {
    let lista = [];

    switch (fuente) {
      case 'razas':
        lista = listarRazas().map((r) => ({
          refId: r.refId, nombre: r.nombre, lema: r.lema,
          descripcion: r.descripcion, etiquetas: [], fuente: r.fuente,
        }));
        break;

      case 'subrazas':
        lista = subrazasDe(this.borrador.raza).map((s) => ({
          refId: s.clave, nombre: s.nombre, lema: '', descripcion: s.descripcion,
        }));
        break;

      case 'clases':
        lista = listarClases().map((c) => ({
          refId: c.refId, nombre: c.nombre, lema: c.lema, descripcion: c.descripcion,
        }));
        break;

      case 'trasfondos':
        lista = listarTrasfondos().map((t) => ({
          refId: t.refId, nombre: t.nombre, lema: t.lema, descripcion: t.descripcion,
        }));
        break;
    }

    // La propuesta del intérprete sube al principio y se marca.
    const campo = fuente === 'subrazas' ? 'subraza' : fuente.slice(0, -1);
    const propuesta = this.borrador._propuestas[campo]?.refId;

    if (propuesta) {
      const indice = lista.findIndex((o) => o.refId === propuesta);
      if (indice > 0) {
        const [elemento] = lista.splice(indice, 1);
        elemento.sugerida = true;
        lista.unshift(elemento);
      }
    }

    return lista;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RESPUESTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Registra la respuesta a la pregunta actual.
   *
   * @param {string|Object} respuesta Texto libre, o { refId } si vino de opciones.
   * @returns {Promise<{aceptada: boolean, accion: string}>}
   */
  async responder(respuesta) {
    if (!this.actual) return { aceptada: false, accion: 'sin_pregunta' };

    const esTexto = typeof respuesta === 'string';
    const texto = esTexto ? limpiar(respuesta) : '';
    const normal = sinAcentos(texto.toLowerCase());

    // — Atajos —
    if (esTexto) {
      if (this._coincide(normal, ATAJOS.autocompletar)) {
        this.completar();
        return { aceptada: true, accion: 'autocompletado' };
      }
      if (this._coincide(normal, ATAJOS.atras)) {
        this.retroceder();
        return { aceptada: true, accion: 'atras' };
      }
      if (this._coincide(normal, ATAJOS.omitir) && this.actual.opcional) {
        this.formuladas.add(this.actual.id);
        return { aceptada: true, accion: 'omitida' };
      }
    }

    // — Confirmación —
    if (this.actual.tipo === 'confirmar') {
      const afirma = esTexto
        ? this._coincide(normal, TEXTOS_ENTREVISTA.confirmacionPositiva)
        : Boolean(respuesta?.confirmado);

      if (afirma) {
        this.borrador[this.actual.necesita] = this.actual.propuestaRefId;
        if (this.actual.necesita === 'raza') {
          const p = this.borrador._propuestas.raza;
          if (p?.subraza) this.borrador.subraza = p.subraza;
          this.borrador._tieneSubrazas = subrazasDe(this.actual.propuestaRefId).length > 0;
        }
        this.formuladas.add(this.actual.id);
        this._registrar(texto || 'sí');
        return { aceptada: true, accion: 'confirmado' };
      }

      // Rechazo: se descarta la propuesta y se pasará a la pregunta abierta.
      delete this.borrador._propuestas[this.actual.necesita];
      this.formuladas.add(this.actual.id);
      this._registrar(texto || 'no');

      // Si el rechazo trae una alternativa, se intenta interpretar.
      if (esTexto && texto.length > 3) await this.interpretar(texto);

      return { aceptada: true, accion: 'rechazado' };
    }

    // — Opciones —
    if (this.actual.tipo === 'opciones') {
      const refId = esTexto ? await this._resolverTexto(texto) : respuesta?.refId;
      if (!refId) return { aceptada: false, accion: 'no_entendido' };

      this.borrador[this.actual.extrae] = refId;
      if (this.actual.extrae === 'raza') {
        this.borrador._tieneSubrazas = subrazasDe(refId).length > 0;
      }
      this.formuladas.add(this.actual.id);
      this._registrar(texto || refId);
      return { aceptada: true, accion: 'elegido' };
    }

    // — Texto libre —
    if (!texto && !this.actual.opcional) return { aceptada: false, accion: 'vacia' };

    this.borrador[this.actual.extrae] = texto || null;
    this.formuladas.add(this.actual.id);
    this._registrar(texto);

    // Una respuesta larga puede resolver campos aún pendientes.
    if (texto.length > 15) await this.interpretar(texto);

    return { aceptada: true, accion: 'registrado' };
  }

  /**
   * Interpreta una respuesta escrita a una pregunta de opciones.
   * @param {string} texto
   * @returns {Promise<string|null>}
   * @private
   */
  async _resolverTexto(texto) {
    const opciones = this.actual.opciones ?? [];
    const normal = sinAcentos(texto.toLowerCase());

    // Coincidencia directa con el nombre de una opción.
    for (const o of opciones) {
      if (normal.includes(sinAcentos(o.nombre.toLowerCase()))) return o.refId;
    }

    // Si no, se pasa por el intérprete y se comprueba si acertó.
    await this.interpretar(texto);
    const campo = this.actual.extrae;
    return this.borrador[campo] ?? this.borrador._propuestas[campo]?.refId ?? null;
  }

  /** Vuelve a la pregunta anterior. */
  retroceder() {
    const ultima = this.historial.pop();
    if (!ultima) return;
    this.formuladas.delete(ultima.preguntaId);
    const definicion = PREGUNTAS.find((p) => p.id === ultima.preguntaId);
    if (definicion?.extrae) this.borrador[definicion.extrae] = null;
  }

  /**
   * @param {string} respuesta
   * @private
   */
  _registrar(respuesta) {
    this.historial.push({
      preguntaId: this.actual.id,
      pregunta: this.actual.texto,
      respuesta,
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     COMPLETADO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Rellena automáticamente todo lo que quede pendiente.
   *
   * Las decisiones no son aleatorias puras: se apoyan en lo ya conocido. Si el
   * personaje es un ferrano, el trasfondo por defecto será gremial antes que
   * noble, porque encaja con su cultura.
   */
  completar() {
    if (!this.borrador.raza) {
      const propuesta = this.borrador._propuestas.raza?.refId;
      this.borrador.raza = propuesta ?? this._elegirUno(listarRazas()).refId;
    }

    if (!this.borrador.clase) {
      const propuesta = this.borrador._propuestas.clase?.refId;
      this.borrador.clase = propuesta ?? this._elegirUno(listarClases()).refId;
    }

    if (!this.borrador.trasfondo) {
      const propuesta = this.borrador._propuestas.trasfondo?.refId;
      this.borrador.trasfondo = propuesta ?? this._trasfondoCoherente();
    }

    if (!this.borrador.nombre) {
      this.borrador.nombre = nombreSugerido(this.borrador.raza, this.rng) || 'Sin nombre';
    }

    if (!this.borrador.gancho) {
      const raza = obtenerRaza(this.borrador.raza);
      this.borrador.gancho = this._elegirUno(raza?.ganchos ?? ['Un pasado del que no habla.']);
    }

    if (!this.borrador.motivacion) {
      const trasfondo = obtenerTrasfondo(this.borrador.trasfondo);
      this.borrador.motivacion = this._elegirUno(
        trasfondo?.consecuencias ?? ['Algo le empujó al camino y aún no lo ha resuelto.'],
      );
    }

    if (!this.borrador.atributos) this.borrador.atributos = this.repartirAtributos();

    // Se marcan todas como formuladas para que la entrevista termine.
    for (const p of PREGUNTAS) this.formuladas.add(p.id);
    this.actual = null;

    log.info('Entrevista completada automáticamente');
  }

  /**
   * Elige un trasfondo coherente con el linaje deducido.
   * @returns {string}
   * @private
   */
  _trasfondoCoherente() {
    const raza = obtenerRaza(this.borrador.raza);
    const afinidad = {
      ferrano: 'gremial', enano: 'gremial',
      albar: 'erudito', elfo: 'erudito', gnomo: 'erudito',
      menudo: 'errante', mediano: 'errante', zarpasuave: 'errante',
      griscuerno: 'soldado', goliat: 'soldado', semiorco: 'soldado',
      brumal: 'devoto', aasimar: 'devoto',
      crisol: 'superviviente', tiflin: 'criminal',
      sombracorteza: 'campesino',
    };
    return afinidad[raza?.refId] ?? this._elegirUno(listarTrasfondos()).refId;
  }

  /**
   * Reparte los atributos según la vocación deducida.
   * @returns {Record<string, number>}
   */
  repartirAtributos() {
    const plantilla = PLANTILLA_POR_CLASE[this.borrador.clase] ?? 'equilibrado';
    return { ...PLANTILLAS_ATRIBUTOS[plantilla] };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RESULTADO
     ═══════════════════════════════════════════════════════════════════════ */

  /** @returns {boolean} true si no quedan campos obligatorios pendientes. */
  get completa() {
    return Boolean(this.borrador.nombre && this.borrador.raza && this.borrador.clase && this.borrador.trasfondo);
  }

  /** @returns {number} Progreso entre 0 y 1. */
  get progreso() {
    const obligatorios = ['nombre', 'raza', 'clase', 'trasfondo'];
    const hechos = obligatorios.filter((c) => this.borrador[c]).length;
    return hechos / obligatorios.length;
  }

  /**
   * Resumen legible para la pantalla de confirmación.
   * @returns {Object}
   */
  resumen() {
    const raza = obtenerRaza(this.borrador.raza);
    const clase = obtenerClase(this.borrador.clase);
    const trasfondo = obtenerTrasfondo(this.borrador.trasfondo);
    const sub = this.borrador.subraza
      ? subrazasDe(this.borrador.raza).find((s) => s.clave === this.borrador.subraza)
      : null;

    return {
      nombre: this.borrador.nombre,
      raza: raza?.nombre ?? '—',
      subraza: sub?.nombre ?? null,
      clase: clase?.nombre ?? '—',
      trasfondo: trasfondo?.nombre ?? '—',
      retrato: this.borrador.retrato,
      motivacion: this.borrador.motivacion,
      gancho: this.borrador.gancho,
      detalle: this.borrador.detalle,
      principio: this.borrador.principio,
      atributos: this.borrador.atributos ?? this.repartirAtributos(),
      lemaRaza: raza?.lema,
      lemaClase: clase?.lema,
    };
  }

  /**
   * Devuelve el borrador terminado, listo para CharacterFactory.
   * @returns {Object}
   */
  finalizar() {
    if (!this.completa) this.completar();
    if (!this.borrador.atributos) this.borrador.atributos = this.repartirAtributos();

    const { _propuestas, _tieneSubrazas, ...limpio } = this.borrador;
    return limpio;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     AUXILIARES
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * @param {string} campo
   * @param {string} refId
   * @returns {Object|null}
   * @private
   */
  _entidad(campo, refId) {
    if (!refId) return null;
    switch (campo) {
      case 'raza': return obtenerRaza(refId);
      case 'clase': return obtenerClase(refId);
      case 'trasfondo': return obtenerTrasfondo(refId);
      default: return null;
    }
  }

  /**
   * @param {string} texto
   * @param {string[]} lista
   * @returns {boolean}
   * @private
   */
  _coincide(texto, lista) {
    return lista.some((f) => texto === sinAcentos(f) || texto.startsWith(sinAcentos(f)));
  }

  /**
   * @template T
   * @param {T[]} lista
   * @returns {T}
   * @private
   */
  _elegirUno(lista) {
    if (!lista.length) return null;
    const i = this.rng ? this.rng.entero(0, lista.length - 1) : Math.floor(Math.random() * lista.length);
    return lista[i];
  }

  /**
   * @template T
   * @param {T[]} lista
   * @param {number} n
   * @returns {T[]}
   * @private
   */
  _elegirVarios(lista, n) {
    if (this.rng) return this.rng.elegirVarios(lista, n);
    return [...lista].sort(() => Math.random() - 0.5).slice(0, n);
  }

  /** Reinicia la entrevista por completo. */
  reiniciar() {
    this.borrador = this._borradorVacio();
    this.historial = [];
    this.formuladas.clear();
    this.actual = null;
  }
}

export default CharacterInterview;
