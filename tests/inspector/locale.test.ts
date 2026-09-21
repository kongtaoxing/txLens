import { test } from "node:test";
import assert from "node:assert/strict";
import { browserLocale, localeFromLanguage } from "../../lib/inspector/locale";

test("browser language variants select a supported locale", () => {
  for (const language of ["zh", "zh-CN", "zh-TW", "zh-HK", "ZH-hans"]) assert.equal(localeFromLanguage(language), "zh");
  for (const language of ["en", "en-GB", "fr-FR", "ja", "", undefined]) assert.equal(localeFromLanguage(language), "en");
});
test("browser first preference wins; previously saved locale does not override it", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => { throw Error("Do not read a saved locale"); } } });
  try {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { languages: ["en-GB", "zh-CN"], language: "zh-CN" } });
    assert.equal(browserLocale(), "en");
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { languages: ["zh-CN", "en-US"], language: "en-US" } });
    assert.equal(browserLocale(), "zh");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor); else Reflect.deleteProperty(globalThis, "navigator");
    if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
