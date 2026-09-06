-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNome" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "escolaId" TEXT NOT NULL,
    "metodo" TEXT NOT NULL,
    "rota" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "ip" TEXT,

    CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistroAuditoria_escolaId_criadoEm_idx" ON "RegistroAuditoria"("escolaId", "criadoEm");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_usuarioId_criadoEm_idx" ON "RegistroAuditoria"("usuarioId", "criadoEm");
