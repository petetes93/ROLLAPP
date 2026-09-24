/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · engine/ActionRouter.js
 * ---------------------------------------------------------------------------
 * Enrutado de acciones.
 *
 * Decide quién resuelve cada acción del jugador. Tres destinos:
 *
 *   · LOCAL — el motor lo resuelve solo y no consulta al director. Beber una
 *     poción, mirar el mapa, viajar. Son acciones mecánicas con una respuesta
 *     objetiva.
 *   · DIRECTOR — necesita narración. La mayoría.
 *   · RECHAZADA — no se puede hacer, y se dice por qué.
 *
 * El primer destino es el que más aporta. Consultar a un modelo de lenguaje
 * para decirle al jugador que ha bebido agua es lento, caro y peor: el modelo
 * puede inventarse un efecto que el motor no ha aplicado.
 *
 * El tercero evita una clase entera de frustración. Si el jugador escribe «voy
 * a Forja Alta» y no conoce el sitio, decírselo es mejor que dejar que el
 * director improvise un viaje imposible.
 *
 * Dependencias: SystemBase, sistemas de mundo, inventario y misiones.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import { obtenerSublugar } from '../data/locations.data.js';
import { evaluarAmbicion } from './Ambicion.js';

/** Destinos posibles. */
export const RUTA = Object.freeze({
  LOCAL: 'local',
  DIRECTOR: 'director',
  RECHAZADA: 'rechazada',
});

export class ActionRouter extends SystemBase {
  static nombre = 'router';
  static dependencias = ['world', 'inventory', 'player'];
  static canal = 'engine';

