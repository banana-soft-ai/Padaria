-- Migration: 0000_venda_caixa_trigger.sql
-- Cria função/trigger que, após inserir em `vendas`, atualiza o caixa e insere registros de fluxo/ movimentações.

BEGIN;

-- Remove trigger antigo se existir (idempotência)
DROP TRIGGER IF EXISTS trg_on_venda_insert ON vendas;

-- Substitui função para garantir atualização segura
CREATE OR REPLACE FUNCTION public.on_venda_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_caixa_id INTEGER;
  v_valor NUMERIC := COALESCE(NEW.valor_total, 0);
BEGIN
  -- Tenta encontrar caixa_diario aberto
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='caixa_diario') THEN
    -- Primeiro tenta o aberto na data da venda
    SELECT id INTO v_caixa_id FROM caixa_diario WHERE data = NEW.data AND status = 'aberto' ORDER BY created_at DESC LIMIT 1;
    -- Se não achar, pega QUALQUER caixa aberto (o mais recente)
    IF v_caixa_id IS NULL THEN
      SELECT id INTO v_caixa_id FROM caixa_diario WHERE status = 'aberto' ORDER BY created_at DESC LIMIT 1;
    END IF;
  ELSE
    v_caixa_id := NULL;
  END IF;

  IF v_caixa_id IS NULL THEN
    -- Sem caixa disponível; nada a fazer aqui
    RETURN NEW;
  END IF;

  -- Atualiza totais em caixa_diario (colunas usadas pela aplicação)
  UPDATE caixa_diario SET
    total_vendas = COALESCE(total_vendas,0) + v_valor,
    total_entradas = COALESCE(total_entradas,0) + v_valor,
    total_dinheiro = COALESCE(total_dinheiro,0) + CASE WHEN NEW.forma_pagamento = 'dinheiro' THEN v_valor ELSE 0 END,
    total_pix = COALESCE(total_pix,0) + CASE WHEN NEW.forma_pagamento = 'pix' THEN v_valor ELSE 0 END,
    total_debito = COALESCE(total_debito,0) + CASE WHEN NEW.forma_pagamento = 'cartao_debito' THEN v_valor ELSE 0 END,
    total_credito = COALESCE(total_credito,0) + CASE WHEN NEW.forma_pagamento = 'cartao_credito' THEN v_valor ELSE 0 END,
    total_caderneta = COALESCE(total_caderneta,0) + CASE WHEN NEW.forma_pagamento = 'caderneta' THEN v_valor ELSE 0 END
  WHERE id = v_caixa_id;

  -- Inserir detalhe em caixa_movimentacoes se a tabela existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='caixa_movimentacoes') THEN
    INSERT INTO caixa_movimentacoes (caixa_diario_id, tipo, valor, motivo, observacoes, created_at)
    VALUES (v_caixa_id, 'entrada', v_valor, CONCAT('Venda PDV (', NEW.id::text, ')'), NULL, now());
  END IF;

  -- Inserir registro em fluxo_caixa se existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='fluxo_caixa') THEN
    INSERT INTO fluxo_caixa (data, tipo, categoria, descricao, valor, caixa_diario_id, created_at)
    VALUES (NEW.data, 'entrada', 'caixa', CONCAT('Venda PDV (', NEW.id::text, ')'), v_valor, v_caixa_id, now());
  END IF;

  -- Atualizar coluna vendas.caixa_diario_id caso exista
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='caixa_diario_id') THEN
    UPDATE vendas SET caixa_diario_id = v_caixa_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Cria o trigger: após INSERT em vendas
CREATE TRIGGER trg_on_venda_insert
AFTER INSERT ON vendas
FOR EACH ROW
EXECUTE FUNCTION public.on_venda_insert();

COMMIT;
