import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { DayPicker, type DayPickerLocale } from 'react-day-picker';
import { ru, uz, uzCyrl } from 'react-day-picker/locale';
import 'react-day-picker/style.css';

import type { Lang } from '@/i18n/I18nContext';
import { useI18n } from '@/i18n/I18nContext';

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

function parseDateOnly(value: string): Date {
  if (!value) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return new Date();
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  return Number.isFinite(dt.getTime()) ? dt : new Date();
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

type Props = {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  onClear?: () => void;
};

export function DateField({ value, onChange, id, onClear }: Props) {
  const { t, lang } = useI18n();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => parseDateOnly(value), [value]);
  const locale = useMemo(() => dayPickerLocaleFor(lang), [lang]);

  const onSelectDay = (d: Date | undefined) => {
    if (!d) return;
    onChange(formatDateOnly(d));
    setOpen(false);
  };

  const goToday = () => {
    onChange(formatDateOnly(new Date()));
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el?.contains(e.target as Node)) setOpen(false);
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
        type="button"
        id={fieldId}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="app-input flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{value ? formatDisplay(selected, lang) : '—'}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-labelledby={fieldId}
          className="app-datetime-popover absolute left-0 top-full z-[5000] mt-2 w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg dark:border-slate-700/90 dark:bg-slate-900"
        >
          <div className="max-h-[min(70vh,420px)] overflow-auto p-2 md:p-3">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={onSelectDay}
              locale={locale}
              captionLayout="label"
              showOutsideDays
              className="app-datetime-daypicker w-full [--rdp-accent-color:rgb(37_99_235)] [--rdp-accent-background-color:rgb(239_246_255)] [--rdp-day_button-border-radius:0.5rem] dark:[--rdp-accent-color:rgb(96_165_250)] dark:[--rdp-accent-background-color:rgba(59_130_246_0.15)]"
            />
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
        </div>
      )}
    </div>
  );
}

