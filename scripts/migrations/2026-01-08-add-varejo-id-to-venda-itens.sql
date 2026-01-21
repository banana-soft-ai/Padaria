-- =============================================
-- Adicionar coluna varejo_id em venda_itens e criar FK
-- Data: 2026-01-08
-- =============================================

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
