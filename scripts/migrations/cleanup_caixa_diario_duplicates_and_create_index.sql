

BEGIN;

-- 1) Mostrar resumo de possíveis duplicatas (consulta informativa)
SELECT 'Resumo duplicatas por pdv_id,data (se pdv_id existir) ou por data' AS info;
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_name='caixa_diario' AND column_name='pdv_id'
) AS pdv_id_exists;

-- Listar datas/tuplas duplicadas (apenas para leitura)
-- Se pdv_id existir, execute a query com pdv_id; caso contrário, use a segunda.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caixa_diario' AND column_name='pdv_id') THEN
    RAISE NOTICE 'pdv_id detected: listing duplicates by (pdv_id, data)';
    EXECUTE 'SELECT pdv_id, data, COUNT(*) AS cnt FROM caixa_diario GROUP BY pdv_id, data HAVING COUNT(*) > 1 ORDER BY pdv_id, data';
  ELSE
    RAISE NOTICE 'pdv_id NOT detected: listing duplicates by (data)';
    EXECUTE 'SELECT data, COUNT(*) AS cnt FROM caixa_diario GROUP BY data HAVING COUNT(*) > 1 ORDER BY data';
  END IF;
END$$;

-- 2) Criar tabela de backup com as linhas duplicadas (para auditoria)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caixa_diario' AND column_name='pdv_id') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS caixa_diario_duplicate_backup AS
      SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY pdv_id, data ORDER BY COALESCE(created_at, ''1970-01-01'') DESC, id DESC) rn
        FROM caixa_diario
      ) t WHERE t.rn > 1
    ';
  ELSE
    EXECUTE '
      CREATE TABLE IF NOT EXISTS caixa_diario_duplicate_backup AS
      SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY data ORDER BY COALESCE(created_at, ''1970-01-01'') DESC, id DESC) rn
        FROM caixa_diario
      ) t WHERE t.rn > 1
    ';
  END IF;
END$$;

-- 3) Verifique número de linhas criadas no backup
SELECT (SELECT COUNT(*) FROM caixa_diario_duplicate_backup) AS duplicate_rows_backed_up;

-- 4) Remover duplicatas (mantendo a mais recente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caixa_diario' AND column_name='pdv_id') THEN
    RAISE NOTICE 'Removing duplicates partitioned by (pdv_id, data) - keeping most recent (created_at,id)';
    EXECUTE '
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY pdv_id, data ORDER BY COALESCE(created_at, ''1970-01-01'') DESC, id DESC) rn
        FROM caixa_diario
      )
      DELETE FROM caixa_diario WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    ';
  ELSE
    RAISE NOTICE 'Removing duplicates partitioned by (data) - keeping most recent (created_at,id)';
    EXECUTE '
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY data ORDER BY COALESCE(created_at, ''1970-01-01'') DESC, id DESC) rn
        FROM caixa_diario
      )
      DELETE FROM caixa_diario WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    ';
  END IF;
END$$;

COMMIT;

-- 5) Verificação final: garantir que não existam mais duplicatas
-- Execute manualmente para confirmação
-- If pdv_id exists:
-- SELECT pdv_id, data, COUNT(*) FROM caixa_diario GROUP BY pdv_id, data HAVING COUNT(*) > 1;
-- Else:
-- SELECT data, COUNT(*) FROM caixa_diario GROUP BY data HAVING COUNT(*) > 1;

-- 6) Criar índice único (FAÇA ISTO FORA DE TRANSAÇÃO / CONCURRENTLY)
-- Observação: CREATE INDEX CONCURRENTLY cannot run inside a transaction block. Run the appropriate command below separately
-- usando psql ou o painel SQL do Supabase.

-- Se existir pdv_id:
-- psql "$DATABASE_URL" -c "CREATE UNIQUE INDEX CONCURRENTLY ux_caixa_diario_pdv_date ON caixa_diario (pdv_id, data);"

-- Se NÃO existir pdv_id:
-- psql "$DATABASE_URL" -c "CREATE UNIQUE INDEX CONCURRENTLY ux_caixa_diario_date ON caixa_diario (data);"

-- FIM
