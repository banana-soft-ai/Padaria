-- =====================================================
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS - REY DOS PÃES
-- Responsável pela definição da estrutura das tabelas,
-- extensões, tipos e índices.
-- =====================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. TABELAS PRINCIPAIS
-- =====================================================

-- Tabela de usuários para autenticação e controle de acesso
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'funcionario' CHECK (role IN ('admin', 'gerente', 'funcionario', 'caixa')),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Tabela de insumos, embalagens e outros materiais
-- 2. TABELA DE INSUMOS
-- =====================================================
CREATE TABLE IF NOT EXISTS insumos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE, -- adicionado para n duplicar
    categoria TEXT NOT NULL DEFAULT 'insumo' CHECK (categoria IN ('insumo', 'embalagem', 'outro')),
    marca TEXT,
    fornecedor TEXT,
    unidade TEXT NOT NULL DEFAULT 'kg',
    peso_pacote DECIMAL(10,3),
    preco_pacote DECIMAL(10,2),
    estoque_atual DECIMAL(10,3) DEFAULT 0,
    estoque_minimo DECIMAL(10,3) DEFAULT 0,
    codigo_barras TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()


);

-- Colunas adicionais (migrations)
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS unidade_medida_base TEXT;
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS quantidade_pacote NUMERIC;
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC;
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS quantidade_minima NUMERIC;
CREATE INDEX IF NOT EXISTS idx_insumos_quantidade_minima ON insumos(quantidade_minima);

