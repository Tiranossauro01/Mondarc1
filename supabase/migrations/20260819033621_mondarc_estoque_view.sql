/*
# Mondarc — Estoque view

1. Purpose
- Provides a consistent computed view of current stock per material.
- entradas = sum of 'entrada' + 'compra' quantities
- saidas = sum of 'saida' quantities
- saldo = entradas - saidas

2. Views
- `vw_estoque` — joins materiais + categorias, aggregates movimentos.
*/

CREATE OR REPLACE VIEW vw_estoque AS
SELECT
  m.id AS material_id,
  m.nome AS material_nome,
  m.categoria_id,
  c.nome AS categoria_nome,
  c.cor,
  m.unidade,
  m.estoque_minimo,
  COALESCE(
    (SELECT SUM(mov.quantidade) FROM movimentos mov WHERE mov.material_id = m.id AND mov.tipo IN ('entrada','compra')),
    0
  ) AS entradas,
  COALESCE(
    (SELECT SUM(mov.quantidade) FROM movimentos mov WHERE mov.material_id = m.id AND mov.tipo = 'saida'),
    0
  ) AS saidas,
  COALESCE(
    (SELECT SUM(mov.quantidade) FROM movimentos mov WHERE mov.material_id = m.id AND mov.tipo IN ('entrada','compra')),
    0
  ) - COALESCE(
    (SELECT SUM(mov.quantidade) FROM movimentos mov WHERE mov.material_id = m.id AND mov.tipo = 'saida'),
    0
  ) AS saldo
FROM materiais m
JOIN categorias c ON c.id = m.categoria_id;
