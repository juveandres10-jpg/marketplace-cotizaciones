"use client";

import { createContext, useContext, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Dictionary,
  Locale,
  LOCALE_COOKIE,
  getDictionary,
} from "@/lib/i18n";

const LocaleContext = createContext<{
  locale: Locale;
  t: Dictionary;
  setLocale: (l: Locale) => void;
}>({
  locale: "es",
  t: getDictionary("es"),
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}

export function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  function setLocale(l: Locale) {
    setLocaleState(l);
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000`;
    router.refresh();
  }

  return (
    <LocaleContext.Provider value={{ locale, t: getDictionary(locale), setLocale }}>
      <SessionProvider>{children}</SessionProvider>
    </LocaleContext.Provider>
  );
}
