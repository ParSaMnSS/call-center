// All UI strings in Farsi, centralized for easy editing / future i18n.
export const t = {
  appName: "تحلیل تماس‌های مرکز تماس",
  appShort: "تحلیلگر تماس",

  // Nav
  navDashboard: "داشبورد",
  navSummary: "خلاصه",
  navUpload: "بارگذاری تماس",
  navLogout: "خروج",

  // Summary page
  summaryTitle: "خلاصه گروهی",
  summarySubtitle: "نمای کلی تماس‌ها در بازه انتخابی",
  rangeToday: "امروز",
  range7d: "۷ روز",
  range30d: "۳۰ روز",
  rangeAll: "همه",
  kpiTotal: "مجموع تماس‌ها",
  kpiResolutionRate: "نرخ حل‌شدن",
  kpiFollowUp: "نیاز به پیگیری",
  kpiNegativeCaller: "تماس‌گیرنده‌های ناراضی",
  vsPrevious: "نسبت به بازه قبل",
  byCategory: "بر اساس دسته‌بندی",
  byAgent: "بر اساس کارشناس",
  bySentiment: "احساس تماس‌گیرنده",
  byResolution: "وضعیت حل",
  topTags: "برچسب‌های پرتکرار",
  dailyTrend: "روند روزانه",
  monthlyTrend: "روند ماهانه",
  noCallsInRange: "در این بازه تماسی ثبت نشده است",
  inFlight: (n: number) => `${n.toLocaleString("fa-IR")} در حال پردازش`,
  noAgent: "بدون کارشناس",
  noCategory: "بدون دسته",
  unknownBucket: "نامشخص",
  topNAgents: (n: number) => `${n.toLocaleString("fa-IR")} کارشناس برتر`,

  // Login
  loginTitle: "ورود به سامانه",
  loginSubtitle: "برای دسترسی به داشبورد وارد شوید",
  email: "ایمیل",
  password: "گذرواژه",
  loginBtn: "ورود",
  loggingIn: "در حال ورود…",
  loginError: "ایمیل یا گذرواژه نادرست است",

  // Upload
  uploadTitle: "بارگذاری فایل صوتی تماس",
  uploadHint: "فایل صوتی (mp3, wav, m4a, ogg) — حداکثر ۲۰ مگابایت برای هر فایل",
  uploadHintMulti: "می‌توانید چند فایل را به‌طور هم‌زمان انتخاب کنید",
  chooseFile: "انتخاب فایل",
  dropHere: "فایل‌ها را اینجا رها کنید یا کلیک کنید",
  upload: "بارگذاری و تحلیل",
  uploadOne: "بارگذاری ۱ فایل",
  uploadMany: (n: number) => `بارگذاری ${n.toLocaleString("fa-IR")} فایل`,
  uploading: "در حال بارگذاری…",
  uploadSuccess: "تماس با موفقیت بارگذاری شد. در حال تحلیل…",
  uploadSuccessMany: (n: number) => `${n.toLocaleString("fa-IR")} فایل بارگذاری شد. تحلیل آغاز شد.`,
  uploadError: "خطا در بارگذاری",
  uploadErrorSome: (n: number) => `${n.toLocaleString("fa-IR")} فایل با خطا مواجه شد`,
  fileTooLarge: "حجم فایل بیش از حد مجاز است (حداکثر ۲۰ مگابایت)",
  invalidFileType: "نوع فایل نامعتبر است",
  filesQueued: (n: number) => `${n.toLocaleString("fa-IR")} فایل در صف`,
  removeAll: "حذف همه",
  add: "افزودن",
  status_queued: "در انتظار",
  status_uploading: "در حال بارگذاری",
  status_done: "بارگذاری شد",
  status_error: "خطا",

  // Dashboard
  dashboardTitle: "تماس‌ها",
  dashboardSubtitle: "فهرست تماس‌های تحلیل‌شده",
  newUpload: "بارگذاری جدید",
  noCalls: "تماسی یافت نشد",
  loading: "در حال بارگذاری…",

  // Filters
  filters: "فیلترها",
  search: "جستجو در متن، خلاصه یا نام‌ها…",
  fromDate: "از تاریخ",
  toDate: "تا تاریخ",
  agent: "کارشناس",
  allAgents: "همه کارشناسان",
  resolvedFilter: "وضعیت حل",
  allStatuses: "همه",
  resolvedOnly: "حل‌شده",
  unresolvedOnly: "حل‌نشده",
  category: "دسته‌بندی",
  allCategories: "همه دسته‌ها",
  sentiment: "احساس",
  allSentiments: "همه",
  positive: "مثبت",
  neutral: "خنثی",
  negative: "منفی",
  clearFilters: "پاک‌کردن فیلترها",

  // Table headers
  thDate: "تاریخ",
  thCaller: "تماس‌گیرنده",
  thAgent: "کارشناس",
  thIssue: "موضوع",
  thCategory: "دسته",
  thResolved: "حل شده؟",
  thSentiment: "احساس",
  thStatus: "وضعیت",

  // Status
  statusPending: "در صف",
  statusTranscribing: "در حال پیاده‌سازی",
  statusAnalyzing: "در حال تحلیل",
  statusDone: "آماده",
  statusFailed: "ناموفق",

  // Queue / progress
  queuePosition: (pos: number, total: number) =>
    `${pos.toLocaleString("fa-IR")} از ${total.toLocaleString("fa-IR")} در صف`,
  elapsed: "زمان سپری‌شده",
  eta: "زمان تخمینی",
  etaUnknown: "نامشخص",
  processingHint: "در حال تحلیل توسط هوش مصنوعی — این صفحه به‌صورت زنده به‌روز می‌شود.",
  queuedHint: "این تماس در صف انتظار است و به‌محض آزاد شدن نوبت، تحلیل آغاز می‌شود.",
  basedOnRecent: "بر اساس میانگین تماس‌های اخیر",

  // Resolved
  resolvedYes: "بله",
  resolvedNo: "خیر",
  resolvedUnknown: "نامشخص",

  // Detail
  callDetail: "جزئیات تماس",
  audio: "فایل صوتی",
  transcript: "متن مکالمه",
  extracted: "اطلاعات استخراج‌شده",
  callerName: "نام تماس‌گیرنده",
  callerPhone: "شماره تماس",
  agentName: "نام کارشناس",
  issueSummary: "خلاصه موضوع",
  agentBehavior: "رفتار کارشناس",
  callerBehavior: "رفتار تماس‌گیرنده",
  agentSentiment: "احساس کارشناس",
  callerSentiment: "احساس تماس‌گیرنده",
  followUp: "نیاز به پیگیری",
  yes: "بله",
  no: "خیر",
  notes: "یادداشت‌های اضافی",
  tags: "برچسب‌ها",
  reprocess: "تحلیل مجدد",
  reprocessing: "در حال تحلیل مجدد…",
  back: "بازگشت",
  delete: "حذف",
  deleting: "در حال حذف…",
  confirmDelete: "این تماس برای همیشه حذف شود؟",
  cancel: "لغو",
  cancelling: "در حال لغو…",
  cancelled: "لغو شده توسط کاربر",
  unknown: "—",
  errorOccurred: "خطا در پردازش",

  // Bulk actions
  retryAllFailed: (n: number) => `تحلیل مجدد همه ناموفق‌ها (${n.toLocaleString("fa-IR")})`,
  stopAllProcessing: (n: number) => `توقف همه (${n.toLocaleString("fa-IR")})`,
  confirmRetryAll: "تحلیل مجدد همه تماس‌های ناموفق؟",
  confirmRetryAllMsg: "تمام تماس‌هایی که با خطا متوقف شده‌اند دوباره به صف تحلیل اضافه می‌شوند.",
  confirmStopAll: "توقف همه تماس‌های در حال پردازش؟",
  confirmStopAllMsg: "تماس‌هایی که در صف یا در حال تحلیل هستند لغو می‌شوند. این عمل غیرقابل بازگشت است (اما می‌توانید دوباره تحلیل را آغاز کنید).",
  bulkRetried: (n: number) => `${n.toLocaleString("fa-IR")} تماس به صف تحلیل اضافه شد`,
  bulkCancelled: (n: number) => `${n.toLocaleString("fa-IR")} تماس لغو شد`,
  aiBusyTitle: "سرویس هوش مصنوعی موقتاً شلوغ است",
  aiBusyBody: "تماس‌ها در صف انتظار باقی می‌مانند و به‌محض در دسترس بودن سرویس، تحلیل به‌صورت خودکار از سر گرفته می‌شود.",
  aiBusyNextRetry: (mmss: string) => `تلاش بعدی تا ${mmss} دیگر`,
  aiBusyRetryingNow: "در حال تلاش مجدد…",
  aiBusyRetryNow: "تلاش مجدد فوری",

  // Realtime / connection
  connectionLive: "اتصال زنده",
  connectionLost: "اتصال قطع شد",
  connectionReconnecting: "در حال اتصال…",
  connectionLostToast: "اتصال زنده قطع شد — به‌روزرسانی‌ها متوقف شده‌اند",
  connectionRestoredToast: "اتصال زنده برقرار شد",
  lastSync: (mmss: string) => `آخرین به‌روزرسانی: ${mmss} پیش`,
  justNow: "همین حالا",

  // Processing phases (derived from elapsed time)
  phaseDownloading: "در حال دانلود فایل صوتی…",
  phaseAnalyzing: "در حال تحلیل با هوش مصنوعی…",
  phaseFinalizing: "در حال نهایی‌سازی…",

  // Upload progress
  uploadingProgress: (percent: number, throughput: string) =>
    `${percent.toLocaleString("fa-IR")}٪ · ${throughput}`,
  uploadBatchETA: (mmss: string) => `زمان باقی‌مانده: ${mmss}`,
  uploadBatchProgress: (done: number, total: number) =>
    `${done.toLocaleString("fa-IR")} از ${total.toLocaleString("fa-IR")} بارگذاری شد`,
  throughputKbps: (kb: number) => `${kb.toLocaleString("fa-IR", { maximumFractionDigits: 0 })} ک‌ب/ث`,
  throughputMbps: (mb: number) => `${mb.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} م‌ب/ث`,

  // Background notifications
  notifyCallDone: (name: string) =>
    name ? `تحلیل تماس «${name}» کامل شد` : "تحلیل تماس کامل شد",
  notifyCallFailed: (name: string) =>
    name ? `تحلیل تماس «${name}» با خطا متوقف شد` : "تحلیل با خطا متوقف شد",
  notifyAIRecovered: "سرویس هوش مصنوعی بازگشت — صف از سر گرفته شد",

  // Inline actions
  inlineRetry: "تلاش مجدد",
  queuedShort: "در صف…",
  pendingShort: "در حال انجام…",
} as const;

