import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { DayPicker, type DayPickerLocale, type DayPickerProps } from 'react-day-picker';
import { ru, uz, uzCyrl } from 'react-day-picker/locale';
import 'react-day-picker/style.css';

import type { Lang } from '@/i18n/I18nContext';
import { useI18n } from '@/i18n/I18nContext';
import { parseDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/datetimeLocal';

function dayPickerLocaleFor(lang: Lang): DayPickerLocale {
  if (lang === 'ru') return ru;
  if (lang === 'uzCyrl') return uzCyrl;
  return uz;
}

function intlLocaleFor(lang: Lang): string {
  if (lang === 'ru') return 'ru-RU';
  if (lang === 'uzCyrl') return 'ru-RU';
  return 'uz-Latn-UZ';
}

function formatDisplay(d: Date, lang: Lang, mode: 'date' | 'datetime'): string {
  return new Intl.DateTimeFormat(intlLocaleFor(lang), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(mode === 'datetime'
      ? {
          hour: '2-digit' as const,
          minute: '2-digit' as const,
        }
      : {}),
  }).format(d);
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** ~34rem at 16px root — must match max popover width used for horizontal clamping */
const POPOVER_MAX_WIDTH_DATETIME_PX = 544;
/** Date-only: compact month grid (~20rem) */
const POPOVER_MAX_WIDTH_DATE_PX = 320;
const VIEW_MARGIN = 12;

function popoverMaxWidthPx(mode: 'date' | 'datetime'): number {
  return mode === 'date' ? POPOVER_MAX_WIDTH_DATE_PX : POPOVER_MAX_WIDTH_DATETIME_PX;
}

function popoverWidthPx(mode: 'date' | 'datetime'): number {
  return Math.min(window.innerWidth - VIEW_MARGIN * 2, popoverMaxWidthPx(mode));
}

function clampPopoverLeft(left: number, popoverW: number): number {
  const vw = window.innerWidth;
  let x = left;
  if (x + popoverW > vw - VIEW_MARGIN) x = vw - VIEW_MARGIN - popoverW;
  if (x < VIEW_MARGIN) x = VIEW_MARGIN;
  return x;
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  onClear?: () => void;
  mode?: 'date' | 'datetime';
  disabled?: DayPickerProps['disabled'];
  align?: 'left' | 'right';
};

export function DateTimeField({ value, onChange, id, onClear, mode = 'datetime', disabled, align = 'left' }: Props) {
  const { t, lang } = useI18n();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const selected = useMemo(() => parseDatetimeLocalValue(value), [value]);
  const locale = useMemo(() => dayPickerLocaleFor(lang), [lang]);

  const hourRaw = selected.getHours();
  const minuteRaw = selected.getMinutes();
  const hour = Number.isFinite(hourRaw) ? Math.min(23, Math.max(0, hourRaw)) : 0;
  const minute = Number.isFinite(minuteRaw) ? Math.min(59, Math.max(0, minuteRaw)) : 0;

  const setParts = (next: Date) => onChange(toDatetimeLocalValue(next));

  const onSelectDay = (d: Date | undefined) => {
    if (!d) return;
    const next = new Date(d);
    if (mode === 'date') {
      next.setHours(0, 0, 0, 0);
    } else {
      next.setHours(hour, minute, 0, 0);
    }
    setParts(next);
    // Defer close so DayPicker / document click ordering cannot reopen the toggle in the same tick.
    if (mode === 'date') queueMicrotask(() => setOpen(false));
  };

  const onHour = (h: number) => {
    const next = new Date(selected);
    next.setHours(h, minute, 0, 0);
    setParts(next);
  };

  const onMinute = (m: number) => {
    const next = new Date(selected);
    next.setHours(hour, m, 0, 0);
    setParts(next);
  };

  const goToday = () => {
    const tday = new Date();
    const next = new Date(selected);
    next.setFullYear(tday.getFullYear(), tday.getMonth(), tday.getDate());
    if (mode === 'date') {
      next.setHours(0, 0, 0, 0);
    } else {
      next.setHours(hour, minute, 0, 0);
    }
    setParts(next);
    if (mode === 'date') queueMicrotask(() => setOpen(false));
  };

  useLayoutEffect(() => {
    if (!open) return;
    const btn = buttonRef.current;
    if (!btn) return;
    const update = () => {
      const r = btn.getBoundingClientRect();
      const w = popoverWidthPx(mode);
      const leftBase = align === 'right' ? r.right - w : r.left;
      setPopoverPos({ top: r.bottom + 8, left: clampPopoverLeft(leftBase, w) });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, align, mode]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
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
      <button
        ref={buttonRef}
        type="button"
        id={fieldId}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="app-input flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{formatDisplay(selected, lang, mode)}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-labelledby={fieldId}
            style={{ top: popoverPos.top, left: popoverPos.left }}
            className={
              mode === 'date'
                ? 'app-datetime-popover fixed z-[5000] w-[min(100vw-1.5rem,20rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg dark:border-slate-700/90 dark:bg-slate-900'
                : 'app-datetime-popover fixed z-[5000] w-[min(100vw-1.5rem,34rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg dark:border-slate-700/90 dark:bg-slate-900'
            }
          >
          <div className="flex max-h-[min(70vh,420px)] flex-col lg:max-h-none lg:flex-row">
            <div className="min-w-0 flex-1 overflow-y-auto p-2 lg:p-3">
              <DayPicker
                mode="single"
                selected={selected}
                onSelect={onSelectDay}
                onDayClick={
                  mode === 'date'
                    ? () => {
                        queueMicrotask(() => setOpen(false));
                      }
                    : undefined
                }
                locale={locale}
                captionLayout="label"
                hideNavigation={false}
                showOutsideDays
                disabled={disabled}
                className={
                  mode === 'date'
                    ? 'app-datetime-daypicker w-full max-w-full [--rdp-accent-color:rgb(37_99_235)] [--rdp-accent-background-color:rgb(239_246_255)] [--rdp-day_button-border-radius:0.5rem] [--rdp-day-width:34px] [--rdp-day-height:34px] [--rdp-day_button-width:32px] [--rdp-day_button-height:32px] dark:[--rdp-accent-color:rgb(96_165_250)] dark:[--rdp-accent-background-color:rgba(59_130_246_0.15)]'
                    : 'app-datetime-daypicker w-full max-w-full [--rdp-accent-color:rgb(37_99_235)] [--rdp-accent-background-color:rgb(239_246_255)] [--rdp-day_button-border-radius:0.5rem] [--rdp-day-width:38px] [--rdp-day-height:38px] [--rdp-day_button-width:36px] [--rdp-day_button-height:36px] dark:[--rdp-accent-color:rgb(96_165_250)] dark:[--rdp-accent-background-color:rgba(59_130_246_0.15)]'
                }
              />
            </div>

            {mode === 'datetime' && (
              <div className="flex shrink-0 flex-col border-t border-slate-200/90 p-3 dark:border-slate-700/90 lg:w-[10.5rem] lg:border-l lg:border-t-0">
                <span className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('datePickerTime')}
                </span>
                <div className="flex items-center gap-1.5">
                  <label className="sr-only" htmlFor={`${fieldId}-h`}>
                    {t('datePickerHour')}
                  </label>
                  <div className="relative flex-1">
                    <select
                      id={`${fieldId}-h`}
                      className="app-select w-full appearance-none py-1.5 pl-3 pr-8 text-sm tabular-nums"
                      value={String(hour)}
                      onChange={(e) => onHour(Number(e.target.value))}
                    >
                      {HOURS.map((h) => (
                        <option key={h} value={String(h)}>
                          {String(h).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  </div>
                  <span className="pb-0.5 text-slate-400">:</span>
                  <label className="sr-only" htmlFor={`${fieldId}-m`}>
                    {t('datePickerMinute')}
                  </label>
                  <div className="relative flex-1">
                    <select
                      id={`${fieldId}-m`}
                      className="app-select w-full appearance-none py-1.5 pl-3 pr-8 text-sm tabular-nums"
                      value={String(minute)}
                      onChange={(e) => onMinute(Number(e.target.value))}
                    >
                      {MINUTES.map((m) => (
                        <option key={m} value={String(m)}>
                          {String(m).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-200/90 bg-slate-50/80 px-3 py-2 dark:border-slate-700/90 dark:bg-slate-950/40">
            {onClear ? (
              <button type="button" className="app-link-muted text-sm" onClick={() => onClear()}>
                {t('datePickerClear')}
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="app-link-muted text-sm" onClick={goToday}>
              {t('datePickerToday')}
            </button>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
