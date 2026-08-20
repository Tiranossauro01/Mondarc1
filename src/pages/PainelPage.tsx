import { useEffect, useState, useMemo } from 'react';
import {
  Package, Boxes, MinusCircle, ShoppingCart, AlertTriangle, TrendingUp,
  Search, ChevronRight, Undo2, Plus, Clock, Star,
} from 'lucide-react';
import { supabase, logAction, type EstoqueRow, type Saida, type Categoria } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { DatePicker } from '@/components/DatePicker';
import { LoadingSpinner, EmptyState, Badge, Toast } from '@/components/UI';
import { formatNumber, formatDateTime, formatDate, todayISO } from '@/lib/utils';
import type { PageKey } from '@/components/Layout';

export function PainelPage({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; undoId?: string } | null>(null);

  // Quick saída modal state
  const [quickSaidaOpen, setQuickSaidaOpen] = useState(false);
  const [qsPanel, setQsPanel] = useState<string>('all');
  const [qsMaterial, setQsMaterial] = useState<string>('');
  const [qsSearch, setQsSearch] = useState('');
  const [qsDate, setQsDate] = useState(todayISO());
  const [qsTipoPacote, setQsTipoPacote] = useState<10 | 50>(10);
  const [qsQtdPacotes, setQsQtdPacotes] = useState(1);
  const [qsQuantidade, setQsQuantidade] = useState(1);
  const [qsObs, setQsObs] = useState('');
  const [qsSaving, setQsSaving] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success', undoId?: string) => {
    setToast({ message, type, undoId });
    setTimeout(() => setToast(null), 5000);
  };

  const load = async () => {
    setLoading(true);
    const [estRes, saidasRes, catRes] = await Promise.all([
      supabase.from('vw_estoque').select('*').eq('ativo', true),
      supabase.from('saidas').select('*').order('data', { ascending: false }).order('created_at', { ascending: false }).limit(10),
      supabase.from('categorias').select('*').order('ordem'),
    ]);
    if (estRes.data) setEstoque(estRes.data as unknown as EstoqueRow[]);
    if (saidasRes.data) setSaidas(saidasRes.data);
    if (catRes.data) setCategorias(catRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalMateriais = estoque.length;
  const totalUnidades = estoque.reduce((s, e) => s + e.total_unidades, 0);
  const totalSaidas = saidas.length;
  const itensComprar = estoque.filter((e) => e.comprar).length;

  const panelMap = new Map<string, { nome: string; cor: string; unidades: number; count: number }>();
  estoque.forEach((e) => {
    const existing = panelMap.get(e.categoria_id) ?? { nome: e.categoria_nome, cor: e.cor, unidades: 0, count: 0 };
    existing.unidades += e.total_unidades;
    existing.count += 1;
    panelMap.set(e.categoria_id, existing);
  });
  const panels = Array.from(panelMap.values()).sort((a, b) => b.unidades - a.unidades);

  const matMap = new Map(estoque.map((e) => [e.material_id, e]));

  const cards = [
    { label: 'Materiais Cadastrados', value: formatNumber(totalMateriais), icon: <Package size={22} />, color: 'blue', page: 'material' as PageKey },
    { label: 'Unidades em Estoque', value: formatNumber(totalUnidades), icon: <Boxes size={22} />, color: 'emerald', page: 'estoque' as PageKey },
    { label: 'Saídas Recentes', value: formatNumber(totalSaidas), icon: <MinusCircle size={22} />, color: 'amber', page: 'historico' as PageKey },
    { label: 'Itens para Comprar', value: formatNumber(itensComprar), icon: <ShoppingCart size={22} />, color: 'rose', page: 'compra' as PageKey },
  ];

  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/20',
    amber: 'from-amber-500 to-amber-600 shadow-amber-500/20',
    rose: 'from-rose-500 to-rose-600 shadow-rose-500/20',
  };

  const hasData = totalMateriais > 0;

  const toggleFavorito = async (mat: EstoqueRow) => {
    const newFav = !mat.favorito;
    setEstoque((prev) => prev.map((e) => e.material_id === mat.material_id ? { ...e, favorito: newFav } : e));
    const { error } = await supabase.from('materiais').update({ favorito: newFav }).eq('id', mat.material_id);
    if (error) {
      setEstoque((prev) => prev.map((e) => e.material_id === mat.material_id ? { ...e, favorito: !newFav } : e));
      showToast('Erro ao atualizar favorito', 'error');
      return;
    }
    await logAction(newFav ? 'Material marcado como favorito' : 'Material removido dos favoritos', 'MATERIAL', mat.material_nome, '');
  };

  // Quick saída helpers
  const qsMateriais = useMemo(() => {
    let result = estoque;
    if (qsPanel !== 'all') result = result.filter((e) => e.categoria_id === qsPanel);
    if (qsSearch.trim()) {
      const q = qsSearch.toLowerCase();
      result = result.filter((e) => e.material_nome.toLowerCase().includes(q) || e.bitola.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
      return a.material_nome.localeCompare(b.material_nome);
    });
  }, [estoque, qsPanel, qsSearch]);
  const qsSelectedMat = estoque.find((e) => e.material_id === qsMaterial);
  const qsIsUnit = qsSelectedMat?.inventory_type === 'UNIT';
  const qsTotalUnidades = qsIsUnit ? qsQuantidade : qsTipoPacote * qsQtdPacotes;
  const qsSaldoDisp = qsIsUnit
    ? qsSelectedMat?.saldo_unit ?? 0
    : (qsTipoPacote === 10 ? qsSelectedMat?.saldo10 ?? 0 : qsSelectedMat?.saldo50 ?? 0);
  const qsSaldoInsuf = qsSelectedMat && (qsIsUnit ? qsQuantidade > qsSaldoDisp : qsQtdPacotes > qsSaldoDisp);

  if (loading) return <LoadingSpinner />;

  const handleQuickSaida = async () => {
    if (!qsSelectedMat) return;

    setQsSaving(true);
    const insertData: Record<string, unknown> = {
      material_id: qsSelectedMat.material_id,
      categoria_id: qsSelectedMat.categoria_id,
      data: qsDate,
      obs: qsObs.trim(),
      inventory_type: qsSelectedMat.inventory_type,
      total_unidades: qsTotalUnidades,
    };

    if (qsIsUnit) {
      insertData.quantidade = qsQuantidade;
      insertData.tipo_pacote = 10;
      insertData.qtd_pacotes = 0;
    } else {
      insertData.tipo_pacote = qsTipoPacote;
      insertData.qtd_pacotes = qsQtdPacotes;
      insertData.quantidade = 0;
    }

    const { data, error } = await supabase.from('saidas').insert(insertData).select('id').single();
    setQsSaving(false);

    if (error) { showToast('Erro ao registrar saída', 'error'); return; }

    await logAction('Saída registrada', 'SAIDA', qsSelectedMat.material_nome, `${formatNumber(qsTotalUnidades)} unidades`);
    showToast('Saída registrada', 'success', data?.id);

    setQuickSaidaOpen(false);
    setQsPanel('all'); setQsMaterial(''); setQsSearch(''); setQsDate(todayISO());
    setQsTipoPacote(10); setQsQtdPacotes(1); setQsQuantidade(1); setQsObs('');
    load();
  };

  const handleUndo = async () => {
    if (!toast?.undoId) return;
    const { error } = await supabase.from('saidas').delete().eq('id', toast.undoId);
    if (error) { showToast('Erro ao desfazer saída', 'error'); return; }
    await logAction('Saída desfeita', 'SAIDA', '', `ID: ${toast.undoId}`);
    showToast('Saída desfeita. Estoque restaurado.', 'success');
    setToast(null);
    load();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Quick actions bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => setQuickSaidaOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
        >
          <Plus size={20} /> Registrar Saída
        </button>
        <button
          onClick={() => onNavigate('material')}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-card border border-line text-ink text-sm font-medium hover:bg-card-alt transition-colors"
        >
          <Package size={20} /> Materiais
        </button>
        {itensComprar > 0 && (
          <button
            onClick={() => onNavigate('compra')}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
          >
            <ShoppingCart size={20} /> {itensComprar} {itensComprar === 1 ? 'item para comprar' : 'itens para comprar'}
          </button>
        )}
      </div>

      {!hasData ? (
        <EmptyState
          icon={<Package size={28} />}
          title="Nenhum material cadastrado ainda"
          description="Comece cadastrando materiais nos painéis para controlar o estoque."
          action={
            <button
              onClick={() => onNavigate('material')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors"
            >
              + Adicionar material
            </button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {cards.map((card) => (
              <button
                key={card.label}
                onClick={() => onNavigate(card.page)}
                className="bg-card rounded-2xl border border-line p-5 text-left hover:shadow-lg hover:border-ink-soft/30 transition-all duration-200 group"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colorMap[card.color]} flex items-center justify-center text-white shadow-lg mb-3`}>
                  {card.icon}
                </div>
                <p className="text-2xl font-bold text-ink mb-0.5">{card.value}</p>
                <p className="text-sm text-ink-soft">{card.label}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel summaries */}
            <div className="lg:col-span-1 bg-card rounded-2xl border border-line overflow-hidden">
              <div className="px-6 py-4 border-b border-line">
                <h3 className="font-semibold text-ink">Resumo por Painel</h3>
              </div>
              <div className="divide-y divide-line">
                {panels.map((p) => (
                  <div key={p.nome} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
                      <div>
                        <p className="text-sm font-semibold text-ink">{p.nome}</p>
                        <p className="text-xs text-ink-soft">{p.count} {p.count === 1 ? 'material' : 'materiais'}</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-ink">{formatNumber(p.unidades)} <span className="text-xs font-normal text-ink-soft">un</span></p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent movements */}
            <div className="lg:col-span-2 bg-card rounded-2xl border border-line overflow-hidden">
              <div className="px-6 py-4 border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-ink-soft" />
                  <h3 className="font-semibold text-ink">Últimas Movimentações</h3>
                </div>
                <button onClick={() => onNavigate('historico')} className="text-sm text-accent hover:underline font-medium">
                  Ver tudo
                </button>
              </div>
              {saidas.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp size={28} />}
                  title="Nenhuma saída registrada"
                  description="As saídas registradas aparecerão aqui."
                />
              ) : (
                <div className="divide-y divide-line">
                  {saidas.map((s) => {
                    const mat = matMap.get(s.material_id);
                    const isUnit = s.inventory_type === 'UNIT';
                    return (
                      <div key={s.id} className="px-6 py-3.5 flex items-center gap-3 hover:bg-card-alt/50 transition-colors">
                        <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <MinusCircle size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {mat?.material_nome ?? 'Material'}{mat?.bitola ? ` · ${mat.bitola}` : ''}
                          </p>
                          <p className="text-xs text-ink-soft">
                            {formatDate(s.data)} · {mat?.categoria_nome ?? ''}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                          -{formatNumber(s.total_unidades)} {isUnit ? (mat?.unidade_medida ?? 'peças') : 'un'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Quick Saída Modal */}
      {quickSaidaOpen && (
        <Modal open onClose={() => setQuickSaidaOpen(false)} title="Registrar Saída Rápida" maxWidth="max-w-lg">
          <div className="space-y-4">
            {/* Category tabs */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setQsPanel('all'); setQsMaterial(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${qsPanel === 'all' ? 'bg-amber-500 text-white' : 'bg-card-alt text-ink-soft hover:text-ink border border-line'}`}
              >Todos</button>
              {categorias.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setQsPanel(c.id); setQsMaterial(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${qsPanel === c.id ? 'bg-amber-500 text-white' : 'bg-card-alt text-ink-soft hover:text-ink border border-line'}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.cor }} />
                  {c.nome}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                placeholder="Buscar material..."
                value={qsSearch}
                onChange={(e) => { setQsSearch(e.target.value); setQsMaterial(''); }}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
            </div>

            {/* Material grid */}
            {qsMateriais.length === 0 ? (
              <p className="text-sm text-ink-soft text-center py-6">Nenhum material encontrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                {qsMateriais.map((e) => (
                  <div
                    key={e.material_id}
                    className={`text-left p-3 rounded-lg border transition-all relative ${qsMaterial === e.material_id ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20 ring-2 ring-amber-500/20' : 'border-line hover:border-ink-soft/30'}`}
                  >
                    <button
                      onClick={() => { setQsMaterial(e.material_id); setQsTipoPacote(10); setQsQtdPacotes(1); setQsQuantidade(1); }}
                      className="text-left w-full pr-7"
                    >
                      <p className="text-sm font-semibold text-ink truncate flex items-center gap-1">
                        {e.favorito && <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />}
                        {e.material_nome}
                      </p>
                      {e.bitola && <p className="text-xs text-ink-soft">{e.bitola}</p>}
                      <p className="text-xs text-ink-soft mt-0.5">
                        {e.inventory_type === 'UNIT'
                          ? `${formatNumber(e.saldo_unit)} ${e.unidade_medida}`
                          : `${formatNumber(e.saldo10)} p10 / ${formatNumber(e.saldo50)} p50`
                        }
                      </p>
                    </button>
                    <button
                      onClick={() => toggleFavorito(e)}
                      className={`absolute top-2 right-2 p-0.5 rounded transition-colors ${e.favorito ? 'text-amber-400' : 'text-ink-muted hover:text-amber-400'}`}
                    >
                      <Star size={14} className={e.favorito ? 'fill-amber-400' : ''} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {qsSelectedMat && (
              <>
                <DatePicker value={qsDate} onChange={setQsDate} label="Data" id="qs-date" />

                {qsIsUnit ? (
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1.5">Quantidade de {qsSelectedMat.unidade_medida}</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={qsQuantidade}
                      onChange={(e) => setQsQuantidade(Math.max(1, Math.floor(Number(e.target.value))))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">Tipo de Pacote</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setQsTipoPacote(10)}
                          className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                            qsTipoPacote === 10 ? 'border-amber-400 bg-amber-500 text-white' : 'border-line bg-input text-ink-soft hover:border-ink-soft/30'
                          }`}
                        >10 un</button>
                        <button
                          onClick={() => setQsTipoPacote(50)}
                          className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                            qsTipoPacote === 50 ? 'border-amber-400 bg-amber-500 text-white' : 'border-line bg-input text-ink-soft hover:border-ink-soft/30'
                          }`}
                        >50 un</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">Qtd. de Pacotes</label>
                      <input
                        type="number"
                        min={1}
                        value={qsQtdPacotes}
                        onChange={(e) => setQsQtdPacotes(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">Observação (opcional)</label>
                  <input
                    type="text"
                    value={qsObs}
                    onChange={(e) => setQsObs(e.target.value)}
                    placeholder="Ex: obra tal, retirado por fulano..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                  />
                </div>

                <div className="p-3 rounded-lg bg-card-alt border border-line flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Total: </span>
                  <span className="font-bold text-ink">
                    {qsIsUnit
                      ? `${formatNumber(qsQuantidade)} ${qsSelectedMat.unidade_medida}`
                      : `${formatNumber(qsQtdPacotes)} × ${qsTipoPacote} = ${formatNumber(qsTotalUnidades)} unidades`
                    }
                  </span>
                </div>

                {qsSaldoInsuf && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-sm text-amber-700 dark:text-amber-300">
                    Quantidade maior que o estoque disponível. Atual: {formatNumber(qsSaldoDisp)}. Solicitado: {formatNumber(qsIsUnit ? qsQuantidade : qsQtdPacotes)}.
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setQuickSaidaOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleQuickSaida}
                disabled={qsSaving || !qsMaterial}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <MinusCircle size={18} />
                {qsSaving ? 'Registrando...' : 'Confirmar Saída'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} />
      )}
      {toast && toast.undoId && toast.type === 'success' && (
        <div className="fixed bottom-6 right-6 z-[60] animate-slide-up">
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border bg-surface-elevated border-line">
            <span className="text-sm font-medium text-ink">{toast.message}</span>
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-colors"
            >
              <Undo2 size={14} /> Desfazer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