export function statusLabel(s: string): string {
  switch (s) {
    case "pending": return t.statusPending;
    case "transcribing": return t.statusTranscribing;
    case "analyzing": return t.statusAnalyzing;
    case "done": return t.statusDone;
    case "failed": return t.statusFailed;
    default: return s;
  }
}

export function sentimentLabel(s: string | null | undefined): string {
  switch (s) {
    case "positive": return t.positive;
    case "neutral": return t.neutral;
    case "negative": return t.negative;
    default: return t.unknown;
  }
}

export function resolvedLabel(r: boolean | null | undefined): string {
  if (r === true) return t.resolvedYes;
  if (r === false) return t.resolvedNo;
  return t.resolvedUnknown;
}

// Persian-digit formatted date
export function formatFaDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

// Just the date portion (no time) — used for summary range headers.
export function formatFaDateShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

// Day-of-month label for daily-trend tooltips (e.g. "۱۲ خرداد").
export function formatFaDayMonth(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatFaPercent(fraction: number, opts: { signed?: boolean } = {}): string {
  const sign = opts.signed && fraction > 0 ? "+" : "";
  const pct = Math.round(fraction * 100);
  return `${sign}${pct.toLocaleString("fa-IR")}٪`;
}

// "۰:۲۳" or "۱:۰۵" for elapsed/ETA timers. Caps display at 99:59 for sanity.
export function formatFaDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.min(99, Math.floor(s / 60));
  const sec = s % 60;
  const mFa = m.toLocaleString("fa-IR");
  const secFa = sec.toString().padStart(2, "0").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  return `${mFa}:${secFa}`;
}
