import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado } from "@/lib/mercadeo/http";
import { proyectoVentaSchema } from "@/lib/mercadeo/esquemas";

export const dynamic = "force-dynamic";

// PATCH /api/mercadeo/proyectos/[id] -> actualiza datos del proyecto de venta
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const parsed = proyectoVentaSchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  const r = await prisma.proyectoVenta.updateMany({
    where: { id: params.id, empresaId: actor.empresaId },
    data: parsed.data,
  });
  if (r.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(await prisma.proyectoVenta.findUnique({ where: { id: params.id } }));
}
