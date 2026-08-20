import { type ReactNode } from 'react';

export function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className="fixed bottom-6 right-6 z-[60] animate-slide-up">
      <div
        className="flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border text-sm font-medium"
        style={{
          backgroundColor: type === 'success' ? 'var(--color-surface-elevated)' : 'var(--color-surface-elevated)',
          borderColor: type === 'success' ? 'var(--color-teal)' : 'var(--color-alert)',
          color: type === 'success' ? 'var(--color-teal)' : 'var(--color-alert)',
        }}
      >
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold"
          style={{ backgroundColor: type === 'success' ? 'var(--color-teal)' : 'var(--color-alert)' }}
        >
          {type === 'success' ? '✓' : '!'}
        </span>
        <span style={{ color: 'var(--color-ink)' }}>{message}</span>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-card-alt flex items-center justify-center text-ink-muted mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-ink mb-1">{title}</h3>
      <p className="text-sm text-ink-soft max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-3 border-line border-t-accent rounded-full animate-spin" />
    </div>
  );
}

export function Badge({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </span>
  );
}

export function InventoryTypeBadge({ type }: { type: 'UNIT' | 'PACKAGE' }) {
  if (type === 'UNIT') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
        Unitário
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
      Pacotes
    </span>
  );
}
