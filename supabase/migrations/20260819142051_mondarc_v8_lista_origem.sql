-- Add origem column to lista_compras (compra terceiro / producao interna)
ALTER TABLE lista_compras ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'compra' CHECK (origem IN ('compra', 'producao'));
