import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado, respuestaError } from "@/lib/mercadeo/http";
import { generarPlan } from "@/lib/mercadeo/servicio";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // la redacción con Claude puede tardar

// GET /api/mercadeo/planes -> planes recientes de la empresa
export async function GET(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const planes = await prisma.planSemanal.findMany({
    where: { empresaId: actor.empresaId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { proyectoVenta: { select: { nombre: true } }, _count: { select: { piezas: true } } },
  });
  return NextResponse.json(planes);
}

const schema = z.object({
  proyectoVentaId: z.string().min(1),
  presupuestoSemanal: z.number().nonnegative().optional(),
});

// POST /api/mercadeo/planes -> analiza métricas y genera el plan de la próxima semana
export async function POST(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  try {
    const plan = await generarPlan({
      empresaId: actor.empresaId,
      proyectoVentaId: parsed.data.proyectoVentaId,
      presupuestoSemanal: parsed.data.presupuestoSemanal,
      creadoPorId: actor.tipo === "usuario" ? actor.id : null,
    });
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return respuestaError(error);
  }
}
