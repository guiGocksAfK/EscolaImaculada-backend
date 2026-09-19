import { Prisma } from '../generated/prisma/client.js';

/** Todas as alterações de matrícula e lançamentos usam o mesmo lock de turma. */
export async function bloquearTurmas(
  tx: Prisma.TransactionClient,
  ids: string[],
) {
  const ordenados = [...new Set(ids)].sort();
  if (!ordenados.length) return;
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "Turma" WHERE id IN (${Prisma.join(ordenados)}) ORDER BY id FOR UPDATE`,
  );
}

export function matriculaNaData(
  turmaId: string,
  data: string,
): Prisma.MatriculaWhereInput {
  return {
    turmaId,
    inicio: { lte: data },
    OR: [{ fim: null }, { fim: { gt: data } }],
  };
}

/** Inclui participantes históricos, mesmo sem matrícula reconstruível no legado. */
export function alunosNoPeriodo(
  turmaId: string,
  inicio: string,
  fim: string,
  incluirAvaliacoes = false,
): Prisma.AlunoWhereInput {
  return {
    OR: [
      {
        matriculas: {
          some: {
            turmaId,
            inicio: { lt: fim },
            OR: [{ fim: null }, { fim: { gt: inicio } }],
          },
        },
      },
      { chamadas: { some: { turmaId, data: { gte: inicio, lt: fim } } } },
      ...(incluirAvaliacoes
        ? [
            {
              avaliacoes: {
                some: { turmaId, referencia: { contains: inicio.slice(0, 4) } },
              },
            },
          ]
        : []),
    ],
  };
}

/** Fecha o vínculo anterior e abre o novo na mesma transação do cadastro. */
export async function mudarMatricula(
  tx: Prisma.TransactionClient,
  alunoId: string,
  turmaId: string,
  ativo: boolean,
  data: string,
) {
  // Uma entrada e saída no mesmo dia não constitui intervalo de frequência.
  await tx.matricula.deleteMany({
    where: { alunoId, fim: null, inicio: data },
  });
  await tx.matricula.updateMany({
    where: { alunoId, fim: null },
    data: { fim: data },
  });
  if (ativo)
    await tx.matricula.create({ data: { alunoId, turmaId, inicio: data } });
}
