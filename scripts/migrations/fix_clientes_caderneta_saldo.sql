-- Script de correção de `saldo_devedor` na tabela clientes_caderneta
-- 1) Cria backup da tabela
-- 2) Ajusta saldos negativos usando ABS
-- 3) Adiciona constraint para evitar negativos futuros (opcional)

BEGIN;

-- Backup (substitui backup anterior se existir)
DROP TABLE IF EXISTS backup_clientes_caderneta;
CREATE TABLE backup_clientes_caderneta AS TABLE clientes_caderneta;

-- Verificar quantos registros têm saldo negativo (informativo)
-- SELECT COUNT(*) FROM clientes_caderneta WHERE saldo_devedor < 0;

-- Ajustar saldos negativos (tornar positivos)
UPDATE clientes_caderneta
SET saldo_devedor = ABS(saldo_devedor)
WHERE saldo_devedor < 0;

-- Opcional: forçar escala/precisão correta (caso necessário)
-- UPDATE clientes_caderneta SET saldo_devedor = ROUND(saldo_devedor::numeric, 2);

-- Adicionar constraint para evitar novos negativos (pode falhar se ainda houver negativos)
ALTER TABLE clientes_caderneta
  ADD CONSTRAINT chk_saldo_devedor_nonnegative CHECK (saldo_devedor >= 0);

COMMIT;

-- Recomendações:
-- 1) Execute em ambiente de staging antes de produção.
-- 2) Faça backup completo do banco antes de rodar (pg_dump).
-- 3) Após aplicar, verifique relatórios e o cálculo de limite disponível.
