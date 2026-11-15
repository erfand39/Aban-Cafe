import { jsPDF } from 'jspdf';
import {
  formatCurrency,
  formatDigits,
  formatNumber,
  INFLOW_TYPES,
  LEDGER_TYPE_LABELS,
  OUTFLOW_TYPES,
} from '../shared/format';
import { formatJalaliDisplay, getTodayJalaliString } from '../shared/jalali';
import { calculateMenuItemPricing } from '../shared/pricing';
import type { DigitMode, LedgerEntry, Material, MenuItem } from '../shared/types';

const PAGE_W = 1654; // A4 @ 200 DPI
const PAGE_H = 2339;
const MARGIN_X = 88;
const HEADER_H = 210;
const FOOTER_H = 90;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

function createPageCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  return [canvas, ctx];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPageFrame(
  ctx: CanvasRenderingContext2D,
  title: string,
  subtitle: string,
  dateLabel: string,
  pageNumber: number,
  totalPages: number,
  digitMode: DigitMode
) {
  // Subtle outer editorial border
  ctx.strokeStyle = '#E7E2DA';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 44, 44, PAGE_W - 88, PAGE_H - 88, 16);
  ctx.stroke();

  // Header espresso band
  ctx.fillStyle = '#3B281E';
  drawRoundedRect(ctx, MARGIN_X, 76, CONTENT_W, 126, 14);
  ctx.fill();

  // Brand emblem square on right (RTL start)
  ctx.fillStyle = '#C89B6E';
  drawRoundedRect(ctx, PAGE_W - MARGIN_X - 96, 98, 72, 82, 10);
  ctx.fill();
  ctx.fillStyle = '#2B1C14';
  ctx.font = '800 34px Vazirmatn, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('آ', PAGE_W - MARGIN_X - 60, 140);

  // Title & subtitle on right side
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 34px Vazirmatn, sans-serif';
  ctx.fillText(`کافه آبان — ${title}`, PAGE_W - MARGIN_X - 116, 126);

  ctx.fillStyle = '#E8D9C8';
  ctx.font = '500 20px Vazirmatn, sans-serif';
  ctx.fillText(subtitle, PAGE_W - MARGIN_X - 116, 166);

  // Date pill text on left side
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F3EFEA';
  ctx.font = '600 21px Vazirmatn, sans-serif';
  ctx.fillText(dateLabel, MARGIN_X + 26, 140);

  // Footer hairline & metadata
  ctx.strokeStyle = '#E7E2DA';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, PAGE_H - FOOTER_H - 12);
  ctx.lineTo(PAGE_W - MARGIN_X, PAGE_H - FOOTER_H - 12);
  ctx.stroke();

  ctx.fillStyle = '#786D65';
  ctx.font = '500 18px Vazirmatn, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('کافه آبان · گزارش رسمی مدیریت قیمت‌گذاری و دفتر حساب', PAGE_W - MARGIN_X, PAGE_H - 68);

  ctx.textAlign = 'left';
  ctx.fillText(
    formatDigits(`صفحه ${pageNumber} از ${totalPages}`, digitMode),
    MARGIN_X,
    PAGE_H - 68
  );
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

function saveCanvasesAsPdf(canvases: HTMLCanvasElement[], filename: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  canvases.forEach((canvas, idx) => {
    if (idx > 0) doc.addPage();
    const imgData = canvas.toDataURL('image/jpeg', 0.94);
    doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  });
  doc.save(filename);
}

