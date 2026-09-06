/**
 * Campos de experiência da BNCC (Educação Infantil) que compõem um registro
 * de conteúdo. Fonte da verdade da estrutura — o texto de `conteudo` é
 * apenas uma renderização feita aqui, no servidor.
 */

export interface CamposConteudo {
  disciplina?: string | null;
  euOutroNos?: string | null;
  corpoGestos?: string | null;
  tracosSons?: string | null;
  escutaFala?: string | null;
  espacoTempo?: string | null;
  outras?: string | null;
}

export const CAMPOS_EXPERIENCIA: Array<{
  chave: keyof CamposConteudo;
  rotulo: string;
}> = [
  { chave: 'euOutroNos', rotulo: 'O eu, o outro e o nós' },
  { chave: 'corpoGestos', rotulo: 'Corpo, gestos e movimentos' },
  { chave: 'tracosSons', rotulo: 'Traços, sons, cores e formas' },
  { chave: 'escutaFala', rotulo: 'Escuta, fala, pensamento e imaginação' },
  {
    chave: 'espacoTempo',
    rotulo: 'Espaço, tempo, quantidades, relações e transformações',
  },
];

const limpo = (v: string | null | undefined): string => (v ?? '').trim();

/** true se o registro tem ao menos um campo de conteúdo preenchido. */
export function temAlgumCampo(c: CamposConteudo): boolean {
  return (
    !!limpo(c.outras) ||
    CAMPOS_EXPERIENCIA.some((campo) => !!limpo(c[campo.chave]))
  );
}

/** Monta o texto de exibição a partir dos campos estruturados. */
export function renderizarConteudo(c: CamposConteudo): string {
  const partes: string[] = [];
  if (limpo(c.disciplina)) partes.push(`Conteúdo: ${limpo(c.disciplina)}`);
  for (const campo of CAMPOS_EXPERIENCIA) {
    const valor = limpo(c[campo.chave]);
    if (valor) partes.push(`${campo.rotulo}: ${valor}`);
  }
  if (limpo(c.outras)) partes.push(limpo(c.outras));
  return partes.join('\n\n');
}

/** Normaliza os campos: string vazia vira null, o resto é trimado. */
export function normalizarCampos(c: CamposConteudo): CamposConteudo {
  const norm = (v: string | null | undefined): string | null =>
    limpo(v) || null;
  return {
    disciplina: norm(c.disciplina),
    euOutroNos: norm(c.euOutroNos),
    corpoGestos: norm(c.corpoGestos),
    tracosSons: norm(c.tracosSons),
    escutaFala: norm(c.escutaFala),
    espacoTempo: norm(c.espacoTempo),
    outras: norm(c.outras),
  };
}
