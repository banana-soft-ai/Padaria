-- Migração para sincronizar precos_venda com as necessidades do frontend
-- Data: 2026-01-27

ALTER TABLE public.precos_venda 
  ADD COLUMN IF NOT EXISTS preco_custo_unitario DECIMAL(12, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margem_lucro DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_nome TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS estoque DECIMAL(12, 3) DEFAULT 0;

-- Recarregar o cache do PostgREST (necessário para o Supabase reconhecer as novas colunas)
NOTIFY pgrst, 'reload schema';
