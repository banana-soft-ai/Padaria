-- =====================================================
-- Tabela para logs de auditoria do sistema
-- 14. TABELA DE LOGS DO SISTEMA
-- =====================================================
CREATE TABLE IF NOT EXISTS logs_sistema (
    id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id),
    acao TEXT NOT NULL,
    tabela_afetada TEXT,
    registro_id INTEGER,
    dados_anteriores JSONB,
    dados_novos JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);