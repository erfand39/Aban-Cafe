#!/usr/bin/env python3
"""
سرور لوکال و بدون پیش‌نیاز کافه آبان (فقط با کتابخانه استاندارد پایتون ۳)
- بدون نیاز به Node.js یا نصب پکیج اضافی (pip)
- ذخیره پایدار تمام اطلاعات در فایل SQLite محلی (data/cafe-aban.db)
- سرو رابط کاربری ساخته‌شده (dist/) + تمام APIهای قیمت‌گذاری، دفتر حساب، اکسل و بکاپ/انتقال
"""

from __future__ import annotations

import argparse
import io
import json
import mimetypes
import os
import re
import signal
import socket
import sqlite3
import sys
import threading
import urllib.parse
import webbrowser
import zipfile
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape as xml_escape

from init_cafe_aban_db import (
    DEFAULT_DB_PATH,
    create_schema,
    get_today_jalali,
    init_default_settings,
)

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"
LOCAL_UI_DIR = BASE_DIR / "local_ui"
DB_LOCK = threading.RLock()


def resolve_ui_dir() -> Path:
    if (DIST_DIR / "index.html").exists():
        return DIST_DIR
    if (LOCAL_UI_DIR / "index.html").exists():
        return LOCAL_UI_DIR
    return DIST_DIR

VALID_ENTRY_TYPES = {"sale", "receipt", "payment", "expense", "manual"}
VALID_PERSON_ROLES = {"customer", "supplier", "staff", "other"}

LEDGER_TYPE_LABELS = {
    "sale": "فروش",
    "receipt": "دریافت",
    "payment": "پرداخت",
    "expense": "هزینه",
    "manual": "ثبت آزاد",
}
PERSON_ROLE_LABELS = {
    "customer": "مشتری",
    "supplier": "تأمین‌کننده",
    "staff": "پرسنل",
    "other": "سایر",
}
INFLOW_TYPES = {"sale", "receipt"}
OUTFLOW_TYPES = {"payment", "expense"}


