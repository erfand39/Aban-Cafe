import { INFLOW_TYPES, OUTFLOW_TYPES } from './format';
import {
  addDaysJalali,
  JALALI_MONTH_NAMES,
  parseJalaliDate,
} from './jalali';
import { calculateMenuItemPricing } from './pricing';
import type { LedgerEntry, Material, MenuItem } from './types';

export interface ProfitLossSummary {
  totalSales: number;
  totalReceipts: number;
  totalInflow: number;
  totalExpenses: number;
  totalPayments: number;
  totalOutflow: number;
  totalManual: number;
  netProfitLoss: number;
  estimatedMenuCogs: number;
  estimatedGrossProfit: number;
  todaySales: number;
  currentMonthSales: number;
  salesOrderCount: number;
}

export interface SalesTrendPoint {
  key: string;
  label: string;
  sales: number;
  outflow: number;
  net: number;
  unitsSold: number;
}

export interface TopSellingItem {
  key: string;
  name: string;
  quantity: number;
  revenue: number;
  sharePercent: number;
}

export function calculateProfitLossSummary(
  entries: LedgerEntry[],
  menuItems: MenuItem[],
  materials: Material[],
  todayJalali: string
): ProfitLossSummary {
  const matMap = new Map(materials.map((m) => [m.id, m]));
  const cogsByItemId = new Map<number, number>();
  for (const item of menuItems) {
    cogsByItemId.set(item.id, calculateMenuItemPricing(item, matMap).costOfGoods);
  }

  const currentMonthPrefix = todayJalali.slice(0, 7); // YYYY/MM

  let totalSales = 0;
  let totalReceipts = 0;
  let totalExpenses = 0;
  let totalPayments = 0;
  let totalManual = 0;
  let estimatedMenuCogs = 0;
  let todaySales = 0;
  let currentMonthSales = 0;
  let salesOrderCount = 0;

  for (const e of entries) {
    const amt = Number.isFinite(e.totalAmount) ? e.totalAmount : 0;
    if (e.entryType === 'sale') {
      totalSales += amt;
      salesOrderCount += 1;
      if (e.jalaliDate === todayJalali) todaySales += amt;
      if (e.jalaliDate.startsWith(currentMonthPrefix)) currentMonthSales += amt;
      if (e.menuItemId !== null && cogsByItemId.has(e.menuItemId)) {
        const unitCogs = cogsByItemId.get(e.menuItemId) ?? 0;
        estimatedMenuCogs += unitCogs * Math.max(0, e.quantity);
      }
    } else if (e.entryType === 'receipt') {
      totalReceipts += amt;
    } else if (e.entryType === 'expense') {
      totalExpenses += amt;
    } else if (e.entryType === 'payment') {
      totalPayments += amt;
    } else if (e.entryType === 'manual') {
      totalManual += amt;
    }
  }

  const totalInflow = totalSales + totalReceipts;
  const totalOutflow = totalExpenses + totalPayments;
  const netProfitLoss = totalInflow - totalOutflow;
  const estimatedGrossProfit = totalSales - Math.round(estimatedMenuCogs);

  return {
    totalSales: Math.round(totalSales),
    totalReceipts: Math.round(totalReceipts),
    totalInflow: Math.round(totalInflow),
    totalExpenses: Math.round(totalExpenses),
    totalPayments: Math.round(totalPayments),
    totalOutflow: Math.round(totalOutflow),
    totalManual: Math.round(totalManual),
    netProfitLoss: Math.round(netProfitLoss),
    estimatedMenuCogs: Math.round(estimatedMenuCogs),
    estimatedGrossProfit: Math.round(estimatedGrossProfit),
    todaySales: Math.round(todaySales),
    currentMonthSales: Math.round(currentMonthSales),
    salesOrderCount,
  };
}

