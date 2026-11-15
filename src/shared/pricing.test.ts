import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateIngredientLineCost,
  calculateLedgerTotal,
  calculateMaterialUnitCost,
  calculateMenuItemPricing,
} from './pricing';
import type { Material, MenuItem } from './types';

const coffee: Material = {
  id: 1,
  name: 'دانه قهوه عربیکا',
  purchaseUnit: 'کیلوگرم',
  purchasePrice: 1_200_000,
  baseQuantity: 1000,
  consumptionUnit: 'گرم',
  conversionFactor: 1000,
  isAvailable: true,
  isZeroCost: false,
  notes: '',
  updatedAt: '2026-11-15',
};

const milk: Material = {
  id: 2,
  name: 'شیر تازه',
  purchaseUnit: 'لیتر',
  purchasePrice: 60_000,
  baseQuantity: 1000,
  consumptionUnit: 'میلی‌لیتر',
  conversionFactor: 1000,
  isAvailable: true,
  isZeroCost: false,
  notes: '',
  updatedAt: '2026-11-15',
};

const cocoa: Material = {
  id: 3,
  name: 'پودر شکلات',
  purchaseUnit: 'کیلوگرم',
  purchasePrice: 400_000,
  baseQuantity: 1000,
  consumptionUnit: 'گرم',
  conversionFactor: 1000,
  isAvailable: true,
  isZeroCost: false,
  notes: '',
  updatedAt: '2026-11-15',
};

const water: Material = {
  id: 4,
  name: 'آب تصفیه',
  purchaseUnit: 'لیتر',
  purchasePrice: 0,
  baseQuantity: 1000,
  consumptionUnit: 'میلی‌لیتر',
  conversionFactor: 1000,
  isAvailable: true,
  isZeroCost: true,
  notes: 'صرفاً توضیحی',
  updatedAt: '2026-11-15',
};

const materialsMap = new Map<number, Material>([
  [1, coffee],
  [2, milk],
  [3, cocoa],
  [4, water],
]);

test('calculates coffee unit cost and 18g shot cost accurately', () => {
  assert.equal(calculateMaterialUnitCost(coffee), 1200);
  assert.equal(calculateIngredientLineCost(coffee, 18), 21_600);
});

test('zero-cost explanatory material returns 0', () => {
  assert.equal(calculateIngredientLineCost(water, 120), 0);
});

test('calculates cappuccino recipe with itemized overhead, fixed labor, and percent profit', () => {
  const cappuccino: MenuItem = {
    id: 10,
    name: 'کاپوچینو',
    category: 'نوشیدنی گرم بر پایه اسپرسو',
    isActive: true,
    overheadMode: 'fixed',
    overheadFixed: 5000,
    overheadPercent: 10,
    overheadItems: [
      { title: 'استهلاک دستگاه', amount: 2500 },
      { title: 'آب، برق و گاز', amount: 1500 },
      { title: 'بسته‌بندی', amount: 1000 },
    ],
    laborMode: 'fixed',
    laborFixed: 8000,
    prepMinutes: 3,
    laborRatePerMinute: 3000,
    profitMode: 'percent',
    profitValue: 30,
    notes: '',
    ingredients: [
      { materialId: 1, quantity: 18, notes: '۱ شات اسپرسو' }, // 21,600
      { materialId: 2, quantity: 150, notes: 'فوم شیر' }, // 9,000
      { materialId: 3, quantity: 3, notes: 'تزئین' }, // 1,200
    ],
    updatedAt: '2026-11-15',
  };

  const breakdown = calculateMenuItemPricing(cappuccino, materialsMap);
  assert.equal(breakdown.materialsCost, 31_800);
  assert.equal(breakdown.overheadCost, 5_000);
  assert.equal(breakdown.laborCost, 8_000);
  assert.equal(breakdown.costOfGoods, 44_800);
  assert.equal(breakdown.profitAmount, 13_440); // 30% of 44,800
  assert.equal(breakdown.sellingPrice, 58_240);
});

test('calculates percentage overhead, timed labor, and fixed profit', () => {
  const espresso: MenuItem = {
    id: 11,
    name: 'اسپرسو',
    category: 'نوشیدنی گرم',
    isActive: true,
    overheadMode: 'percent',
    overheadFixed: 0,
    overheadPercent: 10, // 10% of 21,600 = 2,160
    overheadItems: [],
    laborMode: 'timed',
    laborFixed: 5000,
    prepMinutes: 2,
    laborRatePerMinute: 2500, // 5,000
    profitMode: 'fixed',
    profitValue: 15_000,
    notes: '',
    ingredients: [{ materialId: 1, quantity: 18, notes: '' }],
    updatedAt: '2026-11-15',
  };

  const breakdown = calculateMenuItemPricing(espresso, materialsMap);
  assert.equal(breakdown.materialsCost, 21_600);
  assert.equal(breakdown.overheadCost, 2_160);
  assert.equal(breakdown.laborCost, 5_000);
  assert.equal(breakdown.costOfGoods, 28_760);
  assert.equal(breakdown.profitAmount, 15_000);
  assert.equal(breakdown.sellingPrice, 43_760);
});

test('calculates ledger total safely', () => {
  assert.equal(calculateLedgerTotal(3, 58_240), 174_720);
  assert.equal(calculateLedgerTotal(-2, 50_000), 0);
});
