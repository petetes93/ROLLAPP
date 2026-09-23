/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · data/names.data.js
 * ---------------------------------------------------------------------------
 * Sílabas para el nombre aleatorio del personaje, una pila por linaje.
 *
 * Cada linaje suena distinto a propósito: al pulsar «aleatorio» el nombre ya
 * sugiere de dónde viene el personaje, igual que en cualquier generador de
 * videojuego. Solo datos; la combinación vive en CharacterRandom.js.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** @type {Readonly<Record<string, {inicio: string[], final: string[], finalF: string[]}>>} */
export const SILABAS_NOMBRE = Object.freeze({
  valdes: {
    inicio: ['Al', 'Ber', 'Cor', 'Da', 'El', 'Gar', 'Ian', 'Lu', 'Mar', 'Ro', 'San', 'Tor', 'Val', 'Xi'],
    final: ['do', 'mán', 'cio', 'rén', 'vio', 'lo', 'dar', 'tín', 'ger', 'mir'],
    finalF: ['da', 'na', 'ra', 'lia', 'ria', 'sa', 'ela', 'ina', 'ce', 'mar'],
  },
  sombracorteza: {
    inicio: ['Ael', 'Bry', 'Cae', 'Fey', 'Il', 'Lae', 'Myr', 'Nys', 'Syl', 'Thae', 'Yr'],
    final: ['wen', 'dor', 'thas', 'lan', 'ric', 'vyr', 'mael', 'rion'],
    finalF: ['wyn', 'thia', 'lis', 'ra', 'nel', 'dra', 'wen', 'lia'],
  },
  ferrano: {
    inicio: ['Bor', 'Dur', 'Gor', 'Hal', 'Kar', 'Mor', 'Thar', 'Brun', 'Dag', 'Or'],
    final: ['grim', 'dak', 'rok', 'mund', 'bar', 'din', 'gul', 'nar'],
    finalF: ['hild', 'dra', 'grid', 'na', 'run', 'wyn', 'mira', 'da'],
  },
  albar: {
    inicio: ['Aen', 'Cael', 'Eri', 'Ith', 'Lue', 'Nae', 'Ori', 'Sae', 'Tal', 'Vae', 'Zeph'],
    final: ['riel', 'thas', 'lion', 'ndor', 'vael', 'rith', 'miel', 'sar'],
    finalF: ['riel', 'lune', 'thea', 'wyn', 'ssa', 'nia', 'lith', 'vae'],
  },
  griscuerno: {
    inicio: ['Brak', 'Dro', 'Gru', 'Kha', 'Mog', 'Rha', 'Tar', 'Ur', 'Vor', 'Zug'],
    final: ['gan', 'mok', 'rash', 'tor', 'dun', 'gar', 'rok', 'nash'],
    finalF: ['ga', 'mara', 'sha', 'tra', 'ka', 'rha', 'dena', 'ruk'],
  },
  menudo: {
    inicio: ['Bil', 'Cor', 'Fin', 'Gil', 'Mer', 'Nob', 'Pip', 'Ros', 'Tob', 'Wil'],
    final: ['bo', 'rin', 'wick', 'do', 'lo', 'ney', 'by', 'tan'],
    finalF: ['sy', 'lly', 'na', 'bel', 'rie', 'wen', 'dy', 'lin'],
  },
  brumal: {
    inicio: ['Ash', 'Ciel', 'Eo', 'Hes', 'Mir', 'Nev', 'Ome', 'Sei', 'Vel', 'Wys'],
    final: ['ren', 'wyr', 'sil', 'dran', 'mor', 'vesk', 'lian', 'ros'],
    finalF: ['ra', 'sil', 'wyn', 'mae', 'lue', 'nesse', 'ria', 'vey'],
  },
  crisol: {
    inicio: ['Ash', 'Ka', 'Nai', 'Ra', 'Sah', 'Tam', 'Zar', 'Ib', 'Om', 'Yas'],
    final: ['ir', 'mun', 'ref', 'tar', 'sem', 'kan', 'ram', 'lek'],
    finalF: ['ra', 'mina', 'sa', 'lah', 'ira', 'nah', 'zel', 'deh'],
  },
});
