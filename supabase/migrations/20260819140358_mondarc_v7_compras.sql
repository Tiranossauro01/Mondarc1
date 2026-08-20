/*
# Mondarc V7 — Compras & Lista de Compras

1. New Tables
- `lista_compras` — shopping list with priority/status
- `compras` — purchase records (fornecedor, nota, valor, etc.)

2. Modified
- `vw_estoque` — recreated to include purchase totals in saldo

3. Security
- RLS enabled, anon+authenticated full access (single-tenant, no auth)
*/

-- LISTA_COMPRAS (create first, compras references it)
CREATE TABLE IF NOT EXISTS lista_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES materiais(id) ON DELETE CASCADE,
  categoria_id uuid REFERENCES categorias(id) ON DELETE CASCADE,
  nome_material text NOT NULL DEFAULT '',
  qtd_comprar integer NOT NULL DEFAULT 0,
  tipo_embalagem text NOT NULL DEFAULT 'pacote',
  tipo_pacote integer NOT NULL DEFAULT 10,
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_compra', 'comprado', 'cancelado')),
  obs text NOT NULL DEFAULT '',
  compra_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lista_compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_lista" ON lista_compras;
CREATE POLICY "anon_sel_lista" ON lista_compras FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_lista" ON lista_compras;
CREATE POLICY "anon_ins_lista" ON lista_compras FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_lista" ON lista_compras;
CREATE POLICY "anon_upd_lista" ON lista_compras FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_lista" ON lista_compras;
CREATE POLICY "anon_del_lista" ON lista_compras FOR DELETE TO anon, authenticated USING (true);

-- COMPRAS
CREATE TABLE IF NOT EXISTS compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  fornecedor text NOT NULL DEFAULT '',
  nota text NOT NULL DEFAULT '',
  tipo_embalagem text NOT NULL DEFAULT 'pacote',
  tipo_pacote integer NOT NULL DEFAULT 10,
  qtd_pacotes integer NOT NULL DEFAULT 0,
  qtd_unidades integer NOT NULL DEFAULT 0,
  valor_unitario numeric(12,2) NOT NULL DEFAULT 0,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  obs text NOT NULL DEFAULT '',
  lista_compra_id uuid REFERENCES lista_compras(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_compras" ON compras;
CREATE POLICY "anon_sel_compras" ON compras FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_compras" ON compras;
CREATE POLICY "anon_ins_compras" ON compras FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_compras" ON compras;
CREATE POLICY "anon_upd_compras" ON compras FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_compras" ON compras;
CREATE POLICY "anon_del_compras" ON compras FOR DELETE TO anon, authenticated USING (true);

-- RECREATE VW_ESTOQUE with purchases
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
  m.favorito,
  m.created_at,
  m.updated_at,
  COALESCE(s10.total, 0) AS saidas10,
  COALESCE(s50.total, 0) AS saidas50,
  COALESCE(su.total, 0) AS saidas_unit,
  COALESCE(adj.total, 0) AS total_ajustes,
  COALESCE(cp10.total, 0) AS compras10,
  COALESCE(cp50.total, 0) AS compras50,
  COALESCE(cu.total, 0) AS compras_unit,
  (m.ini10 + COALESCE(cp10.total, 0)) - COALESCE(s10.total, 0) AS saldo10,
  (m.ini50 + COALESCE(cp50.total, 0)) - COALESCE(s50.total, 0) AS saldo50,
  (m.estoque_inicial + COALESCE(cu.total, 0)) - COALESCE(su.total, 0) + COALESCE(adj.total, 0) AS saldo_unit,
  CASE
    WHEN c.inventory_type = 'UNIT' THEN (m.estoque_inicial + COALESCE(cu.total, 0)) - COALESCE(su.total, 0) + COALESCE(adj.total, 0)
    ELSE ((m.ini10 + COALESCE(cp10.total, 0)) - COALESCE(s10.total, 0)) * 10
       + ((m.ini50 + COALESCE(cp50.total, 0)) - COALESCE(s50.total, 0)) * 50
       + COALESCE(adj.total, 0)
  END AS total_unidades
FROM materiais m
JOIN categorias c ON c.id = m.categoria_id
LEFT JOIN (SELECT material_id, SUM(qtd_pacotes) AS total FROM saidas WHERE tipo_pacote = 10 AND inventory_type = 'PACKAGE' GROUP BY material_id) s10 ON s10.material_id = m.id
LEFT JOIN (SELECT material_id, SUM(qtd_pacotes) AS total FROM saidas WHERE tipo_pacote = 50 AND inventory_type = 'PACKAGE' GROUP BY material_id) s50 ON s50.material_id = m.id
LEFT JOIN (SELECT material_id, SUM(quantidade) AS total FROM saidas WHERE inventory_type = 'UNIT' GROUP BY material_id) su ON su.material_id = m.id
LEFT JOIN (SELECT material_id, SUM(quantidade_ajuste) AS total FROM ajustes GROUP BY material_id) adj ON adj.material_id = m.id
LEFT JOIN (SELECT material_id, SUM(qtd_pacotes) AS total FROM compras WHERE tipo_pacote = 10 AND tipo_embalagem = 'pacote' GROUP BY material_id) cp10 ON cp10.material_id = m.id
LEFT JOIN (SELECT material_id, SUM(qtd_pacotes) AS total FROM compras WHERE tipo_pacote = 50 AND tipo_embalagem = 'pacote' GROUP BY material_id) cp50 ON cp50.material_id = m.id
LEFT JOIN (SELECT material_id, SUM(qtd_unidades) AS total FROM compras WHERE tipo_embalagem = 'unidade' GROUP BY material_id) cu ON cu.material_id = m.id;
