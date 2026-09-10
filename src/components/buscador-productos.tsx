"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/providers";

export function BuscadorProductos({
  initialQuery,
}: {
  initialQuery: string;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [q, setQ] = useState(initialQuery);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/productos?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={buscar} className="flex gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.productos.buscarPlaceholder}
        className="flex-1 border rounded-lg px-3 py-2"
      />
      <button
        type="submit"
        className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700"
      >
        {t.productos.buscar}
      </button>
    </form>
  );
}