def get_db_connection(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=15.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA synchronous = FULL;")
    create_schema(conn)
    init_default_settings(conn)
    return conn


def list_materials(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT * FROM materials ORDER BY id ASC").fetchall()
    return [
        {
            "id": int(r["id"]),
            "name": str(r["name"]),
            "purchaseUnit": str(r["purchase_unit"]),
            "purchasePrice": float(r["purchase_price"]),
            "baseQuantity": float(r["base_quantity"]),
            "consumptionUnit": str(r["consumption_unit"]),
            "conversionFactor": float(r["conversion_factor"]),
            "isAvailable": bool(r["is_available"]),
            "isZeroCost": bool(r["is_zero_cost"]),
            "notes": str(r["notes"] or ""),
            "updatedAt": str(r["updated_at"]),
        }
        for r in rows
    ]


def list_menu_items(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT * FROM menu_items ORDER BY id ASC").fetchall()
    ing_rows = conn.execute("SELECT * FROM recipe_ingredients ORDER BY id ASC").fetchall()
    ing_by_item: dict[int, list[dict[str, Any]]] = {}
    for ir in ing_rows:
        item_id = int(ir["menu_item_id"])
        ing_by_item.setdefault(item_id, []).append(
            {
                "id": int(ir["id"]),
                "menuItemId": item_id,
                "materialId": int(ir["material_id"]),
                "quantity": float(ir["quantity"]),
                "notes": str(ir["notes"] or ""),
            }
        )

    result: list[dict[str, Any]] = []
    for r in rows:
        try:
            overhead_items = json.loads(r["overhead_items_json"] or "[]")
            if not isinstance(overhead_items, list):
                overhead_items = []
        except json.JSONDecodeError:
            overhead_items = []

        item_id = int(r["id"])
        result.append(
            {
                "id": item_id,
                "name": str(r["name"]),
                "category": str(r["category"]),
                "isActive": bool(r["is_active"]),
                "overheadMode": "percent" if r["overhead_mode"] == "percent" else "fixed",
                "overheadFixed": float(r["overhead_fixed"]),
                "overheadPercent": float(r["overhead_percent"]),
                "overheadItems": overhead_items,
                "laborMode": "timed" if r["labor_mode"] == "timed" else "fixed",
                "laborFixed": float(r["labor_fixed"]),
                "prepMinutes": float(r["prep_minutes"]),
                "laborRatePerMinute": float(r["labor_rate_per_minute"]),
                "profitMode": "fixed" if r["profit_mode"] == "fixed" else "percent",
                "profitValue": float(r["profit_value"]),
                "notes": str(r["notes"] or ""),
                "ingredients": ing_by_item.get(item_id, []),
                "updatedAt": str(r["updated_at"]),
            }
        )
    return result


def list_people(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT * FROM people ORDER BY name ASC").fetchall()
    return [
        {
            "id": int(r["id"]),
            "name": str(r["name"]),
            "role": str(r["role"]) if r["role"] in VALID_PERSON_ROLES else "other",
            "phone": str(r["phone"] or ""),
            "notes": str(r["notes"] or ""),
        }
        for r in rows
    ]


def list_ledger_entries(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM ledger_entries ORDER BY jalali_date DESC, id DESC"
    ).fetchall()
    return [
        {
            "id": int(r["id"]),
            "entryType": str(r["entry_type"]) if r["entry_type"] in VALID_ENTRY_TYPES else "sale",
            "menuItemId": int(r["menu_item_id"]) if r["menu_item_id"] is not None else None,
            "menuItemName": str(r["menu_item_name"] or ""),
            "personId": int(r["person_id"]) if r["person_id"] is not None else None,
            "personName": str(r["person_name"] or ""),
            "personRole": str(r["person_role"]) if r["person_role"] in VALID_PERSON_ROLES else "other",
            "quantity": float(r["quantity"]),
            "unitPrice": float(r["unit_price"]),
            "totalAmount": float(r["total_amount"]),
            "jalaliDate": str(r["jalali_date"]),
            "description": str(r["description"] or ""),
            "createdAt": str(r["created_at"]),
            "updatedAt": str(r["updated_at"]),
        }
        for r in rows
    ]


def get_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    mapping = {str(r["key"]): str(r["value"]) for r in rows}
    digit_mode = "en" if mapping.get("digitMode") == "en" else "fa"
    try:
        labor_rate = float(mapping.get("defaultLaborRatePerMinute", "3000"))
    except ValueError:
        labor_rate = 3000.0
    if labor_rate <= 0:
        labor_rate = 3000.0
    return {
        "digitMode": digit_mode,
        "defaultLaborRatePerMinute": labor_rate,
    }


def get_bootstrap_data(conn: sqlite3.Connection) -> dict[str, Any]:
    return {
        "materials": list_materials(conn),
        "menuItems": list_menu_items(conn),
        "people": list_people(conn),
        "ledgerEntries": list_ledger_entries(conn),
        "settings": get_settings(conn),
    }


def to_persian_digits(text: str) -> str:
    trans = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
    return text.translate(trans)


def fmt_num(val: float, digit_mode: str) -> str:
    rounded = round(val)
    s = f"{rounded:,}"
    return to_persian_digits(s) if digit_mode == "fa" else s


def calc_material_unit_cost(mat: dict[str, Any]) -> float:
    if mat.get("isZeroCost") or float(mat.get("baseQuantity", 0)) <= 0:
        return 0.0
    return float(mat.get("purchasePrice", 0)) / float(mat.get("baseQuantity", 1))


def calc_menu_item_pricing(
    item: dict[str, Any], mat_map: dict[int, dict[str, Any]]
) -> dict[str, float]:
    materials_cost = 0.0
    for ing in item.get("ingredients", []):
        mat = mat_map.get(int(ing.get("materialId", 0)))
        if mat is not None:
            materials_cost += calc_material_unit_cost(mat) * float(ing.get("quantity", 0))

    if item.get("overheadMode") == "percent":
        overhead_cost = materials_cost * (float(item.get("overheadPercent", 0)) / 100.0)
    else:
        overhead_lines = item.get("overheadItems") or []
        if overhead_lines:
            overhead_cost = sum(
                max(0.0, float(line.get("amount", 0))) for line in overhead_lines
            )
        else:
            overhead_cost = max(0.0, float(item.get("overheadFixed", 0)))

    if item.get("laborMode") == "timed":
        labor_cost = max(0.0, float(item.get("prepMinutes", 0))) * max(
            0.0, float(item.get("laborRatePerMinute", 0))
        )
    else:
        labor_cost = max(0.0, float(item.get("laborFixed", 0)))

    cost_of_goods = materials_cost + overhead_cost + labor_cost
    if item.get("profitMode") == "percent":
        profit_amount = cost_of_goods * (max(0.0, float(item.get("profitValue", 0))) / 100.0)
    else:
        profit_amount = max(0.0, float(item.get("profitValue", 0)))

    selling_price = round(cost_of_goods + profit_amount)
    return {
        "materialsCost": round(materials_cost),
        "overheadCost": round(overhead_cost),
        "laborCost": round(labor_cost),
        "costOfGoods": round(cost_of_goods),
        "profitAmount": round(profit_amount),
        "sellingPrice": selling_price,
    }


def _col_letter(col_idx: int) -> str:
    result = ""
    n = col_idx
    while n > 0:
        n, rem = divmod(n - 1, 26)
        result = chr(65 + rem) + result
    return result


def _build_sheet_xml(
    *,
    title: str,
    subtitle: str,
    headers: list[str],
    rows: list[list[tuple[Any, str, int]]],
    col_widths: list[float],
    title_style: int,
    sub_style: int,
    header_style: int,
) -> str:
    """ساخت XML یک شیت اکسل راست‌به‌چپ با استایل حرفه‌ای."""
    num_cols = len(headers)
    last_col = _col_letter(num_cols)

    cols_xml = "".join(
        f'<col min="{i}" max="{i}" width="{w}" customWidth="1"/>'
        for i, w in enumerate(col_widths, start=1)
    )

    lines: list[str] = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<sheetViews><sheetView workbookViewId="0" rightToLeft="1">'
        '<pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/>'
        "</sheetView></sheetViews>",
        f"<cols>{cols_xml}</cols>",
        "<sheetData>",
    ]

    # Row 1: Title
    lines.append(
        f'<row r="1" ht="32" customHeight="1">'
        f'<c r="A1" t="inlineStr" s="{title_style}"><is><t>{xml_escape(title)}</t></is></c>'
        + "".join(
            f'<c r="{_col_letter(c)}1" s="{title_style}"/>'
            for c in range(2, num_cols + 1)
        )
        + "</row>"
    )

    # Row 2: Subtitle
    lines.append(
        f'<row r="2" ht="22" customHeight="1">'
        f'<c r="A2" t="inlineStr" s="{sub_style}"><is><t>{xml_escape(subtitle)}</t></is></c>'
        + "".join(
            f'<c r="{_col_letter(c)}2" s="{sub_style}"/>'
            for c in range(2, num_cols + 1)
        )
        + "</row>"
    )

    # Row 3: Headers
    header_cells = "".join(
        f'<c r="{_col_letter(c)}3" t="inlineStr" s="{header_style}"><is><t>{xml_escape(h)}</t></is></c>'
        for c, h in enumerate(headers, start=1)
    )
    lines.append(f'<row r="3" ht="26" customHeight="1">{header_cells}</row>')

    # Data rows
    for row_offset, row_cells in enumerate(rows, start=4):
        cell_xml_parts: list[str] = []
        for c_idx, (val, c_type, style_idx) in enumerate(row_cells, start=1):
            ref = f"{_col_letter(c_idx)}{row_offset}"
            if c_type == "n":
                cell_xml_parts.append(
                    f'<c r="{ref}" s="{style_idx}"><v>{val}</v></c>'
                )
            else:
                cell_xml_parts.append(
                    f'<c r="{ref}" t="inlineStr" s="{style_idx}"><is><t>{xml_escape(str(val))}</t></is></c>'
                )
        lines.append(
            f'<row r="{row_offset}" ht="23" customHeight="1">{"".join(cell_xml_parts)}</row>'
        )

    lines.append("</sheetData>")
    lines.append(
        f'<mergeCells count="2">'
        f'<mergeCell ref="A1:{last_col}1"/>'
        f'<mergeCell ref="A2:{last_col}2"/>'
        f"</mergeCells>"
    )
    lines.append("</worksheet>")
    return "".join(lines)


def generate_excel_bytes(
    *,
    materials: list[dict[str, Any]],
    menu_items: list[dict[str, Any]],
    ledger_entries: list[dict[str, Any]],
    digit_mode: str,
) -> bytes:
    """تولید فایل اکسل ۳ شیت واقعی (.xlsx) بدون نیاز به کتابخانه خارجی."""
    today_jalali = get_today_jalali()
    today_str = to_persian_digits(today_jalali) if digit_mode == "fa" else today_jalali
    mat_map = {int(m["id"]): m for m in materials}

    # Style indices in xl/styles.xml:
    # 0: default
    # 1: title brown (#4A3326) white bold
    # 2: subtitle warm (#F5EFE8) brown text
    # 3: header brown (#6F4E37) white bold
    # 4: data center text
    # 5: data number (#,##0)
    # 6: data number green bold (#3D6B4F)
    # 7: data number red bold (#B83B2E)
    # 8: title green (#3D5A45) white bold
    # 9: subtitle green (#EEF4F0)
    # 10: header green (#4B7055) white bold
    # 11: title dark (#2C2623) white bold
    # 12: subtitle cream (#F3ECE4)
    # 13: header coffee (#5C3D28) white bold
    # 14: summary row bold (#EDE4D8)
    # 15: summary number bold (#EDE4D8)

    styles_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="#,##0.##"/>
  </numFmts>
  <fonts count="7">
    <font><sz val="10"/><name val="Vazirmatn"/><color rgb="FF1F1B18"/></font>
    <font><b/><sz val="13"/><name val="Vazirmatn"/><color rgb="FFFFFFFF"/></font>
    <font><sz val="10"/><name val="Vazirmatn"/><color rgb="FF4A3326"/></font>
    <font><b/><sz val="10"/><name val="Vazirmatn"/><color rgb="FFFFFFFF"/></font>
    <font><b/><sz val="10"/><name val="Vazirmatn"/><color rgb="FF3D6B4F"/></font>
    <font><b/><sz val="10"/><name val="Vazirmatn"/><color rgb="FFB83B2E"/></font>
    <font><b/><sz val="11"/><name val="Vazirmatn"/><color rgb="FF2C2623"/></font>
  </fonts>
  <fills count="10">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4A3326"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF5EFE8"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF6F4E37"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF3D5A45"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEEF4F0"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4B7055"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2C2623"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEDE4D8"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE7E2DA"/></left>
      <right style="thin"><color rgb="FFE7E2DA"/></right>
      <top style="thin"><color rgb="FFE7E2DA"/></top>
      <bottom style="thin"><color rgb="FFE7E2DA"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="16">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="8" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="9" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="6" fillId="9" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
</styleSheet>"""

    # Sheet 1: آیتم‌ها
    item_rows = []
    for idx, item in enumerate(menu_items, start=1):
        b = calc_menu_item_pricing(item, mat_map)
        item_rows.append(
            [
                (idx, "n", 4),
                (item["name"], "s", 4),
                (item["category"], "s", 4),
                ("فعال" if item["isActive"] else "غیرفعال", "s", 4),
                (b["materialsCost"], "n", 5),
                (b["overheadCost"], "n", 5),
                (b["laborCost"], "n", 5),
                (b["costOfGoods"], "n", 5),
                (b["profitAmount"], "n", 5),
                (b["sellingPrice"], "n", 6),
            ]
        )

    sheet1_xml = _build_sheet_xml(
        title=f"کافه آبان — گزارش قیمت‌گذاری منو (تاریخ: {today_str})",
        subtitle="محاسبه دقیق بهای تمام‌شده بر اساس دستور تهیه، هزینه جانبی، هزینه فرد و سود",
        headers=[
            "ردیف",
            "نام آیتم",
            "دسته‌بندی",
            "وضعیت",
            "بهای مواد اولیه (تومان)",
            "هزینه جانبی (تومان)",
            "هزینه فرد (تومان)",
            "بهای تمام‌شده (تومان)",
            "سود (تومان)",
            "قیمت عرضه (تومان)",
        ],
        rows=item_rows,
        col_widths=[8, 22, 22, 12, 22, 20, 18, 22, 18, 22],
        title_style=1,
        sub_style=2,
        header_style=3,
    )

    # Sheet 2: مواد اولیه
    mat_rows = []
    for idx, m in enumerate(materials, start=1):
        unit_cost = round(calc_material_unit_cost(m), 2)
        mat_rows.append(
            [
                (idx, "n", 4),
                (m["name"], "s", 4),
                (m["purchaseUnit"], "s", 4),
                (m["purchasePrice"], "n", 5),
                (m["baseQuantity"], "n", 5),
                (m["consumptionUnit"], "s", 4),
                (unit_cost, "n", 5),
                ("موجود" if m["isAvailable"] else "غیرفعال", "s", 4),
                (m["notes"] or "-", "s", 4),
            ]
        )

    sheet2_xml = _build_sheet_xml(
        title=f"کافه آبان — فهرست مواد اولیه و نرخ مبنا (تاریخ: {today_str})",
        subtitle="قیمت خرید، مقدار مبنا و نرخ هر واحد مصرفی",
        headers=[
            "ردیف",
            "نام ماده اولیه",
            "واحد خرید",
            "قیمت خرید (تومان)",
            "مقدار مبنا",
            "واحد مصرف",
            "نرخ واحد مصرف (تومان)",
            "وضعیت",
            "توضیحات",
        ],
        rows=mat_rows,
        col_widths=[8, 24, 14, 20, 14, 14, 22, 12, 32],
        title_style=8,
        sub_style=9,
        header_style=10,
    )

    # Sheet 3: دفتر حساب
    total_inflow = sum(
        e["totalAmount"] for e in ledger_entries if e["entryType"] in INFLOW_TYPES
    )
    total_outflow = sum(
        e["totalAmount"] for e in ledger_entries if e["entryType"] in OUTFLOW_TYPES
    )
    ledger_rows = []
    for idx, e in enumerate(ledger_entries, start=1):
        person_label = (
            f"{e['personName']} ({PERSON_ROLE_LABELS.get(e['personRole'], 'سایر')})"
            if e["personName"]
            else "-"
        )
        j_date = to_persian_digits(e["jalaliDate"]) if digit_mode == "fa" else e["jalaliDate"]
        amt_style = (
            6
            if e["entryType"] in INFLOW_TYPES
            else 7
            if e["entryType"] in OUTFLOW_TYPES
            else 5
        )
        ledger_rows.append(
            [
                (idx, "n", 4),
                (j_date, "s", 4),
                (LEDGER_TYPE_LABELS.get(e["entryType"], e["entryType"]), "s", 4),
                (e["menuItemName"] or "-", "s", 4),
                (person_label, "s", 4),
                (e["quantity"], "n", 5),
                (e["unitPrice"], "n", 5),
                (e["totalAmount"], "n", amt_style),
                (e["description"] or "-", "s", 4),
            ]
        )

    ledger_rows.append(
        [
            ("", "s", 14),
            ("", "s", 14),
            ("جمع کل", "s", 14),
            (f"تعداد رکورد: {len(ledger_entries)}", "s", 14),
            ("", "s", 14),
            ("", "s", 14),
            ("خالص دریافت و پرداخت:", "s", 14),
            (round(total_inflow - total_outflow), "n", 15),
            ("", "s", 14),
        ]
    )

    sheet3_xml = _build_sheet_xml(
        title=f"کافه آبان — دفتر حساب دفتری (تاریخ گزارش: {today_str})",
        subtitle=(
            f"جمع دریافتی و فروش: {fmt_num(total_inflow, digit_mode)} تومان   |   "
            f"جمع پرداخت و هزینه: {fmt_num(total_outflow, digit_mode)} تومان   |   "
            f"تراز خالص: {fmt_num(total_inflow - total_outflow, digit_mode)} تومان"
        ),
        headers=[
            "ردیف",
            "تاریخ شمسی",
            "نوع ثبت",
            "آیتم",
            "فرد / طرف حساب",
            "تعداد",
            "مبلغ واحد (تومان)",
            "مبلغ کل (تومان)",
            "توضیحات",
        ],
        rows=ledger_rows,
        col_widths=[8, 16, 14, 20, 26, 10, 18, 20, 34],
        title_style=11,
        sub_style=12,
        header_style=13,
    )

    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>"""

    root_rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

    workbook_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="آیتم‌ها" sheetId="1" r:id="rId1"/>
    <sheet name="مواد اولیه" sheetId="2" r:id="rId2"/>
    <sheet name="دفتر حساب" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>"""

    workbook_rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml)
        zf.writestr("_rels/.rels", root_rels_xml)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml)
        zf.writestr("xl/styles.xml", styles_xml)
        zf.writestr("xl/worksheets/sheet1.xml", sheet1_xml)
        zf.writestr("xl/worksheets/sheet2.xml", sheet2_xml)
        zf.writestr("xl/worksheets/sheet3.xml", sheet3_xml)
    return buf.getvalue()


def export_backup_payload(conn: sqlite3.Connection) -> dict[str, Any]:
    bootstrap = get_bootstrap_data(conn)
    return {
        "app": "cafe-aban",
        "version": 1,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "data": bootstrap,
    }


def import_backup_payload(
    conn: sqlite3.Connection, raw: Any, mode: str = "replace"
) -> dict[str, int]:
    if not isinstance(raw, dict):
        raise ValueError("ساختار فایل پشتیبان نامعتبر است.")
    if raw.get("app") != "cafe-aban":
        raise ValueError("این فایل متعلق به سیستم کافه آبان نیست.")
    if raw.get("version") != 1:
        raise ValueError("نسخه فایل پشتیبان پشتیبانی نمی‌شود.")
    data = raw.get("data")
    if not isinstance(data, dict):
        raise ValueError("بخش داده‌ها در فایل پشتیبان وجود ندارد.")

    materials = data.get("materials")
    menu_items = data.get("menuItems")
    people = data.get("people")
    ledger_entries = data.get("ledgerEntries")
    settings = data.get("settings") or {}

    if (
        not isinstance(materials, list)
        or not isinstance(menu_items, list)
        or not isinstance(people, list)
        or not isinstance(ledger_entries, list)
    ):
        raise ValueError("لیست‌های اطلاعات در فایل پشتیبان ناقص یا خراب است.")

    now_iso = datetime.now(timezone.utc).isoformat()
    conn.execute("BEGIN IMMEDIATE")
    try:
        mat_id_map: dict[int, int] = {}
        item_id_map: dict[int, int] = {}
        person_id_map: dict[int, int] = {}

        if mode == "replace":
            conn.execute("DELETE FROM ledger_entries")
            conn.execute("DELETE FROM recipe_ingredients")
            conn.execute("DELETE FROM menu_items")
            conn.execute("DELETE FROM materials")
            conn.execute("DELETE FROM people")

        # 1. Materials
        for idx, m in enumerate(materials):
            if not isinstance(m, dict):
                raise ValueError(f"ماده اولیه ردیف {idx + 1} نامعتبر است.")
            name = str(m.get("name") or "").strip()
            if not name:
                raise ValueError(f"نام ماده اولیه در ردیف {idx + 1} خالی است.")
            old_id = int(m.get("id") or (idx + 1))

            if mode == "merge":
                existing = conn.execute(
                    "SELECT id FROM materials WHERE name = ?", (name,)
                ).fetchone()
                if existing is not None:
                    mat_id_map[old_id] = int(existing["id"])
                    continue

            cur = conn.execute(
                """
                INSERT INTO materials (
                    name, purchase_unit, purchase_price, base_quantity, consumption_unit,
                    conversion_factor, is_available, is_zero_cost, notes, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    name,
                    str(m.get("purchaseUnit") or "کیلوگرم"),
                    max(0.0, float(m.get("purchasePrice") or 0)),
                    max(0.0001, float(m.get("baseQuantity") or 1)),
                    str(m.get("consumptionUnit") or "گرم"),
                    max(
                        0.0001,
                        float(m.get("conversionFactor") or m.get("baseQuantity") or 1),
                    ),
                    0 if m.get("isAvailable") is False else 1,
                    1 if m.get("isZeroCost") else 0,
                    str(m.get("notes") or ""),
                    str(m.get("updatedAt") or now_iso),
                ),
            )
            mat_id_map[old_id] = int(cur.lastrowid)

        # 2. Menu items & ingredients
        for idx, item in enumerate(menu_items):
            if not isinstance(item, dict):
                raise ValueError(f"آیتم منو ردیف {idx + 1} نامعتبر است.")
            name = str(item.get("name") or "").strip()
            if not name:
                raise ValueError(f"نام آیتم منو در ردیف {idx + 1} خالی است.")
            old_id = int(item.get("id") or (idx + 1))

            if mode == "merge":
                existing = conn.execute(
                    "SELECT id FROM menu_items WHERE name = ?", (name,)
                ).fetchone()
                if existing is not None:
                    item_id_map[old_id] = int(existing["id"])
                    continue

            overhead_items = (
                item.get("overheadItems")
                if isinstance(item.get("overheadItems"), list)
                else []
            )
            cur = conn.execute(
                """
                INSERT INTO menu_items (
                    name, category, is_active, overhead_mode, overhead_fixed, overhead_percent,
                    overhead_items_json, labor_mode, labor_fixed, prep_minutes, labor_rate_per_minute,
                    profit_mode, profit_value, notes, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    name,
                    str(item.get("category") or "سایر"),
                    0 if item.get("isActive") is False else 1,
                    "percent" if item.get("overheadMode") == "percent" else "fixed",
                    max(0.0, float(item.get("overheadFixed") or 0)),
                    max(0.0, float(item.get("overheadPercent") or 0)),
                    json.dumps(overhead_items, ensure_ascii=False),
                    "timed" if item.get("laborMode") == "timed" else "fixed",
                    max(0.0, float(item.get("laborFixed") or 0)),
                    max(0.0, float(item.get("prepMinutes") or 0)),
                    max(0.0, float(item.get("laborRatePerMinute") or 0)),
                    "fixed" if item.get("profitMode") == "fixed" else "percent",
                    max(0.0, float(item.get("profitValue") or 0)),
                    str(item.get("notes") or ""),
                    str(item.get("updatedAt") or now_iso),
                ),
            )
            new_item_id = int(cur.lastrowid)
            item_id_map[old_id] = new_item_id

            for ing in item.get("ingredients") or []:
                if not isinstance(ing, dict):
                    continue
                mapped_mat = mat_id_map.get(int(ing.get("materialId") or 0))
                if mapped_mat:
                    conn.execute(
                        "INSERT INTO recipe_ingredients (menu_item_id, material_id, quantity, notes) VALUES (?, ?, ?, ?)",
                        (
                            new_item_id,
                            mapped_mat,
                            max(0.0, float(ing.get("quantity") or 0)),
                            str(ing.get("notes") or ""),
                        ),
                    )

        # 3. People
        for idx, p in enumerate(people):
            if not isinstance(p, dict):
                continue
            name = str(p.get("name") or "").strip()
            if not name:
                continue
            old_id = int(p.get("id") or (idx + 1))
            existing = conn.execute(
                "SELECT id FROM people WHERE name = ?", (name,)
            ).fetchone()
            if existing is not None:
                person_id_map[old_id] = int(existing["id"])
                continue
            role = str(p.get("role") or "other")
            if role not in VALID_PERSON_ROLES:
                role = "other"
            cur = conn.execute(
                "INSERT INTO people (name, role, phone, notes) VALUES (?, ?, ?, ?)",
                (name, role, str(p.get("phone") or ""), str(p.get("notes") or "")),
            )
            person_id_map[old_id] = int(cur.lastrowid)

        # 4. Ledger entries
        for idx, e in enumerate(ledger_entries):
            if not isinstance(e, dict):
                continue
            jalali_date = str(e.get("jalaliDate") or "").strip()
            if not jalali_date:
                raise ValueError(f"تاریخ شمسی در ردیف دفتر حساب شماره {idx + 1} خالی است.")
            entry_type = str(e.get("entryType") or "sale")
            if entry_type not in VALID_ENTRY_TYPES:
                entry_type = "sale"
            person_role = str(e.get("personRole") or "other")
            if person_role not in VALID_PERSON_ROLES:
                person_role = "other"

            old_menu_id = e.get("menuItemId")
            mapped_menu_id = (
                item_id_map.get(int(old_menu_id)) if old_menu_id is not None else None
            )
            old_person_id = e.get("personId")
            mapped_person_id = (
                person_id_map.get(int(old_person_id))
                if old_person_id is not None
                else None
            )
            person_name = str(e.get("personName") or "").strip()
            if mapped_person_id is None and person_name:
                found = conn.execute(
                    "SELECT id FROM people WHERE name = ?", (person_name,)
                ).fetchone()
                if found is not None:
                    mapped_person_id = int(found["id"])

            conn.execute(
                """
                INSERT INTO ledger_entries (
                    entry_type, menu_item_id, menu_item_name, person_id, person_name, person_role,
                    quantity, unit_price, total_amount, jalali_date, description, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry_type,
                    mapped_menu_id,
                    str(e.get("menuItemName") or ""),
                    mapped_person_id,
                    person_name,
                    person_role,
                    max(0.0, float(e.get("quantity") or 0)),
                    max(0.0, float(e.get("unitPrice") or 0)),
                    max(0.0, float(e.get("totalAmount") or 0)),
                    jalali_date,
                    str(e.get("description") or ""),
                    str(e.get("createdAt") or now_iso),
                    str(e.get("updatedAt") or now_iso),
                ),
            )

        # 5. Settings on replace
        if mode == "replace" and isinstance(settings, dict):
            dm = "en" if settings.get("digitMode") == "en" else "fa"
            lr = max(0.0, float(settings.get("defaultLaborRatePerMinute") or 3000))
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                ("digitMode", dm),
            )
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                ("defaultLaborRatePerMinute", str(int(lr) if lr.is_integer() else lr)),
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise

    return {
        "materialsCount": len(materials),
        "menuItemsCount": len(menu_items),
        "peopleCount": len(people),
        "ledgerEntriesCount": len(ledger_entries),
    }


def make_handler(conn: sqlite3.Connection, dist_dir: Path):
    class CafeAbanHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, format: str, *args: Any) -> None:
            # Quiet standard console noise on static assets
            pass

        def _send_bytes(
            self,
            status: int,
            body: bytes,
            content_type: str,
            extra_headers: dict[str, str] | None = None,
        ) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            if extra_headers:
                for k, v in extra_headers.items():
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def _send_json(self, status: int, data: Any) -> None:
            raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self._send_bytes(status, raw, "application/json; charset=utf-8")

        def _read_json_body(self) -> dict[str, Any]:
            length = int(self.headers.get("Content-Length") or "0")
            if length <= 0:
                return {}
            raw = self.rfile.read(length)
            return json.loads(raw.decode("utf-8"))

        def _serve_static(self, req_path: str) -> None:
            if not dist_dir.exists():
                msg = (
                    "پوشه خروجی رابط کاربری (dist/) پیدا نشد. "
                    "لطفاً پیش از اجرای سرور پایتون، یک‌بار دستور npm run build را اجرا کرده یا فایل کامل بسته را دریافت کنید."
                )
                self._send_bytes(
                    HTTPStatus.SERVICE_UNAVAILABLE,
                    msg.encode("utf-8"),
                    "text/plain; charset=utf-8",
                )
                return

            clean = req_path.lstrip("/")
            candidate = (dist_dir / clean).resolve()
            try:
                candidate.relative_to(dist_dir.resolve())
            except ValueError:
                self._send_json(403, {"error": "دسترسی غیرمجاز"})
                return

            if not clean or not candidate.exists() or candidate.is_dir():
                candidate = dist_dir / "index.html"

            mime, _ = mimetypes.guess_type(str(candidate))
            if str(candidate).endswith(".js"):
                mime = "application/javascript; charset=utf-8"
            elif str(candidate).endswith(".css"):
                mime = "text/css; charset=utf-8"
            elif str(candidate).endswith(".html"):
                mime = "text/html; charset=utf-8"
            elif not mime:
                mime = "application/octet-stream"

            data = candidate.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path

            if path == "/api/bootstrap":
                with DB_LOCK:
                    self._send_json(200, get_bootstrap_data(conn))
                return

            if path == "/api/backup/export":
                with DB_LOCK:
                    payload = export_backup_payload(conn)
                date_stamp = datetime.now().strftime("%Y-%m-%d")
                raw = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
                self._send_bytes(
                    200,
                    raw,
                    "application/json; charset=utf-8",
                    {
                        "Content-Disposition": f'attachment; filename="cafe-aban-backup-{date_stamp}.json"'
                    },
                )
                return

            if path.startswith("/api/"):
                self._send_json(404, {"error": "مسیر API پیدا نشد"})
                return

            self._serve_static(path)

        def do_POST(self) -> None:
            path = urllib.parse.urlparse(self.path).path
            try:
                body = self._read_json_body()
            except Exception:
                self._send_json(400, {"error": "ساختار JSON ارسالی نامعتبر است"})
                return

            if path == "/api/materials":
                name = str(body.get("name") or "").strip()
                if not name:
                    self._send_json(400, {"error": "نام ماده اولیه الزامی است"})
                    return
                now_iso = datetime.now(timezone.utc).isoformat()
                with DB_LOCK:
                    cur = conn.execute(
                        """
                        INSERT INTO materials (
                            name, purchase_unit, purchase_price, base_quantity, consumption_unit,
                            conversion_factor, is_available, is_zero_cost, notes, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            name,
                            str(body.get("purchaseUnit") or "کیلوگرم"),
                            float(body.get("purchasePrice") or 0),
                            max(0.0001, float(body.get("baseQuantity") or 1)),
                            str(body.get("consumptionUnit") or "گرم"),
                            max(
                                0.0001,
                                float(
                                    body.get("conversionFactor")
                                    or body.get("baseQuantity")
                                    or 1
                                ),
                            ),
                            0 if body.get("isAvailable") is False else 1,
                            1 if body.get("isZeroCost") else 0,
                            str(body.get("notes") or ""),
                            now_iso,
                        ),
                    )
                    conn.commit()
                    created = next(
                        (m for m in list_materials(conn) if m["id"] == int(cur.lastrowid)),
                        None,
                    )
                self._send_json(201, created)
                return

            if path == "/api/menu-items":
                name = str(body.get("name") or "").strip()
                if not name:
                    self._send_json(400, {"error": "نام آیتم الزامی است"})
                    return
                now_iso = datetime.now(timezone.utc).isoformat()
                overhead_items = (
                    body.get("overheadItems")
                    if isinstance(body.get("overheadItems"), list)
                    else []
                )
                overhead_fixed = (
                    sum(float(x.get("amount") or 0) for x in overhead_items)
                    if overhead_items
                    else float(body.get("overheadFixed") or 0)
                )
                with DB_LOCK:
                    cur = conn.execute(
                        """
                        INSERT INTO menu_items (
                            name, category, is_active, overhead_mode, overhead_fixed, overhead_percent,
                            overhead_items_json, labor_mode, labor_fixed, prep_minutes, labor_rate_per_minute,
                            profit_mode, profit_value, notes, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            name,
                            str(body.get("category") or "سایر"),
                            0 if body.get("isActive") is False else 1,
                            "percent" if body.get("overheadMode") == "percent" else "fixed",
                            overhead_fixed,
                            float(body.get("overheadPercent") or 0),
                            json.dumps(overhead_items, ensure_ascii=False),
                            "timed" if body.get("laborMode") == "timed" else "fixed",
                            float(body.get("laborFixed") or 0),
                            float(body.get("prepMinutes") or 0),
                            float(body.get("laborRatePerMinute") or 0),
                            "fixed" if body.get("profitMode") == "fixed" else "percent",
                            float(body.get("profitValue") or 0),
                            str(body.get("notes") or ""),
                            now_iso,
                        ),
                    )
                    new_id = int(cur.lastrowid)
                    for ing in body.get("ingredients") or []:
                        if isinstance(ing, dict) and ing.get("materialId"):
                            conn.execute(
                                "INSERT INTO recipe_ingredients (menu_item_id, material_id, quantity, notes) VALUES (?, ?, ?, ?)",
                                (
                                    new_id,
                                    int(ing["materialId"]),
                                    float(ing.get("quantity") or 0),
                                    str(ing.get("notes") or ""),
                                ),
                            )
                    conn.commit()
                    created = next(
                        (m for m in list_menu_items(conn) if m["id"] == new_id), None
                    )
                self._send_json(201, created)
                return

            if path == "/api/people":
                name = str(body.get("name") or "").strip()
                if not name:
                    self._send_json(400, {"error": "نام فرد الزامی است"})
                    return
                role = (
                    str(body.get("role"))
                    if body.get("role") in VALID_PERSON_ROLES
                    else "other"
                )
                with DB_LOCK:
                    existing = conn.execute(
                        "SELECT id FROM people WHERE name = ?", (name,)
                    ).fetchone()
                    if existing is not None:
                        conn.execute(
                            "UPDATE people SET role = ?, phone = ?, notes = ? WHERE id = ?",
                            (
                                role,
                                str(body.get("phone") or ""),
                                str(body.get("notes") or ""),
                                int(existing["id"]),
                            ),
                        )
                        conn.commit()
                        person = next(
                            (p for p in list_people(conn) if p["id"] == int(existing["id"])),
                            None,
                        )
                        self._send_json(200, person)
                        return
                    cur = conn.execute(
                        "INSERT INTO people (name, role, phone, notes) VALUES (?, ?, ?, ?)",
                        (
                            name,
                            role,
                            str(body.get("phone") or ""),
                            str(body.get("notes") or ""),
                        ),
                    )
                    conn.commit()
                    created = next(
                        (p for p in list_people(conn) if p["id"] == int(cur.lastrowid)),
                        None,
                    )
                self._send_json(201, created)
                return

            if path == "/api/ledger":
                jalali_date = str(body.get("jalaliDate") or "").strip()
                if not jalali_date:
                    self._send_json(400, {"error": "تاریخ شمسی الزامی است"})
                    return
                entry_type = (
                    str(body.get("entryType"))
                    if body.get("entryType") in VALID_ENTRY_TYPES
                    else "sale"
                )
                person_role = (
                    str(body.get("personRole"))
                    if body.get("personRole") in VALID_PERSON_ROLES
                    else "other"
                )
                person_name = str(body.get("personName") or "").strip()
                person_id = int(body["personId"]) if body.get("personId") else None
                now_iso = datetime.now(timezone.utc).isoformat()

                with DB_LOCK:
                    if not person_id and person_name:
                        found = conn.execute(
                            "SELECT id FROM people WHERE name = ?", (person_name,)
                        ).fetchone()
                        if found is not None:
                            person_id = int(found["id"])
                        elif body.get("savePerson") is not False:
                            p_cur = conn.execute(
                                "INSERT INTO people (name, role, phone, notes) VALUES (?, ?, ?, ?)",
                                (person_name, person_role, "", ""),
                            )
                            person_id = int(p_cur.lastrowid)

                    cur = conn.execute(
                        """
                        INSERT INTO ledger_entries (
                            entry_type, menu_item_id, menu_item_name, person_id, person_name, person_role,
                            quantity, unit_price, total_amount, jalali_date, description, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            entry_type,
                            int(body["menuItemId"]) if body.get("menuItemId") else None,
                            str(body.get("menuItemName") or ""),
                            person_id,
                            person_name,
                            person_role,
                            max(0.0, float(body.get("quantity") or 0)),
                            max(0.0, float(body.get("unitPrice") or 0)),
                            max(0.0, float(body.get("totalAmount") or 0)),
                            jalali_date,
                            str(body.get("description") or ""),
                            now_iso,
                            now_iso,
                        ),
                    )
                    conn.commit()
                    created = next(
                        (
                            e
                            for e in list_ledger_entries(conn)
                            if e["id"] == int(cur.lastrowid)
                        ),
                        None,
                    )
                    people = list_people(conn)
                self._send_json(201, {"entry": created, "people": people})
                return

            if path == "/api/export/excel":
                digit_mode = "en" if body.get("digitMode") == "en" else "fa"
                entry_ids = (
                    {int(x) for x in body["ledgerIds"]}
                    if isinstance(body.get("ledgerIds"), list)
                    else None
                )
                with DB_LOCK:
                    materials = list_materials(conn)
                    menu_items = list_menu_items(conn)
                    ledger_entries = list_ledger_entries(conn)
                if entry_ids is not None:
                    ledger_entries = [e for e in ledger_entries if e["id"] in entry_ids]
                xlsx_bytes = generate_excel_bytes(
                    materials=materials,
                    menu_items=menu_items,
                    ledger_entries=ledger_entries,
                    digit_mode=digit_mode,
                )
                self._send_bytes(
                    200,
                    xlsx_bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    {"Content-Disposition": 'attachment; filename="cafe-aban-report.xlsx"'},
                )
                return

            if path == "/api/backup/import":
                mode = "merge" if body.get("mode") == "merge" else "replace"
                try:
                    with DB_LOCK:
                        summary = import_backup_payload(
                            conn, body.get("backup"), mode=mode
                        )
                        bootstrap = get_bootstrap_data(conn)
                    self._send_json(
                        200, {"ok": True, "summary": summary, "bootstrap": bootstrap}
                    )
                except ValueError as err:
                    self._send_json(400, {"error": str(err)})
                except Exception as err:
                    self._send_json(500, {"error": f"خطا در وارد کردن فایل پشتیبان: {err}"})
                return

            self._send_json(404, {"error": "مسیر پیدا نشد"})

        def do_PATCH(self) -> None:
            path = urllib.parse.urlparse(self.path).path
            if path != "/api/settings":
                self._send_json(404, {"error": "مسیر پیدا نشد"})
                return
            try:
                body = self._read_json_body()
            except Exception:
                self._send_json(400, {"error": "ساختار JSON نامعتبر است"})
                return
            with DB_LOCK:
                dm = body.get("digitMode")
                if dm in ("fa", "en"):
                    conn.execute(
                        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                        ("digitMode", dm),
                    )
                rate = body.get("defaultLaborRatePerMinute")
                if isinstance(rate, (int, float)) and rate >= 0:
                    conn.execute(
                        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                        ("defaultLaborRatePerMinute", str(rate)),
                    )
                conn.commit()
                settings = get_settings(conn)
            self._send_json(200, settings)

        def do_PUT(self) -> None:
            path = urllib.parse.urlparse(self.path).path
            try:
                body = self._read_json_body()
            except Exception:
                self._send_json(400, {"error": "ساختار JSON نامعتبر است"})
                return

            m_mat = re.fullmatch(r"/api/materials/(\d+)", path)
            if m_mat:
                item_id = int(m_mat.group(1))
                name = str(body.get("name") or "").strip()
                if not name:
                    self._send_json(400, {"error": "نام ماده اولیه الزامی است"})
                    return
                now_iso = datetime.now(timezone.utc).isoformat()
                with DB_LOCK:
                    conn.execute(
                        """
                        UPDATE materials SET
                            name = ?, purchase_unit = ?, purchase_price = ?, base_quantity = ?,
                            consumption_unit = ?, conversion_factor = ?, is_available = ?,
                            is_zero_cost = ?, notes = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (
                            name,
                            str(body.get("purchaseUnit") or "کیلوگرم"),
                            float(body.get("purchasePrice") or 0),
                            max(0.0001, float(body.get("baseQuantity") or 1)),
                            str(body.get("consumptionUnit") or "گرم"),
                            max(
                                0.0001,
                                float(
                                    body.get("conversionFactor")
                                    or body.get("baseQuantity")
                                    or 1
                                ),
                            ),
                            0 if body.get("isAvailable") is False else 1,
                            1 if body.get("isZeroCost") else 0,
                            str(body.get("notes") or ""),
                            now_iso,
                            item_id,
                        ),
                    )
                    conn.commit()
                    updated = next(
                        (m for m in list_materials(conn) if m["id"] == item_id), None
                    )
                if not updated:
                    self._send_json(404, {"error": "ماده اولیه پیدا نشد"})
                    return
                self._send_json(200, updated)
                return

            m_item = re.fullmatch(r"/api/menu-items/(\d+)", path)
            if m_item:
                item_id = int(m_item.group(1))
                name = str(body.get("name") or "").strip()
                if not name:
                    self._send_json(400, {"error": "نام آیتم الزامی است"})
                    return
                now_iso = datetime.now(timezone.utc).isoformat()
                overhead_items = (
                    body.get("overheadItems")
                    if isinstance(body.get("overheadItems"), list)
                    else []
                )
                overhead_fixed = (
                    sum(float(x.get("amount") or 0) for x in overhead_items)
                    if overhead_items
                    else float(body.get("overheadFixed") or 0)
                )
                with DB_LOCK:
                    conn.execute(
                        """
                        UPDATE menu_items SET
                            name = ?, category = ?, is_active = ?, overhead_mode = ?, overhead_fixed = ?,
                            overhead_percent = ?, overhead_items_json = ?, labor_mode = ?, labor_fixed = ?,
                            prep_minutes = ?, labor_rate_per_minute = ?, profit_mode = ?, profit_value = ?,
                            notes = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (
                            name,
                            str(body.get("category") or "سایر"),
                            0 if body.get("isActive") is False else 1,
                            "percent" if body.get("overheadMode") == "percent" else "fixed",
                            overhead_fixed,
                            float(body.get("overheadPercent") or 0),
                            json.dumps(overhead_items, ensure_ascii=False),
                            "timed" if body.get("laborMode") == "timed" else "fixed",
                            float(body.get("laborFixed") or 0),
                            float(body.get("prepMinutes") or 0),
                            float(body.get("laborRatePerMinute") or 0),
                            "fixed" if body.get("profitMode") == "fixed" else "percent",
                            float(body.get("profitValue") or 0),
                            str(body.get("notes") or ""),
                            now_iso,
                            item_id,
                        ),
                    )
                    if isinstance(body.get("ingredients"), list):
                        conn.execute(
                            "DELETE FROM recipe_ingredients WHERE menu_item_id = ?",
                            (item_id,),
                        )
                        for ing in body["ingredients"]:
                            if isinstance(ing, dict) and ing.get("materialId"):
                                conn.execute(
                                    "INSERT INTO recipe_ingredients (menu_item_id, material_id, quantity, notes) VALUES (?, ?, ?, ?)",
                                    (
                                        item_id,
                                        int(ing["materialId"]),
                                        float(ing.get("quantity") or 0),
                                        str(ing.get("notes") or ""),
                                    ),
                                )
                    conn.commit()
                    updated = next(
                        (m for m in list_menu_items(conn) if m["id"] == item_id), None
                    )
                if not updated:
                    self._send_json(404, {"error": "آیتم منو پیدا نشد"})
                    return
                self._send_json(200, updated)
                return

            m_ledger = re.fullmatch(r"/api/ledger/(\d+)", path)
            if m_ledger:
                entry_id = int(m_ledger.group(1))
                jalali_date = str(body.get("jalaliDate") or "").strip()
                if not jalali_date:
                    self._send_json(400, {"error": "تاریخ شمسی الزامی است"})
                    return
                entry_type = (
                    str(body.get("entryType"))
                    if body.get("entryType") in VALID_ENTRY_TYPES
                    else "sale"
                )
                person_role = (
                    str(body.get("personRole"))
                    if body.get("personRole") in VALID_PERSON_ROLES
                    else "other"
                )
                person_name = str(body.get("personName") or "").strip()
                person_id = int(body["personId"]) if body.get("personId") else None
                now_iso = datetime.now(timezone.utc).isoformat()

                with DB_LOCK:
                    if not person_id and person_name:
                        found = conn.execute(
                            "SELECT id FROM people WHERE name = ?", (person_name,)
                        ).fetchone()
                        if found is not None:
                            person_id = int(found["id"])
                        elif body.get("savePerson") is not False:
                            p_cur = conn.execute(
                                "INSERT INTO people (name, role, phone, notes) VALUES (?, ?, ?, ?)",
                                (person_name, person_role, "", ""),
                            )
                            person_id = int(p_cur.lastrowid)

                    conn.execute(
                        """
                        UPDATE ledger_entries SET
                            entry_type = ?, menu_item_id = ?, menu_item_name = ?, person_id = ?,
                            person_name = ?, person_role = ?, quantity = ?, unit_price = ?,
                            total_amount = ?, jalali_date = ?, description = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (
                            entry_type,
                            int(body["menuItemId"]) if body.get("menuItemId") else None,
                            str(body.get("menuItemName") or ""),
                            person_id,
                            person_name,
                            person_role,
                            max(0.0, float(body.get("quantity") or 0)),
                            max(0.0, float(body.get("unitPrice") or 0)),
                            max(0.0, float(body.get("totalAmount") or 0)),
                            jalali_date,
                            str(body.get("description") or ""),
                            now_iso,
                            entry_id,
                        ),
                    )
                    conn.commit()
                    updated = next(
                        (e for e in list_ledger_entries(conn) if e["id"] == entry_id),
                        None,
                    )
                    people = list_people(conn)
                if not updated:
                    self._send_json(404, {"error": "رکورد دفتر حساب پیدا نشد"})
                    return
                self._send_json(200, {"entry": updated, "people": people})
                return

            self._send_json(404, {"error": "مسیر پیدا نشد"})

        def do_DELETE(self) -> None:
            path = urllib.parse.urlparse(self.path).path
            for pattern, table in (
                (r"/api/materials/(\d+)", "materials"),
                (r"/api/menu-items/(\d+)", "menu_items"),
                (r"/api/people/(\d+)", "people"),
                (r"/api/ledger/(\d+)", "ledger_entries"),
            ):
                m = re.fullmatch(pattern, path)
                if m:
                    row_id = int(m.group(1))
                    with DB_LOCK:
                        conn.execute(f"DELETE FROM {table} WHERE id = ?", (row_id,))
                        conn.commit()
                    self._send_json(200, {"ok": True})
                    return
            self._send_json(404, {"error": "مسیر پیدا نشد"})

    return CafeAbanHandler


