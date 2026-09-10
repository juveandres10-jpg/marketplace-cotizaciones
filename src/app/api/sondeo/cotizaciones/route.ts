import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarSondeo } from "@/lib/sondeo-auth";

export const dynamic = "force-dynamic";

// GET /api/sondeo/cotizaciones?productoId=...&dias=90&limit=200
// Historial de cotizaciones de mercado de un producto (o de todos).
export async function GET(req: Request) {
  const actor = await autorizarSondeo(req);
  if (!actor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const productoId = searchParams.get("productoId") ?? undefined;
  const revisionId = searchParams.get("revisionId") ?? undefined;
  const dias = searchParams.get("dias") ? Number(searchParams.get("dias")) : null;
  const limit = Math.max(1, Math.min(500, Number(searchParams.get("limit") ?? "200")));

  const cotizaciones = await prisma.cotizacionMercado.findMany({
    where: {
      productoId,
      revisionId,
      ...(dias
        ? { fechaRevision: { gte: new Date(Date.now() - dias * 86_400_000) } }
        : {}),
    },
    include: {
      producto: { select: { id: true, nombre: true, unidad: true, moneda: true } },
      capturadoPor: { select: { nombre: true } },
    },
    orderBy: { fechaRevision: "desc" },
    take: limit,
  });

  return NextResponse.json(cotizaciones);
}

const itemSchema = z.object({
  productoId: z.string().min(1),
  proveedorNombre: z.string().min(1).max(300),
  proveedorPais: z.string().max(120).optional().nullable(),
  proveedorUrl: z.string().url().max(2000).optional().nullable(),
  precioUnit: z.number().positive().optional().nullable(),
  moneda: z.string().max(10).optional(),
  unidad: z.string().max(40).optional(),
  moq: z.number().positive().optional().nullable(),
  incoterm: z.string().max(20).optional().nullable(),
  tiempoEntregaDias: z.number().int().positive().max(3650).optional().nullable(),
  notas: z.string().max(4000).optional().nullable(),
  fuente: z.enum(["ALIBABA", "MANUAL", "OTRO"]).optional(),
});

const bodySchema = z.object({
  revisionId: z.string().optional().nullable(),
  proyectoId: z.string().optional().nullable(),
  fuente: z.enum(["ALIBABA", "MANUAL", "OTRO"]).optional(),
  items: z.array(itemSchema).min(1).max(200),
});

// POST /api/sondeo/cotizaciones  -> carga masiva de cotizaciones de mercado
export async function POST(req: Request) {
  const actor = await autorizarSondeo(req);
  if (!actor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detalle: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { revisionId, proyectoId, fuente, items } = parsed.data;

  // Validar que los productos existen
  const idsProducto = Array.from(new Set(items.map((i) => i.productoId)));
  const productos = await prisma.producto.findMany({
    where: { id: { in: idsProducto } },
    select: { id: true },
  });
  const validos = new Set(productos.map((p) => p.id));
  const invalidos = idsProducto.filter((id) => !validos.has(id));
  if (invalidos.length) {
    return NextResponse.json(
      { error: "Productos inexistentes", productoIds: invalidos },
      { status: 400 }
    );
  }

  if (revisionId) {
    const rev = await prisma.revisionDiaria.findUnique({
      where: { id: revisionId },
      select: { id: true },
    });
    if (!rev) {
      return NextResponse.json(
        { error: "revisionId inexistente" },
        { status: 400 }
      );
    }
  }

  const capturadoPorId = actor.tipo === "usuario" ? actor.id : null;

  const creadas = await prisma.$transaction(async (tx) => {
    const res = await tx.cotizacionMercado.createMany({
      data: items.map((i) => ({
        productoId: i.productoId,
        proyectoId: proyectoId ?? null,
        revisionId: revisionId ?? null,
        fuente: i.fuente ?? fuente ?? "ALIBABA",
        proveedorNombre: i.proveedorNombre,
        proveedorPais: i.proveedorPais ?? null,
        proveedorUrl: i.proveedorUrl ?? null,
        precioUnit: i.precioUnit ?? null,
        moneda: i.moneda ?? "USD",
        unidad: i.unidad ?? "unidad",
        moq: i.moq ?? null,
        incoterm: i.incoterm ?? null,
        tiempoEntregaDias: i.tiempoEntregaDias ?? null,
        notas: i.notas ?? null,
        capturadoPorId,
      })),
    });

    if (revisionId) {
      await tx.revisionDiaria.update({
        where: { id: revisionId },
        data: { cotizacionesNuevas: { increment: res.count } },
      });
    }
    return res.count;
  });

  return NextResponse.json({ creadas }, { status: 201 });
}
