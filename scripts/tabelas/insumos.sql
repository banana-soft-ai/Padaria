-- =====================================================
-- Tabela de insumos, embalagens e outros materiais
-- 2. TABELA DE INSUMOS
-- =====================================================
CREATE TABLE IF NOT EXISTS insumos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL DEFAULT 'insumo' CHECK (categoria IN ('insumo', 'embalagem', 'outro')),
    marca TEXT,
    fornecedor TEXT,
    unidade TEXT NOT NULL DEFAULT 'kg',
    peso_pacote DECIMAL(10,3),
    preco_pacote DECIMAL(10,2),
    estoque_atual DECIMAL(10,3) DEFAULT 0,
    estoque_minimo DECIMAL(10,3) DEFAULT 0,
    codigo_barras TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
