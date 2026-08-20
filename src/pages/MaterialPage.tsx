import { useEffect, useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Package, Search, Star, ChevronRight, ChevronDown, Folder, FolderOpen, Sliders,
} from 'lucide-react';
import { supabase, logAction, type Categoria, type Material, type EstoqueRow, type Saida, type Ajuste, type InventoryType } from '@/lib/supabase';
import { Modal, ConfirmModal } from '@/components/Modal';
import { DatePicker } from '@/components/DatePicker';
import { Toast, EmptyState, LoadingSpinner, Badge, InventoryTypeBadge } from '@/components/UI';
import { formatNumber, formatDate } from '@/lib/utils';

export function MaterialPage() {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [matModalOpen, setMatModalOpen] = useState(false);
  const [editingMat, setEditingMat] = useState<Material | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [detailTarget, setDetailTarget] = useState<EstoqueRow | null>(null);
  const [ajusteTarget, setAjusteTarget] = useState<EstoqueRow | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    const [matRes, catRes, estRes, saiRes, adjRes] = await Promise.all([
      supabase.from('materiais').select('*').order('nome'),
      supabase.from('categorias').select('*').order('ordem'),
      supabase.from('vw_estoque').select('*'),
      supabase.from('saidas').select('*').order('data', { ascending: false }),
      supabase.from('ajustes').select('*').order('data', { ascending: false }),
    ]);
    if (matRes.data) setMateriais(matRes.data);
    if (catRes.data) setCategorias(catRes.data);
    if (estRes.data) setEstoque(estRes.data as unknown as EstoqueRow[]);
    if (saiRes.data) setSaidas(saiRes.data);
    if (adjRes.data) setAjustes(adjRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const estMap = useMemo(() => new Map(estoque.map((e) => [e.material_id, e])), [estoque]);

  const togglePanel = (catId: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const filteredMateriais = useMemo(() => {
    if (!search.trim()) return materiais;
    const q = search.toLowerCase();
    return materiais.filter((m) =>
      m.nome.toLowerCase().includes(q) || m.bitola.toLowerCase().includes(q)
    );
  }, [materiais, search]);

  // Auto-expand panels that have search matches
  useEffect(() => {
    if (search.trim()) {
      const matchedCatIds = new Set(filteredMateriais.map((m) => m.categoria_id));
      setExpandedPanels(matchedCatIds);
    }
  }, [search, filteredMateriais]);

  const handleSaveMat = async (data: {
    nome: string; bitola: string; categoria_id: string;
    ini10: number; ini50: number; estoque_inicial: number; unidade_medida: string;
  }) => {
    if (editingMat) {
      const dup = materiais.find(
        (m) => m.categoria_id === data.categoria_id &&
          m.nome.toLowerCase() === data.nome.toLowerCase() &&
          m.bitola.toLowerCase() === data.bitola.toLowerCase() &&
          m.id !== editingMat.id
      );
      if (dup) { showToast('Já existe um material com esse nome e bitola neste painel', 'error'); return; }

      const { error } = await supabase.from('materiais').update({
        nome: data.nome, bitola: data.bitola, categoria_id: data.categoria_id,
        ini10: data.ini10, ini50: data.ini50,
        estoque_inicial: data.estoque_inicial, unidade_medida: data.unidade_medida,
      }).eq('id', editingMat.id);
      if (error) { showToast('Erro ao atualizar material', 'error'); return; }
      await logAction('Material editado', 'MATERIAL', data.nome, `Bitola: ${data.bitola}`);
      showToast('Material atualizado');
    } else {
      const dup = materiais.find(
        (m) => m.categoria_id === data.categoria_id &&
          m.nome.toLowerCase() === data.nome.toLowerCase() &&
          m.bitola.toLowerCase() === data.bitola.toLowerCase()
      );
      if (dup) { showToast('Já existe um material com esse nome e bitola neste painel', 'error'); return; }

      const { error } = await supabase.from('materiais').insert({
        nome: data.nome, bitola: data.bitola, categoria_id: data.categoria_id,
        ini10: data.ini10, ini50: data.ini50,
        estoque_inicial: data.estoque_inicial, unidade_medida: data.unidade_medida,
      });
      if (error) { showToast('Erro ao criar material', 'error'); return; }
      const cat = categorias.find((c) => c.id === data.categoria_id);
      await logAction('Material cadastrado', 'MATERIAL', data.nome, `Painel: ${cat?.nome}`);
      showToast('Material cadastrado');
    }
    setMatModalOpen(false);
    setEditingMat(null);
    load();
  };

  const handleDeleteMat = async (mat: Material) => {
    const { error } = await supabase.from('materiais').delete().eq('id', mat.id);
    if (error) { showToast('Erro ao excluir material', 'error'); return; }
    await logAction('Material excluído', 'MATERIAL', mat.nome, '');
    showToast('Material excluído');
    load();
  };

  const toggleFavorito = async (mat: Material) => {
    const newFav = !mat.favorito;
    const { error } = await supabase.from('materiais').update({ favorito: newFav }).eq('id', mat.id);
    if (error) { showToast('Erro ao atualizar favorito', 'error'); return; }

    if (newFav) {
      await supabase.from('favoritos').insert({ material_id: mat.id });
      await logAction('Material marcado como favorito', 'MATERIAL', mat.nome, '');
    } else {
      await supabase.from('favoritos').delete().eq('material_id', mat.id);
      await logAction('Favorito removido', 'MATERIAL', mat.nome, '');
    }
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="bg-card rounded-2xl border border-line overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-ink-soft" />
            <h3 className="font-semibold text-ink">Materiais</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                placeholder="Buscar material..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-lg border border-line bg-input text-ink text-sm w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <button
              onClick={() => { setEditingMat(null); setMatModalOpen(true); }}
              disabled={categorias.length === 0}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={16} /> Novo Material
            </button>
          </div>
        </div>

        {categorias.length === 0 ? (
          <EmptyState
            icon={<Package size={28} />}
            title="Nenhum painel cadastrado"
            description="Crie um painel em Configurações antes de adicionar materiais."
          />
        ) : (
          <div className="p-4">
            {/* Folder tree */}
            <div className="space-y-1">
              {categorias.map((cat) => {
                const panelMats = filteredMateriais.filter((m) => m.categoria_id === cat.id);
                const isExpanded = expandedPanels.has(cat.id) || (!!search.trim() && panelMats.length > 0);
                const matCount = materiais.filter((m) => m.categoria_id === cat.id).length;

                return (
                  <div key={cat.id}>
                    <button
                      onClick={() => togglePanel(cat.id)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-card-alt transition-colors group"
                    >
                      {isExpanded ? <ChevronDown size={18} className="text-ink-soft shrink-0" /> : <ChevronRight size={18} className="text-ink-soft shrink-0" />}
                      {isExpanded ? <FolderOpen size={18} className="text-amber-500 shrink-0" /> : <Folder size={18} className="text-amber-500 shrink-0" />}
                      <span className="flex-1 text-left text-sm font-semibold text-ink">{cat.nome}</span>
                      <InventoryTypeBadge type={cat.inventory_type} />
                      <span className="text-xs text-ink-muted">({matCount})</span>
                    </button>

                    {isExpanded && (
                      <div className="ml-6 border-l border-line pl-2 mt-0.5 space-y-0.5">
                        {panelMats.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-ink-muted italic">Nenhum material neste painel</p>
                        ) : (
                          panelMats.map((m) => {
                            const est = estMap.get(m.id);
                            return (
                              <div
                                key={m.id}
                                className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-card-alt transition-colors cursor-pointer"
                                onClick={() => setDetailTarget(est ?? null)}
                              >
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleFavorito(m); }}
                                  className="shrink-0"
                                >
                                  <Star
                                    size={16}
                                    className={m.favorito ? 'text-amber-400 fill-amber-400' : 'text-ink-muted hover:text-amber-400'}
                                  />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-ink truncate">
                                    {m.nome}{m.bitola ? ` · ${m.bitola}` : ''}
                                  </p>
                                </div>
                                <span className="text-sm font-bold text-ink shrink-0">
                                  {formatNumber(est?.total_unidades ?? 0)}
                                  <span className="text-xs font-normal text-ink-soft ml-1">
                                    {cat.inventory_type === 'UNIT' ? m.unidade_medida : 'un'}
                                  </span>
                                </span>
                                {est?.comprar && (
                                  <span className="shrink-0 px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium">Comprar</span>
                                )}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setAjusteTarget(est ?? null); }}
                                    className="p-1.5 rounded-lg text-ink-soft hover:bg-surface-elevated hover:text-ink"
                                    title="Ajustar estoque"
                                  >
                                    <Sliders size={15} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingMat(m); setMatModalOpen(true); }}
                                    className="p-1.5 rounded-lg text-ink-soft hover:bg-surface-elevated hover:text-ink"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); }}
                                    className="p-1.5 rounded-lg text-ink-soft hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-500"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {matModalOpen && (
        <MaterialModal
          material={editingMat}
          categorias={categorias}
          onSave={handleSaveMat}
          onClose={() => { setMatModalOpen(false); setEditingMat(null); }}
        />
      )}

      {detailTarget && (
        <MaterialDetailModal
          estoque={detailTarget}
          saidas={saidas.filter((s) => s.material_id === detailTarget.material_id)}
          ajustes={ajustes.filter((a) => a.material_id === detailTarget.material_id)}
          onClose={() => setDetailTarget(null)}
          onEdit={(mat) => {
            setDetailTarget(null);
            setEditingMat(mat);
            setMatModalOpen(true);
          }}
        />
      )}

      {ajusteTarget && (
        <AjusteModal
          estoque={ajusteTarget}
          onSaved={() => { setAjusteTarget(null); load(); }}
          onClose={() => setAjusteTarget(null)}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDeleteMat(deleteTarget)}
        title="Excluir Material"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}${deleteTarget?.bitola ? ' · ' + deleteTarget.bitola : ''}"? Todo o histórico de saídas deste material também será removido.`}
        confirmLabel="Excluir"
      />

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

// ====== Material Detail Modal ======
function MaterialDetailModal({ estoque, saidas, ajustes, onClose, onEdit }: {
  estoque: EstoqueRow;
  saidas: Saida[];
  ajustes: Ajuste[];
  onClose: () => void;
  onEdit: (mat: Material) => void;
}) {
  const cat = { nome: estoque.categoria_nome, cor: estoque.cor, inventory_type: estoque.inventory_type, id: estoque.categoria_id };
  const isUnit = estoque.inventory_type === 'UNIT';
  const estoqueInicial = isUnit ? estoque.estoque_inicial : estoque.ini10 * 10 + estoque.ini50 * 50;

  // Combined history
  const history = [
    ...saidas.map((s) => ({ date: s.data, type: 'Saída' as const, detail: isUnit ? `${s.quantidade} ${estoque.unidade_medida}` : `${s.qtd_pacotes} × ${s.tipo_pacote}`, total: s.total_unidades, obs: s.obs })),
    ...ajustes.map((a) => ({ date: a.data, type: 'Ajuste' as const, detail: `${a.quantidade_ajuste > 0 ? '+' : ''}${a.quantidade_ajuste}`, total: a.novo_saldo, obs: a.motivo })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Modal open onClose={onClose} title="Detalhes do Material" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-ink">{estoque.material_nome}</h3>
            {estoque.bitola && <p className="text-sm text-ink-soft">{estoque.bitola}</p>}
          </div>
          <Badge color={estoque.cor}>{estoque.categoria_nome}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-card-alt border border-line">
            <p className="text-xs text-ink-soft mb-1">Painel</p>
            <p className="text-sm font-medium text-ink">{estoque.categoria_nome}</p>
          </div>
          <div className="p-3 rounded-lg bg-card-alt border border-line">
            <p className="text-xs text-ink-soft mb-1">Tipo de Controle</p>
            <InventoryTypeBadge type={estoque.inventory_type} />
          </div>
          <div className="p-3 rounded-lg bg-card-alt border border-line">
            <p className="text-xs text-ink-soft mb-1">Estoque Inicial</p>
            <p className="text-sm font-medium text-ink">{formatNumber(estoqueInicial)} {isUnit ? estoque.unidade_medida : 'un'}</p>
          </div>
          <div className="p-3 rounded-lg bg-card-alt border border-line">
            <p className="text-xs text-ink-soft mb-1">Estoque Atual</p>
            <p className="text-sm font-bold text-ink">{formatNumber(estoque.total_unidades)} {isUnit ? estoque.unidade_medida : 'un'}</p>
          </div>
        </div>

        {/* Stock bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-ink-soft mb-1.5">
            <span>Nível de estoque</span>
            <span>{formatNumber(estoque.total_unidades)} {isUnit ? estoque.unidade_medida : 'un'}</span>
          </div>
          <div className="h-3 rounded-full bg-card-alt overflow-hidden border border-line">
            <div
              className={`h-full rounded-full transition-all ${
                estoque.total_unidades === 0 ? 'bg-rose-500' : estoque.total_unidades < 50 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(2, (estoque.total_unidades / Math.max(estoqueInicial, 1)) * 100))}%` }}
            />
          </div>
        </div>

        {/* Comprar status */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-ink-soft">Para comprar:</span>
          {estoque.comprar ? (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">Sim</span>
          ) : (
            <span className="text-ink-muted">Não</span>
          )}
        </div>

        {/* History */}
        <div>
          <h4 className="text-sm font-semibold text-ink mb-2">Histórico do Material</h4>
          {history.length === 0 ? (
            <p className="text-sm text-ink-soft italic">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {history.slice(0, 20).map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-card-alt">
                  <span className="text-xs text-ink-muted shrink-0 w-20">{formatDate(h.date)}</span>
                  <span className={`text-xs font-medium shrink-0 ${h.type === 'Ajuste' ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {h.type}
                  </span>
                  <span className="text-ink flex-1 truncate">{h.detail}{h.obs ? ` — ${h.obs}` : ''}</span>
                  <span className="text-ink-soft text-xs shrink-0">{formatNumber(h.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ====== Ajuste Modal ======
function AjusteModal({ estoque, onSaved, onClose }: {
  estoque: EstoqueRow;
  onSaved: () => void;
  onClose: () => void;
}) {
  const isUnit = estoque.inventory_type === 'UNIT';
  const unidade = isUnit ? estoque.unidade_medida : 'un';
  const saldoAtual = estoque.total_unidades;
  const [quantidade, setQuantidade] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const novoSaldo = saldoAtual + quantidade;

  const handleSave = async () => {
    if (quantidade === 0) { showToast('A quantidade do ajuste não pode ser zero', 'error'); return; }
    if (!motivo.trim()) { showToast('Informe o motivo do ajuste', 'error'); return; }
    if (novoSaldo < 0) { showToast('O novo saldo não pode ser negativo', 'error'); return; }

    setSaving(true);
    const { error } = await supabase.from('ajustes').insert({
      material_id: estoque.material_id,
      categoria_id: estoque.categoria_id,
      quantidade_ajuste: quantidade,
      saldo_anterior: saldoAtual,
      novo_saldo: novoSaldo,
      motivo: motivo.trim(),
    });
    if (error) { showToast('Erro ao registrar ajuste', 'error'); setSaving(false); return; }

    await logAction('Ajuste de estoque', 'AJUSTE', estoque.material_nome, `Ajuste: ${quantidade > 0 ? '+' : ''}${quantidade} — Motivo: ${motivo.trim()}`);
    showToast('Ajuste registrado');
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Ajustar Estoque" maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-card-alt border border-line">
          <p className="text-sm font-medium text-ink">{estoque.material_nome}{estoque.bitola ? ` · ${estoque.bitola}` : ''}</p>
          <p className="text-xs text-ink-soft">{estoque.categoria_nome}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-card-alt border border-line">
            <p className="text-xs text-ink-soft mb-1">Estoque Atual</p>
            <p className="text-lg font-bold text-ink">{formatNumber(saldoAtual)}</p>
            <p className="text-xs text-ink-muted">{unidade}</p>
          </div>
          <div className="p-3 rounded-lg bg-card-alt border border-line">
            <p className="text-xs text-ink-soft mb-1">Ajuste</p>
            <p className={`text-lg font-bold ${quantidade > 0 ? 'text-emerald-500' : quantidade < 0 ? 'text-rose-500' : 'text-ink'}`}>
              {quantidade > 0 ? '+' : ''}{formatNumber(quantidade)}
            </p>
            <p className="text-xs text-ink-muted">{unidade}</p>
          </div>
          <div className="p-3 rounded-lg bg-card-alt border border-line">
            <p className="text-xs text-ink-soft mb-1">Novo Saldo</p>
            <p className="text-lg font-bold text-ink">{formatNumber(novoSaldo)}</p>
            <p className="text-xs text-ink-muted">{unidade}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Quantidade do Ajuste</label>
          <div className="flex gap-2">
            <button
              onClick={() => setQuantidade((q) => q - 1)}
              className="px-3 py-2.5 rounded-lg border border-line bg-input text-ink-soft hover:bg-card-alt transition-colors font-bold"
            >
              −
            </button>
            <input
              type="number"
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            />
            <button
              onClick={() => setQuantidade((q) => q + 1)}
              className="px-3 py-2.5 rounded-lg border border-line bg-input text-ink-soft hover:bg-card-alt transition-colors font-bold"
            >
              +
            </button>
          </div>
          <p className="text-xs text-ink-soft mt-1">Use negativo para reduzir, positivo para aumentar.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Motivo</label>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Conferência física"
            className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || quantidade === 0 || !motivo.trim() || novoSaldo < 0}
            className="flex-1 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Salvando...' : 'Confirmar Ajuste'}
          </button>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </Modal>
  );
}

// ====== Material Modal (create/edit) ======
function MaterialModal({ material, categorias, onSave, onClose }: {
  material: Material | null;
  categorias: Categoria[];
  onSave: (data: { nome: string; bitola: string; categoria_id: string; ini10: number; ini50: number; estoque_inicial: number; unidade_medida: string }) => void;
  onClose: () => void;
}) {
  const [nome, setNome] = useState(material?.nome ?? '');
  const [bitola, setBitola] = useState(material?.bitola ?? '');
  const [categoria_id, setCategoriaId] = useState(material?.categoria_id ?? categorias[0]?.id ?? '');
  const [ini10, setIni10] = useState(material?.ini10 ?? 0);
  const [ini50, setIni50] = useState(material?.ini50 ?? 0);
  const [estoque_inicial, setEstoqueInicial] = useState(material?.estoque_inicial ?? 0);
  const [unidade_medida, setUnidadeMedida] = useState(material?.unidade_medida ?? 'peças');

  const selectedCat = categorias.find((c) => c.id === categoria_id);
  const isUnit = selectedCat?.inventory_type === 'UNIT';

  return (
    <Modal open onClose={onClose} title={material ? 'Editar Material' : 'Novo Material'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Nome do Material</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Chumbador, Porca, Registro..."
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Bitola / Medida (opcional)</label>
          <input
            type="text"
            value={bitola}
            onChange={(e) => setBitola(e.target.value)}
            placeholder="Ex: 1/4, 3/8, 50mm..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Painel</label>
          <select
            value={categoria_id}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} ({c.inventory_type === 'UNIT' ? 'Unitário' : 'Pacotes'})</option>
            ))}
          </select>
        </div>

        {isUnit ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Estoque Inicial</label>
              <input
                type="number"
                min={0}
                value={estoque_inicial}
                onChange={(e) => setEstoqueInicial(Math.max(0, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Unidade de Medida</label>
              <select
                value={unidade_medida}
                onChange={(e) => setUnidadeMedida(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option value="peças">peças</option>
                <option value="unidades">unidades</option>
                <option value="metros">metros</option>
                <option value="kg">kg</option>
                <option value="litros">litros</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Estoque Inicial (pac. 10)</label>
              <input
                type="number"
                min={0}
                value={ini10}
                onChange={(e) => setIni10(Math.max(0, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Estoque Inicial (pac. 50)</label>
              <input
                type="number"
                min={0}
                value={ini50}
                onChange={(e) => setIni50(Math.max(0, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => nome.trim() && categoria_id && onSave({ nome: nome.trim(), bitola: bitola.trim(), categoria_id, ini10, ini50, estoque_inicial, unidade_medida })}
            disabled={!nome.trim() || !categoria_id}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}
