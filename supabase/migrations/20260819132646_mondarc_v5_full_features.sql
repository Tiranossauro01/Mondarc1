/*
# Mondarc V5 — Full Feature Set: Favorites, Adjustments, Config, Audit Log, Report Sequence

1. Purpose
This migration adds support for the complete Mondarc feature set:
- Material favorites (star marking)
- Stock adjustments (separate from saídas)
- System configuration (responsável name)
- Audit log / registro de alterações
- Report sequence numbering

2. New Tables
- `favoritos` — material favorites
- `ajustes` — stock adjustments (separate from saídas)
- `config` — singleton config row (responsável name)
- `log_alteracoes` — audit log
- `relatorio_seq` — report sequence counter

3. Modified
- `materiais` — add `favorito` boolean column
- `vw_estoque` — recreated to include adjustment totals in saldo

4. Security
- All new tables: RLS enabled, anon+authenticated full access (single-tenant, no auth)
*/

-- FAVORITES
CREATE TABLE IF NOT EXISTS favoritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(material_id)
);
ALTER TABLE favoritos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_favoritos" ON favoritos;
CREATE POLICY "anon_sel_favoritos" ON favoritos FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_favoritos" ON favoritos;
CREATE POLICY "anon_ins_favoritos" ON favoritos FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_favoritos" ON favoritos;
CREATE POLICY "anon_del_favoritos" ON favoritos FOR DELETE TO anon, authenticated USING (true);

ALTER TABLE materiais ADD COLUMN IF NOT EXISTS favorito boolean NOT NULL DEFAULT false;

-- AJUSTES
CREATE TABLE IF NOT EXISTS ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  quantidade_ajuste integer NOT NULL,
  saldo_anterior integer NOT NULL DEFAULT 0,
  novo_saldo integer NOT NULL DEFAULT 0,
  motivo text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ajustes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_ajustes" ON ajustes;
CREATE POLICY "anon_sel_ajustes" ON ajustes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_ajustes" ON ajustes;
CREATE POLICY "anon_ins_ajustes" ON ajustes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_ajustes" ON ajustes;
CREATE POLICY "anon_upd_ajustes" ON ajustes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_ajustes" ON ajustes;
CREATE POLICY "anon_del_ajustes" ON ajustes FOR DELETE TO anon, authenticated USING (true);

-- CONFIG (singleton)
CREATE TABLE IF NOT EXISTS config (
  id int PRIMARY KEY DEFAULT 1,
  responsavel_nome text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT config_singleton CHECK (id = 1)
);
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_config" ON config;
CREATE POLICY "anon_sel_config" ON config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_config" ON config;
CREATE POLICY "anon_ins_config" ON config FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_config" ON config;
CREATE POLICY "anon_upd_config" ON config FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO config (id, responsavel_nome) VALUES (1, '') ON CONFLICT (id) DO NOTHING;

-- LOG ALTERACOES
CREATE TABLE IF NOT EXISTS log_alteracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_hora timestamptz NOT NULL DEFAULT now(),
  acao text NOT NULL,
  tipo_acao text NOT NULL,
  item_afetado text NOT NULL DEFAULT '',
  detalhe text NOT NULL DEFAULT ''
);
ALTER TABLE log_alteracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_log" ON log_alteracoes;
CREATE POLICY "anon_sel_log" ON log_alteracoes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_log" ON log_alteracoes;
CREATE POLICY "anon_ins_log" ON log_alteracoes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_log" ON log_alteracoes;
CREATE POLICY "anon_del_log" ON log_alteracoes FOR DELETE TO anon, authenticated USING (true);

-- RELATORIO SEQ
CREATE TABLE IF NOT EXISTS relatorio_seq (
  id int PRIMARY KEY DEFAULT 1,
  proximo_numero integer NOT NULL DEFAULT 1,
  CONSTRAINT relatorio_singleton CHECK (id = 1)
);
ALTER TABLE relatorio_seq ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_relseq" ON relatorio_seq;
CREATE POLICY "anon_sel_relseq" ON relatorio_seq FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_relseq" ON relatorio_seq;
CREATE POLICY "anon_ins_relseq" ON relatorio_seq FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_relseq" ON relatorio_seq;
CREATE POLICY "anon_upd_relseq" ON relatorio_seq FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO relatorio_seq (id, proximo_numero) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;

-- RECREATE VW_ESTOQUE with adjustments
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
  m.ini10 - COALESCE(s10.total, 0) AS saldo10,
  m.ini50 - COALESCE(s50.total, 0) AS saldo50,
  m.estoque_inicial - COALESCE(su.total, 0) + COALESCE(adj.total, 0) AS saldo_unit,
  CASE
    WHEN c.inventory_type = 'UNIT' THEN m.estoque_inicial - COALESCE(su.total, 0) + COALESCE(adj.total, 0)
    ELSE (m.ini10 - COALESCE(s10.total, 0)) * 10 + (m.ini50 - COALESCE(s50.total, 0)) * 50 + COALESCE(adj.total, 0)
  END AS total_unidades
FROM materiais m
JOIN categorias c ON c.id = m.categoria_id
LEFT JOIN (SELECT material_id, SUM(qtd_pacotes) AS total FROM saidas WHERE tipo_pacote = 10 AND inventory_type = 'PACKAGE' GROUP BY material_id) s10 ON s10.material_id = m.id
LEFT JOIN (SELECT material_id, SUM(qtd_pacotes) AS total FROM saidas WHERE tipo_pacote = 50 AND inventory_type = 'PACKAGE' GROUP BY material_id) s50 ON s50.material_id = m.id
LEFT JOIN (SELECT material_id, SUM(quantidade) AS total FROM saidas WHERE inventory_type = 'UNIT' GROUP BY material_id) su ON su.material_id = m.id
LEFT JOIN (SELECT material_id, SUM(quantidade_ajuste) AS total FROM ajustes GROUP BY material_id) adj ON adj.material_id = m.id;
