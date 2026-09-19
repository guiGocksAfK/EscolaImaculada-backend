-- Prisma 7 não envolve migrations PostgreSQL em transação automaticamente.
BEGIN;
CREATE TABLE "Matricula" (
  "id" TEXT PRIMARY KEY, "alunoId" TEXT NOT NULL, "turmaId" TEXT NOT NULL,
  "inicio" TEXT NOT NULL, "fim" TEXT,
  CONSTRAINT "Matricula_intervalo_check" CHECK ("fim" IS NULL OR "fim" >= "inicio"),
  CONSTRAINT "Matricula_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Matricula_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Matricula_turmaId_inicio_fim_idx" ON "Matricula"("turmaId", "inicio", "fim");
CREATE UNIQUE INDEX "Matricula_uma_aberta_por_aluno" ON "Matricula"("alunoId") WHERE "fim" IS NULL;
-- O legado não registra datas de transferência. Usa a primeira evidência
-- disponível para o vínculo atual; chamadas antigas continuam fonte histórica.
INSERT INTO "Matricula" (id, "alunoId", "turmaId", inicio, fim)
SELECT 'legado-' || a.id, a.id, a."turmaId",
  LEAST(to_char(a."criadoEm" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'),
    COALESCE((SELECT min(r.data) FROM "RegistroChamada" r WHERE r."alunoId"=a.id AND r."turmaId"=a."turmaId"), '9999-12-31')),
  CASE WHEN a.status = 'ATIVO' THEN NULL ELSE
    COALESCE(
      (SELECT to_char(max(r.data)::date + 1, 'YYYY-MM-DD')
       FROM "RegistroChamada" r
       WHERE r."alunoId" = a.id AND r."turmaId" = a."turmaId"),
      to_char(a."criadoEm" AT TIME ZONE 'UTC'
        AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'))
  END
FROM "Aluno" a;
DELETE FROM "Matricula" WHERE inicio = fim;

CREATE TABLE "DiaChamada" (
  "turmaId" TEXT NOT NULL, "data" TEXT NOT NULL,
  CONSTRAINT "DiaChamada_pkey" PRIMARY KEY ("turmaId", "data"),
  CONSTRAINT "DiaChamada_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "DiaChamada" SELECT DISTINCT "turmaId", data FROM "RegistroChamada";
ALTER TABLE "RegistroChamada" ADD CONSTRAINT "RegistroChamada_turmaId_data_fkey"
  FOREIGN KEY ("turmaId", data) REFERENCES "DiaChamada"("turmaId", data) ON DELETE CASCADE ON UPDATE CASCADE;

-- Não atribui uma justificativa a uma turma por adivinhação. Se houver
-- faltas órfãs/ambíguas, toda a migração falha antes de modificar o legado.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "FaltaJustificada" f WHERE
    (SELECT count(*) FROM "RegistroChamada" r WHERE r."alunoId"=f."alunoId" AND r.data=f.data AND r.status='F') <> 1)
  THEN RAISE EXCEPTION 'Há justificativas sem falta ou com mais de uma turma na mesma data. Resolva os vínculos antes da migração.';
  END IF;
END $$;
ALTER TABLE "FaltaJustificada" ADD COLUMN "registroChamadaId" TEXT;
UPDATE "FaltaJustificada" f SET "registroChamadaId"=r.id FROM "RegistroChamada" r
 WHERE r."alunoId"=f."alunoId" AND r.data=f.data AND r.status='F';
-- Consolida duplicatas preservando TODOS os motivos no registro sobrevivente.
WITH grupos AS (
 SELECT "registroChamadaId", min(id) AS manter,
 string_agg(motivo, E'\n\n' ORDER BY id) AS motivos
 FROM "FaltaJustificada" GROUP BY "registroChamadaId" HAVING count(*) > 1
)
UPDATE "FaltaJustificada" f SET motivo=g.motivos FROM grupos g WHERE f.id=g.manter;
DELETE FROM "FaltaJustificada" f USING "FaltaJustificada" manter
 WHERE f."registroChamadaId"=manter."registroChamadaId" AND f.id>manter.id;
ALTER TABLE "FaltaJustificada" ALTER COLUMN "registroChamadaId" SET NOT NULL;
CREATE UNIQUE INDEX "FaltaJustificada_registroChamadaId_key" ON "FaltaJustificada"("registroChamadaId");
ALTER TABLE "FaltaJustificada" ADD CONSTRAINT "FaltaJustificada_registroChamadaId_fkey"
 FOREIGN KEY ("registroChamadaId") REFERENCES "RegistroChamada"(id) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
