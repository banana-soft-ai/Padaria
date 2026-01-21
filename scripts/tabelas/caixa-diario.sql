-- 3. TABELA DE CAIXA DIÁRIO
CREATE TABLE IF NOT EXISTS caixa_diario (
    id SERIAL PRIMARY KEY,
    data DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
    valor_abertura DECIMAL(10,2) NOT NULL DEFAULT 0,
    valor_fechamento DECIMAL(10,2),
    valor_saidas DECIMAL(10,2) DEFAULT 0,
    valor_dinheiro_informado DECIMAL(10,2),
    valor_pix_informado DECIMAL(10,2),
    valor_debito_informado DECIMAL(10,2),
    valor_credito_informado DECIMAL(10,2),
    observacoes_abertura TEXT,
    observacoes_fechamento TEXT,
    usuario_abertura TEXT,
    usuario_fechamento TEXT,
    data_abertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_fechamento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);