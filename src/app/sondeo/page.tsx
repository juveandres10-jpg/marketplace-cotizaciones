import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/nav-bar";

export const dynamic = "force-dynamic";

const ESTADO_BADGE: Record<string, string> = {
  EN_PROGRESO: "bg-amber-50 text-amber-700",
  COMPLETADA: "bg-green-50 text-green-700",
  PARCIAL: "bg-orange-50 text-orange-700",
  FALLIDA: "bg-red-50 text-red-700",
};

function fmt(n: number | null | undefined, moneda = "USD") {
  if (n == null) return "—";
  return `${moneda} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fechaCorta(d: Date | string) {
  return new Date(d).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function SondeoPage({
  searchParams,
}: {
  searchParams: { dias?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const dias = Math.max(1, Math.min(90, Number(searchParams.dias ?? "7")));
  const ventana = new Date(Date.now() - dias * 86_400_000);
  const hoy0 = new Date();
  hoy0.setHours(0, 0, 0, 0);

  const [productos, revisiones, cargadasHoy] = await Promise.all([
    prisma.producto.findMany({
      include: {
        categoria: { select: { nombre: true } },
        cotizacionesMercado: {
          where: { fechaRevision: { gte: new Date(Date.now() - 30 * 86_400_000) } },
          select: { precioUnit: true, moneda: true, fechaRevision: true },
          orderBy: { fechaRevision: "desc" },
        },
      },
      orderBy: [{ seguimientoActivo: "desc" }, { nombre: "asc" }],
    }),
    prisma.revisionDiaria.findMany({
      orderBy: { fecha: "desc" },
      take: 15,
      include: { _count: { select: { cotizaciones: true } } },
    }),
    prisma.cotizacionMercado.count({ where: { fechaRevision: { gte: hoy0 } } }),
  ]);

  const filas = productos.map((p) => {
    const enVentana = p.cotizacionesMercado.filter(
      (c) => c.fechaRevision >= ventana
    );
    // Solo se promedia en la moneda del producto — mezclar monedas distintas
    // sin una tasa de cambio real daría un número engañoso.
    const precios = enVentana
      .filter((c) => c.moneda === p.moneda)
      .map((c) => c.precioUnit)
      .filter((x): x is number => x != null);
    const min = precios.length ? Math.min(...precios) : null;
    const prom = precios.length
      ? precios.reduce((a, b) => a + b, 0) / precios.length
      : null;
    const faltan = p.seguimientoActivo
      ? Math.max(0, p.minCotizaciones - enVentana.length)
      : 0;
    return {
      id: p.id,
      nombre: p.nombre,
      marca: p.marca,
      modelo: p.modelo,
      categoria: p.categoria?.nombre ?? null,
      moneda: p.moneda,
      precioRef: p.precioRef,
      seguimientoActivo: p.seguimientoActivo,
      minCotizaciones: p.minCotizaciones,
      enVentana: enVentana.length,
      faltan,
      min,
      prom,
      ultima: p.cotizacionesMercado[0]?.fechaRevision ?? null,
    };
  });

  const enSeguimiento = filas.filter((f) => f.seguimientoActivo);
  const pendientes = enSeguimiento.filter((f) => f.faltan > 0);
  const cotizFaltantes = pendientes.reduce((a, f) => a + f.faltan, 0);

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Sondeo diario de cotizaciones</h1>
            <p className="text-sm text-gray-500 mt-1">
              Objetivo: mínimo {5} cotizaciones de mercado por producto cada día.
              Ventana mostrada: últimos {dias} días.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/api/sondeo/exportar"
              className="border px-4 py-2 rounded-lg font-medium hover:bg-gray-50 text-sm"
            >
              Exportar a Excel
            </a>
            <Link
              href="/sondeo/nueva-cotizacion"
              className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 text-sm"
            >
              + Cargar cotización
            </Link>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Tarjeta titulo="Productos en seguimiento" valor={enSeguimiento.length} />
          <Tarjeta
            titulo={`Productos pendientes (${dias}d)`}
            valor={pendientes.length}
            alerta={pendientes.length > 0}
          />
          <Tarjeta
            titulo="Cotizaciones faltantes"
            valor={cotizFaltantes}
            alerta={cotizFaltantes > 0}
          />
          <Tarjeta titulo="Cargadas hoy" valor={cargadasHoy} />
        </div>

        {/* Tabla por producto */}
        <h2 className="font-semibold text-lg mb-3">Estado por producto</h2>
        <div className="overflow-x-auto border rounded-xl bg-white mb-10">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Producto</th>
                <th className="px-4 py-2 font-medium">Categoría</th>
                <th className="px-4 py-2 font-medium text-center">
                  Cotiz. {dias}d
                </th>
                <th className="px-4 py-2 font-medium text-center">Faltan</th>
                <th className="px-4 py-2 font-medium text-right">Precio mercado</th>
                <th className="px-4 py-2 font-medium text-right">Precio ref.</th>
                <th className="px-4 py-2 font-medium">Última</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filas.map((f) => (
                <tr
                  key={f.id}
                  className={f.seguimientoActivo ? "" : "opacity-50"}
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/sondeo/producto/${f.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {f.nombre}
                    </Link>
                    {(f.marca || f.modelo) && (
                      <div className="text-xs text-gray-400">
                        {[f.marca, f.modelo].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {!f.seguimientoActivo && (
                      <span className="text-xs text-gray-400">
                        (sin seguimiento)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {f.categoria ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {f.enVentana} / {f.minCotizaciones}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {!f.seguimientoActivo ? (
                      <span className="text-gray-400">—</span>
                    ) : f.faltan > 0 ? (
                      <span className="inline-block bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {f.faltan}
                      </span>
                    ) : (
                      <span className="inline-block bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {f.min != null ? (
                      <>
                        <span className="font-medium">
                          {fmt(f.min, f.moneda)}
                        </span>
                        {f.prom != null && f.prom !== f.min && (
                          <span className="text-gray-400 text-xs">
                            {" "}
                            (prom {fmt(f.prom, f.moneda)})
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">
                    {fmt(f.precioRef, f.moneda)}
                  </td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {f.ultima ? fechaCorta(f.ultima) : "—"}
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    No hay productos en el catálogo todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Historial de revisiones */}
        <h2 className="font-semibold text-lg mb-3">Revisiones recientes</h2>
        <div className="grid gap-3">
          {revisiones.map((r) => (
            <div key={r.id} className="border rounded-xl bg-white p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {new Date(r.fecha).toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      ESTADO_BADGE[r.estado] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {r.estado}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {r.productosRevisados}/{r.productosObjetivo} productos ·{" "}
                  {r._count.cotizaciones} cotizaciones
                </div>
              </div>
              {r.resumen && (
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap line-clamp-4">
                  {r.resumen}
                </p>
              )}
            </div>
          ))}
          {revisiones.length === 0 && (
            <p className="text-sm text-gray-400">
              Aún no se ha ejecutado ninguna revisión. La tarea programada de
              Claude creará una cada día; también puedes cargar cotizaciones a
              mano con el botón de arriba.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function Tarjeta({
  titulo,
  valor,
  alerta,
}: {
  titulo: string;
  valor: number;
  alerta?: boolean;
}) {
  return (
    <div
      className={`border rounded-xl p-4 ${
        alerta ? "bg-red-50 border-red-200" : "bg-white"
      }`}
    >
      <div className="text-xs text-gray-500">{titulo}</div>
      <div
        className={`text-2xl font-bold mt-1 ${
          alerta ? "text-red-700" : "text-gray-900"
        }`}
      >
        {valor}
      </div>
    </div>
  );
}
