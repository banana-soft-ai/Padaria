-- Tabela de clientes com caderneta (similar a 'clientes', pode ser unificada no futuro)
CREATE TABLE IF NOT EXISTS clientes_caderneta (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    endereco TEXT,
    cpf_cnpj TEXT,
    saldo_devedor DECIMAL(10,2) DEFAULT 0,
    limite_credito DECIMAL(10,2) DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);