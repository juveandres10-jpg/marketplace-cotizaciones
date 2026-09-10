import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarSondeo } from "@/lib/sondeo-auth";

export const dynamic = "force-dynamic";

// GET /api/sondeo/revisiones?limit=30  -> historial de corridas
export async function GET(req: Request) {
  const actor = await autorizarSondeo(req);
  if (!actor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") ?? "30")));

  const revisiones = await prisma.revisionDiaria.findMany({
    orderBy: { fecha: "desc" },
    take: limit,
    include: { _count: { select: { cotizaciones: true } } },
  });

  return NextResponse.json(revisiones);
}

const crearSchema = z.object({
  minPorProducto: z.number().int().positive().max(50).optional(),
  productosObjetivo: z.number().int().nonnegative().optional(),
  resumen: z.string().max(10_000).optional(),
});

// POST /api/sondeo/revisiones  -> abre una corrida (estado EN_PROGRESO)
export async function POST(req: Request) {
  const actor = await autorizarSondeo(req);
  if (!actor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = crearSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detalle: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const revision = await prisma.revisionDiaria.create({
    data: {
      estado: "EN_PROGRESO",
      minPorProducto: parsed.data.minPorProducto ?? 5,
      productosObjetivo: parsed.data.productosObjetivo ?? 0,
      resumen: parsed.data.resumen,
    },
  });

  return NextResponse.json(revision, { status: 201 });
}
