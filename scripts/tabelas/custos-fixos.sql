-- =====================================================
-- Tabela para registro de custos fixos
-- 12. TABELA DE CUSTOS FIXOS
-- =====================================================
CREATE TABLE IF NOT EXISTS custos_fixos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('aluguel', 'energia', 'agua', 'telefone', 'salarios', 'impostos', 'outros')),
    valor_mensal DECIMAL(10,2) NOT NULL,
    data_vencimento INTEGER NOT NULL CHECK (data_vencimento >= 1 AND data_vencimento <= 31),
    ativo BOOLEAN DEFAULT true,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);