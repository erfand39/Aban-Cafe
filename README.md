<div align="center">
  <img src="assets/aban-cafe-banner.svg" alt="بنر اختصاصی کافه آبان با هویت بصری قهوه‌ای و معرفی سامانه مدیریت کافه" width="100%" />

  <h1>کافه آبان | Aban Café</h1>
  <p><strong>از دستور تهیه تا قیمت فروش؛ مدیریت دقیق‌تر، ساده‌تر و شفاف‌تر برای کافه</strong></p>

  <p>
    <a href="#معرفی">معرفی</a> ·
    <a href="#قابلیتها">قابلیت‌ها</a> ·
    <a href="#شروع-سریع">شروع سریع</a> ·
    <a href="#معماری">معماری</a> ·
    <a href="#امنیت-و-نگهداری-اطلاعات">امنیت اطلاعات</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Interface-Persian%20%7C%20RTL-8B5E3C?style=flat-square" alt="رابط فارسی راست‌چین" />
    <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=flat-square&logo=react&logoColor=20232A" alt="React 19" />
    <img src="https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Database-SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
    <img src="https://img.shields.io/badge/Local%20Server-Python%203-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python 3" />
    <img src="https://img.shields.io/badge/Design-Cafe%20Inspired-C99465?style=flat-square" alt="طراحی الهام‌گرفته از فضای کافه" />
  </p>
</div>

---

## معرفی

**کافه آبان** یک ابزار سبک و محلی برای مدیریت قیمت‌گذاری منو و ثبت رویدادهای مالی روزمره کافه است. هدف آن این است که قیمت هر آیتم صرفاً بر اساس حدس تعیین نشود؛ بلکه بهای مواد مصرفی، هزینه‌های جانبی، زمان آماده‌سازی و سود مورد انتظار در محاسبه قیمت نهایی دیده شوند.

این سامانه با رابط فارسی و راست‌چین طراحی شده و اطلاعات را در پایگاه داده SQLite روی همان دستگاه نگهداری می‌کند. برای اجرای نسخه مستقل، به نصب Node.js یا پکیج‌های جانبی Python نیاز نیست؛ Python 3 کافی است.

> **دو فضای کاری، یک جریان ساده:** قیمت‌گذاری منو برای شناخت هزینه واقعی هر محصول و دفتر حساب برای ثبت دریافت‌ها و پرداخت‌های روزمره.

## قابلیت‌ها

<table>
  <tr>
    <td width="50%">
      <h3>☕ قیمت‌گذاری هوشمند منو</h3>
      <p>ساخت آیتم‌های منو و تعریف دستور تهیه با مقدار دقیق مصرف هر ماده اولیه؛ محاسبه خودکار بهای تمام‌شده و قیمت پیشنهادی فروش.</p>
    </td>
    <td width="50%">
      <h3>📦 مدیریت مواد اولیه</h3>
      <p>ثبت واحد خرید، مبلغ خرید، مقدار مبنا و واحد مصرف؛ محاسبه هزینه هر گرم، میلی‌لیتر یا واحد مصرف بر اساس اطلاعات ثبت‌شده.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h3>🧾 هزینه‌های جانبی و دستمزد</h3>
      <p>ثبت سربار به‌صورت ثابت، درصدی یا ریزهزینه؛ محاسبه دستمزد ثابت یا بر اساس زمان آماده‌سازی و نرخ هر دقیقه.</p>
    </td>
    <td>
      <h3>📒 دفتر حساب دفتری</h3>
      <p>ثبت فروش، دریافت، پرداخت، هزینه و یادداشت‌های آزاد؛ اتصال اختیاری رکوردها به آیتم منو و اشخاص.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h3>📊 تحلیل عملکرد</h3>
      <p>نمایش روندهای روزانه و ماهانه، جمع‌بندی سود و زیان و آیتم‌های پرفروش بر اساس اطلاعات ثبت‌شده.</p>
    </td>
    <td>
      <h3>📤 خروجی و پشتیبان‌گیری</h3>
      <p>دریافت گزارش Excel و PDF و تهیه یا بازیابی نسخه پشتیبان اطلاعات برای نگهداری و انتقال داده‌ها.</p>
    </td>
  </tr>
