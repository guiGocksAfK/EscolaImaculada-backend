/**
 * Popula o banco com uma escola de exemplo (dados fictícios, mas realistas).
 * Roda com:  npm run seed
 *
 * É idempotente: apaga tudo e recria. NÃO rodar em produção.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

// Usa o client já compilado (rode `nest build` antes — o script `npm run seed` faz isso).
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL não definida');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const ANO = new Date().getFullYear();
const SENHA_PADRAO = 'senha123';

// Segunda a sexta das 3 primeiras semanas do ano letivo (marca ~15 dias).
function diasLetivos(qtd: number): string[] {
  const dias: string[] = [];
  const d = new Date(ANO, 1, 2); // 02/fev
  while (dias.length < qtd) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      dias.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate(),
        ).padStart(2, '0')}`,
      );
    }
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

async function limpar(): Promise<void> {
  await prisma.registroChamada.deleteMany();
  await prisma.registroConteudo.deleteMany();
  await prisma.avaliacao.deleteMany();
  await prisma.faltaJustificada.deleteMany();
  await prisma.aluno.deleteMany();
  await prisma.turma.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.escola.deleteMany();
}

async function main(): Promise<void> {
  await limpar();

  const escola = await prisma.escola.create({
    data: {
      nome: 'Escola Imaculada',
      endereco: 'Rua das Acácias, 128 — Boa Vista, Curitiba/PR',
    },
  });

  const hash = await bcrypt.hash(SENHA_PADRAO, 10);

  const ana = await prisma.usuario.create({
    data: {
      nome: 'Ana Beatriz Nogueira',
      cpf: '11122233396',
      dataNascimento: '1979-04-12',
      senhaHash: await bcrypt.hash('segredo123', 10),
      papel: 'DIRETORA',
      escolaId: escola.id,
    },
  });

  const marta = await prisma.usuario.create({
    data: {
      nome: 'Marta Coração de Jesus',
      cpf: '22233344405',
      dataNascimento: '1988-09-03',
      senhaHash: hash,
      papel: 'PROFESSORA',
      escolaId: escola.id,
    },
  });

  const bianca = await prisma.usuario.create({
    data: {
      nome: 'Bianca Assunção',
      cpf: '33344455514',
      dataNascimento: '1991-11-27',
      senhaHash: hash,
      papel: 'PROFESSORA',
      escolaId: escola.id,
    },
  });

  const infantil4 = await prisma.turma.create({
    data: {
      nome: 'Infantil 4 — Manhã',
      periodo: 'MANHA',
      anoLetivo: ANO,
      professoraId: marta.id,
      escolaId: escola.id,
    },
  });

  const infantil5Tarde = await prisma.turma.create({
    data: {
      nome: 'Infantil 5 — Tarde',
      periodo: 'TARDE',
      anoLetivo: ANO,
      professoraId: marta.id,
      escolaId: escola.id,
    },
  });

  const infantil5Integral = await prisma.turma.create({
    data: {
      nome: 'Infantil 5 — Integral',
      periodo: 'INTEGRAL',
      anoLetivo: ANO,
      professoraId: bianca.id,
      escolaId: escola.id,
    },
  });

  const nomesInfantil4 = [
    'Antônio Ferreira Lima',
    'Cecília Marques da Rocha',
    'Davi Gonçalves',
    'Helena Sales Bittencourt',
    'João Vitor Assis',
    'Manuela Cardoso',
  ];
  const nomesInfantil5T = [
    'Alícia Ramos Nunes',
    'Bernardo Kühn',
    'Cauã Figueiredo',
    'Isabela Conceição',
    'Lucas Peçanha',
    'Sofía Vasconcelos',
    'Théo Andrade',
  ];
  const nomesInfantil5I = [
    'Enzo Gabriel Paz',
    'Lívia Sant’Anna',
    'Miguel Araújo',
    'Valentina Brízola',
  ];

  async function criarAlunos(nomes: string[], turmaId: string) {
    const alunos = [];
    for (let i = 0; i < nomes.length; i++) {
      alunos.push(
        await prisma.aluno.create({
          data: {
            nome: nomes[i],
            cpf: '',
            dataNascimento: `${ANO - 5}-0${(i % 9) + 1}-1${i % 9}`,
            nomePai: `Pai de ${nomes[i].split(' ')[0]}`,
            nomeMae: `Mãe de ${nomes[i].split(' ')[0]}`,
            localNascimento: 'Curitiba/PR',
            endereco: `Rua Projetada ${100 + i}, Curitiba/PR`,
            turmaId,
          },
        }),
      );
    }
    return alunos;
  }

  const alunos4 = await criarAlunos(nomesInfantil4, infantil4.id);
  const alunos5t = await criarAlunos(nomesInfantil5T, infantil5Tarde.id);
  await criarAlunos(nomesInfantil5I, infantil5Integral.id);

  // Um aluno transferido, para exercitar o filtro de status.
  await prisma.aluno.update({
    where: { id: alunos4[alunos4.length - 1].id },
    data: { status: 'TRANSFERIDO' },
  });

  // Chamada: ~12 dias para Infantil 5 - Tarde, com algumas faltas.
  const dias = diasLetivos(12);
  for (const [idx, data] of dias.entries()) {
    await prisma.registroChamada.createMany({
      data: alunos5t.map((a, i) => ({
        turmaId: infantil5Tarde.id,
        alunoId: a.id,
        data,
        status: (idx % 5 === 3 && i % 3 === 0
          ? 'F'
          : idx % 7 === 6 && i === 2
            ? 'F'
            : 'C') as 'C' | 'F',
      })),
    });
  }

  // Conteúdo dado em alguns dias.
  const conteudos = [
    'Roda de conversa e calendário. Vogais A e E com massinha.',
    'Contação de história “O Grúfalo”. Trabalho com rimas.',
    'Numerais até 10. Jogo da amarelinha no pátio.',
    'Pintura com guache — tema: a primavera. Coordenação motora fina.',
  ];
  for (let i = 0; i < conteudos.length; i++) {
    await prisma.registroConteudo.create({
      data: {
        turmaId: infantil5Tarde.id,
        data: dias[i * 3],
        conteudo: conteudos[i],
      },
    });
  }

  // Avaliações descritivas (texto livre, sem nota).
  const textos = [
    'Participa das rodas de conversa com entusiasmo e já reconhece o próprio nome. Precisa de apoio para dividir os brinquedos.',
    'Demonstra grande evolução na coordenação motora. Muito carinhosa com os colegas.',
    'Concentra-se bem nas atividades dirigidas. Está ampliando o vocabulário rapidamente.',
    'Tímido no início do semestre, hoje interage bem em pequenos grupos.',
  ];
  for (let i = 0; i < textos.length; i++) {
    await prisma.avaliacao.create({
      data: {
        alunoId: alunos5t[i].id,
        turmaId: infantil5Tarde.id,
        texto: textos[i],
        referencia: `1º semestre ${ANO}`,
      },
    });
  }

  // Faltas justificadas.
  await prisma.faltaJustificada.createMany({
    data: [
      {
        alunoId: alunos5t[0].id,
        data: dias[3],
        motivo: 'Consulta médica de rotina (atestado apresentado).',
      },
      {
        alunoId: alunos5t[2].id,
        data: dias[6],
        motivo: 'Viagem em família — comunicado com antecedência.',
      },
      {
        alunoId: alunos5t[2].id,
        data: dias[7],
        motivo: 'Continuação da viagem em família.',
      },
    ],
  });

  const totalAlunos = await prisma.aluno.count();
  console.log('Seed concluído:');
  console.log(`  escola:      ${escola.nome}`);
  console.log(`  diretora:    ${ana.nome}  (CPF 11122233396 / senha segredo123)`);
  console.log(
    `  professoras: ${marta.nome}, ${bianca.nome}  (CPF 22233344405 e 33344455514 / senha ${SENHA_PADRAO})`,
  );
  console.log(`  turmas:      3   alunos: ${totalAlunos}   ano letivo: ${ANO}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
