import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autorizarSondeo } from "@/lib/sondeo-auth";

export const dynamic = "force-dynamic";

// GET /api/sondeo/worklist?dias=1&soloFaltantes=true
//
// Lista de trabajo del sondeo diario: por cada producto en seguimiento,
// cuántas cotizaciones de mercado tiene en la ventana de `dias` y cuántas
// le faltan para llegar a su objetivo (`minCotizaciones`, def. 5).
export async function GET(req: Request) {
  const actor = await autorizarSondeo(req);
  if (!actor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dias = Math.max(1, Math.min(90, Number(searchParams.get("dias") ?? "1")));
  const soloFaltantes = searchParams.get("soloFaltantes") !== "false";
  const desde = new Date(Date.now() - dias * 86_400_000);

  const productos = await prisma.producto.findMany({
    where: { seguimientoActivo: true },
    include: {
      categoria: { select: { nombre: true } },
      proveedor: { select: { nombre: true } },
      cotizacionesMercado: {
        where: { fechaRevision: { gte: desde } },
        select: {
          precioUnit: true,
          moneda: true,
          proveedorNombre: true,
          proveedorPais: true,
          fechaRevision: true,
        },
        orderBy: { fechaRevision: "desc" },
      },
    },
    orderBy: { nombre: "asc" },
  });

  const items = productos.map((p) => {
    const recientes = p.cotizacionesMercado;
    const precios = recientes
      .map((c) => c.precioUnit)
      .filter((x): x is number => x != null);
    const min = precios.length ? Math.min(...precios) : null;
    const max = precios.length ? Math.max(...precios) : null;
    const promedio = precios.length
      ? precios.reduce((a, b) => a + b, 0) / precios.length
      : null;
    const faltantes = Math.max(0, p.minCotizaciones - recientes.length);
    const terminos = [p.nombre, p.marca, p.modelo].filter(Boolean).join(" ");

    return {
      productoId: p.id,
      nombre: p.nombre,
      marca: p.marca,
      modelo: p.modelo,
      unidad: p.unidad,
      categoria: p.categoria?.nombre ?? null,
      proveedorCatalogo: p.proveedor.nombre,
      moneda: p.moneda,
      precioRef: p.precioRef,
      minCotizaciones: p.minCotizaciones,
      cotizacionesEnVentana: recientes.length,
      faltantes,
      terminosBusqueda: terminos,
      urlBusquedaAlibaba: `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(
        terminos
      )}`,
      precioMercado: { min, max, promedio, muestras: precios.length },
      proveedoresRecientes: recientes.slice(0, 10).map((c) => ({
        nombre: c.proveedorNombre,
        pais: c.proveedorPais,
        precioUnit: c.precioUnit,
        moneda: c.moneda,
        fecha: c.fechaRevision,
      })),
    };
  });

  const lista = soloFaltantes ? items.filter((i) => i.faltantes > 0) : items;

  return NextResponse.json({
    generadoEn: new Date().toISOString(),
    ventanaDias: dias,
    totalProductosSeguimiento: productos.length,
    productosPendientes: items.filter((i) => i.faltantes > 0).length,
    cotizacionesFaltantesTotales: lista.reduce((a, i) => a + i.faltantes, 0),
    items: lista,
  });
}
