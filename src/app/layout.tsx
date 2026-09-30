import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SCRIPT_TEMA } from "@/components/tema";
import { getServerLocale } from "@/lib/get-server-locale";

export const metadata: Metadata = {
  title: "Marketplace de Cotizaciones",
  description: "Búsqueda y cotización de productos por proyecto",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = getServerLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
