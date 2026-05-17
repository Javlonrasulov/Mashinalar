import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n, type Lang } from '@/i18n/I18nContext';

const VIEW_MARGIN = 12;
const POPOVER_W = 280;

function intlLocaleFor(lang: Lang): string {
  if (lang === 'ru') return 'ru-RU';
  if (lang === 'uzCyrl') return 'ru-RU';
  return 'uz-Latn-UZ';
}

function parseYm(value: string): { y: number; m: number } | null {
  const mx = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!mx) return null;
  const y = Number(mx[1]);
  const mo = Number(mx[2]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null;
  return { y, m: mo };
}

function formatYm(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`;
}

type Props = {
  value: string;
  onChange: (ym: string) => void;
  id?: string;
  disabled?: boolean;
};

export function MonthField({ value, onChange, id, disabled }: Props) {
  const { t, lang } = useI18n();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const parsed = useMemo(() => parseYm(value), [value]);
  const [viewYear, setViewYear] = useState(() => parsed?.y ?? new Date().getFullYear());

  useEffect(() => {
    if (parsed) setViewYear(parsed.y);
  }, [parsed?.y, value]);

  const locale = useMemo(() => intlLocaleFor(lang), [lang]);

  const displayLabel = useMemo(() => {
    if (!parsed) return '';
    const d = new Date(parsed.y, parsed.m - 1, 1);
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
  }, [parsed, locale]);

  const monthLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'short' });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)));
  }, [locale]);

  const pickMonth = (m: number) => {
    onChange(formatYm(viewYear, m));
    setOpen(false);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const btn = anchorRef.current;
    if (!btn) return;
    const update = () => {
      const r = btn.getBoundingClientRect();
      let left = r.left;
      if (left + POPOVER_W > window.innerWidth - VIEW_MARGIN) {
        left = window.innerWidth - VIEW_MARGIN - POPOVER_W;
      }
      if (left < VIEW_MARGIN) left = VIEW_MARGIN;
      setPopoverPos({ top: r.bottom + 8, left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as Node;
      if (rootRef.current?.contains(el) || popoverRef.current?.contains(el)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <div
        ref={anchorRef}
        className="app-input flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 text-left tabular-nums disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => !disabled && setOpen((o) => !o)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-labelledby={fieldId}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <span id={fieldId} className={displayLabel ? 'truncate' : 'truncate text-slate-400'}>
          {displayLabel || t('fuelReportPickMonth')}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </div>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: popoverPos.top, left: popoverPos.left, width: POPOVER_W }}
            className="fixed z-[6000] rounded-xl border border-slate-200/90 bg-white p-3 shadow-lg dark:border-slate-700/90 dark:bg-slate-900"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                className="app-btn-ghost inline-flex h-8 w-8 items-center justify-center p-0"
                onClick={() => setViewYear((y) => y - 1)}
                aria-label={t('fuelReportMonthPrevYear')}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {viewYear}
              </span>
              <button
                type="button"
                className="app-btn-ghost inline-flex h-8 w-8 items-center justify-center p-0"
                onClick={() => setViewYear((y) => y + 1)}
                aria-label={t('fuelReportMonthNextYear')}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {monthLabels.map((label, i) => {
                const m = i + 1;
                const active = parsed?.y === viewYear && parsed?.m === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickMonth(m)}
                    className={[
                      'rounded-lg px-2 py-2 text-sm font-medium transition',
                      active
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
