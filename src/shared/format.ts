import type { DigitMode, LedgerEntryType, PersonRole } from './types';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

export function toEnglishDigits(input: string): string {
  let result = String(input);
  for (let i = 0; i < 10; i++) {
    result = result.replaceAll(PERSIAN_DIGITS[i], String(i));
    result = result.replaceAll(ARABIC_DIGITS[i], String(i));
  }
  return result;
}

export function formatDigits(input: string | number, mode: DigitMode): string {
  const str = String(input);
  return mode === 'fa' ? toPersianDigits(str) : toEnglishDigits(str);
}

export function formatNumber(
  value: number,
  mode: DigitMode = 'fa',
  maxFractionDigits = 0
): string {
  const safe = Number.isFinite(value) ? value : 0;
  const isNeg = safe < 0;
  const absVal = Math.abs(safe);
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxFractionDigits,
  }).format(maxFractionDigits === 0 ? Math.round(absVal) : absVal);
  const localized = formatDigits(formatted, mode);
  return isNeg ? `\u2066-${localized}\u2069` : localized;
}

export function formatCurrency(value: number, mode: DigitMode = 'fa'): string {
  return `${formatNumber(value, mode, 0)} تومان`;
}

export function parseNumericInput(raw: string | number): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  const normalized = toEnglishDigits(raw)
    .replace(/[٬,،\s]/g, '')
    .replace(/[^\d.-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const LEDGER_TYPE_LABELS: Record<LedgerEntryType, string> = {
  sale: 'فروش',
  receipt: 'دریافت',
  payment: 'پرداخت',
  expense: 'هزینه',
  manual: 'ثبت آزاد',
};

export const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
  customer: 'مشتری',
  supplier: 'تأمین‌کننده',
  staff: 'پرسنل',
  other: 'سایر',
};

export const INFLOW_TYPES: LedgerEntryType[] = ['sale', 'receipt'];
export const OUTFLOW_TYPES: LedgerEntryType[] = ['payment', 'expense'];
