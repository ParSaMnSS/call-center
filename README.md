# تحلیلگر تماس‌های مرکز تماس (Call Center Analysis)

A Farsi-language web app for analyzing call center recordings.
Upload an audio file → automatic Farsi transcription (Whisper) → structured analysis (GPT-4o) → filterable dashboard.

## Stack
- Next.js 15 (App Router, TypeScript)
- Tailwind CSS — full RTL with Vazirmatn font
- Supabase (Postgres, Auth, Storage, Realtime)
- OpenAI: `whisper-1` (transcription) + `gpt-4o` (extraction)

## Setup

### 1. Install
```bash
npm install
```

### 2. Supabase
- Create a project at https://supabase.com.
- In **SQL editor**, paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
- Create a user in **Authentication → Users → Add user** (email + password). This will be your login.

### 3. Env vars
Copy and fill:
```bash
cp .env.local.example .env.local
```
- `NEXT_PUBLIC_SUPABASE_URL` — Settings → API → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Settings → API → anon public key
- `SUPABASE_SERVICE_ROLE_KEY` — Settings → API → service_role key (server-only)
- `OPENAI_API_KEY` — your OpenAI key
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for dev

### 4. Run
```bash
npm run dev
```
Open http://localhost:3000 → log in → start uploading.

## How it works
1. **Upload** (`app/dashboard/upload`): a server action saves the file to Supabase Storage and inserts a `calls` row with `status='pending'`, then fires `/api/process/[id]` without awaiting and redirects to the detail page.
2. **Process** (`app/api/process/[id]/route.ts`):
   - Downloads the audio via a signed URL.
   - Sends to Whisper (`language: 'fa'`) → transcript.
   - Sends transcript to GPT-4o with a Farsi system prompt + JSON schema → structured fields.
   - Updates the row at each step (`transcribing` → `analyzing` → `done`).
3. **Dashboard** subscribes to Supabase Realtime, so status changes appear live.

## Notes / limits
- Whisper accepts files up to 25 MB — larger calls need chunking (out of scope for v1).
- The processor runs inside the Next.js server (max 5 minutes). For very long calls or heavy concurrency, move it to a queue / Supabase Edge Function.
- Full-text search uses Postgres `simple` dictionary (no Farsi stemming, but substring/word matching works fine).
