-- Adiciona colunas de diferença por forma de pagamento em caixa_diario
-- Usadas no fechamento do caixa para auditoria detalhada
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS diferenca_dinheiro DECIMAL(10,2);
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS diferenca_pix DECIMAL(10,2);
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS diferenca_debito DECIMAL(10,2);
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS diferenca_credito DECIMAL(10,2);
