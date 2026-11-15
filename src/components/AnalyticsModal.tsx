import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Minus,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  buildDailySalesTrend,
  buildMonthlySalesTrend,
  buildTopSellingItems,
  calculateProfitLossSummary,
} from '../shared/analytics';
import { formatCurrency, formatDigits, formatNumber } from '../shared/format';
import { getTodayJalaliString } from '../shared/jalali';
import type {
  DigitMode,
  LedgerEntry,
  Material,
  MenuItem,
} from '../shared/types';

interface AnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  entries: LedgerEntry[];
  menuItems: MenuItem[];
  materials: Material[];
  digitMode: DigitMode;
  onNavigateToLedger?: () => void;
}

export function AnalyticsModal({
  open,
  onClose,
  entries,
  menuItems,
  materials,
  digitMode,
  onNavigateToLedger,
}: AnalyticsModalProps) {
  const [periodMode, setPeriodMode] = useState<'daily' | 'monthly'>('daily');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const todayJalali = useMemo(() => getTodayJalaliString(), []);

  const summary = useMemo(
    () => calculateProfitLossSummary(entries, menuItems, materials, todayJalali),
    [entries, menuItems, materials, todayJalali]
  );

  const dailyTrend = useMemo(
    () => buildDailySalesTrend(entries, todayJalali, 7),
    [entries, todayJalali]
  );

  const monthlyTrend = useMemo(
    () => buildMonthlySalesTrend(entries, todayJalali, 6),
    [entries, todayJalali]
  );

  const topItems = useMemo(() => buildTopSellingItems(entries, 6), [entries]);

  if (!open) return null;

  const activeSeries = periodMode === 'daily' ? dailyTrend : monthlyTrend;
  const hasTrendActivity = activeSeries.some((p) => p.sales > 0 || p.outflow > 0);
  const rawMax = Math.max(
    0,
    ...activeSeries.map((p) => Math.max(p.sales, p.outflow))
  );
  const maxChartValue = rawMax > 0 ? rawMax : 100000;

  const activePoint =
    hoveredIdx !== null && activeSeries[hoveredIdx]
      ? activeSeries[hoveredIdx]
      : activeSeries[activeSeries.length - 1] ?? null;

  const maxTopQty = topItems.length > 0 ? Math.max(1, topItems[0].quantity) : 1;

  const totalCashFlowVolume = summary.totalInflow + summary.totalOutflow;
  const inflowWidthPct =
    totalCashFlowVolume > 0
      ? (summary.totalInflow / totalCashFlowVolume) * 100
      : 0;
  const outflowWidthPct =
    totalCashFlowVolume > 0
      ? (summary.totalOutflow / totalCashFlowVolume) * 100
      : 0;

  const isProfit = summary.netProfitLoss > 0;
  const isLoss = summary.netProfitLoss < 0;

  // SVG layout coordinates
  const svgW = 640;
  const svgH = 220;
  const padLeft = 16;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 34;
  const plotW = svgW - padLeft - padRight;
  const plotH = svgH - padTop - padBottom;
  const slotW = plotW / Math.max(1, activeSeries.length);
  const barW = Math.min(20, Math.max(10, slotW * 0.28));
  const barGap = 4;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-[#E7E2DA] dark:border-[#2E2924] bg-white dark:bg-[#1D1A17] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#EFEAE2] dark:border-[#2E2924] flex items-center justify-between gap-4 bg-[#FAF8F5] dark:bg-[#171412] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#6F4E37]/10 dark:bg-[#C89B6E]/15 text-[#6F4E37] dark:text-[#C89B6E] flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="analytics-modal-title"
                className="text-base sm:text-lg font-extrabold text-[#1F1B18] dark:text-[#F3EFEA] truncate"
              >
                خلاصه وضعیت سود و زیان، فروش و پرفروش‌ترین آیتم‌ها
              </h2>
              <p className="text-xs text-[#786D65] dark:text-[#9A8F85] truncate">
                محاسبه‌شده به‌صورت زنده از داده‌های دفتر حساب و بهای تمام‌شده منوی کافه آبان
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره گزارش سود و فروش"
            className="p-2 rounded-lg text-[#786D65] dark:text-[#9A8F85] hover:bg-[#EFEAE2] dark:hover:bg-[#2A241F] hover:text-[#1F1B18] dark:hover:text-[#F3EFEA] cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 divide-y divide-[#EFEAE2] dark:divide-[#2E2924]">
          {/* Section 1: 4-Metric KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-[#EFEAE2] dark:divide-[#2E2924] bg-[#FAF8F5]/60 dark:bg-[#191613]">
            <div className="p-4 sm:p-5">
              <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">فروش امروز</div>
              <div className="mt-1.5 text-lg font-extrabold font-mono-num tabular-nums text-[#3D6B4F] dark:text-[#7EC496]">
                {formatCurrency(summary.todaySales, digitMode)}
              </div>
              <div className="mt-1 text-[11px] text-[#8C8178] dark:text-[#9A8F85] tabular-nums">
                {formatDigits(`تاریخ امروز: ${todayJalali}`, digitMode)}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">فروش این ماه</div>
              <div className="mt-1.5 text-lg font-extrabold font-mono-num tabular-nums text-[#1F1B18] dark:text-[#F3EFEA]">
                {formatCurrency(summary.currentMonthSales, digitMode)}
              </div>
              <div className="mt-1 text-[11px] text-[#8C8178] dark:text-[#9A8F85] tabular-nums">
                از {formatNumber(summary.salesOrderCount, digitMode)} ردیف فروش ثبت‌شده
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">
                کل ورودی در برابر هزینه‌ها
              </div>
              <div className="mt-1.5 flex items-baseline gap-2 flex-wrap font-mono-num tabular-nums">
                <span className="text-base font-extrabold text-[#3D6B4F] dark:text-[#7EC496]">
                  {formatCurrency(summary.totalInflow, digitMode)}
                </span>
                <span className="text-xs text-[#8C8178]">/</span>
                <span className="text-sm font-bold text-[#B83B2E] dark:text-[#EF7B6E]">
                  {formatCurrency(summary.totalOutflow, digitMode)}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-[#8C8178] dark:text-[#9A8F85]">
                فروش و دریافت در مقابل هزینه و پرداخت
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#786D65] dark:text-[#9A8F85]">
                  وضعیت سود و زیان خالص
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                    isProfit
                      ? 'text-[#3D6B4F] dark:text-[#7EC496]'
                      : isLoss
                      ? 'text-[#B83B2E] dark:text-[#EF7B6E]'
                      : 'text-[#786D65] dark:text-[#9A8F85]'
                  }`}
                >
                  {isProfit ? (
                    <>
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>سودآور</span>
                    </>
                  ) : isLoss ? (
                    <>
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>زیان / کسری</span>
                    </>
                  ) : (
                    <>
                      <Minus className="w-3.5 h-3.5" />
                      <span>سربه‌سر</span>
                    </>
                  )}
                </span>
              </div>
              <div
                className={`mt-1.5 text-lg font-extrabold font-mono-num tabular-nums ${
                  isProfit
                    ? 'text-[#3D6B4F] dark:text-[#7EC496]'
                    : isLoss
                    ? 'text-[#B83B2E] dark:text-[#EF7B6E]'
                    : 'text-[#1F1B18] dark:text-[#F3EFEA]'
                }`}
              >
                {formatCurrency(summary.netProfitLoss, digitMode)}
              </div>
              <div className="mt-1 text-[11px] text-[#8C8178] dark:text-[#9A8F85] tabular-nums">
                سود ناخالص منو: {formatCurrency(summary.estimatedGrossProfit, digitMode)}
              </div>
            </div>
          </div>

          {/* Section 2: Daily/Monthly Sales & Expense Bar Chart */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                  روند فروش و هزینه‌ها ({periodMode === 'daily' ? '۷ روز اخیر' : '۶ ماه اخیر'})
                </h3>
                <p className="text-xs text-[#786D65] dark:text-[#9A8F85] mt-0.5">
                  مقایسه فروش ثبت‌شده با مخارج و پرداخت‌ها در بازه انتخابی
                </p>
              </div>

              <div className="grid grid-cols-2 sm:inline-flex items-center p-1 rounded-xl bg-[#EFEAE2] dark:bg-[#141210] border border-[#E7E2DA] dark:border-[#2E2924]">
                <button
                  type="button"
                  onClick={() => {
                    setPeriodMode('daily');
                    setHoveredIdx(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    periodMode === 'daily'
                      ? 'bg-white dark:bg-[#2C2623] text-[#1F1B18] dark:text-[#F3EFEA] shadow-xs'
                      : 'text-[#6B6159] dark:text-[#9A8F85] hover:text-[#1F1B18] dark:hover:text-[#F3EFEA]'
                  }`}
                >
                  فروش روزانه (۷ روز)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPeriodMode('monthly');
                    setHoveredIdx(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    periodMode === 'monthly'
                      ? 'bg-white dark:bg-[#2C2623] text-[#1F1B18] dark:text-[#F3EFEA] shadow-xs'
                      : 'text-[#6B6159] dark:text-[#9A8F85] hover:text-[#1F1B18] dark:hover:text-[#F3EFEA]'
                  }`}
                >
                  فروش ماهانه (۶ ماه)
                </button>
              </div>
            </div>

            {/* Active Period Inspector Bar */}
            {activePoint && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#171412] border border-[#EFEAE2] dark:border-[#2E2924] text-xs">
                <div className="font-bold text-[#4A3326] dark:text-[#E8C5A0]">
                  {formatDigits(activePoint.label, digitMode)}
                  <span className="mr-2 font-normal text-[#786D65] dark:text-[#9A8F85]">
                    ({formatNumber(activePoint.unitsSold, digitMode)} عدد فروش)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 font-mono-num tabular-nums">
                  <span className="flex items-center gap-1.5 text-[#3D6B4F] dark:text-[#7EC496] font-semibold">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#3D6B4F] dark:bg-[#7EC496]" />
                    فروش: {formatCurrency(activePoint.sales, digitMode)}
                  </span>
                  <span className="flex items-center gap-1.5 text-[#B83B2E] dark:text-[#EF7B6E] font-semibold">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#B83B2E] dark:bg-[#EF7B6E]" />
                    هزینه: {formatCurrency(activePoint.outflow, digitMode)}
                  </span>
                  <span className="font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                    خالص: {formatCurrency(activePoint.net, digitMode)}
                  </span>
                </div>
              </div>
            )}

            {/* SVG Bar Chart */}
            <div className="relative w-full">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full h-52 sm:h-56 overflow-visible select-none"
                role="img"
                aria-label="نمودار میله‌ای فروش و هزینه"
              >
                {/* Horizontal gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = padTop + plotH * (1 - ratio);
                  return (
                    <line
                      key={ratio}
                      x1={padLeft}
                      x2={svgW - padRight}
                      y1={y}
                      y2={y}
                      stroke="currentColor"
                      strokeDasharray={ratio === 0 ? undefined : '4 4'}
                      className={
                        ratio === 0
                          ? 'text-[#DDD6CC] dark:text-[#342E29]'
                          : 'text-[#EFEAE2] dark:text-[#26211D]'
                      }
                      strokeWidth={1}
                    />
                  );
                })}

                {/* Grouped Bars (RTL visual order: oldest right -> newest left, or chronological left->right; use natural chronological left->right for time series clarity) */}
                {activeSeries.map((pt, idx) => {
                  const centerX = padLeft + slotW * idx + slotW / 2;
                  const salesH =
                    pt.sales > 0
                      ? Math.max(4, (pt.sales / maxChartValue) * plotH)
                      : 0;
                  const outflowH =
                    pt.outflow > 0
                      ? Math.max(4, (pt.outflow / maxChartValue) * plotH)
                      : 0;
                  const baseY = padTop + plotH;
                  const isHighlighted =
                    hoveredIdx === idx ||
                    (hoveredIdx === null && idx === activeSeries.length - 1);

                  return (
                    <g
                      key={pt.key}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onFocus={() => setHoveredIdx(idx)}
                      tabIndex={0}
                      className="cursor-pointer outline-none"
                      aria-label={`${pt.label}: فروش ${pt.sales} تومان، هزینه ${pt.outflow} تومان`}
                    >
                      {/* Hover column hit target */}
                      <rect
                        x={padLeft + slotW * idx + 2}
                        y={padTop}
                        width={Math.max(10, slotW - 4)}
                        height={plotH + padBottom}
                        rx={8}
                        className={
                          isHighlighted
                            ? 'fill-[#F5EFE8]/70 dark:fill-[#26211D]/70'
                            : 'fill-transparent hover:fill-[#FAF8F5]/70 dark:hover:fill-[#231F1B]/50'
                        }
                      />

                      {/* Sales Bar */}
                      <rect
                        x={centerX - barW - barGap / 2}
                        y={baseY - salesH}
                        width={barW}
                        height={salesH}
                        rx={4}
                        className="fill-[#3D6B4F] dark:fill-[#7EC496] transition-all duration-300"
                      />

                      {/* Outflow Bar */}
                      <rect
                        x={centerX + barGap / 2}
                        y={baseY - outflowH}
                        width={barW}
                        height={outflowH}
                        rx={4}
                        className="fill-[#B83B2E] dark:fill-[#EF7B6E] transition-all duration-300"
                      />

                      {/* X-axis label */}
                      <text
                        x={centerX}
                        y={baseY + 20}
                        textAnchor="middle"
                        className={`text-[11px] font-medium ${
                          isHighlighted
                            ? 'fill-[#4A3326] dark:fill-[#E8C5A0] font-bold'
                            : 'fill-[#786D65] dark:fill-[#9A8F85]'
                        }`}
                      >
                        {formatDigits(pt.label, digitMode)}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {!hasTrendActivity && (
                <div className="mt-1 text-center text-xs text-[#8C8178] dark:text-[#9A8F85]">
                  هنوز تراکنش فروش یا هزینه‌ای در این بازه زمانی در دفتر حساب ثبت نشده است.
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Profit/Loss Composition & Top-Selling Items */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-[#EFEAE2] dark:divide-[#2E2924]">
            {/* Top Selling Menu Items */}
            <div className="lg:col-span-7 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                    پرفروش‌ترین آیتم‌های منو
                  </h3>
                  <p className="text-xs text-[#786D65] dark:text-[#9A8F85] mt-0.5">
                    رتبه‌بندی بر اساس تعداد فروش ثبت‌شده در دفتر حساب
                  </p>
                </div>
              </div>

              {topItems.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-xl border border-dashed border-[#DDD6CC] dark:border-[#342E29] space-y-3">
                  <p className="text-xs sm:text-sm text-[#786D65] dark:text-[#A3988E]">
                    هنوز هیچ فروشی در دفتر حساب ثبت نشده است تا رتبه‌بندی پرفروش‌ترین آیتم‌ها نمایش داده شود.
                  </p>
                  {onNavigateToLedger && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToLedger();
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410] hover:bg-[#5C3D28] cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>رفتن به دفتر حساب و ثبت فروش</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3.5">
                  {topItems.map((item, idx) => {
                    const widthPct = Math.max(4, (item.quantity / maxTopQty) * 100);
                    return (
                      <div key={item.key} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-md bg-[#EFEAE2] dark:bg-[#2A241F] text-[#4A3326] dark:text-[#E8C5A0] font-bold text-[11px] flex items-center justify-center shrink-0 tabular-nums">
                              {formatNumber(idx + 1, digitMode)}
                            </span>
                            <span className="font-bold text-[#1F1B18] dark:text-[#F3EFEA] truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono-num tabular-nums shrink-0 text-xs">
                            <span className="font-bold text-[#6F4E37] dark:text-[#C89B6E]">
                              {formatNumber(item.quantity, digitMode)} عدد
                            </span>
                            <span className="text-[#786D65] dark:text-[#9A8F85]">
                              {formatCurrency(item.revenue, digitMode)}
                            </span>
                            <span className="text-[11px] text-[#8C8178] w-10 text-left">
                              ({formatNumber(item.sharePercent, digitMode, 0)}٪)
                            </span>
                          </div>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-[#EFEAE2] dark:bg-[#2A241F] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#6F4E37] dark:bg-[#C89B6E] transition-all duration-300"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Profit & Loss Structure Breakdown */}
            <div className="lg:col-span-5 p-5 sm:p-6 space-y-5">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                  ترکیب سود و زیان دفتر حساب
                </h3>
                <p className="text-xs text-[#786D65] dark:text-[#9A8F85] mt-0.5">
                  توازن ورودی‌های مالی در برابر مخارج و بهای تمام‌شده
                </p>
              </div>

              {/* Ratio Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
                  <span className="text-[#3D6B4F] dark:text-[#7EC496]">
                    ورودی: {formatNumber(inflowWidthPct, digitMode, 0)}٪
                  </span>
                  <span className="text-[#B83B2E] dark:text-[#EF7B6E]">
                    خروجی: {formatNumber(outflowWidthPct, digitMode, 0)}٪
                  </span>
                </div>
                <div className="h-3.5 w-full rounded-lg bg-[#EFEAE2] dark:bg-[#2A241F] overflow-hidden flex">
                  {totalCashFlowVolume > 0 && (
                    <>
                      <div
                        className="h-full bg-[#3D6B4F] dark:bg-[#7EC496] transition-all duration-300"
                        style={{ width: `${inflowWidthPct}%` }}
                      />
                      <div
                        className="h-full bg-[#B83B2E] dark:bg-[#EF7B6E] transition-all duration-300"
                        style={{ width: `${outflowWidthPct}%` }}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Breakdown Rows */}
              <div className="divide-y divide-[#EFEAE2] dark:divide-[#2E2924] text-xs sm:text-sm">
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[#5C534D] dark:text-[#D5CCC3]">جمع فروش آیتم‌های منو</span>
                  <span className="font-bold font-mono-num tabular-nums text-[#3D6B4F] dark:text-[#7EC496]">
                    {formatCurrency(summary.totalSales, digitMode)}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[#5C534D] dark:text-[#D5CCC3]">سایر دریافت‌ها</span>
                  <span className="font-bold font-mono-num tabular-nums text-[#3D6B4F] dark:text-[#7EC496]">
                    {formatCurrency(summary.totalReceipts, digitMode)}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[#5C534D] dark:text-[#D5CCC3]">هزینه‌ها و مخارج کافه</span>
                  <span className="font-bold font-mono-num tabular-nums text-[#B83B2E] dark:text-[#EF7B6E]">
                    {formatCurrency(summary.totalExpenses, digitMode)}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[#5C534D] dark:text-[#D5CCC3]">پرداخت‌ها به افراد / تأمین‌کنندگان</span>
                  <span className="font-bold font-mono-num tabular-nums text-[#B83B2E] dark:text-[#EF7B6E]">
                    {formatCurrency(summary.totalPayments, digitMode)}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[#5C534D] dark:text-[#D5CCC3]">بهای تمام‌شده برآوردی فروش منو</span>
                  <span className="font-bold font-mono-num tabular-nums text-[#6F4E37] dark:text-[#C89B6E]">
                    {formatCurrency(summary.estimatedMenuCogs, digitMode)}
                  </span>
                </div>
                <div className="pt-3 flex items-center justify-between gap-2 font-extrabold">
                  <span className="text-[#1F1B18] dark:text-[#F3EFEA]">تراز سود / زیان خالص</span>
                  <span
                    className={`font-mono-num tabular-nums ${
                      isProfit
                        ? 'text-[#3D6B4F] dark:text-[#7EC496]'
                        : isLoss
                        ? 'text-[#B83B2E] dark:text-[#EF7B6E]'
                        : 'text-[#1F1B18] dark:text-[#F3EFEA]'
                    }`}
                  >
                    {formatCurrency(summary.netProfitLoss, digitMode)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
