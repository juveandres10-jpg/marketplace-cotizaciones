// Compara, para cada ítem (producto o descripción libre), el precio ofrecido
// por cada proveedor a través de todas las cotizaciones del proyecto.
// Resalta en verde el precio más bajo disponible por fila.

import { Dictionary } from "@/lib/i18n";

type ItemCotizacion = {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnit: number | null;
  subtotal: number | null;
  producto: { id: string; nombre: string } | null;
};

type Cotizacion = {
  id: string;
  estado: string;
  moneda: string;
  proveedor: { id: string; nombre: string };
  items: ItemCotizacion[];
};

export function ComparadorCotizaciones({
  cotizaciones,
  t,
}: {
  cotizaciones: Cotizacion[];
  t: Dictionary;
}) {
  if (cotizaciones.length === 0) {
    return null;
  }

  // Proveedores únicos que han cotizado en este proyecto (columnas)
  const proveedores = Array.from(
    new Map(cotizaciones.map((c) => [c.proveedor.id, c.proveedor])).values()
  );

  // Filas: agrupar ítems por producto.id si existe, si no por descripción normalizada
  type Fila = {
    key: string;
    label: string;
    porProveedor: Record<
      string,
      { precioUnit: number | null; subtotal: number | null; moneda: string; estado: string }
    >;
  };

  const filasMap = new Map<string, Fila>();

  for (const cot of cotizaciones) {
    for (const item of cot.items) {
      const key = item.producto?.id ?? `libre:${item.descripcion.trim().toLowerCase()}`;
      const label = item.producto?.nombre ?? item.descripcion;

      if (!filasMap.has(key)) {
        filasMap.set(key, { key, label, porProveedor: {} });
      }
      const fila = filasMap.get(key)!;

      // Si el mismo proveedor cotizó el ítem más de una vez (varias cotizaciones),
      // nos quedamos con el precio más reciente (las cotizaciones ya vienen
      // ordenadas por updatedAt desc, así que no sobrescribimos si ya existe).
      if (!fila.porProveedor[cot.proveedor.id]) {
        fila.porProveedor[cot.proveedor.id] = {
          precioUnit: item.precioUnit,
          subtotal: item.subtotal,
          moneda: cot.moneda,
          estado: cot.estado,
        };
      }
    }
  }

  const filas = Array.from(filasMap.values());

  if (filas.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border rounded-xl overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="px-4 py-2 sticky left-0 bg-gray-100">Ítem</th>
            {proveedores.map((p) => (
              <th key={p.id} className="px-4 py-2 whitespace-nowrap">
                {p.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const precios = proveedores
              .map((p) => fila.porProveedor[p.id]?.precioUnit)
              .filter((v): v is number => v != null);
            const minPrecio = precios.length > 0 ? Math.min(...precios) : null;

            return (
              <tr key={fila.key} className="border-t">
                <td className="px-4 py-2 font-medium sticky left-0 bg-white">
                  {fila.label}
                </td>
                {proveedores.map((p) => {
                  const dato = fila.porProveedor[p.id];
                  if (!dato) {
                    return (
                      <td key={p.id} className="px-4 py-2 text-gray-300">
                        —
                      </td>
                    );
                  }
                  const esMinimo =
                    dato.precioUnit != null && dato.precioUnit === minPrecio;
                  return (
                    <td
                      key={p.id}
                      className={`px-4 py-2 whitespace-nowrap ${
                        esMinimo
                          ? "bg-green-50 text-green-700 font-semibold"
                          : ""
                      }`}
                    >
                      {dato.precioUnit != null
                        ? `${dato.moneda} ${dato.precioUnit.toLocaleString()}`
                        : (
                          <span className="text-gray-400 text-xs">
                            {dato.estado === "ENVIADA" || dato.estado === "EN_NEGOCIACION"
                              ? t.cotizaciones.pendiente
                              : "—"}
                          </span>
                        )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 px-4 py-2">{t.proyecto.comparadorNota}</p>
    </div>
  );
}
