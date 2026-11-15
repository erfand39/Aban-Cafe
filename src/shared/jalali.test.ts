import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysJalali,
  formatJalaliDisplay,
  formatJalaliLong,
  getJalaliMonthLength,
  gregorianToJalali,
  isJalaliLeapYear,
  isValidJalaliDate,
  jalaliToGregorian,
  parseJalaliDate,
} from './jalali';
import { formatCurrency, formatNumber, parseNumericInput } from './format';

test('converts Gregorian 2026-11-15 to Jalali 1405/08/24 and back', () => {
  const j = gregorianToJalali(2026, 11, 15);
  assert.deepEqual(j, { jy: 1405, jm: 8, jd: 24 });

  const g = jalaliToGregorian(1405, 8, 24);
  assert.deepEqual(g, { gy: 2026, gm: 11, gd: 15 });
});

test('validates Jalali leap year lengths accurately', () => {
  assert.equal(isJalaliLeapYear(1403), true);
  assert.equal(getJalaliMonthLength(1403, 12), 30);
  assert.equal(isJalaliLeapYear(1404), false);
  assert.equal(getJalaliMonthLength(1404, 12), 29);
  assert.equal(isValidJalaliDate(1404, 12, 30), false);
  assert.equal(isValidJalaliDate(1403, 12, 30), true);
});

test('parses and formats Jalali dates with Persian digits', () => {
  const parsed = parseJalaliDate('۱۴۰۵/۰۸/۲۴');
  assert.deepEqual(parsed, { jy: 1405, jm: 8, jd: 24 });
  assert.equal(formatJalaliDisplay('1405/08/24', 'fa'), '۱۴۰۵/۰۸/۲۴');
  assert.equal(formatJalaliDisplay('1405/08/24', 'en'), '1405/08/24');
  assert.match(formatJalaliLong('1405/08/24', 'fa'), /آبان/);
  assert.equal(addDaysJalali('1405/08/24', -1), '1405/08/23');
});

test('formats numbers and parses Persian numeric strings', () => {
  assert.equal(formatNumber(1_200_000, 'fa'), '۱,۲۰۰,۰۰۰');
  assert.equal(formatNumber(1_200_000, 'en'), '1,200,000');
  assert.equal(formatCurrency(31_800, 'fa'), '۳۱,۸۰۰ تومان');
  assert.equal(parseNumericInput('۱,۲۰۰,۰۰۰'), 1_200_000);
});
