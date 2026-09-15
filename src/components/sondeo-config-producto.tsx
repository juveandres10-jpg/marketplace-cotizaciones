"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SondeoConfigProducto({
  productoId,
  seguimientoActivo,
  minCotizaciones,
  moneda,
  fleteEstimadoUnit,
  fleteEstimadoDestino,
  fleteEstimadoNotas,
}: {
  productoId: string;
  seguimientoActivo: boolean;
  minCotizaciones: number;
  moneda: string;
  fleteEstimadoUnit: number | null;
  fleteEstimadoDestino: string | null;
  fleteEstimadoNotas: string | null;
}) {
  const router = useRouter();
  const [activo, setActivo] = useState(seguimientoActivo);
  const [min, setMin] = useState(minCotizaciones);
  const [flete, setFlete] = useState(fleteEstimadoUnit?.toString() ?? "");
  const [destino, setDestino] = useState(
    fleteEstimadoDestino ?? "CIF Puerto de Cartagena, Colombia"
  );
  const [notasFlete, setNotasFlete] = useState(fleteEstimadoNotas ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(cambios: Record<string, unknown>) {
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
      setActivo(seguimientoActivo);
      setMin(minCotizaciones);
    } finally {
      setGuardando(false);
    }
  }

  function guardarFlete() {
    const valor = flete.trim() === "" ? null : Number(flete);
    guardar({
      fleteEstimadoUnit: valor,
      fleteEstimadoDestino: destino.trim() || null,
      fleteEstimadoNotas: notasFlete.trim() || null,
    });
  }

  return (
    <div className="text-sm">
      <div className="flex items-center gap-4 flex-wrap">
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

      <div className="mt-4 pt-4 border-t">
        <div className="text-xs font-medium text-gray-500 mb-2">
          Flete + seguro estimado (para calcular un precio CIF de referencia —
          tú ingresas tu tarifa real, la app nunca la inventa)
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="block">
            <span className="text-xs text-gray-500">
              Flete + seguro por unidad ({moneda})
            </span>
            <input
              type="number"
              step="any"
              min={0}
              value={flete}
              onChange={(e) => setFlete(e.target.value)}
              onBlur={guardarFlete}
              placeholder="ej. 8.50"
              className="mt-1 w-32 border rounded px-2 py-1 block"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Destino / término</span>
            <input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              onBlur={guardarFlete}
              className="mt-1 w-64 border rounded px-2 py-1 block"
            />
          </label>
          <label className="block flex-1 min-w-[200px]">
            <span className="text-xs text-gray-500">
              Notas (fuente de la tarifa)
            </span>
            <input
              value={notasFlete}
              onChange={(e) => setNotasFlete(e.target.value)}
              onBlur={guardarFlete}
              placeholder="ej. Cotizado con Agencia XYZ, contenedor 40ft, sep 2026"
              className="mt-1 w-full border rounded px-2 py-1 block"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
