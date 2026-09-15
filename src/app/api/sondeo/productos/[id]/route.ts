import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarSondeo } from "@/lib/sondeo-auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  seguimientoActivo: z.boolean().optional(),
  minCotizaciones: z.number().int().min(1).max(50).optional(),
  fleteEstimadoUnit: z.number().nonnegative().nullable().optional(),
  fleteEstimadoDestino: z.string().max(200).nullable().optional(),
  fleteEstimadoNotas: z.string().max(1000).nullable().optional(),
});

// PATCH /api/sondeo/productos/[id]  -> configura el seguimiento de un producto
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const actor = await autorizarSondeo(req);
  if (!actor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: "Datos inválidos", detalle: parsed.success ? "sin cambios" : parsed.error.flatten() },
      { status: 400 }
    );
  }

  const producto = await prisma.producto
    .update({ where: { id: params.id }, data: parsed.data })
    .catch(() => null);
  if (!producto) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json({
    id: producto.id,
    seguimientoActivo: producto.seguimientoActivo,
    minCotizaciones: producto.minCotizaciones,
    fleteEstimadoUnit: producto.fleteEstimadoUnit,
    fleteEstimadoDestino: producto.fleteEstimadoDestino,
    fleteEstimadoNotas: producto.fleteEstimadoNotas,
  });
}
