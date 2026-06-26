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
    offline: 'You are offline — showing last loaded data.',

    expired_note: 'This subscription has expired. Contact support to renew.',
    limited_note: 'Data limit reached. Traffic is paused until reset or upgrade.',
    disabled_note: 'This subscription is disabled. Contact support.',
    on_hold_note: 'This subscription is on hold and not yet started.',
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
    offline: 'اتصال قطع است — آخرین داده‌های بارگذاری‌شده نمایش داده می‌شود.',

    expired_note: 'این اشتراک منقضی شده است. برای تمدید با پشتیبانی تماس بگیرید.',
    limited_note: 'حجم به پایان رسیده است. ترافیک تا بازنشانی یا ارتقا متوقف است.',
    disabled_note: 'این اشتراک غیرفعال است. با پشتیبانی تماس بگیرید.',
    on_hold_note: 'این اشتراک در حالت انتظار است و هنوز شروع نشده.',
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
