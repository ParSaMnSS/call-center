import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

const MODEL = "gemini-2.5-flash-lite";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "gen-lang-client-0324926987";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";

// Lazy client: don't crash at module-eval time (e.g. during `next build` page
// data collection) if the env var is missing. Throw only when actually used.
let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (_client) return _client;

  const inlineJson = process.env.GOOGLE_CREDENTIALS_JSON;
  const credFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!inlineJson && !credFile) {
    throw new Error(
      "احراز هویت Vertex AI تنظیم نشده است: GOOGLE_CREDENTIALS_JSON (در Vercel) یا GOOGLE_APPLICATION_CREDENTIALS (لوکال) را تنظیم کنید."
    );
  }

  const opts: ConstructorParameters<typeof GoogleGenAI>[0] = {
    vertexai: true,
    project: PROJECT,
    location: LOCATION,
  };

  if (inlineJson) {
    const credentials = JSON.parse(inlineJson);
    opts.googleAuthOptions = { credentials };
  }

  _client = new GoogleGenAI(opts);
  return _client;
}

// ===== Schema (used both by Gemini's responseSchema and Zod validation) =====

export const AnalysisSchema = z.object({
  transcript: z.string(),
  caller_name: z.string().nullable(),
  caller_phone: z.string().nullable(),
  agent_name: z.string().nullable(),
  issue_summary: z.string(),
  resolved: z.boolean().nullable(),
  category: z.string(),
  tags: z.array(z.string()),
  agent_behavior: z.string(),
  caller_behavior: z.string(),
  sentiment_agent: z.enum(["positive", "neutral", "negative"]),
  sentiment_caller: z.enum(["positive", "neutral", "negative"]),
  follow_up_needed: z.boolean(),
  notes: z.string(),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transcript: { type: Type.STRING, description: "متن کامل مکالمه به فارسی، شامل گفته‌های هر دو طرف به ترتیب زمانی" },
    caller_name: { type: Type.STRING, nullable: true, description: "نام تماس‌گیرنده اگر در مکالمه ذکر شده باشد" },
    caller_phone: { type: Type.STRING, nullable: true, description: "شماره تلفن تماس‌گیرنده اگر ذکر شده باشد" },
    agent_name: { type: Type.STRING, nullable: true, description: "نام کارشناس مرکز تماس اگر ذکر شده باشد" },
    issue_summary: { type: Type.STRING, description: "خلاصه یک تا دو جمله از موضوع تماس به فارسی" },
    resolved: { type: Type.BOOLEAN, nullable: true, description: "آیا مشکل در همین تماس حل شد؟ اگر نامشخص است null" },
    category: { type: Type.STRING, description: "دسته‌بندی: مالی، فنی، شکایت، اطلاعات، فروش، پشتیبانی، یا سایر" },
    tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "چند برچسب کوتاه فارسی" },
    agent_behavior: { type: Type.STRING, description: "توصیف کوتاه رفتار کارشناس به فارسی" },
    caller_behavior: { type: Type.STRING, description: "توصیف کوتاه رفتار تماس‌گیرنده به فارسی" },
    sentiment_agent: { type: Type.STRING, enum: ["positive", "neutral", "negative"] },
    sentiment_caller: { type: Type.STRING, enum: ["positive", "neutral", "negative"] },
    follow_up_needed: { type: Type.BOOLEAN },
    notes: { type: Type.STRING, description: "نکات قابل توجه دیگر به فارسی" },
  },
  required: [
    "transcript", "caller_name", "caller_phone", "agent_name",
    "issue_summary", "resolved", "category", "tags",
    "agent_behavior", "caller_behavior",
    "sentiment_agent", "sentiment_caller",
    "follow_up_needed", "notes",
  ],
  propertyOrdering: [
    "transcript", "caller_name", "caller_phone", "agent_name",
    "issue_summary", "resolved", "category", "tags",
    "agent_behavior", "caller_behavior",
    "sentiment_agent", "sentiment_caller",
    "follow_up_needed", "notes",
  ],
};

const SYSTEM_INSTRUCTION = `شما یک تحلیلگر مکالمات مرکز تماس هستید.
به شما یک فایل صوتی فارسی از یک تماس بین کارشناس مرکز تماس و یک مشتری داده می‌شود.

دو وظیفه دارید:
۱. کل مکالمه را با دقت به فارسی پیاده‌سازی کنید (transcript). از خط فارسی استاندارد و حروف ی/ک فارسی استفاده کنید. گفته‌های دو طرف را به ترتیب زمانی بنویسید.
۲. اطلاعات ساختاریافته را از مکالمه استخراج کنید.

نکات مهم:
- تمام مقادیر متنی باید فارسی باشند.
- چیزی از خود اضافه نکنید؛ فقط بر اساس محتوای واقعی صدا پاسخ دهید.
- اگر اطلاعاتی در صدا نیست، برای فیلدهای nullable از null استفاده کنید.
- اگر حل شدن مشکل نامشخص است، resolved را null بگذارید.`;

// ===== Main entry: audio file → transcript + structured analysis =====

export type AnalyzeOptions = {
  // Original upload filename. Call-center recordings often encode the caller
  // number here (e.g. "09121234567.mp3"), so we surface it to the model.
  filenameHint?: string | null;
  // Phone already parsed from the filename. Use as a high-confidence default.
  phoneHint?: string | null;
};

// Thrown when Gemini is temporarily unavailable (503 UNAVAILABLE, 429 rate
// limit, network blips). Caller is expected to keep the row in `pending`
// and try again later rather than marking it `failed`.
export class TransientAIError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "TransientAIError";
  }
}

