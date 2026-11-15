import { useState } from 'react';
import { Copy, X } from 'lucide-react';
import type { MenuItem } from '../shared/types';

interface CopyRecipeModalProps {
  open: boolean;
  targetItem: MenuItem | null;
  allItems: MenuItem[];
  onClose: () => void;
  onCopy: (sourceItem: MenuItem) => void;
}

export function CopyRecipeModal({
  open,
  targetItem,
  allItems,
  onClose,
  onCopy,
}: CopyRecipeModalProps) {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);

  if (!open || !targetItem) return null;

  const candidates = allItems.filter((item) => item.id !== targetItem.id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-recipe-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#1D1A17] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EFEAE2] dark:border-[#2E2924] flex items-center justify-between">
          <h2
            id="copy-recipe-title"
            className="text-base font-bold text-[#1F1B18] dark:text-[#F3EFEA]"
          >
            کپی فرمول برای «{targetItem.name}»
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره کپی فرمول"
            className="p-1.5 rounded-lg text-[#786D65] hover:bg-[#F5EFE8] dark:hover:bg-[#2B241F] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs leading-relaxed text-[#786D65] dark:text-[#A3988E]">
            مواد تشکیل‌دهنده و مقادیر مصرفی آیتم انتخاب‌شده جایگزین فرمول فعلی «{targetItem.name}» می‌شود.
          </p>

          <div className="max-h-64 overflow-y-auto divide-y divide-[#EFEAE2] dark:divide-[#2E2924] border border-[#E7E2DA] dark:border-[#2E2924] rounded-xl">
            {candidates.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8C8178]">آیتم دیگری وجود ندارد.</div>
            ) : (
              candidates.map((cand) => {
                const isSelected = selectedSourceId === cand.id;
                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => setSelectedSourceId(cand.id)}
                    className={`w-full px-4 py-3 text-right flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#F5EFE8] dark:bg-[#2B241F] text-[#5C3D28] dark:text-[#E8C5A0]'
                        : 'hover:bg-[#FAF8F5] dark:hover:bg-[#26211D] text-[#1F1B18] dark:text-[#F3EFEA]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{cand.name}</div>
                      <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">
                        {cand.category} · {cand.ingredients.length} ماده اولیه
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#5C534D] dark:text-[#D5CCC3] hover:bg-[#FAF8F5] dark:hover:bg-[#26211D] cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={!selectedSourceId}
              onClick={() => {
                const src = candidates.find((c) => c.id === selectedSourceId);
                if (src) {
                  onCopy(src);
                  onClose();
                }
              }}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410] hover:bg-[#5C3D28] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>کپی فرمول</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
