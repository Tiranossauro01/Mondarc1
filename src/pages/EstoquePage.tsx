import { useEffect, useState } from 'react';
import { Boxes, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { EstoqueRow, Categoria } from '@/lib/supabase';
import { LoadingSpinner, EmptyState, Badge, InventoryTypeBadge } from '@/components/UI';
import { formatNumber } from '@/lib/utils';

export function EstoquePage() {
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [estRes, catRes] = await Promise.all([
        supabase.from('vw_estoque').select('*').eq('ativo', true).order('material_nome'),
        supabase.from('categorias').select('*').order('ordem'),
      ]);
      if (estRes.data) setEstoque(estRes.data as unknown as EstoqueRow[]);
      if (catRes.data) setCategorias(catRes.data);
      setLoading(false);
    })();
  }, []);

  const filtered = estoque.filter((e) => {
    const matchSearch = e.material_nome.toLowerCase().includes(search.toLowerCase()) ||
      e.bitola.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || e.categoria_id === filterCat;
    return matchSearch && matchCat;
  });

  const totalUnidades = filtered.reduce((s, e) => s + e.total_unidades, 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-line p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Boxes size={20} />
            </div>
            <p className="text-sm text-ink-soft">Materiais Ativos</p>
          </div>
          <p className="text-2xl font-bold text-ink">{formatNumber(filtered.length)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-line p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Boxes size={20} />
            </div>
            <p className="text-sm text-ink-soft">Total de Unidades</p>
          </div>
          <p className="text-2xl font-bold text-ink">{formatNumber(totalUnidades)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-line p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Boxes size={20} />
            </div>
            <p className="text-sm text-ink-soft">Painéis</p>
          </div>
          <p className="text-2xl font-bold text-ink">{formatNumber(categorias.length)}</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-line overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex flex-col sm:flex-row sm:items-center gap-3">
          <h3 className="font-semibold text-ink flex-1">Estoque Atual</h3>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-lg border border-line bg-input text-ink text-sm w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="px-3 py-2 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          >
            <option value="all">Todos os painéis</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Boxes size={28} />} title="Sem dados de estoque" description="Cadastre materiais para ver o estoque." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-card-alt/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Material</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Painel</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden md:table-cell">Tipo</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden sm:table-cell">Detalhe</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((e) => (
                  <tr key={e.material_id} className="hover:bg-card-alt/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="text-sm font-medium text-ink">{e.material_nome}</p>
                      {e.bitola && <p className="text-xs text-ink-soft">{e.bitola}</p>}
                    </td>
                    <td className="px-6 py-3.5"><Badge color={e.cor}>{e.categoria_nome}</Badge></td>
                    <td className="px-6 py-3.5 hidden md:table-cell"><InventoryTypeBadge type={e.inventory_type} /></td>
                    <td className="px-6 py-3.5 text-sm text-ink-soft text-right hidden sm:table-cell">
                      {e.inventory_type === 'UNIT'
                        ? `${formatNumber(e.saldo_unit)} ${e.unidade_medida}`
                        : `${formatNumber(e.saldo10)} p10 / ${formatNumber(e.saldo50)} p50`
                      }
                    </td>
                    <td className="px-6 py-3.5 text-sm font-bold text-ink text-right">
                      {formatNumber(e.total_unidades)} <span className="text-xs font-normal text-ink-soft">{e.inventory_type === 'UNIT' ? e.unidade_medida : 'un'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
