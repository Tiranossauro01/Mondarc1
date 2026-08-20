import { useEffect, useState, useMemo } from 'react';
import { FileBarChart, Download, TrendingDown, TrendingUp, ShoppingCart, Printer, Package, Boxes, Image as ImageIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase, type Saida, type Material, type Categoria, type EstoqueRow, type Compra, type Config, type ListaCompra } from '@/lib/supabase';
import { DatePicker } from '@/components/DatePicker';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, Toast } from '@/components/UI';
import { formatNumber, formatDate, formatDateTime, todayISO, daysAgoISO } from '@/lib/utils';
import { printDocument, saveAsPNG, type ExportConfig, type ExportGroup } from '@/lib/export';

type Tab = 'resumo' | 'estoque' | 'compras' | 'impressoes';

export function RelatorioPage() {
  const [tab, setTab] = useState<Tab>('resumo');
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [listaCompras, setListaCompras] = useState<ListaCompra[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [dataInicio, setDataInicio] = useState(daysAgoISO(15));
  const [dataFim, setDataFim] = useState(todayISO());

  // Print modals
  const [printEstoque, setPrintEstoque] = useState(false);
  const [printCompras, setPrintCompras] = useState(false);
  const [printResumo, setPrintResumo] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [saiRes, compRes, listRes, matRes, catRes, estRes, cfgRes] = await Promise.all([
        supabase.from('saidas').select('*'),
        supabase.from('compras').select('*').order('data', { ascending: false }),
        supabase.from('lista_compras').select('*').order('created_at', { ascending: false }),
        supabase.from('materiais').select('*'),
        supabase.from('categorias').select('*').order('ordem'),
        supabase.from('vw_estoque').select('*'),
        supabase.from('config').select('*').eq('id', 1).maybeSingle(),
      ]);
      if (saiRes.data) setSaidas(saiRes.data);
      if (compRes.data) setCompras(compRes.data);
      if (listRes.data) setListaCompras(listRes.data);
      if (matRes.data) setMateriais(matRes.data);
      if (catRes.data) setCategorias(catRes.data);
      if (estRes.data) setEstoque(estRes.data as unknown as EstoqueRow[]);
      if (cfgRes.data) setConfig(cfgRes.data as Config);
      setLoading(false);
    })();
  }, []);

  const matMap = useMemo(() => new Map(materiais.map((m) => [m.id, m])), [materiais]);
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const dateError = dataInicio && dataFim && dataInicio > dataFim;

  const saidasPeriodo = useMemo(() => saidas.filter(s => s.data >= dataInicio && s.data <= dataFim).sort((a, b) => a.data.localeCompare(b.data)), [saidas, dataInicio, dataFim]);
  const comprasPeriodo = useMemo(() => compras.filter(c => c.data >= dataInicio && c.data <= dataFim).sort((a, b) => a.data.localeCompare(b.data)), [compras, dataInicio, dataFim]);

  const stats = useMemo(() => {
    const totalSaidasUnidades = saidasPeriodo.reduce((s, sai) => s + sai.total_unidades, 0);
    const totalComprasUnidades = comprasPeriodo.reduce((s, c) => s + (c.tipo_embalagem === 'pacote' ? c.qtd_pacotes * c.tipo_pacote : c.qtd_unidades), 0);
    const totalMovimentado = totalSaidasUnidades + totalComprasUnidades;
    return {
      totalSaidasUnidades,
      totalComprasUnidades,
      totalMovimentado,
      numSaidas: saidasPeriodo.length,
      numCompras: comprasPeriodo.length,
    };
  }, [saidasPeriodo, comprasPeriodo]);

  // Combined movimentacoes table
  const movimentacoes = useMemo(() => {
    const saidasRows = saidasPeriodo.map(s => {
      const mat = matMap.get(s.material_id);
      return { data: s.data, tipo: 'Saída', material: mat?.nome ?? '—', quantidade: s.total_unidades };
    });
    const comprasRows = comprasPeriodo.map(c => {
      const mat = matMap.get(c.material_id);
      const total = c.tipo_embalagem === 'pacote' ? c.qtd_pacotes * c.tipo_pacote : c.qtd_unidades;
      return { data: c.data, tipo: 'Compra', material: mat?.nome ?? '—', quantidade: total };
    });
    return [...saidasRows, ...comprasRows].sort((a, b) => a.data.localeCompare(b.data));
  }, [saidasPeriodo, comprasPeriodo, matMap]);

  const handleExportExcel = () => {
    if (dateError) { showToast('Data inicial não pode ser maior que a data final', 'error'); return; }

    const wb = XLSX.utils.book_new();
    const resumoRows: (string | number)[][] = [
      ['MONDARC — Controle de Estoque'],
      [],
      ['Período', `${formatDate(dataInicio)} a ${formatDate(dataFim)}`],
      ['Data de Geração', formatDateTime(new Date().toISOString())],
      ['Responsável', config?.responsavel_nome ?? ''],
      [],
      ['RESUMO DO PERÍODO'],
      ['Entradas (Compras)', stats.totalComprasUnidades],
      ['Saídas', stats.totalSaidasUnidades],
      ['Total Movimentado', stats.totalMovimentado],
      ['Número de Saídas', stats.numSaidas],
      ['Número de Compras', stats.numCompras],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
    wsResumo['!cols'] = [{ wch: 36 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    // Movimentações
    const movRows: (string | number)[][] = [['Data', 'Tipo', 'Material', 'Quantidade']];
    movimentacoes.forEach(m => movRows.push([formatDate(m.data), m.tipo, m.material, m.quantidade]));
    const wsMov = XLSX.utils.aoa_to_sheet(movRows);
    wsMov['!cols'] = [12, 10, 28, 14];
    XLSX.utils.book_append_sheet(wb, wsMov, 'Movimentações');

    // Controle de Estoque
    const estRows: (string | number)[][] = [['Material', 'Bitola', 'Painel', 'Pacotes 10', 'Pacotes 50', 'Total Pacotes', 'Total Unidades']];
    estoque.filter(e => e.ativo).forEach(e => {
      const isUnit = e.inventory_type === 'UNIT';
      estRows.push([
        e.material_nome, e.bitola, e.categoria_nome,
        isUnit ? '' : e.saldo10,
        isUnit ? '' : e.saldo50,
        isUnit ? '' : e.saldo10 + e.saldo50,
        e.total_unidades,
      ]);
    });
    const wsEst = XLSX.utils.aoa_to_sheet(estRows);
    wsEst['!cols'] = [28, 10, 14, 12, 12, 14, 14];
    XLSX.utils.book_append_sheet(wb, wsEst, 'Controle de Estoque');

    // Compras
    const compRows: (string | number)[][] = [['Data', 'Material', 'Fornecedor', 'Nota', 'Pac. 10', 'Pac. 50', 'Unidades', 'Total Un.', 'Valor Total']];
    comprasPeriodo.forEach(c => {
      const mat = matMap.get(c.material_id);
      compRows.push([
        formatDate(c.data), mat?.nome ?? '', c.fornecedor, c.nota,
        c.tipo_embalagem === 'pacote' && c.tipo_pacote === 10 ? c.qtd_pacotes : '',
        c.tipo_embalagem === 'pacote' && c.tipo_pacote === 50 ? c.qtd_pacotes : '',
        c.tipo_embalagem === 'unidade' ? c.qtd_unidades : '',
        c.tipo_embalagem === 'pacote' ? c.qtd_pacotes * c.tipo_pacote : c.qtd_unidades,
        c.valor_total,
      ]);
    });
    const wsComp = XLSX.utils.aoa_to_sheet(compRows);
    wsComp['!cols'] = [12, 28, 20, 14, 10, 10, 12, 12, 14];
    XLSX.utils.book_append_sheet(wb, wsComp, 'Compras');

    const fname = `Mondarc_Relatorio_${dataInicio.split('-').reverse().join('-')}_a_${dataFim.split('-').reverse().join('-')}.xlsx`;
    XLSX.writeFile(wb, fname);
    showToast('Relatório baixado com sucesso');
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-card-alt rounded-xl border border-line w-fit flex-wrap">
        <TabButton active={tab === 'resumo'} onClick={() => setTab('resumo')} icon={<FileBarChart size={18} />} label="Resumo do Período" />
        <TabButton active={tab === 'estoque'} onClick={() => setTab('estoque')} icon={<Boxes size={18} />} label="Controle de Estoque" />
        <TabButton active={tab === 'compras'} onClick={() => setTab('compras')} icon={<ShoppingCart size={18} />} label="Compras" />
        <TabButton active={tab === 'impressoes'} onClick={() => setTab('impressoes')} icon={<Printer size={18} />} label="Impressões" />
      </div>

      {/* TAB: Resumo do Período */}
      {tab === 'resumo' && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-line p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileBarChart size={20} className="text-ink-soft" />
              <h3 className="font-semibold text-ink">Período</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <DatePicker value={dataInicio} onChange={setDataInicio} label="Data Inicial" id="rel-inicio" />
              <DatePicker value={dataFim} onChange={setDataFim} label="Data Final" id="rel-fim" />
              <button onClick={handleExportExcel} disabled={!!dateError} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                <Download size={16} /> Exportar Excel
              </button>
            </div>
            {dateError && <p className="mt-3 text-sm text-rose-500">A data inicial não pode ser maior que a data final.</p>}
          </div>

          {/* Simplified summary — only 4 key metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard icon={<TrendingUp size={20} />} label="Entradas (Compras)" value={formatNumber(stats.totalComprasUnidades)} color="emerald" sub={`${stats.numCompras} compra(s)`} />
            <SummaryCard icon={<TrendingDown size={20} />} label="Saídas" value={formatNumber(stats.totalSaidasUnidades)} color="amber" sub={`${stats.numSaidas} saída(s)`} />
            <SummaryCard icon={<Package size={20} />} label="Total Movimentado" value={formatNumber(stats.totalMovimentado)} color="blue" sub="entradas + saídas" />
            <SummaryCard icon={<FileBarChart size={20} />} label="Período" value={`${formatDate(dataInicio).slice(0, 5)} → ${formatDate(dataFim).slice(0, 5)}`} color="slate" sub="dias selecionados" isText />
          </div>

          {/* Movimentações table */}
          <div className="bg-card rounded-2xl border border-line overflow-hidden">
            <div className="px-6 py-4 border-b border-line">
              <h3 className="font-semibold text-ink">Movimentações do Período</h3>
              <p className="text-sm text-ink-soft mt-0.5">Compras e saídas registradas entre {formatDate(dataInicio)} e {formatDate(dataFim)}</p>
            </div>
            {movimentacoes.length === 0 ? (
              <EmptyState icon={<FileBarChart size={28} />} title="Nenhuma movimentação no período" description="Ajuste o período ou registre compras/saídas para vê-las aqui." />
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-line bg-card-alt/50 sticky top-0">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Data</th>
                      <th className="text-center px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Tipo</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Material</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {movimentacoes.map((m, i) => (
                      <tr key={i} className="hover:bg-card-alt/50 transition-colors">
                        <td className="px-6 py-3 text-sm text-ink whitespace-nowrap">{formatDate(m.data)}</td>
                        <td className="px-6 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m.tipo === 'Compra' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>{m.tipo}</span>
                        </td>
                        <td className="px-6 py-3 text-sm font-medium text-ink">{m.material}</td>
                        <td className="px-6 py-3 text-sm font-bold text-ink text-right">{formatNumber(m.quantidade)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Controle de Estoque */}
      {tab === 'estoque' && (
        <div className="bg-card rounded-2xl border border-line overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <h3 className="font-semibold text-ink">Controle de Estoque</h3>
            <p className="text-sm text-ink-soft mt-0.5">Saldo atual de todos os materiais ativos</p>
          </div>
          {estoque.filter(e => e.ativo).length === 0 ? (
            <EmptyState icon={<Boxes size={28} />} title="Nenhum material" description="Cadastre materiais para ver o controle de estoque." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line bg-card-alt/50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Material</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden sm:table-cell">Painel</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden md:table-cell">Pacotes 10</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden md:table-cell">Pacotes 50</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden lg:table-cell">Total Pacotes</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Total Unidades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {estoque.filter(e => e.ativo).map(e => {
                    const isUnit = e.inventory_type === 'UNIT';
                    return (
                      <tr key={e.material_id} className="hover:bg-card-alt/50 transition-colors">
                        <td className="px-6 py-3.5 text-sm font-medium text-ink">
                          {e.material_nome}{e.bitola ? ` · ${e.bitola}` : ''}
                          <span className="block text-xs text-ink-soft mt-0.5">{isUnit ? `Unitário (${e.unidade_medida})` : 'Pacotes'}</span>
                        </td>
                        <td className="px-6 py-3.5 hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.cor }} />
                            {e.categoria_nome}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-ink text-right hidden md:table-cell">{isUnit ? '—' : formatNumber(e.saldo10)}</td>
                        <td className="px-6 py-3.5 text-sm text-ink text-right hidden md:table-cell">{isUnit ? '—' : formatNumber(e.saldo50)}</td>
                        <td className="px-6 py-3.5 text-sm text-ink text-right hidden lg:table-cell">{isUnit ? '—' : formatNumber(e.saldo10 + e.saldo50)}</td>
                        <td className="px-6 py-3.5 text-sm font-bold text-ink text-right">{formatNumber(e.total_unidades)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: Compras */}
      {tab === 'compras' && (
        <div className="bg-card rounded-2xl border border-line overflow-hidden">
          <div className="px-6 py-4 border-b border-line flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-ink">Relatório de Compras</h3>
              <p className="text-sm text-ink-soft mt-0.5">Compras do período: {formatDate(dataInicio)} a {formatDate(dataFim)}</p>
            </div>
            <div className="flex gap-2">
              <DatePicker value={dataInicio} onChange={setDataInicio} label="" id="comp-inicio" />
              <DatePicker value={dataFim} onChange={setDataFim} label="" id="comp-fim" />
            </div>
          </div>
          {comprasPeriodo.length === 0 ? (
            <EmptyState icon={<ShoppingCart size={28} />} title="Nenhuma compra no período" description="Ajuste o período ou registre compras." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line bg-card-alt/50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Data</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Material</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden md:table-cell">Fornecedor</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden sm:table-cell">Pac. 10</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden sm:table-cell">Pac. 50</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden sm:table-cell">Unidades</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Total Un.</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden md:table-cell">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {comprasPeriodo.map(c => {
                    const mat = matMap.get(c.material_id);
                    const totalUn = c.tipo_embalagem === 'pacote' ? c.qtd_pacotes * c.tipo_pacote : c.qtd_unidades;
                    return (
                      <tr key={c.id} className="hover:bg-card-alt/50 transition-colors">
                        <td className="px-6 py-3.5 text-sm text-ink whitespace-nowrap">{formatDate(c.data)}</td>
                        <td className="px-6 py-3.5 text-sm font-medium text-ink">{mat?.nome ?? '—'}{mat?.bitola ? ` · ${mat.bitola}` : ''}</td>
                        <td className="px-6 py-3.5 text-sm text-ink-soft hidden md:table-cell">{c.fornecedor || '—'}</td>
                        <td className="px-6 py-3.5 text-sm text-ink-soft text-right hidden sm:table-cell">{c.tipo_embalagem === 'pacote' && c.tipo_pacote === 10 ? formatNumber(c.qtd_pacotes) : '—'}</td>
                        <td className="px-6 py-3.5 text-sm text-ink-soft text-right hidden sm:table-cell">{c.tipo_embalagem === 'pacote' && c.tipo_pacote === 50 ? formatNumber(c.qtd_pacotes) : '—'}</td>
                        <td className="px-6 py-3.5 text-sm text-ink-soft text-right hidden sm:table-cell">{c.tipo_embalagem === 'unidade' ? formatNumber(c.qtd_unidades) : '—'}</td>
                        <td className="px-6 py-3.5 text-sm font-bold text-ink text-right">{formatNumber(totalUn)}</td>
                        <td className="px-6 py-3.5 text-sm text-ink-soft text-right hidden md:table-cell">{c.valor_total > 0 ? c.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: Impressões */}
      {tab === 'impressoes' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <PrintCard
            icon={<Boxes size={24} />}
            title="Controle de Estoque"
            description="Tabela completa de estoque atual: pacotes 10, pacotes 50, total de pacotes e total de unidades."
            onPrint={() => setPrintEstoque(true)}
            onPNG={() => setPrintEstoque(true)}
          />
          <PrintCard
            icon={<ShoppingCart size={24} />}
            title="Lista de Compras"
            description="Lista de itens que precisam ser comprados ou produzidos, com quantidade e observação."
            onPrint={() => setPrintCompras(true)}
            onPNG={() => setPrintCompras(true)}
          />
          <PrintCard
            icon={<FileBarChart size={24} />}
            title="Resumo do Período"
            description="Movimentações do período selecionado: entradas, saídas e totais."
            onPrint={() => setPrintResumo(true)}
            onPNG={() => setPrintResumo(true)}
          />
        </div>
      )}

      {/* Print modals */}
      {printEstoque && (
        <PrintEstoqueModal estoque={estoque} responsavel={config?.responsavel_nome ?? ''} categorias={categorias} onClose={() => setPrintEstoque(false)} />
      )}
      {printCompras && (
        <PrintListaComprasRelModal listaCompras={listaCompras} categorias={categorias} onClose={() => setPrintCompras(false)} />
      )}
      {printResumo && (
        <PrintResumoModal stats={stats} movimentacoes={movimentacoes} dataInicio={dataInicio} dataFim={dataFim} responsavel={config?.responsavel_nome ?? ''} onClose={() => setPrintResumo(false)} />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-card text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
      <span className="md:hidden">{label.split(' ')[0]}</span>
    </button>
  );
}

function SummaryCard({ icon, label, value, color, sub, isText }: { icon: React.ReactNode; label: string; value: string; color: string; sub?: string; isText?: boolean }) {
  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  };
  return (
    <div className="bg-card rounded-2xl border border-line p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>{icon}</div>
        <p className="text-sm text-ink-soft">{label}</p>
      </div>
      <p className={`${isText ? 'text-lg' : 'text-2xl'} font-bold text-ink`}>{value}</p>
      {sub && <p className="text-xs text-ink-muted mt-1">{sub}</p>}
    </div>
  );
}

function PrintCard({ icon, title, description, onPrint, onPNG }: { icon: React.ReactNode; title: string; description: string; onPrint: () => void; onPNG: () => void }) {
  return (
    <div className="bg-card rounded-2xl border border-line p-5 flex flex-col">
      <div className="w-12 h-12 rounded-xl bg-card-alt flex items-center justify-center text-accent mb-3">{icon}</div>
      <h3 className="font-semibold text-ink mb-1">{title}</h3>
      <p className="text-sm text-ink-soft flex-1">{description}</p>
      <div className="mt-4 flex gap-2">
        <button onClick={onPrint} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors">
          <Printer size={16} /> Imprimir
        </button>
        <button onClick={onPNG} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-line text-ink text-sm font-medium hover:bg-card-alt transition-colors">
          <ImageIcon size={16} /> Salvar PNG
        </button>
      </div>
    </div>
  );
}

function PrintEstoqueModal({ estoque, responsavel, categorias, onClose }: { estoque: EstoqueRow[]; responsavel: string; categorias: Categoria[]; onClose: () => void }) {
  const active = estoque.filter(e => e.ativo);

  const buildConfig = (): ExportConfig => {
    const today = new Date().toLocaleDateString('pt-BR');
    const subtitle = `Data: ${today}${responsavel ? ' | Responsável: ' + responsavel : ''}`;

    // Group by real category (using categoria_id from estoque rows, ordered by categorias.ordem)
    const byCat = new Map<string, EstoqueRow[]>();
    for (const e of active) {
      if (!byCat.has(e.categoria_id)) byCat.set(e.categoria_id, []);
      byCat.get(e.categoria_id)!.push(e);
    }

    const groups: ExportGroup[] = [];
    for (const cat of categorias) {
      const items = byCat.get(cat.id);
      if (!items || items.length === 0) continue;
      groups.push({
        categoryName: cat.nome.toUpperCase(),
        table: {
          columns: [
            { header: 'Material' },
            { header: 'Pacotes 10', align: 'right' },
            { header: 'Pacotes 50', align: 'right' },
            { header: 'Total Pacotes', align: 'right' },
            { header: 'Total Unidades', align: 'right' },
          ],
          rows: items.map(e => {
            const isUnit = e.inventory_type === 'UNIT';
            return [
              `${e.material_nome}${e.bitola ? ' · ' + e.bitola : ''}`,
              isUnit ? '—' : formatNumber(e.saldo10),
              isUnit ? '—' : formatNumber(e.saldo50),
              isUnit ? '—' : formatNumber(e.saldo10 + e.saldo50),
              formatNumber(e.total_unidades),
            ];
          }),
        },
      });
    }

    return {
      title: 'Controle de Estoque',
      subtitle,
      filename: 'MONDARC_Controle_de_Estoque.png',
      groups: groups.length > 0 ? groups : [{
        categoryName: '',
        table: { columns: [{ header: 'Material' }, { header: 'Pacotes 10', align: 'right' }, { header: 'Pacotes 50', align: 'right' }, { header: 'Total Pacotes', align: 'right' }, { header: 'Total Unidades', align: 'right' }], rows: [] },
      }],
      emptyMessage: 'Nenhum material cadastrado.',
    };
  };

  return (
    <Modal open onClose={onClose} title="Controle de Estoque" maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Escolha como exportar o documento com a logo Mondarc e a tabela completa de estoque.</p>
        <div className="p-3 rounded-lg bg-card-alt border border-line text-sm text-ink-soft">{active.length} material(is) para exportação</div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors">Cancelar</button>
          <button onClick={() => { printDocument(buildConfig()); onClose(); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors">
            <Printer size={16} /> Imprimir
          </button>
          <button onClick={() => { saveAsPNG(buildConfig()); onClose(); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-line text-ink text-sm font-medium hover:bg-card-alt transition-colors">
            <ImageIcon size={16} /> Salvar PNG
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PrintListaComprasRelModal({ listaCompras, categorias, onClose }: { listaCompras: ListaCompra[]; categorias: Categoria[]; onClose: () => void }) {
  const buildConfig = (): ExportConfig => {
    const today = new Date().toLocaleDateString('pt-BR');
    const subtitle = `Data: ${today} | Total de itens: ${listaCompras.length}`;

    // Group items by their real category
    const byCat = new Map<string, ListaCompra[]>();
    for (const l of listaCompras) {
      const catId = l.categoria_id ?? 'sem-categoria';
      if (!byCat.has(catId)) byCat.set(catId, []);
      byCat.get(catId)!.push(l);
    }

    const groups: ExportGroup[] = [];
    for (const cat of categorias) {
      const items = byCat.get(cat.id);
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
    const noCat = byCat.get('sem-categoria');
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

  return (
    <Modal open onClose={onClose} title="Lista de Compras" maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Escolha como exportar a lista de itens que precisam ser comprados.</p>
        <div className="p-3 rounded-lg bg-card-alt border border-line text-sm text-ink-soft">{listaCompras.length} item(ns) na lista</div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors">Cancelar</button>
          <button onClick={() => { printDocument(buildConfig()); onClose(); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors">
            <Printer size={16} /> Imprimir
          </button>
          <button onClick={() => { saveAsPNG(buildConfig()); onClose(); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-line text-ink text-sm font-medium hover:bg-card-alt transition-colors">
            <ImageIcon size={16} /> Salvar PNG
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PrintResumoModal({ stats, movimentacoes, dataInicio, dataFim, responsavel, onClose }: {
  stats: { totalSaidasUnidades: number; totalComprasUnidades: number; totalMovimentado: number; numSaidas: number; numCompras: number };
  movimentacoes: { data: string; tipo: string; material: string; quantidade: number }[];
  dataInicio: string;
  dataFim: string;
  responsavel: string;
  onClose: () => void;
}) {
  const buildConfig = (): ExportConfig => {
    const subtitle = `Período: ${formatDate(dataInicio)} a ${formatDate(dataFim)}${responsavel ? ' | Responsável: ' + responsavel : ''}`;
    const rows = [
      ['Entradas (Compras)', formatNumber(stats.totalComprasUnidades) + ` (${stats.numCompras} compra(s))`],
      ['Saídas', formatNumber(stats.totalSaidasUnidades) + ` (${stats.numSaidas} saída(s))`],
      ['Total Movimentado', formatNumber(stats.totalMovimentado)],
    ];
    movimentacoes.forEach(m => {
      rows.push([`${formatDate(m.data)} — ${m.tipo}`, `${m.material}: ${formatNumber(m.quantidade)}`]);
    });
    return {
      title: 'Resumo do Período',
      subtitle,
      filename: 'MONDARC_Resumo_do_Periodo.png',
      table: {
        columns: [
          { header: 'Categoria / Movimentação' },
          { header: 'Detalhe' },
        ],
        rows,
      },
      emptyMessage: 'Nenhuma movimentação no período.',
    };
  };

  return (
    <Modal open onClose={onClose} title="Resumo do Período" maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Escolha como exportar o resumo do período selecionado.</p>
        <div className="p-3 rounded-lg bg-card-alt border border-line text-sm text-ink-soft">{movimentacoes.length} movimentação(ões) no período</div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors">Cancelar</button>
          <button onClick={() => { printDocument(buildConfig()); onClose(); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors">
            <Printer size={16} /> Imprimir
          </button>
          <button onClick={() => { saveAsPNG(buildConfig()); onClose(); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-line text-ink text-sm font-medium hover:bg-card-alt transition-colors">
            <ImageIcon size={16} /> Salvar PNG
          </button>
        </div>
      </div>
    </Modal>
  );
}
