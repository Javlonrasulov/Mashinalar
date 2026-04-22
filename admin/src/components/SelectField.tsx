import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type SelectOption<V extends string = string> = {
  value: V;
  label: string;
};

type Props<V extends string> = {
  value: V;
  onChange: (v: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
};

export function SelectField<V extends string>({
  value,
  onChange,
  options,
  placeholder = '—',
  id,
  disabled,
}: Props<V>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    const hit = options.find((o) => o.value === value);
    return hit?.label ?? '';
  }, [options, value]);

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
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="app-select flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selectedLabel ? 'truncate' : 'truncate text-slate-400 dark:text-slate-500'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          aria-labelledby={fieldId}
          className="absolute left-0 top-full z-[5000] mt-2 max-h-72 w-full overflow-auto rounded-xl border border-slate-200/90 bg-white shadow-lg dark:border-slate-700/90 dark:bg-slate-900"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={[
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                  'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                  active ? 'bg-blue-50 text-slate-900 dark:bg-blue-950/40 dark:text-white' : 'text-slate-700 dark:text-slate-200',
                ].join(' ')}
              >
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

