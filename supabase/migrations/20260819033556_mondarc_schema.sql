/*
# Mondarc V4 — Inventory Management Schema

1. Purpose
- Professional inventory management system with categories (painéis), materials, and stock movements.
- Single-tenant app (no sign-in) — all data is shared/public.

2. Tables
- `categorias` — groups of materials (e.g. Geral, Hidráulica). A "painel" is a category.
  - id (uuid PK), nome (text unique not null), cor (text for UI accent), created_at.
- `materiais` — items tracked in inventory, each belonging to a category.
  - id (uuid PK), categoria_id (FK categorias), nome (text not null), unidade (text, e.g. 'un', 'm', 'kg'), estoque_minimo (int default 0), created_at.
- `movimentos` — every stock change (entrada/saída) and purchase registration.
  - id (uuid PK), material_id (FK materiais), tipo (text: 'entrada' | 'saida' | 'compra'), quantidade (int not null), categoria_id (denormalized FK for fast filtering), data (timestamptz default now()), responsavel (text, optional), nota (text, optional), compra_id (uuid nullable, links grouped purchase entries).
- `compras` — purchase records grouped together.
  - id (uuid PK), data (timestamptz default now()), fornecedor (text optional), responsavel (text optional), nota (text optional), total_itens (int default 0).

3. Security
- RLS enabled on all tables.
- Single-tenant: anon + authenticated have full CRUD (data is intentionally shared).
*/

CREATE TABLE IF NOT EXISTS categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  cor text NOT NULL DEFAULT '#2563eb',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_categorias" ON categorias;
CREATE POLICY "anon_select_categorias" ON categorias FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_categorias" ON categorias;
CREATE POLICY "anon_insert_categorias" ON categorias FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_categorias" ON categorias;
CREATE POLICY "anon_update_categorias" ON categorias FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_categorias" ON categorias;
CREATE POLICY "anon_delete_categorias" ON categorias FOR DELETE
  TO anon, authenticated USING (true);


CREATE TABLE IF NOT EXISTS materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  unidade text NOT NULL DEFAULT 'un',
  estoque_minimo integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE materiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_materiais" ON materiais;
CREATE POLICY "anon_select_materiais" ON materiais FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_materiais" ON materiais;
CREATE POLICY "anon_insert_materiais" ON materiais FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_materiais" ON materiais;
CREATE POLICY "anon_update_materiais" ON materiais FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_materiais" ON materiais;
CREATE POLICY "anon_delete_materiais" ON materiais FOR DELETE
  TO anon, authenticated USING (true);


CREATE TABLE IF NOT EXISTS compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data timestamptz NOT NULL DEFAULT now(),
  fornecedor text,
  responsavel text,
  nota text,
  total_itens integer NOT NULL DEFAULT 0
);

ALTER TABLE compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_compras" ON compras;
CREATE POLICY "anon_select_compras" ON compras FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_compras" ON compras;
CREATE POLICY "anon_insert_compras" ON compras FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_compras" ON compras;
CREATE POLICY "anon_update_compras" ON compras FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_compras" ON compras;
CREATE POLICY "anon_delete_compras" ON compras FOR DELETE
  TO anon, authenticated USING (true);


CREATE TABLE IF NOT EXISTS movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida','compra')),
  quantidade integer NOT NULL,
  data timestamptz NOT NULL DEFAULT now(),
  responsavel text,
  nota text,
  compra_id uuid REFERENCES compras(id) ON DELETE SET NULL
);

ALTER TABLE movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_movimentos" ON movimentos;
CREATE POLICY "anon_select_movimentos" ON movimentos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_movimentos" ON movimentos;
CREATE POLICY "anon_insert_movimentos" ON movimentos FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_movimentos" ON movimentos;
CREATE POLICY "anon_update_movimentos" ON movimentos FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_movimentos" ON movimentos;
CREATE POLICY "anon_delete_movimentos" ON movimentos FOR DELETE
  TO anon, authenticated USING (true);


CREATE INDEX IF NOT EXISTS idx_materiais_categoria_id ON materiais(categoria_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_material_id ON movimentos(material_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_categoria_id ON movimentos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_tipo ON movimentos(tipo);
CREATE INDEX IF NOT EXISTS idx_movimentos_data ON movimentos(data DESC);
CREATE INDEX IF NOT EXISTS idx_movimentos_compra_id ON movimentos(compra_id);
