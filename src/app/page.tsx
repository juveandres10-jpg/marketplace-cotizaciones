import Link from "next/link";
import { getServerLocale } from "@/lib/get-server-locale";
import { getDictionary } from "@/lib/i18n";

export default function Home() {
  const locale = getServerLocale();
  const t = getDictionary(locale);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold mb-4">{t.landing.titulo}</h1>
      <p className="text-gray-600 max-w-xl mb-8">{t.landing.subtitulo}</p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="bg-brand-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-brand-700"
        >
          {t.landing.iniciarSesion}
        </Link>
        <Link
          href="/registro"
          className="border border-brand-600 text-brand-600 px-6 py-3 rounded-lg font-medium hover:bg-brand-50"
        >
          {t.landing.crearCuenta}
        </Link>
      </div>
    </main>
  );
}
