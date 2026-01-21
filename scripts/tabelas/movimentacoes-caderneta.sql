CREATE TABLE IF NOT EXISTS movimentacoes_caderneta (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes_caderneta(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('compra', 'pagamento', 'ajuste')),
    valor DECIMAL(10,2) NOT NULL,
    saldo_anterior DECIMAL(10,2),
    saldo_atual DECIMAL(10,2),
    descricao TEXT,
    venda_id INTEGER,
    usuario_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
