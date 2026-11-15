#!/bin/bash
cd "$(dirname "$0")"

echo "=================================================="
echo "  کافه آبان — اجرای لوکال بدون نیاز به اینترنت و Node.js"
echo "=================================================="

PY_CMD=""
if command -v python3 >/dev/null 2>&1; then
  PY_CMD="python3"
elif command -v python >/dev/null 2>&1; then
  PY_CMD="python"
fi

if [ -z "$PY_CMD" ]; then
  echo "[خطا] پایتون ۳ روی این سیستم نصب نیست. لطفاً از python.org نصب کنید."
  read -p "برای خروج Enter بزنید..."
  exit 1
fi

if [ ! -f "dist/index.html" ] && [ ! -f "local_ui/index.html" ]; then
  echo "[خطا] پوشه ساخته‌شده برنامه (dist یا local_ui) یافت نشد."
  read -p "برای خروج Enter بزنید..."
  exit 1
fi

echo "مسیر دیتابیس: $(pwd)/data/cafe-aban.db"
echo "در حال اجرای سرور لوکال و باز کردن مرورگر..."
"$PY_CMD" cafe_aban_server.py
