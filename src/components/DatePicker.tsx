import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type DatePickerProps = {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  id?: string;
};

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function DatePicker({ value, onChange, label, id }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const initialDate = value ? fromISO(value) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  useEffect(() => {
    if (open && value) {
      const d = fromISO(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const todayISO = toISO(new Date());
  const selectedISO = value;

  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const handleSelect = (d: Date) => {
    onChange(toISO(d));
    setOpen(false);
  };

  const displayDate = value
    ? fromISO(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Selecionar data...';

  return (
    <div className="relative">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      )}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-line bg-input text-ink text-sm transition-colors',
          'hover:border-ink-soft/40 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400',
          !value && 'text-ink-muted'
        )}
      >
        <CalendarDays size={16} className="text-ink-soft shrink-0" />
        <span className="flex-1 text-left">{displayDate}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 bg-surface rounded-xl shadow-xl border border-line p-4 animate-scale-in" style={{ minWidth: '280px' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg text-ink-soft hover:bg-card-alt hover:text-ink transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-semibold text-ink select-none">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg text-ink-soft hover:bg-card-alt hover:text-ink transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="text-center text-xs font-medium text-ink-muted py-1">
                  {wd}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, i) => {
                if (!d) return <div key={i} />;
                const iso = toISO(d);
                const isSelected = iso === selectedISO;
                const isToday = iso === todayISO;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(d)}
                    className={cn(
                      'aspect-square rounded-lg text-sm font-medium transition-all relative',
                      isSelected
                        ? 'bg-accent text-white shadow-md'
                        : 'text-ink hover:bg-card-alt',
                      isToday && !isSelected && 'ring-1 ring-accent/40 text-accent',
                    )}
                  >
                    {d.getDate()}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
              <span className="text-xs text-ink-soft">
                {selectedISO
                  ? `Selecionado: ${fromISO(selectedISO).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                  : 'Nenhuma data selecionada'}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-accent hover:underline"
              >
                Fechar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
