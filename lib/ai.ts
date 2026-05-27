import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

const MODEL = "gemini-2.5-flash-lite";

// Lazy client: don't crash at module-eval time (e.g. during `next build` page
// data collection) if the env var is missing. Throw only when actually used.
let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("متغیر محیطی GOOGLE_API_KEY تنظیم نشده است");
  }
  _client = new GoogleGenAI({ apiKey });
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
  const parsed = JSON.parse(raw);
  const analysis = AnalysisSchema.parse(parsed);

  return { analysis };
}
