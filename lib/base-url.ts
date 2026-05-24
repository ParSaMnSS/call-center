// Resolve the base URL the server should use when calling its own routes
// (e.g. fire-and-forget worker kicks).
//
// Priority:
//   1. NEXT_PUBLIC_APP_URL  — explicit override; recommended for production.
//   2. VERCEL_URL           — auto-provided by Vercel on every deployment.
//   3. localhost            — dev fallback.
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
