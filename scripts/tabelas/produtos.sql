CREATE TABLE produtos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL
      CHECK (categoria IN ('pao', 'doce', 'salgado', 'torta', 'bolo', 'outro')),
    receita_id INTEGER REFERENCES receitas(id),
    preco_venda DECIMAL(10,2) NOT NULL,
    peso_unitario DECIMAL(10,3),
    unidade TEXT DEFAULT 'un',
    estoque_atual DECIMAL(10,3) DEFAULT 0,
    estoque_minimo DECIMAL(10,3) DEFAULT 0,
    codigo_barras TEXT UNIQUE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Arquivo movido para scripts/sql/tables/produtos.sql
