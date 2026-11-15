import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  Edit3,
  Layers,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '../shared/format';
import { calculateMaterialUnitCost, calculateMenuItemPricing } from '../shared/pricing';
import type {
  DigitMode,
  LedgerEntry,
  Material,
  MenuItem,
  OverheadLine,
  RecipeIngredient,
} from '../shared/types';
import { AnalyticsModal } from './AnalyticsModal';
import { CopyRecipeModal } from './CopyRecipeModal';
import { MaterialModal } from './MaterialModal';
import { MenuItemModal } from './MenuItemModal';
import { NumericInput } from './NumericInput';
import { SearchableSelect } from './SearchableSelect';

interface PricingPageProps {
  materials: Material[];
  menuItems: MenuItem[];
  ledgerEntries: LedgerEntry[];
  digitMode: DigitMode;
  defaultLaborRatePerMinute: number;
  onCreateMaterial: (payload: Omit<Material, 'id' | 'updatedAt'>) => Promise<void>;
  onUpdateMaterial: (id: number, payload: Omit<Material, 'id' | 'updatedAt'>) => Promise<void>;
  onDeleteMaterial: (id: number) => Promise<void>;
  onCreateMenuItem: (payload: Omit<MenuItem, 'id' | 'updatedAt'>) => Promise<MenuItem>;
  onUpdateMenuItem: (id: number, payload: Omit<MenuItem, 'id' | 'updatedAt'>) => Promise<void>;
  onDeleteMenuItem: (id: number) => Promise<void>;
  onNavigateToLedger: () => void;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export function PricingPage({
  materials,
  menuItems,
  ledgerEntries,
  digitMode,
  defaultLaborRatePerMinute,
  onCreateMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  onCreateMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onNavigateToLedger,
  onNotify,
}: PricingPageProps) {
  const [subTab, setSubTab] = useState<'recipes' | 'materials'>('recipes');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(
    menuItems[0]?.id ?? null
  );

  // Draft editing state for the selected menu item
  const [draft, setDraft] = useState<MenuItem | null>(() =>
    menuItems[0] ? structuredClone(menuItems[0]) : null
  );
  const [isDirty, setIsDirty] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<number | null>(null);

  // Material modal & delete state
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [confirmDeleteMaterialId, setConfirmDeleteMaterialId] = useState<number | null>(null);

  // Menu item metadata modal, copy modal & analytics modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingMetaItem, setEditingMetaItem] = useState<MenuItem | null>(null);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Add ingredient picker
  const [materialToAddId, setMaterialToAddId] = useState<number | null>(null);

  const materialsById = useMemo(
    () => new Map(materials.map((m) => [m.id, m])),
    [materials]
  );

  const categories = useMemo(
    () => Array.from(new Set(menuItems.map((i) => i.category).filter(Boolean))),
    [menuItems]
  );

  useEffect(() => {
    if (!selectedItemId && menuItems.length > 0) {
      setSelectedItemId(menuItems[0].id);
      return;
    }
    const found = menuItems.find((m) => m.id === selectedItemId);
    if (found) {
      setDraft(structuredClone(found));
      setIsDirty(false);
      setConfirmDeleteItemId(null);
    } else if (menuItems.length > 0) {
      setSelectedItemId(menuItems[0].id);
    } else {
      setDraft(null);
    }
  }, [selectedItemId, menuItems]);

  const filteredMenuItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return menuItems.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [menuItems, searchQuery, categoryFilter]);

  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.purchaseUnit.toLowerCase().includes(q) ||
        m.notes.toLowerCase().includes(q)
    );
  }, [materials, searchQuery]);

  const draftBreakdown = useMemo(() => {
    if (!draft) return null;
    return calculateMenuItemPricing(draft, materialsById);
  }, [draft, materialsById]);

  const updateDraft = (updater: (prev: MenuItem) => MenuItem) => {
    setDraft((prev) => {
      if (!prev) return null;
      return updater(prev);
    });
    setIsDirty(true);
  };

  const handleSaveDraft = async () => {
    if (!draft) return;
    setSavingItem(true);
    try {
      await onUpdateMenuItem(draft.id, {
        name: draft.name,
        category: draft.category,
        isActive: draft.isActive,
        overheadMode: draft.overheadMode,
        overheadFixed: draft.overheadFixed,
        overheadPercent: draft.overheadPercent,
        overheadItems: draft.overheadItems,
        laborMode: draft.laborMode,
        laborFixed: draft.laborFixed,
        prepMinutes: draft.prepMinutes,
        laborRatePerMinute: draft.laborRatePerMinute,
        profitMode: draft.profitMode,
        profitValue: draft.profitValue,
        notes: draft.notes,
        ingredients: draft.ingredients,
      });
      setIsDirty(false);
      onNotify(`قیمت‌گذاری «${draft.name}» با موفقیت ذخیره شد.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ذخیره آیتم', 'error');
    } finally {
      setSavingItem(false);
    }
  };

  const handleAddIngredient = (materialId: number | null) => {
    if (!materialId || !draft) return;
    const mat = materialsById.get(materialId);
    if (!mat) return;
    const alreadyExists = draft.ingredients.some((i) => i.materialId === materialId);
    if (alreadyExists) {
      onNotify(`ماده «${mat.name}» از قبل در فرمول این آیتم وجود دارد.`, 'error');
      setMaterialToAddId(null);
      return;
    }
    const defaultQty =
      mat.consumptionUnit === 'عدد' ? 1 : mat.consumptionUnit === 'گرم' ? 10 : 100;
    updateDraft((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { materialId, quantity: defaultQty, notes: '' },
      ],
    }));
    setMaterialToAddId(null);
  };

  const handleUpdateIngredient = (
    idx: number,
    patch: Partial<RecipeIngredient>
  ) => {
    updateDraft((prev) => {
      const next = [...prev.ingredients];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, ingredients: next };
    });
  };

  const handleRemoveIngredient = (idx: number) => {
    updateDraft((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx),
    }));
  };

  const handleAddOverheadLine = () => {
    updateDraft((prev) => {
      const nextLines: OverheadLine[] = [
        ...prev.overheadItems,
        { title: 'سایر هزینه‌های جانبی', amount: 1000 },
      ];
      return {
        ...prev,
        overheadItems: nextLines,
        overheadFixed: nextLines.reduce((s, x) => s + x.amount, 0),
      };
    });
  };

  const handleUpdateOverheadLine = (idx: number, patch: Partial<OverheadLine>) => {
    updateDraft((prev) => {
      const nextLines = prev.overheadItems.map((line, i) =>
        i === idx ? { ...line, ...patch } : line
      );
      return {
        ...prev,
        overheadItems: nextLines,
        overheadFixed: nextLines.reduce((s, x) => s + x.amount, 0),
      };
    });
  };

  const handleRemoveOverheadLine = (idx: number) => {
    updateDraft((prev) => {
      const nextLines = prev.overheadItems.filter((_, i) => i !== idx);
      return {
        ...prev,
        overheadItems: nextLines,
        overheadFixed: nextLines.reduce((s, x) => s + x.amount, 0),
      };
    });
  };

  const materialOptions = useMemo(
    () =>
      materials.map((m) => ({
        value: m.id,
        label: m.name,
        subtitle: m.isZeroCost
          ? `${m.consumptionUnit} · توضیحی (هزینه صفر)`
          : `${formatCurrency(calculateMaterialUnitCost(m), digitMode)} به ازای هر ${m.consumptionUnit}`,
        group: m.isAvailable ? 'مواد اولیه موجود' : 'مواد غیرفعال',
      })),
    [materials, digitMode]
  );

  return (
    <div className="space-y-6">
      {/* Sub-navigation & Workspace Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E7E2DA] dark:border-[#2E2924]">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="grid grid-cols-2 sm:inline-flex items-center p-1 rounded-xl bg-[#EFEAE2] dark:bg-[#1D1A17] border border-[#E7E2DA] dark:border-[#2E2924] w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setSubTab('recipes');
                setSearchQuery('');
              }}
              className={`px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'recipes'
                  ? 'bg-white dark:bg-[#2C2623] text-[#1F1B18] dark:text-[#F3EFEA] shadow-xs'
                  : 'text-[#6B6159] dark:text-[#9A8F85] hover:text-[#1F1B18] dark:hover:text-[#F3EFEA]'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className="truncate">آیتم‌ها و فرمول</span>
              <span className="text-[11px] opacity-70 tabular-nums">
                ({formatNumber(menuItems.length, digitMode)})
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSubTab('materials');
                setSearchQuery('');
              }}
              className={`px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'materials'
                  ? 'bg-white dark:bg-[#2C2623] text-[#1F1B18] dark:text-[#F3EFEA] shadow-xs'
                  : 'text-[#6B6159] dark:text-[#9A8F85] hover:text-[#1F1B18] dark:hover:text-[#F3EFEA]'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span className="truncate">مواد اولیه</span>
              <span className="text-[11px] opacity-70 tabular-nums">
                ({formatNumber(materials.length, digitMode)})
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-[#8C8178] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                subTab === 'recipes' ? 'جستجوی آیتم منو...' : 'جستجوی ماده اولیه...'
              }
              aria-label={subTab === 'recipes' ? 'جستجوی آیتم منو' : 'جستجوی ماده اولیه'}
              className="w-full min-h-[40px] pr-9 pl-3 py-1.5 text-sm rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] placeholder:text-[#8C8178] focus:outline-none focus:border-[#6F4E37] dark:focus:border-[#C89B6E]"
            />
          </div>

          <button
            type="button"
            onClick={() => setAnalyticsOpen(true)}
            className="min-h-[40px] px-3.5 py-2 text-sm font-semibold rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#4A3326] dark:text-[#E8C5A0] hover:bg-[#FAF8F5] dark:hover:bg-[#26211D] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-[#6F4E37] dark:text-[#C89B6E]" />
            <span>گزارش سود و فروش</span>
          </button>

          {subTab === 'recipes' ? (
            <button
              type="button"
              onClick={() => {
                setEditingMetaItem(null);
                setItemModalOpen(true);
              }}
              className="min-h-[40px] px-4 py-2 text-sm font-semibold rounded-lg bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410] hover:bg-[#5C3D28] dark:hover:bg-[#D4AD84] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن آیتم جدید</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingMaterial(null);
                setMaterialModalOpen(true);
              }}
              className="min-h-[40px] px-4 py-2 text-sm font-semibold rounded-lg bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410] hover:bg-[#5C3D28] dark:hover:bg-[#D4AD84] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن ماده اولیه</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {subTab === 'recipes' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Menu Items Sidebar List */}
          <aside className="min-w-0 lg:col-span-4 rounded-2xl border border-[#E7E2DA] dark:border-[#2E2924] bg-white dark:bg-[#1D1A17] overflow-hidden">
            <div className="p-4 border-b border-[#EFEAE2] dark:border-[#2E2924] flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                فهرست آیتم‌های منو
              </h2>
              <select
                aria-label="فیلتر دسته‌بندی منو"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-[#FAF8F5] dark:bg-[#141210] text-[#5C534D] dark:text-[#D5CCC3] focus:outline-none cursor-pointer"
              >
                <option value="all">همه دسته‌ها</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {filteredMenuItems.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-[#786D65] dark:text-[#A3988E]">
                  {menuItems.length === 0
                    ? 'هنوز آیتمی در منو ثبت نشده است.'
                    : 'آیتمی با این مشخصات پیدا نشد.'}
                </p>
                {menuItems.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMetaItem(null);
                      setItemModalOpen(true);
                    }}
                    className="text-xs font-semibold text-[#6F4E37] dark:text-[#C89B6E] hover:underline cursor-pointer"
                  >
                    افزودن اولین آیتم منو
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('all');
                    }}
                    className="text-xs font-semibold text-[#6F4E37] dark:text-[#C89B6E] hover:underline cursor-pointer"
                  >
                    پاک کردن فیلترها
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#EFEAE2] dark:divide-[#2E2924] max-h-[720px] overflow-y-auto">
                {filteredMenuItems.map((item) => {
                  const isSelected = draft?.id === item.id;
                  const b = isSelected && draftBreakdown
                    ? draftBreakdown
                    : calculateMenuItemPricing(item, materialsById);

                  return (
                    <div
                      key={item.id}
                      className={`p-4 transition-colors flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#F5EFE8] dark:bg-[#29231E]'
                          : 'hover:bg-[#FAF8F5] dark:hover:bg-[#231F1B]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedItemId(item.id)}
                        className="flex-1 text-right min-w-0 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#1F1B18] dark:text-[#F3EFEA] truncate">
                            {item.name}
                          </span>
                          {!item.isActive && (
                            <span className="text-[11px] font-medium text-[#B83B2E] dark:text-[#EF7B6E]">
                              · غیرفعال
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-[#786D65] dark:text-[#9A8F85] truncate">
                          {item.category} · {formatNumber(item.ingredients.length, digitMode)} ماده
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs tabular-nums">
                          <span className="text-[#6B6159] dark:text-[#A3988E]">
                            تمام‌شده: {formatNumber(b.costOfGoods, digitMode)}
                          </span>
                          <span className="font-bold text-[#3D6B4F] dark:text-[#7EC496]">
                            عرضه: {formatNumber(b.sellingPrice, digitMode)} ت
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        aria-label={`ویرایش مشخصات ${item.name}`}
                        onClick={() => {
                          setEditingMetaItem(item);
                          setItemModalOpen(true);
                        }}
                        className="p-2 rounded-lg text-[#786D65] hover:text-[#1F1B18] dark:text-[#9A8F85] dark:hover:text-[#F3EFEA] hover:bg-white/70 dark:hover:bg-[#191614] cursor-pointer shrink-0"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Recipe & Costing Breakdown Panel */}
          <section className="min-w-0 lg:col-span-8 rounded-2xl border border-[#E7E2DA] dark:border-[#2E2924] bg-white dark:bg-[#1D1A17]">
            {!draft || !draftBreakdown ? (
              <div className="p-12 text-center space-y-4">
                <p className="text-sm text-[#786D65] dark:text-[#A3988E]">
                  برای شروع قیمت‌گذاری، یک آیتم را انتخاب یا آیتم جدیدی ایجاد کنید.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMetaItem(null);
                    setItemModalOpen(true);
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410] cursor-pointer"
                >
                  افزودن اولین آیتم
                </button>
              </div>
            ) : (
              <div>
                {/* Item Header */}
                <div className="p-6 border-b border-[#EFEAE2] dark:border-[#2E2924] flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-extrabold text-[#1F1B18] dark:text-[#F3EFEA]">
                        {draft.name}
                      </h2>
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft((p) => ({ ...p, isActive: !p.isActive }))
                        }
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                          draft.isActive
                            ? 'border-[#3D6B4F]/30 text-[#3D6B4F] dark:text-[#7EC496] bg-[#3D6B4F]/8'
                            : 'border-[#B83B2E]/30 text-[#B83B2E] dark:text-[#EF7B6E] bg-[#B83B2E]/8'
                        }`}
                      >
                        {draft.isActive ? 'فعال در منو' : 'غیرفعال'}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-[#786D65] dark:text-[#9A8F85]">
                      {draft.category}
                      {draft.notes ? ` · ${draft.notes}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCopyModalOpen(true)}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#5C534D] dark:text-[#D5CCC3] hover:bg-[#FAF8F5] dark:hover:bg-[#26211D] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>کپی فرمول از آیتم دیگر</span>
                    </button>

                    {confirmDeleteItemId === draft.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteMenuItem(draft.id);
                            setConfirmDeleteItemId(null);
                            onNotify(`آیتم «${draft.name}» حذف شد.`);
                          }}
                          className="min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#B83B2E] text-white hover:bg-[#9C2F24] cursor-pointer whitespace-nowrap"
                        >
                          تأیید حذف
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteItemId(null)}
                          className="min-h-[38px] px-2.5 py-1.5 text-xs rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#786D65] cursor-pointer"
                        >
                          لغو
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteItemId(draft.id)}
                        aria-label={`حذف آیتم ${draft.name}`}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#B83B2E] dark:text-[#EF7B6E] hover:bg-[#B83B2E]/10 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={savingItem}
                      onClick={handleSaveDraft}
                      className={`min-h-[38px] px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                        isDirty
                          ? 'bg-[#3D6B4F] text-white hover:bg-[#2F563E]'
                          : 'bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410] hover:bg-[#5C3D28]'
                      }`}
                    >
                      {isDirty ? <Save className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      <span>
                        {savingItem
                          ? 'در حال ذخیره...'
                          : isDirty
                          ? 'ذخیره تغییرات'
                          : 'ذخیره‌شده'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Live Costing Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-[#EFEAE2] dark:divide-[#2E2924] bg-[#FAF8F5] dark:bg-[#171412] border-b border-[#EFEAE2] dark:border-[#2E2924]">
                  <div className="p-4">
                    <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">بهای مواد اولیه</div>
                    <div className="mt-1 text-base font-bold font-mono-num tabular-nums text-[#1F1B18] dark:text-[#F3EFEA]">
                      {formatCurrency(draftBreakdown.materialsCost, digitMode)}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">هزینه جانبی</div>
                    <div className="mt-1 text-base font-bold font-mono-num tabular-nums text-[#1F1B18] dark:text-[#F3EFEA]">
                      {formatCurrency(draftBreakdown.overheadCost, digitMode)}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">هزینه فرد</div>
                    <div className="mt-1 text-base font-bold font-mono-num tabular-nums text-[#1F1B18] dark:text-[#F3EFEA]">
                      {formatCurrency(draftBreakdown.laborCost, digitMode)}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">بهای تمام‌شده</div>
                    <div className="mt-1 text-base font-extrabold font-mono-num tabular-nums text-[#6F4E37] dark:text-[#C89B6E]">
                      {formatCurrency(draftBreakdown.costOfGoods, digitMode)}
                    </div>
                  </div>
                  <div className="p-4 col-span-2 sm:col-span-1">
                    <div className="text-xs text-[#786D65] dark:text-[#9A8F85]">
                      قیمت عرضه ({formatNumber(draftBreakdown.profitMarginPercent, digitMode, 1)}٪ حاشیه)
                    </div>
                    <div className="mt-1 text-lg font-extrabold font-mono-num tabular-nums text-[#3D6B4F] dark:text-[#7EC496]">
                      {formatCurrency(draftBreakdown.sellingPrice, digitMode)}
                    </div>
                  </div>
                </div>

                {draftBreakdown.hasUnavailableMaterial && (
                  <div className="px-6 py-3 bg-[#B46A1A]/10 border-b border-[#B46A1A]/25 flex items-center gap-2 text-xs font-medium text-[#8C5010] dark:text-[#F0B36E]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      یک یا چند ماده اولیه در دستور تهیه این آیتم در وضعیت «غیرفعال» است.
                    </span>
                  </div>
                )}

                {/* Section 1: Recipe Ingredients */}
                <div className="p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                        ۱. مواد تشکیل‌دهنده و دستور تهیه
                      </h3>
                      <p className="text-xs text-[#786D65] dark:text-[#9A8F85] mt-0.5">
                        هزینه هر ماده = (قیمت خرید ÷ مقدار مبنا) × مقدار مصرف
                      </p>
                    </div>
                    <div className="w-full sm:w-72">
                      <SearchableSelect
                        id="add-ingredient-select"
                        label="افزودن ماده به فرمول"
                        value={materialToAddId}
                        options={materialOptions}
                        placeholder="انتخاب ماده اولیه برای افزودن..."
                        searchPlaceholder="جستجو در مواد اولیه..."
                        onChange={(val) => handleAddIngredient(val)}
                      />
                    </div>
                  </div>

                  {draft.ingredients.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-[#DDD6CC] dark:border-[#342E29] rounded-xl text-xs text-[#786D65] dark:text-[#9A8F85]">
                      هنوز ماده‌ای به دستور تهیه این آیتم اضافه نشده است. از منوی بالا ماده اولیه انتخاب کنید.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-[#E7E2DA] dark:border-[#2E2924] rounded-xl">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#FAF8F5] dark:bg-[#171412] border-b border-[#E7E2DA] dark:border-[#2E2924] text-xs text-[#6B6159] dark:text-[#9A8F85]">
                            <th className="py-2.5 px-3 text-right font-semibold">ماده اولیه</th>
                            <th className="py-2.5 px-3 text-right font-semibold w-40">مقدار مصرف</th>
                            <th className="py-2.5 px-3 text-left font-semibold">نرخ واحد</th>
                            <th className="py-2.5 px-3 text-left font-semibold">هزینه ماده</th>
                            <th className="py-2.5 px-3 text-right font-semibold">توضیح</th>
                            <th className="py-2.5 px-3 text-center font-semibold w-14">حذف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFEAE2] dark:divide-[#2E2924]">
                          {draft.ingredients.map((ing, idx) => {
                            const breakdownIng = draftBreakdown.ingredients[idx];
                            const mat = materialsById.get(ing.materialId);
                            return (
                              <tr
                                key={`${ing.materialId}-${idx}`}
                                className="hover:bg-[#FAF8F5]/70 dark:hover:bg-[#231F1B]"
                              >
                                <td className="py-2.5 px-3 font-medium text-[#1F1B18] dark:text-[#F3EFEA]">
                                  <div>{mat?.name ?? 'ماده حذف‌شده'}</div>
                                  {mat && !mat.isAvailable && (
                                    <span className="text-[11px] text-[#B46A1A] dark:text-[#F0B36E]">
                                      ناموجود
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <NumericInput
                                    compact
                                    ariaLabel={`مقدار مصرف ${mat?.name ?? 'ماده'}`}
                                    value={ing.quantity}
                                    onChange={(qty) =>
                                      handleUpdateIngredient(idx, { quantity: qty })
                                    }
                                    digitMode={digitMode}
                                    suffix={mat?.consumptionUnit || ''}
                                    allowDecimal
                                  />
                                </td>
                                <td className="py-2.5 px-3 text-left font-mono-num tabular-nums text-xs text-[#6B6159] dark:text-[#A3988E]">
                                  {breakdownIng.isZeroCost
                                    ? 'صفر (توضیحی)'
                                    : formatNumber(breakdownIng.unitCost, digitMode, 1)}
                                </td>
                                <td className="py-2.5 px-3 text-left font-mono-num tabular-nums font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                                  {formatCurrency(breakdownIng.lineCost, digitMode)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <input
                                    type="text"
                                    aria-label={`توضیح مصرف ${mat?.name ?? 'ماده'}`}
                                    value={ing.notes}
                                    onChange={(e) =>
                                      handleUpdateIngredient(idx, { notes: e.target.value })
                                    }
                                    placeholder="اختیاری..."
                                    className="w-full min-h-[34px] px-2.5 py-1 text-xs rounded-lg border border-transparent hover:border-[#DDD6CC] dark:hover:border-[#342E29] focus:border-[#6F4E37] bg-transparent text-[#5C534D] dark:text-[#D5CCC3] focus:outline-none"
                                  />
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    aria-label={`حذف ${mat?.name ?? 'ماده'} از فرمول`}
                                    onClick={() => handleRemoveIngredient(idx)}
                                    className="p-1.5 rounded-lg text-[#B83B2E] dark:text-[#EF7B6E] hover:bg-[#B83B2E]/10 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section 2: Overhead, Labor, Profit Controls */}
                <div className="p-6 border-t border-[#EFEAE2] dark:border-[#2E2924] grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Overhead */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                        ۲. هزینه‌های جانبی
                      </h3>
                      <span className="text-xs font-bold font-mono-num tabular-nums text-[#6F4E37] dark:text-[#C89B6E]">
                        {formatCurrency(draftBreakdown.overheadCost, digitMode)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#FAF8F5] dark:bg-[#171412] border border-[#E7E2DA] dark:border-[#2E2924]">
                      <button
                        type="button"
                        onClick={() => updateDraft((p) => ({ ...p, overheadMode: 'fixed' }))}
                        className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          draft.overheadMode === 'fixed'
                            ? 'bg-white dark:bg-[#2C2623] text-[#1F1B18] dark:text-[#F3EFEA] shadow-xs'
                            : 'text-[#786D65] dark:text-[#9A8F85]'
                        }`}
                      >
                        مبلغ ثابت
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft((p) => ({ ...p, overheadMode: 'percent' }))}
                        className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          draft.overheadMode === 'percent'
                            ? 'bg-white dark:bg-[#2C2623] text-[#1F1B18] dark:text-[#F3EFEA] shadow-xs'
                            : 'text-[#786D65] dark:text-[#9A8F85]'
                        }`}
                      >
                        درصد مواد اولیه
                      </button>
                    </div>

                    {draft.overheadMode === 'percent' ? (
                      <NumericInput
                        id="overhead-percent"
                        label="درصد سربار از جمع مواد اولیه"
                        value={draft.overheadPercent}
                        onChange={(v) => updateDraft((p) => ({ ...p, overheadPercent: v }))}
                        digitMode={digitMode}
                        suffix="٪"
                        allowDecimal
                      />
                    ) : (
                      <div className="space-y-2">
                        {draft.overheadItems.length === 0 ? (
                          <NumericInput
                            id="overhead-fixed"
                            label="مبلغ ثابت هزینه جانبی"
                            value={draft.overheadFixed}
                            onChange={(v) => updateDraft((p) => ({ ...p, overheadFixed: v }))}
                            digitMode={digitMode}
                            suffix="تومان"
                          />
                        ) : (
                          <div className="space-y-2">
                            {draft.overheadItems.map((line, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  aria-label={`عنوان هزینه جانبی ${i + 1}`}
                                  value={line.title}
                                  onChange={(e) =>
                                    handleUpdateOverheadLine(i, { title: e.target.value })
                                  }
                                  className="flex-1 min-w-0 min-h-[36px] px-2.5 py-1 text-xs rounded-lg border border-[#DDD6CC] dark:border-[#342E29] bg-white dark:bg-[#191614] text-[#1F1B18] dark:text-[#F3EFEA] focus:outline-none focus:border-[#6F4E37]"
                                />
                                <div className="w-28 shrink-0">
                                  <NumericInput
                                    compact
                                    ariaLabel={`مبلغ ${line.title}`}
                                    value={line.amount}
                                    onChange={(v) => handleUpdateOverheadLine(i, { amount: v })}
                                    digitMode={digitMode}
                                  />
                                </div>
                                <button
                                  type="button"
                                  aria-label={`حذف ردیف ${line.title}`}
                                  onClick={() => handleRemoveOverheadLine(i)}
                                  className="p-1.5 text-[#B83B2E] hover:bg-[#B83B2E]/10 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleAddOverheadLine}
                          className="text-xs font-semibold text-[#6F4E37] dark:text-[#C89B6E] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>افزودن ردیف جانبی (استهلاک، بسته‌بندی...)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Labor Cost */}
                  <div className="space-y-3 md:border-r md:border-[#EFEAE2] dark:md:border-[#2E2924] md:pr-6">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                        ۳. هزینه فرد / باریستا
                      </h3>
                      <span className="text-xs font-bold font-mono-num tabular-nums text-[#6F4E37] dark:text-[#C89B6E]">
                        {formatCurrency(draftBreakdown.laborCost, digitMode)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#FAF8F5] dark:bg-[#171412] border border-[#E7E2DA] dark:border-[#2E2924]">
                      <button
                        type="button"
                        onClick={() => updateDraft((p) => ({ ...p, laborMode: 'fixed' }))}
                        className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          draft.laborMode === 'fixed'
                            ? 'bg-white dark:bg-[#2C2623] text-[#1F1B18] dark:text-[#F3EFEA] shadow-xs'
                            : 'text-[#786D65] dark:text-[#9A8F85]'
                        }`}
                      >
                        مبلغ ثابت
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft((p) => ({ ...p, laborMode: 'timed' }))}
                        className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          draft.laborMode === 'timed'
                            ? 'bg-white dark:bg-[#2C2623] text-[#1F1B18] dark:text-[#F3EFEA] shadow-xs'
                            : 'text-[#786D65] dark:text-[#9A8F85]'
                        }`}
                      >
                        زمان × نرخ دقیقه
                      </button>
                    </div>

                    {draft.laborMode === 'fixed' ? (
                      <NumericInput
                        id="labor-fixed"
                        label="دستمزد آماده‌سازی هر عدد"
                        value={draft.laborFixed}
                        onChange={(v) => updateDraft((p) => ({ ...p, laborFixed: v }))}
                        digitMode={digitMode}
                        suffix="تومان"
                      />
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        <NumericInput
                          id="labor-minutes"
                          label="زمان آماده‌سازی"
                          value={draft.prepMinutes}
                          onChange={(v) => updateDraft((p) => ({ ...p, prepMinutes: v }))}
                          digitMode={digitMode}
                          suffix="دقیقه"
                          allowDecimal
                        />
                        <NumericInput
                          id="labor-rate"
                          label="نرخ دقیقه‌ای"
                          value={draft.laborRatePerMinute || defaultLaborRatePerMinute}
                          onChange={(v) =>
                            updateDraft((p) => ({ ...p, laborRatePerMinute: v }))
                          }
                          digitMode={digitMode}
                          suffix="ت"
                        />
                      </div>
                    )}
                  </div>

                  {/* Profit */}
                  <div className="space-y-3 md:border-r md:border-[#EFEAE2] dark:md:border-[#2E2924] md:pr-6">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                        ۴. سود مورد انتظار
                      </h3>
                      <span className="text-xs font-bold font-mono-num tabular-nums text-[#3D6B4F] dark:text-[#7EC496]">
                        {formatCurrency(draftBreakdown.profitAmount, digitMode)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#FAF8F5] dark:bg-[#171412] border border-[#E7E2DA] dark:border-[#2E2924]">
                      <button
                        type="button"
                        onClick={() => updateDraft((p) => ({ ...p, profitMode: 'percent' }))}
                        className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          draft.profitMode === 'percent'
                            ? 'bg-white dark:bg-[#2C2623] text-[#1F1B18] dark:text-[#F3EFEA] shadow-xs'
                            : 'text-[#786D65] dark:text-[#9A8F85]'
                        }`}
                      >
                        درصدی (٪)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft((p) => ({ ...p, profitMode: 'fixed' }))}
                        className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          draft.profitMode === 'fixed'
                            ? 'bg-white dark:bg-[#2C2623] text-[#1F1B18] dark:text-[#F3EFEA] shadow-xs'
                            : 'text-[#786D65] dark:text-[#9A8F85]'
                        }`}
                      >
                        مبلغ ثابت
                      </button>
                    </div>

                    <NumericInput
                      id="profit-value"
                      label={
                        draft.profitMode === 'percent'
                          ? 'درصد سود روی بهای تمام‌شده'
                          : 'مبلغ سود ثابت به ازای هر عدد'
                      }
                      value={draft.profitValue}
                      onChange={(v) => updateDraft((p) => ({ ...p, profitValue: v }))}
                      digitMode={digitMode}
                      suffix={draft.profitMode === 'percent' ? '٪' : 'تومان'}
                      allowDecimal={draft.profitMode === 'percent'}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : (
        /* Raw Materials Management Table */
        <section className="min-w-0 rounded-2xl border border-[#E7E2DA] dark:border-[#2E2924] bg-white dark:bg-[#1D1A17] overflow-hidden">
          <div className="p-5 border-b border-[#EFEAE2] dark:border-[#2E2924] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                فهرست مواد اولیه و نرخ تبدیل واحد
              </h2>
              <p className="text-xs text-[#786D65] dark:text-[#9A8F85] mt-0.5">
                با ویرایش قیمت خرید هر ماده، بهای تمام‌شده تمام آیتم‌های منو به‌صورت خودکار به‌روزرسانی می‌شود.
              </p>
            </div>
          </div>

          {filteredMaterials.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-[#786D65] dark:text-[#A3988E]">
                {materials.length === 0
                  ? 'هنوز ماده اولیه‌ای ثبت نشده است.'
                  : 'ماده اولیه‌ای با این مشخصات یافت نشد.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingMaterial(null);
                  setMaterialModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#6F4E37] text-white cursor-pointer"
              >
                ثبت ماده اولیه
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF8F5] dark:bg-[#171412] border-b border-[#E7E2DA] dark:border-[#2E2924] text-xs text-[#6B6159] dark:text-[#9A8F85]">
                    <th className="py-3 px-4 text-right font-semibold">نام ماده اولیه</th>
                    <th className="py-3 px-4 text-center font-semibold">واحد خرید</th>
                    <th className="py-3 px-4 text-left font-semibold">قیمت خرید</th>
                    <th className="py-3 px-4 text-center font-semibold">مقدار مبنا / مصرف</th>
                    <th className="py-3 px-4 text-left font-semibold">نرخ هر واحد مصرف</th>
                    <th className="py-3 px-4 text-center font-semibold">وضعیت</th>
                    <th className="py-3 px-4 text-right font-semibold">توضیحات</th>
                    <th className="py-3 px-4 text-center font-semibold">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEAE2] dark:divide-[#2E2924]">
                  {filteredMaterials.map((mat) => {
                    const unitCost = calculateMaterialUnitCost(mat);
                    return (
                      <tr
                        key={mat.id}
                        className="hover:bg-[#FAF8F5] dark:hover:bg-[#231F1B] transition-colors"
                      >
                        <td className="py-3 px-4 font-semibold text-[#1F1B18] dark:text-[#F3EFEA]">
                          {mat.name}
                        </td>
                        <td className="py-3 px-4 text-center text-[#5C534D] dark:text-[#D5CCC3]">
                          {mat.purchaseUnit}
                        </td>
                        <td className="py-3 px-4 text-left font-mono-num tabular-nums font-semibold text-[#1F1B18] dark:text-[#F3EFEA]">
                          {mat.isZeroCost ? '۰ (رایگان)' : formatCurrency(mat.purchasePrice, digitMode)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono-num tabular-nums text-xs text-[#5C534D] dark:text-[#D5CCC3]">
                          {formatNumber(mat.baseQuantity, digitMode, 2)} {mat.consumptionUnit}
                        </td>
                        <td className="py-3 px-4 text-left font-mono-num tabular-nums font-bold text-[#3D6B4F] dark:text-[#7EC496]">
                          {mat.isZeroCost
                            ? '۰ تومان'
                            : `${formatNumber(unitCost, digitMode, 2)} تومان / ${mat.consumptionUnit}`}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateMaterial(mat.id, {
                                name: mat.name,
                                purchaseUnit: mat.purchaseUnit,
                                purchasePrice: mat.purchasePrice,
                                baseQuantity: mat.baseQuantity,
                                consumptionUnit: mat.consumptionUnit,
                                conversionFactor: mat.conversionFactor,
                                isAvailable: !mat.isAvailable,
                                isZeroCost: mat.isZeroCost,
                                notes: mat.notes,
                              })
                            }
                            className={`text-xs font-semibold cursor-pointer ${
                              mat.isAvailable
                                ? 'text-[#3D6B4F] dark:text-[#7EC496]'
                                : 'text-[#B83B2E] dark:text-[#EF7B6E]'
                            }`}
                          >
                            {mat.isAvailable ? 'موجود' : 'غیرفعال'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-xs text-[#786D65] dark:text-[#9A8F85] max-w-[220px] truncate">
                          {mat.notes || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              aria-label={`ویرایش ${mat.name}`}
                              onClick={() => {
                                setEditingMaterial(mat);
                                setMaterialModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-[#6F4E37] dark:text-[#C89B6E] hover:bg-[#F5EFE8] dark:hover:bg-[#2B241F] cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {confirmDeleteMaterialId === mat.id ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  await onDeleteMaterial(mat.id);
                                  setConfirmDeleteMaterialId(null);
                                  onNotify(`ماده «${mat.name}» حذف شد.`);
                                }}
                                className="px-2 py-1 text-[11px] font-semibold rounded bg-[#B83B2E] text-white cursor-pointer"
                              >
                                تأیید
                              </button>
                            ) : (
                              <button
                                type="button"
                                aria-label={`حذف ${mat.name}`}
                                onClick={() => setConfirmDeleteMaterialId(mat.id)}
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
        </section>
      )}

      {/* Modals */}
      <MaterialModal
        open={materialModalOpen}
        editingMaterial={editingMaterial}
        digitMode={digitMode}
        onClose={() => setMaterialModalOpen(false)}
        onSave={async (payload, editingId) => {
          if (editingId) {
            await onUpdateMaterial(editingId, payload);
            onNotify(`ماده «${payload.name}» به‌روزرسانی شد.`);
          } else {
            await onCreateMaterial(payload);
            onNotify(`ماده «${payload.name}» اضافه شد.`);
          }
        }}
      />

      <MenuItemModal
        open={itemModalOpen}
        editingItem={editingMetaItem}
        categories={categories}
        defaultLaborRatePerMinute={defaultLaborRatePerMinute}
        onClose={() => setItemModalOpen(false)}
        onSave={async ({ name, category, notes, isActive }) => {
          if (editingMetaItem) {
            await onUpdateMenuItem(editingMetaItem.id, {
              ...editingMetaItem,
              name,
              category,
              notes,
              isActive,
            });
            onNotify(`مشخصات «${name}» ویرایش شد.`);
          } else {
            const created = await onCreateMenuItem({
              name,
              category,
              isActive,
              overheadMode: 'fixed',
              overheadFixed: 4000,
              overheadPercent: 10,
              overheadItems: [
                { title: 'استهلاک دستگاه', amount: 2500 },
                { title: 'آب، برق و گاز', amount: 1500 },
              ],
              laborMode: 'fixed',
              laborFixed: 6000,
              prepMinutes: 2,
              laborRatePerMinute: defaultLaborRatePerMinute,
              profitMode: 'percent',
              profitValue: 35,
              notes,
              ingredients: [],
            });
            setSelectedItemId(created.id);
            onNotify(`آیتم «${name}» به منو اضافه شد.`);
          }
        }}
      />

      <CopyRecipeModal
        open={copyModalOpen}
        targetItem={draft}
        allItems={menuItems}
        onClose={() => setCopyModalOpen(false)}
        onCopy={(sourceItem) => {
          updateDraft((prev) => ({
            ...prev,
            ingredients: sourceItem.ingredients.map((ing) => ({
              materialId: ing.materialId,
              quantity: ing.quantity,
              notes: ing.notes,
            })),
          }));
          onNotify(`فرمول «${sourceItem.name}» کپی شد. برای ثبت نهایی، ذخیره تغییرات را بزنید.`);
        }}
      />

      <AnalyticsModal
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        entries={ledgerEntries}
        menuItems={menuItems}
        materials={materials}
        digitMode={digitMode}
        onNavigateToLedger={onNavigateToLedger}
      />
    </div>
  );
}
