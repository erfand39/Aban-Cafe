import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatCurrency } from '../shared/format';
import { calculateMaterialUnitCost } from '../shared/pricing';
import type { DigitMode, Material } from '../shared/types';
import { NumericInput } from './NumericInput';

interface MaterialModalProps {
  open: boolean;
  editingMaterial: Material | null;
  digitMode: DigitMode;
  onClose: () => void;
  onSave: (payload: Omit<Material, 'id' | 'updatedAt'>, editingId?: number) => Promise<void>;
}

const PURCHASE_UNIT_PRESETS = ['کیلوگرم', 'لیتر', 'عدد', 'بسته', 'گرم'];
const CONSUMPTION_UNIT_PRESETS = ['گرم', 'میلی‌لیتر', 'عدد', 'شات', 'ساشه'];

export function MaterialModal({
  open,
  editingMaterial,
  digitMode,
  onClose,
  onSave,
}: MaterialModalProps) {
  const [name, setName] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState('کیلوگرم');
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [baseQuantity, setBaseQuantity] = useState(1000);
  const [consumptionUnit, setConsumptionUnit] = useState('گرم');
  const [conversionFactor, setConversionFactor] = useState(1000);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isZeroCost, setIsZeroCost] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingMaterial) {
      setName(editingMaterial.name);
      setPurchaseUnit(editingMaterial.purchaseUnit);
      setPurchasePrice(editingMaterial.purchasePrice);
      setBaseQuantity(editingMaterial.baseQuantity);
      setConsumptionUnit(editingMaterial.consumptionUnit);
      setConversionFactor(editingMaterial.conversionFactor);
      setIsAvailable(editingMaterial.isAvailable);
      setIsZeroCost(editingMaterial.isZeroCost);
      setNotes(editingMaterial.notes);
    } else {
      setName('');
      setPurchaseUnit('کیلوگرم');
      setPurchasePrice(0);
      setBaseQuantity(1000);
      setConsumptionUnit('گرم');
      setConversionFactor(1000);
      setIsAvailable(true);
      setIsZeroCost(false);
      setNotes('');
    }
    setError('');
  }, [open, editingMaterial]);

  if (!open) return null;

  const previewUnitCost = calculateMaterialUnitCost({
    id: 0,
    name,
    purchaseUnit,
    purchasePrice: isZeroCost ? 0 : purchasePrice,
    baseQuantity,
    consumptionUnit,
    conversionFactor,
    isAvailable,
    isZeroCost,
    notes,
    updatedAt: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('لطفاً نام ماده اولیه را وارد کنید.');
      return;
    }
    if (baseQuantity <= 0) {
      setError('مقدار مبنا باید بزرگ‌تر از صفر باشد.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(
        {
          name: name.trim(),
          purchaseUnit: purchaseUnit.trim() || 'کیلوگرم',
          purchasePrice: isZeroCost ? 0 : purchasePrice,
          baseQuantity,
          consumptionUnit: consumptionUnit.trim() || 'گرم',
          conversionFactor: conversionFactor > 0 ? conversionFactor : baseQuantity,
          isAvailable,
          isZeroCost,
          notes: notes.trim(),
        },
        editingMaterial?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره ماده اولیه');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-xl rounded-2xl border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#1D1A17] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EFEAE2] dark:border-[#2E2924] flex items-center justify-between">
          <h2
            id="material-modal-title"
            className="text-base font-bold text-[#1F1B18] dark:text-[#F3EFEA]"
          >
            {editingMaterial ? `ویرایش ماده اولیه: ${editingMaterial.name}` : 'افزودن ماده اولیه جدید'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره ماده اولیه"
            className="p-1.5 rounded-lg text-[#786D65] hover:bg-[#F5EFE8] dark:hover:bg-[#2B241F] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label
                htmlFor="mat-name"
                className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
              >
                نام ماده اولیه *
              </label>
              <input
                id="mat-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: دانه قهوه عربیکا، شیر تازه، سیروپ فندق..."
                className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none focus:border-[#6F4E37] dark:focus:border-[#C89B6E]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="mat-purchase-unit"
                className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
              >
                واحد خرید
              </label>
              <input
                id="mat-purchase-unit"
                list="purchase-unit-list"
                type="text"
                value={purchaseUnit}
                onChange={(e) => {
                  const val = e.target.value;
                  setPurchaseUnit(val);
                  if (val === 'کیلوگرم') {
                    setConsumptionUnit('گرم');
                    setBaseQuantity(1000);
                    setConversionFactor(1000);
                  } else if (val === 'لیتر') {
                    setConsumptionUnit('میلی‌لیتر');
                    setBaseQuantity(1000);
                    setConversionFactor(1000);
                  } else if (val === 'عدد') {
                    setConsumptionUnit('عدد');
                    setBaseQuantity(1);
                    setConversionFactor(1);
                  }
                }}
                className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none focus:border-[#6F4E37]"
              />
              <datalist id="purchase-unit-list">
                {PURCHASE_UNIT_PRESETS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>

            <NumericInput
              id="mat-purchase-price"
              label="قیمت خرید"
              value={isZeroCost ? 0 : purchasePrice}
              onChange={setPurchasePrice}
              digitMode={digitMode}
              suffix="تومان"
              disabled={isZeroCost}
            />

            <NumericInput
              id="mat-base-qty"
              label="مقدار مبنا در هر واحد خرید"
              value={baseQuantity}
              onChange={(v) => {
                setBaseQuantity(v);
                setConversionFactor(v);
              }}
              digitMode={digitMode}
              allowDecimal
              min={0.01}
            />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="mat-consumption-unit"
                className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
              >
                واحد مصرف در فرمول
              </label>
              <input
                id="mat-consumption-unit"
                list="consumption-unit-list"
                type="text"
                value={consumptionUnit}
                onChange={(e) => setConsumptionUnit(e.target.value)}
                className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none focus:border-[#6F4E37]"
              />
              <datalist id="consumption-unit-list">
                {CONSUMPTION_UNIT_PRESETS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label
                htmlFor="mat-notes"
                className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
              >
                توضیحات
              </label>
              <input
                id="mat-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثلاً: برند، نوع بسته‌بندی یا نکته مصرفی"
                className="min-h-[40px] px-3 py-2 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none focus:border-[#6F4E37]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm text-[#1F1B18] dark:text-[#F3EFEA] cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="w-4 h-4 accent-[#6F4E37] rounded cursor-pointer"
              />
              <span>موجود و فعال در انبار</span>
            </label>

            <label className="flex items-center gap-2 text-sm text-[#1F1B18] dark:text-[#F3EFEA] cursor-pointer">
              <input
                type="checkbox"
                checked={isZeroCost}
                onChange={(e) => setIsZeroCost(e.target.checked)}
                className="w-4 h-4 accent-[#6F4E37] rounded cursor-pointer"
              />
              <span>ماده توضیحی با هزینه صفر (مثل آب)</span>
            </label>
          </div>

          <div className="pt-3 border-t border-[#EFEAE2] dark:border-[#2E2924] flex items-center justify-between gap-4 text-sm">
            <span className="text-[#786D65] dark:text-[#A3988E]">
              نرخ محاسبه‌شده هر {consumptionUnit || 'واحد'}:
            </span>
            <span className="font-bold font-mono-num tabular-nums text-[#3D6B4F] dark:text-[#7EC496]">
              {formatCurrency(previewUnitCost, digitMode)}
            </span>
          </div>

          {error && (
            <p className="text-xs font-medium text-[#B83B2E] dark:text-[#EF7B6E]">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#5C534D] dark:text-[#D5CCC3] hover:bg-[#FAF8F5] dark:hover:bg-[#26211D] cursor-pointer whitespace-nowrap"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410] hover:bg-[#5C3D28] dark:hover:bg-[#D4AD84] disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {saving ? 'در حال ذخیره...' : editingMaterial ? 'ذخیره تغییرات' : 'ثبت ماده اولیه'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
