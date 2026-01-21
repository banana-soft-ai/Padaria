-- Migration: adiciona campos para unidade de medida, quantidade do pacote e preco_unitario
-- Aplica em tabelas: insumos, varejo

ALTER TABLE IF EXISTS insumos
  ADD COLUMN IF NOT EXISTS unidade_medida_base text,
  ADD COLUMN IF NOT EXISTS quantidade_pacote numeric,
  ADD COLUMN IF NOT EXISTS preco_unitario numeric;

ALTER TABLE IF EXISTS varejo
  ADD COLUMN IF NOT EXISTS unidade_medida_base text,
  ADD COLUMN IF NOT EXISTS quantidade_pacote numeric,
  ADD COLUMN IF NOT EXISTS preco_unitario numeric;
