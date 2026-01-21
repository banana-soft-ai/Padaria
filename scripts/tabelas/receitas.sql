-- =====================================================
-- Tabela de receitas dos produtos
-- 3. TABELA DE RECEITAS
-- =====================================================
CREATE TABLE IF NOT EXISTS receitas (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL DEFAULT 'pao' CHECK (categoria IN ('pao', 'doce', 'salgado', 'torta', 'bolo', 'outro')),
    rendimento INTEGER NOT NULL DEFAULT 1,
    tempo_preparo INTEGER, -- em minutos
    instrucoes TEXT,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adiciona a coluna 'unidade_rendimento' se não existir
ALTER TABLE receitas 
ADD COLUMN IF NOT EXISTS unidade_rendimento TEXT 
DEFAULT 'un' 
CHECK (unidade_rendimento IN ('un', 'kg', 'g', 'l', 'ml', 'xícara', 'colher'));

UPDATE receitas 
SET unidade_rendimento = 'un' 
WHERE unidade_rendimento IS NULL;