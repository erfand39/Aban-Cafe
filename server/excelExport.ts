import ExcelJS from 'exceljs';
import {
  formatNumber,
  INFLOW_TYPES,
  LEDGER_TYPE_LABELS,
  OUTFLOW_TYPES,
  PERSON_ROLE_LABELS,
} from '../src/shared/format';
import { formatJalaliDisplay, getTodayJalaliString } from '../src/shared/jalali';
import { calculateMaterialUnitCost, calculateMenuItemPricing } from '../src/shared/pricing';
import type { DigitMode, LedgerEntry, Material, MenuItem } from '../src/shared/types';

export async function generateCafeExcelBuffer(params: {
  materials: Material[];
  menuItems: MenuItem[];
  ledgerEntries: LedgerEntry[];
  digitMode: DigitMode;
}): Promise<Buffer> {
  const { materials, menuItems, ledgerEntries, digitMode } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'کافه آبان';
  workbook.created = new Date();

  const matMap = new Map(materials.map((m) => [m.id, m]));
  const todayStr = formatJalaliDisplay(getTodayJalaliString(), digitMode);

  // Sheet 1: آیتم‌ها و قیمت‌گذاری
  const sheetItems = workbook.addWorksheet('آیتم‌ها', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 3 }],
  });

  sheetItems.mergeCells('A1:J1');
  const titleCell1 = sheetItems.getCell('A1');
  titleCell1.value = `کافه آبان — گزارش قیمت‌گذاری منو (تاریخ: ${todayStr})`;
  titleCell1.font = { name: 'Vazirmatn', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A3326' } };
  titleCell1.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetItems.getRow(1).height = 34;

  sheetItems.mergeCells('A2:J2');
  const subCell1 = sheetItems.getCell('A2');
  subCell1.value = 'محاسبه دقیق بهای تمام‌شده بر اساس دستور تهیه، هزینه جانبی، هزینه فرد و سود';
  subCell1.font = { name: 'Vazirmatn', size: 10, color: { argb: 'FF5C3D28' } };
  subCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5EFE8' } };
  subCell1.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetItems.getRow(2).height = 22;

  const itemHeaders = [
    'ردیف',
    'نام آیتم',
    'دسته‌بندی',
    'وضعیت',
    'بهای مواد اولیه (تومان)',
    'هزینه جانبی (تومان)',
    'هزینه فرد (تومان)',
    'بهای تمام‌شده (تومان)',
    'سود (تومان)',
    'قیمت عرضه (تومان)',
  ];
  const headerRow1 = sheetItems.addRow(itemHeaders);
  headerRow1.height = 28;
  headerRow1.eachCell((cell) => {
    cell.font = { name: 'Vazirmatn', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6F4E37' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD6CCC2' } },
      bottom: { style: 'medium', color: { argb: 'FF4A3326' } },
      left: { style: 'thin', color: { argb: 'FFD6CCC2' } },
      right: { style: 'thin', color: { argb: 'FFD6CCC2' } },
    };
  });

  menuItems.forEach((item, index) => {
    const b = calculateMenuItemPricing(item, matMap);
    const row = sheetItems.addRow([
      index + 1,
      item.name,
      item.category,
      item.isActive ? 'فعال' : 'غیرفعال',
      b.materialsCost,
      b.overheadCost,
      b.laborCost,
      b.costOfGoods,
      b.profitAmount,
      b.sellingPrice,
    ]);
    row.height = 24;
    const isEven = index % 2 === 1;
    row.eachCell((cell, colNumber) => {
      cell.font = {
        name: 'Vazirmatn',
        size: 10,
        bold: colNumber === 10 || colNumber === 2,
        color: { argb: colNumber === 10 ? 'FF3D6B4F' : 'FF1F1B18' },
      };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF8F5' } };
      }
      cell.alignment = {
        horizontal: colNumber >= 5 ? 'left' : 'center',
        vertical: 'middle',
      };
      if (colNumber >= 5) {
        cell.numFmt = '#,##0';
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE7E2DA' } },
        bottom: { style: 'thin', color: { argb: 'FFE7E2DA' } },
        left: { style: 'thin', color: { argb: 'FFE7E2DA' } },
        right: { style: 'thin', color: { argb: 'FFE7E2DA' } },
      };
    });
  });

  sheetItems.columns = [
    { width: 8 },
    { width: 22 },
    { width: 24 },
    { width: 12 },
    { width: 22 },
    { width: 20 },
    { width: 18 },
    { width: 22 },
    { width: 18 },
    { width: 22 },
  ];

  // Sheet 2: مواد اولیه
  const sheetMaterials = workbook.addWorksheet('مواد اولیه', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 3 }],
  });

  sheetMaterials.mergeCells('A1:I1');
  const titleCell2 = sheetMaterials.getCell('A1');
  titleCell2.value = `کافه آبان — فهرست مواد اولیه و نرخ مبنا (تاریخ: ${todayStr})`;
  titleCell2.font = { name: 'Vazirmatn', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3D5A45' } };
  titleCell2.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetMaterials.getRow(1).height = 34;

  sheetMaterials.mergeCells('A2:I2');
  const subCell2 = sheetMaterials.getCell('A2');
  subCell2.value = 'قیمت خرید، مقدار مبنا و نرخ هر واحد مصرفی';
  subCell2.font = { name: 'Vazirmatn', size: 10, color: { argb: 'FF3D5A45' } };
  subCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4F0' } };
  subCell2.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetMaterials.getRow(2).height = 22;

  const matHeaders = [
    'ردیف',
    'نام ماده اولیه',
    'واحد خرید',
    'قیمت خرید (تومان)',
    'مقدار مبنا',
    'واحد مصرف',
    'نرخ واحد مصرف (تومان)',
    'وضعیت',
    'توضیحات',
  ];
  const headerRow2 = sheetMaterials.addRow(matHeaders);
  headerRow2.height = 28;
  headerRow2.eachCell((cell) => {
    cell.font = { name: 'Vazirmatn', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B7055' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0DDD3' } },
      bottom: { style: 'medium', color: { argb: 'FF3D5A45' } },
      left: { style: 'thin', color: { argb: 'FFD0DDD3' } },
      right: { style: 'thin', color: { argb: 'FFD0DDD3' } },
    };
  });

  materials.forEach((m, index) => {
    const unitCost = calculateMaterialUnitCost(m);
    const row = sheetMaterials.addRow([
      index + 1,
      m.name,
      m.purchaseUnit,
      m.purchasePrice,
      m.baseQuantity,
      m.consumptionUnit,
      Math.round(unitCost * 100) / 100,
      m.isAvailable ? 'موجود' : 'غیرفعال',
      m.notes || '-',
    ]);
    row.height = 24;
    const isEven = index % 2 === 1;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Vazirmatn', size: 10, bold: colNumber === 2 };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF8F5' } };
      }
      cell.alignment = {
        horizontal: colNumber === 4 || colNumber === 5 || colNumber === 7 ? 'left' : 'center',
        vertical: 'middle',
      };
      if (colNumber === 4 || colNumber === 5 || colNumber === 7) {
        cell.numFmt = '#,##0.##';
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE7E2DA' } },
        bottom: { style: 'thin', color: { argb: 'FFE7E2DA' } },
        left: { style: 'thin', color: { argb: 'FFE7E2DA' } },
        right: { style: 'thin', color: { argb: 'FFE7E2DA' } },
      };
    });
  });

  sheetMaterials.columns = [
    { width: 8 },
    { width: 24 },
    { width: 14 },
    { width: 20 },
    { width: 14 },
    { width: 14 },
    { width: 22 },
    { width: 12 },
    { width: 32 },
  ];

  // Sheet 3: دفتر حساب
  const sheetLedger = workbook.addWorksheet('دفتر حساب', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 3 }],
  });

  sheetLedger.mergeCells('A1:I1');
  const titleCell3 = sheetLedger.getCell('A1');
  titleCell3.value = `کافه آبان — دفتر حساب دفتری (تاریخ گزارش: ${todayStr})`;
  titleCell3.font = { name: 'Vazirmatn', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C2623' } };
  titleCell3.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetLedger.getRow(1).height = 34;

  let totalInflow = 0;
  let totalOutflow = 0;
  let totalManual = 0;
  for (const e of ledgerEntries) {
    if (INFLOW_TYPES.includes(e.entryType)) totalInflow += e.totalAmount;
    else if (OUTFLOW_TYPES.includes(e.entryType)) totalOutflow += e.totalAmount;
    else totalManual += e.totalAmount;
  }

  sheetLedger.mergeCells('A2:I2');
  const subCell3 = sheetLedger.getCell('A2');
  subCell3.value = `جمع دریافتی و فروش: ${formatNumber(totalInflow, digitMode)} تومان   |   جمع پرداخت و هزینه: ${formatNumber(totalOutflow, digitMode)} تومان   |   تراز خالص: ${formatNumber(totalInflow - totalOutflow, digitMode)} تومان`;
  subCell3.font = { name: 'Vazirmatn', size: 10, bold: true, color: { argb: 'FF2C2623' } };
  subCell3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3ECE4' } };
  subCell3.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetLedger.getRow(2).height = 24;

  const ledgerHeaders = [
    'ردیف',
    'تاریخ شمسی',
    'نوع ثبت',
    'آیتم',
    'فرد / طرف حساب',
    'تعداد',
    'مبلغ واحد (تومان)',
    'مبلغ کل (تومان)',
    'توضیحات',
  ];
  const headerRow3 = sheetLedger.addRow(ledgerHeaders);
  headerRow3.height = 28;
  headerRow3.eachCell((cell) => {
    cell.font = { name: 'Vazirmatn', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5C3D28' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD6CCC2' } },
      bottom: { style: 'medium', color: { argb: 'FF2C2623' } },
      left: { style: 'thin', color: { argb: 'FFD6CCC2' } },
      right: { style: 'thin', color: { argb: 'FFD6CCC2' } },
    };
  });

  ledgerEntries.forEach((entry, index) => {
    const personLabel = entry.personName
      ? `${entry.personName} (${PERSON_ROLE_LABELS[entry.personRole] || 'سایر'})`
      : '-';
    const row = sheetLedger.addRow([
      index + 1,
      formatJalaliDisplay(entry.jalaliDate, digitMode),
      LEDGER_TYPE_LABELS[entry.entryType] || entry.entryType,
      entry.menuItemName || '-',
      personLabel,
      entry.quantity,
      entry.unitPrice,
      entry.totalAmount,
      entry.description || '-',
    ]);
    row.height = 24;
    const isEven = index % 2 === 1;
    const isInflow = INFLOW_TYPES.includes(entry.entryType);
    const isOutflow = OUTFLOW_TYPES.includes(entry.entryType);
    row.eachCell((cell, colNumber) => {
      cell.font = {
        name: 'Vazirmatn',
        size: 10,
        bold: colNumber === 8,
        color: {
          argb:
            colNumber === 8
              ? isInflow
                ? 'FF3D6B4F'
                : isOutflow
                ? 'FFB83B2E'
                : 'FF1F1B18'
              : 'FF1F1B18',
        },
      };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF8F5' } };
      }
      cell.alignment = {
        horizontal: colNumber >= 6 && colNumber <= 8 ? 'left' : 'center',
        vertical: 'middle',
      };
      if (colNumber === 6 || colNumber === 7 || colNumber === 8) {
        cell.numFmt = '#,##0';
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE7E2DA' } },
        bottom: { style: 'thin', color: { argb: 'FFE7E2DA' } },
        left: { style: 'thin', color: { argb: 'FFE7E2DA' } },
        right: { style: 'thin', color: { argb: 'FFE7E2DA' } },
      };
    });
  });

  // Summary row at bottom of Ledger sheet
  const sumRow = sheetLedger.addRow([
    '',
    '',
    'جمع کل',
    `تعداد رکورد: ${ledgerEntries.length}`,
    totalManual > 0 ? `ثبت آزاد: ${formatNumber(totalManual, digitMode)}` : '',
    '',
    'خالص دریافت و پرداخت:',
    totalInflow - totalOutflow,
    '',
  ]);
  sumRow.height = 28;
  sumRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Vazirmatn', size: 11, bold: true, color: { argb: 'FF2C2623' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE4D8' } };
    if (colNumber === 8) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF5C3D28' } },
      bottom: { style: 'medium', color: { argb: 'FF5C3D28' } },
    };
  });

  sheetLedger.columns = [
    { width: 8 },
    { width: 16 },
    { width: 14 },
    { width: 20 },
    { width: 26 },
    { width: 10 },
    { width: 18 },
    { width: 20 },
    { width: 34 },
  ];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
