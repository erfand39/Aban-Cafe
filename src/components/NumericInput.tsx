import { useEffect, useState } from 'react';
import { formatDigits, formatNumber, parseNumericInput, toEnglishDigits } from '../shared/format';
import type { DigitMode } from '../shared/types';

interface NumericInputProps {
  id?: string;
  label?: string;
  ariaLabel?: string;
  value: number;
  onChange: (value: number) => void;
  digitMode: DigitMode;
  suffix?: string;
  allowDecimal?: boolean;
  min?: number;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  compact?: boolean;
}

export function NumericInput({
  id,
  label,
  ariaLabel,
  value,
  onChange,
  digitMode,
  suffix,
  allowDecimal = false,
  min = 0,
  placeholder,
  disabled = false,
  error,
  compact = false,
}: NumericInputProps) {
  const [focused, setFocused] = useState(false);
  const [rawText, setRawText] = useState('');

  useEffect(() => {
    if (!focused) {
      setRawText(
        value === 0 && placeholder
          ? formatNumber(0, digitMode, allowDecimal ? 2 : 0)
          : formatNumber(value, digitMode, allowDecimal ? 2 : 0)
      );
    }
  }, [value, digitMode, focused, allowDecimal, placeholder]);

  const handleFocus = () => {
    setFocused(true);
    setRawText(value === 0 ? '' : String(value));
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseNumericInput(rawText);
    const clamped = min !== undefined ? Math.max(min, parsed) : parsed;
    onChange(clamped);
    setRawText(formatNumber(clamped, digitMode, allowDecimal ? 2 : 0));
  };

  const handleChange = (val: string) => {
    const cleaned = toEnglishDigits(val);
    if (allowDecimal) {
      if (!/^[0-9.,٬،]*$/.test(cleaned)) return;
    } else {
      if (!/^[0-9,٬،]*$/.test(cleaned)) return;
    }
    setRawText(val);
    const parsed = parseNumericInput(cleaned);
    if (!Number.isNaN(parsed)) {
      onChange(min !== undefined ? Math.max(min, parsed) : parsed);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
        >
          {label}
        </label>
      )}
      <div
        className={`flex items-center gap-2 rounded-lg border transition-colors bg-white dark:bg-[#191614] ${
          compact ? 'min-h-[36px] px-2.5 py-1' : 'min-h-[42px] px-3 py-2'
        } ${
          disabled ? 'opacity-60 bg-[#FAF8F5] dark:bg-[#141210]' : ''
        } ${
          error
            ? 'border-[#B83B2E]'
            : 'border-[#DDD6CC] dark:border-[#342E29] focus-within:border-[#6F4E37] dark:focus-within:border-[#C89B6E]'
        }`}
      >
        <input
          id={id}
          aria-label={ariaLabel || label}
          type="text"
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          dir="ltr"
          disabled={disabled}
          value={focused ? formatDigits(rawText, digitMode) : formatNumber(value, digitMode, allowDecimal ? 2 : 0)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-transparent text-left font-mono-num tabular-nums text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        />
        {suffix && (
          <span className="text-xs text-[#786D65] dark:text-[#9A8F85] whitespace-nowrap shrink-0">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-[#B83B2E] dark:text-[#EF7B6E]">{error}</p>}
    </div>
  );
}
