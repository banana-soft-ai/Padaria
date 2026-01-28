-- Migration: adiciona campos faltantes na tabela varejo para ter paridade com insumos
-- Aplica em tabelas: varejo

ALTER TABLE IF EXISTS varejo
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS fornecedor TEXT,
  ADD COLUMN IF NOT EXISTS peso_pacote NUMERIC,
  ADD COLUMN IF NOT EXISTS preco_pacote NUMERIC,
  ADD COLUMN IF NOT EXISTS unidade_medida_base TEXT,
  ADD COLUMN IF NOT EXISTS quantidade_pacote NUMERIC,
  ADD COLUMN IF NOT EXISTS quantidade_minima NUMERIC,
  ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC;