  /* ═══════════════════════════════════════════════════════════════════════
     ENRUTADO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Decide cómo se resuelve una acción.
   *
   * @param {Object} intencion Salida de IntentParser.
   * @param {Object} [contexto]
   * @returns {{
   *   ruta: string, motivo: string|null, narracion: string|null,
   *   pistaDirector: string|null, resultado: Object|null
   * }}
   */
  enrutar(intencion, contexto = {}) {
    const vacio = {
      ruta: RUTA.DIRECTOR, motivo: null, narracion: null,
      pistaDirector: null, resultado: null,
    };

    if (!intencion) return vacio;

    // ─── Comprobaciones que rechazan ────────────────────────────────────
    const rechazo = this._comprobarRechazos(intencion, contexto);
    if (rechazo) return rechazo;

    // ─── Acciones que resuelve el motor ─────────────────────────────────
    switch (intencion.tipo) {
      case 'use_item': return this._usarObjeto(intencion);
      case 'travel': return this._viajar(intencion);
      case 'rest': return this._descansar(intencion, contexto);
      case 'explore': return this._explorar(intencion);
      case 'search': return this._registrar(intencion);
      case 'trade': return this._comerciar(intencion);
      default: return vacio;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RECHAZOS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Comprueba si la acción es imposible.
   *
   * Decirlo con claridad es mejor que dejar que el director improvise algo
   * incoherente.
   *
   * @private
   */
  _comprobarRechazos(intencion, contexto) {
    // ─── En combate, ciertas acciones no proceden ───────────────────────
    if (contexto.enCombate) {
      if (intencion.tipo === 'travel') {
        return this._rechazar('No puedes marcharte con un combate en curso.');
      }
      if (intencion.tipo === 'rest') {
        return this._rechazar('No es momento de descansar.');
      }
      if (intencion.tipo === 'trade') {
        return this._rechazar('Nadie va a comerciar contigo en mitad de una pelea.');
      }
    }

    // ─── Estados que impiden actuar ─────────────────────────────────────
    const estados = this.leer('player.estados', []);

    const bloqueantes = {
      paralizado: 'No puedes moverte.',
      moribundo: 'Estás demasiado malherido para eso.',
    };

    for (const estado of estados) {
      const motivo = bloqueantes[estado.refId];
      if (motivo && ['travel', 'explore', 'search'].includes(intencion.tipo)) {
        return this._rechazar(motivo);
      }
    }

    // ─── Viaje sin destino conocido ─────────────────────────────────────
    if (intencion.tipo === 'travel' && intencion.objetivo) {
      const world = this.sistema('world');
      const destino = world?.buscarDestino(intencion.objetivo);

      if (destino?.intuido) {
        return this._rechazar(
          `Sabes que ${destino.nombre} existe, pero no cómo llegar. Tendrás que preguntar o buscar el camino.`,
        );
      }
    }

    return null;
  }

  /** @private */
  _rechazar(narracion) {
    return {
      ruta: RUTA.RECHAZADA,
      motivo: narracion,
      narracion,
      pistaDirector: null,
      resultado: null,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ACCIONES LOCALES
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Consumir un objeto.
   *
   * Se resuelve local porque el efecto es mecánico y objetivo. Que el director
   * narre el sabor de la poción no compensa el riesgo de que se invente su
   * efecto.
   *
   * @private
   */
  _usarObjeto(intencion) {
    const inventario = this.sistema('inventory');

    // Se busca por el objetivo declarado, o el primer consumible.
    const objetos = Object.values(this.leer('inventory.objetos.porId', {}));
    const consumibles = objetos.filter((o) => o.categoria === 'consumible');

    if (!consumibles.length) {
      return this._rechazar('No llevas nada que puedas usar.');
    }

    let elegido = null;

    if (intencion.objetivo) {
      const buscado = intencion.objetivo.toLowerCase();
      elegido = consumibles.find((o) => o.nombre.toLowerCase().includes(buscado));
    }

    // Sin objetivo claro, se deja al director: puede que el jugador se refiera
    // a algo del entorno y no del inventario.
    if (!elegido) {
      return {
        ruta: RUTA.DIRECTOR,
        motivo: null,
        narracion: null,
        pistaDirector: `El personaje quiere usar algo. Lleva: ${consumibles.map((o) => o.nombre).join(', ')}.`,
        resultado: null,
      };
    }

    this.despachar('inventory/consumir', { idObjeto: elegido.id });

    return {
      ruta: RUTA.LOCAL,
      motivo: null,
      narracion: `Usas ${elegido.nombre.toLowerCase()}.`,
      pistaDirector: null,
      resultado: { tipo: 'consumo', objeto: elegido.nombre },
    };
  }

  /**
   * Viajar a otro lugar.
   * @private
   */
  _viajar(intencion) {
    const world = this.sistema('world');
    const travel = this.sistema('travel');

    // ─── Viaje en curso: reanudar ───────────────────────────────────────
    if (travel?.interrumpido) {
      travel.reanudar();

      return {
        ruta: RUTA.LOCAL,
        motivo: null,
        narracion: null,
        pistaDirector: null,
        resultado: { tipo: 'viaje_reanudado' },
      };
    }

    // ─── Sin destino: se ofrecen los disponibles ────────────────────────
    if (!intencion.objetivo) {
      const destinos = world?.destinos() ?? [];

      if (!destinos.length) {
        return this._rechazar('No hay ningún sitio conocido al que ir desde aquí.');
      }

      return {
        ruta: RUTA.DIRECTOR,
        motivo: null,
        narracion: null,
        pistaDirector: `El personaje quiere irse pero no ha dicho adónde. Desde aquí puede ir a: ${destinos.map((d) => d.nombre).join(', ')}. Pregúntale.`,
        resultado: null,
      };
    }

    // ─── Destino reconocido ─────────────────────────────────────────────
    const destino = world?.buscarDestino(intencion.objetivo);

    if (!destino) {
      return {
        ruta: RUTA.DIRECTOR,
        motivo: null,
        narracion: null,
        pistaDirector: `El personaje habla de ir a «${intencion.objetivo}», que no está en el mapa. Puede ser un sitio del que ha oído hablar o una confusión.`,
        resultado: null,
      };
    }

    if (!destino.conocido) {
      // Antes de rechazar por mapa se comprueba si lo escrito es una hazaña.
      // «Intento partir la montaña en dos de un tajo» encajaba «montaña» con
      // un lugar desconocido y devolvía «No sabes cómo llegar a Los Pozos
      // Hondos»: ni narración ni tirada, un error de mapa como respuesta a
      // algo épico. El analizador de intención ya no manda eso aquí, pero
      // esto cierra la puerta a las frases que aún lleguen.
      const ambicion = evaluarAmbicion(intencion.texto ?? '', this.leer('player.nivel', 1));

      if (ambicion.grado === 'desmedida') {
        return {
          ruta: RUTA.DIRECTOR,
          motivo: null,
          narracion: null,
          pistaDirector: ambicion.pista,
          resultado: null,
        };
      }

      return this._rechazar(`No sabes cómo llegar a ${destino.nombre}.`);
    }

    // El viaje se emprende de forma asíncrona: el turno no espera.
    queueMicrotask(() => travel?.viajar(destino.refId));

    return {
      ruta: RUTA.LOCAL,
      motivo: null,
      narracion: null,
      pistaDirector: null,
      resultado: { tipo: 'viaje', destino: destino.refId },
    };
  }

  /**
   * Descansar.
   *
   * Se enruta al director porque descansar es narrativamente relevante: puede
   * haber un sueño, una interrupción o una conversación. Pero el motor aplica
   * el efecto antes, para que la narración parta de un hecho consumado.
   *
   * @private
   */
  _descansar(intencion, contexto) {
    const inventario = this.sistema('inventory');
    const tieneProvisiones = inventario?.tieneProvisiones() ?? false;

    // ─── Seguridad del sitio ────────────────────────────────────────────
    const lugar = this.leer('world.ubicacion');
    const peligro = this.leer('world.peligroActual', 0);

    const enSublugar = Boolean(this.leer('world.sublugar'));
    const seguro = enSublugar || peligro <= 1;

    this.despachar('player/descansar', {
      tipo: seguro ? 'largo' : 'corto',
      conProvisiones: tieneProvisiones,
    });

    this.sistema('clock')?.avanzarTiempo(seguro ? 480 : 120, 'descanso');

    const pistas = [];

    pistas.push(seguro
      ? 'El personaje descansa a cubierto y sin sobresaltos.'
      : 'El personaje descansa a la intemperie, en un sitio poco seguro. Puede pasar algo.');

    if (!tieneProvisiones) {
      pistas.push('No tiene provisiones: el descanso no le ha quitado el hambre.');
    }

    return {
      ruta: RUTA.DIRECTOR,
      motivo: null,
      narracion: null,
      pistaDirector: pistas.join(' '),
      resultado: { tipo: 'descanso', seguro, conProvisiones: tieneProvisiones },
    };
  }

  /**
   * Explorar.
   * @private
   */
  _explorar(intencion) {
    const exploration = this.sistema('exploration');
    if (!exploration) return { ruta: RUTA.DIRECTOR, motivo: null, narracion: null, pistaDirector: null, resultado: null };

    // Si el jugador nombra un interior, se entra en él.
    if (intencion.objetivo) {
      const entrada = this._buscarSublugar(intencion.objetivo);

      if (entrada) {
        const r = this.sistema('world')?.entrarEn(entrada.refId);

        if (r?.exito) {
          return {
            ruta: RUTA.DIRECTOR,
            motivo: null,
            narracion: null,
            pistaDirector: `El personaje entra en ${entrada.nombre}. Descríbelo.`,
            resultado: { tipo: 'sublugar', sublugar: entrada.refId },
          };
        }

        return this._rechazar(r?.motivo ?? 'No puedes entrar ahí ahora.');
      }
    }

    // El resultado se resuelve de forma asíncrona y llega al director como
    // pista en el turno siguiente.
    const promesa = exploration.explorar();

    return {
      ruta: RUTA.DIRECTOR,
      motivo: null,
      narracion: null,
      pistaDirector: 'El personaje explora los alrededores. El motor está resolviendo qué encuentra.',
      resultado: { tipo: 'exploracion', promesa },
    };
  }

  /**
   * Registrar a fondo.
   * @private
   */
  _registrar(intencion) {
    const exploration = this.sistema('exploration');
    if (!exploration) return { ruta: RUTA.DIRECTOR, motivo: null, narracion: null, pistaDirector: null, resultado: null };

    const promesa = exploration.registrar();

    return {
      ruta: RUTA.DIRECTOR,
      motivo: null,
      narracion: null,
      pistaDirector: 'El personaje registra el sitio a fondo. El motor está resolviendo qué encuentra.',
      resultado: { tipo: 'registro', promesa },
    };
  }

  /**
   * Comerciar.
   * @private
   */
  _comerciar(intencion) {
    const npcs = this.sistema('npcs');
    const mercaderes = npcs?.mercaderesPresentes() ?? [];

    if (!mercaderes.length) {
      // Puede haber un servicio aunque no haya un PNJ mercader presente.
      const time = this.sistema('time');
      const mercado = time?.puedeUsar('mercado');

      if (mercado?.disponible) {
        return {
          ruta: RUTA.DIRECTOR,
          motivo: null,
          narracion: null,
          pistaDirector: 'El personaje busca con quién comerciar. Hay mercado aquí: preséntale a alguien que venda.',
          resultado: null,
        };
      }

      return this._rechazar('No hay nadie con quien comerciar aquí.');
    }

    // Con un solo mercader, se abre directamente.
    if (mercaderes.length === 1) {
      this.emitir('ui:trade:open', { npc: mercaderes[0] });

      return {
        ruta: RUTA.LOCAL,
        motivo: null,
        narracion: null,
        pistaDirector: null,
        resultado: { tipo: 'comercio', mercader: mercaderes[0].refId },
      };
    }

    return {
      ruta: RUTA.DIRECTOR,
      motivo: null,
      narracion: null,
      pistaDirector: `Hay varios con quien comerciar: ${mercaderes.map((m) => m.nombre).join(', ')}. Que el personaje elija.`,
      resultado: null,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     AUXILIARES
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Busca un sublugar del lugar actual por nombre.
   * @private
   */
  _buscarSublugar(texto) {
    const refId = this.leer('world.ubicacion');
    const lugar = this.sistema('world')?.lugarActual();

    const sublugares = lugar?.plantilla?.sublugares ?? [];
    if (!sublugares.length) return null;

    const limpio = texto.toLowerCase();

    return sublugares.find((s) => s.nombre.toLowerCase().includes(limpio))
      ?? sublugares.find((s) => (s.tipo ?? '').includes(limpio))
      ?? null;
  }

  /** @returns {Object} */
  inspeccionar() {
    return {
      enCombate: this.leer('combat.activo', false),
      destinos: this.sistema('world')?.destinos().length ?? 0,
      mercaderes: this.sistema('npcs')?.mercaderesPresentes().length ?? 0,
    };
  }
}

export default ActionRouter;
