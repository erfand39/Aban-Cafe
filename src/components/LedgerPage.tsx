import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileSpreadsheet,
  FileText,
  FilterX,
  PenLine,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  formatCurrency,
  formatNumber,
  INFLOW_TYPES,
  LEDGER_TYPE_LABELS,
  OUTFLOW_TYPES,
  PERSON_ROLE_LABELS,
} from '../shared/format';
import { formatJalaliDisplay, getTodayJalaliString, parseJalaliDate } from '../shared/jalali';
import { calculateLedgerTotal, calculateMenuItemPricing } from '../shared/pricing';
import type {
  DigitMode,
  LedgerEntry,
  LedgerEntryType,
  Material,
  MenuItem,
  Person,
  PersonRole,
} from '../shared/types';
import { JalaliDatePicker } from './JalaliDatePicker';
import { NumericInput } from './NumericInput';
import { SearchableSelect } from './SearchableSelect';

interface LedgerPageProps {
  entries: LedgerEntry[];
  menuItems: MenuItem[];
  materials: Material[];
  people: Person[];
  digitMode: DigitMode;
  onCreateEntry: (
    payload: Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt'> & { savePerson?: boolean }
  ) => Promise<void>;
  onUpdateEntry: (
    id: number,
    payload: Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt'> & { savePerson?: boolean }
  ) => Promise<void>;
  onDeleteEntry: (id: number) => Promise<void>;
  onExportExcel: (filteredIds: number[]) => Promise<void>;
  onExportPdf: (filteredEntries: LedgerEntry[], dateRangeLabel: string) => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

const ENTRY_TYPES: LedgerEntryType[] = ['sale', 'receipt', 'payment', 'expense', 'manual'];
const PERSON_ROLES: PersonRole[] = ['customer', 'supplier', 'staff', 'other'];
const PAGE_SIZE = 12;

export function LedgerPage({
  entries,
  menuItems,
  materials,
  people,
  digitMode,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
  onExportExcel,
  onExportPdf,
  onNotify,
}: LedgerPageProps) {
  const materialsById = useMemo(
    () => new Map(materials.map((m) => [m.id, m])),
    [materials]
  );

  const itemPricesById = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of menuItems) {
      map.set(item.id, calculateMenuItemPricing(item, materialsById).sellingPrice);
    }
    return map;
  }, [menuItems, materialsById]);

  // Form State
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [entryType, setEntryType] = useState<LedgerEntryType>('sale');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [personCustomName, setPersonCustomName] = useState('');
  const [personRole, setPersonRole] = useState<PersonRole>('customer');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [jalaliDate, setJalaliDate] = useState(getTodayJalaliString());
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPerson, setFilterPerson] = useState<string>('all');
  const [filterItem, setFilterItem] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const resetForm = () => {
    setEditingEntryId(null);
    setEntryType('sale');
    setSelectedItemId(null);
    setSelectedPersonId(null);
    setPersonCustomName('');
    setPersonRole('customer');
    setQuantity(1);
    setUnitPrice(0);
    setTotalAmount(0);
    setJalaliDate(getTodayJalaliString());
    setDescription('');
    setFormError('');
  };

  // Auto-suggest role when changing entry type (if not editing)
  const handleEntryTypeChange = (nextType: LedgerEntryType) => {
    setEntryType(nextType);
    if (nextType === 'manual') {
      setSelectedItemId(null);
    }
    if (!selectedPersonId && !personCustomName.trim()) {
      if (nextType === 'sale' || nextType === 'receipt') setPersonRole('customer');
      else if (nextType === 'expense') setPersonRole('supplier');
      else if (nextType === 'payment') setPersonRole('staff');
    }
  };

  // Auto-fill unitPrice & totalAmount when item changes
  const handleSelectItem = (itemId: number | null) => {
    setSelectedItemId(itemId);
    if (itemId !== null) {
      const price = itemPricesById.get(itemId) ?? 0;
      setUnitPrice(price);
      const q = quantity > 0 ? quantity : 1;
      setQuantity(q);
      setTotalAmount(calculateLedgerTotal(q, price));
    }
  };

  const handleQuantityChange = (nextQty: number) => {
    setQuantity(nextQty);
    if (selectedItemId !== null || unitPrice > 0) {
      setTotalAmount(calculateLedgerTotal(nextQty, unitPrice));
    }
  };

  const handleUnitPriceChange = (nextPrice: number) => {
    setUnitPrice(nextPrice);
    if (entryType !== 'manual' || selectedItemId !== null || quantity > 0) {
      setTotalAmount(calculateLedgerTotal(quantity, nextPrice));
    }
  };

  const handleTotalAmountManualChange = (nextTotal: number) => {
    setTotalAmount(nextTotal);
    if (quantity > 0 && selectedItemId === null) {
      setUnitPrice(Math.round(nextTotal / quantity));
    }
  };

  const handleEditRow = (entry: LedgerEntry) => {
    setEditingEntryId(entry.id);
    setEntryType(entry.entryType);
    setSelectedItemId(entry.menuItemId);
    setSelectedPersonId(entry.personId);
    setPersonCustomName(entry.personName);
    setPersonRole(entry.personRole);
    setQuantity(entry.quantity);
    setUnitPrice(entry.unitPrice);
    setTotalAmount(entry.totalAmount);
    setJalaliDate(entry.jalaliDate);
    setDescription(entry.description);
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parseJalaliDate(jalaliDate)) {
      setFormError('لطفاً یک تاریخ شمسی معتبر انتخاب کنید.');
      return;
    }
    if (totalAmount <= 0) {
      setFormError('مبلغ کل باید بزرگ‌تر از صفر باشد.');
      return;
    }

    const chosenItem = menuItems.find((m) => m.id === selectedItemId);
    const chosenPerson = people.find((p) => p.id === selectedPersonId);
    const resolvedPersonName = chosenPerson?.name || personCustomName.trim();

    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        entryType,
        menuItemId: chosenItem?.id ?? null,
        menuItemName: chosenItem?.name ?? '',
        personId: chosenPerson?.id ?? null,
        personName: resolvedPersonName,
        personRole: chosenPerson?.role ?? personRole,
        quantity: quantity > 0 ? quantity : 1,
        unitPrice,
        totalAmount,
        jalaliDate,
        description: description.trim(),
        savePerson: true,
      };

      if (editingEntryId) {
        await onUpdateEntry(editingEntryId, payload);
        onNotify('رکورد دفتر حساب با موفقیت ویرایش شد.');
      } else {
        await onCreateEntry(payload);
        onNotify('رکورد جدید در دفتر حساب ثبت شد.');
      }
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'خطا در ثبت رکورد');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered entries
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e) => {
      if (filterType !== 'all' && e.entryType !== filterType) return false;
      if (filterPerson !== 'all' && e.personName !== filterPerson) return false;
      if (filterItem !== 'all' && e.menuItemName !== filterItem) return false;
      if (fromDate && e.jalaliDate < fromDate) return false;
      if (toDate && e.jalaliDate > toDate) return false;
      if (!q) return true;
      return (
        e.description.toLowerCase().includes(q) ||
        e.personName.toLowerCase().includes(q) ||
        e.menuItemName.toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery, filterType, filterPerson, filterItem, fromDate, toDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterPerson, filterItem, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEntries.slice(start, start + PAGE_SIZE);
  }, [filteredEntries, currentPage]);

  const totals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const e of filteredEntries) {
      if (INFLOW_TYPES.includes(e.entryType)) inflow += e.totalAmount;
      else if (OUTFLOW_TYPES.includes(e.entryType)) outflow += e.totalAmount;
    }
    return { inflow, outflow, net: inflow - outflow };
  }, [filteredEntries]);

  const dateRangeLabel = useMemo(() => {
    if (fromDate && toDate) {
      return `از ${formatJalaliDisplay(fromDate, digitMode)} تا ${formatJalaliDisplay(toDate, digitMode)}`;
    }
    if (fromDate) return `از ${formatJalaliDisplay(fromDate, digitMode)}`;
    if (toDate) return `تا ${formatJalaliDisplay(toDate, digitMode)}`;
    return 'همه تاریخ‌ها';
  }, [fromDate, toDate, digitMode]);

  const itemOptions = useMemo(
    () =>
      menuItems.map((item) => ({
        value: item.id,
        label: item.name,
        subtitle: `${formatCurrency(itemPricesById.get(item.id) ?? 0, digitMode)}${
          item.isActive ? '' : ' · غیرفعال'
        }`,
        group: item.category,
      })),
    [menuItems, itemPricesById, digitMode]
  );

  const personOptions = useMemo(
    () =>
      people.map((p) => ({
        value: p.id,
        label: p.name,
        subtitle: PERSON_ROLE_LABELS[p.role] || 'سایر',
        group: PERSON_ROLE_LABELS[p.role] || 'سایر',
      })),
    [people]
  );

  const distinctPersonNames = useMemo(
    () => Array.from(new Set(entries.map((e) => e.personName).filter(Boolean))),
    [entries]
  );
  const distinctItemNames = useMemo(
    () => Array.from(new Set(entries.map((e) => e.menuItemName).filter(Boolean))),
    [entries]
  );

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    filterType !== 'all' ||
    filterPerson !== 'all' ||
    filterItem !== 'all' ||
    fromDate !== '' ||
    toDate !== '';

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-[#E7E2DA] dark:border-[#2E2924] bg-white dark:bg-[#1D1A17]">
          <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">
            جمع فروش و دریافتی
          </div>
          <div className="mt-1.5 text-xl font-extrabold font-mono-num tabular-nums text-[#3D6B4F] dark:text-[#7EC496]">
            {formatCurrency(totals.inflow, digitMode)}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-[#E7E2DA] dark:border-[#2E2924] bg-white dark:bg-[#1D1A17]">
          <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">
            جمع پرداخت و هزینه
          </div>
          <div className="mt-1.5 text-xl font-extrabold font-mono-num tabular-nums text-[#B83B2E] dark:text-[#EF7B6E]">
            {formatCurrency(totals.outflow, digitMode)}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-[#E7E2DA] dark:border-[#2E2924] bg-white dark:bg-[#1D1A17]">
          <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">تراز خالص دوره</div>
          <div
            className={`mt-1.5 text-xl font-extrabold font-mono-num tabular-nums ${
              totals.net >= 0
                ? 'text-[#3D6B4F] dark:text-[#7EC496]'
                : 'text-[#B83B2E] dark:text-[#EF7B6E]'
            }`}
          >
            {formatCurrency(totals.net, digitMode)}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-[#E7E2DA] dark:border-[#2E2924] bg-white dark:bg-[#1D1A17]">
          <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">
            تعداد رکوردهای نمایش‌داده‌شده
          </div>
          <div className="mt-1.5 text-xl font-extrabold font-mono-num tabular-nums text-[#1F1B18] dark:text-[#F3EFEA]">
            {formatNumber(filteredEntries.length, digitMode)} رکورد
          </div>
        </div>
      </div>

      {/* Record Entry Form */}
      <section className="min-w-0 rounded-2xl border border-[#E7E2DA] dark:border-[#2E2924] bg-white dark:bg-[#1D1A17] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#EFEAE2] dark:border-[#2E2924]">
          <div>
            <h2 className="text-base font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
              {editingEntryId ? 'ویرایش رکورد دفتر حساب' : 'ثبت رکورد جدید در دفتر حساب'}
            </h2>
            <p className="text-xs text-[#786D65] dark:text-[#9A8F85] mt-0.5">
              با انتخاب آیتم منو، قیمت واحد به‌صورت خودکار از صفحه قیمت‌گذاری فراخوانی و مبلغ کل محاسبه می‌شود.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#FAF8F5] dark:bg-[#141210] border border-[#E7E2DA] dark:border-[#2E2924]">
            {ENTRY_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleEntryTypeChange(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  entryType === t
                    ? 'bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410]'
                    : 'text-[#6B6159] dark:text-[#9A8F85] hover:text-[#1F1B18] dark:hover:text-[#F3EFEA]'
                }`}
              >
                {LEDGER_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SearchableSelect
              id="ledger-item-select"
              label={entryType === 'manual' ? 'آیتم (در ثبت آزاد اختیاری)' : 'انتخاب آیتم منو'}
              value={selectedItemId}
              options={itemOptions}
              allowClear
              placeholder={
                entryType === 'manual'
                  ? 'ثبت آزاد بدون انتخاب آیتم'
                  : 'انتخاب آیتم از منوی کافه...'
              }
              searchPlaceholder="جستجوی آیتم منو..."
              onChange={(val) => handleSelectItem(val)}
            />

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <SearchableSelect
                  id="ledger-person-select"
                  label="فرد / طرف حساب"
                  value={selectedPersonId}
                  options={personOptions}
                  allowClear
                  allowCustomText
                  customText={personCustomName}
                  onCustomTextChange={(txt) => setPersonCustomName(txt)}
                  placeholder="انتخاب یا تایپ نام فرد..."
                  searchPlaceholder="جستجو یا تایپ نام جدید..."
                  onChange={(val, opt) => {
                    setSelectedPersonId(val);
                    if (val !== null) {
                      const found = people.find((p) => p.id === val);
                      if (found) setPersonRole(found.role);
                      if (opt) setPersonCustomName(opt.label);
                    }
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="ledger-person-role"
                  className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
                >
                  نقش
                </label>
                <select
                  id="ledger-person-role"
                  value={personRole}
                  onChange={(e) => setPersonRole(e.target.value as PersonRole)}
                  className="min-h-[42px] px-2 py-2 text-xs rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none focus:border-[#6F4E37] cursor-pointer"
                >
                  {PERSON_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {PERSON_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <JalaliDatePicker
              id="ledger-date-picker"
              label="تاریخ شمسی *"
              value={jalaliDate}
              onChange={setJalaliDate}
              digitMode={digitMode}
            />

            <NumericInput
              id="ledger-qty"
              label="تعداد"
              value={quantity}
              onChange={handleQuantityChange}
              digitMode={digitMode}
              allowDecimal
              min={0}
            />

            <NumericInput
              id="ledger-unit-price"
              label="مبلغ واحد"
              value={unitPrice}
              onChange={handleUnitPriceChange}
              digitMode={digitMode}
              suffix="تومان"
            />

            <NumericInput
              id="ledger-total-amount"
              label="مبلغ کل (محاسبه خودکار / دستی) *"
              value={totalAmount}
              onChange={handleTotalAmountManualChange}
              digitMode={digitMode}
              suffix="تومان"
            />

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label
                htmlFor="ledger-description"
                className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
              >
                توضیحات
              </label>
              <input
                id="ledger-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="مثلاً: سفارش میز ۳، خرید شیر، پرداخت حقوق..."
                className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none focus:border-[#6F4E37] dark:focus:border-[#C89B6E]"
              />
            </div>
          </div>

          {formError && (
            <p className="text-xs font-semibold text-[#B83B2E] dark:text-[#EF7B6E]">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            {editingEntryId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#5C534D] dark:text-[#D5CCC3] hover:bg-[#FAF8F5] dark:hover:bg-[#26211D] cursor-pointer"
              >
                انصراف از ویرایش
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[42px] px-6 py-2 text-sm font-bold rounded-lg bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410] hover:bg-[#5C3D28] dark:hover:bg-[#D4AD84] disabled:opacity-60 flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>
                {submitting
                  ? 'در حال ثبت...'
                  : editingEntryId
                  ? 'ذخیره ویرایش رکورد'
                  : 'ثبت در دفتر حساب'}
              </span>
            </button>
          </div>
        </form>
      </section>

      {/* Filter Bar & Ledger Table */}
      <section className="min-w-0 rounded-2xl border border-[#E7E2DA] dark:border-[#2E2924] bg-white dark:bg-[#1D1A17] overflow-hidden">
        <div className="p-5 border-b border-[#EFEAE2] dark:border-[#2E2924] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
              جدول تراکنش‌ها و دفتر حساب
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onExportExcel(filteredEntries.map((e) => e.id))}
                className="min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#3D6B4F] dark:text-[#7EC496] hover:bg-[#FAF8F5] dark:hover:bg-[#26211D] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>خروجی اکسل دفتر</span>
              </button>
              <button
                type="button"
                onClick={() => onExportPdf(filteredEntries, dateRangeLabel)}
                className="min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#6F4E37] dark:text-[#C89B6E] hover:bg-[#FAF8F5] dark:hover:bg-[#26211D] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-4 h-4" />
                <span>خروجی PDF دفتر</span>
              </button>
            </div>
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div className="lg:col-span-2 flex flex-col gap-1.5">
              <label
                htmlFor="ledger-search"
                className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
              >
                جستجو
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#8C8178] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="ledger-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در آیتم، فرد یا توضیحات..."
                  className="w-full min-h-[42px] pr-9 pl-3 py-2 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none focus:border-[#6F4E37]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="filter-type"
                className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
              >
                نوع ثبت
              </label>
              <select
                id="filter-type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none cursor-pointer"
              >
                <option value="all">همه انواع</option>
                {ENTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LEDGER_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="filter-person"
                className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
              >
                فیلتر فرد
              </label>
              <select
                id="filter-person"
                value={filterPerson}
                onChange={(e) => setFilterPerson(e.target.value)}
                className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none cursor-pointer"
              >
                <option value="all">همه افراد</option>
                {distinctPersonNames.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="filter-item"
                className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
              >
                فیلتر آیتم
              </label>
              <select
                id="filter-item"
                value={filterItem}
                onChange={(e) => setFilterItem(e.target.value)}
                className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none cursor-pointer"
              >
                <option value="all">همه آیتم‌ها</option>
                {distinctItemNames.map((it) => (
                  <option key={it} value={it}>
                    {it}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:col-span-2 lg:col-span-6 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <JalaliDatePicker
                  id="filter-from-date"
                  label="از تاریخ شمسی"
                  value={fromDate}
                  onChange={setFromDate}
                  digitMode={digitMode}
                  allowClear
                  placeholder="ابتدای بازه..."
                />
              </div>
              <div className="lg:col-span-2">
                <JalaliDatePicker
                  id="filter-to-date"
                  label="تا تاریخ شمسی"
                  value={toDate}
                  onChange={setToDate}
                  digitMode={digitMode}
                  allowClear
                  placeholder="انتهای بازه..."
                />
              </div>
              {hasActiveFilters && (
                <div className="lg:col-span-2 flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterType('all');
                      setFilterPerson('all');
                      setFilterItem('all');
                      setFromDate('');
                      setToDate('');
                    }}
                    className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#B83B2E] dark:text-[#EF7B6E] hover:bg-[#B83B2E]/8 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <FilterX className="w-4 h-4" />
                    <span>پاک کردن همه فیلترها</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        {paginatedEntries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm text-[#786D65] dark:text-[#A3988E]">
              {hasActiveFilters
                ? 'هیچ رکوردی مطابق با فیلترهای انتخاب‌شده پیدا نشد.'
                : 'هنوز رکوردی در دفتر حساب ثبت نشده است.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setFilterPerson('all');
                  setFilterItem('all');
                  setFromDate('');
                  setToDate('');
                }}
                className="text-xs font-semibold text-[#6F4E37] dark:text-[#C89B6E] hover:underline cursor-pointer"
              >
                نمایش همه رکوردها
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAF8F5] dark:bg-[#171412] border-b border-[#E7E2DA] dark:border-[#2E2924] text-xs text-[#6B6159] dark:text-[#9A8F85]">
                  <th className="py-3 px-4 text-center font-semibold">تاریخ</th>
                  <th className="py-3 px-4 text-center font-semibold">نوع</th>
                  <th className="py-3 px-4 text-right font-semibold">آیتم</th>
                  <th className="py-3 px-4 text-right font-semibold">فرد</th>
                  <th className="py-3 px-4 text-center font-semibold">تعداد</th>
                  <th className="py-3 px-4 text-left font-semibold">مبلغ واحد</th>
                  <th className="py-3 px-4 text-left font-semibold">مبلغ کل</th>
                  <th className="py-3 px-4 text-right font-semibold">توضیحات</th>
                  <th className="py-3 px-4 text-center font-semibold">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE2] dark:divide-[#2E2924]">
                {paginatedEntries.map((entry) => {
                  const isInflow = INFLOW_TYPES.includes(entry.entryType);
                  const isOutflow = OUTFLOW_TYPES.includes(entry.entryType);
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-[#FAF8F5] dark:hover:bg-[#231F1B] transition-colors"
                    >
                      <td className="py-3 px-4 text-center font-mono-num tabular-nums text-xs text-[#5C534D] dark:text-[#D5CCC3] whitespace-nowrap">
                        {formatJalaliDisplay(entry.jalaliDate, digitMode)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            isInflow
                              ? 'text-[#3D6B4F] dark:text-[#7EC496]'
                              : isOutflow
                              ? 'text-[#B83B2E] dark:text-[#EF7B6E]'
                              : 'text-[#6F4E37] dark:text-[#C89B6E]'
                          }`}
                        >
                          {isInflow ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : isOutflow ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <PenLine className="w-3.5 h-3.5" />
                          )}
                          <span>{LEDGER_TYPE_LABELS[entry.entryType]}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#1F1B18] dark:text-[#F3EFEA]">
                        {entry.menuItemName || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {entry.personName ? (
                          <div>
                            <div className="font-medium text-[#1F1B18] dark:text-[#F3EFEA]">
                              {entry.personName}
                            </div>
                            <div className="text-[11px] text-[#786D65] dark:text-[#9A8F85]">
                              {PERSON_ROLE_LABELS[entry.personRole] || 'سایر'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#8C8178]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono-num tabular-nums text-[#5C534D] dark:text-[#D5CCC3]">
                        {formatNumber(entry.quantity, digitMode, 2)}
                      </td>
                      <td className="py-3 px-4 text-left font-mono-num tabular-nums text-xs text-[#5C534D] dark:text-[#D5CCC3]">
                        {formatNumber(entry.unitPrice, digitMode)}
                      </td>
                      <td
                        className={`py-3 px-4 text-left font-mono-num tabular-nums font-bold whitespace-nowrap ${
                          isInflow
                            ? 'text-[#3D6B4F] dark:text-[#7EC496]'
                            : isOutflow
                            ? 'text-[#B83B2E] dark:text-[#EF7B6E]'
                            : 'text-[#1F1B18] dark:text-[#F3EFEA]'
                        }`}
                      >
                        {formatCurrency(entry.totalAmount, digitMode)}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#6B6159] dark:text-[#A3988E] max-w-[220px] truncate">
                        {entry.description || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            aria-label={`ویرایش رکورد ${entry.description || entry.id}`}
                            onClick={() => handleEditRow(entry)}
                            className="p-1.5 rounded-lg text-[#6F4E37] dark:text-[#C89B6E] hover:bg-[#F5EFE8] dark:hover:bg-[#2B241F] cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {confirmDeleteId === entry.id ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteEntry(entry.id);
                                setConfirmDeleteId(null);
                                onNotify('رکورد از دفتر حساب حذف شد.');
                              }}
                              className="px-2 py-1 text-[11px] font-semibold rounded bg-[#B83B2E] text-white cursor-pointer"
                            >
                              تأیید
                            </button>
                          ) : (
                            <button
                              type="button"
                              aria-label={`حذف رکورد ${entry.description || entry.id}`}
                              onClick={() => setConfirmDeleteId(entry.id)}
                              className="p-1.5 rounded-lg text-[#B83B2E] dark:text-[#EF7B6E] hover:bg-[#B83B2E]/10 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[#EFEAE2] dark:border-[#2E2924] flex items-center justify-between text-xs text-[#6B6159] dark:text-[#A3988E]">
            <span>
              صفحه {formatNumber(currentPage, digitMode)} از{' '}
              {formatNumber(totalPages, digitMode)}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="صفحه قبلی"
                className="p-1.5 rounded-lg border border-[#DDD6CC] dark:border-[#342E29] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="صفحه بعدی"
                className="p-1.5 rounded-lg border border-[#DDD6CC] dark:border-[#342E29] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