-- =====================================================
-- Tabela de receitas dos produtos
-- 3. TABELA DE RECEITAS
-- =====================================================
CREATE TABLE IF NOT EXISTS receitas (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE, --adicionado para n duplicar
    categoria TEXT NOT NULL DEFAULT 'pao' CHECK (categoria IN ('pao', 'doce', 'salgado', 'torta', 'bolo', 'outro')),
    rendimento INTEGER NOT NULL DEFAULT 1,
    tempo_preparo INTEGER, -- em minutos
    instrucoes TEXT,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Adiciona a coluna 'unidade_rendimento' se ela não existir
-- ADICIONAR COLUNA unidade_rendimento À TABELA RECEITAS
-- =====================================================
ALTER TABLE receitas 
ADD COLUMN IF NOT EXISTS unidade_rendimento TEXT 
DEFAULT 'un' 
CHECK (unidade_rendimento IN ('un', 'kg', 'g', 'l', 'ml', 'xícara', 'colher'));

UPDATE receitas 
SET unidade_rendimento = 'un' 
WHERE unidade_rendimento IS NULL;

COMMENT ON COLUMN receitas.unidade_rendimento IS 'Unidade de medida do rendimento da receita (un, kg, g, l, ml, xícara, colher)';

-- Coluna preco_venda em receitas (preço sugerido da receita, usado pela gestão de preços)
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS preco_venda DECIMAL(10,2);

-- =====================================================
-- 4. TABELA DE INGREDIENTES DAS RECEITAS
-- =====================================================
CREATE TABLE IF NOT EXISTS receita_ingredientes (
    id SERIAL PRIMARY KEY,
    receita_id INTEGER REFERENCES receitas(id) ON DELETE CASCADE,
    insumo_id INTEGER REFERENCES insumos(id) ON DELETE CASCADE,
    quantidade DECIMAL(10,3) NOT NULL,
    unidade TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(receita_id, insumo_id)
);



-- =====================================================
-- Tabela de produtos finais para venda
-- 5. TABELA DE PRODUTOS FINAIS
-- =====================================================
CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,     --adicionado para n duplicar
    categoria TEXT NOT NULL DEFAULT 'pao' CHECK (categoria IN ('pao', 'doce', 'salgado', 'torta', 'bolo', 'outro')),
    receita_id INTEGER REFERENCES receitas(id),
    preco_venda DECIMAL(10,2) NOT NULL,
    peso_unitario DECIMAL(10,3), -- peso em kg
    unidade TEXT DEFAULT 'un',
    estoque_atual DECIMAL(10,3) DEFAULT 0,
    estoque_minimo DECIMAL(10,3) DEFAULT 0,
    codigo_barras TEXT UNIQUE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Tabela de itens de varejo (separada de produtos e insumos)
-- =====================================================
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

-- Colunas adicionais (migrations)
ALTER TABLE varejo ADD COLUMN IF NOT EXISTS preco_pacote NUMERIC(12,2);
ALTER TABLE varejo ADD COLUMN IF NOT EXISTS peso_pacote NUMERIC(12,3);
ALTER TABLE varejo ADD COLUMN IF NOT EXISTS marca TEXT;
ALTER TABLE varejo ADD COLUMN IF NOT EXISTS fornecedor TEXT;
ALTER TABLE varejo ADD COLUMN IF NOT EXISTS unidade_medida_base TEXT;
ALTER TABLE varejo ADD COLUMN IF NOT EXISTS quantidade_pacote NUMERIC;
ALTER TABLE varejo ADD COLUMN IF NOT EXISTS quantidade_minima NUMERIC;
ALTER TABLE varejo ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC;
ALTER TABLE varejo ADD COLUMN IF NOT EXISTS codigo_balanca TEXT;
CREATE INDEX IF NOT EXISTS idx_varejo_codigo_balanca ON varejo(codigo_balanca) WHERE codigo_balanca IS NOT NULL;

-- =====================================================
-- Tabela de clientes
-- 6. TABELA DE CLIENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    endereco TEXT,
    cpf_cnpj TEXT,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Tabela de controle de caixas (abertura e fechamento)
-- 7. TABELA DE CAIXAS
-- =====================================================
CREATE TABLE IF NOT EXISTS caixas (
    id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id),
    data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_abertura TIME NOT NULL DEFAULT CURRENT_TIME,
    valor_abertura DECIMAL(10,2) NOT NULL DEFAULT 0,
    data_fechamento DATE,
    hora_fechamento TIME,
    valor_fechamento DECIMAL(10,2),
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Tabela de registro de vendas
-- 8. TABELA DE VENDAS
-- =====================================================
CREATE TABLE IF NOT EXISTS vendas (
    id SERIAL PRIMARY KEY,
    numero_venda BIGINT NOT NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIME NOT NULL DEFAULT CURRENT_TIME,
    cliente_id INTEGER REFERENCES clientes(id),
    usuario_id UUID REFERENCES usuarios(id),
    caixa_id INTEGER REFERENCES caixas(id),
    valor_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    desconto DECIMAL(10,2) DEFAULT 0,
    forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('dinheiro', 'cartao_debito', 'cartao_credito', 'pix', 'caderneta')),
    status TEXT NOT NULL DEFAULT 'finalizada' CHECK (status IN ('pendente', 'finalizada', 'cancelada')),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Colunas adicionais (migrations) - caixa_diario_id adicionado após criar caixa_diario
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS usuario TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS operador_nome TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS operador_id INTEGER;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS valor_pago DECIMAL(10,2);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS valor_debito DECIMAL(10,2);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS valor_troco DECIMAL(10,2);

-- =====================================================
-- Tabela de itens de uma venda
-- 9. TABELA DE ITENS DAS VENDAS
-- =====================================================
CREATE TABLE IF NOT EXISTS venda_itens (
    id SERIAL PRIMARY KEY,
    venda_id INTEGER REFERENCES vendas(id) ON DELETE CASCADE,
    produto_id INTEGER REFERENCES produtos(id),
    quantidade DECIMAL(10,3) NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Tabela de controle da caderneta (fiado) dos clientes
-- 10. TABELA DE CADERNETA (CRÉDITO DOS CLIENTES)
-- =====================================================
CREATE TABLE IF NOT EXISTS caderneta (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    venda_id INTEGER REFERENCES vendas(id),
    tipo_operacao TEXT NOT NULL CHECK (tipo_operacao IN ('compra', 'pagamento')),
    valor DECIMAL(10,2) NOT NULL,
    saldo_anterior DECIMAL(10,2) NOT NULL DEFAULT 0,
    saldo_atual DECIMAL(10,2) NOT NULL,
    observacoes TEXT,
    data_operacao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_operacao TIME NOT NULL DEFAULT CURRENT_TIME,
    usuario_id UUID REFERENCES usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Tabela de movimentações de estoque (entradas, saídas, ajustes)
-- 11. TABELA DE MOVIMENTAÇÕES DE ESTOQUE
-- =====================================================
CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
    id SERIAL PRIMARY KEY,
    insumo_id INTEGER REFERENCES insumos(id) ON DELETE CASCADE,
    tipo_movimentacao TEXT NOT NULL CHECK (tipo_movimentacao IN ('entrada', 'saida', 'ajuste')),
    quantidade DECIMAL(10,3) NOT NULL,
    quantidade_anterior DECIMAL(10,3) NOT NULL,
    quantidade_atual DECIMAL(10,3) NOT NULL,
    motivo TEXT,
    referencia_id INTEGER, -- ID da venda, receita, etc.
    referencia_tipo TEXT, -- 'venda', 'receita', 'ajuste'
    usuario_id UUID REFERENCES usuarios(id),
    data_movimentacao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_movimentacao TIME NOT NULL DEFAULT CURRENT_TIME,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Tabela para registro de custos fixos
-- 12. TABELA DE CUSTOS FIXOS
-- =====================================================
CREATE TABLE IF NOT EXISTS custos_fixos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL CHECK (categoria IN ('aluguel', 'energia', 'agua', 'telefone', 'salarios', 'impostos', 'outros')),
    valor_mensal DECIMAL(10,2) NOT NULL,
    data_vencimento INTEGER NOT NULL CHECK (data_vencimento >= 1 AND data_vencimento <= 31),
    ativo BOOLEAN DEFAULT true,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garantir UNIQUE em nome para ON CONFLICT (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'custos_fixos_nome_key'
    ) THEN
        ALTER TABLE custos_fixos ADD CONSTRAINT custos_fixos_nome_key UNIQUE (nome);
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- =====================================================
-- Tabela para lançamentos fiscais (notas, etc.)
-- 13. TABELA DE LANÇAMENTOS FISCAIS
-- =====================================================
-- Tabela de lançamentos fiscais removida (módulo fiscal/contábil eliminado)
-- Se necessário, recriar manualmente a tabela em ambiente controlado.

-- =====================================================
-- Tabela para logs de auditoria do sistema
-- 14. TABELA DE LOGS DO SISTEMA
-- =====================================================
CREATE TABLE IF NOT EXISTS logs_sistema (
    id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id),
    acao TEXT NOT NULL,
    tabela_afetada TEXT,
    registro_id INTEGER,
    dados_anteriores JSONB,
    dados_novos JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela funcionario (2026-01-25-create-funcionario)
CREATE TABLE IF NOT EXISTS funcionario (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    idade INTEGER NOT NULL CHECK (idade >= 16 AND idade <= 120),
    endereco VARCHAR(255) NOT NULL,
    telefone VARCHAR(32) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_funcionario_nome ON funcionario(nome);

-- Tabela de clientes com caderneta (similar a 'clientes', pode ser unificada no futuro)
CREATE TABLE IF NOT EXISTS clientes_caderneta (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    endereco TEXT,
    cpf_cnpj TEXT,
    saldo_devedor DECIMAL(10,2) DEFAULT 0,
    limite_credito DECIMAL(10,2) DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garantir que saldo credor seja permitido (allow-saldo-credor-caderneta)
ALTER TABLE clientes_caderneta DROP CONSTRAINT IF EXISTS chk_saldo_devedor_nonnegative;

-- Coluna tipo em clientes_caderneta (cliente vs colaborador/funcionário)
ALTER TABLE clientes_caderneta ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'cliente';
UPDATE clientes_caderneta SET tipo = 'cliente' WHERE tipo IS NULL;

-- Coluna cliente_caderneta_id em vendas (referência ao cliente da caderneta quando forma_pagamento = caderneta)
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_caderneta_id INTEGER REFERENCES clientes_caderneta(id);

-- 2. TABELA DE MOVIMENTAÇÕES DA CADERNETA
CREATE TABLE IF NOT EXISTS movimentacoes_caderneta (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes_caderneta(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('compra', 'pagamento', 'ajuste')),
    valor DECIMAL(10,2) NOT NULL,
    saldo_anterior DECIMAL(10,2),
    saldo_atual DECIMAL(10,2),
    descricao TEXT,
    venda_id INTEGER,
    usuario_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 3. TABELA DE CAIXA DIÁRIO
CREATE TABLE IF NOT EXISTS caixa_diario (
    id SERIAL PRIMARY KEY,
    data DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
    valor_abertura DECIMAL(10,2) NOT NULL DEFAULT 0,
    valor_fechamento DECIMAL(10,2),
    valor_saidas DECIMAL(10,2) DEFAULT 0,
    valor_dinheiro_informado DECIMAL(10,2),
    valor_pix_informado DECIMAL(10,2),
    valor_debito_informado DECIMAL(10,2),
    valor_credito_informado DECIMAL(10,2),
    observacoes_abertura TEXT,
    observacoes_fechamento TEXT,
    usuario_abertura TEXT,
    usuario_fechamento TEXT,
    data_abertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_fechamento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Colunas adicionais para caixa_diario (total_* usadas pelo trigger e frontend)
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS total_vendas DECIMAL(10,2) DEFAULT 0;
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS total_entradas DECIMAL(10,2) DEFAULT 0;
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS total_dinheiro DECIMAL(10,2) DEFAULT 0;
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS total_pix DECIMAL(10,2) DEFAULT 0;
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS total_debito DECIMAL(10,2) DEFAULT 0;
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS total_credito DECIMAL(10,2) DEFAULT 0;
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS total_caderneta DECIMAL(10,2) DEFAULT 0;
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS total_saidas DECIMAL(10,2) DEFAULT 0;
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS diferenca DECIMAL(10,2) DEFAULT 0;
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS diferenca_dinheiro DECIMAL(10,2);
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS diferenca_pix DECIMAL(10,2);
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS diferenca_debito DECIMAL(10,2);
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS diferenca_credito DECIMAL(10,2);
ALTER TABLE caixa_diario ADD COLUMN IF NOT EXISTS tipo_abertura VARCHAR(20);

-- Tabela caixa_movimentacoes (0001_create_caixa_movimentacoes_and_cols)
CREATE TABLE IF NOT EXISTS caixa_movimentacoes (
    id SERIAL PRIMARY KEY,
    caixa_diario_id INTEGER REFERENCES caixa_diario(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor DECIMAL(10,2) NOT NULL,
    motivo TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coluna caixa_diario_id em vendas (após caixa_diario existir)
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS caixa_diario_id INTEGER REFERENCES caixa_diario(id);

-- Tabela turno_operador (2026-01-25 + 2026-01-28)
CREATE TABLE IF NOT EXISTS turno_operador (
    id SERIAL PRIMARY KEY,
    caixa_diario_id INTEGER REFERENCES caixa_diario(id) ON DELETE CASCADE,
    operador_id INTEGER REFERENCES clientes_caderneta(id),
    operador_nome TEXT NOT NULL,
    data_inicio TIMESTAMP NOT NULL DEFAULT NOW(),
    data_fim TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'aberto',
    observacoes TEXT,
    valor_abertura NUMERIC DEFAULT 0,
    valor_fechamento NUMERIC DEFAULT 0,
    total_vendas NUMERIC DEFAULT 0,
    total_dinheiro NUMERIC DEFAULT 0,
    total_pix NUMERIC DEFAULT 0,
    total_debito NUMERIC DEFAULT 0,
    total_credito NUMERIC DEFAULT 0,
    total_caderneta NUMERIC DEFAULT 0,
    valor_saidas NUMERIC DEFAULT 0,
    diferenca NUMERIC DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_turno_operador_caixa ON turno_operador(caixa_diario_id);
CREATE INDEX IF NOT EXISTS idx_turno_operador_operador ON turno_operador(operador_id);
CREATE INDEX IF NOT EXISTS idx_turno_operador_status ON turno_operador(status);

ALTER TABLE movimentacoes_caderneta ADD COLUMN IF NOT EXISTS saldo_devedor DECIMAL(10,2);
ALTER TABLE movimentacoes_caderneta ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- 4. TABELA DE FLUXO DE CAIXA
CREATE TABLE IF NOT EXISTS fluxo_caixa (
    id SERIAL PRIMARY KEY,
    data DATE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    categoria TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    caixa_diario_id INTEGER REFERENCES caixa_diario(id),
    observacoes TEXT,
    usuario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABELA DE PREÇOS DE VENDA
CREATE TABLE IF NOT EXISTS precos_venda (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'varejo')),
    preco_venda DECIMAL(10,2) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Colunas adicionais precos_venda (2026-01-26, 2026-01-27)
ALTER TABLE precos_venda ADD COLUMN IF NOT EXISTS preco_custo_unitario DECIMAL(12,4) DEFAULT 0;
ALTER TABLE precos_venda ADD COLUMN IF NOT EXISTS margem_lucro DECIMAL(10,2) DEFAULT 0;
ALTER TABLE precos_venda ADD COLUMN IF NOT EXISTS item_nome TEXT;
ALTER TABLE precos_venda ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE precos_venda ADD COLUMN IF NOT EXISTS unidade TEXT;
ALTER TABLE precos_venda ADD COLUMN IF NOT EXISTS estoque DECIMAL(12,3) DEFAULT 0;

-- =====================================================
-- . TABELA DE COMPOSIÇÃO DAS RECEITAS
-- =====================================================
CREATE TABLE IF NOT EXISTS composicao_receitas (
    id SERIAL PRIMARY KEY,
    receita_id INTEGER REFERENCES receitas(id) ON DELETE CASCADE,
    insumo_id INTEGER REFERENCES insumos(id) ON DELETE CASCADE,
    quantidade DECIMAL(10,3) NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'massa' CHECK (categoria IN ('massa', 'cobertura', 'embalagem')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(receita_id, insumo_id, categoria)
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para vendas
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data);
CREATE INDEX IF NOT EXISTS idx_vendas_usuario ON vendas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vendas_caixa ON vendas(caixa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_caixa_diario_id ON vendas(caixa_diario_id);
CREATE INDEX IF NOT EXISTS idx_vendas_operador_nome ON vendas(operador_nome);

-- Índices para produtos
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON produtos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);

-- Índices para varejo
CREATE INDEX IF NOT EXISTS idx_varejo_codigo_barras ON varejo(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_varejo_ativo ON varejo(ativo);

-- Índices para estoque
CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_insumo ON estoque_movimentacoes(insumo_id);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_data ON estoque_movimentacoes(data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_insumos_categoria ON insumos(categoria);
CREATE INDEX IF NOT EXISTS idx_insumos_codigo_barras ON insumos(codigo_barras);

-- Índices para caderneta
CREATE INDEX IF NOT EXISTS idx_caderneta_cliente ON caderneta(cliente_id);
CREATE INDEX IF NOT EXISTS idx_caderneta_data ON caderneta(data_operacao);

-- Índices para caixas
CREATE INDEX IF NOT EXISTS idx_caixas_data ON caixas(data_abertura);
CREATE INDEX IF NOT EXISTS idx_caixas_status ON caixas(status);

-- Índices para caderneta adicional
CREATE INDEX IF NOT EXISTS idx_clientes_caderneta_ativo ON clientes_caderneta(ativo);

-- Índices para movimentações da caderneta
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caderneta_cliente ON movimentacoes_caderneta(cliente_id);

-- Índices para caixas diário
CREATE INDEX IF NOT EXISTS idx_caixa_diario_data ON caixa_diario(data);
CREATE INDEX IF NOT EXISTS idx_caixa_diario_status ON caixa_diario(status);

-- Índices para fluxo de caixa
CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_data ON fluxo_caixa(data);

-- Índices para venda_itens
CREATE INDEX IF NOT EXISTS idx_venda_itens_venda ON venda_itens(venda_id);

-- Índices para preços de venda
CREATE INDEX IF NOT EXISTS idx_precos_venda_ativo ON precos_venda(ativo);
-- Índices para composição de receitas
CREATE INDEX IF NOT EXISTS idx_composicao_receitas_receita ON composicao_receitas(receita_id);
CREATE INDEX IF NOT EXISTS idx_composicao_receitas_insumo ON composicao_receitas(insumo_id);

-- 11. COMENTÁRIOS NAS TABELAS
COMMENT ON TABLE composicao_receitas IS 'Tabela de composição das receitas com seus ingredientes';
COMMENT ON TABLE clientes_caderneta IS 'Clientes com caderneta de crédito';
COMMENT ON TABLE movimentacoes_caderneta IS 'Movimentações de crédito/de débito na caderneta';
COMMENT ON TABLE caixa_diario IS 'Controle diário de abertura e fechamento de caixa';
COMMENT ON TABLE fluxo_caixa IS 'Fluxo de entradas e saídas do caixa';
COMMENT ON TABLE venda_itens IS 'Itens vendidos em cada venda';
COMMENT ON TABLE precos_venda IS 'Preços de venda dos produtos e receitas';

-- Comentários das colunas
COMMENT ON TABLE composicao_receitas IS 'Tabela de composição das receitas com seus ingredientes';
COMMENT ON COLUMN composicao_receitas.receita_id IS 'ID da receita';
COMMENT ON COLUMN composicao_receitas.insumo_id IS 'ID do insumo/ingrediente';
COMMENT ON COLUMN composicao_receitas.quantidade IS 'Quantidade do ingrediente na receita';
COMMENT ON COLUMN composicao_receitas.categoria IS 'Categoria do ingrediente (massa, cobertura, embalagem)';

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
-- TRIGGERS PARA UPDATED_AT NAS TABELAS (idempotente)
-- =====================================================
DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_insumos_updated_at ON insumos;
CREATE TRIGGER update_insumos_updated_at
BEFORE UPDATE ON insumos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_receitas_updated_at ON receitas;
CREATE TRIGGER update_receitas_updated_at
BEFORE UPDATE ON receitas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_produtos_updated_at ON produtos;
CREATE TRIGGER update_produtos_updated_at
BEFORE UPDATE ON produtos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_varejo_updated_at ON varejo;
CREATE TRIGGER update_varejo_updated_at
BEFORE UPDATE ON varejo
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON clientes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_caixas_updated_at ON caixas;
CREATE TRIGGER update_caixas_updated_at
BEFORE UPDATE ON caixas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendas_updated_at ON vendas;
CREATE TRIGGER update_vendas_updated_at
BEFORE UPDATE ON vendas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custos_fixos_updated_at ON custos_fixos;
CREATE TRIGGER update_custos_fixos_updated_at
BEFORE UPDATE ON custos_fixos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger update_lancamentos_fiscais removed (módulo fiscal eliminado)

DROP TRIGGER IF EXISTS update_composicao_receitas_updated_at ON composicao_receitas;
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
DROP TRIGGER IF EXISTS trigger_atualizar_estoque_venda ON venda_itens;
CREATE TRIGGER trigger_atualizar_estoque_venda
AFTER INSERT ON venda_itens
FOR EACH ROW EXECUTE FUNCTION atualizar_estoque_venda();

-- =====================================================
-- TRIGGER ON_VENDA_INSERT - Atualiza caixa_diario e fluxo após venda
-- =====================================================
DROP TRIGGER IF EXISTS trg_on_venda_insert ON vendas;
CREATE OR REPLACE FUNCTION public.on_venda_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_caixa_id INTEGER;
  v_valor NUMERIC := COALESCE(NEW.valor_total, 0);
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='caixa_diario') THEN
    SELECT id INTO v_caixa_id FROM caixa_diario WHERE data = NEW.data AND status = 'aberto' ORDER BY created_at DESC LIMIT 1;
    IF v_caixa_id IS NULL THEN
      SELECT id INTO v_caixa_id FROM caixa_diario WHERE status = 'aberto' ORDER BY created_at DESC LIMIT 1;
    END IF;
  ELSE
    v_caixa_id := NULL;
  END IF;

  IF v_caixa_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE caixa_diario SET
    total_vendas = COALESCE(total_vendas,0) + v_valor,
    total_entradas = COALESCE(total_entradas,0) + v_valor,
    total_dinheiro = COALESCE(total_dinheiro,0) + CASE WHEN NEW.forma_pagamento = 'dinheiro' THEN v_valor ELSE 0 END,
    total_pix = COALESCE(total_pix,0) + CASE WHEN NEW.forma_pagamento = 'pix' THEN v_valor ELSE 0 END,
    total_debito = COALESCE(total_debito,0) + CASE WHEN NEW.forma_pagamento = 'cartao_debito' THEN v_valor ELSE 0 END,
    total_credito = COALESCE(total_credito,0) + CASE WHEN NEW.forma_pagamento = 'cartao_credito' THEN v_valor ELSE 0 END,
    total_caderneta = COALESCE(total_caderneta,0) + CASE WHEN NEW.forma_pagamento = 'caderneta' THEN v_valor ELSE 0 END
  WHERE id = v_caixa_id;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='caixa_movimentacoes') THEN
    INSERT INTO caixa_movimentacoes (caixa_diario_id, tipo, valor, motivo, observacoes, created_at)
    VALUES (v_caixa_id, 'entrada', v_valor, CONCAT('Venda PDV (', NEW.id::text, ')'), NULL, now());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='fluxo_caixa') THEN
    INSERT INTO fluxo_caixa (data, tipo, categoria, descricao, valor, caixa_diario_id, created_at)
    VALUES (NEW.data, 'entrada', 'caixa', CONCAT('Venda PDV (', NEW.id::text, ')'), v_valor, v_caixa_id, now());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendas' AND column_name='caixa_diario_id') THEN
    UPDATE vendas SET caixa_diario_id = v_caixa_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_on_venda_insert
AFTER INSERT ON vendas
FOR EACH ROW EXECUTE FUNCTION public.on_venda_insert();

-- =====================================================
-- OUTRAS TRIGGERS PERSONALIZADAS (adicione aqui se houver)
-- =====================================================

-- =====================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY) - UNIFICADO
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE receita_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE varejo ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE caderneta ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos_fixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_caderneta ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_caderneta ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE fluxo_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE precos_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE composicao_receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcionario ENABLE ROW LEVEL SECURITY;
ALTER TABLE turno_operador ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS GERAIS PARA USUÁRIOS AUTENTICADOS
-- =====================================================

-- =====================================================
-- Habilitar RLS e criar políticas para usuários autenticados
-- =====================================================

-- Usuarios
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON usuarios;
CREATE POLICY "Usuários autenticados podem tudo" ON usuarios FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Insumos
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON insumos;
CREATE POLICY "Usuários autenticados podem tudo" ON insumos FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Receitas
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON receitas;
CREATE POLICY "Usuários autenticados podem tudo" ON receitas FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Receita Ingredientes
ALTER TABLE receita_ingredientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON receita_ingredientes;
CREATE POLICY "Usuários autenticados podem tudo" ON receita_ingredientes FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Produtos
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON produtos;
CREATE POLICY "Usuários autenticados podem tudo" ON produtos FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Varejo
ALTER TABLE varejo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON varejo;
CREATE POLICY "Usuários autenticados podem tudo" ON varejo FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Clientes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON clientes;
CREATE POLICY "Usuários autenticados podem tudo" ON clientes FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Caixas
ALTER TABLE caixas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON caixas;
CREATE POLICY "Usuários autenticados podem tudo" ON caixas FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Vendas
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON vendas;
CREATE POLICY "Usuários autenticados podem tudo" ON vendas FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Venda Itens
ALTER TABLE venda_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON venda_itens;
CREATE POLICY "Usuários autenticados podem tudo" ON venda_itens FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Caderneta
ALTER TABLE caderneta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON caderneta;
CREATE POLICY "Usuários autenticados podem tudo" ON caderneta FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Estoque Movimentações
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON estoque_movimentacoes;
CREATE POLICY "Usuários autenticados podem tudo" ON estoque_movimentacoes FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Custos Fixos
ALTER TABLE custos_fixos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON custos_fixos;
CREATE POLICY "Usuários autenticados podem tudo" ON custos_fixos FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Lançamentos Fiscais removidos (módulo fiscal/contábil eliminado)

-- Logs Sistema
ALTER TABLE logs_sistema ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON logs_sistema;
CREATE POLICY "Usuários autenticados podem tudo" ON logs_sistema FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Clientes Caderneta
ALTER TABLE clientes_caderneta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON clientes_caderneta;
CREATE POLICY "Usuários autenticados podem tudo" ON clientes_caderneta FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Movimentações Caderneta
ALTER TABLE movimentacoes_caderneta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON movimentacoes_caderneta;
CREATE POLICY "Usuários autenticados podem tudo" ON movimentacoes_caderneta FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Caixa Diário
ALTER TABLE caixa_diario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON caixa_diario;
CREATE POLICY "Usuários autenticados podem tudo" ON caixa_diario FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Fluxo de Caixa
ALTER TABLE fluxo_caixa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON fluxo_caixa;
CREATE POLICY "Usuários autenticados podem tudo" ON fluxo_caixa FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Preços Venda
ALTER TABLE precos_venda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON precos_venda;
CREATE POLICY "Usuários autenticados podem tudo" ON precos_venda FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Composição Receitas
ALTER TABLE composicao_receitas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON composicao_receitas;
CREATE POLICY "Usuários autenticados podem tudo" ON composicao_receitas FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Caixa Movimentações
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON caixa_movimentacoes;
CREATE POLICY "Usuários autenticados podem tudo" ON caixa_movimentacoes FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Funcionário
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON funcionario;
CREATE POLICY "Usuários autenticados podem tudo" ON funcionario FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Turno Operador
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON turno_operador;
CREATE POLICY "Usuários autenticados podem tudo" ON turno_operador FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Inserir usuário administrador padrão
INSERT INTO usuarios (email, nome, role) VALUES 
('admin@gmail.com', 'Administrador', 'admin')
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
INSERT INTO receita_ingredientes (receita_id, insumo_id, quantidade, unidade) 
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
    END
FROM receitas r
CROSS JOIN insumos i
WHERE r.nome = 'Pão Francês'
AND i.nome IN ('Farinha de Trigo', 'Açúcar', 'Sal', 'Fermento Biológico', 'Manteiga', 'Leite', 'Ovos')
ON CONFLICT (receita_id, insumo_id) DO NOTHING;

-- Inserir ingredientes para Pão de Açúcar
INSERT INTO receita_ingredientes (receita_id, insumo_id, quantidade, unidade) 
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
    END
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

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View para relatório de vendas do dia
CREATE OR REPLACE VIEW vendas_hoje AS
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

-- View para produtos com estoque baixo
CREATE OR REPLACE VIEW produtos_estoque_baixo AS
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

-- View para resumo de caixa do dia
CREATE OR REPLACE VIEW resumo_caixa_hoje AS
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

-- =====================================================
-- MIGRAÇÕES INTEGRADAS: NFC-e e Varejo em venda_itens
-- =====================================================

-- 1) Adicionar coluna varejo_id em venda_itens com FK e índice (idempotente)
ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS varejo_id INTEGER;

DO $$
BEGIN
        BEGIN
                ALTER TABLE venda_itens
                ADD CONSTRAINT venda_itens_varejo_fk
                FOREIGN KEY (varejo_id) REFERENCES varejo(id);
        EXCEPTION WHEN duplicate_object THEN
                NULL;
        END;
END $$;

CREATE INDEX IF NOT EXISTS idx_venda_itens_varejo_id ON venda_itens(varejo_id);

-- 2) Tabela de configuração da NFC-e (emitente e parâmetros)
CREATE TABLE IF NOT EXISTS nfce_config (
    id BIGSERIAL PRIMARY KEY,
    ambiente TEXT NOT NULL CHECK (ambiente IN ('producao','homologacao')),
    serie TEXT NOT NULL,
    numero_inicial INTEGER NOT NULL DEFAULT 1,
    numero_atual INTEGER NOT NULL DEFAULT 1,
    csc TEXT,
    csc_id TEXT,
    certificado_validade DATE,
    certificado_status TEXT CHECK (certificado_status IN ('valido','vencido','invalido')) DEFAULT 'valido',
    emitente_razao_social TEXT NOT NULL,
    emitente_nome_fantasia TEXT NOT NULL,
    emitente_cnpj TEXT NOT NULL,
    emitente_endereco_logradouro TEXT,
    emitente_endereco_numero TEXT,
    emitente_endereco_bairro TEXT,
    emitente_endereco_municipio TEXT,
    emitente_endereco_uf TEXT,
    emitente_endereco_cep TEXT,
    emitente_telefone TEXT,
    emitente_email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Configuração padrão (somente se não existir)
INSERT INTO nfce_config (
    ambiente, serie, numero_inicial, numero_atual,
    csc, csc_id, certificado_validade, certificado_status,
    emitente_razao_social, emitente_nome_fantasia, emitente_cnpj,
    emitente_endereco_logradouro, emitente_endereco_numero, emitente_endereco_bairro,
    emitente_endereco_municipio, emitente_endereco_uf, emitente_endereco_cep,
    emitente_telefone, emitente_email
)
SELECT
    'producao','1',1,1,
    '', '', CURRENT_DATE + INTERVAL '365 days', 'valido',
    'PADARIA DONA QUITUTE LTDA','Rey dos Pães','14.200.166/0001-87',
    'Rua das Flores','123','Centro','Belo Horizonte','MG','30000-000',
    '(31) 3333-4444','contato@reydospaes.com.br'
WHERE NOT EXISTS (SELECT 1 FROM nfce_config);

-- RLS para nfce_config (após tabela criada)
ALTER TABLE nfce_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem tudo" ON nfce_config;
CREATE POLICY "Usuários autenticados podem tudo" ON nfce_config FOR ALL 
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 3) Alterações em vendas para suportar NFC-e (idempotente)
ALTER TABLE vendas
    ADD COLUMN IF NOT EXISTS chave_acesso TEXT,
    ADD COLUMN IF NOT EXISTS numero INTEGER,
    ADD COLUMN IF NOT EXISTS serie TEXT,
    ADD COLUMN IF NOT EXISTS protocolo TEXT,
    ADD COLUMN IF NOT EXISTS status_nfce TEXT CHECK (status_nfce IN ('autorizada','rejeitada','pendente','cancelada')),
    ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
    ADD COLUMN IF NOT EXISTS url_consulta TEXT,
    ADD COLUMN IF NOT EXISTS xml_autorizado TEXT,
    ADD COLUMN IF NOT EXISTS xml_cancelamento TEXT,
    ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT,
    ADD COLUMN IF NOT EXISTS data_autorizacao TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendas_serie_numero_unique ON vendas(serie, numero);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendas_chave_acesso_unique ON vendas(chave_acesso);

COMMIT;
