-- 2026-01-21-add-usuario-to-vendas.sql
-- Adiciona coluna `usuario` em `vendas` para rastreabilidade do operador
ALTER TABLE public.vendas
ADD COLUMN IF NOT EXISTS usuario TEXT;

-- Índice opcional para acelerar buscas por usuário
CREATE INDEX IF NOT EXISTS idx_vendas_usuario ON public.vendas(usuario);