export async function exportPricingPdf(params: {
  menuItems: MenuItem[];
  materials: Material[];
  digitMode: DigitMode;
}): Promise<void> {
  await document.fonts.ready;
  const { menuItems, materials, digitMode } = params;
  const matMap = new Map(materials.map((m) => [m.id, m]));
  const todayStr = formatJalaliDisplay(getTodayJalaliString(), digitMode);

  const rows = menuItems.map((item) => ({
    item,
    b: calculateMenuItemPricing(item, matMap),
  }));

  const activeRows = rows.filter((r) => r.item.isActive);
  const avgSelling =
    activeRows.length > 0
      ? activeRows.reduce((s, r) => s + r.b.sellingPrice, 0) / activeRows.length
      : 0;
  const avgCost =
    activeRows.length > 0
      ? activeRows.reduce((s, r) => s + r.b.costOfGoods, 0) / activeRows.length
      : 0;
  const avgMargin =
    activeRows.length > 0
      ? activeRows.reduce((s, r) => s + r.b.profitMarginPercent, 0) / activeRows.length
      : 0;

  const colSpecs = [
    { label: 'ردیف', w: 66, align: 'center' as const },
    { label: 'نام آیتم', w: 230, align: 'right' as const },
    { label: 'دسته‌بندی', w: 205, align: 'right' as const },
    { label: 'مواد اولیه', w: 165, align: 'left' as const },
    { label: 'هزینه جانبی', w: 155, align: 'left' as const },
    { label: 'هزینه فرد', w: 145, align: 'left' as const },
    { label: 'بهای تمام‌شده', w: 175, align: 'left' as const },
    { label: 'سود', w: 150, align: 'left' as const },
    { label: 'قیمت عرضه', w: 187, align: 'left' as const },
  ]; // total = 1478 = CONTENT_W (1654 - 176)

  const rowH = 56;
  const summaryH = 128;
  const tableHeaderH = 60;
  const startYFirst = HEADER_H + 30 + summaryH + 26;
  const startYNext = HEADER_H + 30;
  const maxY = PAGE_H - FOOTER_H - 36;

  // Paginate rows
  const pages: Array<{ rows: typeof rows; isFirst: boolean }> = [];
  let cursor = 0;
  while (cursor < rows.length || pages.length === 0) {
    const isFirst = pages.length === 0;
    const availH = maxY - (isFirst ? startYFirst : startYNext) - tableHeaderH;
    const capacity = Math.max(1, Math.floor(availH / rowH));
    pages.push({ rows: rows.slice(cursor, cursor + capacity), isFirst });
    cursor += capacity;
    if (cursor >= rows.length) break;
  }

  const canvases: HTMLCanvasElement[] = [];
  let globalIndex = 0;

  pages.forEach((page, pIdx) => {
    const [canvas, ctx] = createPageCanvas();
    drawPageFrame(
      ctx,
      'لیست قیمت‌گذاری منو',
      'برآورد دقیق بهای تمام‌شده بر اساس دستور تهیه، هزینه جانبی، نیروی انسانی و سود',
      `تاریخ: ${todayStr}`,
      pIdx + 1,
      pages.length,
      digitMode
    );

    let y = page.isFirst ? HEADER_H + 30 : startYNext;

    if (page.isFirst) {
      // 4 KPI summary cards in a clean strip
      const cards = [
        { label: 'آیتم‌های فعال', val: formatNumber(activeRows.length, digitMode) + ' آیتم' },
        { label: 'میانگین بهای تمام‌شده', val: formatCurrency(avgCost, digitMode) },
        { label: 'میانگین قیمت عرضه', val: formatCurrency(avgSelling, digitMode) },
        {
          label: 'میانگین حاشیه سود',
          val: formatNumber(avgMargin, digitMode, 1) + '٪',
        },
      ];
      const gap = 20;
      const cardW = (CONTENT_W - gap * 3) / 4;
      cards.forEach((c, idx) => {
        const cx = PAGE_W - MARGIN_X - cardW * (idx + 1) - gap * idx;
        ctx.fillStyle = '#FAF8F5';
        ctx.strokeStyle = '#E7E2DA';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, cx, y, cardW, 108, 12);
        ctx.fill();
        ctx.stroke();

        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#786D65';
        ctx.font = '500 19px Vazirmatn, sans-serif';
        ctx.fillText(c.label, cx + cardW - 22, y + 36);

        ctx.fillStyle = idx === 2 ? '#3D6B4F' : '#1F1B18';
        ctx.font = '700 24px Vazirmatn, sans-serif';
        ctx.fillText(c.val, cx + cardW - 22, y + 78);
      });
      y = startYFirst;
    }

    // Draw table header (from right to left)
    ctx.fillStyle = '#6F4E37';
    drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, tableHeaderH, 8);
    ctx.fill();

    let rx = PAGE_W - MARGIN_X;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 19px Vazirmatn, sans-serif';
    ctx.textBaseline = 'middle';
    colSpecs.forEach((col) => {
      const cellLeft = rx - col.w;
      ctx.textAlign = col.align === 'center' ? 'center' : col.align;
      const tx =
        col.align === 'center'
          ? cellLeft + col.w / 2
          : col.align === 'right'
          ? rx - 14
          : cellLeft + 14;
      ctx.fillText(col.label, tx, y + tableHeaderH / 2);
      rx = cellLeft;
    });

    y += tableHeaderH;

    page.rows.forEach((entry, rIdx) => {
      globalIndex += 1;
      if (rIdx % 2 === 1) {
        ctx.fillStyle = '#FAF8F5';
        ctx.fillRect(MARGIN_X, y, CONTENT_W, rowH);
      }
      ctx.strokeStyle = '#E7E2DA';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, y + rowH);
      ctx.lineTo(PAGE_W - MARGIN_X, y + rowH);
      ctx.stroke();

      const cells = [
        formatNumber(globalIndex, digitMode),
        entry.item.name + (entry.item.isActive ? '' : ' (غیرفعال)'),
        entry.item.category,
        formatNumber(entry.b.materialsCost, digitMode),
        formatNumber(entry.b.overheadCost, digitMode),
        formatNumber(entry.b.laborCost, digitMode),
        formatNumber(entry.b.costOfGoods, digitMode),
        formatNumber(entry.b.profitAmount, digitMode),
        formatNumber(entry.b.sellingPrice, digitMode),
      ];

      let cx = PAGE_W - MARGIN_X;
      colSpecs.forEach((col, cIdx) => {
        const cellLeft = cx - col.w;
        ctx.textAlign = col.align === 'center' ? 'center' : col.align;
        ctx.fillStyle =
          cIdx === 8 ? '#3D6B4F' : cIdx === 1 ? '#1F1B18' : '#433C37';
        ctx.font =
          cIdx === 8 || cIdx === 1
            ? '700 19px Vazirmatn, sans-serif'
            : '500 18px Vazirmatn, sans-serif';

        const tx =
          col.align === 'center'
            ? cellLeft + col.w / 2
            : col.align === 'right'
            ? cx - 14
            : cellLeft + 14;
        const safeText = truncateText(ctx, cells[cIdx], col.w - 22);
        ctx.fillText(safeText, tx, y + rowH / 2);
        cx = cellLeft;
      });
      y += rowH;
    });

    canvases.push(canvas);
  });

  saveCanvasesAsPdf(canvases, `Cafe-Aban-Pricing-${getTodayJalaliString().replaceAll('/', '-')}.pdf`);
}

