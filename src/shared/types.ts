export type DigitMode = 'fa' | 'en';
export type ThemeMode = 'light' | 'dark';
export type OverheadMode = 'fixed' | 'percent';
export type LaborMode = 'fixed' | 'timed';
export type ProfitMode = 'fixed' | 'percent';
export type PersonRole = 'customer' | 'supplier' | 'staff' | 'other';
export type LedgerEntryType = 'sale' | 'receipt' | 'payment' | 'expense' | 'manual';

export interface OverheadLine {
  title: string;
  amount: number;
}

export interface Material {
  id: number;
  name: string;
  purchaseUnit: string;
  purchasePrice: number;
  baseQuantity: number;
  consumptionUnit: string;
  conversionFactor: number;
  isAvailable: boolean;
  isZeroCost: boolean;
  notes: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id?: number;
  menuItemId?: number;
  materialId: number;
  quantity: number;
  notes: string;
}

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  isActive: boolean;
  overheadMode: OverheadMode;
  overheadFixed: number;
  overheadPercent: number;
  overheadItems: OverheadLine[];
  laborMode: LaborMode;
  laborFixed: number;
  prepMinutes: number;
  laborRatePerMinute: number;
  profitMode: ProfitMode;
  profitValue: number;
  notes: string;
  ingredients: RecipeIngredient[];
  updatedAt: string;
}

export interface IngredientBreakdown {
  materialId: number;
  materialName: string;
  quantity: number;
  consumptionUnit: string;
  unitCost: number;
  lineCost: number;
  isAvailable: boolean;
  isZeroCost: boolean;
  notes: string;
}

export interface MenuItemPricingBreakdown {
  ingredients: IngredientBreakdown[];
  materialsCost: number;
  overheadCost: number;
  laborCost: number;
  costOfGoods: number;
  profitAmount: number;
  sellingPrice: number;
  profitMarginPercent: number;
  hasUnavailableMaterial: boolean;
}

export interface Person {
  id: number;
  name: string;
  role: PersonRole;
  phone: string;
  notes: string;
}

export interface LedgerEntry {
  id: number;
  entryType: LedgerEntryType;
  menuItemId: number | null;
  menuItemName: string;
  personId: number | null;
  personName: string;
  personRole: PersonRole;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  jalaliDate: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CafeSettings {
  digitMode: DigitMode;
  defaultLaborRatePerMinute: number;
}

export interface BootstrapPayload {
  materials: Material[];
  menuItems: MenuItem[];
  people: Person[];
  ledgerEntries: LedgerEntry[];
  settings: CafeSettings;
}
