-- =====================================================
-- FUNÇÕES ÚTEIS
-- =====================================================

-- Função para calcular saldo da caderneta de um cliente
CREATE OR REPLACE FUNCTION get_saldo_caderneta(cliente_id_param INTEGER)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    saldo DECIMAL(10,2);
BEGIN
    SELECT COALESCE(SUM(
        CASE 
            WHEN tipo_operacao = 'compra' THEN valor
            WHEN tipo_operacao = 'pagamento' THEN -valor
        END
    ), 0) INTO saldo
    FROM caderneta 
    WHERE cliente_id = cliente_id_param;
    
    RETURN saldo;
END;
$$ LANGUAGE plpgsql;

-- Função para obter próximo número de venda do dia
CREATE OR REPLACE FUNCTION get_proximo_numero_venda()
RETURNS INTEGER AS $$
DECLARE
    proximo_numero INTEGER;
BEGIN
    SELECT COALESCE(MAX(numero_venda), 0) + 1 INTO proximo_numero
    FROM vendas 
    WHERE data = CURRENT_DATE;
    
    RETURN proximo_numero;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar estoque após venda
CREATE OR REPLACE FUNCTION atualizar_estoque_venda()
RETURNS TRIGGER AS $$
DECLARE
    insumo_record RECORD;
    quantidade_necessaria DECIMAL(10,3);
BEGIN
    -- Para cada item da venda, calcular ingredientes necessários
    FOR insumo_record IN 
        SELECT ri.insumo_id, ri.quantidade * NEW.quantidade as qtd_total
        FROM receita_ingredientes ri
        JOIN produtos p ON p.receita_id = ri.receita_id
        WHERE p.id = NEW.produto_id
    LOOP
        -- Atualizar estoque
        UPDATE insumos 
        SET estoque_atual = estoque_atual - insumo_record.qtd_total
        WHERE id = insumo_record.insumo_id;
        
        -- Registrar movimentação
        INSERT INTO estoque_movimentacoes (
            insumo_id, tipo_movimentacao, quantidade, quantidade_anterior, 
            quantidade_atual, motivo, referencia_id, referencia_tipo
        ) VALUES (
            insumo_record.insumo_id, 'saida', insumo_record.qtd_total,
            (SELECT estoque_atual + insumo_record.qtd_total FROM insumos WHERE id = insumo_record.insumo_id),
            (SELECT estoque_atual FROM insumos WHERE id = insumo_record.insumo_id),
            'Venda de produto', NEW.venda_id, 'venda'
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar estoque automaticamente
CREATE TRIGGER trigger_atualizar_estoque_venda
    AFTER INSERT ON venda_itens
    FOR EACH ROW EXECUTE FUNCTION atualizar_estoque_venda();