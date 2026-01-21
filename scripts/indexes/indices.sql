-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para vendas
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data);
CREATE INDEX IF NOT EXISTS idx_vendas_usuario ON vendas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vendas_caixa ON vendas(caixa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON vendas(cliente_id);

-- Índices para produtos
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON produtos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);
CREATE INDEX idx_produtos_codigo_barras ON produtos (codigo_barras);
CREATE INDEX idx_produtos_categoria ON produtos (categoria);


-- Índices para estoque
CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_insumo ON estoque_movimentacoes(insumo_id);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_data ON estoque_movimentacoes(data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_insumos_categoria ON insumos(categoria);

-- Índices para caderneta
CREATE INDEX IF NOT EXISTS idx_caderneta_cliente ON caderneta(cliente_id);
CREATE INDEX IF NOT EXISTS idx_caderneta_data ON caderneta(data_operacao);

-- Índices para caixas
CREATE INDEX IF NOT EXISTS idx_caixas_data ON caixas(data_abertura);
CREATE INDEX IF NOT EXISTS idx_caixas_status ON caixas(status);

