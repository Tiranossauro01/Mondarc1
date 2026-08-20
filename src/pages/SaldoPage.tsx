import { useEffect, useState } from 'react';
import { Scale, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { EstoqueRow, Categoria } from '@/lib/supabase';
import { LoadingSpinner, EmptyState, Badge } from '@/components/UI';
import { formatNumber } from '@/lib/utils';

export function SaldoPage() {
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'baixo' | 'zero' | 'ok'>('all');
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
    const matchFilter =
      filter === 'all' ||
      (filter === 'zero' && e.total_unidades === 0) ||
      (filter === 'baixo' && e.total_unidades > 0 && e.total_unidades < 50) ||
      (filter === 'ok' && e.total_unidades >= 50);
    return matchSearch && matchCat && matchFilter;
  });

  const zeroCount = estoque.filter((e) => e.total_unidades === 0).length;
  const baixoCount = estoque.filter((e) => e.total_unidades > 0 && e.total_unidades < 50).length;
  const okCount = estoque.filter((e) => e.total_unidades >= 50).length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl border border-line p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Scale size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{formatNumber(estoque.length)}</p>
            <p className="text-sm text-ink-soft">Total</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-line p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{formatNumber(okCount)}</p>
            <p className="text-sm text-ink-soft">Adequado</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-line p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{formatNumber(baixoCount)}</p>
            <p className="text-sm text-ink-soft">Baixo</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-line p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{formatNumber(zeroCount)}</p>
            <p className="text-sm text-ink-soft">Zerado</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-line overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex flex-col sm:flex-row sm:items-center gap-3">
          <h3 className="font-semibold text-ink flex-1">Saldo de Estoque por Material</h3>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-lg border border-line bg-input text-ink text-sm w-full sm:w-44 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
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
          <div className="flex gap-1 p-1 bg-card-alt rounded-lg overflow-x-auto">
            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-card text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>Todos</button>
            <button onClick={() => setFilter('ok')} className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${filter === 'ok' ? 'bg-card text-emerald-600 shadow-sm' : 'text-ink-soft hover:text-ink'}`}>Adequado</button>
            <button onClick={() => setFilter('baixo')} className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${filter === 'baixo' ? 'bg-card text-amber-600 shadow-sm' : 'text-ink-soft hover:text-ink'}`}>Baixo</button>
            <button onClick={() => setFilter('zero')} className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${filter === 'zero' ? 'bg-card text-rose-600 shadow-sm' : 'text-ink-soft hover:text-ink'}`}>Zerado</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Scale size={28} />} title="Nenhum material encontrado" description="Cadastre materiais para acompanhar o saldo de estoque." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-card-alt/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Material</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Painel</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Saldo Atual</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider w-40">Nível</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((e) => {
                  const isZero = e.total_unidades === 0;
                  const isBaixo = e.total_unidades > 0 && e.total_unidades < 50;
                  const pct = Math.min(100, (e.total_unidades / 200) * 100);
                  const color = isZero ? 'rose' : isBaixo ? 'amber' : 'emerald';
                  const label = isZero ? 'Zerado' : isBaixo ? 'Baixo' : 'OK';
                  return (
                    <tr key={e.material_id} className="hover:bg-card-alt/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <p className="text-sm font-medium text-ink">{e.material_nome}</p>
                        {e.bitola && <p className="text-xs text-ink-soft">{e.bitola}</p>}
                      </td>
                      <td className="px-6 py-3.5"><Badge color={e.cor}>{e.categoria_nome}</Badge></td>
                      <td className={`px-6 py-3.5 text-sm font-bold text-right ${isZero ? 'text-rose-500' : isBaixo ? 'text-amber-500' : 'text-ink'}`}>
                        {formatNumber(e.total_unidades)} <span className="text-xs font-normal text-ink-soft">{e.inventory_type === 'UNIT' ? e.unidade_medida : 'un'}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-card-alt overflow-hidden min-w-[60px]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                color === 'rose' ? 'bg-rose-500' : color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${
                            color === 'rose' ? 'text-rose-500' : color === 'amber' ? 'text-amber-500' : 'text-emerald-500'
                          }`}>{label}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
