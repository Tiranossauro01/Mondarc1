import { useEffect, useState, useMemo } from 'react';
import { ShoppingCart, Plus, Trash2, Printer, ClipboardList, Image as ImageIcon } from 'lucide-react';
import { supabase, logAction, type EstoqueRow, type ListaCompra, type Categoria } from '@/lib/supabase';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Toast, EmptyState, LoadingSpinner, Badge } from '@/components/UI';
import { formatNumber } from '@/lib/utils';
import { printDocument, saveAsPNG, type ExportConfig, type ExportGroup } from '@/lib/export';

export function CompraPage() {
  const [listaCompras, setListaCompras] = useState<ListaCompra[]>([]);
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [listaModalOpen, setListaModalOpen] = useState(false);
  const [editingLista, setEditingLista] = useState<ListaCompra | null>(null);
  const [deleteLista, setDeleteLista] = useState<ListaCompra | null>(null);
  const [printLista, setPrintLista] = useState(false);
  const [pngLista, setPngLista] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    const [listRes, estRes, catRes] = await Promise.all([
      supabase.from('lista_compras').select('*').order('created_at', { ascending: false }),
      supabase.from('vw_estoque').select('*').eq('ativo', true),
      supabase.from('categorias').select('*').order('ordem'),
    ]);
    if (listRes.data) setListaCompras(listRes.data);
    if (estRes.data) setEstoque(estRes.data as unknown as EstoqueRow[]);
    if (catRes.data) setCategorias(catRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const handleDeleteLista = async (l: ListaCompra) => {
    const { error } = await supabase.from('lista_compras').delete().eq('id', l.id);
    if (error) { showToast('Erro ao excluir item', 'error'); return; }
    await logAction('Item da lista de compras excluído', 'COMPRA', l.nome_material, '');
    showToast('Item excluído');
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="bg-card rounded-2xl border border-line overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <ShoppingCart size={20} className="text-blue-500" />
            <div>
              <h3 className="font-semibold text-ink">Lista de Compras</h3>
              <p className="text-xs text-ink-soft mt-0.5">O que precisa ser comprado ou produzido</p>
            </div>
          </div>
          <button onClick={() => setPrintLista(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line text-sm text-ink-soft hover:bg-card-alt transition-colors">
            <Printer size={16} /> Imprimir
          </button>
          <button onClick={() => setPngLista(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line text-sm text-ink-soft hover:bg-card-alt transition-colors">
            <ImageIcon size={16} /> Salvar PNG
          </button>
          <button onClick={() => { setEditingLista(null); setListaModalOpen(true); }} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={16} /> Novo Item
          </button>
        </div>

        {listaCompras.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={28} />}
            title="Lista de compras vazia"
            description="Adicione itens que precisam ser comprados ou produzidos. A lista não altera o estoque — é apenas uma solicitação para o chefe."
            action={<button onClick={() => { setEditingLista(null); setListaModalOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">+ Adicionar item</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-card-alt/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Material</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Qtd. Necessária</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden md:table-cell">Origem</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden lg:table-cell">Observação</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {listaCompras.map((l) => {
                  const cat = l.categoria_id ? catMap.get(l.categoria_id) : null;
                  const origemLabel = l.origem === 'producao' ? 'Produção' : 'Compra';
                  return (
                    <tr key={l.id} className="hover:bg-card-alt/50 transition-colors group">
                      <td className="px-6 py-3.5 text-sm font-medium text-ink">
                        {l.nome_material}
                        {cat && <div className="mt-0.5"><Badge color={cat.cor}>{cat.nome}</Badge></div>}
                      </td>
                      <td className="px-6 py-3.5 text-sm font-bold text-ink text-right">{formatNumber(l.qtd_comprar)}</td>
                      <td className="px-6 py-3.5 text-sm text-center text-ink-soft hidden md:table-cell">{origemLabel}</td>
                      <td className="px-6 py-3.5 text-sm text-ink-soft max-w-48 truncate hidden lg:table-cell">{l.obs || '—'}</td>
                      <td className="px-6 py-3.5 text-right">
                        <button onClick={() => { setEditingLista(l); setListaModalOpen(true); }} className="p-1.5 rounded-lg text-ink-soft hover:bg-card-alt hover:text-ink text-xs mr-1">Editar</button>
                        <button onClick={() => setDeleteLista(l)} className="p-1.5 rounded-lg text-ink-soft hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-500 text-xs">Excluir</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {listaModalOpen && (
        <ListaModal
          lista={editingLista}
          estoque={estoque}
          onClose={() => { setListaModalOpen(false); setEditingLista(null); }}
          onSaved={() => { setListaModalOpen(false); setEditingLista(null); load(); showToast('Item salvo'); }}
        />
      )}

      {printLista && (
        <ExportListaComprasModal listaCompras={listaCompras} categorias={categorias} mode="print" onClose={() => setPrintLista(false)} />
      )}
      {pngLista && (
        <ExportListaComprasModal listaCompras={listaCompras} categorias={categorias} mode="png" onClose={() => setPngLista(false)} />
      )}

      <ConfirmModal
        open={!!deleteLista}
        onClose={() => setDeleteLista(null)}
        onConfirm={() => deleteLista && handleDeleteLista(deleteLista)}
        title="Excluir Item"
        message="Remover este item da lista de compras?"
        confirmLabel="Excluir"
      />

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

// ===== Lista Modal — only Material, Quantity, Origem, Observation =====
function ListaModal({ lista, estoque, onClose, onSaved }: {
  lista: ListaCompra | null;
  estoque: EstoqueRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [materialId, setMaterialId] = useState(lista?.material_id ?? '');
  const [nomeMaterial, setNomeMaterial] = useState(lista?.nome_material ?? '');
  const [qtdComprar, setQtdComprar] = useState(lista?.qtd_comprar ?? 1);
  const [origem, setOrigem] = useState<'compra' | 'producao'>(lista?.origem ?? 'compra');
  const [obs, setObs] = useState(lista?.obs ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!nomeMaterial.trim() && !materialId) { setError('Selecione um material ou digite o nome'); return; }
    if (qtdComprar <= 0 || !Number.isInteger(qtdComprar)) { setError('Quantidade inválida'); return; }

    setSaving(true);
    const mat = materialId ? estoque.find(e => e.material_id === materialId) : null;
    const data: Record<string, unknown> = {
      material_id: materialId || null,
      categoria_id: mat?.categoria_id ?? null,
      nome_material: mat?.material_nome ?? nomeMaterial.trim(),
      qtd_comprar: qtdComprar,
      origem,
      obs: obs.trim(),
      updated_at: new Date().toISOString(),
    };

    if (lista) {
      const { error: e } = await supabase.from('lista_compras').update(data).eq('id', lista.id);
      if (e) { setError('Erro ao atualizar'); setSaving(false); return; }
    } else {
      const { error: e } = await supabase.from('lista_compras').insert(data);
      if (e) { setError('Erro ao criar item'); setSaving(false); return; }
    }

    await logAction(lista ? 'Item da lista editado' : 'Item adicionado à lista de compras', 'COMPRA', mat?.material_nome ?? nomeMaterial, '');
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={lista ? 'Editar Item' : 'Novo Item da Lista'} maxWidth="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Material</label>
          <select
            value={materialId}
            onChange={(e) => {
              setMaterialId(e.target.value);
              const mat = estoque.find(m => m.material_id === e.target.value);
              if (mat) setNomeMaterial(mat.material_nome);
            }}
            className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Selecionar do estoque...</option>
            {estoque.map(e => (
              <option key={e.material_id} value={e.material_id}>{e.material_nome}{e.bitola ? ` · ${e.bitola}` : ''}</option>
            ))}
          </select>
          {!materialId && (
            <input type="text" value={nomeMaterial} onChange={(e) => setNomeMaterial(e.target.value)} placeholder="Ou digite o nome do material" className="w-full mt-2 px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Quantidade Necessária</label>
          <input type="number" min={1} step={1} value={qtdComprar} onChange={(e) => { const v = Number(e.target.value); if (Number.isInteger(v) && v >= 0) setQtdComprar(v); }} className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Origem</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setOrigem('compra')} className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${origem === 'compra' ? 'border-blue-400 bg-blue-500 text-white' : 'border-line bg-input text-ink-soft hover:border-ink-soft/30'}`}>Compra de Terceiro</button>
            <button onClick={() => setOrigem('producao')} className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${origem === 'producao' ? 'border-blue-400 bg-blue-500 text-white' : 'border-line bg-input text-ink-soft hover:border-ink-soft/30'}`}>Produção Interna</button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Observação (opcional)</label>
          <input type="text" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: reposição, obra tal..." className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>

        {error && <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ===== Export Lista de Compras — grouped by category, shared export system =====
function ExportListaComprasModal({ listaCompras, categorias, mode, onClose }: {
  listaCompras: ListaCompra[];
  categorias: Categoria[];
  mode: 'print' | 'png';
  onClose: () => void;
}) {
  const catMap = useMemo(() => new Map(categorias.map(c => [c.id, c])), [categorias]);

  const buildConfig = (): ExportConfig => {
    const today = new Date().toLocaleDateString('pt-BR');
    const subtitle = `Data: ${today} | Total de itens: ${listaCompras.length}`;

    // Group items by their real category
    const byCategory = new Map<string, ListaCompra[]>();
    for (const l of listaCompras) {
      const catId = l.categoria_id ?? 'sem-categoria';
      if (!byCategory.has(catId)) byCategory.set(catId, []);
      byCategory.get(catId)!.push(l);
    }

    // Build groups in categoria ordem
    const groups: ExportGroup[] = [];
    for (const cat of categorias) {
      const items = byCategory.get(cat.id);
      if (!items || items.length === 0) continue;
      groups.push({
        categoryName: cat.nome.toUpperCase(),
        table: {
          columns: [
            { header: 'Material' },
            { header: 'Quantidade', align: 'center' },
            { header: 'Observação' },
          ],
          rows: items.map(l => [
            l.nome_material,
            formatNumber(l.qtd_comprar),
            l.obs || '—',
          ]),
        },
      });
    }
    // Items without a category
    const noCat = byCategory.get('sem-categoria');
    if (noCat && noCat.length > 0) {
      groups.push({
        categoryName: 'SEM CATEGORIA',
        table: {
          columns: [
            { header: 'Material' },
            { header: 'Quantidade', align: 'center' },
            { header: 'Observação' },
          ],
          rows: noCat.map(l => [
            l.nome_material,
            formatNumber(l.qtd_comprar),
            l.obs || '—',
          ]),
        },
      });
    }

    return {
      title: 'Lista de Compras',
      subtitle,
      filename: 'MONDARC_Lista_de_Compras.png',
      groups: groups.length > 0 ? groups : [{
        categoryName: '',
        table: { columns: [{ header: 'Material' }, { header: 'Quantidade', align: 'center' }, { header: 'Observação' }], rows: [] },
      }],
      emptyMessage: 'Nenhum item na lista.',
    };
  };

  const handleExport = () => {
    const cfg = buildConfig();
    if (mode === 'print') {
      printDocument(cfg);
    } else {
      saveAsPNG(cfg);
    }
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={mode === 'print' ? 'Imprimir Lista de Compras' : 'Salvar Lista de Compras (PNG)'} maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          {mode === 'print'
            ? 'Será aberta a janela de impressão do navegador com a logo Mondarc e a lista agrupada por categoria.'
            : 'Será baixada uma imagem PNG com a logo Mondarc e a lista agrupada por categoria.'}
        </p>
        <div className="p-3 rounded-lg bg-card-alt border border-line text-sm text-ink-soft">{listaCompras.length} item(ns) na lista</div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors">Cancelar</button>
          <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            {mode === 'print' ? <><Printer size={16} /> Imprimir</> : <><ImageIcon size={16} /> Salvar PNG</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

