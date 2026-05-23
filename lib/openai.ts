import OpenAI from "openai";
import { z } from "zod";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===== Transcription =====

export async function transcribeAudio(file: File): Promise<{
  text: string;
  duration?: number;
}> {
  const resp = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "fa", // Persian/Farsi
    response_format: "verbose_json",
  });

  // verbose_json returns { text, duration, segments, ... }
  const anyResp = resp as unknown as { text: string; duration?: number };
  return { text: anyResp.text, duration: anyResp.duration };
}

// ===== Analysis =====

export const AnalysisSchema = z.object({
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

const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    caller_name: { type: ["string", "null"], description: "نام تماس‌گیرنده اگر در مکالمه ذکر شده، در غیر این صورت null" },
    caller_phone: { type: ["string", "null"], description: "شماره تلفن تماس‌گیرنده اگر در مکالمه ذکر شده" },
    agent_name: { type: ["string", "null"], description: "نام کارشناس مرکز تماس اگر در مکالمه ذکر شده" },
    issue_summary: { type: "string", description: "خلاصه کوتاه و واضح فارسی از موضوع تماس (یک تا دو جمله)" },
    resolved: { type: ["boolean", "null"], description: "آیا مشکل در همین تماس حل شد؟ اگر نامشخص است null" },
    category: { type: "string", description: "دسته‌بندی کلی مانند: مالی، فنی، شکایت، اطلاعات، فروش، پشتیبانی، سایر" },
    tags: { type: "array", items: { type: "string" }, description: "چند برچسب کوتاه فارسی مرتبط با موضوع تماس" },
    agent_behavior: { type: "string", description: "توصیف کوتاه رفتار کارشناس (مثلاً: مودب و صبور، بی‌حوصله، حرفه‌ای)" },
    caller_behavior: { type: "string", description: "توصیف کوتاه رفتار تماس‌گیرنده" },
    sentiment_agent: { type: "string", enum: ["positive", "neutral", "negative"] },
    sentiment_caller: { type: "string", enum: ["positive", "neutral", "negative"] },
    follow_up_needed: { type: "boolean", description: "آیا این تماس نیاز به پیگیری بعدی دارد؟" },
    notes: { type: "string", description: "سایر نکات قابل توجه به فارسی" },
  },
  required: [
    "caller_name", "caller_phone", "agent_name",
    "issue_summary", "resolved", "category", "tags",
    "agent_behavior", "caller_behavior",
    "sentiment_agent", "sentiment_caller",
    "follow_up_needed", "notes",
  ],
} as const;

const SYSTEM_PROMPT = `شما یک تحلیلگر مکالمات مرکز تماس هستید. متن یک مکالمه فارسی بین یک کارشناس مرکز تماس و یک مشتری به شما داده می‌شود.
وظیفه شما این است که اطلاعات زیر را با دقت از متن استخراج کنید و به صورت JSON بازگردانید.
تمام مقادیر متنی باید به زبان فارسی باشد. اگر اطلاعاتی در متن وجود ندارد، برای فیلدهای متنی از مقدار مناسب null یا توضیح «نامشخص» استفاده کنید و برای resolved در صورت ابهام null برگردانید.
خلاصه‌سازی باید واقع‌بینانه و فقط بر اساس محتوای مکالمه باشد و چیزی از خود اضافه نکنید.`;

export async function analyzeTranscript(transcript: string): Promise<Analysis> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `متن مکالمه:\n\n${transcript}\n\nلطفاً اطلاعات ساختاریافته را به صورت JSON طبق طرحواره مشخص‌شده بازگردانید.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "call_analysis",
        strict: true,
        schema: ANALYSIS_JSON_SCHEMA,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  return AnalysisSchema.parse(parsed);
}
