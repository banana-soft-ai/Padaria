# 📋 Instruções para Criar Tabelas Faltantes

## 🚨 Problema Identificado
O sistema está tentando acessar tabelas que não existem no banco de dados Supabase, causando erros 404.

## ✅ Solução
Execute os comandos SQL abaixo no painel do Supabase:

### 1. Acesse o Supabase Dashboard
- Vá para: https://supabase.com/dashboard
- Selecione seu projeto
- Clique em "SQL Editor" no menu lateral

### 2. Execute os Comandos SQL

```sql
-- 1. TABELA DE CLIENTES CADERNETA
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

-- 2. TABELA DE MOVIMENTAÇÕES DA CADERNETA
CREATE TABLE IF NOT EXISTS movimentacoes_caderneta (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes_caderneta(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('compra', 'pagamento', 'ajuste')),
    valor DECIMAL(10,2) NOT NULL,
    descricao TEXT,
    venda_id INTEGER,
    usuario_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- 4. TABELA DE FLUXO DE CAIXA
CREATE TABLE IF NOT EXISTS fluxo_caixa (
    id SERIAL PRIMARY KEY,
    data DATE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    categoria TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    caixa_diario_id INTEGER REFERENCES caixa_diario(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABELA DE PREÇOS DE VENDA
CREATE TABLE IF NOT EXISTS precos_venda (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'varejo')),
    preco_venda DECIMAL(10,2) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. ATUALIZAR TABELA DE VENDAS
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_caderneta_id INTEGER REFERENCES clientes_caderneta(id);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS forma_pagamento TEXT CHECK (forma_pagamento IN ('dinheiro', 'cartao_debito', 'cartao_credito', 'pix', 'caderneta'));
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS valor_pago DECIMAL(10,2) DEFAULT 0;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS valor_debito DECIMAL(10,2) DEFAULT 0;

-- 7. ATUALIZAR TABELA DE INSUMOS
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS preco_venda DECIMAL(10,2) DEFAULT 0;
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'insumo' CHECK (categoria IN ('insumo', 'embalagem', 'varejo', 'outro'));

-- 8. ATUALIZAR TABELA DE RECEITAS
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS preco_venda DECIMAL(10,2) DEFAULT 0;
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS unidade_rendimento TEXT DEFAULT 'un' CHECK (unidade_rendimento IN ('un', 'kg', 'g', 'l', 'ml', 'xícara', 'colher'));

-- 9. CRIAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_clientes_caderneta_ativo ON clientes_caderneta(ativo);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caderneta_cliente ON movimentacoes_caderneta(cliente_id);
CREATE INDEX IF NOT EXISTS idx_caixa_diario_data ON caixa_diario(data);
CREATE INDEX IF NOT EXISTS idx_caixa_diario_status ON caixa_diario(status);
CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_data ON fluxo_caixa(data);
CREATE INDEX IF NOT EXISTS idx_venda_itens_venda ON venda_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_precos_venda_ativo ON precos_venda(ativo);
```

### 3. Verificar se as Tabelas Foram Criadas

Após executar os comandos, teste se as tabelas foram criadas:

```sql
-- Verificar se as tabelas existem
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'clientes_caderneta',
    'movimentacoes_caderneta', 
    'caixa_diario',
    'fluxo_caixa',
    'precos_venda'
);
```

## 🎯 Resultado Esperado
Após executar esses comandos, o sistema deve parar de mostrar erros 404 e funcionar normalmente online e offline.

## 📞 Suporte
Se tiver problemas, verifique:
1. Se você tem permissões de administrador no Supabase
2. Se o projeto está ativo
3. Se não há erros de sintaxe SQL
