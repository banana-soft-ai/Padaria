-- Migration: 0001_create_caixa_movimentacoes_and_cols.sql
-- Cria tabela `caixa_movimentacoes` e adiciona colunas faltantes usadas pelo cliente
BEGIN;

-- 1) Criar tabela caixa_movimentacoes (se não existir)
CREATE TABLE IF NOT EXISTS caixa_movimentacoes (
    id SERIAL PRIMARY KEY,
    caixa_diario_id INTEGER REFERENCES caixa_diario(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor DECIMAL(10,2) NOT NULL,
    motivo TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2) Adicionar coluna `observacoes` em fluxo_caixa se não existir
ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- 3) Adicionar coluna `caixa_diario_id` em vendas se não existir
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS caixa_diario_id INTEGER REFERENCES caixa_diario(id);

COMMIT;
