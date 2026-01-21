-- =============================================
-- Migração: criar tabela de varejo e opcionalmente migrar dados
-- Data: 2026-01-08
-- =============================================

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS varejo (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL DEFAULT 'varejo' CHECK (categoria IN ('varejo','outro')),
    unidade TEXT NOT NULL DEFAULT 'un',
    preco_venda DECIMAL(10,2) NOT NULL,
    codigo_barras TEXT UNIQUE,
    estoque_atual DECIMAL(10,3) DEFAULT 0,
    estoque_minimo DECIMAL(10,3) DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_varejo_codigo_barras ON varejo(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_varejo_ativo ON varejo(ativo);

-- Opcional: migrar registros de produtos com codigo_barras para varejo (revise antes de rodar)
INSERT INTO varejo (nome, categoria, unidade, preco_venda, codigo_barras, estoque_atual, estoque_minimo, ativo, created_at, updated_at)
SELECT p.nome,
       'varejo' AS categoria,
       COALESCE(p.unidade, 'un') AS unidade,
       p.preco_venda,
       p.codigo_barras,
       COALESCE(p.estoque_atual, 0) AS estoque_atual,
       COALESCE(p.estoque_minimo, 0) AS estoque_minimo,
       COALESCE(p.ativo, true) AS ativo,
       COALESCE(p.created_at, NOW()),
       COALESCE(p.updated_at, NOW())
FROM produtos p
WHERE p.codigo_barras IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM varejo v WHERE v.codigo_barras = p.codigo_barras
  );

-- Nota: Se desejar remover do produtos após migrar, execute manualmente após validar:
-- DELETE FROM produtos p WHERE p.codigo_barras IS NOT NULL;
