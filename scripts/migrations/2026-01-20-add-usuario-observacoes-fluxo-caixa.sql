-- Migration: adicionar colunas 'usuario' e 'observacoes' em fluxo_caixa
-- Executar em bancos existentes para harmonizar schema com o cliente

ALTER TABLE fluxo_caixa
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

ALTER TABLE fluxo_caixa
  ADD COLUMN IF NOT EXISTS usuario TEXT;

-- Opcional: atualizar comentário da tabela
COMMENT ON TABLE fluxo_caixa IS 'Fluxo de entradas e saídas do caixa (inclui usuario e observacoes)';
