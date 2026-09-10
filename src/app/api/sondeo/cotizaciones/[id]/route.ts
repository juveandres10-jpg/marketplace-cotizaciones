import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarSondeo } from "@/lib/sondeo-auth";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  proveedorNombre: z.string().min(1).max(300).optional(),
  proveedorPais: z.string().max(120).nullable().optional(),
  proveedorUrl: z.string().url().max(2000).nullable().optional(),
  precioUnit: z.number().positive().nullable().optional(),
  moneda: z.string().max(10).optional(),
  unidad: z.string().max(40).optional(),
  moq: z.number().positive().nullable().optional(),
  incoterm: z.string().max(20).nullable().optional(),
  tiempoEntregaDias: z.number().int().positive().max(3650).nullable().optional(),
  notas: z.string().max(4000).nullable().optional(),
});

// PATCH /api/sondeo/cotizaciones/[id]  -> corregir una cotización de mercado
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const actor = await autorizarSondeo(req);
  if (!actor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detalle: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existe = await prisma.cotizacionMercado.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!existe) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const actualizada = await prisma.cotizacionMercado.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json(actualizada);
}

// DELETE /api/sondeo/cotizaciones/[id]
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const actor = await autorizarSondeo(req);
  if (!actor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const borrada = await prisma.cotizacionMercado
    .delete({ where: { id: params.id } })
    .catch(() => null);
  if (!borrada) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  if (borrada.revisionId) {
    await prisma.revisionDiaria.update({
      where: { id: borrada.revisionId },
      data: { cotizacionesNuevas: { decrement: 1 } },
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
