/**
 * Popula o banco com uma escola de demonstração — dados fictícios porém
 * realistas (educação infantil, Curitiba/PR), próprios para apresentar ao
 * demandante.
 *
 *   npm run seed                 -> usa o ano corrente
 *   SEED_YEAR=2025 npm run seed  -> força o ano letivo
 *
 * É idempotente: apaga tudo e recria. NÃO rodar em produção.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

// Usa o client já compilado (o script `npm run seed` roda `nest build` antes).
import {
  PrismaClient,
  type Periodo,
  type StatusDia,
} from '../dist/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL não definida');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const ANO = Number(process.env.SEED_YEAR) || new Date().getFullYear();
const SENHA_PROFESSORA = 'imaculada2025';
const SENHA_DIRETORA = 'segredo123';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Dias úteis (seg–sex) a partir de uma data, quantidade fixa. */
function diasUteis(inicio: Date, qtd: number): string[] {
  const dias: string[] = [];
  const d = new Date(inicio);
  while (dias.length < qtd) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) dias.push(iso(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

/** PRNG determinístico, para o seed sair igual toda vez. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const rand = rng(20260101);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

// ---------------------------------------------------------------------------
// Pools de nomes / endereços
// ---------------------------------------------------------------------------

const MENINAS = [
  'Helena', 'Alice', 'Laura', 'Maria Júlia', 'Valentina', 'Heloísa',
  'Maria Clara', 'Cecília', 'Isabella', 'Manuela', 'Luiza', 'Sophia',
  'Antonella', 'Liz', 'Maitê', 'Aurora', 'Elisa', 'Lorena', 'Olívia', 'Beatriz',
];
const MENINOS = [
  'Miguel', 'Arthur', 'Heitor', 'Bernardo', 'Théo', 'Davi', 'Gael', 'Gabriel',
  'Pedro', 'Samuel', 'Antônio', 'Benício', 'Ravi', 'Bento', 'Henrique',
  'Murilo', 'Lucca', 'Otávio', 'Nicolas', 'Rafael',
];
const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa',
  'Rodrigues', 'Almeida', 'Nascimento', 'Carvalho', 'Araújo', 'Ribeiro',
  'Gonçalves', 'Barbosa', 'Martins', 'Rocha', 'Correia', 'Cardoso', 'Camargo',
  'Cordeiro', 'Wolff', 'Kaminski', 'Sperandio', 'Bueno', 'Bittencourt',
];
const ADULTOS_M = ['João', 'Carlos', 'Rafael', 'Bruno', 'Anderson', 'Rodrigo', 'Felipe', 'Marcelo', 'Diego', 'Thiago'];
const ADULTOS_F = ['Fernanda', 'Juliana', 'Patrícia', 'Camila', 'Aline', 'Débora', 'Vanessa', 'Priscila', 'Renata', 'Tatiane'];
const BAIRROS = [
  'Cristo Rei', 'Água Verde', 'Portão', 'Juvevê', 'Cabral', 'Boa Vista',
  'Santa Felicidade', 'Cajuru', 'Hauer', 'Rebouças', 'Mercês', 'Bacacheri',
];
const LOGRADOUROS = [
  'Rua Nossa Senhora da Luz', 'Rua Marechal Deodoro', 'Rua Padre Anchieta',
  'Rua Chile', 'Rua Itupava', 'Rua Fernandes de Barros', 'Avenida João Gualberto',
  'Rua Trajano Reis', 'Rua Almirante Gonçalves', 'Rua Camões',
];
const CIDADES_NASC = ['Curitiba/PR', 'Curitiba/PR', 'Curitiba/PR', 'São José dos Pinhais/PR', 'Colombo/PR', 'Pinhais/PR'];

interface AlunoPlan {
  nome: string;
  dataNascimento: string;
  nomePai: string;
  nomeMae: string;
  localNascimento: string;
  endereco: string;
}

function planejarAlunos(qtd: number, idade: number): AlunoPlan[] {
  const usados = new Set<string>();
  const lista: AlunoPlan[] = [];
  while (lista.length < qtd) {
    const menina = rand() < 0.5;
    const primeiro = menina ? pick(MENINAS) : pick(MENINOS);
    const sobrenome = `${pick(SOBRENOMES)} ${pick(SOBRENOMES)}`;
    const nome = `${primeiro} ${sobrenome}`;
    if (usados.has(nome)) continue;
    usados.add(nome);

    const ultimoSobrenome = sobrenome.split(' ').pop() as string;
    const nascY = ANO - idade;
    const nascM = 1 + Math.floor(rand() * 12);
    const nascD = 1 + Math.floor(rand() * 27);

    lista.push({
      nome,
      dataNascimento: `${nascY}-${String(nascM).padStart(2, '0')}-${String(nascD).padStart(2, '0')}`,
      nomePai: `${pick(ADULTOS_M)} ${ultimoSobrenome}`,
      nomeMae: `${pick(ADULTOS_F)} ${ultimoSobrenome}`,
      localNascimento: pick(CIDADES_NASC),
      endereco: `${pick(LOGRADOUROS)}, ${100 + Math.floor(rand() * 1800)} — ${pick(BAIRROS)}, Curitiba/PR`,
    });
  }
  return lista;
}

// ---------------------------------------------------------------------------
// Conteúdo pedagógico / avaliações (texto realista, BNCC – educação infantil)
// ---------------------------------------------------------------------------

const CONTEUDOS = [
  'Acolhida e roda de conversa. Combinados da turma e chamada com crachás. Campo de experiência: O eu, o outro e o nós.',
  'Contação da história "A Cesta da Dona Maricota". Exploração de frutas reais: cor, textura, cheiro e sabor.',
  'Circuito psicomotor no pátio: engatinhar, saltar com dois pés e equilíbrio na linha. Corpo, gestos e movimentos.',
  'Pintura livre com guache e rolinhos. Nomeação das cores primárias. Traços, sons, cores e formas.',
  'Brincadeira cantada "Escravos de Jó" e exploração de instrumentos de percussão. Consciência rítmica.',
  'Exploração do tapete sensorial e caixa surpresa. Vocabulário de texturas: liso, áspero, macio.',
  'Culinária: preparo de suco de laranja. Sequência de passos e noções de quantidade (cheio, vazio, metade).',
  'Cuidado com a horta da escola: rega e observação do crescimento do feijão. Registro no diário da turma.',
  'Jogo de encaixe e contagem até 5 com tampinhas. Espaços, tempos, quantidades, relações e transformações.',
  'Leitura de imagens do livro "Bruna e a Galinha d\'Angola". Roda de reconto com apoio de fantoches.',
  'Massa de modelar caseira: amassar, rolar e destacar. Nomeação de partes do corpo ao modelar bonecos.',
  'Brincadeira heurística com materiais não estruturados (potes, argolas, tecidos). Autonomia e escolha.',
];

const AVALIACOES = [
  'Adaptou-se bem à rotina da turma e demonstra segurança nos momentos de acolhida. Participa das rodas de conversa, aguarda a vez de falar na maioria das vezes e já nomeia os colegas. Nas atividades de artes, explora diferentes materiais com autonomia. Segue sendo incentivado a ampliar as trocas nas brincadeiras de faz de conta.',
  'É comunicativo, expressa desejos e necessidades com clareza e recorre ao adulto quando precisa de ajuda. Avançou bastante na coordenação motora ampla — sobe e desce a escada alternando os pés e participa com entusiasmo do circuito psicomotor. Segue os combinados coletivos com pequenas lembranças da professora.',
  'Demonstra concentração nas atividades dirigidas e conclui as propostas com capricho. Reconhece o próprio nome no crachá e identifica os numerais até 5 em contextos de brincadeira. Nos momentos de conflito, ainda precisa de mediação para expressar o que sente com palavras em vez de choro.',
  'É observador e se envolve mais em pequenos grupos do que em atividades com a turma toda. Ao longo do semestre ampliou o vocabulário e passou a participar dos momentos de canto. Manuseia lápis e pincel com preensão adequada. Combinamos com a família estimular a experimentação de novos alimentos também em casa.',
  'Participa ativamente das brincadeiras cantadas e das propostas de música, acompanhando o ritmo com o corpo e com instrumentos. É acolhedor com os colegas mais novos. Nas atividades de vida prática (guardar materiais, servir-se no lanche) demonstra crescente autonomia. Frequência regular no período.',
  'É afetuoso e bem-humorado e estabeleceu vínculo seguro com as professoras. Explora o ambiente com curiosidade e faz descobertas nas propostas sensoriais e no cuidado com a horta. Está desenvolvendo o controle de esfíncter com tranquilidade, com apoio conjunto da escola e da família.',
  'Avançou na linguagem oral: forma frases mais longas e reconta trechos das histórias com apoio dos fantoches. Nas atividades de matemática, faz correspondência um a um ao distribuir materiais. Precisa de incentivo para permanecer sentado nas propostas mais longas; temos oferecido pausas de movimento.',
  'Demonstra iniciativa nas brincadeiras e costuma propor enredos para os colegas no faz de conta. Reconhece e nomeia as cores primárias e secundárias. Lida bem com a frustração de perder em jogos de regra simples. Ótima parceria com a família, que acompanha de perto a agenda.',
  'Chegou mais retraído e hoje circula pelos espaços com segurança, buscando os colegas para brincar. Participa das rodas de leitura demonstrando interesse pelos livros, que folheia com cuidado. Na coordenação motora fina, faz rabiscos com intenção e começa a fechar formas circulares.',
  'Boa evolução na convivência: divide os brinquedos com menos mediação e demonstra empatia quando um colega se machuca. Acompanha a sequência da rotina e antecipa os próximos momentos do dia. Recomenda-se manter a regularidade do sono para melhor aproveitamento do período.',
];

const MOTIVOS_FALTA = [
  'Consulta pediátrica de rotina — atestado apresentado.',
  'Quadro de febre e resfriado; retornou após 48h sem sintomas, conforme orientação da escola.',
  'Viagem em família comunicada previamente à coordenação.',
  'Catapora — afastamento com atestado médico até liberação.',
  'Procedimento odontológico agendado no período da manhã.',
  'Luto familiar.',
  'Conjuntivite — retorno mediante liberação médica.',
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

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
      nome: 'Centro de Educação Infantil Maria Imaculada Conceição',
      endereco:
        'Rua Nossa Senhora da Luz, 345 — Cristo Rei, Curitiba/PR — CEP 80050-360',
    },
  });

  const hashProf = await bcrypt.hash(SENHA_PROFESSORA, 10);

  const diretora = await prisma.usuario.create({
    data: {
      nome: 'Ana Lúcia Menezes Barros',
      cpf: '11122233396',
      dataNascimento: '1976-03-19',
      senhaHash: await bcrypt.hash(SENHA_DIRETORA, 10),
      papel: 'DIRETORA',
      escolaId: escola.id,
    },
  });

  const professoras = await Promise.all(
    [
      { nome: 'Marta Regina Coração de Jesus', cpf: '22233344405', nasc: '1985-07-11' },
      { nome: 'Bianca Assunção Ferraz', cpf: '33344455514', nasc: '1990-12-02' },
      { nome: 'Cláudia Sperandio Nunes', cpf: '44455566621', nasc: '1982-05-28' },
    ].map((p) =>
      prisma.usuario.create({
        data: {
          nome: p.nome,
          cpf: p.cpf,
          dataNascimento: p.nasc,
          senhaHash: hashProf,
          papel: 'PROFESSORA',
          escolaId: escola.id,
        },
      }),
    ),
  );
  const [marta, bianca, claudia] = professoras;

  const planoTurmas: Array<{
    nome: string;
    periodo: Periodo;
    idade: number;
    qtd: number;
    profId: string;
    comRegistros: boolean;
  }> = [
    { nome: 'Berçário II — Integral', periodo: 'INTEGRAL', idade: 1, qtd: 8, profId: claudia.id, comRegistros: false },
    { nome: 'Maternal I — Manhã', periodo: 'MANHA', idade: 2, qtd: 12, profId: marta.id, comRegistros: false },
    { nome: 'Maternal II — Tarde', periodo: 'TARDE', idade: 3, qtd: 13, profId: marta.id, comRegistros: true },
    { nome: 'Infantil 4 — Manhã', periodo: 'MANHA', idade: 4, qtd: 14, profId: bianca.id, comRegistros: true },
    { nome: 'Infantil 5 — Tarde', periodo: 'TARDE', idade: 5, qtd: 15, profId: bianca.id, comRegistros: true },
    { nome: 'Infantil 5 — Integral', periodo: 'INTEGRAL', idade: 5, qtd: 10, profId: claudia.id, comRegistros: false },
  ];

  const inicioLetivo = new Date(ANO, 1, 3); // 03/fev
  let totalAlunos = 0;
  let totalChamada = 0;
  let totalAval = 0;
  let totalFaltas = 0;

  for (const pt of planoTurmas) {
    const turma = await prisma.turma.create({
      data: {
        nome: pt.nome,
        periodo: pt.periodo,
        anoLetivo: ANO,
        professoraId: pt.profId,
        escolaId: escola.id,
      },
    });

    const planos = planejarAlunos(pt.qtd, pt.idade);
    const alunos = [];
    for (const plano of planos) {
      alunos.push(
        await prisma.aluno.create({ data: { ...plano, cpf: '', turmaId: turma.id } }),
      );
    }
    totalAlunos += alunos.length;

    // 1 transferido por turma de mais idade, para exercitar o filtro de status.
    if (pt.idade >= 4 && alunos.length > 6) {
      await prisma.aluno.update({
        where: { id: alunos[alunos.length - 1].id },
        data: { status: 'TRANSFERIDO' },
      });
    }

    if (!pt.comRegistros) continue;

    const ativos = alunos.slice(0, alunos.length - (pt.idade >= 4 ? 1 : 0));
    const dias = diasUteis(inicioLetivo, 42); // ~2 meses de aula

    // Chamada: presença alta, faltas esparsas.
    const faltasPorAluno = new Map<string, string[]>();
    for (const dia of dias) {
      const registros = ativos.map((a, i) => {
        const falta = rand() < 0.06;
        if (falta) {
          const arr = faltasPorAluno.get(a.id) ?? [];
          arr.push(dia);
          faltasPorAluno.set(a.id, arr);
        }
        return {
          turmaId: turma.id,
          alunoId: a.id,
          data: dia,
          status: (falta ? 'F' : 'C') as StatusDia,
        };
      });
      await prisma.registroChamada.createMany({ data: registros });
      totalChamada += registros.length;
    }

    // Conteúdo: ~2 registros por semana nas primeiras 6 semanas.
    for (let s = 0; s < 6; s++) {
      for (const offset of [0, 3]) {
        const idx = s * 5 + offset;
        if (idx >= dias.length) continue;
        await prisma.registroConteudo.create({
          data: {
            turmaId: turma.id,
            data: dias[idx],
            conteudo: CONTEUDOS[(s * 2 + (offset ? 1 : 0)) % CONTEUDOS.length],
          },
        });
      }
    }

    // Avaliação descritiva: uma por aluno ativo.
    for (let i = 0; i < ativos.length; i++) {
      await prisma.avaliacao.create({
        data: {
          alunoId: ativos[i].id,
          turmaId: turma.id,
          texto: AVALIACOES[i % AVALIACOES.length],
          referencia: `1º semestre de ${ANO}`,
        },
      });
      totalAval++;
    }

    // Faltas justificadas: cobrem parte das faltas lançadas.
    for (const [alunoId, datas] of faltasPorAluno) {
      if (rand() < 0.55 && datas.length > 0) {
        await prisma.faltaJustificada.create({
          data: {
            alunoId,
            data: datas[0],
            motivo: pick(MOTIVOS_FALTA),
          },
        });
        totalFaltas++;
      }
    }
  }

  console.log('\nSeed concluído — escola de demonstração:\n');
  console.log(`  Escola......: ${escola.nome}`);
  console.log(`  Ano letivo..: ${ANO}`);
  console.log(`  Diretora....: ${diretora.nome}`);
  console.log(`                CPF 111.222.333-96  ·  senha ${SENHA_DIRETORA}`);
  console.log('  Professoras.:');
  for (const p of professoras) {
    const cpf = p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    console.log(`                ${p.nome}  ·  CPF ${cpf}  ·  senha ${SENHA_PROFESSORA}`);
  }
  console.log('');
  console.log(`  Turmas......: ${planoTurmas.length}`);
  console.log(`  Alunos......: ${totalAlunos}`);
  console.log(`  Chamada.....: ${totalChamada} lançamentos`);
  console.log(`  Avaliações..: ${totalAval}`);
  console.log(`  Faltas just.: ${totalFaltas}`);
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