def pick_available_port(preferred: int = 3000) -> int:
    for port in range(preferred, preferred + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return preferred


def main() -> None:
    parser = argparse.ArgumentParser(description="Cafe Aban Pure-Python Local Server")
    parser.add_argument("--port", type=int, default=3000)
    parser.add_argument("--db", type=str, default=str(DEFAULT_DB_PATH))
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    db_path = Path(args.db)
    conn = get_db_connection(db_path)
    port = pick_available_port(args.port)
    ui_dir = resolve_ui_dir()
    handler = make_handler(conn, ui_dir)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    url = f"http://127.0.0.1:{port}"

    print("=" * 56)
    print("  کافه آبان — نسخه لوکال مستقل (بدون نیاز به Node.js)")
    print("=" * 56)
    print(f"  آدرس برنامه : {url}")
    print(f"  مسیر دیتابیس : {db_path}")
    print("  برای بستن برنامه، این پنجره را ببندید یا Ctrl+C بزنید.")
    print("=" * 56)

    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    def shutdown_handler(_signum: int, _frame: Any) -> None:
        print("\nدر حال ذخیره نهایی و بستن سرور کافه آبان...")
        try:
            conn.commit()
            conn.close()
        except Exception:
            pass
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        conn.commit()
        conn.close()


if __name__ == "__main__":
    main()
