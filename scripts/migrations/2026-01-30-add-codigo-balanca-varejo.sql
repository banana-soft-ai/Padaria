-- Adiciona coluna codigo_balanca na tabela varejo para mapear códigos EAN-13
-- de peso variável (prefixos 20-29) gerados pela balança Toledo Prix.
-- Execute no SQL Editor do Supabase.

ALTER TABLE varejo ADD COLUMN IF NOT EXISTS codigo_balanca TEXT;
CREATE INDEX IF NOT EXISTS idx_varejo_codigo_balanca ON varejo(codigo_balanca) WHERE codigo_balanca IS NOT NULL;
