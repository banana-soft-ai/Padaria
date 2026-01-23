-- Migration: adiciona coluna quantidade_minima em insumos (idempotente)

ALTER TABLE IF EXISTS insumos
  ADD COLUMN IF NOT EXISTS quantidade_minima numeric;

-- Opcional: index para consultas por quantidade_minima (não obrigatório)
CREATE INDEX IF NOT EXISTS idx_insumos_quantidade_minima ON insumos(quantidade_minima);
