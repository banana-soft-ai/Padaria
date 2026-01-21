-- Arquivo movido para scripts/sql/tables/usuarios.sql

-- Tabela de usuários para autenticação e controle de acesso
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'funcionario' CHECK (role IN ('admin', 'gerente', 'funcionario', 'caixa')),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);