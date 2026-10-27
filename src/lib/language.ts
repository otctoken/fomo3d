export type Language = "en" | "zh";
export function detectLanguage(
  languages: readonly string[],
  saved?: string | null,
): Language {
  if (saved === "zh" || saved === "en") return saved;
  return /^zh(?:[-_]|$)/i.test(languages[0] || "") ? "zh" : "en";
}
