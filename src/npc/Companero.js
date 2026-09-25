/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · npc/Companero.js
 * ---------------------------------------------------------------------------
 * La ficha de un PNJ que se une al grupo.
 *
 * Sale de su oficio, y siempre la misma para el mismo PNJ: la herrera pega con
 * martillo y aguanta; el cazador tira de arco y ve rastros. No se guarda la
 * ficha, solo lo que cambia —la vida y si va herido—, así que un ajuste de
 * equilibrio aquí alcanza también a las partidas empezadas.
 *
 * También dice lo que comenta cuando pasa algo: por su oficio y, si puede, por
 * la misión en curso («Si el hierro viene del norte, yo sé por dónde»).
 *
 * Funciones puras.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { sinAcentos, trasPreposicion } from '../utils/text.js';

/**
 * Por oficio. La clave es la raíz, para que valga en masculino y femenino:
 * «herrer» casa con herrero y herrera.
 */
const OFICIOS = Object.freeze([
  {
    raiz: 'herrer', especialidad: 'forja y metal', rasgo: 'Aguanta como un yunque', vida: 22, defensa: 13,
    ataque: { nombre: 'Martillo de forja', dano: '1d8+1', tipo: 'contundente', bonoAtaque: 3, alcance: 'cuerpo' },
    dichos: ['Este acero no aguantará otro invierno.', 'Si el hierro viene {de_mision}, yo sé por dónde.'],
  },
  {
    raiz: 'aprendiz', especialidad: 'forja y recados', rasgo: 'Rápido y con ganas', vida: 15, defensa: 12,
    ataque: { nombre: 'Martillo pequeño', dano: '1d6', tipo: 'contundente', bonoAtaque: 2, alcance: 'cuerpo' },
    dichos: ['Mi maestro diría que no nos metamos.', 'Conozco un atajo {hacia_mision}.'],
  },
  {
    raiz: 'cazador', especialidad: 'rastreo', rasgo: 'Ojo de cazador', vida: 18, defensa: 13,
    ataque: { nombre: 'Arco corto', dano: '1d6+2', tipo: 'perforante', bonoAtaque: 4, alcance: 'distancia' },
    dichos: ['Aquí ha pasado alguien hace poco.', 'Si vamos {hacia_mision}, mejor por el monte.'],
  },
  {
    raiz: 'barquer', especialidad: 'ríos y pasos', rasgo: 'No le teme al agua', vida: 18, defensa: 12,
    ataque: { nombre: 'Pértiga', dano: '1d6+1', tipo: 'contundente', bonoAtaque: 3, alcance: 'cuerpo' },
    dichos: ['El río baja crecido.', 'He llevado a mucha gente {hacia_mision}. No todos volvieron.'],
  },
  {
    raiz: 'posader', especialidad: 'rumores', rasgo: 'Lo oye todo', vida: 16, defensa: 11,
    ataque: { nombre: 'Garrote', dano: '1d6', tipo: 'contundente', bonoAtaque: 2, alcance: 'cuerpo' },
    dichos: ['En mi posada se habló de esto.', 'Quien busca {mision} suele acabar mal. Tú no, espero.'],
  },
  {
    raiz: 'guardia', especialidad: 'combate', rasgo: 'Sabe cubrir a otro', vida: 22, defensa: 14,
    ataque: { nombre: 'Lanza', dano: '1d8+2', tipo: 'perforante', bonoAtaque: 4, alcance: 'cuerpo' },
    dichos: ['Ojo con los flancos.', 'Esto huele a emboscada.'],
  },
  {
    raiz: 'sacerdot', especialidad: 'curación', rasgo: 'Manos que calman', vida: 16, defensa: 12,
    ataque: { nombre: 'Maza', dano: '1d6+1', tipo: 'contundente', bonoAtaque: 2, alcance: 'cuerpo' },
    dichos: ['Que los dioses nos miren con buenos ojos.', 'Rezaré por lo que encuentres {hacia_mision}.'],
  },
  {
    raiz: 'mercader', especialidad: 'regatear', rasgo: 'Nunca paga el primer precio', vida: 14, defensa: 11,
    ataque: { nombre: 'Daga', dano: '1d4+1', tipo: 'perforante', bonoAtaque: 2, alcance: 'cuerpo' },
    dichos: ['Esto se puede vender bien.', '{en_mision} tengo quien me debe un favor.'],
  },
]);

const COMUN = Object.freeze({
  especialidad: 'conoce la zona', rasgo: 'Sabe moverse por aquí', vida: 15, defensa: 12,
  ataque: { nombre: 'Cuchillo', dano: '1d6', tipo: 'cortante', bonoAtaque: 2, alcance: 'cuerpo' },
  dichos: ['Por aquí se llega antes.', 'No me gusta este sitio.'],
});

const oficioDe = (rol) => {
  const r = sinAcentos(String(rol ?? '').toLowerCase());
  return OFICIOS.find((o) => r.includes(o.raiz)) ?? COMUN;
};

/**
 * La ficha de combate y de viaje de un compañero.
 *
 * @param {Object} npc Registro del PNJ (nombre, rol, genero, rasgo…).
 * @returns {Object}
 */
export function fichaDeCompanero(npc = {}) {
  const o = oficioDe(npc.rol);
  const genero = npc.genero === 'f' ? 'f' : 'm';

  return {
    refId: npc.refId,
    nombre: npc.nombre ?? 'Alguien',
    rol: npc.rol ?? 'lugareño',
    genero,
    // Su linaje de verdad: el retrato lo necesita. Se pintaba como valdés a
    // cualquier compañero, fuera de donde fuera.
    linaje: npc.linaje ?? null,
    especialidad: o.especialidad,
    rasgo: o.rasgo,
    vidaMax: o.vida,
    defensa: o.defensa,
    ataque: { ...o.ataque },
    // Para el retrato: quién es y lo que le distingue, con las mismas reglas
    // que el del jugador.
    descripcion: [genero === 'f' ? 'mujer' : 'hombre', npc.rol, npc.rasgo].filter(Boolean).join(', '),
  };
}

/**
 * Lo que dice un compañero cuando pasa algo.
 *
 * Si la frase de su oficio habla de la misión y no hay misión, se usa la
 * otra. Nunca inventa hechos: comenta, no revela.
 *
 * @param {Object} ficha De `fichaDeCompanero`.
 * @param {Object} [mision] { nombreLugar } de la misión principal en curso.
 * @param {(lista: string[]) => string} [elegir]
 * @returns {string}
 */
export function comentario(ficha, mision = null, elegir = (l) => l[0]) {
  const o = oficioDe(ficha?.rol);
  const lugar = mision?.nombreLugar ?? null;

  // Con la preposición ya puesta: «del Vado», «hacia el Camino», nunca «de El».
  const rellenar = (frase) => frase
    .replace('{de_mision}', lugar ? trasPreposicion('de', lugar) : 'del norte')
    .replace('{hacia_mision}', lugar ? trasPreposicion('hacia', lugar) : 'por esos caminos')
    .replace('{en_mision}', lugar ? trasPreposicion('En', lugar) : 'En el próximo pueblo')
    .replace('{mision}', mision?.titulo ? `“${mision.titulo.toLowerCase()}”` : 'lo que tú buscas');

  const frase = rellenar(elegir(o.dichos) ?? o.dichos[0]);
  return `${ficha.nombre}: «${frase}»`;
}

export default { fichaDeCompanero, comentario };
