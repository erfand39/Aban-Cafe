#!/usr/bin/env python3
"""
اسکریپت ایجاد و راه‌اندازی پایگاه داده SQLite برای سیستم مدیریت کافه آبان
شامل جداول: مواد اولیه، آیتم‌های منو، دستور تهیه (رابط چندبه‌چند)، افراد، دفتر حساب و تنظیمات
همراه با روابط کلید خارجی، محدودیت‌های اعتبارسنجی و منطق محاسبه قیمت و ثبت خودکار دفتر حساب.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

try:
    import jdatetime  # type: ignore

    def get_today_jalali() -> str:
        return jdatetime.date.today().strftime("%Y/%m/%d")

except ImportError:
    # تبدیل ساده گرگوری به جلالی در صورت نبود کتابخانه jdatetime
    def _div(a: int, b: int) -> int:
        return int(a // b)

    def get_today_jalali() -> str:
        now = datetime.now()
        gy, gm, gd = now.year, now.month, now.day
        g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
        gy2 = gy + 1 if gm > 2 else gy
        days = (
            355666
            + (365 * gy)
            + _div(gy2 + 3, 4)
            - _div(gy2 + 99, 100)
            + _div(gy2 + 399, 400)
            + gd
            + g_d_m[gm - 1]
        )
        jy = -1595 + (33 * _div(days, 12053))
        days %= 12053
        jy += 4 * _div(days, 1461)
        days %= 1461
        if days > 365:
            jy += _div(days - 1, 365)
            days = (days - 1) % 365
        if days < 186:
            jm = 1 + _div(days, 31)
            jd = 1 + (days % 31)
        else:
            jm = 7 + _div(days - 186, 30)
            jd = 1 + ((days - 186) % 30)
        return f"{jy:04d}/{jm:02d}/{jd:02d}"


DEFAULT_DB_PATH = Path(__file__).resolve().parent / "data" / "cafe-aban.db"


def get_connection(db_path: Path | str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """ایجاد اتصال به SQLite همراه با فعال‌سازی کلیدهای خارجی."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def create_schema(conn: sqlite3.Connection) -> None:
    """ساخت جداول و ایندکس‌های پایگاه داده کافه آبان."""
    conn.executescript(
        """
        PRAGMA foreign_keys = ON;

        -- ۱. جدول مواد اولیه
        CREATE TABLE IF NOT EXISTS materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            purchase_unit TEXT NOT NULL,
            purchase_price REAL NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
            base_quantity REAL NOT NULL DEFAULT 1 CHECK (base_quantity > 0),
            consumption_unit TEXT NOT NULL,
            conversion_factor REAL NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
            is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
            is_zero_cost INTEGER NOT NULL DEFAULT 0 CHECK (is_zero_cost IN (0, 1)),
            notes TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL
        );

        -- ۲. جدول آیتم‌های منو (شامل تنظیمات هزینه جانبی، هزینه فرد و سود)
        CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
            overhead_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (overhead_mode IN ('fixed', 'percent')),
            overhead_fixed REAL NOT NULL DEFAULT 0 CHECK (overhead_fixed >= 0),
            overhead_percent REAL NOT NULL DEFAULT 0 CHECK (overhead_percent >= 0),
            overhead_items_json TEXT NOT NULL DEFAULT '[]',
            labor_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (labor_mode IN ('fixed', 'timed')),
            labor_fixed REAL NOT NULL DEFAULT 0 CHECK (labor_fixed >= 0),
            prep_minutes REAL NOT NULL DEFAULT 0 CHECK (prep_minutes >= 0),
            labor_rate_per_minute REAL NOT NULL DEFAULT 0 CHECK (labor_rate_per_minute >= 0),
            profit_mode TEXT NOT NULL DEFAULT 'percent' CHECK (profit_mode IN ('fixed', 'percent')),
            profit_value REAL NOT NULL DEFAULT 30 CHECK (profit_value >= 0),
            notes TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL
        );

        -- ۳. جدول رابط دستور تهیه (اتصال چندبه‌چند بین آیتم منو و مواد اولیه)
        CREATE TABLE IF NOT EXISTS recipe_ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            menu_item_id INTEGER NOT NULL,
            material_id INTEGER NOT NULL,
            quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
            notes TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
            FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
            UNIQUE (menu_item_id, material_id)
        );

        -- ۴. جدول افراد (مشتری، تأمین‌کننده، پرسنل، سایر)
        CREATE TABLE IF NOT EXISTS people (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'supplier', 'staff', 'other')),
            phone TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT ''
        );

        -- ۵. جدول دفتر حساب دفتری (مرتبط با آیتم‌های منو و جدول افراد)
        CREATE TABLE IF NOT EXISTS ledger_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_type TEXT NOT NULL CHECK (entry_type IN ('sale', 'receipt', 'payment', 'expense', 'manual')),
            menu_item_id INTEGER,
            menu_item_name TEXT NOT NULL DEFAULT '',
            person_id INTEGER,
            person_name TEXT NOT NULL DEFAULT '',
            person_role TEXT NOT NULL DEFAULT 'other' CHECK (person_role IN ('customer', 'supplier', 'staff', 'other')),
            quantity REAL NOT NULL DEFAULT 1 CHECK (quantity >= 0),
            unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
            total_amount REAL NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
            jalali_date TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL,
            FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL
        );

        -- ۶. جدول تنظیمات سیستم
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- ایندکس‌ها برای سرعت جستجو و فیلتر در گزارش‌ها
        CREATE INDEX IF NOT EXISTS idx_recipe_menu_item ON recipe_ingredients(menu_item_id);
        CREATE INDEX IF NOT EXISTS idx_recipe_material ON recipe_ingredients(material_id);
        CREATE INDEX IF NOT EXISTS idx_ledger_jalali_date ON ledger_entries(jalali_date);
        CREATE INDEX IF NOT EXISTS idx_ledger_entry_type ON ledger_entries(entry_type);
        CREATE INDEX IF NOT EXISTS idx_ledger_menu_item ON ledger_entries(menu_item_id);
        CREATE INDEX IF NOT EXISTS idx_ledger_person ON ledger_entries(person_id);
        """
    )
    conn.commit()


