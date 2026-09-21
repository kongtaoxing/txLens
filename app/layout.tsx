import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { localeFromLanguage, languagePreference, WEBSITE_LANGUAGE_COOKIE } from "@/lib/inspector/locale";
import "./product.css";
import "./landing.css";

export async function generateMetadata(): Promise<Metadata> {
  const language = (await headers()).get("accept-language")?.split(/[,;]/)[0];
  const preference = languagePreference((await cookies()).get(WEBSITE_LANGUAGE_COOKIE)?.value);
  const zh = (preference === "auto" ? localeFromLanguage(language) : preference) === "zh";
  return {
    title: zh ? "TxLens — 看清操作，再确认" : "TxLens — Clarity before you confirm",
    description: zh
      ? "在钱包确认前，查看收款地址、资产数量和授权范围。免费浏览器插件，支持 Orbio AI 操作说明。"
      : "See recipients, amounts and permissions before confirming in your wallet. A free browser extension with optional AI explanations via Orbio.",
    icons: { icon: "/favicon.svg" },
  };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const language = (await headers()).get("accept-language")?.split(/[,;]/)[0];
  const preference = languagePreference((await cookies()).get(WEBSITE_LANGUAGE_COOKIE)?.value);
  const locale = preference === "auto" ? localeFromLanguage(language) : preference;
  return <html lang={locale === "zh" ? "zh-CN" : "en"}><body>{children}</body></html>;
}
