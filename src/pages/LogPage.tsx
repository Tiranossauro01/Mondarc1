import { useEffect, useState, useMemo } from 'react';
import { ScrollText, Search, Trash2, Package, Boxes, User } from 'lucide-react';
import { supabase, logAction, type LogAlteracao, type Material } from '@/lib/supabase';
import { LoadingSpinner, EmptyState, Toast } from '@/components/UI';
import { formatDateTime, formatNumber } from '@/lib/utils';

const TIPO_COLORS: Record<string, string> = {
  SAIDA: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/30',
  AJUSTE: 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-950/30',
  PAINEL: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/30',
  MATERIAL: 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950/30',
  COMPRA: 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/30',
  DATA: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
  CONFIG: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/30',
  BACKUP: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/30',
};

export function LogPage() {
  const [logs, setLogs] = useState<LogAlteracao[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    const [logRes, matRes] = await Promise.all([
      supabase.from('log_alteracoes').select('*').order('data_hora', { ascending: false }).limit(300),
      supabase.from('materiais').select('*'),
    ]);
    if (logRes.data) setLogs(logRes.data);
    if (matRes.data) setMateriais(matRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const matMap = useMemo(() => new Map(materiais.map((m) => [m.id, m])), [materiais]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const matchSearch = !search ||
        l.acao.toLowerCase().includes(search.toLowerCase()) ||
        l.item_afetado.toLowerCase().includes(search.toLowerCase()) ||
        l.detalhe.toLowerCase().includes(search.toLowerCase());
      const matchTipo = filterTipo === 'all' || l.tipo_acao === filterTipo;
      const matchUnit = filterUnit === 'all' || l.unit_type === filterUnit;
      return matchSearch && matchTipo && matchUnit;
    });
  }, [logs, search, filterTipo, filterUnit]);

  const tipos = ['SAIDA', 'AJUSTE', 'PAINEL', 'MATERIAL', 'COMPRA', 'DATA', 'CONFIG', 'BACKUP'];

  const handleClearLog = async () => {
    const { error } = await supabase.from('log_alteracoes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { showToast('Erro ao limpar registro', 'error'); return; }
    await logAction('Registro de alterações limpo', 'CONFIG', '', '');
    showToast('Registro limpo');
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="bg-card rounded-2xl border border-line p-5">
        <div className="flex items-center gap-2 mb-2">
          <ScrollText size={20} className="text-ink-soft" />
          <h3 className="font-semibold text-ink">Registro de Alterações</h3>
        </div>
        <p className="text-sm text-ink-soft">
          Registro interno de todas as alterações feitas no estoque. Esta informação NÃO aparece nos relatórios.
          Serve apenas para administração e rastreabilidade. É completamente independente do Relatório do Período.
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-line overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              placeholder="Buscar no registro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          >
            <option value="all">Todos os tipos</option>
            {tipos.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="px-3 py-2 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          >
            <option value="all">Pacotes e Unidades</option>
            <option value="pacote">Pacotes</option>
            <option value="unidade">Unidades</option>
          </select>
          {logs.length > 0 && (
            <button
              onClick={handleClearLog}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-sm text-ink-soft hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-500 transition-colors"
            >
              <Trash2 size={16} /> Limpar
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<ScrollText size={28} />}
            title="Nenhuma alteração registrada"
            description="As ações realizadas no estoque aparecerão aqui automaticamente."
          />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-card-alt/50 sticky top-0">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Data/Hora</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Ação</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden sm:table-cell">Material</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden md:table-cell">Qtd.</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden md:table-cell">Unidade</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden lg:table-cell">Saldo Ant.</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden lg:table-cell">Novo Saldo</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden xl:table-cell">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((l) => {
                  const mat = l.material_id ? matMap.get(l.material_id) : null;
                  return (
                    <tr key={l.id} className="hover:bg-card-alt/50 transition-colors">
                      <td className="px-6 py-3 text-sm text-ink-soft whitespace-nowrap">{formatDateTime(l.data_hora)}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TIPO_COLORS[l.tipo_acao] ?? 'text-ink-soft bg-card-alt'}`}>
                          {l.tipo_acao}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-ink">{l.acao}</td>
                      <td className="px-6 py-3 text-sm text-ink-soft hidden sm:table-cell">
                        {mat?.nome ?? l.item_afetado ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-sm text-ink text-right hidden md:table-cell">
                        {l.quantidade != null ? formatNumber(l.quantidade) : '—'}
                      </td>
                      <td className="px-6 py-3 text-sm text-center hidden md:table-cell">
                        {l.unit_type ? (
                          <span className={`inline-flex items-center gap-1 text-xs ${l.unit_type === 'pacote' ? 'text-indigo-600 dark:text-indigo-400' : 'text-cyan-600 dark:text-cyan-400'}`}>
                            {l.unit_type === 'pacote' ? <Package size={12} /> : <Boxes size={12} />}
                            {l.unit_type}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-3 text-sm text-ink-soft text-right hidden lg:table-cell">
                        {l.saldo_anterior != null ? formatNumber(l.saldo_anterior) : '—'}
                      </td>
                      <td className="px-6 py-3 text-sm font-bold text-ink text-right hidden lg:table-cell">
                        {l.novo_saldo != null ? formatNumber(l.novo_saldo) : '—'}
                      </td>
                      <td className="px-6 py-3 text-sm text-ink-soft max-w-48 truncate hidden xl:table-cell">{l.detalhe || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
