import type {
  CafeSettings,
  LedgerEntry,
  LedgerEntryType,
  Material,
  MenuItem,
  OverheadLine,
  Person,
  PersonRole,
  RecipeIngredient,
} from './types';

export interface CafeAbanBackupV1 {
  app: 'cafe-aban';
  version: 1;
  exportedAt: string;
  data: {
    materials: Material[];
    menuItems: MenuItem[];
    people: Person[];
    ledgerEntries: LedgerEntry[];
    settings: CafeSettings;
  };
}

export type BackupImportMode = 'replace' | 'merge';

export interface BackupImportSummary {
  materialsCount: number;
  menuItemsCount: number;
  peopleCount: number;
  ledgerEntriesCount: number;
}

const VALID_ENTRY_TYPES: LedgerEntryType[] = [
  'sale',
  'receipt',
  'payment',
  'expense',
  'manual',
];

const VALID_PERSON_ROLES: PersonRole[] = [
  'customer',
  'supplier',
  'staff',
  'other',
];

export function createBackupPayload(params: {
  materials: Material[];
  menuItems: MenuItem[];
  people: Person[];
  ledgerEntries: LedgerEntry[];
  settings: CafeSettings;
  exportedAt?: string;
}): CafeAbanBackupV1 {
  return {
    app: 'cafe-aban',
    version: 1,
    exportedAt: params.exportedAt ?? new Date().toISOString(),
    data: {
      materials: params.materials,
      menuItems: params.menuItems,
      people: params.people,
      ledgerEntries: params.ledgerEntries,
      settings: params.settings,
    },
  };
}

