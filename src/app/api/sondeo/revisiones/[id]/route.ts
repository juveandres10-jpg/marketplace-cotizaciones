import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarSondeo } from "@/lib/sondeo-auth";

export const dynamic = "force-dynamic";

// GET /api/sondeo/revisiones/[id]  -> una corrida con sus cotizaciones
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const actor = await autorizarSondeo(req);
  if (!actor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const revision = await prisma.revisionDiaria.findUnique({
    where: { id: params.id },
    include: {
      cotizaciones: {
        include: { producto: { select: { id: true, nombre: true, unidad: true } } },
        orderBy: [{ productoId: "asc" }, { precioUnit: "asc" }],
      },
    },
  });

  if (!revision) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  return NextResponse.json(revision);
}

const actualizarSchema = z.object({
  estado: z.enum(["EN_PROGRESO", "COMPLETADA", "PARCIAL", "FALLIDA"]).optional(),
  productosObjetivo: z.number().int().nonnegative().optional(),
  productosRevisados: z.number().int().nonnegative().optional(),
  cotizacionesNuevas: z.number().int().nonnegative().optional(),
  resumen: z.string().max(20_000).optional(),
  detalle: z.any().optional(),
});

// PATCH /api/sondeo/revisiones/[id]  -> cierra/actualiza la corrida
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const actor = await autorizarSondeo(req);
  if (!actor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = actualizarSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detalle: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existe = await prisma.revisionDiaria.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!existe) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const revision = await prisma.revisionDiaria.update({
    where: { id: params.id },
    data: {
      estado: parsed.data.estado,
      productosObjetivo: parsed.data.productosObjetivo,
      productosRevisados: parsed.data.productosRevisados,
      cotizacionesNuevas: parsed.data.cotizacionesNuevas,
      resumen: parsed.data.resumen,
      detalle:
        parsed.data.detalle === undefined ? undefined : parsed.data.detalle,
    },
  });

  return NextResponse.json(revision);
}
