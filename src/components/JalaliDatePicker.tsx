import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDigits } from '../shared/format';
import {
  formatJalaliDate,
  formatJalaliDisplay,
  getJalaliMonthFirstWeekday,
  getJalaliMonthLength,
  getTodayJalali,
  getTodayJalaliString,
  JALALI_MONTH_NAMES,
  JALALI_WEEKDAYS_SHORT,
  parseJalaliDate,
} from '../shared/jalali';
import type { DigitMode } from '../shared/types';

interface JalaliDatePickerProps {
  id?: string;
  label: string;
  value: string;
  onChange: (jalaliDate: string) => void;
  digitMode: DigitMode;
  allowClear?: boolean;
  placeholder?: string;
  error?: string;
}

export function JalaliDatePicker({
  id,
  label,
  value,
  onChange,
  digitMode,
  allowClear = false,
  placeholder = 'انتخاب تاریخ...',
  error,
}: JalaliDatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => getTodayJalali(), []);
  const parsedValue = useMemo(() => parseJalaliDate(value), [value]);

  const [viewYear, setViewYear] = useState(parsedValue?.jy ?? today.jy);
  const [viewMonth, setViewMonth] = useState(parsedValue?.jm ?? today.jm);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.jy);
      setViewMonth(parsedValue.jm);
    }
  }, [parsedValue]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const daysInMonth = useMemo(
    () => getJalaliMonthLength(viewYear, viewMonth),
    [viewYear, viewMonth]
  );
  const firstWeekday = useMemo(
    () => getJalaliMonthFirstWeekday(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const cells = useMemo(() => {
    const arr: Array<number | null> = [];
    for (let i = 0; i < firstWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [firstWeekday, daysInMonth]);

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
      >
        {label}
      </label>

      <button
        id={id}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full min-h-[42px] flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border text-right transition-colors cursor-pointer bg-white dark:bg-[#191614] ${
          error
            ? 'border-[#B83B2E]'
            : 'border-[#DDD6CC] dark:border-[#342E29] hover:border-[#6F4E37] dark:hover:border-[#C89B6E]'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Calendar className="w-4 h-4 text-[#786D65] dark:text-[#A3988E] shrink-0" />
          <span
            className={`tabular-nums truncate ${
              value
                ? 'text-[#1F1B18] dark:text-[#F3EFEA] font-medium'
                : 'text-[#8C8178] dark:text-[#7F756C]'
            }`}
          >
            {value ? formatJalaliDisplay(value, digitMode) : placeholder}
          </span>
        </span>
        {allowClear && value && (
          <span
            role="button"
            tabIndex={-1}
            aria-label={`پاک کردن ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="p-0.5 rounded hover:bg-[#EFEAE2] dark:hover:bg-[#2C2623] text-[#786D65]"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {error && <p className="text-xs text-[#B83B2E] dark:text-[#EF7B6E]">{error}</p>}

      {open && (
        <div className="absolute top-full mt-1.5 right-0 z-50 w-72 rounded-xl border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#1F1B18] shadow-xl p-3">
          {/* Header Month & Year Navigation */}
          <div className="flex items-center justify-between gap-1 pb-2.5 mb-2 border-b border-[#EFEAE2] dark:border-[#2E2924]">
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label="ماه قبل"
              className="p-1.5 rounded-lg hover:bg-[#F5EFE8] dark:hover:bg-[#2B241F] text-[#5C534D] dark:text-[#D5CCC3] cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                aria-label="انتخاب ماه شمسی"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="text-sm font-semibold bg-transparent text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none cursor-pointer"
              >
                {JALALI_MONTH_NAMES.map((mName, idx) => (
                  <option
                    key={mName}
                    value={idx + 1}
                    className="bg-white dark:bg-[#1F1B18]"
                  >
                    {mName}
                  </option>
                ))}
              </select>
              <select
                aria-label="انتخاب سال شمسی"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="text-sm font-semibold tabular-nums bg-transparent text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 11 }, (_, i) => today.jy - 5 + i).map((yr) => (
                  <option key={yr} value={yr} className="bg-white dark:bg-[#1F1B18]">
                    {formatDigits(yr, digitMode)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={goNextMonth}
              aria-label="ماه بعد"
              className="p-1.5 rounded-lg hover:bg-[#F5EFE8] dark:hover:bg-[#2B241F] text-[#5C534D] dark:text-[#D5CCC3] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {JALALI_WEEKDAYS_SHORT.map((wd) => (
              <div
                key={wd}
                className="text-[11px] font-semibold text-[#8C8178] dark:text-[#9A8F85] py-1"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              const isSelected =
                parsedValue?.jy === viewYear &&
                parsedValue?.jm === viewMonth &&
                parsedValue?.jd === day;
              const isToday =
                today.jy === viewYear && today.jm === viewMonth && today.jd === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    onChange(formatJalaliDate(viewYear, viewMonth, day));
                    setOpen(false);
                  }}
                  className={`h-8 rounded-lg text-xs tabular-nums transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410] font-bold'
                      : isToday
                      ? 'border border-[#6F4E37] dark:border-[#C89B6E] text-[#6F4E37] dark:text-[#C89B6E] font-bold hover:bg-[#F5EFE8] dark:hover:bg-[#2B241F]'
                      : 'text-[#1F1B18] dark:text-[#F3EFEA] hover:bg-[#F5EFE8] dark:hover:bg-[#2B241F]'
                  }`}
                >
                  {formatDigits(day, digitMode)}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 pt-2 border-t border-[#EFEAE2] dark:border-[#2E2924] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onChange(getTodayJalaliString());
                setOpen(false);
              }}
              className="text-xs font-semibold text-[#6F4E37] dark:text-[#C89B6E] hover:underline cursor-pointer"
            >
              انتخاب امروز ({formatJalaliDisplay(getTodayJalaliString(), digitMode)})
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-[#786D65] dark:text-[#A3988E] hover:text-[#1F1B18] dark:hover:text-[#F3EFEA] cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
