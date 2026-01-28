-- Migration: 2026-01-28-remove-unique-date-caixa.sql
-- Remove a restrição de unicidade por data no caixa_diario para permitir múltiplos turnos no mesmo dia.

BEGIN;

-- Remove o índice único se ele existir (nome padronizado nas migrações anteriores)
DROP INDEX IF EXISTS ux_caixa_diario_date;
DROP INDEX IF EXISTS ux_caixa_diario_pdv_date;

-- Caso a restrição tenha sido criada como CONSTRAINT
ALTER TABLE caixa_diario DROP CONSTRAINT IF EXISTS ux_caixa_diario_date;
ALTER TABLE caixa_diario DROP CONSTRAINT IF EXISTS ux_caixa_diario_pdv_date;

COMMIT;
