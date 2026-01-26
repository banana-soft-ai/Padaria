-- Migration: Criação da tabela funcionario para cadastro de colaboradores
CREATE TABLE IF NOT EXISTS funcionario (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  idade INTEGER NOT NULL CHECK (idade >= 16 AND idade <= 120),
  endereco VARCHAR(255) NOT NULL,
  telefone VARCHAR(32) NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para busca rápida por nome
CREATE INDEX IF NOT EXISTS idx_funcionario_nome ON funcionario(nome);
