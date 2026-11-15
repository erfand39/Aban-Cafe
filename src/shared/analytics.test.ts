import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailySalesTrend,
  buildMonthlySalesTrend,
  buildTopSellingItems,
  calculateProfitLossSummary,
} from './analytics';
import type { LedgerEntry, Material, MenuItem } from './types';

const materials: Material[] = [
  {
    id: 1,
    name: 'قهوه',
    purchaseUnit: 'کیلوگرم',
    purchasePrice: 1_200_000,
    baseQuantity: 1000,
    consumptionUnit: 'گرم',
    conversionFactor: 1000,
    isAvailable: true,
    isZeroCost: false,
    notes: '',
    updatedAt: '',
  },
];

const menuItems: MenuItem[] = [
  {
    id: 10,
    name: 'اسپرسو',
    category: 'گرم',
    isActive: true,
    overheadMode: 'fixed',
    overheadFixed: 4000,
    overheadPercent: 0,
    overheadItems: [],
    laborMode: 'fixed',
    laborFixed: 5000,
    prepMinutes: 0,
    laborRatePerMinute: 0,
    profitMode: 'percent',
    profitValue: 40,
    notes: '',
    ingredients: [{ materialId: 1, quantity: 18, notes: '' }],
    updatedAt: '',
  },
];

const entries: LedgerEntry[] = [
  {
    id: 1,
    entryType: 'sale',
    menuItemId: 10,
    menuItemName: 'اسپرسو',
    personId: null,
    personName: 'مشتری ۱',
    personRole: 'customer',
    quantity: 3,
    unitPrice: 42840,
    totalAmount: 128520,
    jalaliDate: '1405/08/24',
    description: '',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    entryType: 'sale',
    menuItemId: 11,
    menuItemName: 'لاته',
    personId: null,
    personName: 'مشتری ۲',
    personRole: 'customer',
    quantity: 5,
    unitPrice: 60000,
    totalAmount: 300000,
    jalaliDate: '1405/08/23',
    description: '',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 3,
    entryType: 'expense',
    menuItemId: null,
    menuItemName: '',
    personId: null,
    personName: 'تامین',
    personRole: 'supplier',
    quantity: 1,
    unitPrice: 200000,
    totalAmount: 200000,
    jalaliDate: '1405/08/24',
    description: '',
    createdAt: '',
    updatedAt: '',
  },
];

test('computes profit & loss summary, today sales, and monthly sales accurately', () => {
  const summary = calculateProfitLossSummary(entries, menuItems, materials, '1405/08/24');
  assert.equal(summary.totalSales, 428520);
  assert.equal(summary.totalOutflow, 200000);
  assert.equal(summary.netProfitLoss, 228520);
  assert.equal(summary.todaySales, 128520);
  assert.equal(summary.currentMonthSales, 428520);
  // Espresso COGS = 30,600 * 3 = 91,800
  assert.equal(summary.estimatedMenuCogs, 91800);
});

test('builds 7-day daily sales trend and 6-month trend', () => {
  const daily = buildDailySalesTrend(entries, '1405/08/24', 7);
  assert.equal(daily.length, 7);
  assert.equal(daily[6].key, '1405/08/24');
  assert.equal(daily[6].sales, 128520);
  assert.equal(daily[6].outflow, 200000);
  assert.equal(daily[5].key, '1405/08/23');
  assert.equal(daily[5].sales, 300000);

  const monthly = buildMonthlySalesTrend(entries, '1405/08/24', 6);
  assert.equal(monthly.length, 6);
  assert.equal(monthly[5].key, '1405/08');
  assert.equal(monthly[5].sales, 428520);
});

test('ranks top selling items by quantity descending', () => {
  const top = buildTopSellingItems(entries, 5);
  assert.equal(top.length, 2);
  assert.equal(top[0].name, 'لاته');
  assert.equal(top[0].quantity, 5);
  assert.equal(top[1].name, 'اسپرسو');
  assert.equal(top[1].quantity, 3);
});

test('handles empty ledger safely without NaN', () => {
  const emptySummary = calculateProfitLossSummary([], menuItems, materials, '1405/08/24');
  assert.equal(emptySummary.netProfitLoss, 0);
  assert.equal(buildTopSellingItems([], 5).length, 0);
});
