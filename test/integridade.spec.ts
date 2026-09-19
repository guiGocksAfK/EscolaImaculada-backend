import 'reflect-metadata';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { ChamadaService } from '../src/chamada/chamada.service.js';
import { AlunosService } from '../src/alunos/alunos.service.js';
import { AcessoService } from '../src/common/acesso.service.js';
import { RelatoriosService } from '../src/relatorios/relatorios.service.js';
import { FaltasJustificadasService } from '../src/faltas-justificadas/faltas-justificadas.service.js';
import { TurmasService } from '../src/turmas/turmas.service.js';
import { hojeISO } from '../src/common/validators.js';

const url = process.env.TEST_DATABASE_URL;
const hoje = hojeISO();
const anterior = new Date(hoje + 'T12:00:00Z');
anterior.setUTCDate(anterior.getUTCDate() - 5);
const data = anterior.toISOString().slice(0, 10);
const ano = Number(data.slice(0, 4));
const mes = Number(data.slice(5, 7));

// Nunca usa DATABASE_URL. Cada execução tem um schema descartável próprio.
describe.skipIf(!url)('integridade em PostgreSQL real', () => {
  const schema = 'integridade_' + randomUUID().replaceAll('-', '');
  let admin: Client;
  let prisma: PrismaClient;
  let chamada: ChamadaService;
  let alunos: AlunosService;
  let faltas: FaltasJustificadasService;
  let relatorios: RelatoriosService;
  let turmas: TurmasService;

  beforeAll(async () => {
    const alvo = new URL(url!);
    if (
      !['localhost', '127.0.0.1'].includes(alvo.hostname) ||
      !alvo.pathname.endsWith('_test')
    )
      throw new Error(
        'Use um banco local descartável com nome terminado em _test',
      );
    admin = new Client({ connectionString: url });
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    for (const dir of (await readdir('prisma/migrations'))
      .filter((n) => /^\d/.test(n))
      .sort()) {
      await admin.query(
        await readFile(`prisma/migrations/${dir}/migration.sql`, 'utf8'),
      );
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: url, options: `-c search_path=${schema}` },
        { schema },
      ),
    });
    const db = prisma as unknown as PrismaService;
    const acesso = new AcessoService(db);
    chamada = new ChamadaService(db, acesso);
    alunos = new AlunosService(db, acesso);
    faltas = new FaltasJustificadasService(db, acesso);
    relatorios = new RelatoriosService(db, acesso, chamada);
    turmas = new TurmasService(db);
  }, 30000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (admin) {
      await admin.query('ROLLBACK');
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });

  async function fixture() {
    const escola = await prisma.escola.create({
      data: { nome: 'Teste', endereco: 'Teste' },
    });
    const usuario = async (papel: 'DIRETORA' | 'PROFESSORA') =>
      prisma.usuario.create({
        data: {
          nome: papel,
          papel,
          escolaId: escola.id,
          cpf: randomUUID(),
          dataNascimento: '1980-01-01',
          senhaHash: 'teste',
        },
      });
    const diretora = await usuario('DIRETORA');
    const profA = await usuario('PROFESSORA');
    const profB = await usuario('PROFESSORA');
    const turma = async (professoraId: string) =>
      prisma.turma.create({
        data: {
          nome: randomUUID(),
          periodo: 'MANHA',
          anoLetivo: ano,
          escolaId: escola.id,
          professoraId,
        },
      });
    const a = await turma(profA.id),
      b = await turma(profB.id);
    const criar = async (nome: string) =>
      prisma.aluno.create({
        data: {
          nome,
          cpf: '',
          dataNascimento: '2020-01-01',
          nomePai: '',
          nomeMae: 'Mae',
          endereco: '',
          localNascimento: '',
          turmaId: a.id,
          matriculas: { create: { turmaId: a.id, inicio: data } },
        },
      });
    const um = await criar('Um'),
      dois = await criar('Dois');
    const dto = {
      turmaId: a.id,
      data,
      registros: [
        { alunoId: um.id, status: 'F' as const },
        { alunoId: dois.id, status: 'C' as const },
      ],
    };
    return { diretora, profA, profB, a, b, um, dois, dto };
  }

  it('duas gravações concorrentes: uma vence e a outra recebe 409 sem substituir dados', async () => {
    const f = await fixture();
    const outra = {
      ...f.dto,
      registros: f.dto.registros.map((r) => ({ ...r, status: 'C' as const })),
    };
    const resultados = await Promise.allSettled([
      chamada.salvarDia(f.profA, f.dto),
      chamada.salvarDia(f.profA, outra),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { status: 409 },
    });
    const vencedor = resultados.find((r) => r.status === 'fulfilled');
    const salvo = await chamada.getDia(f.profA, { turmaId: f.a.id, data });
    expect(salvo.registros).toEqual(
      expect.arrayContaining(
        vencedor!.status === 'fulfilled' ? vencedor!.value.registros : [],
      ),
    );
    expect(salvo.registros).toHaveLength(2);
    expect(await prisma.diaChamada.count({ where: { turmaId: f.a.id } })).toBe(
      1,
    );
  });

  it('rejeita omissão, duplicação e lista vazia sem selar o dia', async () => {
    const f = await fixture();
    for (const registros of [
      [],
      [f.dto.registros[0]],
      [f.dto.registros[0], f.dto.registros[0]],
    ]) {
      await expect(
        chamada.salvarDia(f.profA, { ...f.dto, registros }),
      ).rejects.toMatchObject({ status: 400 });
    }
    expect(await prisma.diaChamada.count({ where: { turmaId: f.a.id } })).toBe(
      0,
    );
    await chamada.salvarDia(f.profA, f.dto);
  });

  it('preserva frequência, justificativa e autorização na turma de origem após transferência', async () => {
    const f = await fixture();
    await chamada.salvarDia(f.profA, f.dto);
    await alunos.atualizar(f.diretora, f.um.id, {
      ...f.um,
      turmaId: f.b.id,
      status: 'ATIVO',
    });
    const motivo = {
      turmaId: f.a.id,
      alunoId: f.um.id,
      data,
      motivo: 'Atestado',
    };
    const justificada = await faltas.criar(f.profA, motivo);
    await expect(
      faltas.atualizar(f.profB, justificada.id, motivo),
    ).rejects.toMatchObject({ status: 403 });
    await expect(faltas.remover(f.profB, justificada.id)).rejects.toMatchObject(
      { status: 403 },
    );
    expect(await faltas.listar(f.profB, { turmaId: f.b.id })).toHaveLength(0);
    expect(await faltas.listar(f.profA, { turmaId: f.a.id })).toHaveLength(1);
    const antes = await chamada.getDia(f.profA, { turmaId: f.a.id, data });
    expect(antes.alunos!.map((a) => a.id)).toContain(f.um.id);
    const hojeA = await chamada.getDia(f.profA, {
      turmaId: f.a.id,
      data: hoje,
    });
    const hojeB = await chamada.getDia(f.profB, {
      turmaId: f.b.id,
      data: hoje,
    });
    expect(hojeA.alunos!.map((a) => a.id)).not.toContain(f.um.id);
    expect(hojeB.alunos!.map((a) => a.id)).toContain(f.um.id);
    const mensal = await chamada.getMes(f.profA, { turmaId: f.a.id, ano, mes });
    expect(mensal.linhas.find((a) => a.alunoId === f.um.id)?.totalFaltas).toBe(
      1,
    );
    const anual = await relatorios.resumoPorAluno(f.profA, {
      turmaId: f.a.id,
      ano,
    });
    expect(anual.linhas.find((a) => a.alunoId === f.um.id)).toMatchObject({
      faltas: 1,
      faltasJustificadas: 1,
    });
    const semestre = await relatorios.registroSemestral(f.profA, {
      turmaId: f.a.id,
      ano,
      semestre: mes <= 7 ? 1 : 2,
    });
    expect(semestre.faltasPorAluno[f.um.id]).toBe(1);
    expect(semestre.justificadas).toHaveLength(1);
    expect(semestre.alunos.find((a) => a.id === f.um.id)).toMatchObject({
      status: 'TRANSFERIDO',
    });
  });

  it('inativar mantém relatórios e reativar não inclui aluno no intervalo inativo', async () => {
    const f = await fixture();
    await chamada.salvarDia(f.profA, f.dto);
    await alunos.alterarStatus(f.diretora, f.um.id, 'DESISTENTE');
    expect(
      (
        await chamada.getDia(f.profA, { turmaId: f.a.id, data: hoje })
      ).alunos!.map((a) => a.id),
    ).not.toContain(f.um.id);
    expect(
      (
        await relatorios.resumoPorAluno(f.profA, { turmaId: f.a.id, ano })
      ).linhas.find((a) => a.alunoId === f.um.id)?.faltas,
    ).toBe(1);
    await alunos.alterarStatus(f.diretora, f.um.id, 'ATIVO');
    expect(
      await prisma.matricula.count({ where: { alunoId: f.um.id, fim: null } }),
    ).toBe(1);
    expect(
      (await chamada.getDia(f.profA, { turmaId: f.a.id, data })).registros,
    ).toHaveLength(2);
  });

  it('unicidade impede duas justificativas simultâneas para a mesma falta', async () => {
    const f = await fixture();
    await chamada.salvarDia(f.profA, f.dto);
    const dto = { turmaId: f.a.id, alunoId: f.um.id, data, motivo: 'Atestado' };
    const r = await Promise.allSettled([
      faltas.criar(f.profA, dto),
      faltas.criar(f.profA, dto),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(r.find((x) => x.status === 'rejected')).toMatchObject({
      reason: { code: 'P2002' },
    });
    const resumo = await relatorios.resumoPorAluno(f.profA, {
      turmaId: f.a.id,
      ano,
    });
    expect(
      resumo.linhas.find((a) => a.alunoId === f.um.id)?.faltasJustificadas,
    ).toBe(1);
  });

  it('cadastrar aluno hoje não exige sua presença em dia anterior', async () => {
    const f = await fixture();
    const novo = await alunos.criar(f.diretora, { ...f.um, nome: 'Novo' });
    expect(
      (await chamada.getDia(f.profA, { turmaId: f.a.id, data })).alunos!.map(
        (a) => a.id,
      ),
    ).not.toContain(novo.id);
    await chamada.salvarDia(f.profA, f.dto);
    expect(
      (
        await chamada.getDia(f.profA, { turmaId: f.a.id, data: hoje })
      ).alunos!.map((a) => a.id),
    ).toContain(novo.id);
  });

  it('excluir alunos não permite reabrir o dia nem apagar a turma com histórico', async () => {
    const f = await fixture();
    await chamada.salvarDia(f.profA, f.dto);
    await alunos.remover(f.diretora, f.um.id);
    await alunos.remover(f.diretora, f.dois.id);
    expect(
      (await chamada.getDia(f.profA, { turmaId: f.a.id, data })).lancada,
    ).toBe(true);
    await expect(chamada.salvarDia(f.profA, f.dto)).rejects.toMatchObject({
      status: 409,
    });
    await expect(turmas.remover(f.diretora, f.a.id)).rejects.toMatchObject({
      status: 409,
    });
  });

  it.each([false, true])(
    'migra legado sem perder motivos e aborta órfãos (órfão=%s)',
    async (orfao) => {
      const legado = 'legado_' + randomUUID().replaceAll('-', '');
      const db = new Client({ connectionString: url });
      await db.connect();
      try {
        await db.query(`CREATE SCHEMA "${legado}"`);
        await db.query(`SET search_path TO "${legado}"`);
        const pastas = (await readdir('prisma/migrations'))
          .filter((n) => /^\d/.test(n))
          .sort();
        for (const dir of pastas.filter(
          (n) => !n.endsWith('integridade_chamadas'),
        )) {
          await db.query(
            await readFile(`prisma/migrations/${dir}/migration.sql`, 'utf8'),
          );
        }
        await db.query(`
        INSERT INTO "Escola" (id,nome,endereco) VALUES ('e','Escola','Rua');
        INSERT INTO "Usuario" (id,nome,cpf,"dataNascimento","senhaHash",papel,"escolaId") VALUES ('p','Prof','cpf','1980-01-01','hash','PROFESSORA','e');
        INSERT INTO "Turma" (id,nome,periodo,"anoLetivo","professoraId","escolaId") VALUES ('t','Turma','MANHA',2026,'p','e');
        INSERT INTO "Aluno" (id,nome,cpf,"dataNascimento","nomePai","nomeMae","localNascimento",endereco,"turmaId") VALUES ('a','Aluno','','2020-01-01','','Mae','','','t');
        INSERT INTO "RegistroChamada" (id,data,status,"turmaId","alunoId") VALUES ('r','2026-02-05','F','t','a');
        INSERT INTO "FaltaJustificada" (id,data,motivo,"alunoId") VALUES ('f1','2026-02-05','Atestado','a'),('f2','2026-02-05','Complemento','a');
      `);
        await db.query(`UPDATE "Aluno" SET status = 'TRANSFERIDO'`);
        if (orfao)
          await db.query(
            `INSERT INTO "FaltaJustificada" (id,data,motivo,"alunoId") VALUES ('orfao','2026-02-06','Sem chamada','a')`,
          );
        const sql = await readFile(
          'prisma/migrations/20260919000200_integridade_chamadas/migration.sql',
          'utf8',
        );
        const preflight = await db.query(
          await readFile('prisma/preflight-integridade.sql', 'utf8'),
        );
        const pendencias = preflight.find((r) => r.command === 'SELECT');
        expect(pendencias?.rows).toHaveLength(orfao ? 1 : 0);
        if (orfao) {
          await expect(db.query(sql)).rejects.toThrow(
            'Há justificativas sem falta',
          );
          await db.query('ROLLBACK');
          expect(
            (
              await db.query(
                'SELECT count(*)::int AS n FROM "FaltaJustificada"',
              )
            ).rows[0].n,
          ).toBe(3);
          expect(
            (await db.query(`SELECT to_regclass('"DiaChamada"') AS tabela`))
              .rows[0].tabela,
          ).toBeNull();
        } else {
          await db.query(sql);
          const registros = (await db.query('SELECT * FROM "FaltaJustificada"'))
            .rows;
          expect(registros).toHaveLength(1);
          expect(registros[0]).toMatchObject({
            registroChamadaId: 'r',
            motivo: 'Atestado\n\nComplemento',
          });
          expect(
            (await db.query('SELECT * FROM "DiaChamada"')).rows,
          ).toHaveLength(1);
          expect(
            (await db.query('SELECT inicio FROM "Matricula"')).rows[0].inicio,
          ).toBe('2026-02-05');
          expect(
            (await db.query('SELECT fim FROM "Matricula"')).rows[0].fim,
          ).toBe('2026-02-06');
        }
      } finally {
        await db.query('ROLLBACK');
        await db.query(`DROP SCHEMA IF EXISTS "${legado}" CASCADE`);
        await db.end();
      }
    },
  );
});
