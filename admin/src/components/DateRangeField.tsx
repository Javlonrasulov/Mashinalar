import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarRange } from 'lucide-react';
import { DayPicker, type DateRange, type DayPickerLocale } from 'react-day-picker';
import { ru, uz, uzCyrl } from 'react-day-picker/locale';
import 'react-day-picker/style.css';

import type { Lang } from '@/i18n/I18nContext';
import { useI18n } from '@/i18n/I18nContext';
import type { SpentDateRangeYmd } from '@/lib/spentRangeQuery';
import { parseYmd, startOfLocalDay } from '@/lib/spentRangeQuery';

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

function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(intlLocaleFor(lang), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayTime(d: Date): number {
  return startOfLocalDay(d).getTime();
}

function todayStart(): Date {
  return startOfLocalDay(new Date());
}

/** Birinchi navigatsiya qilinadigan oy (joriy oy). Keyingi oylarga o‘tish yo‘q. */
function startOfCurrentMonth(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
}

function isStrictlyBetweenPreview(day: Date, a: Date, b: Date): boolean {
  const t = dayTime(day);
  const lo = Math.min(dayTime(a), dayTime(b));
  const hi = Math.max(dayTime(a), dayTime(b));
  return t > lo && t < hi;
}

const POPOVER_MAX_WIDTH_PX = 384;
const VIEW_MARGIN = 12;

function popoverWidthPx(): number {
  return Math.min(window.innerWidth - VIEW_MARGIN * 2, POPOVER_MAX_WIDTH_PX);
}

function clampPopoverLeft(left: number, popoverW: number): number {
  const vw = window.innerWidth;
  let x = left;
  if (x + popoverW > vw - VIEW_MARGIN) x = vw - VIEW_MARGIN - popoverW;
  if (x < VIEW_MARGIN) x = VIEW_MARGIN;
  return x;
}

type Props = {
  value: SpentDateRangeYmd | null;
  onChange: (v: SpentDateRangeYmd | null) => void;
  id?: string;
};

export function DateRangeField({ value, onChange, id }: Props) {
  const { t, lang } = useI18n();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastClickYmdRef = useRef<string | null>(null);

  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [draft, setDraft] = useState<DateRange | undefined>();
  const [hoverDate, setHoverDate] = useState<Date | undefined>();

  const locale = useMemo(() => dayPickerLocaleFor(lang), [lang]);

  useEffect(() => {
    if (open) return;
    if (!value?.from || !value?.to) {
      setDraft(undefined);
      return;
    }
    const from = parseYmd(value.from);
    const to = parseYmd(value.to);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
      setDraft(undefined);
      return;
    }
    setDraft({ from, to });
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    setHoverDate(undefined);
    lastClickYmdRef.current = null;
    if (value?.from && value?.to) {
      const from = parseYmd(value.from);
      const to = parseYmd(value.to);
      if (Number.isFinite(from.getTime()) && Number.isFinite(to.getTime())) {
        setDraft({ from, to });
      } else {
        setDraft(undefined);
      }
    } else {
      setDraft(undefined);
    }
  }, [open, value]);

  /** Eski saqlangan oralik bugundan keyingi kunlarni qamrab olsa, ochilganda bugungacha qisqartirish. */
  useEffect(() => {
    if (!open || !value?.from || !value?.to) return;
    const from = startOfLocalDay(parseYmd(value.from));
    const to = startOfLocalDay(parseYmd(value.to));
    const cap = todayStart();
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return;
    if (to.getTime() <= cap.getTime()) return;
    let lo = from.getTime() <= to.getTime() ? from : to;
    let hi = from.getTime() <= to.getTime() ? to : from;
    if (lo.getTime() > cap.getTime()) {
      lo = cap;
      hi = cap;
    } else {
      hi = cap;
    }
    const next = { from: formatDateOnly(lo), to: formatDateOnly(hi) };
    if (next.from === value.from && next.to === value.to) return;
    onChange(next);
  }, [open, value, onChange]);

  const labelText = useMemo(() => {
    if (!value?.from || !value?.to) return '';
    const a = parseYmd(value.from);
    const b = parseYmd(value.to);
    if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return '';
    return `${formatDisplay(a, lang)} — ${formatDisplay(b, lang)}`;
  }, [value, lang]);

  function commitAndClose(from: Date, to: Date) {
    const cap = todayStart();
    let a = startOfLocalDay(from <= to ? from : to);
    let b = startOfLocalDay(from <= to ? to : from);
    if (a.getTime() > cap.getTime()) {
      a = cap;
      b = cap;
    } else if (b.getTime() > cap.getTime()) {
      b = cap;
    }
    setDraft({ from: a, to: b });
    onChange({ from: formatDateOnly(a), to: formatDateOnly(b) });
    setOpen(false);
    lastClickYmdRef.current = null;
    setHoverDate(undefined);
  }

  const onSelectRange = (selected: DateRange | undefined) => {
    if (!selected?.from) {
      setDraft(undefined);
      lastClickYmdRef.current = null;
      setHoverDate(undefined);
      return;
    }

    const from = selected.from;
    const to = selected.to;

    if (!to) {
      setDraft({ from, to: undefined });
      lastClickYmdRef.current = formatDateOnly(from);
      return;
    }

    if (sameCalendarDay(from, to)) {
      const ymd = formatDateOnly(from);
      if (lastClickYmdRef.current === ymd) {
        commitAndClose(from, to);
        return;
      }
      setDraft({ from, to: undefined });
      lastClickYmdRef.current = ymd;
      return;
    }

    commitAndClose(from, to);
  };

  const previewModifier = useMemo(() => {
    return (d: Date) => {
      if (dayTime(d) > dayTime(new Date())) return false;
      if (!draft?.from || draft?.to || !hoverDate) return false;
      return isStrictlyBetweenPreview(d, draft.from, hoverDate);
    };
  }, [draft, hoverDate]);

  useLayoutEffect(() => {
    if (!open) return;
    const btn = buttonRef.current;
    if (!btn) return;
    const update = () => {
      const r = btn.getBoundingClientRect();
      const w = popoverWidthPx();
      setPopoverPos({ top: r.bottom + 8, left: clampPopoverLeft(r.left, w) });
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
      <button
        ref={buttonRef}
        type="button"
        id={fieldId}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="app-input flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 text-left"
      >
        <span className={labelText ? 'truncate' : 'truncate text-slate-400 dark:text-slate-500'}>
          {labelText || t('expenseDateRangePlaceholder')}
        </span>
        <CalendarRange className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-labelledby={fieldId}
            style={{ top: popoverPos.top, left: popoverPos.left }}
            onMouseLeave={() => setHoverDate(undefined)}
            className="app-datetime-popover fixed z-[5000] w-[min(100vw-1.5rem,24rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg dark:border-slate-700/90 dark:bg-slate-900"
          >
            <div className="max-h-[min(70vh,420px)] overflow-auto p-2 md:p-3">
              <DayPicker
                mode="range"
                numberOfMonths={1}
                selected={draft}
                onSelect={onSelectRange}
                locale={locale}
                captionLayout="label"
                endMonth={startOfCurrentMonth()}
                disabled={{ after: todayStart() }}
                showOutsideDays
                modifiers={{ preview: previewModifier }}
                modifiersClassNames={{
                  preview:
                    'bg-blue-100/90 text-slate-900 dark:bg-blue-900/45 dark:text-slate-100 [&_button]:rounded-lg',
                }}
                onDayMouseEnter={(d) => {
                  if (draft?.from && !draft?.to) setHoverDate(d);
                }}
                className="app-datetime-daypicker w-full [--rdp-accent-color:rgb(37_99_235)] [--rdp-accent-background-color:rgb(239_246_255)] [--rdp-day_button-border-radius:0.5rem] dark:[--rdp-accent-color:rgb(96_165_250)] dark:[--rdp-accent-background-color:rgba(59_130_246_0.15)]"
              />
            </div>

            <div className="flex items-center justify-start gap-2 border-t border-slate-200/90 bg-slate-50/80 px-3 py-2 dark:border-slate-700/90 dark:bg-slate-950/40">
              <button
                type="button"
                className="app-link-muted text-sm"
                onClick={() => {
                  setDraft(undefined);
                  lastClickYmdRef.current = null;
                  setHoverDate(undefined);
                  onChange(null);
                }}
              >
                {t('datePickerClear')}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
