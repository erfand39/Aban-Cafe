import type {
  IngredientBreakdown,
  Material,
  MenuItem,
  MenuItemPricingBreakdown,
} from './types';

export function calculateMaterialUnitCost(material: Material | undefined): number {
  if (!material) return 0;
  if (material.isZeroCost) return 0;
  if (!Number.isFinite(material.baseQuantity) || material.baseQuantity <= 0) return 0;
  if (!Number.isFinite(material.purchasePrice) || material.purchasePrice < 0) return 0;
  return material.purchasePrice / material.baseQuantity;
}

export function calculateIngredientLineCost(
  material: Material | undefined,
  quantity: number
): number {
  if (!material || !Number.isFinite(quantity) || quantity <= 0) return 0;
  return calculateMaterialUnitCost(material) * quantity;
}

export function calculateOverheadCost(
  item: Pick<MenuItem, 'overheadMode' | 'overheadFixed' | 'overheadPercent' | 'overheadItems'>,
  materialsCost: number
): number {
  if (item.overheadMode === 'percent') {
    const pct = Number.isFinite(item.overheadPercent) ? Math.max(0, item.overheadPercent) : 0;
    return (materialsCost * pct) / 100;
  }
  if (item.overheadItems && item.overheadItems.length > 0) {
    return item.overheadItems.reduce(
      (sum, line) => sum + (Number.isFinite(line.amount) ? Math.max(0, line.amount) : 0),
      0
    );
  }
  return Number.isFinite(item.overheadFixed) ? Math.max(0, item.overheadFixed) : 0;
}

export function calculateLaborCost(
  item: Pick<MenuItem, 'laborMode' | 'laborFixed' | 'prepMinutes' | 'laborRatePerMinute'>
): number {
  if (item.laborMode === 'timed') {
    const mins = Number.isFinite(item.prepMinutes) ? Math.max(0, item.prepMinutes) : 0;
    const rate = Number.isFinite(item.laborRatePerMinute)
      ? Math.max(0, item.laborRatePerMinute)
      : 0;
    return mins * rate;
  }
  return Number.isFinite(item.laborFixed) ? Math.max(0, item.laborFixed) : 0;
}

export function calculateMenuItemPricing(
  item: MenuItem,
  materialsById: Map<number, Material>
): MenuItemPricingBreakdown {
  let hasUnavailableMaterial = false;
  const ingredients: IngredientBreakdown[] = item.ingredients.map((ing) => {
    const mat = materialsById.get(ing.materialId);
    if (mat && !mat.isAvailable) {
      hasUnavailableMaterial = true;
    }
    const unitCost = calculateMaterialUnitCost(mat);
    const lineCost = calculateIngredientLineCost(mat, ing.quantity);
    return {
      materialId: ing.materialId,
      materialName: mat?.name ?? 'ماده حذف‌شده',
      quantity: ing.quantity,
      consumptionUnit: mat?.consumptionUnit ?? '',
      unitCost,
      lineCost,
      isAvailable: mat?.isAvailable ?? false,
      isZeroCost: mat?.isZeroCost ?? false,
      notes: ing.notes || '',
    };
  });

  const materialsCost = ingredients.reduce((sum, ing) => sum + ing.lineCost, 0);
  const overheadCost = calculateOverheadCost(item, materialsCost);
  const laborCost = calculateLaborCost(item);
  const costOfGoods = materialsCost + overheadCost + laborCost;

  const profitValue = Number.isFinite(item.profitValue) ? Math.max(0, item.profitValue) : 0;
  const profitAmount =
    item.profitMode === 'percent' ? (costOfGoods * profitValue) / 100 : profitValue;

  const sellingPrice = Math.round(costOfGoods + profitAmount);
  const profitMarginPercent = sellingPrice > 0 ? (profitAmount / sellingPrice) * 100 : 0;

  return {
    ingredients,
    materialsCost: Math.round(materialsCost),
    overheadCost: Math.round(overheadCost),
    laborCost: Math.round(laborCost),
    costOfGoods: Math.round(costOfGoods),
    profitAmount: Math.round(profitAmount),
    sellingPrice,
    profitMarginPercent,
    hasUnavailableMaterial,
  };
}

export function calculateLedgerTotal(quantity: number, unitPrice: number): number {
  const safeQty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const safePrice = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
  return Math.round(safeQty * safePrice);
}
