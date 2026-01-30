-- Permite saldo devedor negativo (saldo credor/haver) na tabela clientes_caderneta.
-- Remove a constraint chk_saldo_devedor_nonnegative se existir (adicionada por fix_clientes_caderneta_saldo.sql).
-- Execute no SQL Editor do Supabase.

ALTER TABLE clientes_caderneta
  DROP CONSTRAINT IF EXISTS chk_saldo_devedor_nonnegative;
