-- =====================================================
-- Tabela de registro de vendas
-- 8. TABELA DE VENDAS
-- =====================================================
DROP TABLE IF EXISTS vendas CASCADE;

CREATE TABLE IF NOT EXISTS vendas (
    id SERIAL PRIMARY KEY,
    numero_venda BIGINT NOT NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIME NOT NULL DEFAULT CURRENT_TIME,
    cliente_id INTEGER REFERENCES clientes(id),
    usuario_id UUID REFERENCES usuarios(id),
    caixa_id INTEGER REFERENCES caixas(id),
    valor_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    valor_pago DECIMAL(10,2) DEFAULT 0,
    valor_debito DECIMAL(10,2) DEFAULT 0,
    valor_troco DECIMAL(10,2) DEFAULT 0,
    desconto DECIMAL(10,2) DEFAULT 0,
    forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('dinheiro', 'cartao_debito', 'cartao_credito', 'pix', 'caderneta')),
    status TEXT NOT NULL DEFAULT 'finalizada' CHECK (status IN ('pendente', 'finalizada', 'cancelada')),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);