def calculate_item_pricing(conn: sqlite3.Connection, menu_item_id: int) -> dict[str, Any]:
    """
    محاسبه بهای تمام‌شده و قیمت عرضه یک آیتم منو از روی دستور تهیه،
    هزینه‌های جانبی، هزینه فرد و سود.
    """
    item = conn.execute("SELECT * FROM menu_items WHERE id = ?", (menu_item_id,)).fetchone()
    if item is None:
        raise ValueError(f"آیتم منو با شناسه {menu_item_id} یافت نشد.")

    ingredients = conn.execute(
        """
        SELECT
            ri.quantity,
            ri.notes AS ingredient_notes,
            m.id AS material_id,
            m.name AS material_name,
            m.purchase_price,
            m.base_quantity,
            m.consumption_unit,
            m.is_available,
            m.is_zero_cost
        FROM recipe_ingredients ri
        JOIN materials m ON m.id = ri.material_id
        WHERE ri.menu_item_id = ?
        ORDER BY ri.id ASC
        """,
        (menu_item_id,),
    ).fetchall()

    materials_cost = 0.0
    ingredient_details: list[dict[str, Any]] = []
    for row in ingredients:
        if row["is_zero_cost"] or row["base_quantity"] <= 0:
            unit_cost = 0.0
        else:
            unit_cost = float(row["purchase_price"]) / float(row["base_quantity"])
        line_cost = unit_cost * float(row["quantity"])
        materials_cost += line_cost
        ingredient_details.append(
            {
                "material_id": row["material_id"],
                "material_name": row["material_name"],
                "quantity": row["quantity"],
                "consumption_unit": row["consumption_unit"],
                "unit_cost": round(unit_cost, 2),
                "line_cost": round(line_cost),
            }
        )

    # محاسبه هزینه جانبی (ثابت / تفکیک‌شده یا درصدی از مواد اولیه)
    if item["overhead_mode"] == "percent":
        overhead_cost = materials_cost * (float(item["overhead_percent"]) / 100.0)
    else:
        try:
            overhead_lines = json.loads(item["overhead_items_json"] or "[]")
        except json.JSONDecodeError:
            overhead_lines = []
        if overhead_lines:
            overhead_cost = sum(max(0.0, float(line.get("amount", 0))) for line in overhead_lines)
        else:
            overhead_cost = float(item["overhead_fixed"])

    # محاسبه هزینه فرد / نیروی انسانی
    if item["labor_mode"] == "timed":
        labor_cost = float(item["prep_minutes"]) * float(item["labor_rate_per_minute"])
    else:
        labor_cost = float(item["labor_fixed"])

    cost_of_goods = materials_cost + overhead_cost + labor_cost

    # محاسبه سود (درصدی یا مبلغ ثابت)
    if item["profit_mode"] == "percent":
        profit_amount = cost_of_goods * (float(item["profit_value"]) / 100.0)
    else:
        profit_amount = float(item["profit_value"])

    selling_price = round(cost_of_goods + profit_amount)

    return {
        "menu_item_id": item["id"],
        "name": item["name"],
        "ingredients": ingredient_details,
        "materials_cost": round(materials_cost),
        "overhead_cost": round(overhead_cost),
        "labor_cost": round(labor_cost),
        "cost_of_goods": round(cost_of_goods),
        "profit_amount": round(profit_amount),
        "selling_price": selling_price,
    }


