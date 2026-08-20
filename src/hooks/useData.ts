import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Categoria, Material, Saida, EstoqueRow } from '@/lib/supabase';

export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('ordem');
    if (!error && data) setCategorias(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { categorias, loading, reload: load };
}

export function useMateriais() {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('materiais')
      .select('*')
      .order('nome');
    if (!error && data) setMateriais(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { materiais, loading, reload: load };
}

export function useEstoque() {
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vw_estoque')
      .select('*')
      .order('material_nome');
    if (!error && data) setEstoque(data as unknown as EstoqueRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { estoque, loading, reload: load };
}

export function useSaidas() {
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('saidas')
      .select('*')
      .order('data', { ascending: false });
    if (!error && data) setSaidas(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { saidas, loading, reload: load };
}
