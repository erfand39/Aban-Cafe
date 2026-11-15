import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  Upload,
  X,
} from 'lucide-react';
import {
  parseAndValidateBackup,
  type BackupImportMode,
  type CafeAbanBackupV1,
} from '../shared/backup';
import { formatNumber } from '../shared/format';
import type { BootstrapPayload, DigitMode } from '../shared/types';
import { api } from '../utils/api';

interface DataTransferModalProps {
  open: boolean;
  onClose: () => void;
  digitMode: DigitMode;
  counts: {
    materials: number;
    menuItems: number;
    people: number;
    ledgerEntries: number;
  };
  onImported: (bootstrap: BootstrapPayload, mode: BackupImportMode) => void;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export function DataTransferModal({
  open,
  onClose,
  digitMode,
  counts,
  onImported,
  onNotify,
}: DataTransferModalProps) {
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [importMode, setImportMode] = useState<BackupImportMode>('replace');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedBackup, setParsedBackup] = useState<CafeAbanBackupV1 | null>(null);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const resetFileState = () => {
    setSelectedFileName('');
    setParsedBackup(null);
    setFileError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = async () => {
    setExportingBackup(true);
    try {
      await api.downloadBackup();
      onNotify('فایل پشتیبان کامل داده‌ها با موفقیت دانلود شد.');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'خطا در تهیه فایل پشتیبان',
        'error'
      );
    } finally {
      setExportingBackup(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError('');
    setParsedBackup(null);
    if (!file) {
      setSelectedFileName('');
      return;
    }
    setSelectedFileName(file.name);
    try {
      const text = await file.text();
      const rawJson = JSON.parse(text);
      const validated = parseAndValidateBackup(rawJson);
      setParsedBackup(validated);
    } catch (err) {
      setFileError(
        err instanceof Error
          ? err.message
          : 'فایل انتخاب‌شده معتبر نیست. لطفاً فایل پشتیبان JSON کافه آبان را انتخاب کنید.'
      );
    }
  };

  const handleImportSubmit = async () => {
    if (!parsedBackup) return;
    setImportingBackup(true);
    try {
      const result = await api.importBackup(parsedBackup, importMode);
      onImported(result.bootstrap, importMode);
      resetFileState();
      onClose();
    } catch (err) {
      setFileError(
        err instanceof Error ? err.message : 'خطا در بازیابی اطلاعات فایل پشتیبان'
      );
    } finally {
      setImportingBackup(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-transfer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-[#E7E2DA] dark:border-[#2E2924] bg-white dark:bg-[#1D1A17] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#EFEAE2] dark:border-[#2E2924] flex items-center justify-between gap-4 bg-[#FAF8F5] dark:bg-[#171412] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#6F4E37]/10 dark:bg-[#C89B6E]/15 text-[#6F4E37] dark:text-[#C89B6E] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="data-transfer-modal-title"
                className="text-base sm:text-lg font-extrabold text-[#1F1B18] dark:text-[#F3EFEA] truncate"
              >
                پشتیبان‌گیری، ذخیره لوکال و انتقال به سیستم دیگر
              </h2>
              <p className="text-xs text-[#786D65] dark:text-[#9A8F85] truncate">
                خروجی گرفتن از کل دیتابیس و وارد کردن روی لپ‌تاپ یا سیستم دیگر
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره پشتیبان‌گیری"
            className="p-2 rounded-lg text-[#786D65] dark:text-[#9A8F85] hover:bg-[#EFEAE2] dark:hover:bg-[#2A241F] hover:text-[#1F1B18] dark:hover:text-[#F3EFEA] cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 divide-y divide-[#EFEAE2] dark:divide-[#2E2924]">
          {/* Local persistence info */}
          <div className="px-5 sm:px-6 py-4 bg-[#FAF8F5]/60 dark:bg-[#191613] flex items-start gap-3 text-xs leading-6 text-[#5C534D] dark:text-[#D5CCC3]">
            <HardDrive className="w-4 h-4 mt-1 text-[#3D6B4F] dark:text-[#7EC496] shrink-0" />
            <div>
              تمام اطلاعات شما به‌صورت آنی در فایل دیتابیس لوکال{' '}
              <span className="font-mono-num font-semibold text-[#4A3326] dark:text-[#E8C5A0]">
                data/cafe-aban.db
              </span>{' '}
              روی همین دستگاه ذخیره می‌شود و با بستن برنامه یا خاموش و روشن شدن لپ‌تاپ از بین نمی‌رود.
            </div>
          </div>

          {/* Section 1: Export Backup */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                  ۱. خروجی کامل دیتا (اکسپورت)
                </h3>
                <p className="text-xs text-[#786D65] dark:text-[#9A8F85] mt-0.5">
                  شامل همه مواد اولیه، آیتم‌های منو و فرمول‌ها، افراد، دفتر حساب و تنظیمات
                </p>
              </div>
              <button
                type="button"
                disabled={exportingBackup}
                onClick={handleExport}
                className="min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-[#3D6B4F] text-white hover:bg-[#2F563E] flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>
                  {exportingBackup ? 'در حال ساخت فایل...' : 'دانلود فایل پشتیبان (JSON)'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs tabular-nums">
              <div className="py-2 px-3 rounded-lg bg-[#FAF8F5] dark:bg-[#171412] border border-[#EFEAE2] dark:border-[#2E2924]">
                <div className="text-[#786D65] dark:text-[#9A8F85]">مواد اولیه</div>
                <div className="mt-0.5 font-bold text-sm text-[#1F1B18] dark:text-[#F3EFEA]">
                  {formatNumber(counts.materials, digitMode)}
                </div>
              </div>
              <div className="py-2 px-3 rounded-lg bg-[#FAF8F5] dark:bg-[#171412] border border-[#EFEAE2] dark:border-[#2E2924]">
                <div className="text-[#786D65] dark:text-[#9A8F85]">آیتم‌های منو</div>
                <div className="mt-0.5 font-bold text-sm text-[#1F1B18] dark:text-[#F3EFEA]">
                  {formatNumber(counts.menuItems, digitMode)}
                </div>
              </div>
              <div className="py-2 px-3 rounded-lg bg-[#FAF8F5] dark:bg-[#171412] border border-[#EFEAE2] dark:border-[#2E2924]">
                <div className="text-[#786D65] dark:text-[#9A8F85]">افراد</div>
                <div className="mt-0.5 font-bold text-sm text-[#1F1B18] dark:text-[#F3EFEA]">
                  {formatNumber(counts.people, digitMode)}
                </div>
              </div>
              <div className="py-2 px-3 rounded-lg bg-[#FAF8F5] dark:bg-[#171412] border border-[#EFEAE2] dark:border-[#2E2924]">
                <div className="text-[#786D65] dark:text-[#9A8F85]">رکوردهای دفتر</div>
                <div className="mt-0.5 font-bold text-sm text-[#1F1B18] dark:text-[#F3EFEA]">
                  {formatNumber(counts.ledgerEntries, digitMode)}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Import Backup */}
          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                ۲. وارد کردن دیتا از سیستم دیگر (ایمپورت)
              </h3>
              <p className="text-xs text-[#786D65] dark:text-[#9A8F85] mt-0.5">
                فایل پشتیبان (.json) خروجی‌گرفته‌شده از کافه آبان را انتخاب کنید.
              </p>
            </div>

            {/* Mode selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-start gap-2.5 ${
                  importMode === 'replace'
                    ? 'border-[#6F4E37] dark:border-[#C89B6E] bg-[#F5EFE8]/70 dark:bg-[#29231E]'
                    : 'border-[#E7E2DA] dark:border-[#2E2924] hover:bg-[#FAF8F5] dark:hover:bg-[#231F1B]'
                }`}
              >
                <input
                  type="radio"
                  name="backup-import-mode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="mt-0.5 accent-[#6F4E37]"
                />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                    جایگزینی کامل داده‌ها (انتقال به سیستم جدید)
                  </div>
                  <div className="text-[#786D65] dark:text-[#9A8F85]">
                    اطلاعات فعلی پاک شده و دقیقاً داده‌های فایل پشتیبان بازیابی می‌شوند.
                  </div>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-start gap-2.5 ${
                  importMode === 'merge'
                    ? 'border-[#6F4E37] dark:border-[#C89B6E] bg-[#F5EFE8]/70 dark:bg-[#29231E]'
                    : 'border-[#E7E2DA] dark:border-[#2E2924] hover:bg-[#FAF8F5] dark:hover:bg-[#231F1B]'
                }`}
              >
                <input
                  type="radio"
                  name="backup-import-mode"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="mt-0.5 accent-[#6F4E37]"
                />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-[#1F1B18] dark:text-[#F3EFEA]">
                    ادغام با داده‌های فعلی
                  </div>
                  <div className="text-[#786D65] dark:text-[#9A8F85]">
                    اطلاعات قبلی حفظ شده و رکوردهای جدید فایل به دیتابیس اضافه می‌شوند.
                  </div>
                </div>
              </label>
            </div>

            {/* File input */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                aria-label="انتخاب فایل پشتیبان JSON"
                className="block w-full sm:w-auto text-xs text-[#5C534D] dark:text-[#D5CCC3] file:ml-3 file:py-2 file:px-3.5 file:rounded-lg file:border file:border-[#DDD6CC] dark:file:border-[#342E29] file:text-xs file:font-semibold file:bg-[#FAF8F5] dark:file:bg-[#26211D] file:text-[#4A3326] dark:file:text-[#E8C5A0] hover:file:bg-[#EFEAE2] file:cursor-pointer cursor-pointer"
              />
              {selectedFileName && (
                <button
                  type="button"
                  onClick={resetFileState}
                  className="text-xs text-[#786D65] hover:text-[#B83B2E] cursor-pointer"
                >
                  پاک کردن انتخاب
                </button>
              )}
            </div>

            {fileError && (
              <div className="p-3 rounded-xl bg-[#B83B2E]/10 border border-[#B83B2E]/30 text-xs font-medium text-[#B83B2E] dark:text-[#EF7B6E] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {parsedBackup && (
              <div className="p-4 rounded-xl bg-[#3D6B4F]/10 border border-[#3D6B4F]/30 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#3D6B4F] dark:text-[#7EC496]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>فایل پشتیبان معتبر است و آماده وارد شدن به دیتابیس می‌باشد:</span>
                </div>
                <div className="text-xs text-[#5C534D] dark:text-[#D5CCC3] tabular-nums">
                  {formatNumber(parsedBackup.data.materials.length, digitMode)} ماده اولیه ·{' '}
                  {formatNumber(parsedBackup.data.menuItems.length, digitMode)} آیتم منو ·{' '}
                  {formatNumber(parsedBackup.data.people.length, digitMode)} فرد ·{' '}
                  {formatNumber(parsedBackup.data.ledgerEntries.length, digitMode)} رکورد دفتر حساب
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={importingBackup}
                    onClick={handleImportSubmit}
                    className="min-h-[38px] px-4 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#6F4E37] dark:bg-[#C89B6E] text-white dark:text-[#1A1410] hover:bg-[#5C3D28] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>
                      {importingBackup
                        ? 'در حال وارد کردن...'
                        : 'تأیید و وارد کردن اطلاعات'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
