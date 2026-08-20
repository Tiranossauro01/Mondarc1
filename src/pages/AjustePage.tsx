import { useEffect, useState, useMemo } from 'react';
import { Sliders, Search, Trash2, Package, Boxes } from 'lucide-react';
import { supabase, logAction, type Ajuste, type Material, type Categoria, type EstoqueRow } from '@/lib/supabase';
import { Modal, ConfirmModal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, Badge, Toast } from '@/components/UI';
import { formatNumber, formatDate } from '@/lib/utils';

export function AjustePage() {
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ajuste | null>(null);

  const [removalOpen, setRemovalOpen] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    const [adjRes, matRes, catRes, estRes] = await Promise.all([
      supabase.from('ajustes').select('*').order('data', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('materiais').select('*'),
      supabase.from('categorias').select('*').order('ordem'),
      supabase.from('vw_estoque').select('*'),
    ]);
    if (adjRes.data) setAjustes(adjRes.data);
    if (matRes.data) setMateriais(matRes.data);
    if (catRes.data) setCategorias(catRes.data);
    if (estRes.data) setEstoque(estRes.data as unknown as EstoqueRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const matMap = useMemo(() => new Map(materiais.map((m) => [m.id, m])), [materiais]);
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const filtered = ajustes.filter((a) => {
    const mat = matMap.get(a.material_id);
    const matchSearch = !search || (mat?.nome ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || a.categoria_id === filterCat;
    return matchSearch && matchCat;
  });

  const handleDelete = async (adj: Ajuste) => {
    const { error } = await supabase.from('ajustes').delete().eq('id', adj.id);
    if (error) { showToast('Erro ao excluir ajuste', 'error'); return; }
    const mat = matMap.get(adj.material_id);
    await logAction('Ajuste excluído', 'AJUSTE', mat?.nome ?? '', `ID: ${adj.id}`);
    showToast('Ajuste excluído');
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="bg-card rounded-2xl border border-line p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sliders size={20} className="text-violet-500" />
          <h3 className="font-semibold text-ink">Ajuste de Estoque</h3>
        </div>
        <p className="text-sm text-ink-soft">
          O ajuste de estoque é diferente de uma saída. Use para corrigir diferenças encontradas em conferências físicas.
          Ajustes não são saídas — são registrados separadamente como AJUSTE e afetam o saldo real sem aparecer no Relatório do Período.
        </p>
      </div>

      {/* Quick removal action */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => setRemovalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/20"
        >
          <Sliders size={20} /> Remover Pacotes ou Unidades
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-line overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex flex-col sm:flex-row sm:items-center gap-3">
          <h3 className="font-semibold text-ink flex-1">Histórico de Ajustes</h3>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-lg border border-line bg-input text-ink text-sm w-full sm:w-44 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="px-3 py-2 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
          >
            <option value="all">Todos os painéis</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Sliders size={28} />}
            title="Nenhum ajuste registrado"
            description="Ajustes de estoque aparecerão aqui. Use o botão acima para remover pacotes ou unidades."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-card-alt/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Data</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Painel</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Material</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden sm:table-cell">Saldo Anterior</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Ajuste</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Novo Saldo</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden lg:table-cell">Motivo</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((a) => {
                  const mat = matMap.get(a.material_id);
                  const cat = catMap.get(a.categoria_id);
                  const isPositive = a.quantidade_ajuste > 0;
                  return (
                    <tr key={a.id} className="hover:bg-card-alt/50 transition-colors group">
                      <td className="px-6 py-3.5 text-sm text-ink whitespace-nowrap">{formatDate(a.data)}</td>
                      <td className="px-6 py-3.5">{cat && <Badge color={cat.cor}>{cat.nome}</Badge>}</td>
                      <td className="px-6 py-3.5 text-sm font-medium text-ink">
                        {mat?.nome ?? '—'}{mat?.bitola ? <span className="text-ink-soft font-normal"> · {mat.bitola}</span> : ''}
                      </td>
                      <td className="px-6 py-3.5 text-sm text-ink-soft text-right hidden sm:table-cell">{formatNumber(a.saldo_anterior)}</td>
                      <td className={`px-6 py-3.5 text-sm font-bold text-right ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isPositive ? '+' : ''}{formatNumber(a.quantidade_ajuste)}
                      </td>
                      <td className="px-6 py-3.5 text-sm font-bold text-ink text-right">{formatNumber(a.novo_saldo)}</td>
                      <td className="px-6 py-3.5 text-sm text-ink-soft max-w-32 truncate hidden lg:table-cell">{a.motivo || '—'}</td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => setDeleteTarget(a)}
                          className="p-1.5 rounded-lg text-ink-soft hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all text-xs"
                        >
                          Excluir
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

      {removalOpen && (
        <RemovalModal
          estoque={estoque}
          categorias={categorias}
          onClose={() => setRemovalOpen(false)}
          onSaved={() => { setRemovalOpen(false); load(); showToast('Ajuste registrado'); }}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="Excluir Ajuste"
        message="Tem certeza? O saldo será recalculado automaticamente."
        confirmLabel="Excluir"
      />

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

// ====== Removal Modal — choose pacotes or unidades ======
function RemovalModal({ estoque, categorias, onClose, onSaved }: {
  estoque: EstoqueRow[];
  categorias: Categoria[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedMatId, setSelectedMatId] = useState('');
  const [unitType, setUnitType] = useState<'pacote' | 'unidade'>('pacote');
  const [quantidade, setQuantidade] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedMat = estoque.find((e) => e.material_id === selectedMatId);
  const isPackage = selectedMat?.inventory_type === 'PACKAGE';

  // When material changes, reset unit type to valid option
  useEffect(() => {
    if (selectedMat) {
      if (selectedMat.inventory_type === 'UNIT') setUnitType('unidade');
      else setUnitType('pacote');
    }
  }, [selectedMatId]);

  // Stock available based on unit type
  const stockDisponivel = selectedMat
    ? unitType === 'pacote'
      ? (isPackage ? selectedMat.saldo10 + selectedMat.saldo50 : 0)
      : (isPackage ? selectedMat.saldo10 * 10 + selectedMat.saldo50 * 50 + (selectedMat.total_ajustes ?? 0) : selectedMat.saldo_unit)
    : 0;

  // For packages, we need to know which package size we're removing from
  const [pacoteSize, setPacoteSize] = useState<10 | 50>(10);

  const saldoAnterior = selectedMat
    ? unitType === 'pacote'
      ? (pacoteSize === 10 ? selectedMat.saldo10 : selectedMat.saldo50)
      : (isPackage ? selectedMat.saldo10 * 10 + selectedMat.saldo50 * 50 + (selectedMat.total_ajustes ?? 0) : selectedMat.saldo_unit)
    : 0;

  const novoSaldo = saldoAnterior - quantidade;

  const handleSave = async () => {
    setError('');

    if (!selectedMat) { setError('Selecione um material'); return; }
    if (!quantidade || quantidade <= 0 || !Number.isInteger(quantidade)) { setError('Quantidade deve ser um número inteiro positivo'); return; }
    if (quantidade > saldoAnterior) { setError(`Quantidade insuficiente. Disponível: ${formatNumber(saldoAnterior)} ${unitType === 'pacote' ? 'pacotes' : 'unidades'}`); return; }
    if (!motivo.trim()) { setError('Informe o motivo da remoção'); return; }
    if (novoSaldo < 0) { setError('O novo saldo não pode ser negativo'); return; }

    setSaving(true);

    // Calculate the adjustment quantity in units
    const ajusteQty = unitType === 'pacote' ? -(quantidade * pacoteSize) : -quantidade;

    const { error: insError } = await supabase.from('ajustes').insert({
      material_id: selectedMat.material_id,
      categoria_id: selectedMat.categoria_id,
      quantidade_ajuste: ajusteQty,
      saldo_anterior: selectedMat.total_unidades,
      novo_saldo: selectedMat.total_unidades + ajusteQty,
      motivo: motivo.trim(),
    });

    if (insError) { setError('Erro ao registrar ajuste'); setSaving(false); return; }

    // Log with full details
    await logAction(
      `Removidos ${formatNumber(quantidade)} ${unitType === 'pacote' ? 'pacotes' : 'unidades'} de ${selectedMat.material_nome}`,
      'AJUSTE',
      selectedMat.material_nome,
      `${unitType === 'pacote' ? 'pacote' : 'unidade'}: -${formatNumber(quantidade)}`,
      {
        material_id: selectedMat.material_id,
        quantidade: -quantidade,
        unit_type: unitType,
        saldo_anterior: selectedMat.total_unidades,
        novo_saldo: selectedMat.total_unidades + ajusteQty,
      },
    );

    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Remover Pacotes ou Unidades" maxWidth="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Material</label>
          <select
            value={selectedMatId}
            onChange={(e) => setSelectedMatId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
          >
            <option value="">Selecione um material...</option>
            {estoque.filter((e) => e.ativo).map((e) => (
              <option key={e.material_id} value={e.material_id}>
                {e.material_nome}{e.bitola ? ` · ${e.bitola}` : ''} ({e.categoria_nome})
              </option>
            ))}
          </select>
        </div>

        {selectedMat && (
          <>
            {/* Current stock display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-card-alt border border-line text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-ink-soft mb-1">
                  <Package size={14} /> Pacotes
                </div>
                <p className="text-lg font-bold text-ink">
                  {isPackage ? `${formatNumber(selectedMat.saldo10)} p10 / ${formatNumber(selectedMat.saldo50)} p50` : '—'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-card-alt border border-line text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-ink-soft mb-1">
                  <Boxes size={14} /> Unidades
                </div>
                <p className="text-lg font-bold text-ink">
                  {isPackage ? formatNumber(selectedMat.saldo10 * 10 + selectedMat.saldo50 * 50 + (selectedMat.total_ajustes ?? 0)) : `${formatNumber(selectedMat.saldo_unit)} ${selectedMat.unidade_medida}`}
                </p>
              </div>
            </div>

            {/* Unit type selector */}
            {isPackage && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Tipo de Remoção</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setUnitType('pacote')}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      unitType === 'pacote' ? 'border-violet-400 bg-violet-500 text-white' : 'border-line bg-input text-ink-soft hover:border-ink-soft/30'
                    }`}
                  >
                    <Package size={16} /> Pacotes
                  </button>
                  <button
                    onClick={() => setUnitType('unidade')}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      unitType === 'unidade' ? 'border-violet-400 bg-violet-500 text-white' : 'border-line bg-input text-ink-soft hover:border-ink-soft/30'
                    }`}
                  >
                    <Boxes size={16} /> Unidades
                  </button>
                </div>
              </div>
            )}

            {/* Package size selector */}
            {isPackage && unitType === 'pacote' && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Tamanho do Pacote</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPacoteSize(10)}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      pacoteSize === 10 ? 'border-violet-400 bg-violet-500 text-white' : 'border-line bg-input text-ink-soft hover:border-ink-soft/30'
                    }`}
                  >
                    Pacote de 10
                  </button>
                  <button
                    onClick={() => setPacoteSize(50)}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      pacoteSize === 50 ? 'border-violet-400 bg-violet-500 text-white' : 'border-line bg-input text-ink-soft hover:border-ink-soft/30'
                    }`}
                  >
                    Pacote de 50
                  </button>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Quantidade a remover {unitType === 'pacote' && isPackage ? `(pacotes de ${pacoteSize})` : ''}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                  className="px-3 py-2.5 rounded-lg border border-line bg-input text-ink-soft hover:bg-card-alt transition-colors font-bold"
                >−</button>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={quantidade}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isInteger(v) && v >= 0) setQuantidade(v);
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                />
                <button
                  onClick={() => setQuantidade((q) => q + 1)}
                  className="px-3 py-2.5 rounded-lg border border-line bg-input text-ink-soft hover:bg-card-alt transition-colors font-bold"
                >+</button>
              </div>
            </div>

            {/* Stock before/after */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-lg bg-card-alt border border-line">
                <p className="text-xs text-ink-soft mb-1">Estoque Atual</p>
                <p className="text-lg font-bold text-ink">{formatNumber(saldoAnterior)}</p>
                <p className="text-xs text-ink-muted">{unitType === 'pacote' ? 'pacotes' : 'unidades'}</p>
              </div>
              <div className="p-3 rounded-lg bg-card-alt border border-line">
                <p className="text-xs text-ink-soft mb-1">Novo Estoque</p>
                <p className={`text-lg font-bold ${novoSaldo < 0 ? 'text-rose-500' : 'text-ink'}`}>{formatNumber(novoSaldo)}</p>
                <p className="text-xs text-ink-muted">{unitType === 'pacote' ? 'pacotes' : 'unidades'}</p>
              </div>
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Motivo</label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Conferência física, perda, dano..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !selectedMat || quantidade <= 0}
                className="flex-1 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Salvando...' : 'Confirmar Remoção'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
