import type { DatabaseSync } from 'node:sqlite';
import {
  createBackupPayload,
  parseAndValidateBackup,
  type BackupImportMode,
  type BackupImportSummary,
  type CafeAbanBackupV1,
} from '../src/shared/backup';
import { getBootstrapData } from './db';

export function exportDatabaseBackup(db: DatabaseSync): CafeAbanBackupV1 {
  const bootstrap = getBootstrapData(db);
  return createBackupPayload({
    materials: bootstrap.materials,
    menuItems: bootstrap.menuItems,
    people: bootstrap.people,
    ledgerEntries: bootstrap.ledgerEntries,
    settings: bootstrap.settings,
  });
}

export function importDatabaseBackup(
  db: DatabaseSync,
  rawBackup: unknown,
  mode: BackupImportMode = 'replace'
): BackupImportSummary {
  const backup = parseAndValidateBackup(rawBackup);
  const { materials, menuItems, people, ledgerEntries, settings } = backup.data;

  db.exec('BEGIN IMMEDIATE');
  try {
    const materialIdMap = new Map<number, number>();
    const menuItemIdMap = new Map<number, number>();
    const personIdMap = new Map<number, number>();

    if (mode === 'replace') {
      db.exec(`
        DELETE FROM ledger_entries;
        DELETE FROM recipe_ingredients;
        DELETE FROM menu_items;
        DELETE FROM materials;
        DELETE FROM people;
      `);
    }

    // 1. Import materials
    const findMatByName = db.prepare('SELECT id FROM materials WHERE name = ?');
    const insertMat = db.prepare(
      `INSERT INTO materials (
        name, purchase_unit, purchase_price, base_quantity, consumption_unit,
        conversion_factor, is_available, is_zero_cost, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const mat of materials) {
      if (mode === 'merge') {
        const existing = findMatByName.get(mat.name) as { id: number } | undefined;
        if (existing) {
          materialIdMap.set(mat.id, Number(existing.id));
          continue;
        }
      }
      const res = insertMat.run(
        mat.name,
        mat.purchaseUnit,
        mat.purchasePrice,
        mat.baseQuantity,
        mat.consumptionUnit,
        mat.conversionFactor,
        mat.isAvailable ? 1 : 0,
        mat.isZeroCost ? 1 : 0,
        mat.notes,
        mat.updatedAt
      );
      materialIdMap.set(mat.id, Number(res.lastInsertRowid));
    }

    // 2. Import menu items + recipe ingredients
    const findItemByName = db.prepare('SELECT id FROM menu_items WHERE name = ?');
    const insertItem = db.prepare(
      `INSERT INTO menu_items (
        name, category, is_active, overhead_mode, overhead_fixed, overhead_percent,
        overhead_items_json, labor_mode, labor_fixed, prep_minutes, labor_rate_per_minute,
        profit_mode, profit_value, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertIng = db.prepare(
      'INSERT INTO recipe_ingredients (menu_item_id, material_id, quantity, notes) VALUES (?, ?, ?, ?)'
    );

    for (const item of menuItems) {
      if (mode === 'merge') {
        const existing = findItemByName.get(item.name) as { id: number } | undefined;
        if (existing) {
          menuItemIdMap.set(item.id, Number(existing.id));
          continue;
        }
      }
      const res = insertItem.run(
        item.name,
        item.category,
        item.isActive ? 1 : 0,
        item.overheadMode,
        item.overheadFixed,
        item.overheadPercent,
        JSON.stringify(item.overheadItems ?? []),
        item.laborMode,
        item.laborFixed,
        item.prepMinutes,
        item.laborRatePerMinute,
        item.profitMode,
        item.profitValue,
        item.notes,
        item.updatedAt
      );
      const newItemId = Number(res.lastInsertRowid);
      menuItemIdMap.set(item.id, newItemId);

      for (const ing of item.ingredients ?? []) {
        const mappedMatId = materialIdMap.get(ing.materialId);
        if (mappedMatId) {
          insertIng.run(newItemId, mappedMatId, ing.quantity, ing.notes ?? '');
        }
      }
    }

    // 3. Import people
    const findPersonByName = db.prepare('SELECT id FROM people WHERE name = ?');
    const insertPerson = db.prepare(
      'INSERT INTO people (name, role, phone, notes) VALUES (?, ?, ?, ?)'
    );

    for (const p of people) {
      const existing = findPersonByName.get(p.name) as { id: number } | undefined;
      if (existing) {
        personIdMap.set(p.id, Number(existing.id));
        continue;
      }
      const res = insertPerson.run(p.name, p.role, p.phone, p.notes);
      personIdMap.set(p.id, Number(res.lastInsertRowid));
    }

    // 4. Import ledger entries
    const insertLedger = db.prepare(
      `INSERT INTO ledger_entries (
        entry_type, menu_item_id, menu_item_name, person_id, person_name, person_role,
        quantity, unit_price, total_amount, jalali_date, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const e of ledgerEntries) {
      const mappedMenuItemId =
        e.menuItemId !== null ? menuItemIdMap.get(e.menuItemId) ?? null : null;
      let mappedPersonId =
        e.personId !== null ? personIdMap.get(e.personId) ?? null : null;
      if (!mappedPersonId && e.personName.trim()) {
        const found = findPersonByName.get(e.personName.trim()) as
          | { id: number }
          | undefined;
        if (found) mappedPersonId = Number(found.id);
      }
      insertLedger.run(
        e.entryType,
        mappedMenuItemId,
        e.menuItemName,
        mappedPersonId,
        e.personName,
        e.personRole,
        e.quantity,
        e.unitPrice,
        e.totalAmount,
        e.jalaliDate,
        e.description,
        e.createdAt,
        e.updatedAt
      );
    }

    // 5. Restore settings on replace
    if (mode === 'replace') {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'digitMode',
        settings.digitMode
      );
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'defaultLaborRatePerMinute',
        String(settings.defaultLaborRatePerMinute)
      );
    }

    db.exec('COMMIT');

    return {
      materialsCount: materials.length,
      menuItemsCount: menuItems.length,
      peopleCount: people.length,
      ledgerEntriesCount: ledgerEntries.length,
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
