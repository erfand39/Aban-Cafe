import type { DigitMode } from './types';
import { formatDigits, toEnglishDigits } from './format';

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const JALALI_WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
];

export const JALALI_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export interface JalaliDateParts {
  jy: number;
  jm: number;
  jd: number;
}

export interface GregorianDateParts {
  gy: number;
  gm: number;
  gd: number;
}

function div(a: number, b: number): number {
  return ~~(a / b);
}

function mod(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

const JALALI_BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192,
  2262, 2324, 2394, 2456, 3178,
];

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const bl = JALALI_BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = JALALI_BREAKS[0];
  let jm = 0;
  let jump = 0;

  if (jy < jp || jy >= JALALI_BREAKS[bl - 1]) {
    throw new Error(`Invalid Jalali year ${jy}`);
  }

  for (let i = 1; i < bl; i += 1) {
    jm = JALALI_BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) {
    leapJ += 1;
  }

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) {
    n = n - jump + div(jump + 4, 33) * 33;
  }
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) {
    leap = 4;
  }

  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): GregorianDateParts {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): JalaliDateParts {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm = 0;
  let jd = 0;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDateParts {
  return d2j(g2d(gy, gm, gd));
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDateParts {
  return d2g(j2d(jy, jm, jd));
}

export function isJalaliLeapYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

export function getJalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

export function isValidJalaliDate(jy: number, jm: number, jd: number): boolean {
  if (jy < 1300 || jy > 1500) return false;
  if (jm < 1 || jm > 12) return false;
  return jd >= 1 && jd <= getJalaliMonthLength(jy, jm);
}

/**
 * Returns 0 for Saturday (شنبه) ... 6 for Friday (جمعه)
 */
export function getJalaliWeekday(jy: number, jm: number, jd: number): number {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  const jsDay = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay(); // 0=Sun..6=Sat
  return (jsDay + 1) % 7; // 0=Sat..6=Fri
}

export function getJalaliMonthFirstWeekday(jy: number, jm: number): number {
  return getJalaliWeekday(jy, jm, 1);
}

export function formatJalaliDate(jy: number, jm: number, jd: number): string {
  const y = String(jy).padStart(4, '0');
  const m = String(jm).padStart(2, '0');
  const d = String(jd).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

export function parseJalaliDate(str: string): JalaliDateParts | null {
  const cleaned = toEnglishDigits(str).trim().replaceAll('-', '/');
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(cleaned);
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (!isValidJalaliDate(jy, jm, jd)) return null;
  return { jy, jm, jd };
}

export function getTodayJalali(now: Date = new Date()): JalaliDateParts {
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function getTodayJalaliString(now: Date = new Date()): string {
  const { jy, jm, jd } = getTodayJalali(now);
  return formatJalaliDate(jy, jm, jd);
}

export function addDaysJalali(jalaliStr: string, deltaDays: number): string {
  const parsed = parseJalaliDate(jalaliStr);
  if (!parsed) return getTodayJalaliString();
  const { gy, gm, gd } = jalaliToGregorian(parsed.jy, parsed.jm, parsed.jd);
  const dt = new Date(Date.UTC(gy, gm - 1, gd + deltaDays));
  const next = gregorianToJalali(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  return formatJalaliDate(next.jy, next.jm, next.jd);
}

export function formatJalaliDisplay(jalaliStr: string, mode: DigitMode = 'fa'): string {
  const parsed = parseJalaliDate(jalaliStr);
  if (!parsed) return formatDigits(jalaliStr, mode);
  return formatDigits(formatJalaliDate(parsed.jy, parsed.jm, parsed.jd), mode);
}

export function formatJalaliLong(jalaliStr: string, mode: DigitMode = 'fa'): string {
  const parsed = parseJalaliDate(jalaliStr);
  if (!parsed) return formatDigits(jalaliStr, mode);
  const weekday = JALALI_WEEKDAYS[getJalaliWeekday(parsed.jy, parsed.jm, parsed.jd)];
  const monthName = JALALI_MONTH_NAMES[parsed.jm - 1];
  return formatDigits(`${weekday}، ${parsed.jd} ${monthName} ${parsed.jy}`, mode);
}
