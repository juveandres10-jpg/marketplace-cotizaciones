"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SondeoConfigProducto({
  productoId,
  seguimientoActivo,
  minCotizaciones,
}: {
  productoId: string;
  seguimientoActivo: boolean;
  minCotizaciones: number;
}) {
  const router = useRouter();
  const [activo, setActivo] = useState(seguimientoActivo);
  const [min, setMin] = useState(minCotizaciones);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(cambios: { seguimientoActivo?: boolean; minCotizaciones?: number }) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/sondeo/productos/${productoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "No se pudo guardar");
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      // revertir estado local
      setActivo(seguimientoActivo);
      setMin(minCotizaciones);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex items-center gap-4 flex-wrap text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={activo}
          disabled={guardando}
          onChange={(e) => {
            setActivo(e.target.checked);
            guardar({ seguimientoActivo: e.target.checked });
          }}
        />
        En seguimiento diario
      </label>
      <label className="flex items-center gap-2">
        Mínimo de cotizaciones
        <input
          type="number"
          min={1}
          max={50}
          value={min}
          disabled={guardando}
          onChange={(e) => setMin(Number(e.target.value))}
          onBlur={() => {
            if (min !== minCotizaciones) guardar({ minCotizaciones: min });
          }}
          className="w-16 border rounded px-2 py-1"
        />
      </label>
      {guardando && <span className="text-gray-400">Guardando…</span>}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
