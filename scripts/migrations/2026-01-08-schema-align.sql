-- =============================================
-- Migração incremental: alinhamento de schema
-- Data: 2026-01-08
-- Objetivo: Tornar o banco consistente com o setup consolidado
-- Executar em PostgreSQL
-- =============================================

-- 1) clientes: remover UNIQUE em nome (se existir)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name='clientes' AND constraint_type='UNIQUE' AND constraint_name='clientes_nome_key'
    ) THEN
        ALTER TABLE clientes DROP CONSTRAINT clientes_nome_key;
    END IF;
END $$;

-- 2) receita_ingredientes: remover coluna nao-normalizada 'nome' (se existir)
ALTER TABLE receita_ingredientes DROP COLUMN IF EXISTS nome;

-- 3) receitas: adicionar coluna unidade_rendimento e tentar criar UNIQUE em nome
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS unidade_rendimento TEXT;
ALTER TABLE receitas ALTER COLUMN unidade_rendimento SET DEFAULT 'un';
DO $$ BEGIN
    -- cria ou substitui o CHECK de unidade_rendimento
    BEGIN
        ALTER TABLE receitas ADD CONSTRAINT receitas_unidade_rendimento_chk 
        CHECK (unidade_rendimento IN ('un','kg','g','l','ml','xícara','colher'));
    EXCEPTION WHEN duplicate_object THEN
        -- já existe, ignora
        NULL;
    END;
END $$;
UPDATE receitas SET unidade_rendimento='un' WHERE unidade_rendimento IS NULL;

-- Receitas: UNIQUE em nome, somente se não houver duplicatas
DO $$ 
DECLARE dup_count integer;
BEGIN
    SELECT COUNT(*) INTO dup_count FROM (
        SELECT nome FROM receitas GROUP BY nome HAVING COUNT(*) > 1
    ) t;
    IF dup_count = 0 THEN
        BEGIN
            ALTER TABLE receitas ADD CONSTRAINT receitas_nome_key UNIQUE (nome);
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    ELSE
        RAISE NOTICE 'Nao aplicado UNIQUE em receitas.nome: existem % nomes duplicados.', dup_count;
    END IF;
END $$;

-- 4) insumos: alinhar colunas e restrições
-- Atualiza categorias 'varejo' para 'outro' antes de ajustar o CHECK
UPDATE insumos SET categoria='outro' WHERE categoria='varejo';

-- Remove colunas extras, se existirem
ALTER TABLE insumos DROP COLUMN IF EXISTS codigo_barras;
ALTER TABLE insumos DROP COLUMN IF EXISTS ativo;
ALTER TABLE insumos DROP COLUMN IF EXISTS tipo_estoque;

-- Substitui CHECK de categoria para permitir apenas ('insumo','embalagem','outro')
DO $$
DECLARE conname text;
BEGIN
    SELECT tc.constraint_name INTO conname
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc ON cc.constraint_name=tc.constraint_name
    WHERE tc.table_name='insumos' AND tc.constraint_type='CHECK' AND cc.check_clause LIKE '%categoria%';

    IF conname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE insumos DROP CONSTRAINT %I', conname);
    END IF;

    BEGIN
        ALTER TABLE insumos ADD CONSTRAINT insumos_categoria_chk CHECK (categoria IN ('insumo','embalagem','outro'));
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

-- Insumos: UNIQUE em nome, somente se não houver duplicatas
DO $$ 
DECLARE dup_count integer;
BEGIN
    SELECT COUNT(*) INTO dup_count FROM (
        SELECT nome FROM insumos GROUP BY nome HAVING COUNT(*) > 1
    ) t;
    IF dup_count = 0 THEN
        BEGIN
            ALTER TABLE insumos ADD CONSTRAINT insumos_nome_key UNIQUE (nome);
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    ELSE
        RAISE NOTICE 'Nao aplicado UNIQUE em insumos.nome: existem % nomes duplicados.', dup_count;
    END IF;
END $$;

-- 5) produtos: remover colunas extras se existirem
ALTER TABLE produtos DROP COLUMN IF EXISTS preco_custo;
ALTER TABLE produtos DROP COLUMN IF EXISTS estoque_atual;

-- 6) venda_itens: adicionar novas colunas mantendo dados antigos
-- Adiciona produto_id (nula) e subtotal, e remove 'tipo' se existir
ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS produto_id INTEGER REFERENCES produtos(id);
ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2);
UPDATE venda_itens SET subtotal = quantidade * preco_unitario WHERE subtotal IS NULL;
ALTER TABLE venda_itens DROP COLUMN IF EXISTS tipo;
-- OBS: nao renomeamos item_id -> produto_id automaticamente por falta de mapeamento garantir
-- Se desejar remover item_id depois da migração, faça após mapear dados para produtos

-- 7) vendas: garantir BIGINT para numero_venda
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='vendas' AND column_name='numero_venda' AND data_type <> 'bigint'
    ) THEN
        ALTER TABLE vendas ALTER COLUMN numero_venda TYPE BIGINT USING numero_venda::bigint;
    END IF;
END $$;

-- Índices úteis (idempotentes)
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data);
CREATE INDEX IF NOT EXISTS idx_vendas_usuario ON vendas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vendas_caixa ON vendas(caixa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON produtos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_insumo ON estoque_movimentacoes(insumo_id);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_data ON estoque_movimentacoes(data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_insumos_categoria ON insumos(categoria);
CREATE INDEX IF NOT EXISTS idx_caderneta_cliente ON caderneta(cliente_id);
CREATE INDEX IF NOT EXISTS idx_caderneta_data ON caderneta(data_operacao);
CREATE INDEX IF NOT EXISTS idx_caixas_data ON caixas(data_abertura);
CREATE INDEX IF NOT EXISTS idx_caixas_status ON caixas(status);
CREATE INDEX IF NOT EXISTS idx_clientes_caderneta_ativo ON clientes_caderneta(ativo);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caderneta_cliente ON movimentacoes_caderneta(cliente_id);
