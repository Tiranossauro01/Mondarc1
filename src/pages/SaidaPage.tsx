import { useEffect, useState, useMemo } from 'react';
import { MinusCircle, Search, Star } from 'lucide-react';
import { supabase, logAction, type EstoqueRow, type Categoria } from '@/lib/supabase';
import { Toast, EmptyState, LoadingSpinner, Badge } from '@/components/UI';
import { DatePicker } from '@/components/DatePicker';
import { formatNumber, todayISO } from '@/lib/utils';

export function SaidaPage() {
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [selectedMaterial, setSelectedMaterial] = useState<EstoqueRow | null>(null);
  const [tipoPacote, setTipoPacote] = useState<10 | 50>(10);
  const [qtdPacotes, setQtdPacotes] = useState(1);
  const [quantidade, setQuantidade] = useState(1);
  const [data, setData] = useState(todayISO());
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string>('all');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    const [estRes, catRes] = await Promise.all([
      supabase.from('vw_estoque').select('*').eq('ativo', true).order('material_nome'),
      supabase.from('categorias').select('*').order('ordem'),
    ]);
    if (estRes.data) setEstoque(estRes.data as unknown as EstoqueRow[]);
    if (catRes.data) setCategorias(catRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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

  const filtered = useMemo(() => {
    let result = estoque;
    if (activeCategory !== 'all') {
      result = result.filter((e) => e.categoria_id === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.material_nome.toLowerCase().includes(q) ||
        e.bitola.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
      return a.material_nome.localeCompare(b.material_nome);
    });
  }, [estoque, activeCategory, search]);

  const isUnit = selectedMaterial?.inventory_type === 'UNIT';
  const totalUnidades = isUnit ? quantidade : tipoPacote * qtdPacotes;
  const saldoDisponivel = isUnit
    ? selectedMaterial?.saldo_unit ?? 0
    : (tipoPacote === 10 ? selectedMaterial?.saldo10 ?? 0 : selectedMaterial?.saldo50 ?? 0);
  const saldoInsuficiente = selectedMaterial && (
    isUnit ? quantidade > saldoDisponivel : qtdPacotes > saldoDisponivel
  );

  const handleSaida = async () => {
    if (!selectedMaterial) return;

    if (isUnit) {
      if (quantidade <= 0 || !Number.isInteger(quantidade)) {
        showToast('Quantidade deve ser um número inteiro positivo', 'error');
        return;
      }
      if (quantidade > saldoDisponivel) {
        showToast(`Estoque insuficiente. Disponível: ${formatNumber(saldoDisponivel)} ${selectedMaterial.unidade_medida}. Solicitado: ${formatNumber(quantidade)}.`, 'error');
        return;
      }
    } else {
      if (qtdPacotes <= 0) return;
      if (qtdPacotes > saldoDisponivel) {
        showToast(`Estoque insuficiente. Disponível: ${formatNumber(saldoDisponivel)} pacotes de ${tipoPacote}. Solicitado: ${formatNumber(qtdPacotes)}.`, 'error');
        return;
      }
    }

    setSaving(true);
    const insertData: Record<string, unknown> = {
      material_id: selectedMaterial.material_id,
      categoria_id: selectedMaterial.categoria_id,
      data,
      obs: obs.trim(),
      inventory_type: selectedMaterial.inventory_type,
      total_unidades: totalUnidades,
    };

    if (isUnit) {
      insertData.quantidade = quantidade;
      insertData.tipo_pacote = 10;
      insertData.qtd_pacotes = 0;
    } else {
      insertData.tipo_pacote = tipoPacote;
      insertData.qtd_pacotes = qtdPacotes;
      insertData.quantidade = 0;
    }

    const { error } = await supabase.from('saidas').insert(insertData);
    setSaving(false);

    if (error) { showToast('Erro ao registrar saída', 'error'); return; }
    await logAction('Saída registrada', 'SAIDA', selectedMaterial.material_nome, `${formatNumber(totalUnidades)} unidades`);
    showToast('Saída registrada');
    setSelectedMaterial(null);
    setTipoPacote(10);
    setQtdPacotes(1);
    setQuantidade(1);
    setData(todayISO());
    setObs('');
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="bg-card rounded-2xl border border-line overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-center gap-2">
          <MinusCircle size={20} className="text-amber-500" />
          <h3 className="font-semibold text-ink">Registrar Saída de Material</h3>
        </div>

        {estoque.length === 0 ? (
          <EmptyState
            icon={<MinusCircle size={28} />}
            title="Nenhum material disponível"
            description="Cadastre materiais com estoque inicial antes de registrar saídas."
          />
        ) : (
          <div className="p-6">
            {/* Category tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === 'all' ? 'bg-amber-500 text-white' : 'bg-card-alt text-ink-soft hover:text-ink border border-line'}`}
              >
                Todos
              </button>
              {categorias.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${activeCategory === c.id ? 'bg-amber-500 text-white' : 'bg-card-alt text-ink-soft hover:text-ink border border-line'}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.cor }} />
                  {c.nome}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                placeholder="Buscar material..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
            </div>

            {/* Material grid */}
            {filtered.length === 0 ? (
              <EmptyState icon={<Search size={28} />} title="Nenhum material encontrado" description="Ajuste a busca ou selecione outra categoria." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                {filtered.map((e) => (
                  <div
                    key={e.material_id}
                    className={`text-left p-4 rounded-xl border transition-all relative ${selectedMaterial?.material_id === e.material_id ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20 ring-2 ring-amber-500/20' : 'border-line hover:border-ink-soft/30 hover:shadow-sm'}`}
                  >
                    <button
                      onClick={() => {
                        setSelectedMaterial(e);
                        setTipoPacote(10);
                        setQtdPacotes(1);
                        setQuantidade(1);
                      }}
                      className="text-left w-full pr-8"
                    >
                      <p className="text-sm font-semibold text-ink truncate flex items-center gap-1">
                        {e.favorito && <Star size={14} className="text-amber-400 fill-amber-400 shrink-0" />}
                        {e.material_nome}
                      </p>
                      {e.bitola && <p className="text-xs text-ink-soft mb-1">{e.bitola}</p>}
                      <Badge color={e.cor}>{e.categoria_nome}</Badge>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-ink-soft">Saldo:</span>
                        <span className="font-bold text-ink">
                          {e.inventory_type === 'UNIT'
                            ? `${formatNumber(e.saldo_unit)} ${e.unidade_medida}`
                            : `${formatNumber(e.saldo10)} p10 / ${formatNumber(e.saldo50)} p50`
                          }
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={() => toggleFavorito(e)}
                      className={`absolute top-3 right-3 p-1 rounded transition-colors ${e.favorito ? 'text-amber-400' : 'text-ink-muted hover:text-amber-400'}`}
                      title={e.favorito ? 'Remover favorito' : 'Marcar como favorito'}
                    >
                      <Star size={16} className={e.favorito ? 'fill-amber-400' : ''} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedMaterial && (
              <div className="mt-6 p-5 rounded-xl bg-card-alt border border-line animate-slide-up">
                <h4 className="font-semibold text-ink mb-1">
                  Saída: <span className="text-ink">{selectedMaterial.material_nome}</span>
                  {selectedMaterial.bitola && <span className="text-ink-soft"> · {selectedMaterial.bitola}</span>}
                </h4>
                <p className="text-xs text-ink-soft mb-4">
                  {selectedMaterial.categoria_nome} · {isUnit ? 'Controle Unitário' : 'Controle por Pacotes'}
                </p>

                {isUnit ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">Quantidade de {selectedMaterial.unidade_medida}</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={quantidade}
                        onChange={(e) => setQuantidade(Math.max(1, Math.floor(Number(e.target.value))))}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <DatePicker value={data} onChange={setData} label="Data" id="saida-data-unit" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">Tipo de Pacote</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setTipoPacote(10)}
                          className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${tipoPacote === 10 ? 'border-amber-400 bg-amber-500 text-white' : 'border-line bg-input text-ink-soft hover:border-ink-soft/30'}`}
                        >10 un</button>
                        <button
                          onClick={() => setTipoPacote(50)}
                          className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${tipoPacote === 50 ? 'border-amber-400 bg-amber-500 text-white' : 'border-line bg-input text-ink-soft hover:border-ink-soft/30'}`}
                        >50 un</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">Qtd. de Pacotes</label>
                      <input
                        type="number"
                        min={1}
                        value={qtdPacotes}
                        onChange={(e) => setQtdPacotes(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <DatePicker value={data} onChange={setData} label="Data" id="saida-data-pkg" />
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <label className="block text-sm font-medium text-ink mb-1.5">Observação (opcional)</label>
                  <input
                    type="text"
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Ex: obra tal, retirado por fulano..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                  />
                </div>

                <div className="mt-4 p-3 rounded-lg bg-surface border border-line flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-ink-soft">Total: </span>
                    <span className="font-bold text-ink">
                      {isUnit ? `${formatNumber(quantidade)} ${selectedMaterial.unidade_medida}` : `${formatNumber(qtdPacotes)} × ${tipoPacote} = ${formatNumber(totalUnidades)} unidades`}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-ink-soft">Disponível: </span>
                    <span className={`font-bold ${saldoInsuficiente ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {formatNumber(saldoDisponivel)} {isUnit ? selectedMaterial.unidade_medida : 'pacotes'}
                    </span>
                  </div>
                </div>

                {saldoInsuficiente && (
                  <div className="mt-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
                    Estoque insuficiente. Saldo disponível: {formatNumber(saldoDisponivel)} {isUnit ? selectedMaterial.unidade_medida : `pacotes de ${tipoPacote}`}. Solicitado: {formatNumber(isUnit ? quantidade : qtdPacotes)}.
                  </div>
                )}

                <div className="flex gap-3 mt-5">
                  <button onClick={() => setSelectedMaterial(null)} className="px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card transition-colors">Cancelar</button>
                  <button
                    onClick={handleSaida}
                    disabled={saving || !!saldoInsuficiente}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <MinusCircle size={18} />
                    {saving ? 'Registrando...' : 'Confirmar Saída'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
