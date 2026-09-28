import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { noAutorizado, respuestaError } from "@/lib/mercadeo/http";
import { publicarPlanEnMeta } from "@/lib/mercadeo/meta";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/mercadeo/planes/[id]/publicar -> reintenta enviar a Meta un plan YA aprobado
// (p. ej. después de conectar Meta o corregir un error). Solo ADMIN_EMPRESA.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  if (actor.tipo === "usuario" && actor.rolEmpresa !== "ADMIN_EMPRESA") {
    return NextResponse.json({ error: "Solo un administrador de la empresa puede publicar." }, { status: 403 });
  }
  const plan = await prisma.planSemanal.findFirst({ where: { id: params.id, empresaId: actor.empresaId } });
  if (!plan) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (plan.estado !== "APROBADO" && plan.estado !== "PUBLICADO") {
    return NextResponse.json({ error: "El plan debe estar aprobado por correo antes de publicarse." }, { status: 409 });
  }
  try {
    return NextResponse.json({ resultados: await publicarPlanEnMeta(plan.id) });
  } catch (error) {
    return respuestaError(error);
  }
}