</table>

### جزئیات محاسبه قیمت

محاسبات قیمت‌گذاری از اجزای زیر تشکیل می‌شوند:

| مؤلفه | منطق محاسبه |
|---|---|
| هزینه واحد ماده اولیه | مبلغ خرید ÷ مقدار مبنا |
| هزینه هر ماده در دستور تهیه | هزینه واحد × مقدار مصرف |
| بهای مواد اولیه | مجموع هزینه مواد مصرف‌شده |
| سربار | مبلغ ثابت، مجموع ریزهزینه‌ها یا درصدی از مواد اولیه |
| دستمزد | مبلغ ثابت یا زمان آماده‌سازی × نرخ هر دقیقه |
| سود | مبلغ ثابت یا درصدی از بهای تمام‌شده |
| قیمت پیشنهادی فروش | بهای تمام‌شده + سود |

برای نمونه، در تعریف یک شات اسپرسو می‌توان قیمت خرید قهوه و مقدار مصرف هر شات را ثبت کرد. در نوشیدنی ترکیبی نیز هر جزء، مانند قهوه، شیر و پودر، به‌صورت مستقل در دستور تهیه قرار می‌گیرد تا سهم هرکدام در هزینه نهایی مشخص باشد.

### دفتر حساب؛ ساده و کاربردی

دفتر حساب برای ثبت و مرور حساب‌وکتاب روزمره طراحی شده است؛ نه به‌عنوان یک نرم‌افزار حسابداری رسمی یا سیستم حسابداری دوطرفه. ثبت‌های آن می‌توانند به مشتری، تأمین‌کننده، پرسنل یا آیتم منو مرتبط شوند.

## تجربه کاربری

- رابط فارسی و راست‌چین با تایپوگرافی Vazirmatn
- تقویم و نمایش تاریخ شمسی
- نمایش اعداد فارسی یا انگلیسی با جداکننده هزارگان
- حالت روشن و تاریک
- چیدمان واکنش‌گرا برای نمایشگرهای مختلف
- ذخیره محلی تنظیمات و داده‌های برنامه

## شروع سریع

### پیش‌نیاز

- Python 3
- دریافت کامل فایل‌های مخزن، شامل پوشه رابط کاربری ساخته‌شده <code>local_ui</code>

نسخه مستقل از کتابخانه استاندارد Python استفاده می‌کند و نیازی به نصب پکیج با pip ندارد.

### macOS

از ترمینال، در پوشه پروژه اجرا کنید:

~~~bash
chmod +x Start-Cafe-Aban.command
./Start-Cafe-Aban.command
~~~

### Windows

فایل <code>Start-Cafe-Aban.bat</code> را اجرا کنید. اگر Python 3 نصب نباشد، راهنمای نصب در پنجره اجرا نمایش داده می‌شود.

### اجرای مستقیم سرور Python

در صورت تمایل می‌توانید سرور را مستقیماً اجرا کنید:

~~~bash
python3 cafe_aban_server.py
~~~

در Windows، در صورت نیاز دستور را با <code>python</code> اجرا کنید. سرور آدرس محلی را در ترمینال نمایش می‌دهد و در حالت پیش‌فرض مرورگر را باز می‌کند.

## اجرای محیط توسعه

برای توسعه رابط React و سرور TypeScript به Node.js و npm نیاز دارید:

~~~bash
npm install
npm run dev
~~~

دستورهای اصلی پروژه:

| دستور | کاربرد |
|---|---|
| <code>npm run dev</code> | اجرای محیط توسعه |
| <code>npm run build</code> | ساخت خروجی رابط کاربری و آماده‌سازی پوشه محلی |
| <code>npm run preview</code> | پیش‌نمایش خروجی Vite |
| <code>npm run lint</code> | بررسی TypeScript با tsc |

## معماری

ساختار کلی سامانه بر پایه رابط React، سرور محلی و پایگاه داده SQLite است:

