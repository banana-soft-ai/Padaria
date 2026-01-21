-- 4. TABELA DE FLUXO DE CAIXA
CREATE TABLE IF NOT EXISTS fluxo_caixa (
    id SERIAL PRIMARY KEY,
    data DATE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    categoria TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    caixa_diario_id INTEGER REFERENCES caixa_diario(id),
    observacoes TEXT,
    usuario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);