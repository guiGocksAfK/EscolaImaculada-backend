export type Semestre = 1 | 2;

/**
 * Meses letivos de cada semestre (janeiro é férias). Fonte da verdade do
 * calendário escolar — usado por relatórios e pela referência das avaliações.
 */
export function mesesDoSemestre(s: Semestre): number[] {
  return s === 1 ? [2, 3, 4, 5, 6, 7] : [8, 9, 10, 11, 12];
}

export function semestreDoMes(mes1a12: number): Semestre {
  return mes1a12 <= 7 ? 1 : 2;
}
