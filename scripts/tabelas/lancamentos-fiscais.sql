-- =====================================================
-- Tabela para lançamentos fiscais (notas, etc.)
-- 13. TABELA DE LANÇAMENTOS FISCAIS
-- =====================================================
CREATE TABLE IF NOT EXISTS lancamentos_fiscais (
    id SERIAL PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('nfe', 'nfce', 'cfop')),
    numero TEXT,
    serie TEXT,
    chave_acesso TEXT,
    cnpj_emitente TEXT,
    cnpj_destinatario TEXT,
    valor_total DECIMAL(10,2) NOT NULL,
    data_emissao DATE NOT NULL,
    data_saida DATE,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processada', 'cancelada')),
    xml_content TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);