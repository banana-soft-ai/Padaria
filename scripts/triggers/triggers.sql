-- =====================================================
-- TRIGGERS UNIFICADAS - REY DOS PÃES
-- =====================================================

-- =====================================================
-- FUNÇÃO PARA ATUALIZAR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- =====================================================
-- TRIGGERS PARA UPDATED_AT NAS TABELAS
-- =====================================================
CREATE TRIGGER update_usuarios_updated_at
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insumos_updated_at
BEFORE UPDATE ON insumos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receitas_updated_at
BEFORE UPDATE ON receitas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produtos_updated_at
BEFORE UPDATE ON produtos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON clientes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_caixas_updated_at
BEFORE UPDATE ON caixas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendas_updated_at
BEFORE UPDATE ON vendas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custos_fixos_updated_at
BEFORE UPDATE ON custos_fixos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for lancamentos_fiscais removed (módulo fiscal eliminado)

CREATE TRIGGER update_composicao_receitas_updated_at
BEFORE UPDATE ON composicao_receitas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNÇÃO PARA ATUALIZAR ESTOQUE APÓS VENDA
-- =====================================================
CREATE OR REPLACE FUNCTION atualizar_estoque_venda()
RETURNS TRIGGER AS $$
DECLARE
    insumo_record RECORD;
BEGIN
    -- Para cada item da venda, calcular ingredientes necessários
    FOR insumo_record IN 
        SELECT ri.insumo_id, ri.quantidade * NEW.quantidade AS qtd_total
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
            insumo_id,
            tipo_movimentacao,
            quantidade,
            quantidade_anterior,
            quantidade_atual,
            motivo,
            referencia_id,
            referencia_tipo,
            usuario_id,
            data_movimentacao,
            hora_movimentacao,
            created_at
        )
        VALUES (
            insumo_record.insumo_id,
            'saida',
            insumo_record.qtd_total,
            (SELECT estoque_atual + insumo_record.qtd_total FROM insumos WHERE id = insumo_record.insumo_id),
            (SELECT estoque_atual FROM insumos WHERE id = insumo_record.insumo_id),
            'Venda de produto',
            NEW.venda_id,
            'venda',
            NEW.usuario_id,
            CURRENT_DATE,
            CURRENT_TIME,
            NOW()
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar estoque automaticamente após inserção de itens de venda
CREATE TRIGGER trigger_atualizar_estoque_venda
AFTER INSERT ON venda_itens
FOR EACH ROW EXECUTE FUNCTION atualizar_estoque_venda();

-- =====================================================
-- OUTRAS TRIGGERS PERSONALIZADAS (adicione aqui se houver)
-- =====================================================

-- Arquivo movido para scripts/sql/triggers/triggers.sql
