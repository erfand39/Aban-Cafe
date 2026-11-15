import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { MenuItem } from '../shared/types';

interface MenuItemModalProps {
  open: boolean;
  editingItem: MenuItem | null;
  categories: string[];
  defaultLaborRatePerMinute: number;
  onClose: () => void;
  onSave: (payload: { name: string; category: string; notes: string; isActive: boolean }) => Promise<void>;
}

const DEFAULT_CATEGORIES = [
  'بر پایه اسپرسو',
  'نوشیدنی گرم بدون قهوه',
  'نوشیدنی سرد',
  'چای و دمنوش',
  'کیک و دسر',
  'آیتم سفارشی',
];

export function MenuItemModal({
  open,
  editingItem,
  categories,
  onClose,
  onSave,
}: MenuItemModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('بر پایه اسپرسو');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...categories]));

  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setName(editingItem.name);
      setCategory(editingItem.category);
      setNotes(editingItem.notes);
      setIsActive(editingItem.isActive);
    } else {
      setName('');
      setCategory('بر پایه اسپرسو');
      setNotes('');
      setIsActive(true);
    }
    setError('');
  }, [open, editingItem]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('نام آیتم منو الزامی است.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        category: category.trim() || 'آیتم سفارشی',
        notes: notes.trim(),
        isActive,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره آیتم');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#1D1A17] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EFEAE2] dark:border-[#2E2924] flex items-center justify-between">
          <h2
            id="item-modal-title"
            className="text-base font-bold text-[#1F1B18] dark:text-[#F3EFEA]"
          >
            {editingItem ? `ویرایش مشخصات: ${editingItem.name}` : 'افزودن آیتم جدید به منو'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره آیتم"
            className="p-1.5 rounded-lg text-[#786D65] hover:bg-[#F5EFE8] dark:hover:bg-[#2B241F] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="menu-item-name"
              className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
            >
              نام آیتم *
            </label>
            <input
              id="menu-item-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: آیس کارامل ماکیاتو"
              className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none focus:border-[#6F4E37] dark:focus:border-[#C89B6E]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="menu-item-category"
              className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
            >
              دسته‌بندی
            </label>
            <input
              id="menu-item-category"
              list="menu-categories-list"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none focus:border-[#6F4E37]"
            />
            <datalist id="menu-categories-list">
              {allCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="menu-item-notes"
              className="text-xs font-medium text-[#5C534D] dark:text-[#B8AEA4]"
            >
              توضیحات سرو / آماده‌سازی
            </label>
            <input
              id="menu-item-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثلاً: سرو در لیوان شیشه‌ای بلند با یخ"
              className="min-h-[40px] px-3 py-2 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none focus:border-[#6F4E37]"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[#1F1B18] dark:text-[#F3EFEA] cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-[#6F4E37] rounded cursor-pointer"
            />
            <span>آیتم در منوی فعال کافه نمایش داده شود</span>
          </label>

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
              {saving ? 'در حال ذخیره...' : editingItem ? 'به‌روزرسانی' : 'ایجاد آیتم و تنظیم فرمول'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
