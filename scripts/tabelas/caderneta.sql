-- =====================================================
-- Tabela de controle da caderneta (fiado) dos clientes
-- 10. TABELA DE CADERNETA (CRÉDITO DOS CLIENTES)
-- =====================================================
CREATE TABLE IF NOT EXISTS caderneta (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    venda_id INTEGER REFERENCES vendas(id),
    tipo_operacao TEXT NOT NULL CHECK (tipo_operacao IN ('compra', 'pagamento')),
    valor DECIMAL(10,2) NOT NULL,
    saldo_anterior DECIMAL(10,2) NOT NULL DEFAULT 0,
    saldo_atual DECIMAL(10,2) NOT NULL,
    observacoes TEXT,
    data_operacao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_operacao TIME NOT NULL DEFAULT CURRENT_TIME,
    usuario_id UUID REFERENCES usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);