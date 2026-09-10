"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FilaCotizacion = {
  id: string;
  fechaRevision: string;
  fuente: string;
  proveedorNombre: string;
  proveedorPais: string | null;
  proveedorUrl: string | null;
  precioUnit: number | null;
  moneda: string;
  unidad: string;
  moq: number | null;
  incoterm: string | null;
  tiempoEntregaDias: number | null;
  notas: string | null;
  capturadoPor: string | null;
};

export function SondeoCotizacionesTabla({ filas }: { filas: FilaCotizacion[] }) {
  const router = useRouter();
  const [borrando, setBorrando] = useState<string | null>(null);

  async function borrar(id: string) {
    if (!confirm("¿Eliminar esta cotización de mercado?")) return;
    setBorrando(id);
    try {
      const res = await fetch(`/api/sondeo/cotizaciones/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("No se pudo eliminar.");
    } finally {
      setBorrando(null);
    }
  }

  if (filas.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Este producto aún no tiene cotizaciones de mercado registradas.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-xl bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Proveedor</th>
            <th className="px-3 py-2 font-medium text-right">Precio unit.</th>
            <th className="px-3 py-2 font-medium text-right">MOQ</th>
            <th className="px-3 py-2 font-medium">Incoterm</th>
            <th className="px-3 py-2 font-medium text-right">Entrega</th>
            <th className="px-3 py-2 font-medium">Fuente</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filas.map((f) => (
            <tr key={f.id}>
              <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                {new Date(f.fechaRevision).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="px-3 py-2">
                {f.proveedorUrl ? (
                  <a
                    href={f.proveedorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-700 hover:underline"
                  >
                    {f.proveedorNombre}
                  </a>
                ) : (
                  f.proveedorNombre
                )}
                {f.proveedorPais && (
                  <span className="text-xs text-gray-400"> · {f.proveedorPais}</span>
                )}
                {f.notas && (
                  <div className="text-xs text-gray-400 max-w-xs truncate">
                    {f.notas}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                {f.precioUnit != null
                  ? `${f.moneda} ${f.precioUnit.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })} / ${f.unidad}`
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {f.moq != null ? f.moq.toLocaleString() : "—"}
              </td>
              <td className="px-3 py-2">{f.incoterm ?? "—"}</td>
              <td className="px-3 py-2 text-right">
                {f.tiempoEntregaDias != null ? `${f.tiempoEntregaDias} d` : "—"}
              </td>
              <td className="px-3 py-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {f.fuente}
                </span>
                {f.capturadoPor && (
                  <div className="text-xs text-gray-400">{f.capturadoPor}</div>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => borrar(f.id)}
                  disabled={borrando === f.id}
                  className="text-xs text-gray-400 hover:text-red-600"
                >
                  {borrando === f.id ? "…" : "Eliminar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
