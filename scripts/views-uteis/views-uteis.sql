-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View para relatório de vendas do dia (security_invoker: RLS do usuário que consulta)
CREATE OR REPLACE VIEW vendas_hoje WITH (security_invoker = true) AS
SELECT 
    v.id,
    v.numero_venda,
    v.hora,
    c.nome as cliente_nome,
    u.nome as vendedor_nome,
    v.valor_total,
    v.forma_pagamento,
    v.status
FROM vendas v
LEFT JOIN clientes c ON c.id = v.cliente_id
LEFT JOIN usuarios u ON u.id = v.usuario_id
WHERE v.data = CURRENT_DATE
ORDER BY v.hora DESC;

-- View para produtos com estoque baixo (security_invoker: RLS do usuário que consulta)
CREATE OR REPLACE VIEW produtos_estoque_baixo WITH (security_invoker = true) AS
SELECT 
    p.id,
    p.nome,
    p.categoria,
    p.preco_venda,
    COALESCE(SUM(ri.quantidade), 0) as ingredientes_necessarios,
    'Verificar disponibilidade' as status
FROM produtos p
LEFT JOIN receitas r ON r.id = p.receita_id
LEFT JOIN receita_ingredientes ri ON ri.receita_id = r.id
LEFT JOIN insumos i ON i.id = ri.insumo_id
WHERE p.ativo = true
GROUP BY p.id, p.nome, p.categoria, p.preco_venda
HAVING COUNT(CASE WHEN i.estoque_atual <= i.estoque_minimo THEN 1 END) > 0;

-- View para resumo de caixa do dia (security_invoker: RLS do usuário que consulta)
CREATE OR REPLACE VIEW resumo_caixa_hoje WITH (security_invoker = true) AS
SELECT 
    c.id as caixa_id,
    c.data_abertura,
    c.valor_abertura,
    COALESCE(SUM(v.valor_total), 0) as total_vendas,
    COALESCE(SUM(CASE WHEN v.forma_pagamento = 'dinheiro' THEN v.valor_total ELSE 0 END), 0) as vendas_dinheiro,
    COALESCE(SUM(CASE WHEN v.forma_pagamento = 'cartao_debito' THEN v.valor_total ELSE 0 END), 0) as vendas_debito,
    COALESCE(SUM(CASE WHEN v.forma_pagamento = 'cartao_credito' THEN v.valor_total ELSE 0 END), 0) as vendas_credito,
    COALESCE(SUM(CASE WHEN v.forma_pagamento = 'pix' THEN v.valor_total ELSE 0 END), 0) as vendas_pix,
    COALESCE(SUM(CASE WHEN v.forma_pagamento = 'caderneta' THEN v.valor_total ELSE 0 END), 0) as vendas_caderneta,
    COUNT(v.id) as total_vendas_count
FROM caixas c
LEFT JOIN vendas v ON v.caixa_id = c.id AND v.data = CURRENT_DATE
WHERE c.data_abertura = CURRENT_DATE AND c.status = 'aberto'
GROUP BY c.id, c.data_abertura, c.valor_abertura;

COMMIT;
