import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
  subtitle?: string;
  group?: string;
  disabled?: boolean;
}

interface SearchableSelectProps<T extends string | number> {
  id?: string;
  label: string;
  value: T | null;
  options: SelectOption<T>[];
  placeholder?: string;
  searchPlaceholder?: string;
  onChange: (value: T | null, option?: SelectOption<T>) => void;
  allowClear?: boolean;
  allowCustomText?: boolean;
  customText?: string;
  onCustomTextChange?: (text: string) => void;
  emptyText?: string;
  error?: string;
}

export function SearchableSelect<T extends string | number>({
  id,
  label,
  value,
  options,
  placeholder = 'انتخاب کنید...',
  searchPlaceholder = 'جستجو...',
  onChange,
  allowClear = false,
  allowCustomText = false,
  customText = '',
  onCustomTextChange,
  emptyText = 'موردی یافت نشد',
  error,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    } else {
      setQuery('');
    }
  }, [open]);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(q)) ||
        (opt.group && opt.group.toLowerCase().includes(q))
    );
  }, [options, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, SelectOption<T>[]>();
    for (const opt of filtered) {
      const g = opt.group || '';
      const arr = map.get(g) ?? [];
      arr.push(opt);
      map.set(g, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const displayLabel = selectedOption
    ? selectedOption.label
    : allowCustomText && customText.trim()
    ? customText
    : '';

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <button
          id={id}
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`w-full min-h-[42px] flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border text-right transition-colors cursor-pointer bg-white dark:bg-[#191614] ${
            error
              ? 'border-[#B83B2E] focus-visible:outline-2 focus-visible:outline-[#B83B2E]'
              : 'border-[#DDD6CC] dark:border-[#342E29] hover:border-[#6F4E37] dark:hover:border-[#C89B6E] focus-visible:outline-2 focus-visible:outline-[#6F4E37]'
          }`}
        >
          <span
            className={`truncate ${
              displayLabel
                ? 'text-[#1F1B18] dark:text-[#F3EFEA] font-medium'
                : 'text-[#8C8178] dark:text-[#7F756C]'
            }`}
          >
            {displayLabel || placeholder}
          </span>
          <span className="flex items-center gap-1 shrink-0 text-[#786D65] dark:text-[#A3988E]">
            {allowClear && (value !== null || (allowCustomText && customText.trim())) && (
              <span
                role="button"
                tabIndex={-1}
                aria-label={`پاک کردن ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                  onCustomTextChange?.('');
                }}
                className="p-0.5 rounded hover:bg-[#EFEAE2] dark:hover:bg-[#2C2623]"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </span>
        </button>
      </div>

      {error && <p className="text-xs text-[#B83B2E] dark:text-[#EF7B6E]">{error}</p>}

      {open && (
        <div
          role="listbox"
          className="absolute top-full mt-1.5 right-0 left-0 z-50 rounded-xl border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#1F1B18] shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-[#EFEAE2] dark:border-[#2E2924] flex items-center gap-2">
            <Search className="w-4 h-4 text-[#8C8178] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter' && allowCustomText && query.trim() && filtered.length === 0) {
                  e.preventDefault();
                  onChange(null);
                  onCustomTextChange?.(query.trim());
                  setOpen(false);
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full text-sm bg-transparent text-[#1F1B18] dark:text-[#F3EFEA] placeholder:text-[#9A8F85] focus:outline-none"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {allowCustomText && query.trim() && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  onCustomTextChange?.(query.trim());
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-right text-sm flex items-center justify-between gap-2 text-[#6F4E37] dark:text-[#C89B6E] hover:bg-[#F7F3ED] dark:hover:bg-[#292420] border-b border-[#EFEAE2] dark:border-[#2E2924]"
              >
                <span>ثبت با نام جدید: «{query.trim()}»</span>
              </button>
            )}

            {grouped.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[#8C8178] dark:text-[#9A8F85]">
                {emptyText}
              </div>
            ) : (
              grouped.map(([groupName, groupOpts]) => (
                <div key={groupName || '_default'}>
                  {groupName && (
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-[#8C8178] dark:text-[#9A8F85] bg-[#FAF8F5] dark:bg-[#171412]">
                      {groupName}
                    </div>
                  )}
                  {groupOpts.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        disabled={opt.disabled}
                        onClick={() => {
                          onChange(opt.value, opt);
                          onCustomTextChange?.(opt.label);
                          setOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-right text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          opt.disabled
                            ? 'opacity-45 cursor-not-allowed'
                            : isSelected
                            ? 'bg-[#F5EFE8] dark:bg-[#2B241F] text-[#5C3D28] dark:text-[#E8C5A0] font-medium'
                            : 'text-[#1F1B18] dark:text-[#F3EFEA] hover:bg-[#FAF8F5] dark:hover:bg-[#26211D]'
                        }`}
                      >
                        <div className="flex flex-col items-start min-w-0">
                          <span className="truncate max-w-full">{opt.label}</span>
                          {opt.subtitle && (
                            <span className="text-xs text-[#786D65] dark:text-[#9A8F85] truncate">
                              {opt.subtitle}
                            </span>
                          )}
                        </div>
                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
