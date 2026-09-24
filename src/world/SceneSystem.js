/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · world/SceneSystem.js
 * ---------------------------------------------------------------------------
 * Cuándo cambia la escena.
 *
 * Cada sistema sabe lo suyo —el viaje sabe cuándo se llega, el combate cuándo
 * empieza, los PNJ cuándo aparece alguien— y ya lo anunciaba con su evento.
 * Aquí se escuchan y se dice una sola cosa: «la escena ha cambiado», con lo
 * que hace falta para ilustrarla. Es lo único que pide una ilustración nueva;
 * entre un cambio y otro, la imagen se queda.
 *
 * Cambia la escena:
 *   · Al llegar a un sitio.
 *   · Al entrar en un interior o salir de él.
 *   · Al empezar un combate y al acabarlo.
 *   · Cuando aparece alguien, empieza un encuentro o se descubre algo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import { obtenerLugar, obtenerSublugar } from '../data/locations.data.js';

export const EVENTO_ESCENA = 'scene:changed';

export class SceneSystem extends SystemBase {
  static nombre = 'scene';
  static dependencias = ['world'];

  constructor(contexto) {
    super(contexto);
    /** Cuántas escenas van. @private */
    this._n = 0;
  }

  alIniciar() {
    this.escuchar('world:arrived', () => this.cambiar('llegada'));
    this.escuchar('world:sublugar:change', () => this.cambiar('interior'));
    this.escuchar('combat:start', () => this.cambiar('combate'));
    this.escuchar('combat:end', () => this.cambiar('fin_combate'));
    this.escuchar('npc:appears', ({ nombre } = {}) => this.cambiar('pnj', { nombre }));
    this.escuchar('exploration:encounter', ({ nombre } = {}) => this.cambiar('encuentro', { nombre }));
    this.escuchar('exploration:discovery', () => this.cambiar('hallazgo'));
  }

  /**
   * Anuncia un cambio de escena con lo que hace falta para ilustrarla.
   *
   * @param {string} motivo
   * @param {Object} [extra]
   * @returns {Object} La escena anunciada.
   */
  cambiar(motivo, extra = {}) {
    const refId = this.leer('world.ubicacion');
    const lugar = obtenerLugar(refId);
    const sublugarId = this.leer('world.sublugar');
    const sublugar = sublugarId ? obtenerSublugar(sublugarId) : null;

    const conocidos = this.leer('npcs.conocidos.porId', {}) ?? {};
    const npcs = (this.leer('npcs.presentes', []) ?? [])
      .map((id) => conocidos[id])
      .filter(Boolean)
      .map((n) => ({ nombre: n.nombre, rol: n.rol }));

    this._n += 1;

    const escena = {
      n: this._n,
      motivo,
      lugar: refId,
      nombreLugar: lugar?.nombre ?? null,
      terreno: lugar?.terreno ?? this.leer('world.terreno'),
      sublugar: sublugarId ?? null,
      nombreSublugar: sublugar?.nombre ?? null,
      interior: sublugar?.tipo ?? null,
      franja: this.leer('world.tiempo.franja'),
      clima: this.leer('world.clima.actual', 'despejado'),
      npcs,
      ...extra,
    };

    this.emitir(EVENTO_ESCENA, escena);
    return escena;
  }

  inspeccionar() {
    return { escenas: this._n };
  }
}

export default SceneSystem;
