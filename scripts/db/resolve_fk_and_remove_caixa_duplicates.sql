-- Script: resolve_fk_and_remove_caixa_duplicates.sql
-- Objetivo: reatribuir FKs que apontam para registros duplicados de `caixa_diario`
-- para o registro "mantido" (mais recente), e depois remover as duplicatas.
-- IMPORTANTE: Faça backup completo do banco antes de rodar.
-- Uso recomendado:
-- 1) pg_dump -Fc "$DATABASE_URL" -f backup_before_fk_cleanup.dump
-- 2) psql "$DATABASE_URL" -f scripts/db/resolve_fk_and_remove_caixa_duplicates.sql

-- Este script:
--  A) cria uma tabela temporária `duplicate_pairs(old_id, keep_id)` contendo as duplicatas
--  B) atualiza todas as tabelas que possuem FK para `caixa_diario(id)` substituindo old_id -> keep_id
--  C) deleta os registros duplicados em `caixa_diario`

BEGIN;

-- Criar tabela temporária de mapeamento old_id -> keep_id
DROP TABLE IF EXISTS temp_caixa_duplicate_pairs;
CREATE TEMP TABLE temp_caixa_duplicate_pairs (
  old_id bigint PRIMARY KEY,
  keep_id bigint NOT NULL,
  data date,
  pdv_id bigint
);

-- Preencher a tabela de pares dependendo se pdv_id existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caixa_diario' AND column_name='pdv_id') THEN
    -- Há pdv_id: particionar por (pdv_id, data)
    INSERT INTO temp_caixa_duplicate_pairs(old_id, keep_id, data, pdv_id)
    SELECT cd.id AS old_id,
           (SELECT id FROM caixa_diario c2 WHERE c2.pdv_id = cd.pdv_id AND c2.data = cd.data ORDER BY COALESCE(created_at, '1970-01-01') DESC, id DESC LIMIT 1) AS keep_id,
           cd.data,
           cd.pdv_id
    FROM caixa_diario cd
    WHERE EXISTS (
      SELECT 1 FROM caixa_diario c3 WHERE c3.pdv_id = cd.pdv_id AND c3.data = cd.data AND c3.id <> cd.id
    )
    AND cd.id <> (
      SELECT id FROM caixa_diario c2 WHERE c2.pdv_id = cd.pdv_id AND c2.data = cd.data ORDER BY COALESCE(created_at, '1970-01-01') DESC, id DESC LIMIT 1
    );
  ELSE
    -- Sem pdv_id: particionar por data
    INSERT INTO temp_caixa_duplicate_pairs(old_id, keep_id, data, pdv_id)
    SELECT cd.id AS old_id,
           (SELECT id FROM caixa_diario c2 WHERE c2.data = cd.data ORDER BY COALESCE(created_at, '1970-01-01') DESC, id DESC LIMIT 1) AS keep_id,
           cd.data,
           NULL
    FROM caixa_diario cd
    WHERE EXISTS (
      SELECT 1 FROM caixa_diario c3 WHERE c3.data = cd.data AND c3.id <> cd.id
    )
    AND cd.id <> (
      SELECT id FROM caixa_diario c2 WHERE c2.data = cd.data ORDER BY COALESCE(created_at, '1970-01-01') DESC, id DESC LIMIT 1
    );
  END IF;
END$$;

-- Conferir quantas duplicatas foram mapeadas
DO $$
DECLARE cnt bigint;
BEGIN
  SELECT COUNT(*) INTO cnt FROM temp_caixa_duplicate_pairs;
  RAISE NOTICE 'Duplicate pairs mapped: %', cnt;
END$$;

-- Encontrar todas as colunas que referenciam caixa_diario(id)
CREATE TEMP TABLE temp_fk_refs AS
SELECT
  kcu.table_schema,
  kcu.table_name,
  kcu.column_name
FROM information_schema.key_column_usage kcu
JOIN information_schema.referential_constraints rc ON kcu.constraint_name = rc.constraint_name AND kcu.constraint_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name AND rc.unique_constraint_schema = ccu.constraint_schema
WHERE ccu.table_name = 'caixa_diario' AND ccu.column_name = 'id';

DO $$ BEGIN RAISE NOTICE 'Referencing tables/columns prepared.'; END $$;

-- Atualizar cada tabela referenciadora: set fk = keep_id WHERE fk = old_id
DO $$
DECLARE
  r RECORD;
  upd_sql TEXT;
BEGIN
  FOR r IN SELECT * FROM temp_fk_refs LOOP
    upd_sql := format('UPDATE %I.%I SET %I = dp.keep_id FROM temp_caixa_duplicate_pairs dp WHERE %I = dp.old_id AND %I IS NOT NULL', r.table_schema, r.table_name, r.column_name, r.column_name, r.column_name);
    RAISE NOTICE 'Executing: %', upd_sql;
    EXECUTE upd_sql;
  END LOOP;
END$$;

-- Deletar duplicatas agora que referências foram reatribuídas
DELETE FROM caixa_diario WHERE id IN (SELECT old_id FROM temp_caixa_duplicate_pairs);

DO $$
DECLARE cnt bigint;
BEGIN
  SELECT COUNT(*) INTO cnt FROM temp_caixa_duplicate_pairs;
  RAISE NOTICE 'Deleted duplicates count: %', cnt;
END$$;

COMMIT;

-- Após executar: verifique novamente se não há duplicatas
-- SELECT data, COUNT(*) FROM caixa_diario GROUP BY data HAVING COUNT(*) > 1;
-- (ou por pdv_id se aplicável)

-- Depois de confirmado, crie o índice único CONCURRENTLY (fora de transação):
-- psql "$DATABASE_URL" -c "CREATE UNIQUE INDEX CONCURRENTLY ux_caixa_diario_date ON caixa_diario (data);"