export function parseAndValidateBackup(raw: unknown): CafeAbanBackupV1 {
  if (!raw || typeof raw !== 'object') {
    throw new Error('ساختار فایل پشتیبان نامعتبر است.');
  }
  const obj = raw as Record<string, unknown>;
  if (obj.app !== 'cafe-aban') {
    throw new Error('این فایل متعلق به سیستم کافه آبان نیست.');
  }
  if (obj.version !== 1) {
    throw new Error('نسخه فایل پشتیبان پشتیبانی نمی‌شود.');
  }
  if (!obj.data || typeof obj.data !== 'object') {
    throw new Error('بخش داده‌ها در فایل پشتیبان وجود ندارد.');
  }

  const d = obj.data as Record<string, unknown>;
  if (
    !Array.isArray(d.materials) ||
    !Array.isArray(d.menuItems) ||
    !Array.isArray(d.people) ||
    !Array.isArray(d.ledgerEntries)
  ) {
    throw new Error('لیست‌های اطلاعات در فایل پشتیبان ناقص یا خراب است.');
  }

  const nowIso = new Date().toISOString();

  const materials: Material[] = d.materials.map((m, idx) => {
    const r = (m ?? {}) as Record<string, unknown>;
    const name = String(r.name ?? '').trim();
    if (!name) {
      throw new Error(`نام ماده اولیه در ردیف ${idx + 1} خالی است.`);
    }
    return {
      id: Number(r.id) || idx + 1,
      name,
      purchaseUnit: String(r.purchaseUnit || 'کیلوگرم'),
      purchasePrice: Math.max(0, Number(r.purchasePrice) || 0),
      baseQuantity: Math.max(0.0001, Number(r.baseQuantity) || 1),
      consumptionUnit: String(r.consumptionUnit || 'گرم'),
      conversionFactor: Math.max(0.0001, Number(r.conversionFactor) || Number(r.baseQuantity) || 1),
      isAvailable: r.isAvailable !== false,
      isZeroCost: Boolean(r.isZeroCost),
      notes: String(r.notes ?? ''),
      updatedAt: String(r.updatedAt || nowIso),
    };
  });

  const menuItems: MenuItem[] = d.menuItems.map((item, idx) => {
    const r = (item ?? {}) as Record<string, unknown>;
    const name = String(r.name ?? '').trim();
    if (!name) {
      throw new Error(`نام آیتم منو در ردیف ${idx + 1} خالی است.`);
    }
    const overheadItems: OverheadLine[] = Array.isArray(r.overheadItems)
      ? r.overheadItems.map((line) => {
          const l = (line ?? {}) as Record<string, unknown>;
          return {
            title: String(l.title ?? 'هزینه جانبی'),
            amount: Math.max(0, Number(l.amount) || 0),
          };
        })
      : [];
    const ingredients: RecipeIngredient[] = Array.isArray(r.ingredients)
      ? r.ingredients
          .map((ing) => {
            const g = (ing ?? {}) as Record<string, unknown>;
            return {
              id: g.id != null ? Number(g.id) : undefined,
              menuItemId: g.menuItemId != null ? Number(g.menuItemId) : undefined,
              materialId: Number(g.materialId) || 0,
              quantity: Math.max(0, Number(g.quantity) || 0),
              notes: String(g.notes ?? ''),
            };
          })
          .filter((g) => g.materialId > 0)
      : [];

    return {
      id: Number(r.id) || idx + 1,
      name,
      category: String(r.category || 'سایر'),
      isActive: r.isActive !== false,
      overheadMode: r.overheadMode === 'percent' ? 'percent' : 'fixed',
      overheadFixed: Math.max(0, Number(r.overheadFixed) || 0),
      overheadPercent: Math.max(0, Number(r.overheadPercent) || 0),
      overheadItems,
      laborMode: r.laborMode === 'timed' ? 'timed' : 'fixed',
      laborFixed: Math.max(0, Number(r.laborFixed) || 0),
      prepMinutes: Math.max(0, Number(r.prepMinutes) || 0),
      laborRatePerMinute: Math.max(0, Number(r.laborRatePerMinute) || 0),
      profitMode: r.profitMode === 'fixed' ? 'fixed' : 'percent',
      profitValue: Math.max(0, Number(r.profitValue) || 0),
      notes: String(r.notes ?? ''),
      ingredients,
      updatedAt: String(r.updatedAt || nowIso),
    };
  });

  const people: Person[] = d.people
    .map((p, idx) => {
      const r = (p ?? {}) as Record<string, unknown>;
      const name = String(r.name ?? '').trim();
      const roleStr = String(r.role ?? 'other') as PersonRole;
      return {
        id: Number(r.id) || idx + 1,
        name,
        role: VALID_PERSON_ROLES.includes(roleStr) ? roleStr : 'other',
        phone: String(r.phone ?? ''),
        notes: String(r.notes ?? ''),
      };
    })
    .filter((p) => Boolean(p.name));

  const ledgerEntries: LedgerEntry[] = d.ledgerEntries.map((e, idx) => {
    const r = (e ?? {}) as Record<string, unknown>;
    const entryTypeStr = String(r.entryType ?? 'sale') as LedgerEntryType;
    const roleStr = String(r.personRole ?? 'other') as PersonRole;
    const jalaliDate = String(r.jalaliDate ?? '').trim();
    if (!jalaliDate) {
      throw new Error(`تاریخ شمسی در ردیف دفتر حساب شماره ${idx + 1} خالی است.`);
    }
    return {
      id: Number(r.id) || idx + 1,
      entryType: VALID_ENTRY_TYPES.includes(entryTypeStr) ? entryTypeStr : 'sale',
      menuItemId: r.menuItemId != null ? Number(r.menuItemId) : null,
      menuItemName: String(r.menuItemName ?? ''),
      personId: r.personId != null ? Number(r.personId) : null,
      personName: String(r.personName ?? ''),
      personRole: VALID_PERSON_ROLES.includes(roleStr) ? roleStr : 'other',
      quantity: Math.max(0, Number(r.quantity) || 0),
      unitPrice: Math.max(0, Number(r.unitPrice) || 0),
      totalAmount: Math.max(0, Number(r.totalAmount) || 0),
      jalaliDate,
      description: String(r.description ?? ''),
      createdAt: String(r.createdAt || nowIso),
      updatedAt: String(r.updatedAt || nowIso),
    };
  });

  const rawSettings = (d.settings ?? {}) as Record<string, unknown>;
  const settings: CafeSettings = {
    digitMode: rawSettings.digitMode === 'en' ? 'en' : 'fa',
    defaultLaborRatePerMinute: Math.max(
      0,
      Number(rawSettings.defaultLaborRatePerMinute) || 3000
    ),
  };

  return {
    app: 'cafe-aban',
    version: 1,
    exportedAt: String(obj.exportedAt || nowIso),
    data: {
      materials,
      menuItems,
      people,
      ledgerEntries,
      settings,
    },
  };
}
