import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays } from 'lucide-react';
import { DayPicker, type DayPickerLocale, type Matcher } from 'react-day-picker';
import { ru, uz, uzCyrl } from 'react-day-picker/locale';
import 'react-day-picker/style.css';

import { useI18n, type Lang } from '@/i18n/I18nContext';

function dayPickerLocaleFor(lang: Lang): DayPickerLocale {
  if (lang === 'ru') return ru;
  if (lang === 'uzCyrl') return uzCyrl;
  return uz;
}

function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseYmdToLocalDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const dt = new Date(y, mo, day);
  if (!Number.isFinite(dt.getTime())) return null;
  // guard against JS date overflow weirdness
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== day) return null;
  return startOfLocalDay(dt);
}

function clampDay(d: Date, min?: Date, max?: Date): Date {
  let x = startOfLocalDay(d);
  if (min && x < startOfLocalDay(min)) x = startOfLocalDay(min);
  if (max && x > startOfLocalDay(max)) x = startOfLocalDay(max);
  return x;
}

const POPOVER_MAX_WIDTH_PX = 352; /* ~22rem */
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

function safeBottomInsetPx(): number {
  try {
    const probe = document.createElement('div');
    probe.style.position = 'fixed';
    probe.style.left = '0';
    probe.style.right = '0';
    probe.style.bottom = '0';
    probe.style.height = 'env(safe-area-inset-bottom, 0px)';
    probe.style.width = '0';
    probe.style.pointerEvents = 'none';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height || 0;
    probe.remove();
    return h;
  } catch {
    return 0;
  }
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  onClear?: () => void;
  minDate?: Date;
  maxDate?: Date;
};

export function DateField({ value, onChange, id, onClear, minDate, maxDate }: Props) {
  const { t, lang } = useI18n();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; maxHeight: number }>({
    top: 0,
    left: 0,
    maxHeight: 420,
  });
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const selectedDay = useMemo(() => (value ? parseYmdToLocalDay(value) : null), [value]);
  const locale = useMemo(() => dayPickerLocaleFor(lang), [lang]);

  const disabledMatchers = useMemo<Matcher | Matcher[] | undefined>(() => {
    const parts: Matcher[] = [];
    if (minDate) parts.push({ before: startOfLocalDay(minDate) });
    if (maxDate) parts.push({ after: startOfLocalDay(maxDate) });
    return parts.length ? parts : undefined;
  }, [minDate, maxDate]);

  const onSelectDay = (d: Date | undefined) => {
    if (!d) return;
    const clamped = clampDay(d, minDate, maxDate);
    onChange(formatDateOnly(clamped));
    setOpen(false);
  };

  const goToday = () => {
    const clamped = clampDay(new Date(), minDate, maxDate);
    onChange(formatDateOnly(clamped));
    setOpen(false);
  };

  const commitDraft = () => {
    const raw = draft.trim();
    if (!raw) {
      onChange('');
      return;
    }
    const d = parseYmdToLocalDay(raw);
    if (!d) {
      setDraft(value);
      return;
    }
    const clamped = clampDay(d, minDate, maxDate);
    onChange(formatDateOnly(clamped));
    setDraft(formatDateOnly(clamped));
  };

  useLayoutEffect(() => {
    if (!open) return;
    const btn = anchorRef.current;
    if (!btn) return;
    const update = () => {
      const r = btn.getBoundingClientRect();
      const w = popoverWidthPx();
      const left = clampPopoverLeft(r.left, w);
      const safeBottom = safeBottomInsetPx();
      const margin = VIEW_MARGIN;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      void vw;

      // Prefer below; if not enough room (mobile nav / safe area), flip above.
      const desiredBelowTop = r.bottom + 8;
      const spaceBelow = vh - desiredBelowTop - margin - safeBottom;
      const spaceAbove = r.top - margin - safeBottom;
      const defaultMax = Math.min(420, Math.floor(vh * 0.7));

      if (spaceBelow >= 240 || spaceBelow >= spaceAbove) {
        const maxH = Math.max(220, Math.min(defaultMax, spaceBelow));
        setPopoverPos({ top: desiredBelowTop, left, maxHeight: maxH });
      } else {
        const maxH = Math.max(220, Math.min(defaultMax, spaceAbove - 8));
        const top = Math.max(margin + safeBottom, r.top - 8 - maxH);
        setPopoverPos({ top, left, maxHeight: maxH });
      }
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
      <div ref={anchorRef} className="flex min-w-0 items-stretch gap-2">
        <input
          id={fieldId}
          className="app-input min-w-0 flex-1 font-mono text-sm tabular-nums"
          value={draft}
          placeholder={t('dateInputPlaceholder')}
          inputMode="numeric"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitDraft()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
            }
          }}
        />
        <button
          type="button"
          className="app-btn-ghost inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center p-0"
          aria-label={t('openCalendar')}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((o) => !o)}
        >
          <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden />
        </button>
      </div>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-labelledby={fieldId}
            style={{ top: popoverPos.top, left: popoverPos.left }}
            className="app-datetime-popover fixed z-[5000] w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg dark:border-slate-700/90 dark:bg-slate-900"
          >
            <div className="overflow-auto p-2 md:p-3" style={{ maxHeight: popoverPos.maxHeight }}>
              <DayPicker
                mode="single"
                selected={selectedDay ?? undefined}
                onSelect={onSelectDay}
                locale={locale}
                captionLayout="label"
                showOutsideDays
                disabled={disabledMatchers}
                className="app-datetime-daypicker w-full [--rdp-accent-color:rgb(37_99_235)] [--rdp-accent-background-color:rgb(239_246_255)] [--rdp-day_button-border-radius:0.5rem] dark:[--rdp-accent-color:rgb(96_165_250)] dark:[--rdp-accent-background-color:rgba(59_130_246_0.15)]"
              />
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-200/90 bg-slate-50/80 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] dark:border-slate-700/90 dark:bg-slate-950/40">
              {onClear ? (
                <button
                  type="button"
                  className="app-link-muted text-sm"
                  onClick={() => {
                    onClear();
                    setDraft('');
                    setOpen(false);
                  }}
                >
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

