import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupPayload, parseAndValidateBackup } from './backup';

test('creates and validates a complete backup payload with relational links', () => {
  const payload = createBackupPayload({
    materials: [
      {
        id: 10,
        name: 'قهوه اسپرسو',
        purchaseUnit: 'کیلوگرم',
        purchasePrice: 1200000,
        baseQuantity: 1000,
        consumptionUnit: 'گرم',
        conversionFactor: 1000,
        isAvailable: true,
        isZeroCost: false,
        notes: '',
        updatedAt: '2026-11-15T00:00:00Z',
      },
    ],
    menuItems: [
      {
        id: 20,
        name: 'اسپرسو',
        category: 'نوشیدنی گرم',
        isActive: true,
        overheadMode: 'fixed',
        overheadFixed: 3000,
        overheadPercent: 0,
        overheadItems: [{ title: 'استهلاک', amount: 3000 }],
        laborMode: 'fixed',
        laborFixed: 5000,
        prepMinutes: 2,
        laborRatePerMinute: 3000,
        profitMode: 'percent',
        profitValue: 35,
        notes: '',
        ingredients: [{ materialId: 10, quantity: 18, notes: '' }],
        updatedAt: '2026-11-15T00:00:00Z',
      },
    ],
    people: [{ id: 30, name: 'علی رضایی', role: 'customer', phone: '', notes: '' }],
    ledgerEntries: [
      {
        id: 40,
        entryType: 'sale',
        menuItemId: 20,
        menuItemName: 'اسپرسو',
        personId: 30,
        personName: 'علی رضایی',
        personRole: 'customer',
        quantity: 2,
        unitPrice: 40000,
        totalAmount: 80000,
        jalaliDate: '1405/08/24',
        description: '',
        createdAt: '2026-11-15T00:00:00Z',
        updatedAt: '2026-11-15T00:00:00Z',
      },
    ],
    settings: { digitMode: 'fa', defaultLaborRatePerMinute: 3000 },
    exportedAt: '2026-11-15T00:00:00Z',
  });

  const parsed = parseAndValidateBackup(JSON.parse(JSON.stringify(payload)));
  assert.equal(parsed.app, 'cafe-aban');
  assert.equal(parsed.version, 1);
  assert.equal(parsed.data.materials[0].name, 'قهوه اسپرسو');
  assert.equal(parsed.data.menuItems[0].ingredients[0].materialId, 10);
  assert.equal(parsed.data.ledgerEntries[0].totalAmount, 80000);
});

test('rejects invalid or foreign backup payloads cleanly', () => {
  assert.throws(() => parseAndValidateBackup(null), /نامعتبر/);
  assert.throws(() => parseAndValidateBackup({ app: 'other', version: 1 }), /کافه آبان/);
  assert.throws(
    () =>
      parseAndValidateBackup({
        app: 'cafe-aban',
        version: 1,
        data: { materials: [], menuItems: [], people: [], ledgerEntries: 'bad' },
      }),
    /ناقص/
  );
});
