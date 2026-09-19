-- Executar ANTES do deploy, com a API atual ainda disponível.
-- Zero linhas = vínculos válidos neste instante. Qualquer linha bloqueia
-- a migration: corrija o vínculo com a escola antes de implantar.
-- Não altera dados e não imprime nomes, CPFs ou motivos.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT f.id AS "justificativaId", f."alunoId", f.data,
       count(r.id) AS "faltasCorrespondentes"
FROM "FaltaJustificada" f
LEFT JOIN "RegistroChamada" r
  ON r."alunoId" = f."alunoId" AND r.data = f.data AND r.status = 'F'
GROUP BY f.id, f."alunoId", f.data
HAVING count(r.id) <> 1
ORDER BY f.data, f.id;
COMMIT;
