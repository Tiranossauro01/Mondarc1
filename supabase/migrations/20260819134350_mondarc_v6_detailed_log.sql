/*
# Mondarc V6 — Detailed Audit Log + Removal Tracking

1. Purpose
Enhance the log_alteracoes table to store detailed information about each stock change:
- material_id (which material was affected)
- quantidade (how much was added/removed)
- unit_type ('pacote' or 'unidade')
- saldo_anterior (stock before the action)
- novo_saldo (stock after the action)
- responsavel (who performed the action)

2. Modified Tables
- `log_alteracoes` — add columns: material_id, quantidade, unit_type, saldo_anterior, novo_saldo, responsavel

3. Notes
- All new columns are nullable or have defaults to preserve existing rows
- No data loss — existing log rows remain valid with nulls in new columns
*/

ALTER TABLE log_alteracoes ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES materiais(id) ON DELETE SET NULL;
ALTER TABLE log_alteracoes ADD COLUMN IF NOT EXISTS quantidade integer;
ALTER TABLE log_alteracoes ADD COLUMN IF NOT EXISTS unit_type text CHECK (unit_type IN ('pacote', 'unidade') OR unit_type IS NULL);
ALTER TABLE log_alteracoes ADD COLUMN IF NOT EXISTS saldo_anterior integer;
ALTER TABLE log_alteracoes ADD COLUMN IF NOT EXISTS novo_saldo integer;
ALTER TABLE log_alteracoes ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT '';
