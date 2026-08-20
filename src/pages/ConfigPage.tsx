import { useEffect, useState, useRef } from 'react';
import { Settings, Plus, Pencil, Trash2, Tag, User, Download, Upload, Save, Database, AlertTriangle } from 'lucide-react';
import { supabase, logAction, type Categoria, type Material, type Saida, type Ajuste, type EstoqueRow, type InventoryType, type Config } from '@/lib/supabase';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Toast, EmptyState, LoadingSpinner, Badge, InventoryTypeBadge } from '@/components/UI';
import { formatNumber } from '@/lib/utils';

const COLORS = ['#0B7EC4', '#2FBFAE', '#d9724b', '#7c3aed', '#db2777', '#059669', '#d97706', '#dc2626', '#4f46e5', '#0891b2'];

export function ConfigPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Categoria | null>(null);

  // Responsável editing
  const [responsavelNome, setResponsavelNome] = useState('');
  const [savingResp, setSavingResp] = useState(false);

  // Backup
  const [restoreData, setRestoreData] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    const [catRes, matRes, estRes, saiRes, adjRes, cfgRes] = await Promise.all([
      supabase.from('categorias').select('*').order('ordem'),
      supabase.from('materiais').select('*'),
      supabase.from('vw_estoque').select('*'),
      supabase.from('saidas').select('*'),
      supabase.from('ajustes').select('*'),
      supabase.from('config').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (catRes.data) setCategorias(catRes.data);
    if (matRes.data) setMateriais(matRes.data);
    if (estRes.data) setEstoque(estRes.data as unknown as EstoqueRow[]);
    if (saiRes.data) setSaidas(saiRes.data);
    if (adjRes.data) setAjustes(adjRes.data);
    if (cfgRes.data) { setConfig(cfgRes.data as Config); setResponsavelNome((cfgRes.data as Config).responsavel_nome); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSaveCat = async (nome: string, cor: string, inventory_type: InventoryType) => {
    if (editingCat) {
      const { error } = await supabase.from('categorias').update({ nome, cor, inventory_type }).eq('id', editingCat.id);
      if (error) { showToast('Erro ao atualizar painel', 'error'); return; }
      await logAction('Painel editado', 'PAINEL', nome, `Tipo: ${inventory_type}`);
      showToast('Painel atualizado');
    } else {
      const maxOrdem = categorias.reduce((max, c) => Math.max(max, c.ordem), 0);
      const { error } = await supabase.from('categorias').insert({ nome, cor, ordem: maxOrdem + 1, inventory_type });
      if (error) { showToast('Erro ao criar painel', 'error'); return; }
      await logAction('Painel criado', 'PAINEL', nome, `Tipo: ${inventory_type}`);
      showToast('Painel criado');
    }
    setCatModalOpen(false);
    setEditingCat(null);
    load();
  };

  const handleDeleteCat = async (cat: Categoria) => {
    const { error } = await supabase.from('categorias').delete().eq('id', cat.id);
    if (error) { showToast('Erro ao excluir painel', 'error'); return; }
    await logAction('Painel excluído', 'PAINEL', cat.nome, '');
    showToast('Painel excluído');
    load();
  };

  const handleSaveResponsavel = async () => {
    setSavingResp(true);
    const { error } = await supabase.from('config').update({ responsavel_nome: responsavelNome.trim(), updated_at: new Date().toISOString() }).eq('id', 1);
    setSavingResp(false);
    if (error) { showToast('Erro ao salvar responsável', 'error'); return; }
    await logAction('Responsável atualizado', 'CONFIG', responsavelNome.trim(), '');
    showToast('Responsável salvo');
    load();
  };

  const handleExportBackup = async () => {
    const backup = {
      version: 'mondarc-v6',
      exported_at: new Date().toISOString(),
      categorias,
      materiais,
      saidas,
      ajustes,
      config: config ?? { id: 1, responsavel_nome: responsavelNome, updated_at: new Date().toISOString() },
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mondarc_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await logAction('Backup exportado', 'BACKUP', '', `${materiais.length} materiais, ${saidas.length} saídas`);
    showToast('Backup exportado');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        JSON.parse(text); // validate
        setRestoreData(text);
        setRestoreConfirm(true);
      } catch {
        showToast('Arquivo de backup inválido', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRestoreConfirm = async () => {
    if (!restoreData) return;
    try {
      const backup = JSON.parse(restoreData);
      if (!backup.version || !backup.categorias) { showToast('Backup inválido', 'error'); return; }

      // Restore config
      if (backup.config?.responsavel_nome) {
        await supabase.from('config').upsert({ id: 1, responsavel_nome: backup.config.responsavel_nome, updated_at: new Date().toISOString() });
      }

      // Restore categorias (upsert)
      for (const cat of backup.categorias) {
        await supabase.from('categorias').upsert({
          id: cat.id, nome: cat.nome, cor: cat.cor, ordem: cat.ordem,
          inventory_type: cat.inventory_type, created_at: cat.created_at,
        });
      }

      // Restore materiais
      for (const mat of backup.materiais) {
        await supabase.from('materiais').upsert({
          id: mat.id, categoria_id: mat.categoria_id, nome: mat.nome, bitola: mat.bitola,
          ini10: mat.ini10, ini50: mat.ini50, estoque_inicial: mat.estoque_inicial,
          unidade_medida: mat.unidade_medida, comprar: mat.comprar, ativo: mat.ativo,
          favorito: mat.favorito ?? false, created_at: mat.created_at, updated_at: mat.updated_at,
        });
      }

      // Restore saidas
      for (const sai of backup.saidas) {
        await supabase.from('saidas').upsert({
          id: sai.id, material_id: sai.material_id, categoria_id: sai.categoria_id, data: sai.data,
          tipo_pacote: sai.tipo_pacote, qtd_pacotes: sai.qtd_pacotes, obs: sai.obs,
          inventory_type: sai.inventory_type, quantidade: sai.quantidade, total_unidades: sai.total_unidades,
          created_at: sai.created_at,
        });
      }

      // Restore ajustes
      if (backup.ajustes) {
        for (const adj of backup.ajustes) {
          await supabase.from('ajustes').upsert({
            id: adj.id, material_id: adj.material_id, categoria_id: adj.categoria_id, data: adj.data,
            quantidade_ajuste: adj.quantidade_ajuste, saldo_anterior: adj.saldo_anterior,
            novo_saldo: adj.novo_saldo, motivo: adj.motivo, created_at: adj.created_at,
          });
        }
      }

      await logAction('Backup restaurado', 'BACKUP', '', `${backup.materiais?.length ?? 0} materiais`);
      showToast('Backup restaurado com sucesso');
      setRestoreConfirm(false);
      setRestoreData(null);
      load();
    } catch {
      showToast('Erro ao restaurar backup', 'error');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Responsável */}
      <div className="bg-card rounded-2xl border border-line p-5">
        <div className="flex items-center gap-2 mb-4">
          <User size={20} className="text-ink-soft" />
          <h3 className="font-semibold text-ink">Responsável pelos Relatórios</h3>
        </div>
        <p className="text-sm text-ink-soft mb-4">Nome padrão que aparecerá nos relatórios impressos. Pode ser alterado individualmente ao gerar cada relatório.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={responsavelNome}
            onChange={(e) => setResponsavelNome(e.target.value)}
            placeholder="Nome do responsável..."
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
          <button
            onClick={handleSaveResponsavel}
            disabled={savingResp}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-50 transition-colors"
          >
            <Save size={16} /> Salvar
          </button>
        </div>
      </div>

      {/* Backup */}
      <div className="bg-card rounded-2xl border border-line p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database size={20} className="text-ink-soft" />
          <h3 className="font-semibold text-ink">Backup</h3>
        </div>
        <p className="text-sm text-ink-soft mb-4">Exporte todos os dados do sistema para um arquivo de backup. A restauração substitui os dados atuais — sempre confirme antes.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleExportBackup}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Download size={16} /> Exportar Dados
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-line text-ink text-sm font-medium hover:bg-card-alt transition-colors"
          >
            <Upload size={16} /> Restaurar Backup
          </button>
        </div>
      </div>

      {/* Painéis management */}
      <div className="bg-card rounded-2xl border border-line overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-ink-soft" />
            <h3 className="font-semibold text-ink">Gerenciar Painéis</h3>
          </div>
          <button
            onClick={() => { setEditingCat(null); setCatModalOpen(true); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors"
          >
            <Plus size={16} /> Novo Painel
          </button>
        </div>

        {categorias.length === 0 ? (
          <EmptyState
            icon={<Tag size={28} />}
            title="Nenhum painel cadastrado"
            description="Crie painéis para organizar seus materiais. Ex: Geral, Hidráulica, Elétrica, Ferramentas..."
            action={
              <button
                onClick={() => { setEditingCat(null); setCatModalOpen(true); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors"
              >
                + Criar painel
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-line">
            {categorias.map((cat) => {
              const matCount = materiais.filter((m) => m.categoria_id === cat.id).length;
              const saiCount = saidas.filter((s) => s.categoria_id === cat.id).length;
              return (
                <div key={cat.id} className="px-6 py-4 flex items-center gap-4 hover:bg-card-alt/50 transition-colors">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: cat.cor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{cat.nome}</p>
                      <InventoryTypeBadge type={cat.inventory_type} />
                    </div>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {matCount} {matCount === 1 ? 'material' : 'materiais'} · {saiCount} {saiCount === 1 ? 'saída' : 'saídas'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingCat(cat); setCatModalOpen(true); }}
                      className="p-2 rounded-lg text-ink-soft hover:bg-card-alt hover:text-ink"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(cat)}
                      className="p-2 rounded-lg text-ink-soft hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {catModalOpen && (
        <CategoriaModal
          categoria={editingCat}
          hasData={editingCat ? materiais.some((m) => m.categoria_id === editingCat.id) || saidas.some((s) => s.categoria_id === editingCat.id) : false}
          onSave={handleSaveCat}
          onClose={() => { setCatModalOpen(false); setEditingCat(null); }}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDeleteCat(deleteTarget)}
        title="Excluir Painel"
        message={deleteTarget ? `Tem certeza que deseja excluir o painel "${deleteTarget.nome}"? Todos os materiais e saídas vinculados a este painel também serão removidos permanentemente.` : ''}
        confirmLabel="Excluir"
      />

      {/* Restore confirmation */}
      {restoreConfirm && (
        <Modal open onClose={() => { setRestoreConfirm(false); setRestoreData(null); }} title="Confirmar Restauração" maxWidth="max-w-md">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                A restauração substituirá todos os dados atuais pelos dados do backup. Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setRestoreConfirm(false); setRestoreData(null); }} className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleRestoreConfirm}
                className="flex-1 px-4 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors"
              >
                Restaurar Agora
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

function CategoriaModal({ categoria, hasData, onSave, onClose }: {
  categoria: Categoria | null;
  hasData: boolean;
  onSave: (nome: string, cor: string, inventory_type: InventoryType) => void;
  onClose: () => void;
}) {
  const [nome, setNome] = useState(categoria?.nome ?? '');
  const [cor, setCor] = useState(categoria?.cor ?? COLORS[0]);
  const [inventoryType, setInventoryType] = useState<InventoryType>(categoria?.inventory_type ?? 'PACKAGE');
  const [showWarning, setShowWarning] = useState(false);

  const handleTypeChange = (type: InventoryType) => {
    if (categoria && categoria.inventory_type !== type && hasData) {
      setShowWarning(true);
    }
    setInventoryType(type);
  };

  return (
    <Modal open onClose={onClose} title={categoria ? 'Editar Painel' : 'Novo Painel'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Nome do Painel</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Geral, Hidráulica, Elétrica, Ferramentas..."
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Tipo de Controle de Estoque</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleTypeChange('UNIT')}
              className={`p-4 rounded-xl border text-left transition-all ${
                inventoryType === 'UNIT'
                  ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-950/20 ring-2 ring-cyan-500/20'
                  : 'border-line hover:border-ink-soft/30'
              }`}
            >
              <p className="text-sm font-semibold text-ink">Unitário</p>
              <p className="text-xs text-ink-soft mt-1">Controle por quantidade de peças/unidades</p>
            </button>
            <button
              onClick={() => handleTypeChange('PACKAGE')}
              className={`p-4 rounded-xl border text-left transition-all ${
                inventoryType === 'PACKAGE'
                  ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                  : 'border-line hover:border-ink-soft/30'
              }`}
            >
              <p className="text-sm font-semibold text-ink">Pacotes</p>
              <p className="text-xs text-ink-soft mt-1">Controle por pacotes de 10 ou 50 unidades</p>
            </button>
          </div>
        </div>

        {showWarning && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-sm text-amber-700 dark:text-amber-300">
            Este painel possui materiais e movimentações existentes. Alterar o tipo não converterá automaticamente os dados antigos — o histórico permanece inalterado e o novo tipo se aplica apenas a novos lançamentos.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Cor</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setCor(c)}
                className={`w-9 h-9 rounded-lg transition-all ${cor === c ? 'ring-2 ring-offset-2 ring-ink-soft scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-line text-sm font-medium text-ink-soft hover:bg-card-alt transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => nome.trim() && onSave(nome.trim(), cor, inventoryType)}
            disabled={!nome.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}