export function buildDailySalesTrend(
  entries: LedgerEntry[],
  todayJalali: string,
  days = 7
): SalesTrendPoint[] {
  const safeDays = Math.max(1, days);
  const buckets = new Map<string, SalesTrendPoint>();

  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const dateStr = addDaysJalali(todayJalali, -offset);
    const parsed = parseJalaliDate(dateStr);
    const label = parsed
      ? `${parsed.jd} ${JALALI_MONTH_NAMES[parsed.jm - 1]}`
      : dateStr;
    buckets.set(dateStr, {
      key: dateStr,
      label,
      sales: 0,
      outflow: 0,
      net: 0,
      unitsSold: 0,
    });
  }

  for (const e of entries) {
    const bucket = buckets.get(e.jalaliDate);
    if (!bucket) continue;
    if (e.entryType === 'sale') {
      bucket.sales += e.totalAmount;
      bucket.unitsSold += e.quantity;
    } else if (OUTFLOW_TYPES.includes(e.entryType)) {
      bucket.outflow += e.totalAmount;
    }
    if (INFLOW_TYPES.includes(e.entryType)) {
      bucket.net += e.totalAmount;
    } else if (OUTFLOW_TYPES.includes(e.entryType)) {
      bucket.net -= e.totalAmount;
    }
  }

  return Array.from(buckets.values());
}

export function buildMonthlySalesTrend(
  entries: LedgerEntry[],
  todayJalali: string,
  months = 6
): SalesTrendPoint[] {
  const parsedToday = parseJalaliDate(todayJalali) ?? { jy: 1405, jm: 8, jd: 1 };
  const safeMonths = Math.max(1, months);
  const buckets = new Map<string, SalesTrendPoint>();

  for (let offset = safeMonths - 1; offset >= 0; offset -= 1) {
    let totalMonths = parsedToday.jy * 12 + (parsedToday.jm - 1) - offset;
    const jy = Math.floor(totalMonths / 12);
    const jm = (totalMonths % 12) + 1;
    const key = `${String(jy).padStart(4, '0')}/${String(jm).padStart(2, '0')}`;
    buckets.set(key, {
      key,
      label: JALALI_MONTH_NAMES[jm - 1],
      sales: 0,
      outflow: 0,
      net: 0,
      unitsSold: 0,
    });
  }

  for (const e of entries) {
    const monthKey = e.jalaliDate.slice(0, 7);
    const bucket = buckets.get(monthKey);
    if (!bucket) continue;
    if (e.entryType === 'sale') {
      bucket.sales += e.totalAmount;
      bucket.unitsSold += e.quantity;
    } else if (OUTFLOW_TYPES.includes(e.entryType)) {
      bucket.outflow += e.totalAmount;
    }
    if (INFLOW_TYPES.includes(e.entryType)) {
      bucket.net += e.totalAmount;
    } else if (OUTFLOW_TYPES.includes(e.entryType)) {
      bucket.net -= e.totalAmount;
    }
  }

  return Array.from(buckets.values());
}

export function buildTopSellingItems(
  entries: LedgerEntry[],
  limit = 6
): TopSellingItem[] {
  const grouped = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const e of entries) {
    if (e.entryType !== 'sale') continue;
    const itemName = e.menuItemName.trim();
    if (!itemName) continue;
    const key = e.menuItemId !== null ? `id:${e.menuItemId}` : `name:${itemName}`;
    const existing = grouped.get(key) ?? { name: itemName, quantity: 0, revenue: 0 };
    existing.quantity += Math.max(0, e.quantity);
    existing.revenue += Math.max(0, e.totalAmount);
    grouped.set(key, existing);
  }

  const list = Array.from(grouped.entries())
    .map(([key, val]) => ({ key, ...val }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, Math.max(1, limit));

  const totalUnits = list.reduce((sum, item) => sum + item.quantity, 0);

  return list.map((item) => ({
    ...item,
    sharePercent: totalUnits > 0 ? (item.quantity / totalUnits) * 100 : 0,
  }));
}
