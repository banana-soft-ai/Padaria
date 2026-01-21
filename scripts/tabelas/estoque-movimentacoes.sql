-- =====================================================
-- Tabela de movimentações de estoque (entradas, saídas, ajustes)
-- 11. TABELA DE MOVIMENTAÇÕES DE ESTOQUE
-- =====================================================
CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
    id SERIAL PRIMARY KEY,
    insumo_id INTEGER REFERENCES insumos(id) ON DELETE CASCADE,
    tipo_movimentacao TEXT NOT NULL CHECK (tipo_movimentacao IN ('entrada', 'saida', 'ajuste')),
    quantidade DECIMAL(10,3) NOT NULL,
    quantidade_anterior DECIMAL(10,3) NOT NULL,
    quantidade_atual DECIMAL(10,3) NOT NULL,
    motivo TEXT,
    referencia_id INTEGER, -- ID da venda, receita, etc.
    referencia_tipo TEXT, -- 'venda', 'receita', 'ajuste'
    usuario_id UUID REFERENCES usuarios(id),
    data_movimentacao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_movimentacao TIME NOT NULL DEFAULT CURRENT_TIME,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Arquivo movido para scripts/sql/tables/estoque-movimentacoes.sql
