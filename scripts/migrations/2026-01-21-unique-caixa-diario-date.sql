-- Migration: 2026-01-21-unique-caixa-diario-date.sql
-- Garante que existe no máximo 1 registro de caixa por data (por PDV se coluna pdv_id existir).
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caixa_diario' AND column_name='pdv_id') THEN
    -- unique por (pdv_id, data)
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_caixa_diario_pdv_date ON caixa_diario (pdv_id, data)';
  ELSE
    -- unique apenas por data
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_caixa_diario_date ON caixa_diario (data)';
  END IF;
END$$;

COMMIT;
