import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado } from "@/lib/mercadeo/http";
import { proyectoVentaSchema } from "@/lib/mercadeo/esquemas";

export const dynamic = "force-dynamic";

// GET /api/mercadeo/proyectos -> proyectos de venta de la empresa
export async function GET(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const proyectos = await prisma.proyectoVenta.findMany({
    where: { empresaId: actor.empresaId },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });
  return NextResponse.json(proyectos);
}

// POST /api/mercadeo/proyectos -> crea un proyecto de venta
export async function POST(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const parsed = proyectoVentaSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  const proyecto = await prisma.proyectoVenta.create({
    data: { ...parsed.data, empresaId: actor.empresaId },
  });
  return NextResponse.json(proyecto, { status: 201 });
}
