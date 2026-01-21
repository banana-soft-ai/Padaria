-- =====================================================
-- Tabela de controle de caixas (abertura e fechamento)
-- 7. TABELA DE CAIXAS
-- =====================================================
CREATE TABLE IF NOT EXISTS caixas (
    id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id),
    data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_abertura TIME NOT NULL DEFAULT CURRENT_TIME,
    valor_abertura DECIMAL(10,2) NOT NULL DEFAULT 0,
    data_fechamento DATE,
    hora_fechamento TIME,
    valor_fechamento DECIMAL(10,2),
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
