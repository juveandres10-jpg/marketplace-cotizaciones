"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useLocale } from "@/components/providers";

export function NavBar() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const { t, locale, setLocale } = useLocale();

  return (
    <nav className="border-b bg-white">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold text-brand-700">
            {t.nav.brand}
          </Link>
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            {t.nav.proyectos}
          </Link>
          <Link href="/productos" className="text-sm text-gray-600 hover:text-gray-900">
            {t.nav.catalogo}
          </Link>
          <Link href="/sondeo" className="text-sm text-gray-600 hover:text-gray-900">
            {t.nav.sondeo}
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex border rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setLocale("es")}
              className={`px-2 py-1 ${locale === "es" ? "bg-brand-600 text-white" : "text-gray-600"}`}
            >
              ES
            </button>
            <button
              onClick={() => setLocale("en")}
              className={`px-2 py-1 ${locale === "en" ? "bg-brand-600 text-white" : "text-gray-600"}`}
            >
              EN
            </button>
          </div>
          {user && (
            <span className="text-gray-500">
              {user.name} · {user.empresaNombre}
            </span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-gray-600 hover:text-gray-900"
          >
            {t.nav.salir}
          </button>
        </div>
      </div>
    </nav>
  );
}
