import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays } from 'lucide-react';
import { DayPicker, type DateRange, type DayPickerLocale, type DayPickerProps } from 'react-day-picker';
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

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDayShort(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(intlLocaleFor(lang), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

const VIEW_MARGIN = 12;
const POPOVER_MAX_WIDTH_RANGE_PX = 672;

function popoverWidthPx(): number {
  return Math.min(window.innerWidth - VIEW_MARGIN * 2, POPOVER_MAX_WIDTH_RANGE_PX);
}

function clampPopoverLeft(left: number, popoverW: number): number {
  const vw = window.innerWidth;
  let x = left;
  if (x + popoverW > vw - VIEW_MARGIN) x = vw - VIEW_MARGIN - popoverW;
  if (x < VIEW_MARGIN) x = VIEW_MARGIN;
  return x;
}

type Props = {
  fromValue: string;
  toValue: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  disabled?: DayPickerProps['disabled'];
  align?: 'left' | 'right';
};

/** Kun KM kabi `datetime-local` qiymatlari bilan bir kalendar oralig‘i. */
export function DatetimeLocalRangeField({ fromValue, toValue, onFromChange, onToChange, disabled, align = 'left' }: Props) {
  const { t, lang } = useI18n();
  const autoId = useId();
  const fieldId = autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [numberOfMonths, setNumberOfMonths] = useState(1);

  const locale = useMemo(() => dayPickerLocaleFor(lang), [lang]);

  useLayoutEffect(() => {
    if (!open) return;
    const up = () => setNumberOfMonths(window.innerWidth >= 640 ? 2 : 1);
    up();
    window.addEventListener('resize', up);
    return () => window.removeEventListener('resize', up);
  }, [open]);

  const selected = useMemo((): DateRange | undefined => {
    const a = startOfLocalDay(parseDatetimeLocalValue(fromValue));
    const b = startOfLocalDay(parseDatetimeLocalValue(toValue));
    const tA = a.getTime();
    const tB = b.getTime();
    if (!Number.isFinite(tA) || !Number.isFinite(tB)) return undefined;
    if (tA <= tB) return { from: a, to: b };
    return { from: b, to: a };
  }, [fromValue, toValue]);

  const label = useMemo(() => {
    if (!selected?.from || !selected?.to) return '';
    return `${formatDayShort(selected.from, lang)} — ${formatDayShort(selected.to, lang)}`;
  }, [selected, lang]);

  const defaultMonth = useMemo(() => selected?.to ?? selected?.from ?? new Date(), [selected]);

  const onSelectRange = (range: DateRange | undefined) => {
    if (!range?.from) return;
    const f0 = startOfLocalDay(range.from);
    const t0 = range.to != null ? startOfLocalDay(range.to) : f0;
    const lo = f0.getTime() <= t0.getTime() ? f0 : t0;
    const hi = f0.getTime() <= t0.getTime() ? t0 : f0;
    onFromChange(toDatetimeLocalValue(lo));
    onToChange(toDatetimeLocalValue(hi));
    if (range.to != null) queueMicrotask(() => setOpen(false));
  };

  const goToday = () => {
    const tday = new Date();
    tday.setHours(0, 0, 0, 0);
    onFromChange(toDatetimeLocalValue(tday));
    onToChange(toDatetimeLocalValue(tday));
    queueMicrotask(() => setOpen(false));
  };

  useLayoutEffect(() => {
    if (!open) return;
    const btn = buttonRef.current;
    if (!btn) return;
    const update = () => {
      const r = btn.getBoundingClientRect();
      const w = popoverWidthPx();
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
  }, [open, align]);

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
      <button
        ref={buttonRef}
        type="button"
        id={fieldId}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="app-input flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{label}</span>
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
            className="app-datetime-popover fixed z-[5000] w-[min(100vw-1.5rem,42rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg dark:border-slate-700/90 dark:bg-slate-900"
          >
            <div className="max-h-[min(78vh,480px)] overflow-y-auto p-2 sm:p-3">
              <DayPicker
                mode="range"
                selected={selected}
                onSelect={onSelectRange}
                locale={locale}
                defaultMonth={defaultMonth}
                numberOfMonths={numberOfMonths}
                captionLayout="label"
                hideNavigation={false}
                showOutsideDays
                disabled={disabled}
                className="app-datetime-daypicker w-full max-w-full [--rdp-accent-color:rgb(37_99_235)] [--rdp-accent-background-color:rgb(239_246_255)] [--rdp-day_button-border-radius:0.5rem] [--rdp-day-width:34px] [--rdp-day-height:34px] [--rdp-day_button-width:32px] [--rdp-day_button-height:32px] dark:[--rdp-accent-color:rgb(96_165_250)] dark:[--rdp-accent-background-color:rgba(59_130_246_0.15)]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200/90 bg-slate-50/80 px-3 py-2 dark:border-slate-700/90 dark:bg-slate-950/40">
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
