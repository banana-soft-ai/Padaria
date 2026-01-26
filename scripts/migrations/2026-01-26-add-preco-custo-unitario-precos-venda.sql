-- Migration: Adiciona coluna preco_custo_unitario na tabela precos_venda
-- Data: 2026-01-26

ALTER TABLE precos_venda
ADD COLUMN preco_custo_unitario numeric(12,4) DEFAULT 0.0000;

-- Permite nulo para compatibilidade com registros antigos
ALTER TABLE precos_venda
ALTER COLUMN preco_custo_unitario DROP NOT NULL;

-- Opcional: comentário explicativo
COMMENT ON COLUMN precos_venda.preco_custo_unitario IS 'Custo unitário calculado automaticamente para receitas e produtos varejo';
