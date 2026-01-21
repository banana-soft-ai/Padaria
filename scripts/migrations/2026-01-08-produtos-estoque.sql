-- =============================================
-- Migração: adicionar colunas de estoque em produtos
-- Data: 2026-01-08
-- Objetivo: permitir controle de estoque para itens de varejo
-- =============================================

-- Adicionar coluna unidade com default 'un'
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS unidade TEXT;
ALTER TABLE produtos ALTER COLUMN unidade SET DEFAULT 'un';

-- Adicionar colunas de estoque com default 0
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_atual DECIMAL(10,3);
ALTER TABLE produtos ALTER COLUMN estoque_atual SET DEFAULT 0;

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_minimo DECIMAL(10,3);
ALTER TABLE produtos ALTER COLUMN estoque_minimo SET DEFAULT 0;

-- Inicializar valores nulos
UPDATE produtos SET unidade = COALESCE(unidade, 'un');
UPDATE produtos SET estoque_atual = COALESCE(estoque_atual, 0);
UPDATE produtos SET estoque_minimo = COALESCE(estoque_minimo, 0);
