-- Percentual de custos invisíveis (gás, energia, água, etc.) aplicado ao custo de ingredientes.
-- Valor em decimal 0..1 (ex.: 0.10 = 10%). Front envia camelCase custosInvisiveis; PostgREST mapeia para snake_case.
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS custos_invisiveis NUMERIC(5,4) DEFAULT 0;
