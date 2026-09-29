import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado } from "@/lib/mercadeo/http";

export const dynamic = "force-dynamic";

const EDITABLE = ["BORRADOR", "RECHAZADO"];

// GET /api/mercadeo/planes/[id]
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const plan = await prisma.planSemanal.findFirst({
    where: { id: params.id, empresaId: actor.empresaId },
    include: { proyectoVenta: true, piezas: { orderBy: { orden: "asc" } } },
  });
  if (!plan) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { tokenAprobacionHash: _omitido, ...resto } = plan;
  return NextResponse.json(resto);
}

const edicionSchema = z.object({
  piezaId: z.string().min(1),
  titular: z.string().trim().min(1).max(120).optional(),
  copy: z.string().trim().min(1).max(2200).optional(),
  cta: z.string().trim().min(1).max(80).optional(),
  hashtags: z.string().trim().max(500).optional(),
  pagada: z.boolean().optional(),
  presupuesto: z.number().nonnegative().optional(),
  imagenFondo: z.string().max(1000).optional(), // "" = sin foto
});

// PATCH /api/mercadeo/planes/[id] -> editar el contenido de una pieza antes de enviarlo
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const parsed = edicionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  const plan = await prisma.planSemanal.findFirst({ where: { id: params.id, empresaId: actor.empresaId } });
  if (!plan) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!EDITABLE.includes(plan.estado)) {
    return NextResponse.json({ error: "Solo se pueden editar planes en borrador o rechazados." }, { status: 409 });
  }
  const { piezaId, ...cambios } = parsed.data;
  if (cambios.imagenFondo) {
    const proyecto = await prisma.proyectoVenta.findUnique({ where: { id: plan.proyectoVentaId }, select: { imagenes: true, imagenUrl: true } });
    const permitidas = [...(proyecto?.imagenes ?? []), ...(proyecto?.imagenUrl ? [proyecto.imagenUrl] : [])];
    if (!permitidas.includes(cambios.imagenFondo)) {
      return NextResponse.json({ error: "La imagen debe ser una de la galería del proyecto." }, { status: 400 });
    }
  }
  if (cambios.pagada === false) cambios.presupuesto = 0;
  const r = await prisma.piezaPlan.updateMany({ where: { id: piezaId, planId: plan.id }, data: cambios });
  if (r.count === 0) return NextResponse.json({ error: "Pieza no encontrada" }, { status: 404 });

  // El total del plan siempre refleja la suma de lo que se va a pautar.
  const piezas = await prisma.piezaPlan.findMany({ where: { planId: plan.id, pagada: true }, select: { presupuesto: true } });
  await prisma.planSemanal.update({
    where: { id: plan.id },
    data: { presupuestoTotal: piezas.reduce((a, p) => a + p.presupuesto, 0) },
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/mercadeo/planes/[id] -> descartar un plan no aprobado
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const r = await prisma.planSemanal.deleteMany({
    where: { id: params.id, empresaId: actor.empresaId, estado: { in: ["BORRADOR", "RECHAZADO", "PENDIENTE_APROBACION"] } },
  });
  if (r.count === 0) {
    return NextResponse.json({ error: "No encontrado o ya aprobado (no se puede borrar)." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
