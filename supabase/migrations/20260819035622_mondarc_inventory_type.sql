/*
# Mondarc V4 — Configurable Inventory Type per Panel

1. Purpose
- Add inventory_type (UNIT or PACKAGE) to categorias and saidas.
- Add estoque_inicial and unidade_medida to materiais for UNIT-type stock.
- Recreate vw_estoque (drop first, then create) to handle both types.
*/

-- Add inventory_type to categorias
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS inventory_type text NOT NULL DEFAULT 'PACKAGE' CHECK (inventory_type IN ('UNIT', 'PACKAGE'));

-- Add estoque_inicial and unidade_medida to materiais
ALTER TABLE materiais ADD COLUMN IF NOT EXISTS estoque_inicial integer NOT NULL DEFAULT 0;
ALTER TABLE materiais ADD COLUMN IF NOT EXISTS unidade_medida text NOT NULL DEFAULT 'peças';

-- Add inventory_type, quantidade, total_unidades to saidas
ALTER TABLE saidas ADD COLUMN IF NOT EXISTS inventory_type text NOT NULL DEFAULT 'PACKAGE' CHECK (inventory_type IN ('UNIT', 'PACKAGE'));
ALTER TABLE saidas ADD COLUMN IF NOT EXISTS quantidade integer NOT NULL DEFAULT 0;
ALTER TABLE saidas ADD COLUMN IF NOT EXISTS total_unidades integer NOT NULL DEFAULT 0;

-- Backfill total_unidades for existing saidas
UPDATE saidas SET total_unidades = tipo_pacote * qtd_pacotes WHERE total_unidades = 0;

-- Set panel types
UPDATE categorias SET inventory_type = 'PACKAGE' WHERE nome = 'Geral';
UPDATE categorias SET inventory_type = 'UNIT' WHERE nome = 'Hidráulica';

-- Recreate vw_estoque
DROP VIEW IF EXISTS vw_estoque;

CREATE VIEW vw_estoque AS
SELECT
  m.id AS material_id,
  m.nome AS material_nome,
  m.bitola,
  m.categoria_id,
  c.nome AS categoria_nome,
  c.cor,
  c.inventory_type,
  m.ini10,
  m.ini50,
  m.estoque_inicial,
  m.unidade_medida,
  m.comprar,
  m.ativo,
  m.created_at,
  m.updated_at,
  COALESCE(s10.total, 0) AS saidas10,
  COALESCE(s50.total, 0) AS saidas50,
  COALESCE(su.total, 0) AS saidas_unit,
  m.ini10 - COALESCE(s10.total, 0) AS saldo10,
  m.ini50 - COALESCE(s50.total, 0) AS saldo50,
  m.estoque_inicial - COALESCE(su.total, 0) AS saldo_unit,
  CASE
    WHEN c.inventory_type = 'UNIT' THEN m.estoque_inicial - COALESCE(su.total, 0)
    ELSE (m.ini10 - COALESCE(s10.total, 0)) * 10 + (m.ini50 - COALESCE(s50.total, 0)) * 50
  END AS total_unidades
FROM materiais m
JOIN categorias c ON c.id = m.categoria_id
LEFT JOIN (SELECT material_id, SUM(qtd_pacotes) AS total FROM saidas WHERE tipo_pacote = 10 AND inventory_type = 'PACKAGE' GROUP BY material_id) s10 ON s10.material_id = m.id
LEFT JOIN (SELECT material_id, SUM(qtd_pacotes) AS total FROM saidas WHERE tipo_pacote = 50 AND inventory_type = 'PACKAGE' GROUP BY material_id) s50 ON s50.material_id = m.id
LEFT JOIN (SELECT material_id, SUM(quantidade) AS total FROM saidas WHERE inventory_type = 'UNIT' GROUP BY material_id) su ON su.material_id = m.id;
