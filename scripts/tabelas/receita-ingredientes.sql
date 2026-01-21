-- =====================================================
-- 4. TABELA DE INGREDIENTES DAS RECEITAS
-- =====================================================
CREATE TABLE IF NOT EXISTS receita_ingredientes (
    id SERIAL PRIMARY KEY,
    receita_id INTEGER REFERENCES receitas(id) ON DELETE CASCADE,
    insumo_id INTEGER REFERENCES insumos(id) ON DELETE CASCADE,
    quantidade DECIMAL(10,3) NOT NULL,
    unidade TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(receita_id, insumo_id)
);