function isTransient(e: unknown): { transient: boolean; status?: number; message: string } {
  const message = e instanceof Error ? e.message : String(e);
  // The @google/genai SDK surfaces HTTP errors as Error with the JSON body
  // embedded in .message. Cheap-and-cheerful detection from the string.
  const m = message.match(/"code"\s*:\s*(\d+)/);
  const status = m ? Number(m[1]) : undefined;
  // 5xx server-side issues + 429 rate limit + 408 request timeout.
  if (status === 503 || status === 429 || status === 500 || status === 504 || status === 408 || status === 502) {
    return { transient: true, status, message };
  }
  // Vertex/Gemini gRPC-style codes embedded in the JSON body, plus a few
  // wording variants we've seen in the wild from the Vertex backend.
  if (/UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED|INTERNAL|ABORTED|CANCELLED|UPSTREAM|gateway timeout|server disconnected|socket hang up|stream closed|timeout/i.test(message)) {
    return { transient: true, status, message };
  }
  // Network-level errors (DNS, connection reset, fetch failure, TLS reset).
  if (e instanceof TypeError || /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE|read ECONNRESET|other side closed|network|aborted/i.test(message)) {
    return { transient: true, status, message };
  }
  // Auth token refresh issues during long calls — these are transient.
  if (/invalid_grant|token has been expired|UNAUTHENTICATED|credentials/i.test(message)) {
    return { transient: true, status, message };
  }
  return { transient: false, status, message };
}

export async function analyzeAudio(
  file: File,
  options: AnalyzeOptions = {}
): Promise<{ analysis: Analysis }> {
  // Gemini's File API handles audio up to 2GB; for simplicity we use inline
  // (base64) audio which is fine up to ~20MB request size.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = Buffer.from(bytes).toString("base64");

  const hintLines: string[] = [];
  if (options.filenameHint) {
    hintLines.push(`نام فایل اصلی: «${options.filenameHint}»`);
  }
  if (options.phoneHint) {
    hintLines.push(
      `شماره تلفن استخراج‌شده از نام فایل: ${options.phoneHint}. ` +
      `اگر شماره دیگری در خود مکالمه ذکر شد آن را استفاده کنید؛ ` +
      `در غیر این صورت همین شماره را در فیلد caller_phone بگذارید.`
    );
  }
  const userText = [
    hintLines.join("\n"),
    "این فایل صوتی را پیاده‌سازی و تحلیل کنید و خروجی را به صورت JSON طبق طرحواره مشخص‌شده بازگردانید.",
  ].filter(Boolean).join("\n\n");

  // Three in-process retries with backoff (1s, 3s, 6s) for short blips.
  // If it's still transient after that, throw TransientAIError so the
  // worker pauses the queue and the cron retries later. Extra attempts here
  // avoid bouncing the row back to `pending` for blips that resolve in
  // under 10 seconds — the cron only fires every minute.
  const delays = [1000, 3000, 6000];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const response = await client().models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: file.type || "audio/mpeg",
                  data: base64,
                },
              },
              { text: userText },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const raw = response.text ?? "{}";
      // Empty response. Vertex occasionally returns this transiently
      // (content-filter false positives, partial streams). Treat as
      // transient so the cron retries — better than failing a real call.
      if (!raw || raw === "{}" || raw.trim().length === 0) {
        throw new Error("EMPTY_RESPONSE: مدل پاسخی برنگرداند");
      }
      const parsed = JSON.parse(raw);
      const analysis = AnalysisSchema.parse(parsed);
      return { analysis };
    } catch (e) {
      lastErr = e;
      const t = isTransient(e);
      // Empty-response retries get folded into transient handling.
      const isEmpty = e instanceof Error && /EMPTY_RESPONSE/.test(e.message);
      if (!t.transient && !isEmpty) throw e;
      if (attempt < delays.length) {
        console.warn(`[analyzeAudio] transient attempt ${attempt + 1} failed${t.status ? ` (${t.status})` : ""}: ${t.message.slice(0, 200)} — retrying in ${delays[attempt]}ms`);
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }
      throw new TransientAIError(
        humanizeTransientMessage(t),
        t.status,
      );
    }
  }
  // Unreachable, but TS needs it.
  throw lastErr instanceof Error ? lastErr : new Error("unknown");
}

// Translate the SDK's raw error into a Farsi message the dashboard can show
// to non-technical users. We don't want to leak HTTP bodies or stack
// fragments to the UI — those land in error_message which is rendered as-is.
function humanizeTransientMessage(t: { status?: number; message: string }): string {
  if (t.status === 429 || /RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(t.message)) {
    return "سرویس هوش مصنوعی به حد مجاز رسیده است. تلاش مجدد به‌صورت خودکار انجام می‌شود.";
  }
  if (t.status === 503 || /UNAVAILABLE|overloaded/i.test(t.message)) {
    return "سرویس هوش مصنوعی موقتاً شلوغ است. تلاش مجدد به‌صورت خودکار انجام می‌شود.";
  }
  if (t.status === 504 || /DEADLINE_EXCEEDED|timeout|UPSTREAM/i.test(t.message)) {
    return "پاسخ سرویس هوش مصنوعی به‌موقع نرسید. تلاش مجدد به‌صورت خودکار انجام می‌شود.";
  }
  if (/EMPTY_RESPONSE/.test(t.message)) {
    return "مدل پاسخی برنگرداند. تلاش مجدد به‌صورت خودکار انجام می‌شود.";
  }
  if (/UNAUTHENTICATED|invalid_grant|credentials|token/i.test(t.message)) {
    return "احراز هویت موقتاً ناموفق بود. تلاش مجدد به‌صورت خودکار انجام می‌شود.";
  }
  return `سرویس هوش مصنوعی موقتاً در دسترس نیست${t.status ? ` (${t.status})` : ""}. تلاش مجدد به‌صورت خودکار انجام می‌شود.`;
}
