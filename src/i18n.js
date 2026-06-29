// Translation dictionaries for Vortex. English (Exo 2) + فارسی (Arad, RTL).
// Keep keys flat and stable — index.html references them via `data-i18n`.

export const STRINGS = {
  en: {
    dir: 'ltr',
    brand_sub: 'Subscription',
    tagline: 'Your connection, decoded.',

    status_active: 'Active',
    status_limited: 'Data limit reached',
    status_expired: 'Expired',
    status_disabled: 'Disabled',
    status_on_hold: 'On hold',
    status_unknown: 'Unknown',

    data_usage: 'Data usage',
    time_left: 'Time left',
    used: 'Used',
    total: 'Total',
    remaining: 'Remaining',
    expires: 'Expires',
    last_day: 'Last day',
    never: 'Never',
    unlimited: 'Unlimited',
    days_unit: 'days',
    day_unit: 'day',

    reset_label: 'Quota resets in',
    reset_no: 'No quota reset',
    reset_daily: 'Resets daily',
    reset_weekly: 'Resets weekly',
    reset_monthly: 'Resets monthly',
    reset_yearly: 'Resets yearly',

    configs: 'Configs',
    config: 'config',
    configs_plural: 'configs',
    copy: 'Copy',
    copied: 'Copied!',
    copy_all: 'Copy all',
    show_qr: 'QR',
    sub_link: 'Subscription link',
    sub_qr: 'Sub QR',
    scan_to_import: 'Scan to import',
    no_configs: 'No configs available yet.',

    apps: 'Apps',
    import_app: 'Import',
    download_app: 'Get app',
    pick_client: 'Pick a client, import in one tap.',

    support: 'Support',
    usage: 'Usage',
    usage_history: 'Usage history',
    loading_apps: 'Loading apps…',
    today: 'Today',
    yesterday: 'Yesterday',
    offline: 'You are offline — showing last loaded data.',

    expired_note: 'This subscription has expired. Contact support to renew.',
    limited_note: 'Data limit reached. Traffic is paused until reset or upgrade.',
    disabled_note: 'This subscription is disabled. Contact support.',
    on_hold_note: 'This subscription is on hold and not yet started.',

    // v1.3.0 — usage alerts (localized thresholds)
    usage_alert_50: '50% data used',
    usage_alert_80: '80% data used',
    usage_alert_90: '90% data used — limit reached soon',
    no_usage_data: 'No usage data yet',
    last_updated: 'Last updated',
    usage_on: 'on',

    // v1.3.0 — config tools (search / sort / export / selection)
    search_configs: 'Search configs…',
    filter_all: 'All',
    export_label: 'Export',
    export_done: 'Configs exported',
    select_label: 'Select',
    select_done: 'Done',
    copy_selected: 'Copy selected',
    selected_suffix: 'selected',
    no_match: 'No configs match your search.',

    // v1.3.0 — connection quality
    conn_checking: 'Checking connection…',
    conn_good: 'Good connection',
    conn_ok: 'Fair connection',
    conn_poor: 'Poor connection',
    conn_offline: 'No connection',

    // v1.3.0 — QR + error boundary
    qr_too_long: 'Link too long for a QR code — use Copy instead.',
    error_title: 'Something went wrong',
    error_msg: 'The page failed to load fully. Please refresh to try again.',
    external_link: 'Opens in a new tab',

    // v1.4.0 — usage transparency + config grouping
    usage_by_server: 'By server',
    forecast_deplete: 'At this rate, data runs out',
    forecast_expire_first: 'Your plan expires before your data runs out',
    group_label: 'Group',
    group_aria: 'Group by country',
    country_other: 'Other',

    // v1.4.2 — notification opt-in + threshold alerts
    notify_enable_body: 'Enable alerts for data usage and expiry?',
    notify_enable_btn: 'Enable',
    notify_dismiss_btn: 'Not now',
    notify_data_50: "You've used 50% of your data.",
    notify_data_70: "You've used 70% of your data.",
    notify_data_90: '90% of your data used — running low.',
    notify_time_3: 'Only 3 days left before your subscription expires.',
    notify_time_1: 'Last day — your subscription expires within 24 hours.',
  },
  fa: {
    dir: 'rtl',
    brand_sub: 'اشتراک',
    tagline: 'اتصال شما، رمزگشایی‌شده.',

    status_active: 'فعال',
    status_limited: 'پایان حجم',
    status_expired: 'منقضی‌شده',
    status_disabled: 'غیرفعال',
    status_on_hold: 'در انتظار',
    status_unknown: 'نامشخص',

    data_usage: 'مصرف حجم',
    time_left: 'زمان باقی‌مانده',
    used: 'مصرف‌شده',
    total: 'کل',
    remaining: 'باقی‌مانده',
    expires: 'انقضا',
    last_day: 'آخرین روز',
    never: 'هرگز',
    unlimited: 'نامحدود',
    days_unit: 'روز',
    day_unit: 'روز',

    reset_label: 'بازنشانی حجم تا',
    reset_no: 'بدون بازنشانی حجم',
    reset_daily: 'بازنشانی روزانه',
    reset_weekly: 'بازنشانی هفتگی',
    reset_monthly: 'بازنشانی ماهانه',
    reset_yearly: 'بازنشانی سالانه',

    configs: 'کانفیگ‌ها',
    config: 'کانفیگ',
    configs_plural: 'کانفیگ',
    copy: 'کپی',
    copied: 'کپی شد!',
    copy_all: 'کپی همه',
    show_qr: 'کیو‌آر',
    sub_link: 'لینک اشتراک',
    sub_qr: 'کیو‌آر اشتراک',
    scan_to_import: 'برای افزودن اسکن کنید',
    no_configs: 'هنوز کانفیگی موجود نیست.',

    apps: 'برنامه‌ها',
    import_app: 'افزودن',
    download_app: 'دریافت',
    pick_client: 'یک برنامه انتخاب و با یک لمس اضافه کنید.',

    support: 'پشتیبانی',
    usage: 'مصرف',
    usage_history: 'تاریخچه مصرف',
    loading_apps: 'بارگیری برنامه‌ها…',
    today: 'امروز',
    yesterday: 'دیروز',
    offline: 'اتصال قطع است — آخرین داده‌های بارگذاری‌شده نمایش داده می‌شود.',

    expired_note: 'این اشتراک منقضی شده است. برای تمدید با پشتیبانی تماس بگیرید.',
    limited_note: 'حجم به پایان رسیده است. ترافیک تا بازنشانی یا ارتقا متوقف است.',
    disabled_note: 'این اشتراک غیرفعال است. با پشتیبانی تماس بگیرید.',
    on_hold_note: 'این اشتراک در حالت انتظار است و هنوز شروع نشده.',

    // v1.3.0 — usage alerts (localized thresholds)
    usage_alert_50: '۵۰٪ حجم مصرف شده',
    usage_alert_80: '۸۰٪ حجم مصرف شده',
    usage_alert_90: '۹۰٪ حجم مصرف شده — به‌زودی به سقف می‌رسید',
    no_usage_data: 'هنوز داده مصرفی ثبت نشده',
    last_updated: 'آخرین بروزرسانی',
    usage_on: 'در',

    // v1.3.0 — config tools (search / sort / export / selection)
    search_configs: 'جست‌وجوی کانفیگ‌ها…',
    filter_all: 'همه',
    export_label: 'خروجی',
    export_done: 'کانفیگ‌ها ذخیره شد',
    select_label: 'انتخاب',
    select_done: 'پایان',
    copy_selected: 'کپی انتخاب‌شده‌ها',
    selected_suffix: 'انتخاب‌شده',
    no_match: 'کانفیگی با جست‌وجوی شما مطابقت ندارد.',

    // v1.3.0 — connection quality
    conn_checking: 'بررسی اتصال…',
    conn_good: 'اتصال خوب',
    conn_ok: 'اتصال متوسط',
    conn_poor: 'اتصال ضعیف',
    conn_offline: 'بدون اتصال',

    // v1.3.0 — QR + error boundary
    qr_too_long: 'لینک برای کد QR بسیار بلند است — از کپی استفاده کنید.',
    error_title: 'مشکلی پیش آمد',
    error_msg: 'صفحه به‌طور کامل بارگذاری نشد. لطفاً صفحه را تازه‌سازی کنید.',
    external_link: 'در تب جدید باز می‌شود',

    // v1.4.0 — usage transparency + config grouping
    usage_by_server: 'به تفکیک سرور',
    forecast_deplete: 'با این روند، حجم تمام می‌شود',
    forecast_expire_first: 'اشتراک شما زودتر از حجم به پایان می‌رسد',
    group_label: 'گروه',
    group_aria: 'گروه‌بندی بر اساس کشور',
    country_other: 'سایر',

    // v1.4.2 — notification opt-in + threshold alerts
    notify_enable_body: 'هشدارهای مصرف حجم و انقضا فعال شوند؟',
    notify_enable_btn: 'فعال‌سازی',
    notify_dismiss_btn: 'بعداً',
    notify_data_50: '۵۰٪ از حجم اشتراکت مصرف شده.',
    notify_data_70: '۷۰٪ از حجم اشتراکت مصرف شده.',
    notify_data_90: '۹۰٪ حجم مصرف شده — رو به اتمام.',
    notify_time_3: 'فقط ۳ روز تا پایان اشتراکت باقی مانده.',
    notify_time_1: 'آخرین روز — اشتراکت تا کمتر از ۲۴ ساعت دیگر تمام می‌شود.',
  },
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/** Convert Latin digits in a string to Persian digits (for lang === 'fa'). */
export function toFaDigits(str) {
  return String(str).replace(/[0-9]/g, (d) => FA_DIGITS[+d])
}

/** Localize a number/string per language (Persian digits when fa). */
export function locNum(value, lang) {
  return lang === 'fa' ? toFaDigits(value) : String(value)
}

/** Convert a Gregorian Date to Jalali { y, m, d }. Lightweight, no external deps. */
export function toJalali(date) {
  const gy = date.getFullYear()
  const gm = date.getMonth() + 1
  const gd = date.getDate()
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  let gy2 = gm > 2 ? gy + 1 : gy
  let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1]
  let jy = -1595 + 33 * Math.floor(days / 12053)
  days %= 12053
  jy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    jy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30)
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30)
  return { y: jy, m: jm, d: jd }
}

/** Format a date in the user's locale, with Jalali for Persian. */
export function fmtDate(date, lang, opts = {}) {
  if (lang === 'fa') {
    const j = toJalali(date)
    const pad = (n) => String(n).padStart(2, '0')
    const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
    if (opts.month === 'short') return `${j.d} ${months[j.m - 1]}`
    return `${j.y}/${pad(j.m)}/${pad(j.d)}`
  }
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}
