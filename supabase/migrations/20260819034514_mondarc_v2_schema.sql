/*
# Mondarc V4 — Schema Redesign (V2 data model)

1. Purpose
- Redesign schema to match V2 specification: package-based stock (pacotes de 10/50), dynamic panels, manual purchase flags.
- Drop old V4 tables (movimentos, compras, materiais, categorias, vw_estoque) — no user data exists yet.
- Create new tables with proper relationships, all connected by IDs.

2. Tables
- `categorias` (painéis): id, nome (unique), cor, ordem, created_at
- `materiais`: id, categoria_id (FK CASCADE), nome, bitola, ini10, ini50, comprar, ativo, created_at, updated_at
  - UNIQUE(categoria_id, nome, bitola) — prevents duplicates within same panel
- `saidas`: id, material_id (FK CASCADE), categoria_id (FK CASCADE), data, tipo_pacote (10|50), qtd_pacotes, obs, created_at
  - CHECK: tipo_pacote IN (10,50), qtd_pacotes > 0

3. Views
- `vw_estoque`: computes saidas10, saidas50, saldo10, saldo50, total_unidades per material

4. Security
- RLS enabled on all tables, anon+authenticated CRUD (single-tenant, no auth)

5. Initial Data
- Panels: Geral (#0B7EC4), Hidráulica (#2FBFAE)
- Materials: 8 default items in Geral (Chumbador, Porca, Arruela, etc.)
*/

-- Drop old V4 schema
DROP VIEW IF EXISTS vw_estoque;
DROP TABLE IF EXISTS movimentos;
DROP TABLE IF EXISTS compras;
DROP TABLE IF EXISTS materiais;
DROP TABLE IF EXISTS categorias;

-- Create new tables
CREATE TABLE IF NOT EXISTS categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  cor text NOT NULL DEFAULT '#0B7EC4',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  bitola text NOT NULL DEFAULT '',
  ini10 integer NOT NULL DEFAULT 0,
  ini50 integer NOT NULL DEFAULT 0,
  comprar boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(categoria_id, nome, bitola)
);

CREATE TABLE IF NOT EXISTS saidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo_pacote integer NOT NULL CHECK (tipo_pacote IN (10, 50)),
  qtd_pacotes integer NOT NULL CHECK (qtd_pacotes > 0),
  obs text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create stock view
CREATE OR REPLACE VIEW vw_estoque AS
SELECT
  m.id AS material_id,
  m.nome AS material_nome,
  m.bitola,
  m.categoria_id,
  c.nome AS categoria_nome,
  c.cor,
  m.ini10,
  m.ini50,
  m.comprar,
  m.ativo,
  m.created_at,
  m.updated_at,
  COALESCE(s10.total, 0) AS saidas10,
  COALESCE(s50.total, 0) AS saidas50,
  m.ini10 - COALESCE(s10.total, 0) AS saldo10,
  m.ini50 - COALESCE(s50.total, 0) AS saldo50,
  (m.ini10 - COALESCE(s10.total, 0)) * 10 + (m.ini50 - COALESCE(s50.total, 0)) * 50 AS total_unidades
FROM materiais m
JOIN categorias c ON c.id = m.categoria_id
LEFT JOIN (SELECT material_id, SUM(qtd_pacotes) AS total FROM saidas WHERE tipo_pacote = 10 GROUP BY material_id) s10 ON s10.material_id = m.id
LEFT JOIN (SELECT material_id, SUM(qtd_pacotes) AS total FROM saidas WHERE tipo_pacote = 50 GROUP BY material_id) s50 ON s50.material_id = m.id;

-- Enable RLS
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE saidas ENABLE ROW LEVEL SECURITY;

-- Policies: categorias
DROP POLICY IF EXISTS "anon_select_categorias" ON categorias;
CREATE POLICY "anon_select_categorias" ON categorias FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_categorias" ON categorias;
CREATE POLICY "anon_insert_categorias" ON categorias FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_categorias" ON categorias;
CREATE POLICY "anon_update_categorias" ON categorias FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_categorias" ON categorias;
CREATE POLICY "anon_delete_categorias" ON categorias FOR DELETE TO anon, authenticated USING (true);

-- Policies: materiais
DROP POLICY IF EXISTS "anon_select_materiais" ON materiais;
CREATE POLICY "anon_select_materiais" ON materiais FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_materiais" ON materiais;
CREATE POLICY "anon_insert_materiais" ON materiais FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_materiais" ON materiais;
CREATE POLICY "anon_update_materiais" ON materiais FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_materiais" ON materiais;
CREATE POLICY "anon_delete_materiais" ON materiais FOR DELETE TO anon, authenticated USING (true);

-- Policies: saidas
DROP POLICY IF EXISTS "anon_select_saidas" ON saidas;
CREATE POLICY "anon_select_saidas" ON saidas FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_saidas" ON saidas;
CREATE POLICY "anon_insert_saidas" ON saidas FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_saidas" ON saidas;
CREATE POLICY "anon_update_saidas" ON saidas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_saidas" ON saidas;
CREATE POLICY "anon_delete_saidas" ON saidas FOR DELETE TO anon, authenticated USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS materiais_updated_at ON materiais;
CREATE TRIGGER materiais_updated_at
  BEFORE UPDATE ON materiais
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_materiais_categoria_id ON materiais(categoria_id);
CREATE INDEX IF NOT EXISTS idx_saidas_material_id ON saidas(material_id);
CREATE INDEX IF NOT EXISTS idx_saidas_categoria_id ON saidas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_saidas_data ON saidas(data DESC);

-- Initial data: panels
INSERT INTO categorias (nome, cor, ordem) VALUES
  ('Geral', '#0B7EC4', 1),
  ('Hidráulica', '#2FBFAE', 2)
ON CONFLICT (nome) DO NOTHING;

-- Initial data: materials
INSERT INTO materiais (categoria_id, nome, bitola, ini10, ini50) VALUES
  ((SELECT id FROM categorias WHERE nome = 'Geral'), 'Chumbador', '1/4', 43, 22),
  ((SELECT id FROM categorias WHERE nome = 'Geral'), 'Chumbador', '3/8', 0, 0),
  ((SELECT id FROM categorias WHERE nome = 'Geral'), 'Porca', '1/4', 79, 52),
  ((SELECT id FROM categorias WHERE nome = 'Geral'), 'Porca', '3/8', 10, 5),
  ((SELECT id FROM categorias WHERE nome = 'Geral'), 'Arruela', '1/4', 50, 63),
  ((SELECT id FROM categorias WHERE nome = 'Geral'), 'Arruela', '3/8', 8, 6),
  ((SELECT id FROM categorias WHERE nome = 'Geral'), 'Parafuso Brocante Sextavado', '', 6, 12),
  ((SELECT id FROM categorias WHERE nome = 'Geral'), 'Auto Brocante', '', 39, 34)
ON CONFLICT (categoria_id, nome, bitola) DO NOTHING;
