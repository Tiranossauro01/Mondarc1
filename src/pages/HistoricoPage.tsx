import { useEffect, useState, useMemo } from 'react';
import { History, Search, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Saida, Material, Categoria } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { DatePicker } from '@/components/DatePicker';
import { LoadingSpinner, EmptyState, Badge, InventoryTypeBadge, Toast } from '@/components/UI';
import { formatNumber, formatDate } from '@/lib/utils';

export function HistoricoPage() {
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterMat, setFilterMat] = useState<string>('all');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  const [editingSaida, setEditingSaida] = useState<Saida | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [savingDate, setSavingDate] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    const [saiRes, matRes, catRes] = await Promise.all([
      supabase.from('saidas').select('*').order('data', { ascending: false }),
      supabase.from('materiais').select('*'),
      supabase.from('categorias').select('*').order('ordem'),
    ]);
    if (saiRes.data) setSaidas(saiRes.data);
    if (matRes.data) setMateriais(matRes.data);
    if (catRes.data) setCategorias(catRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const matMap = useMemo(() => new Map(materiais.map((m) => [m.id, m])), [materiais]);
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const filtered = saidas.filter((s) => {
    const mat = matMap.get(s.material_id);
    const matchSearch = !search || (mat?.nome ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || s.categoria_id === filterCat;
    const matchMat = filterMat === 'all' || s.material_id === filterMat;
    const matchInicio = !dataInicio || s.data >= dataInicio;
    const matchFim = !dataFim || s.data <= dataFim;
    return matchSearch && matchCat && matchMat && matchInicio && matchFim;
  });

  const materiaisFiltrados = filterCat === 'all' ? materiais : materiais.filter((m) => m.categoria_id === filterCat);

  const openEditDate = (s: Saida) => {
    setEditingSaida(s);
    setEditDate(s.data);
  };

  const handleSaveDate = async () => {
    if (!editingSaida || !editDate) return;
    setSavingDate(true);
    const { error } = await supabase.from('saidas').update({ data: editDate }).eq('id', editingSaida.id);
    setSavingDate(false);
    if (error) { showToast('Erro ao atualizar data', 'error'); return; }
    showToast('Data atualizada');
    setEditingSaida(null);
    setEditDate('');
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="bg-card rounded-2xl border border-line overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <History size={20} className="text-ink-soft" />
            <h3 className="font-semibold text-ink">Histórico de Saídas</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                placeholder="Buscar material..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <select
              value={filterCat}
              onChange={(e) => { setFilterCat(e.target.value); setFilterMat('all'); }}
              className="px-3 py-2 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              <option value="all">Todos os painéis</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <select
              value={filterMat}
              onChange={(e) => setFilterMat(e.target.value)}
              className="px-3 py-2 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              <option value="all">Todos os materiais</option>
              {materiaisFiltrados.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}{m.bitola ? ` · ${m.bitola}` : ''}</option>
              ))}
            </select>
            <DatePicker value={dataInicio} onChange={setDataInicio} label="" id="filter-inicio" />
            <DatePicker value={dataFim} onChange={setDataFim} label="" id="filter-fim" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<History size={28} />}
            title="Nenhuma saída registrada"
            description="As saídas registradas aparecerão aqui com filtros por painel, material e período."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-card-alt/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Data</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Painel</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Material</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden md:table-cell">Tipo</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden sm:table-cell">Detalhe</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Total</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden lg:table-cell">Obs.</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((s) => {
                  const mat = matMap.get(s.material_id);
                  const cat = catMap.get(s.categoria_id);
                  const isUnit = s.inventory_type === 'UNIT';
                  return (
                    <tr key={s.id} className="hover:bg-card-alt/50 transition-colors group">
                      <td className="px-6 py-3.5 text-sm text-ink whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {formatDate(s.data)}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">{cat && <Badge color={cat.cor}>{cat.nome}</Badge>}</td>
                      <td className="px-6 py-3.5 text-sm font-medium text-ink">
                        {mat?.nome ?? '—'}{mat?.bitola ? <span className="text-ink-soft font-normal"> · {mat.bitola}</span> : ''}
                      </td>
                      <td className="px-6 py-3.5 hidden md:table-cell"><InventoryTypeBadge type={s.inventory_type} /></td>
                      <td className="px-6 py-3.5 text-sm text-ink-soft text-right hidden sm:table-cell">
                        {isUnit ? `${formatNumber(s.quantidade)} ${mat?.unidade_medida ?? 'peças'}` : `${s.tipo_pacote} × ${formatNumber(s.qtd_pacotes)}`}
                      </td>
                      <td className="px-6 py-3.5 text-sm font-bold text-amber-600 dark:text-amber-400 text-right">
                        {formatNumber(s.total_unidades)}
                      </td>
                      <td className="px-6 py-3.5 text-sm text-ink-soft max-w-32 truncate hidden lg:table-cell">{s.obs || '—'}</td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => openEditDate(s)}
                          className="p-1.5 rounded-lg text-ink-soft hover:bg-card-alt hover:text-accent opacity-0 group-hover:opacity-100 transition-all"
                          title="Editar data"
                        >
                          <Pencil size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Date edit modal */}
      {editingSaida && (
        <Modal
          open
          onClose={() => { setEditingSaida(null); setEditDate(''); }}
          title="Editar Data da Saída"
          maxWidth="max-w-sm"
        >
          <div className="space-y-4">
            <div className="text-sm text-ink-soft">
              <span className="font-medium text-ink">
                {matMap.get(editingSaida.material_id)?.nome ?? 'Material'}
              </span>
              {' — '}
              {formatNumber(editingSaida.total_unidades)} unidades
            </div>
            <DatePicker
              value={editDate}
              onChange={setEditDate}
              label="Nova data"
              id="edit-date"
            />
            <p className="text-xs text-ink-soft">
              Alterar a data não afeta o saldo de estoque. Apenas a data de registro da saída é modificada.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setEditingSaida(null); setEditDate(''); }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDate}
                disabled={savingDate || !editDate || editDate === editingSaida.data}
                className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingDate ? 'Salvando...' : 'Salvar data'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
