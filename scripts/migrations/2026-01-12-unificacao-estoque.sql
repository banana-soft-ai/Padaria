-- Criação da tabela unificada de estoque
CREATE TABLE estoque (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    marca VARCHAR(255),
    fornecedor VARCHAR(255),
    codigo_barras VARCHAR(255),
    tipo_estoque VARCHAR(20) NOT NULL, -- 'insumo' ou 'varejo'
    preco_custo DECIMAL(12,2),
    preco_venda DECIMAL(12,2),
    estoque DECIMAL(12,2) DEFAULT 0,
    unidade VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Migração dos dados de insumos
INSERT INTO estoque (
    nome, marca, fornecedor, codigo_barras, tipo_estoque, preco_custo, preco_venda, estoque, unidade, created_at, updated_at
)
SELECT
    nome,
    marca,
    fornecedor,
    codigo_barras,
    'insumo' AS tipo_estoque,
    preco_pacote AS preco_custo,
    NULL AS preco_venda,
    estoque_atual AS estoque,
    unidade,
    created_at,
    updated_at
FROM insumos;


-- Migração dos dados de varejo
INSERT INTO estoque (
    nome, marca, fornecedor, codigo_barras, tipo_estoque, preco_custo, preco_venda, estoque, unidade, created_at, updated_at
)
SELECT
    nome,
    NULL AS marca,
    NULL AS fornecedor,
    codigo_barras,
    'varejo' AS tipo_estoque,
    NULL AS preco_custo,
    preco_venda,
    estoque_atual AS estoque,
    unidade,
    created_at,
    updated_at
FROM varejo;
