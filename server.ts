import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { exportDatabaseBackup, importDatabaseBackup } from './server/backup';
import {
  getBootstrapData,
  getDb,
  listLedgerEntries,
  listMaterials,
  listMenuItems,
  listPeople,
} from './server/db';
import { generateCafeExcelBuffer } from './server/excelExport';
import type {
  DigitMode,
  LedgerEntryType,
  OverheadLine,
  PersonRole,
  RecipeIngredient,
} from './src/shared/types';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  const db = getDb();

  // Bootstrap all initial state
  app.get('/api/bootstrap', (_req, res) => {
    try {
      res.json(getBootstrapData(db));
    } catch (error) {
      console.error('Bootstrap error:', error);
      res.status(500).json({ error: 'خطا در بارگذاری اطلاعات پایگاه داده' });
    }
  });

  // Update app settings
  app.patch('/api/settings', (req, res) => {
    try {
      const { digitMode, defaultLaborRatePerMinute } = req.body ?? {};
      if (digitMode === 'fa' || digitMode === 'en') {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
          'digitMode',
          digitMode
        );
      }
      if (typeof defaultLaborRatePerMinute === 'number' && defaultLaborRatePerMinute >= 0) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
          'defaultLaborRatePerMinute',
          String(defaultLaborRatePerMinute)
        );
      }
      res.json(getBootstrapData(db).settings);
    } catch (error) {
      console.error('Settings error:', error);
      res.status(500).json({ error: 'خطا در ذخیره تنظیمات' });
    }
  });

  // Materials CRUD
  app.post('/api/materials', (req, res) => {
    try {
      const b = req.body ?? {};
      const name = String(b.name || '').trim();
      if (!name) return res.status(400).json({ error: 'نام ماده اولیه الزامی است' });
      const nowIso = new Date().toISOString();
      const result = db
        .prepare(
          `INSERT INTO materials (
            name, purchase_unit, purchase_price, base_quantity, consumption_unit,
            conversion_factor, is_available, is_zero_cost, notes, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          name,
          String(b.purchaseUnit || 'کیلوگرم'),
          Number(b.purchasePrice) || 0,
          Math.max(0.0001, Number(b.baseQuantity) || 1),
          String(b.consumptionUnit || 'گرم'),
          Math.max(0.0001, Number(b.conversionFactor) || Number(b.baseQuantity) || 1),
          b.isAvailable === false ? 0 : 1,
          b.isZeroCost ? 1 : 0,
          String(b.notes || ''),
          nowIso
        );
      const materials = listMaterials(db);
      const created = materials.find((m) => m.id === Number(result.lastInsertRowid));
      res.status(201).json(created);
    } catch (error) {
      console.error('Create material error:', error);
      res.status(500).json({ error: 'خطا در ثبت ماده اولیه' });
    }
  });

  app.put('/api/materials/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body ?? {};
      const name = String(b.name || '').trim();
      if (!name) return res.status(400).json({ error: 'نام ماده اولیه الزامی است' });
      const nowIso = new Date().toISOString();
      db.prepare(
        `UPDATE materials SET
          name = ?, purchase_unit = ?, purchase_price = ?, base_quantity = ?,
          consumption_unit = ?, conversion_factor = ?, is_available = ?,
          is_zero_cost = ?, notes = ?, updated_at = ?
        WHERE id = ?`
      ).run(
        name,
        String(b.purchaseUnit || 'کیلوگرم'),
        Number(b.purchasePrice) || 0,
        Math.max(0.0001, Number(b.baseQuantity) || 1),
        String(b.consumptionUnit || 'گرم'),
        Math.max(0.0001, Number(b.conversionFactor) || Number(b.baseQuantity) || 1),
        b.isAvailable === false ? 0 : 1,
        b.isZeroCost ? 1 : 0,
        String(b.notes || ''),
        nowIso,
        id
      );
      const updated = listMaterials(db).find((m) => m.id === id);
      if (!updated) return res.status(404).json({ error: 'ماده اولیه پیدا نشد' });
      res.json(updated);
    } catch (error) {
      console.error('Update material error:', error);
      res.status(500).json({ error: 'خطا در ویرایش ماده اولیه' });
    }
  });

  app.delete('/api/materials/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      db.prepare('DELETE FROM materials WHERE id = ?').run(id);
      res.json({ ok: true });
    } catch (error) {
      console.error('Delete material error:', error);
      res.status(500).json({ error: 'خطا در حذف ماده اولیه' });
    }
  });

  // Menu Items + Recipes CRUD
  app.post('/api/menu-items', (req, res) => {
    try {
      const b = req.body ?? {};
      const name = String(b.name || '').trim();
      if (!name) return res.status(400).json({ error: 'نام آیتم الزامی است' });
      const nowIso = new Date().toISOString();
      const overheadItems: OverheadLine[] = Array.isArray(b.overheadItems) ? b.overheadItems : [];
      const overheadFixed =
        overheadItems.length > 0
          ? overheadItems.reduce((s, x) => s + (Number(x.amount) || 0), 0)
          : Number(b.overheadFixed) || 0;

      const result = db
        .prepare(
          `INSERT INTO menu_items (
            name, category, is_active, overhead_mode, overhead_fixed, overhead_percent,
            overhead_items_json, labor_mode, labor_fixed, prep_minutes, labor_rate_per_minute,
            profit_mode, profit_value, notes, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          name,
          String(b.category || 'سایر'),
          b.isActive === false ? 0 : 1,
          b.overheadMode === 'percent' ? 'percent' : 'fixed',
          overheadFixed,
          Number(b.overheadPercent) || 0,
          JSON.stringify(overheadItems),
          b.laborMode === 'timed' ? 'timed' : 'fixed',
          Number(b.laborFixed) || 0,
          Number(b.prepMinutes) || 0,
          Number(b.laborRatePerMinute) || 0,
          b.profitMode === 'fixed' ? 'fixed' : 'percent',
          Number(b.profitValue) || 0,
          String(b.notes || ''),
          nowIso
        );

      const newId = Number(result.lastInsertRowid);
      const ingredients: RecipeIngredient[] = Array.isArray(b.ingredients) ? b.ingredients : [];
      const insertIng = db.prepare(
        'INSERT INTO recipe_ingredients (menu_item_id, material_id, quantity, notes) VALUES (?, ?, ?, ?)'
      );
      for (const ing of ingredients) {
        if (ing.materialId) {
          insertIng.run(newId, Number(ing.materialId), Number(ing.quantity) || 0, String(ing.notes || ''));
        }
      }

      const created = listMenuItems(db).find((m) => m.id === newId);
      res.status(201).json(created);
    } catch (error) {
      console.error('Create menu item error:', error);
      res.status(500).json({ error: 'خطا در ثبت آیتم جدید' });
    }
  });

  app.put('/api/menu-items/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body ?? {};
      const name = String(b.name || '').trim();
      if (!name) return res.status(400).json({ error: 'نام آیتم الزامی است' });
      const nowIso = new Date().toISOString();
      const overheadItems: OverheadLine[] = Array.isArray(b.overheadItems) ? b.overheadItems : [];
      const overheadFixed =
        overheadItems.length > 0
          ? overheadItems.reduce((s, x) => s + (Number(x.amount) || 0), 0)
          : Number(b.overheadFixed) || 0;

      db.prepare(
        `UPDATE menu_items SET
          name = ?, category = ?, is_active = ?, overhead_mode = ?, overhead_fixed = ?,
          overhead_percent = ?, overhead_items_json = ?, labor_mode = ?, labor_fixed = ?,
          prep_minutes = ?, labor_rate_per_minute = ?, profit_mode = ?, profit_value = ?,
          notes = ?, updated_at = ?
        WHERE id = ?`
      ).run(
        name,
        String(b.category || 'سایر'),
        b.isActive === false ? 0 : 1,
        b.overheadMode === 'percent' ? 'percent' : 'fixed',
        overheadFixed,
        Number(b.overheadPercent) || 0,
        JSON.stringify(overheadItems),
        b.laborMode === 'timed' ? 'timed' : 'fixed',
        Number(b.laborFixed) || 0,
        Number(b.prepMinutes) || 0,
        Number(b.laborRatePerMinute) || 0,
        b.profitMode === 'fixed' ? 'fixed' : 'percent',
        Number(b.profitValue) || 0,
        String(b.notes || ''),
        nowIso,
        id
      );

      if (Array.isArray(b.ingredients)) {
        db.prepare('DELETE FROM recipe_ingredients WHERE menu_item_id = ?').run(id);
        const insertIng = db.prepare(
          'INSERT INTO recipe_ingredients (menu_item_id, material_id, quantity, notes) VALUES (?, ?, ?, ?)'
        );
        for (const ing of b.ingredients as RecipeIngredient[]) {
          if (ing.materialId) {
            insertIng.run(id, Number(ing.materialId), Number(ing.quantity) || 0, String(ing.notes || ''));
          }
        }
      }

      const updated = listMenuItems(db).find((m) => m.id === id);
      if (!updated) return res.status(404).json({ error: 'آیتم منو پیدا نشد' });
      res.json(updated);
    } catch (error) {
      console.error('Update menu item error:', error);
      res.status(500).json({ error: 'خطا در ذخیره تغییرات آیتم' });
    }
  });

  app.delete('/api/menu-items/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
      res.json({ ok: true });
    } catch (error) {
      console.error('Delete menu item error:', error);
      res.status(500).json({ error: 'خطا در حذف آیتم' });
    }
  });

  // People CRUD / upsert
  app.post('/api/people', (req, res) => {
    try {
      const b = req.body ?? {};
      const name = String(b.name || '').trim();
      if (!name) return res.status(400).json({ error: 'نام فرد الزامی است' });
      const role: PersonRole = ['customer', 'supplier', 'staff', 'other'].includes(b.role)
        ? b.role
        : 'other';
      const existing = db.prepare('SELECT id FROM people WHERE name = ?').get(name) as
        | { id: number }
        | undefined;
      if (existing) {
        db.prepare('UPDATE people SET role = ?, phone = ?, notes = ? WHERE id = ?').run(
          role,
          String(b.phone || ''),
          String(b.notes || ''),
          existing.id
        );
        const p = listPeople(db).find((x) => x.id === existing.id);
        return res.json(p);
      }
      const result = db
        .prepare('INSERT INTO people (name, role, phone, notes) VALUES (?, ?, ?, ?)')
        .run(name, role, String(b.phone || ''), String(b.notes || ''));
      const created = listPeople(db).find((x) => x.id === Number(result.lastInsertRowid));
      res.status(201).json(created);
    } catch (error) {
      console.error('Create person error:', error);
      res.status(500).json({ error: 'خطا در ذخیره فرد' });
    }
  });

  app.delete('/api/people/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      db.prepare('DELETE FROM people WHERE id = ?').run(id);
      res.json({ ok: true });
    } catch (error) {
      console.error('Delete person error:', error);
      res.status(500).json({ error: 'خطا در حذف فرد' });
    }
  });

  // Ledger CRUD
  app.post('/api/ledger', (req, res) => {
    try {
      const b = req.body ?? {};
      const entryType: LedgerEntryType = ['sale', 'receipt', 'payment', 'expense', 'manual'].includes(
        b.entryType
      )
        ? b.entryType
        : 'sale';
      const jalaliDate = String(b.jalaliDate || '').trim();
      if (!jalaliDate) return res.status(400).json({ error: 'تاریخ شمسی الزامی است' });

      const nowIso = new Date().toISOString();
      let personId: number | null = b.personId ? Number(b.personId) : null;
      const personName = String(b.personName || '').trim();
      const personRole: PersonRole = ['customer', 'supplier', 'staff', 'other'].includes(b.personRole)
        ? b.personRole
        : 'other';

      // Auto-register person in people table if typed directly and savePerson !== false
      if (!personId && personName) {
        const found = db.prepare('SELECT id FROM people WHERE name = ?').get(personName) as
          | { id: number }
          | undefined;
        if (found) {
          personId = found.id;
        } else if (b.savePerson !== false) {
          const pRes = db
            .prepare('INSERT INTO people (name, role, phone, notes) VALUES (?, ?, ?, ?)')
            .run(personName, personRole, '', '');
          personId = Number(pRes.lastInsertRowid);
        }
      }

      const menuItemId = b.menuItemId ? Number(b.menuItemId) : null;
      const menuItemName = String(b.menuItemName || '');
      const quantity = Math.max(0, Number(b.quantity) || 0);
      const unitPrice = Math.max(0, Number(b.unitPrice) || 0);
      const totalAmount = Math.max(0, Number(b.totalAmount) || 0);

      const result = db
        .prepare(
          `INSERT INTO ledger_entries (
            entry_type, menu_item_id, menu_item_name, person_id, person_name, person_role,
            quantity, unit_price, total_amount, jalali_date, description, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          entryType,
          menuItemId,
          menuItemName,
          personId,
          personName,
          personRole,
          quantity,
          unitPrice,
          totalAmount,
          jalaliDate,
          String(b.description || ''),
          nowIso,
          nowIso
        );

      const created = listLedgerEntries(db).find((e) => e.id === Number(result.lastInsertRowid));
      res.status(201).json({ entry: created, people: listPeople(db) });
    } catch (error) {
      console.error('Create ledger error:', error);
      res.status(500).json({ error: 'خطا در ثبت رکورد دفتر حساب' });
    }
  });

  app.put('/api/ledger/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body ?? {};
      const entryType: LedgerEntryType = ['sale', 'receipt', 'payment', 'expense', 'manual'].includes(
        b.entryType
      )
        ? b.entryType
        : 'sale';
      const jalaliDate = String(b.jalaliDate || '').trim();
      if (!jalaliDate) return res.status(400).json({ error: 'تاریخ شمسی الزامی است' });

      const nowIso = new Date().toISOString();
      let personId: number | null = b.personId ? Number(b.personId) : null;
      const personName = String(b.personName || '').trim();
      const personRole: PersonRole = ['customer', 'supplier', 'staff', 'other'].includes(b.personRole)
        ? b.personRole
        : 'other';

      if (!personId && personName) {
        const found = db.prepare('SELECT id FROM people WHERE name = ?').get(personName) as
          | { id: number }
          | undefined;
        if (found) {
          personId = found.id;
        } else if (b.savePerson !== false) {
          const pRes = db
            .prepare('INSERT INTO people (name, role, phone, notes) VALUES (?, ?, ?, ?)')
            .run(personName, personRole, '', '');
          personId = Number(pRes.lastInsertRowid);
        }
      }

      db.prepare(
        `UPDATE ledger_entries SET
          entry_type = ?, menu_item_id = ?, menu_item_name = ?, person_id = ?,
          person_name = ?, person_role = ?, quantity = ?, unit_price = ?,
          total_amount = ?, jalali_date = ?, description = ?, updated_at = ?
        WHERE id = ?`
      ).run(
        entryType,
        b.menuItemId ? Number(b.menuItemId) : null,
        String(b.menuItemName || ''),
        personId,
        personName,
        personRole,
        Math.max(0, Number(b.quantity) || 0),
        Math.max(0, Number(b.unitPrice) || 0),
        Math.max(0, Number(b.totalAmount) || 0),
        jalaliDate,
        String(b.description || ''),
        nowIso,
        id
      );

      const updated = listLedgerEntries(db).find((e) => e.id === id);
      if (!updated) return res.status(404).json({ error: 'رکورد دفتر حساب پیدا نشد' });
      res.json({ entry: updated, people: listPeople(db) });
    } catch (error) {
      console.error('Update ledger error:', error);
      res.status(500).json({ error: 'خطا در ویرایش رکورد' });
    }
  });

  app.delete('/api/ledger/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      db.prepare('DELETE FROM ledger_entries WHERE id = ?').run(id);
      res.json({ ok: true });
    } catch (error) {
      console.error('Delete ledger error:', error);
      res.status(500).json({ error: 'خطا در حذف رکورد' });
    }
  });

  // Excel export (3 sheets: آیتم‌ها، مواد اولیه، دفتر حساب)
  app.post('/api/export/excel', async (req, res) => {
    try {
      const b = req.body ?? {};
      const digitMode: DigitMode = b.digitMode === 'en' ? 'en' : 'fa';
      const entryIds: number[] | null = Array.isArray(b.ledgerIds) ? b.ledgerIds : null;

      const materials = listMaterials(db);
      const menuItems = listMenuItems(db);
      let ledgerEntries = listLedgerEntries(db);
      if (entryIds) {
        const idSet = new Set(entryIds.map(Number));
        ledgerEntries = ledgerEntries.filter((e) => idSet.has(e.id));
      }

      const buffer = await generateCafeExcelBuffer({
        materials,
        menuItems,
        ledgerEntries,
        digitMode,
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', 'attachment; filename="cafe-aban-report.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error('Excel export error:', error);
      res.status(500).json({ error: 'خطا در ساخت فایل اکسل' });
    }
  });

  // Full portable data backup export & import
  app.get('/api/backup/export', (_req, res) => {
    try {
      const payload = exportDatabaseBackup(db);
      const dateStamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cafe-aban-backup-${dateStamp}.json"`
      );
      res.send(JSON.stringify(payload, null, 2));
    } catch (error) {
      console.error('Backup export error:', error);
      res.status(500).json({ error: 'خطا در تهیه فایل پشتیبان' });
    }
  });

  app.post('/api/backup/import', (req, res) => {
    try {
      const { backup, mode } = req.body ?? {};
      const importMode = mode === 'merge' ? 'merge' : 'replace';
      const summary = importDatabaseBackup(db, backup, importMode);
      res.json({ ok: true, summary, bootstrap: getBootstrapData(db) });
    } catch (error) {
      console.error('Backup import error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'خطا در وارد کردن فایل پشتیبان',
      });
    }
  });

  // Vite or static files
  const distDir = path.join(process.cwd(), 'dist');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cafe Aban server running at http://localhost:${PORT}`);
  });
}

startServer();
