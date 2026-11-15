import type { BackupImportMode, BackupImportSummary } from '../shared/backup';
import type {
  BootstrapPayload,
  CafeSettings,
  DigitMode,
  LedgerEntry,
  Material,
  MenuItem,
  Person,
} from '../shared/types';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = 'خطا در ارتباط با سرور';
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      // ignore json parse errors
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  bootstrap: () => requestJson<BootstrapPayload>('/api/bootstrap'),

  updateSettings: (payload: Partial<CafeSettings>) =>
    requestJson<CafeSettings>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  createMaterial: (payload: Omit<Material, 'id' | 'updatedAt'>) =>
    requestJson<Material>('/api/materials', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMaterial: (id: number, payload: Omit<Material, 'id' | 'updatedAt'>) =>
    requestJson<Material>(`/api/materials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteMaterial: (id: number) =>
    requestJson<{ ok: boolean }>(`/api/materials/${id}`, { method: 'DELETE' }),

  createMenuItem: (payload: Omit<MenuItem, 'id' | 'updatedAt'>) =>
    requestJson<MenuItem>('/api/menu-items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMenuItem: (id: number, payload: Omit<MenuItem, 'id' | 'updatedAt'>) =>
    requestJson<MenuItem>(`/api/menu-items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteMenuItem: (id: number) =>
    requestJson<{ ok: boolean }>(`/api/menu-items/${id}`, { method: 'DELETE' }),

  upsertPerson: (payload: Omit<Person, 'id'>) =>
    requestJson<Person>('/api/people', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createLedgerEntry: (
    payload: Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt'> & { savePerson?: boolean }
  ) =>
    requestJson<{ entry: LedgerEntry; people: Person[] }>('/api/ledger', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateLedgerEntry: (
    id: number,
    payload: Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt'> & { savePerson?: boolean }
  ) =>
    requestJson<{ entry: LedgerEntry; people: Person[] }>(`/api/ledger/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteLedgerEntry: (id: number) =>
    requestJson<{ ok: boolean }>(`/api/ledger/${id}`, { method: 'DELETE' }),

  downloadExcel: async (digitMode: DigitMode, ledgerIds?: number[]) => {
    const res = await fetch('/api/export/excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ digitMode, ledgerIds }),
    });
    if (!res.ok) throw new Error('خطا در دانلود فایل اکسل');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cafe-aban-report.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  downloadBackup: async () => {
    const res = await fetch('/api/backup/export');
    if (!res.ok) throw new Error('خطا در تهیه فایل پشتیبان');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `cafe-aban-backup-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  importBackup: (backup: unknown, mode: BackupImportMode) =>
    requestJson<{ ok: boolean; summary: BackupImportSummary; bootstrap: BootstrapPayload }>(
      '/api/backup/import',
      {
        method: 'POST',
        body: JSON.stringify({ backup, mode }),
      }
    ),
};
