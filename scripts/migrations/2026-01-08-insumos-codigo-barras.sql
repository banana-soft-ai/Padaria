-- Migration: Add codigo_barras to insumos (idempotent)

ALTER TABLE insumos
ADD COLUMN IF NOT EXISTS codigo_barras TEXT;

-- Index to speed up lookups by barcode
CREATE INDEX IF NOT EXISTS idx_insumos_codigo_barras ON insumos(codigo_barras);