def upsert_person(
    conn: sqlite3.Connection,
    name: str,
    role: str = "customer",
    phone: str = "",
    notes: str = "",
) -> int:
    """ثبت یا بازیابی شناسه فرد در جدول افراد."""
    clean_name = name.strip()
    existing = conn.execute("SELECT id FROM people WHERE name = ?", (clean_name,)).fetchone()
    if existing:
        return int(existing["id"])
    cur = conn.execute(
        "INSERT INTO people (name, role, phone, notes) VALUES (?, ?, ?, ?)",
        (clean_name, role, phone, notes),
    )
    conn.commit()
    return int(cur.lastrowid)


def create_ledger_entry(
    conn: sqlite3.Connection,
    *,
    entry_type: str,
    jalali_date: str,
    menu_item_id: Optional[int] = None,
    person_name: str = "",
    person_role: str = "customer",
    quantity: float = 1,
    unit_price: Optional[float] = None,
    total_amount: Optional[float] = None,
    description: str = "",
) -> int:
    """
    ثبت رکورد جدید در دفتر حساب با ارتباط خودکار به صفحه قیمت‌گذاری و جدول افراد:
    - در صورت انتخاب آیتم منو و وارد نکردن قیمت واحد، قیمت عرضه روز آیتم محاسبه و جایگذاری می‌شود.
    - در صورت وارد نکردن مبلغ کل، به‌صورت خودکار از تعداد × مبلغ واحد محاسبه می‌گردد.
    - در صورت ورود نام فرد جدید، فرد به‌صورت خودکار در جدول people ذخیره می‌شود.
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    resolved_item_name = ""
    resolved_unit_price = float(unit_price or 0)
    if menu_item_id is not None:
        pricing = calculate_item_pricing(conn, menu_item_id)
        resolved_item_name = pricing["name"]
        if unit_price is None:
            resolved_unit_price = float(pricing["selling_price"])

    if total_amount is None:
        resolved_total = round(max(0.0, float(quantity)) * max(0.0, resolved_unit_price))
    else:
        resolved_total = round(max(0.0, float(total_amount)))

    resolved_person_id: Optional[int] = None
    clean_person = person_name.strip()
    if clean_person:
        resolved_person_id = upsert_person(conn, clean_person, role=person_role)

    cur = conn.execute(
        """
        INSERT INTO ledger_entries (
            entry_type, menu_item_id, menu_item_name, person_id, person_name, person_role,
            quantity, unit_price, total_amount, jalali_date, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            entry_type,
            menu_item_id,
            resolved_item_name,
            resolved_person_id,
            clean_person,
            person_role,
            quantity,
            resolved_unit_price,
            resolved_total,
            jalali_date,
            description,
            now_iso,
            now_iso,
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def init_default_settings(conn: sqlite3.Connection) -> None:
    """مقداردهی تنظیمات پیش‌فرض سیستم در صورت نبودن."""
    conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", ("digitMode", "fa"))
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
        ("defaultLaborRatePerMinute", "3000"),
    )
    conn.commit()


def init_database(db_path: Path | str = DEFAULT_DB_PATH) -> Path:
    """راه‌اندازی کامل پایگاه داده بدون داده‌های نمونه و برگرداندن مسیر فایل SQLite."""
    path = Path(db_path)
    with get_connection(path) as conn:
        create_schema(conn)
        init_default_settings(conn)
    return path


if __name__ == "__main__":
    db_file = init_database(DEFAULT_DB_PATH)
    with get_connection(db_file) as conn:
        tables = [
            row["name"]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            ).fetchall()
        ]
        print(f"پایگاه داده کافه آبان با موفقیت آماده شد: {db_file}")
        print(f"جداول ایجادشده: {', '.join(tables)}")
