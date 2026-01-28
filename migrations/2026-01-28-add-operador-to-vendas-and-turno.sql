-- Migration: 2026-01-28-add-operador-to-vendas-and-turno.sql
-- Adiciona suporte a rastreabilidade completa por operador.

BEGIN;

-- 1. Garantir que a tabela vendas tenha as colunas para rastreabilidade do operador
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS operador_nome TEXT;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS operador_id INTEGER;

-- 2. Adicionar colunas de auditoria financeira na tabela turno_operador
ALTER TABLE public.turno_operador ADD COLUMN IF NOT EXISTS valor_abertura NUMERIC DEFAULT 0;
ALTER TABLE public.turno_operador ADD COLUMN IF NOT EXISTS valor_fechamento NUMERIC DEFAULT 0;
ALTER TABLE public.turno_operador ADD COLUMN IF NOT EXISTS total_vendas NUMERIC DEFAULT 0;
ALTER TABLE public.turno_operador ADD COLUMN IF NOT EXISTS total_dinheiro NUMERIC DEFAULT 0;
ALTER TABLE public.turno_operador ADD COLUMN IF NOT EXISTS total_pix NUMERIC DEFAULT 0;
ALTER TABLE public.turno_operador ADD COLUMN IF NOT EXISTS total_debito NUMERIC DEFAULT 0;
ALTER TABLE public.turno_operador ADD COLUMN IF NOT EXISTS total_credito NUMERIC DEFAULT 0;
ALTER TABLE public.turno_operador ADD COLUMN IF NOT EXISTS total_caderneta NUMERIC DEFAULT 0;
ALTER TABLE public.turno_operador ADD COLUMN IF NOT EXISTS valor_saidas NUMERIC DEFAULT 0;
ALTER TABLE public.turno_operador ADD COLUMN IF NOT EXISTS diferenca NUMERIC DEFAULT 0;

-- 3. Índices para performance nas consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_vendas_operador_nome ON public.vendas(operador_nome);
CREATE INDEX IF NOT EXISTS idx_vendas_caixa_diario_id ON public.vendas(caixa_diario_id);

COMMIT;
