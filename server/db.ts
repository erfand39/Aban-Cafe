import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  BootstrapPayload,
  CafeSettings,
  DigitMode,
  LedgerEntry,
  LedgerEntryType,
  Material,
  MenuItem,
  OverheadLine,
  Person,
  PersonRole,
  RecipeIngredient,
} from '../src/shared/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'cafe-aban.db');

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA synchronous = FULL;');
  initSchema(db);
  initDefaultSettings(db);
  dbInstance = db;
  return db;
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      purchase_unit TEXT NOT NULL,
      purchase_price REAL NOT NULL DEFAULT 0,
      base_quantity REAL NOT NULL DEFAULT 1,
      consumption_unit TEXT NOT NULL,
      conversion_factor REAL NOT NULL DEFAULT 1,
      is_available INTEGER NOT NULL DEFAULT 1,
      is_zero_cost INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      overhead_mode TEXT NOT NULL DEFAULT 'fixed',
      overhead_fixed REAL NOT NULL DEFAULT 0,
      overhead_percent REAL NOT NULL DEFAULT 0,
      overhead_items_json TEXT NOT NULL DEFAULT '[]',
      labor_mode TEXT NOT NULL DEFAULT 'fixed',
      labor_fixed REAL NOT NULL DEFAULT 0,
      prep_minutes REAL NOT NULL DEFAULT 0,
      labor_rate_per_minute REAL NOT NULL DEFAULT 0,
      profit_mode TEXT NOT NULL DEFAULT 'percent',
      profit_value REAL NOT NULL DEFAULT 30,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      quantity REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'customer',
      phone TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_type TEXT NOT NULL,
      menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
      menu_item_name TEXT NOT NULL DEFAULT '',
      person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
      person_name TEXT NOT NULL DEFAULT '',
      person_role TEXT NOT NULL DEFAULT 'other',
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      jalali_date TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function initDefaultSettings(db: DatabaseSync): void {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('digitMode', 'fa');
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(
    'defaultLaborRatePerMinute',
    '3000'
  );
}

export function listMaterials(db: DatabaseSync): Material[] {
  const rows = db
    .prepare('SELECT * FROM materials ORDER BY id ASC')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    purchaseUnit: String(r.purchase_unit),
    purchasePrice: Number(r.purchase_price),
    baseQuantity: Number(r.base_quantity),
    consumptionUnit: String(r.consumption_unit),
    conversionFactor: Number(r.conversion_factor),
    isAvailable: Boolean(r.is_available),
    isZeroCost: Boolean(r.is_zero_cost),
    notes: String(r.notes ?? ''),
    updatedAt: String(r.updated_at),
  }));
}

export function listMenuItems(db: DatabaseSync): MenuItem[] {
  const rows = db
    .prepare('SELECT * FROM menu_items ORDER BY id ASC')
    .all() as Array<Record<string, unknown>>;
  const ingRows = db
    .prepare('SELECT * FROM recipe_ingredients ORDER BY id ASC')
    .all() as Array<Record<string, unknown>>;

  const ingByItem = new Map<number, RecipeIngredient[]>();
  for (const ir of ingRows) {
    const itemId = Number(ir.menu_item_id);
    const list = ingByItem.get(itemId) ?? [];
    list.push({
      id: Number(ir.id),
      menuItemId: itemId,
      materialId: Number(ir.material_id),
      quantity: Number(ir.quantity),
      notes: String(ir.notes ?? ''),
    });
    ingByItem.set(itemId, list);
  }

  return rows.map((r) => {
    let overheadItems: OverheadLine[] = [];
    try {
      overheadItems = JSON.parse(String(r.overhead_items_json || '[]'));
    } catch {
      overheadItems = [];
    }
    return {
      id: Number(r.id),
      name: String(r.name),
      category: String(r.category),
      isActive: Boolean(r.is_active),
      overheadMode: r.overhead_mode === 'percent' ? 'percent' : 'fixed',
      overheadFixed: Number(r.overhead_fixed),
      overheadPercent: Number(r.overhead_percent),
      overheadItems,
      laborMode: r.labor_mode === 'timed' ? 'timed' : 'fixed',
      laborFixed: Number(r.labor_fixed),
      prepMinutes: Number(r.prep_minutes),
      laborRatePerMinute: Number(r.labor_rate_per_minute),
      profitMode: r.profit_mode === 'fixed' ? 'fixed' : 'percent',
      profitValue: Number(r.profit_value),
      notes: String(r.notes ?? ''),
      ingredients: ingByItem.get(Number(r.id)) ?? [],
      updatedAt: String(r.updated_at),
    };
  });
}

export function listPeople(db: DatabaseSync): Person[] {
  const rows = db
    .prepare('SELECT * FROM people ORDER BY name ASC')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    role: (String(r.role) as PersonRole) || 'other',
    phone: String(r.phone ?? ''),
    notes: String(r.notes ?? ''),
  }));
}

export function listLedgerEntries(db: DatabaseSync): LedgerEntry[] {
  const rows = db
    .prepare('SELECT * FROM ledger_entries ORDER BY jalali_date DESC, id DESC')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    entryType: (String(r.entry_type) as LedgerEntryType) || 'sale',
    menuItemId: r.menu_item_id != null ? Number(r.menu_item_id) : null,
    menuItemName: String(r.menu_item_name ?? ''),
    personId: r.person_id != null ? Number(r.person_id) : null,
    personName: String(r.person_name ?? ''),
    personRole: (String(r.person_role) as PersonRole) || 'other',
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    totalAmount: Number(r.total_amount),
    jalaliDate: String(r.jalali_date),
    description: String(r.description ?? ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export function getSettings(db: DatabaseSync): CafeSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const digitMode: DigitMode = map.get('digitMode') === 'en' ? 'en' : 'fa';
  const defaultLaborRatePerMinute = Number(map.get('defaultLaborRatePerMinute') || 3000) || 3000;
  return { digitMode, defaultLaborRatePerMinute };
}

export function getBootstrapData(db: DatabaseSync): BootstrapPayload {
  return {
    materials: listMaterials(db),
    menuItems: listMenuItems(db),
    people: listPeople(db),
    ledgerEntries: listLedgerEntries(db),
    settings: getSettings(db),
  };
}
