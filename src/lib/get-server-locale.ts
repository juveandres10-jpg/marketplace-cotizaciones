import { cookies } from "next/headers";
import { defaultLocale, LOCALE_COOKIE, Locale, locales } from "@/lib/i18n";

export function getServerLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  if (value && (locales as string[]).includes(value)) {
    return value as Locale;
  }
  return defaultLocale;
}