export async function exportLedgerPdf(params: {
  entries: LedgerEntry[];
  dateRangeLabel: string;
  digitMode: DigitMode;
}): Promise<void> {
  await document.fonts.ready;
  const { entries, dateRangeLabel, digitMode } = params;
  const todayStr = formatJalaliDisplay(getTodayJalaliString(), digitMode);

  let totalInflow = 0;
  let totalOutflow = 0;
  for (const e of entries) {
    if (INFLOW_TYPES.includes(e.entryType)) totalInflow += e.totalAmount;
    else if (OUTFLOW_TYPES.includes(e.entryType)) totalOutflow += e.totalAmount;
  }
  const netBalance = totalInflow - totalOutflow;

  const colSpecs = [
    { label: 'ردیف', w: 62, align: 'center' as const },
    { label: 'تاریخ', w: 138, align: 'center' as const },
    { label: 'نوع', w: 112, align: 'center' as const },
    { label: 'آیتم', w: 185, align: 'right' as const },
    { label: 'فرد', w: 205, align: 'right' as const },
    { label: 'تعداد', w: 80, align: 'center' as const },
    { label: 'مبلغ واحد', w: 165, align: 'left' as const },
    { label: 'مبلغ کل', w: 185, align: 'left' as const },
    { label: 'توضیحات', w: 346, align: 'right' as const },
  ]; // total = 1478 = CONTENT_W

  const rowH = 56;
  const summaryH = 128;
  const tableHeaderH = 60;
  const startYFirst = HEADER_H + 30 + summaryH + 26;
  const startYNext = HEADER_H + 30;
  const maxY = PAGE_H - FOOTER_H - 96;

  const pages: Array<{ rows: LedgerEntry[]; isFirst: boolean }> = [];
  let cursor = 0;
  while (cursor < entries.length || pages.length === 0) {
    const isFirst = pages.length === 0;
    const availH = maxY - (isFirst ? startYFirst : startYNext) - tableHeaderH;
    const capacity = Math.max(1, Math.floor(availH / rowH));
    pages.push({ rows: entries.slice(cursor, cursor + capacity), isFirst });
    cursor += capacity;
    if (cursor >= entries.length) break;
  }

  const canvases: HTMLCanvasElement[] = [];
  let globalIndex = 0;

  pages.forEach((page, pIdx) => {
    const [canvas, ctx] = createPageCanvas();
    drawPageFrame(
      ctx,
      'دفتر حساب دفتری',
      `بازه گزارش: ${dateRangeLabel || 'همه تاریخ‌ها'} · تعداد رکورد: ${formatNumber(entries.length, digitMode)}`,
      `چاپ: ${todayStr}`,
      pIdx + 1,
      pages.length,
      digitMode
    );

    let y = page.isFirst ? HEADER_H + 30 : startYNext;

    if (page.isFirst) {
      const cards = [
        { label: 'جمع فروش و دریافتی', val: formatCurrency(totalInflow, digitMode), color: '#3D6B4F' },
        { label: 'جمع پرداخت و هزینه', val: formatCurrency(totalOutflow, digitMode), color: '#B83B2E' },
        {
          label: 'تراز خالص دوره',
          val: formatCurrency(netBalance, digitMode),
          color: netBalance >= 0 ? '#3D6B4F' : '#B83B2E',
        },
      ];
      const gap = 22;
      const cardW = (CONTENT_W - gap * 2) / 3;
      cards.forEach((c, idx) => {
        const cx = PAGE_W - MARGIN_X - cardW * (idx + 1) - gap * idx;
        ctx.fillStyle = '#FAF8F5';
        ctx.strokeStyle = '#E7E2DA';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, cx, y, cardW, 108, 12);
        ctx.fill();
        ctx.stroke();

        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#786D65';
        ctx.font = '500 19px Vazirmatn, sans-serif';
        ctx.fillText(c.label, cx + cardW - 24, y + 36);

        ctx.fillStyle = c.color;
        ctx.font = '700 25px Vazirmatn, sans-serif';
        ctx.fillText(c.val, cx + cardW - 24, y + 78);
      });
      y = startYFirst;
    }

    ctx.fillStyle = '#2C2623';
    drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, tableHeaderH, 8);
    ctx.fill();

    let rx = PAGE_W - MARGIN_X;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 19px Vazirmatn, sans-serif';
    ctx.textBaseline = 'middle';
    colSpecs.forEach((col) => {
      const cellLeft = rx - col.w;
      ctx.textAlign = col.align === 'center' ? 'center' : col.align;
      const tx =
        col.align === 'center'
          ? cellLeft + col.w / 2
          : col.align === 'right'
          ? rx - 12
          : cellLeft + 12;
      ctx.fillText(col.label, tx, y + tableHeaderH / 2);
      rx = cellLeft;
    });

    y += tableHeaderH;

    if (page.rows.length === 0) {
      ctx.fillStyle = '#786D65';
      ctx.font = '500 22px Vazirmatn, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('هیچ رکوردی در این بازه ثبت نشده است.', PAGE_W / 2, y + 60);
    }

    page.rows.forEach((entry, rIdx) => {
      globalIndex += 1;
      if (rIdx % 2 === 1) {
        ctx.fillStyle = '#FAF8F5';
        ctx.fillRect(MARGIN_X, y, CONTENT_W, rowH);
      }
      ctx.strokeStyle = '#E7E2DA';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, y + rowH);
      ctx.lineTo(PAGE_W - MARGIN_X, y + rowH);
      ctx.stroke();

      const isInflow = INFLOW_TYPES.includes(entry.entryType);
      const isOutflow = OUTFLOW_TYPES.includes(entry.entryType);
      const cells = [
        formatNumber(globalIndex, digitMode),
        formatJalaliDisplay(entry.jalaliDate, digitMode),
        LEDGER_TYPE_LABELS[entry.entryType] || entry.entryType,
        entry.menuItemName || '—',
        entry.personName || '—',
        formatNumber(entry.quantity, digitMode),
        formatNumber(entry.unitPrice, digitMode),
        formatNumber(entry.totalAmount, digitMode),
        entry.description || '—',
      ];

      let cx = PAGE_W - MARGIN_X;
      colSpecs.forEach((col, cIdx) => {
        const cellLeft = cx - col.w;
        ctx.textAlign = col.align === 'center' ? 'center' : col.align;
        ctx.fillStyle =
          cIdx === 7
            ? isInflow
              ? '#3D6B4F'
              : isOutflow
              ? '#B83B2E'
              : '#1F1B18'
            : '#2D2723';
        ctx.font =
          cIdx === 7 ? '700 19px Vazirmatn, sans-serif' : '500 18px Vazirmatn, sans-serif';

        const tx =
          col.align === 'center'
            ? cellLeft + col.w / 2
            : col.align === 'right'
            ? cx - 12
            : cellLeft + 12;
        const safeText = truncateText(ctx, cells[cIdx], col.w - 20);
        ctx.fillText(safeText, tx, y + rowH / 2);
        cx = cellLeft;
      });
      y += rowH;
    });

    // Final page total bar
    if (pIdx === pages.length - 1) {
      y += 14;
      ctx.fillStyle = '#F3ECE4';
      drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, 58, 10);
      ctx.fill();
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#2C2623';
      ctx.font = '700 20px Vazirmatn, sans-serif';
      ctx.fillText(
        `جمع کل مبالغ ثبت‌شده (خالص صندوق): ${formatCurrency(netBalance, digitMode)}`,
        PAGE_W - MARGIN_X - 24,
        y + 30
      );
    }

    canvases.push(canvas);
  });

  saveCanvasesAsPdf(canvases, `Cafe-Aban-Ledger-${getTodayJalaliString().replaceAll('/', '-')}.pdf`);
}
