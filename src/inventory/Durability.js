/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · inventory/Durability.js
 * ---------------------------------------------------------------------------
 * Desgaste y reparación de objetos.
 *
 * La durabilidad va de 100 a 0. Por debajo de 40 el objeto pierde eficacia; a
 * 0 queda inservible hasta repararlo. No se destruye nunca por desgaste: eso
 * sería castigar al jugador por usar sus cosas, que es justamente lo que debe
 * hacer.
 *
 * El desgaste se aplica a las armas al golpear y a las armaduras al recibir.
 * Los objetos sin `tieneDurabilidad` —consumibles, materiales, joyas— quedan al
 * margen del sistema por completo.
 *
 * Funciones puras.
 *
 * Dependencias: config/balance.config.js, utils/math.js.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { OBJETOS } from '../config/balance.config.js';
import { saturar } from '../utils/math.js';

/* ═══════════════════════════════════════════════════════════════════════════
   ESTADOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Estado de conservación de un objeto.
 *
 * @param {number} valor 0-100
 * @returns {{clave: string, nombre: string, penalizacion: number, color: string}}
 */
export function estado(valor) {
  const d = OBJETOS.durabilidad;

  if (valor <= d.umbralRoto) {
    return { clave: 'roto', nombre: 'Roto', penalizacion: -99, color: 'peligro' };
  }
  if (valor < 20) {
    return { clave: 'critico', nombre: 'A punto de romperse', penalizacion: d.penalizacionDesgastado * 2, color: 'peligro' };
  }
  if (valor < d.umbralDesgastado) {
    return { clave: 'desgastado', nombre: 'Desgastado', penalizacion: d.penalizacionDesgastado, color: 'aviso' };
  }
  if (valor < 80) {
    return { clave: 'usado', nombre: 'Usado', penalizacion: 0, color: 'texto' };
  }
  return { clave: 'intacto', nombre: 'En buen estado', penalizacion: 0, color: 'exito' };
}

/**
 * @param {Object} objeto
 * @returns {boolean} true si el objeto está inservible.
 */
export function estaRoto(objeto) {
  if (!objeto?.tieneDurabilidad) return false;
  return (objeto.durabilidad ?? 100) <= OBJETOS.durabilidad.umbralRoto;
}

/**
 * Penalización que impone el estado del objeto a sus estadísticas.
 * @param {Object} objeto
 * @returns {number}
 */
