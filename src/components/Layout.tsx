import { type ReactNode, useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Package,
  Boxes,
  MinusCircle,
  Scale,
  ShoppingCart,
  History,
  FileBarChart,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  Search,
  Star,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Sliders,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { supabase, type Categoria, type EstoqueRow } from '@/lib/supabase';
import { LogoSymbol } from '@/components/Logo';

export type PageKey =
  | 'painel'
  | 'material'
  | 'estoque'
  | 'saida'
  | 'saldo'
  | 'compra'
  | 'historico'
  | 'ajuste'
  | 'relatorio'
  | 'log'
  | 'config';

const NAV: { key: PageKey; label: string; icon: ReactNode }[] = [
  { key: 'painel', label: 'Painel', icon: <LayoutDashboard size={20} /> },
  { key: 'material', label: 'Materiais', icon: <Package size={20} /> },
  { key: 'estoque', label: 'Estoque', icon: <Boxes size={20} /> },
  { key: 'saida', label: 'Saída', icon: <MinusCircle size={20} /> },
  { key: 'saldo', label: 'Saldo', icon: <Scale size={20} /> },
  { key: 'compra', label: 'Compra', icon: <ShoppingCart size={20} /> },
  { key: 'historico', label: 'Histórico', icon: <History size={20} /> },
  { key: 'ajuste', label: 'Ajuste de Estoque', icon: <Sliders size={20} /> },
  { key: 'relatorio', label: 'Relatório', icon: <FileBarChart size={20} /> },
  { key: 'log', label: 'Registro de Alterações', icon: <FileBarChart size={20} /> },
  { key: 'config', label: 'Configurações', icon: <Settings size={20} /> },
];

type LayoutProps = {
  current: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
};

export function Layout({ current, onNavigate, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [catRes, estRes] = await Promise.all([
        supabase.from('categorias').select('*').order('ordem'),
        supabase.from('vw_estoque').select('*'),
      ]);
      if (catRes.data) setCategorias(catRes.data);
      if (estRes.data) setEstoque(estRes.data as unknown as EstoqueRow[]);
    })();
  }, [current]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return estoque
      .filter((e) =>
        e.material_nome.toLowerCase().includes(q) ||
        e.bitola.toLowerCase().includes(q) ||
        e.categoria_nome.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [searchQuery, estoque]);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleNav = (page: PageKey) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  const sidebar = (
    <aside className="w-64 bg-header flex flex-col h-full shrink-0">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
        <LogoSymbol size={38} />
        <div className="min-w-0">
          <h1 className="text-white font-bold text-lg leading-none">Mondarc</h1>
          <p className="text-slate-400 text-xs mt-0.5">Gestão de Estoque</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Menu
        </p>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = current === item.key;
            return (
              <li key={item.key}>
                <button
                  onClick={() => handleNav(item.key)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-[#0B7EC4] text-white shadow-lg shadow-blue-900/30'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {estoque.some((e) => e.favorito) && (
          <div className="mt-4">
            <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Favoritos
            </p>
            <ul className="space-y-0.5">
              {estoque.filter((e) => e.favorito).slice(0, 6).map((e) => (
                <li key={e.material_id}>
                  <button
                    onClick={() => { onNavigate('material'); setMobileOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
                  >
                    <Star size={14} className="text-amber-400 fill-amber-400 shrink-0" />
                    <span className="truncate">{e.material_nome}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>
      </div>
    </aside>
  );

  const currentLabel = NAV.find((n) => n.key === current)?.label ?? '';

  return (
    <div className="flex h-screen bg-app overflow-hidden">
      <div className="hidden lg:flex shrink-0">{sidebar}</div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative animate-slide-in-left">{sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="flex items-center px-4 lg:px-8 py-3 lg:py-4 bg-card border-b border-line shrink-0 gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg text-ink hover:bg-card-alt"
          >
            <Menu size={22} />
          </button>

          <div className="lg:hidden flex items-center gap-2">
            <LogoSymbol size={28} />
          </div>

          <h2 className="hidden lg:block text-xl font-bold text-ink flex-1">{currentLabel}</h2>

          {/* Global search */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-md lg:ml-auto">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-input text-ink-soft text-sm hover:border-ink-soft/40 transition-colors"
            >
              <Search size={16} />
              <span className="flex-1 text-left">Buscar material...</span>
              <kbd className="hidden sm:inline-block text-xs px-1.5 py-0.5 rounded border border-line bg-card-alt text-ink-muted">⌘K</kbd>
            </button>
          </div>

          <button onClick={toggle} className="p-2 rounded-lg text-ink hover:bg-card-alt transition-colors">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Search modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-lg bg-surface rounded-2xl shadow-2xl border border-line animate-scale-in overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
              <Search size={20} className="text-ink-soft shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar material em todos os painéis..."
                className="flex-1 bg-transparent text-ink text-sm focus:outline-none"
              />
              <button onClick={() => setSearchOpen(false)} className="p-1 rounded text-ink-soft hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {searchQuery.trim() === '' ? (
                <div className="px-4 py-8 text-center text-sm text-ink-soft">
                  Digite para buscar materiais em todos os painéis.
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-ink-soft">
                  Nenhum material encontrado para "{searchQuery}".
                </div>
              ) : (
                <ul className="py-1">
                  {searchResults.map((e) => {
                    const cat = categorias.find((c) => c.id === e.categoria_id);
                    return (
                      <li key={e.material_id}>
                        <button
                          onClick={() => {
                            onNavigate('material');
                            setSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-card-alt transition-colors text-left"
                        >
                          {e.favorito && <Star size={14} className="text-amber-400 fill-amber-400 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{e.material_nome}</p>
                            <p className="text-xs text-ink-soft">
                              {cat?.nome} · {e.inventory_type === 'UNIT' ? 'Unitário' : 'Pacotes'} · {e.total_unidades} {e.inventory_type === 'UNIT' ? e.unidade_medida : 'un'}
                            </p>
                          </div>
                          <ChevronRight size={16} className="text-ink-muted shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
