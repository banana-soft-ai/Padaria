-- =====================================================
-- DADOS INICIAIS 
-- =====================================================

-- Inserir usuário administrador padrão
INSERT INTO usuarios (email, nome, role) VALUES 
('liliannoguei001@gmail.com', 'Lilian', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Inserir insumos básicos
INSERT INTO insumos (nome, categoria, unidade, preco_pacote, estoque_atual, estoque_minimo) VALUES
('Farinha de Trigo', 'insumo', 'kg', 4.50, 50.0, 10.0),
('Açúcar', 'insumo', 'kg', 3.20, 30.0, 5.0),
('Sal', 'insumo', 'kg', 2.80, 20.0, 2.0),
('Fermento Biológico', 'insumo', 'g', 8.90, 500.0, 100.0),
('Manteiga', 'insumo', 'kg', 25.00, 15.0, 3.0),
('Leite', 'insumo', 'L', 4.50, 40.0, 10.0),
('Ovos', 'insumo', 'unidade', 0.50, 200.0, 50.0)
ON CONFLICT (nome) DO NOTHING;

-- Inserir receitas básicas
INSERT INTO receitas (nome, categoria, rendimento, tempo_preparo, instrucoes) VALUES
('Pão Francês', 'pao', 50, 180, 'Misturar ingredientes, sovar, fermentar e assar'),
('Pão de Açúcar', 'pao', 30, 120, 'Misturar ingredientes com açúcar, sovar e assar'),
('Croissant', 'salgado', 20, 240, 'Preparar massa folhada, enrolar e assar'),
('Bolo de Chocolate', 'bolo', 1, 60, 'Misturar ingredientes e assar em forma untada')
ON CONFLICT (nome) DO NOTHING;

-- Inserir ingredientes para Pão Francês
INSERT INTO receita_ingredientes (receita_id, insumo_id, quantidade, unidade, categoria) 
SELECT 
    r.id,
    i.id,
    CASE 
        WHEN i.nome = 'Farinha de Trigo' THEN 1000.0
        WHEN i.nome = 'Açúcar' THEN 50.0
        WHEN i.nome = 'Sal' THEN 10.0
        WHEN i.nome = 'Fermento Biológico' THEN 20.0
        WHEN i.nome = 'Manteiga' THEN 50.0
        WHEN i.nome = 'Leite' THEN 500.0
        WHEN i.nome = 'Ovos' THEN 2.0
    END,
    CASE 
        WHEN i.nome = 'Farinha de Trigo' THEN 'g'
        WHEN i.nome = 'Açúcar' THEN 'g'
        WHEN i.nome = 'Sal' THEN 'g'
        WHEN i.nome = 'Fermento Biológico' THEN 'g'
        WHEN i.nome = 'Manteiga' THEN 'g'
        WHEN i.nome = 'Leite' THEN 'ml'
        WHEN i.nome = 'Ovos' THEN 'unidade'
    END,
    'massa'
FROM receitas r
CROSS JOIN insumos i
WHERE r.nome = 'Pão Francês'
AND i.nome IN ('Farinha de Trigo', 'Açúcar', 'Sal', 'Fermento Biológico', 'Manteiga', 'Leite', 'Ovos')
ON CONFLICT (receita_id, insumo_id) DO NOTHING;

-- Inserir ingredientes para Pão de Açúcar
INSERT INTO receita_ingredientes (receita_id, insumo_id, quantidade, unidade, categoria) 
SELECT 
    r.id,
    i.id,
    CASE 
        WHEN i.nome = 'Farinha de Trigo' THEN 1000.0
        WHEN i.nome = 'Açúcar' THEN 100.0
        WHEN i.nome = 'Sal' THEN 10.0
        WHEN i.nome = 'Fermento Biológico' THEN 20.0
        WHEN i.nome = 'Manteiga' THEN 80.0
        WHEN i.nome = 'Leite' THEN 400.0
        WHEN i.nome = 'Ovos' THEN 2.0
    END,
    CASE 
        WHEN i.nome = 'Farinha de Trigo' THEN 'g'
        WHEN i.nome = 'Açúcar' THEN 'g'
        WHEN i.nome = 'Sal' THEN 'g'
        WHEN i.nome = 'Fermento Biológico' THEN 'g'
        WHEN i.nome = 'Manteiga' THEN 'g'
        WHEN i.nome = 'Leite' THEN 'ml'
        WHEN i.nome = 'Ovos' THEN 'unidade'
    END,
    'massa'
FROM receitas r
CROSS JOIN insumos i
WHERE r.nome = 'Pão de Açúcar'
AND i.nome IN ('Farinha de Trigo', 'Açúcar', 'Sal', 'Fermento Biológico', 'Manteiga', 'Leite', 'Ovos')
ON CONFLICT (receita_id, insumo_id) DO NOTHING;

-- Inserir produtos básicos
INSERT INTO produtos (nome, categoria, receita_id, preco_venda, peso_unitario, ativo) 
SELECT 
    r.nome,
    r.categoria,
    r.id,
    CASE 
        WHEN r.nome = 'Pão Francês' THEN 0.80
        WHEN r.nome = 'Pão de Açúcar' THEN 1.20
        WHEN r.nome = 'Croissant' THEN 3.50
        WHEN r.nome = 'Bolo de Chocolate' THEN 25.00
    END,
    CASE 
        WHEN r.nome = 'Pão Francês' THEN 0.05
        WHEN r.nome = 'Pão de Açúcar' THEN 0.08
        WHEN r.nome = 'Croissant' THEN 0.06
        WHEN r.nome = 'Bolo de Chocolate' THEN 1.0
    END,
    true
FROM receitas r
WHERE r.nome IN ('Pão Francês', 'Pão de Açúcar', 'Croissant', 'Bolo de Chocolate')
ON CONFLICT (nome) DO NOTHING;

-- Inserir custos fixos básicos
INSERT INTO custos_fixos (nome, categoria, valor_mensal, data_vencimento) VALUES
('Aluguel', 'aluguel', 2000.00, 5),
('Energia Elétrica', 'energia', 800.00, 15),
('Água', 'agua', 150.00, 10),
('Telefone/Internet', 'telefone', 200.00, 20),
('IPTU', 'impostos', 300.00, 25)
ON CONFLICT (nome) DO NOTHING;

-- Verificar dados inseridos
SELECT 'Insumos inseridos:' as tipo, COUNT(*) as quantidade FROM insumos
UNION ALL
SELECT 'Receitas inseridas:', COUNT(*) FROM receitas
UNION ALL
SELECT 'Ingredientes inseridos:', COUNT(*) FROM receita_ingredientes
UNION ALL
SELECT 'Produtos inseridos:', COUNT(*) FROM produtos
UNION ALL
SELECT 'Custos fixos inseridos:', COUNT(*) FROM custos_fixos;
