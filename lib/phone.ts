// Extract a phone number from an audio filename.
// Most call-center recordings name files like "09121234567.mp3",
// "+98-912-123-4567.wav", "021 8830 1234.m4a", etc.

const MIN_DIGITS = 7;
const MAX_DIGITS = 15;

export function extractPhoneFromFilename(name: string): string | null {
  // Strip extension and path
  const base = name.replace(/\.[a-zA-Z0-9]+$/, "").split(/[\\/]/).pop() ?? "";

  // Convert Persian / Arabic digits to ASCII so the regex matches
  const ascii = base.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
                    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

  // Collect every digit run of plausible length, optionally with a leading +
  const matches = ascii.match(/\+?\d[\d\s().-]{5,}\d/g) ?? [];

  for (const m of matches) {
    const digits = m.replace(/[^\d+]/g, "");
    const digitCount = digits.replace(/\D/g, "").length;
    if (digitCount >= MIN_DIGITS && digitCount <= MAX_DIGITS) {
      return normalizeIranPhone(digits);
    }
  }
  return null;
}

// Light normalization for Iranian numbers (most common case here).
function normalizeIranPhone(raw: string): string {
  let s = raw;
  // +98xxxxxxxxxx → 0xxxxxxxxxx
  if (s.startsWith("+98")) s = "0" + s.slice(3);
  else if (s.startsWith("0098")) s = "0" + s.slice(4);
  else if (s.startsWith("98") && s.length === 12) s = "0" + s.slice(2);
  return s;
}
