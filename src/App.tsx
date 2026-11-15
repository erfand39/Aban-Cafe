import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calculator,
  Database,
  FileSpreadsheet,
  FileText,
  Moon,
  Sun,
} from 'lucide-react';
import type { BackupImportMode } from './shared/backup';
import { formatDigits, formatNumber } from './shared/format';
import { formatJalaliLong, getTodayJalaliString } from './shared/jalali';
import type {
  BootstrapPayload,
  CafeSettings,
  DigitMode,
  LedgerEntry,
  Material,
  MenuItem,
  Person,
  ThemeMode,
} from './shared/types';
import { api } from './utils/api';
import { exportLedgerPdf, exportPricingPdf } from './utils/exportPdf';
import { DataTransferModal } from './components/DataTransferModal';
import { LedgerPage } from './components/LedgerPage';
import { PricingPage } from './components/PricingPage';

type ActivePage = 'pricing' | 'ledger';

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('pricing');
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('cafe-aban-theme') === 'dark'
        ? 'dark'
        : 'light';
    }
    return 'light';
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [settings, setSettings] = useState<CafeSettings>({
    digitMode: 'fa',
    defaultLaborRatePerMinute: 3000,
  });

  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: 'success' | 'error' } | null>(
    null
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem('cafe-aban-theme', theme);
  }, [theme]);

  const notify = useCallback((msg: string, tone: 'success' | 'error' = 'success') => {
    setToast({ msg, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchBootstrap = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.bootstrap();
      setMaterials(data.materials);
      setMenuItems(data.menuItems);
      setPeople(data.people);
      setLedgerEntries(data.ledgerEntries);
      setSettings(data.settings);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'خطا در اتصال به پایگاه داده لوکال');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  const todayJalaliLong = useMemo(
    () => formatJalaliLong(getTodayJalaliString(), settings.digitMode),
    [settings.digitMode]
  );

  const handleToggleDigitMode = async () => {
    const nextMode: DigitMode = settings.digitMode === 'fa' ? 'en' : 'fa';
    setSettings((prev) => ({ ...prev, digitMode: nextMode }));
    try {
      await api.updateSettings({ digitMode: nextMode });
    } catch {
      // Keep UI responsive even if offline temporarily
    }
  };

  // Materials CRUD handlers
  const handleCreateMaterial = async (payload: Omit<Material, 'id' | 'updatedAt'>) => {
    const created = await api.createMaterial(payload);
    setMaterials((prev) => [...prev, created]);
  };

  const handleUpdateMaterial = async (
    id: number,
    payload: Omit<Material, 'id' | 'updatedAt'>
  ) => {
    const updated = await api.updateMaterial(id, payload);
    setMaterials((prev) => prev.map((m) => (m.id === id ? updated : m)));
  };

  const handleDeleteMaterial = async (id: number) => {
    await api.deleteMaterial(id);
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    setMenuItems((prev) =>
      prev.map((item) => ({
        ...item,
        ingredients: item.ingredients.filter((ing) => ing.materialId !== id),
      }))
    );
  };

  // Menu items CRUD handlers
  const handleCreateMenuItem = async (payload: Omit<MenuItem, 'id' | 'updatedAt'>) => {
    const created = await api.createMenuItem(payload);
    setMenuItems((prev) => [...prev, created]);
    return created;
  };

  const handleUpdateMenuItem = async (
    id: number,
    payload: Omit<MenuItem, 'id' | 'updatedAt'>
  ) => {
    const updated = await api.updateMenuItem(id, payload);
    setMenuItems((prev) => prev.map((m) => (m.id === id ? updated : m)));
  };

  const handleDeleteMenuItem = async (id: number) => {
    await api.deleteMenuItem(id);
    setMenuItems((prev) => prev.filter((m) => m.id !== id));
  };

  // Ledger CRUD handlers
  const handleCreateLedgerEntry = async (
    payload: Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt'> & { savePerson?: boolean }
  ) => {
    const { entry, people: updatedPeople } = await api.createLedgerEntry(payload);
    setLedgerEntries((prev) =>
      [entry, ...prev].sort((a, b) =>
        b.jalaliDate.localeCompare(a.jalaliDate) || b.id - a.id
      )
    );
    setPeople(updatedPeople);
  };

  const handleUpdateLedgerEntry = async (
    id: number,
    payload: Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt'> & { savePerson?: boolean }
  ) => {
    const { entry, people: updatedPeople } = await api.updateLedgerEntry(id, payload);
    setLedgerEntries((prev) =>
      prev
        .map((e) => (e.id === id ? entry : e))
        .sort((a, b) => b.jalaliDate.localeCompare(a.jalaliDate) || b.id - a.id)
    );
    setPeople(updatedPeople);
  };

  const handleDeleteLedgerEntry = async (id: number) => {
    await api.deleteLedgerEntry(id);
    setLedgerEntries((prev) => prev.filter((e) => e.id !== id));
  };

  // Exports
  const handleExportExcel = async (ledgerIds?: number[]) => {
    setExporting('excel');
    try {
      await api.downloadExcel(settings.digitMode, ledgerIds);
      notify('فایل اکسل ۳ شیت کافه آبان با موفقیت دانلود شد.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'خطا در خروجی اکسل', 'error');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async (
    customEntries?: LedgerEntry[],
    dateRangeLabel?: string
  ) => {
    setExporting('pdf');
    try {
      if (activePage === 'pricing' && !customEntries) {
        await exportPricingPdf({
          menuItems,
          materials,
          digitMode: settings.digitMode,
        });
        notify('فایل PDF لیست قیمت‌گذاری دانلود شد.');
      } else {
        await exportLedgerPdf({
          entries: customEntries ?? ledgerEntries,
          dateRangeLabel: dateRangeLabel ?? 'همه تاریخ‌ها',
          digitMode: settings.digitMode,
        });
        notify('فایل PDF دفتر حساب دانلود شد.');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'خطا در تولید PDF', 'error');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden flex flex-col bg-[#FAF8F5] dark:bg-[#141210] text-[#1F1B18] dark:text-[#F3EFEA] transition-colors">
      {/* Top Bar */}
      <header className="sm:sticky sm:top-0 z-40 border-b border-[#E7E2DA] dark:border-[#2E2924] bg-white/95 dark:bg-[#1A1714]/95 backdrop-blur-sm no-print">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-8">
          {/* Zone 1: Brand wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActivePage('pricing');
            }}
            className="text-base sm:text-xl font-extrabold tracking-tight text-[#4A3326] dark:text-[#E8C5A0] whitespace-nowrap shrink-0"
          >
            کافه آبان
          </a>

          {/* Zone 2: Primary 2-page Navigation */}
          <nav aria-label="ناوبری اصلی" className="flex items-center gap-3 sm:gap-8 min-w-0">
            <button
              type="button"
              onClick={() => setActivePage('pricing')}
              className={`h-14 sm:h-16 px-1 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activePage === 'pricing'
                  ? 'border-[#6F4E37] dark:border-[#C89B6E] text-[#1F1B18] dark:text-[#F3EFEA]'
                  : 'border-transparent text-[#786D65] dark:text-[#9A8F85] hover:text-[#1F1B18] dark:hover:text-[#F3EFEA]'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4 hidden xs:inline sm:inline" />
              <span>قیمت‌گذاری منو</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePage('ledger')}
              className={`h-14 sm:h-16 px-1 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activePage === 'ledger'
                  ? 'border-[#6F4E37] dark:border-[#C89B6E] text-[#1F1B18] dark:text-[#F3EFEA]'
                  : 'border-transparent text-[#786D65] dark:text-[#9A8F85] hover:text-[#1F1B18] dark:hover:text-[#F3EFEA]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 hidden xs:inline sm:inline" />
              <span>دفتر حساب</span>
            </button>
          </nav>

          {/* Zone 3: Primary Action & Display Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              disabled={loading}
              onClick={() => setBackupModalOpen(true)}
              className="hidden sm:inline-flex min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#4A3326] dark:text-[#E8C5A0] hover:bg-[#FAF8F5] dark:hover:bg-[#26211D] items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              <span>بکاپ / انتقال</span>
            </button>

            <button
              type="button"
              disabled={exporting !== null || loading}
              onClick={() => handleExportExcel()}
              className="hidden sm:inline-flex min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#3D6B4F] dark:text-[#7EC496] hover:bg-[#FAF8F5] dark:hover:bg-[#26211D] items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{exporting === 'excel' ? 'در حال ساخت...' : 'خروجی اکسل'}</span>
            </button>

            <button
              type="button"
              disabled={exporting !== null || loading}
              onClick={() => handleExportPdf()}
              className="hidden sm:inline-flex min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410] hover:bg-[#5C3D28] dark:hover:bg-[#D4AD84] items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>{exporting === 'pdf' ? 'در حال ساخت...' : 'خروجی PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleDigitMode}
              aria-label="تغییر نمایش اعداد فارسی یا انگلیسی"
              title="تغییر نمایش اعداد فارسی / انگلیسی"
              className="min-h-[36px] px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#5C534D] dark:text-[#D5CCC3] hover:bg-[#FAF8F5] dark:hover:bg-[#26211D] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {settings.digitMode === 'fa' ? '۱۲۳' : '123'}
            </button>

            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'فعال‌سازی حالت تاریک' : 'فعال‌سازی حالت روشن'}
              title={theme === 'light' ? 'حالت تاریک' : 'حالت روشن'}
              className="min-h-[36px] w-9 flex items-center justify-center rounded-lg border border-[#DDD6CC] dark:border-[#342E29] text-[#5C534D] dark:text-[#D5CCC3] hover:bg-[#FAF8F5] dark:hover:bg-[#26211D] shrink-0 cursor-pointer"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Contextual Sub-header (Jalali Date & Summary + Mobile Export Buttons) */}
      <div className="border-b border-[#EFEAE2] dark:border-[#24201C] bg-[#F5EFE8]/55 dark:bg-[#191613] no-print">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B6159] dark:text-[#A3988E]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#4A3326] dark:text-[#E8C5A0]">
              {todayJalaliLong}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {activePage === 'pricing'
                ? formatDigits(
                    `${formatNumber(menuItems.length, settings.digitMode)} آیتم منو · ${formatNumber(materials.length, settings.digitMode)} ماده اولیه`,
                    settings.digitMode
                  )
                : formatDigits(
                    `${formatNumber(ledgerEntries.length, settings.digitMode)} رکورد ثبت‌شده در دفتر`,
                    settings.digitMode
                  )}
            </span>
          </div>

          {/* Mobile Export & Backup Actions */}
          <div className="flex sm:hidden items-center gap-1.5">
            <button
              type="button"
              disabled={loading}
              onClick={() => setBackupModalOpen(true)}
              className="px-2 py-1 text-xs font-semibold rounded-md border border-[#DDD6CC] dark:border-[#342E29] text-[#4A3326] dark:text-[#E8C5A0] flex items-center gap-1 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>بکاپ</span>
            </button>
            <button
              type="button"
              disabled={exporting !== null || loading}
              onClick={() => handleExportExcel()}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-[#DDD6CC] dark:border-[#342E29] text-[#3D6B4F] dark:text-[#7EC496] flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>اکسل</span>
            </button>
            <button
              type="button"
              disabled={exporting !== null || loading}
              onClick={() => handleExportPdf()}
              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410] flex items-center gap-1 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0 max-w-[1400px] w-full mx-auto px-3 sm:px-6 py-5 sm:py-6">
        {loading ? (
          <div className="space-y-4">
            <div className="h-14 rounded-xl bg-[#EFEAE2]/70 dark:bg-[#1D1A17] animate-pulse" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 h-96 rounded-2xl bg-[#EFEAE2]/70 dark:bg-[#1D1A17] animate-pulse" />
              <div className="lg:col-span-8 h-96 rounded-2xl bg-[#EFEAE2]/70 dark:bg-[#1D1A17] animate-pulse" />
            </div>
          </div>
        ) : loadError ? (
          <div className="p-8 rounded-2xl border border-[#B83B2E]/30 bg-white dark:bg-[#1D1A17] text-center space-y-3">
            <p className="text-sm font-semibold text-[#B83B2E] dark:text-[#EF7B6E]">
              {loadError}
            </p>
            <button
              type="button"
              onClick={fetchBootstrap}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#6F4E37] text-white cursor-pointer"
            >
              تلاش مجدد
            </button>
          </div>
        ) : activePage === 'pricing' ? (
          <PricingPage
            materials={materials}
            menuItems={menuItems}
            ledgerEntries={ledgerEntries}
            digitMode={settings.digitMode}
            defaultLaborRatePerMinute={settings.defaultLaborRatePerMinute}
            onCreateMaterial={handleCreateMaterial}
            onUpdateMaterial={handleUpdateMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onCreateMenuItem={handleCreateMenuItem}
            onUpdateMenuItem={handleUpdateMenuItem}
            onDeleteMenuItem={handleDeleteMenuItem}
            onNavigateToLedger={() => setActivePage('ledger')}
            onNotify={notify}
          />
        ) : (
          <LedgerPage
            entries={ledgerEntries}
            menuItems={menuItems}
            materials={materials}
            people={people}
            digitMode={settings.digitMode}
            onCreateEntry={handleCreateLedgerEntry}
            onUpdateEntry={handleUpdateLedgerEntry}
            onDeleteEntry={handleDeleteLedgerEntry}
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportPdf}
            onNotify={notify}
          />
        )}
      </main>

      <DataTransferModal
        open={backupModalOpen}
        onClose={() => setBackupModalOpen(false)}
        digitMode={settings.digitMode}
        counts={{
          materials: materials.length,
          menuItems: menuItems.length,
          people: people.length,
          ledgerEntries: ledgerEntries.length,
        }}
        onImported={(data: BootstrapPayload, mode: BackupImportMode) => {
          setMaterials(data.materials);
          setMenuItems(data.menuItems);
          setPeople(data.people);
          setLedgerEntries(data.ledgerEntries);
          setSettings(data.settings);
          notify(
            mode === 'replace'
              ? 'کل اطلاعات فایل پشتیبان با موفقیت جایگزین و ذخیره شد.'
              : 'اطلاعات فایل پشتیبان با موفقیت به داده‌های فعلی اضافه شد.'
          );
        }}
        onNotify={notify}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 left-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
            toast.tone === 'error'
              ? 'bg-[#B83B2E] border-[#9C2F24] text-white'
              : 'bg-[#2C2623] dark:bg-[#EFEAE2] border-[#4A3326] dark:border-[#DDD6CC] text-white dark:text-[#1F1B18]'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
