import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export type InventoryType = 'UNIT' | 'PACKAGE';

export type Categoria = {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  inventory_type: InventoryType;
  created_at: string;
};

export type Material = {
  id: string;
  categoria_id: string;
  nome: string;
  bitola: string;
  ini10: number;
  ini50: number;
  estoque_inicial: number;
  unidade_medida: string;
  comprar: boolean;
  ativo: boolean;
  favorito: boolean;
  created_at: string;
  updated_at: string;
};

export type Saida = {
  id: string;
  material_id: string;
  categoria_id: string;
  data: string;
  tipo_pacote: 10 | 50;
  qtd_pacotes: number;
  obs: string;
  inventory_type: InventoryType;
  quantidade: number;
  total_unidades: number;
  created_at: string;
};

export type Ajuste = {
  id: string;
  material_id: string;
  categoria_id: string;
  data: string;
  quantidade_ajuste: number;
  saldo_anterior: number;
  novo_saldo: number;
  motivo: string;
  created_at: string;
};

export type LogAlteracao = {
  id: string;
  data_hora: string;
  acao: string;
  tipo_acao: string;
  item_afetado: string;
  detalhe: string;
  material_id: string | null;
  quantidade: number | null;
  unit_type: 'pacote' | 'unidade' | null;
  saldo_anterior: number | null;
  novo_saldo: number | null;
  responsavel: string;
};

export type Config = {
  id: number;
  responsavel_nome: string;
  updated_at: string;
};

export type EstoqueRow = {
  material_id: string;
  material_nome: string;
  bitola: string;
  categoria_id: string;
  categoria_nome: string;
  cor: string;
  inventory_type: InventoryType;
  ini10: number;
  ini50: number;
  estoque_inicial: number;
  unidade_medida: string;
  comprar: boolean;
  ativo: boolean;
  favorito: boolean;
  saidas10: number;
  saidas50: number;
  saidas_unit: number;
  total_ajustes: number;
  compras10: number;
  compras50: number;
  compras_unit: number;
  saldo10: number;
  saldo50: number;
  saldo_unit: number;
  total_unidades: number;
};

export type Compra = {
  id: string;
  material_id: string;
  categoria_id: string;
  data: string;
  fornecedor: string;
  nota: string;
  tipo_embalagem: 'pacote' | 'unidade';
  tipo_pacote: number;
  qtd_pacotes: number;
  qtd_unidades: number;
  valor_unitario: number;
  valor_total: number;
  obs: string;
  lista_compra_id: string | null;
  created_at: string;
};

export type ListaCompra = {
  id: string;
  material_id: string | null;
  categoria_id: string | null;
  nome_material: string;
  qtd_comprar: number;
  tipo_embalagem: 'pacote' | 'unidade';
  tipo_pacote: number;
  prioridade: 'baixa' | 'media' | 'alta';
  status: 'pendente' | 'em_compra' | 'comprado' | 'cancelado';
  origem: 'compra' | 'producao';
  obs: string;
  compra_id: string | null;
  created_at: string;
  updated_at: string;
};

// Helper: log an action to the audit trail
export async function logAction(
  acao: string,
  tipo_acao: string,
  item_afetado: string,
  detalhe: string = '',
  extra?: {
    material_id?: string;
    quantidade?: number;
    unit_type?: 'pacote' | 'unidade';
    saldo_anterior?: number;
    novo_saldo?: number;
    responsavel?: string;
  },
) {
  try {
    await supabase.from('log_alteracoes').insert({
      acao,
      tipo_acao,
      item_afetado,
      detalhe,
      ...extra,
    });
  } catch { /* silent — audit log should never block user actions */ }
}
