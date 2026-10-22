const SPECIAL: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  Æ: "AE",
  ø: "o",
  Ø: "O",
  œ: "oe",
  Œ: "OE",
  đ: "d",
  Đ: "D",
  ł: "l",
  Ł: "L",
  þ: "th",
  Þ: "TH",
  ð: "d",
  Ð: "D",
};

/**
 * Kebab-case slug matching Laravel `Str::slug($title)` for Latin text:
 * ASCII transliteration, `_` → `-`, `@` → `-at-`, drop other punctuation, collapse separators.
 * ("OCR — Internal Document Extraction" → "ocr-internal-document-extraction", "C# & .NET" → "c-net")
 */
export function slugify(input: string): string {
  const ascii = input
    .replace(/[ßæÆøØœŒđĐłŁþÞðÐ]/g, (char) => SPECIAL[char] ?? char)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\x00-\x7F]+/g, "");

  return ascii
    .replace(/_+/g, "-")
    .replace(/@/g, "-at-")
    .toLowerCase()
    .replace(/[^-a-z0-9\s]+/g, "")
    .replace(/[-\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