~~~mermaid
flowchart TD
    A["رابط کاربری فارسی<br/>React + TypeScript"] --> B["API محلی"]
    B --> C["SQLite<br/>data/cafe-aban.db"]
    A --> D["محاسبات قیمت‌گذاری"]
    D --> B
    B --> E["گزارش Excel / PDF"]
    B --> F["پشتیبان‌گیری و بازیابی"]
~~~

### اجزای اصلی مخزن

| مسیر | مسئولیت |
|---|---|
| <code>src/App.tsx</code> | پوسته برنامه، ناوبری و مدیریت وضعیت کلی |
| <code>src/components/</code> | صفحات قیمت‌گذاری، دفتر حساب و اجزای رابط کاربری |
| <code>src/shared/pricing.ts</code> | منطق محاسبه بهای تمام‌شده و قیمت فروش |
| <code>src/shared/analytics.ts</code> | محاسبات و تحلیل داده‌های عملکرد |
| <code>src/shared/jalali.ts</code> | توابع تاریخ شمسی |
| <code>src/shared/backup.ts</code> | اعتبارسنجی، خروجی و بازیابی پشتیبان |
| <code>server/</code> | لایه پایگاه داده، پشتیبان‌گیری و خروجی Excel |
| <code>cafe_aban_server.py</code> | سرور مستقل مبتنی بر کتابخانه استاندارد Python |
| <code>init_cafe_aban_db.py</code> | ایجاد ساختار پایگاه داده SQLite |
| <code>local_ui/</code> | خروجی ساخته‌شده رابط کاربری |
| <code>data/</code> | محل نگهداری پایگاه داده محلی |

## امنیت و نگهداری اطلاعات

- اطلاعات عملیاتی نسخه مستقل در پایگاه داده SQLite محلی ذخیره می‌شوند.
- از قابلیت پشتیبان‌گیری برنامه به‌صورت دوره‌ای استفاده کنید و فایل پشتیبان را در محل امن دیگری نگهداری کنید.
- فایل پایگاه داده یا نسخه پشتیبان حاوی اطلاعات واقعی مشتریان، کارکنان یا مبالغ مالی را در مخزن عمومی GitHub منتشر نکنید.
- پیش از انتقال برنامه به دستگاه دیگر، از اطلاعات نسخه پشتیبان تهیه کنید.

## فناوری‌ها

<div align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=20232A" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white" alt="Express" />
</div>

## مشارکت و گزارش مشکل

برای پیشنهاد قابلیت جدید یا گزارش ایراد، از بخش [Issues](https://github.com/erfand39/Aban-Cafe/issues) استفاده کنید. لطفاً هنگام گزارش خطا، مراحل بازتولید، نتیجه مورد انتظار و نتیجه مشاهده‌شده را بنویسید و از پیوست‌کردن اطلاعات شخصی یا فایل پایگاه داده واقعی خودداری کنید.

---

<div align="center">
  <strong>کافه آبان</strong>
  <br />
  <sub>مدیریت دقیق‌تر پشت هر فنجان؛ از هزینه مواد اولیه تا قیمت نهایی.</sub>
  <br /><br />
  <a href="https://github.com/erfand39/Aban-Cafe">GitHub Repository</a>
</div>

---

## English

**Aban Café** is a Persian-first, local café management tool focused on recipe-based menu costing and a lightweight daily ledger.

### Highlights

- Ingredient and recipe management with unit-cost calculations
- Menu pricing based on ingredients, overhead, labor, and profit
- Simple daily ledger for sales, receipts, payments, and expenses
- Daily and monthly analytics
- Excel and PDF exports
- Local SQLite storage with backup and restore
- Persian RTL interface, Jalali calendar, and light/dark themes
- Standalone Python 3 server for local operation

### Quick start

1. Install Python 3.
2. Download or clone the complete repository.
3. On macOS, run <code>Start-Cafe-Aban.command</code> (make it executable first if needed).
4. On Windows, run <code>Start-Cafe-Aban.bat</code>.

The standalone Python server uses only the Python standard library. No Node.js or pip packages are required for this mode.

For development, use <code>npm install</code> followed by <code>npm run dev</code>.
