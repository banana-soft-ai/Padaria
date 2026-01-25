-- 2026-06-13-create-turno-operador.sql
-- Cria tabela para controle de turnos de operadores do PDV

CREATE TABLE IF NOT EXISTS turno_operador (
    id SERIAL PRIMARY KEY,
    caixa_diario_id INTEGER REFERENCES caixa_diario(id) ON DELETE CASCADE,
    operador_id INTEGER REFERENCES clientes_caderneta(id),
    operador_nome TEXT NOT NULL,
    data_inicio TIMESTAMP NOT NULL DEFAULT NOW(),
    data_fim TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'aberto',
    observacoes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turno_operador_caixa ON turno_operador(caixa_diario_id);
CREATE INDEX IF NOT EXISTS idx_turno_operador_operador ON turno_operador(operador_id);
CREATE INDEX IF NOT EXISTS idx_turno_operador_status ON turno_operador(status);
