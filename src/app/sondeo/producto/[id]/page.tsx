import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/nav-bar";
import { SondeoConfigProducto } from "@/components/sondeo-config-producto";
import {
  SondeoCotizacionesTabla,
  type FilaCotizacion,
} from "@/components/sondeo-cotizaciones-tabla";

export const dynamic = "force-dynamic";

export default async function SondeoProductoPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const producto = await prisma.producto.findUnique({
    where: { id: params.id },
    include: {
      categoria: { select: { nombre: true } },
      proveedor: { select: { nombre: true } },
      cotizacionesMercado: {
        include: { capturadoPor: { select: { nombre: true } } },
        orderBy: { fechaRevision: "desc" },
        take: 500,
      },
    },
  });
  if (!producto) notFound();

  const cotiz = producto.cotizacionesMercado;
  const conPrecio = cotiz
    .filter((c) => c.precioUnit != null)
    .map((c) => ({ precio: c.precioUnit as number, fecha: c.fechaRevision }));
  const precios = conPrecio.map((c) => c.precio);
  const min = precios.length ? Math.min(...precios) : null;
  const max = precios.length ? Math.max(...precios) : null;
  const prom = precios.length
    ? precios.reduce((a, b) => a + b, 0) / precios.length
    : null;

  const terminos = [producto.nombre, producto.marca, producto.modelo]
    .filter(Boolean)
    .join(" ");
  const urlAlibaba = `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(
    terminos
  )}`;

  const filas: FilaCotizacion[] = cotiz.map((c) => ({
    id: c.id,
    fechaRevision: c.fechaRevision.toISOString(),
    fuente: c.fuente,
    proveedorNombre: c.proveedorNombre,
    proveedorPais: c.proveedorPais,
    proveedorUrl: c.proveedorUrl,
    precioUnit: c.precioUnit,
    moneda: c.moneda,
    unidad: c.unidad,
    moq: c.moq,
    incoterm: c.incoterm,
    tiempoEntregaDias: c.tiempoEntregaDias,
    notas: c.notas,
    capturadoPor: c.capturadoPor?.nombre ?? null,
  }));

  // mini-serie de precios (orden cronológico, hasta 40 puntos)
  const serie = [...conPrecio].reverse().slice(-40);

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/sondeo" className="text-sm text-brand-700 hover:underline">
          ← Volver al sondeo
        </Link>

        <div className="mt-3 mb-6">
          <h1 className="text-2xl font-bold">{producto.nombre}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {[producto.marca, producto.modelo].filter(Boolean).join(" · ")}
            {producto.categoria ? ` — ${producto.categoria.nombre}` : ""} · unidad:{" "}
            {producto.unidad} · catálogo de {producto.proveedor.nombre}
          </p>
        </div>

        <div className="border rounded-xl bg-white p-4 mb-6">
          <SondeoConfigProducto
            productoId={producto.id}
            seguimientoActivo={producto.seguimientoActivo}
            minCotizaciones={producto.minCotizaciones}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat titulo="Cotizaciones registradas" valor={String(cotiz.length)} />
          <Stat
            titulo="Precio mínimo"
            valor={min != null ? `${producto.moneda} ${min.toLocaleString()}` : "—"}
          />
          <Stat
            titulo="Precio promedio"
            valor={
              prom != null
                ? `${producto.moneda} ${prom.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}`
                : "—"
            }
          />
          <Stat
            titulo="Precio ref. catálogo"
            valor={
              producto.precioRef != null
                ? `${producto.moneda} ${producto.precioRef.toLocaleString()}`
                : "—"
            }
          />
        </div>

        {serie.length >= 2 && min != null && max != null && (
          <div className="border rounded-xl bg-white p-4 mb-6">
            <div className="text-xs text-gray-500 mb-2">
              Evolución del precio unitario ({serie.length} puntos)
            </div>
            <div className="flex items-end gap-1 h-24">
              {serie.map((p, i) => {
                const rango = max - min || 1;
                const h = 10 + ((p.precio - min) / rango) * 90;
                return (
                  <div
                    key={i}
                    title={`${producto.moneda} ${p.precio} — ${new Date(
                      p.fecha
                    ).toLocaleDateString("es-CO")}`}
                    className="flex-1 bg-brand-400 rounded-t"
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold text-lg">Cotizaciones de mercado</h2>
          <div className="flex gap-2 text-sm">
            <a
              href={urlAlibaba}
              target="_blank"
              rel="noopener noreferrer"
              className="border px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              Buscar en Alibaba ↗
            </a>
            <Link
              href={`/sondeo/nueva-cotizacion?productoId=${producto.id}`}
              className="bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700"
            >
              + Cargar cotización
            </Link>
          </div>
        </div>

        <SondeoCotizacionesTabla filas={filas} />
      </div>
    </main>
  );
}

function Stat({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="border rounded-xl bg-white p-4">
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className="text-lg font-bold mt-1">{valor}</div>
    </div>
  );
}
