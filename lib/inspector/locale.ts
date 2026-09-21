import type { Locale } from "./model";

// Match the first browser preference. Unsupported languages currently use English.
export function localeFromLanguage(language: string | null | undefined): Locale {
  return /^zh(?:[-_]|$)/i.test(language || "") ? "zh" : "en";
}
export function browserLocale(): Locale {
  return localeFromLanguage(navigator.languages?.[0] || navigator.language);
}
export function subscribeLocale(callback: () => void) {
  window.addEventListener("languagechange", callback);
  return () => window.removeEventListener("languagechange", callback);
}

export type LanguagePreference = "auto" | Locale;
export const WEBSITE_LANGUAGE_COOKIE = "txlens-website-language";
export function languagePreference(value: unknown): LanguagePreference {
  return value === "zh" || value === "en" ? value : "auto";
}