export function penalizacion(objeto) {
  if (!objeto?.tieneDurabilidad) return 0;
  const e = estado(objeto.durabilidad ?? 100);
  // Un objeto roto no penaliza: directamente no se puede usar. Devolver −99
  // aquí ensuciaría cualquier suma; se comprueba con estaRoto().
  return e.clave === 'roto' ? 0 : e.penalizacion;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESGASTE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Aplica desgaste a un objeto.
 *
 * @param {Object} objeto
 * @param {number} cantidad Puntos de durabilidad perdidos.
 * @returns {{objeto: Object, cambio: number, seRompio: boolean, cruzoUmbral: string|null}}
 */
export function desgastar(objeto, cantidad) {
  if (!objeto?.tieneDurabilidad || cantidad <= 0) {
    return { objeto, cambio: 0, seRompio: false, cruzoUmbral: null };
  }

  const antes = objeto.durabilidad ?? 100;
  if (antes <= 0) return { objeto, cambio: 0, seRompio: false, cruzoUmbral: null };

  // Los afijos de robustez amortiguan el desgaste.
  const bonoRobustez = objeto.durabilidadMax > 100 ? objeto.durabilidadMax / 100 : 1;
  const efectivo = cantidad / bonoRobustez;

  const despues = saturar(antes - efectivo, 0, objeto.durabilidadMax ?? 100);

  const estadoAntes = estado(antes);
  const estadoDespues = estado(despues);

  return {
    objeto: { ...objeto, durabilidad: despues },
    cambio: despues - antes,
    seRompio: despues <= 0 && antes > 0,
    cruzoUmbral: estadoAntes.clave !== estadoDespues.clave ? estadoDespues.clave : null,
  };
}

/**
 * Desgaste que sufre un arma al golpear.
 *
 * Un crítico desgasta el doble: pegar con todo tiene su precio.
 *
 * @param {Object} arma
 * @param {Object} [opciones]
 * @param {boolean} [opciones.critico=false]
 * @param {boolean} [opciones.contraArmadura=false] Golpear metal desgasta más.
 * @returns {{objeto: Object, cambio: number, seRompio: boolean, cruzoUmbral: string|null}}
 */
export function desgastarArma(arma, opciones = {}) {
  const base = OBJETOS.durabilidad.porGolpeArma;
  let cantidad = base;

  if (opciones.critico) cantidad *= 2;
  if (opciones.contraArmadura) cantidad *= 1.5;

  return desgastar(arma, cantidad);
}

/**
 * Desgaste que sufre una armadura al recibir un golpe.
 *
 * Proporcional al daño: un roce no estropea una coraza, un mandoble sí.
 *
 * @param {Object} armadura
 * @param {number} danoRecibido
 * @returns {{objeto: Object, cambio: number, seRompio: boolean, cruzoUmbral: string|null}}
 */
export function desgastarArmadura(armadura, danoRecibido) {
  const base = OBJETOS.durabilidad.porGolpeArmadura;
  const cantidad = base * (1 + danoRecibido / 20);
  return desgastar(armadura, cantidad);
}

/* ═══════════════════════════════════════════════════════════════════════════
   REPARACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Coste de reparar un objeto por completo.
 *
 * @param {Object} objeto
 * @param {Object} [opciones]
 * @param {number} [opciones.modificadorPrecio=1] Reputación o regateo.
 * @returns {{coste: number, puntos: number, posible: boolean}}
 */
export function costeReparacion(objeto, opciones = {}) {
  if (!objeto?.tieneDurabilidad) return { coste: 0, puntos: 0, posible: false };

  const max = objeto.durabilidadMax ?? 100;
  const puntos = max - (objeto.durabilidad ?? max);

  if (puntos <= 0) return { coste: 0, puntos: 0, posible: false };

  const bruto = objeto.valor * OBJETOS.durabilidad.costeReparacion * puntos;
  const coste = Math.max(1, Math.ceil(bruto * (opciones.modificadorPrecio ?? 1)));

  return { coste, puntos, posible: true };
}

/**
 * Repara un objeto.
 *
 * @param {Object} objeto
 * @param {number} [puntos] Puntos a restaurar. Si se omite, repara del todo.
 * @returns {{objeto: Object, restaurado: number}}
 */
export function reparar(objeto, puntos) {
  if (!objeto?.tieneDurabilidad) return { objeto, restaurado: 0 };

  const max = objeto.durabilidadMax ?? 100;
  const antes = objeto.durabilidad ?? max;
  const despues = puntos === undefined ? max : saturar(antes + puntos, 0, max);

  return { objeto: { ...objeto, durabilidad: despues }, restaurado: despues - antes };
}

/**
 * Reparación improvisada, sin herrero.
 *
 * Requiere una prueba de artesanía y solo restaura un poco. Además reduce la
 * durabilidad máxima de forma permanente: apañar algo en el camino tiene su
 * coste, y eso empuja a buscar un herrero de verdad.
 *
 * @param {Object} objeto
 * @param {number} margenExito Diferencia entre la tirada y el umbral.
 * @returns {{objeto: Object, restaurado: number, maxPerdido: number}}
 */
export function repararEnCampo(objeto, margenExito) {
  if (!objeto?.tieneDurabilidad) return { objeto, restaurado: 0, maxPerdido: 0 };

  const restaura = saturar(10 + margenExito * 2, 5, 40);
  const maxPerdido = 3;

  const maxAntes = objeto.durabilidadMax ?? 100;
  const maxNuevo = Math.max(30, maxAntes - maxPerdido);
  const antes = objeto.durabilidad ?? 0;
  const despues = saturar(antes + restaura, 0, maxNuevo);

  return {
    objeto: { ...objeto, durabilidad: despues, durabilidadMax: maxNuevo },
    restaurado: despues - antes,
    maxPerdido: maxAntes - maxNuevo,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Datos de durabilidad para la interfaz.
 *
 * @param {Object} objeto
 * @returns {{visible: boolean, valor: number, max: number, porcentaje: number, estado: Object, texto: string}}
 */
export function paraInterfaz(objeto) {
  if (!objeto?.tieneDurabilidad) {
    return { visible: false, valor: 100, max: 100, porcentaje: 100, estado: estado(100), texto: '' };
  }

  const max = objeto.durabilidadMax ?? 100;
  const valor = objeto.durabilidad ?? max;
  const porcentaje = Math.round((valor / max) * 100);
  const e = estado(valor);

  return {
    visible: true,
    valor,
    max,
    porcentaje,
    estado: e,
    texto: e.clave === 'roto' ? 'Roto' : `${porcentaje} %`,
  };
}

/**
 * Aviso cuando un objeto cruza un umbral, para el toast.
 *
 * @param {Object} objeto
 * @param {string} umbral
 * @returns {{mensaje: string, tipo: string}|null}
 */
export function avisoUmbral(objeto, umbral) {
  const nombre = objeto?.nombre ?? 'Tu equipo';

  switch (umbral) {
    case 'roto':
      return { mensaje: `${nombre} se ha roto`, tipo: 'peligro' };
    case 'critico':
      return { mensaje: `${nombre} está a punto de romperse`, tipo: 'peligro' };
    case 'desgastado':
      return { mensaje: `${nombre} empieza a estar desgastado`, tipo: 'aviso' };
    default:
      return null;
  }
}

export default {
  estado,
  estaRoto,
  penalizacion,
  desgastar,
  desgastarArma,
  desgastarArmadura,
  costeReparacion,
  reparar,
  repararEnCampo,
  paraInterfaz,
  avisoUmbral,
};
