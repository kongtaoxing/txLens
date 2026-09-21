import { cookies, headers } from "next/headers";
import Home from "@/components/inspector/home";
import { localeFromLanguage, languagePreference, WEBSITE_LANGUAGE_COOKIE } from "@/lib/inspector/locale";

export default async function Page() {
  const language = (await headers()).get("accept-language")?.split(/[,;]/)[0];
  const preference = languagePreference((await cookies()).get(WEBSITE_LANGUAGE_COOKIE)?.value);
  const locale = preference === "auto" ? localeFromLanguage(language) : preference;
  return <Home initialLocale={locale} initialPreference={preference} />;
}
