-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('DIRETORA', 'PROFESSORA');

-- CreateEnum
CREATE TYPE "Periodo" AS ENUM ('MANHA', 'TARDE', 'INTEGRAL');

-- CreateEnum
CREATE TYPE "StatusAluno" AS ENUM ('ATIVO', 'TRANSFERIDO', 'DESISTENTE');

-- CreateEnum
CREATE TYPE "StatusDia" AS ENUM ('C', 'F', 'D');

-- CreateTable
CREATE TABLE "Escola" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Escola_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "dataNascimento" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "escolaId" TEXT NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turma" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "periodo" "Periodo" NOT NULL,
    "anoLetivo" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "professoraId" TEXT NOT NULL,
    "escolaId" TEXT NOT NULL,

    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aluno" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "dataNascimento" TEXT NOT NULL,
    "nomePai" TEXT NOT NULL,
    "nomeMae" TEXT NOT NULL,
    "localNascimento" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "status" "StatusAluno" NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "turmaId" TEXT NOT NULL,

    CONSTRAINT "Aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroChamada" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "status" "StatusDia" NOT NULL,
    "turmaId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,

    CONSTRAINT "RegistroChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroConteudo" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,

    CONSTRAINT "RegistroConteudo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaltaJustificada" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,

    CONSTRAINT "FaltaJustificada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_cpf_key" ON "Usuario"("cpf");

-- CreateIndex
CREATE INDEX "RegistroChamada_turmaId_data_idx" ON "RegistroChamada"("turmaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroChamada_turmaId_alunoId_data_key" ON "RegistroChamada"("turmaId", "alunoId", "data");

-- CreateIndex
CREATE INDEX "RegistroConteudo_turmaId_data_idx" ON "RegistroConteudo"("turmaId", "data");

-- CreateIndex
CREATE INDEX "Avaliacao_turmaId_idx" ON "Avaliacao"("turmaId");

-- CreateIndex
CREATE INDEX "Avaliacao_alunoId_idx" ON "Avaliacao"("alunoId");

-- CreateIndex
CREATE INDEX "FaltaJustificada_alunoId_idx" ON "FaltaJustificada"("alunoId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "Escola"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_professoraId_fkey" FOREIGN KEY ("professoraId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "Escola"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroChamada" ADD CONSTRAINT "RegistroChamada_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroChamada" ADD CONSTRAINT "RegistroChamada_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroConteudo" ADD CONSTRAINT "RegistroConteudo_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaltaJustificada" ADD CONSTRAINT "FaltaJustificada_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
