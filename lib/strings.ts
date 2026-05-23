// All UI strings in Farsi, centralized for easy editing / future i18n.
export const t = {
  appName: "تحلیل تماس‌های مرکز تماس",
  appShort: "تحلیلگر تماس",

  // Nav
  navDashboard: "داشبورد",
  navUpload: "بارگذاری تماس",
  navLogout: "خروج",

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
  uploadHint: "فایل صوتی (mp3, wav, m4a, ogg) — حداکثر ۲۵ مگابایت",
  chooseFile: "انتخاب فایل",
  dropHere: "فایل را اینجا رها کنید یا کلیک کنید",
  upload: "بارگذاری و تحلیل",
  uploading: "در حال بارگذاری…",
  uploadSuccess: "تماس با موفقیت بارگذاری شد. در حال تحلیل…",
  uploadError: "خطا در بارگذاری",
  fileTooLarge: "حجم فایل بیش از حد مجاز است (حداکثر ۲۵ مگابایت)",
  invalidFileType: "نوع فایل نامعتبر است",

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
  unknown: "—",
  errorOccurred: "خطا در پردازش",
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
