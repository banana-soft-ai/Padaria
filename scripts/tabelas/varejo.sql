-- =====================================================
-- Tabela de itens de varejo (produtos prontos para venda)
-- =====================================================
CREATE TABLE IF NOT EXISTS varejo (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL DEFAULT 'varejo' CHECK (categoria IN ('varejo','outro')),
    unidade TEXT NOT NULL DEFAULT 'un',
    preco_venda DECIMAL(10,2) NOT NULL,
    codigo_barras TEXT UNIQUE,
    estoque_atual DECIMAL(10,3) DEFAULT 0,
    estoque_minimo DECIMAL(10,3) DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_varejo_codigo_barras ON varejo(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_varejo_ativo ON varejo(ativo);
