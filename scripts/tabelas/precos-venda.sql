-- 6. TABELA DE PREÇOS DE VENDA
CREATE TABLE IF NOT EXISTS precos_venda (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'varejo')),
    preco_venda DECIMAL(10,2) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);