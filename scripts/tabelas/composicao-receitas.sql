-- =====================================================
-- . TABELA DE COMPOSIÇÃO DAS RECEITAS
-- =====================================================
CREATE TABLE IF NOT EXISTS composicao_receitas (
    id SERIAL PRIMARY KEY,
    receita_id INTEGER REFERENCES receitas(id) ON DELETE CASCADE,
    insumo_id INTEGER REFERENCES insumos(id) ON DELETE CASCADE,
    quantidade DECIMAL(10,3) NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'massa' CHECK (categoria IN ('massa', 'cobertura', 'embalagem')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(receita_id, insumo_id, categoria)
);