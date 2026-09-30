import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { analizarPiezaCreativa, aplicarPropuestaCreativa } from "@/lib/mercadeo/creativo";
import { ErrorMercadeo } from "@/lib/mercadeo/servicio";
import { datosInvalidos, respuestaError } from "@/lib/mercadeo/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  accion: z.enum(["analizar", "aplicar"]),
  indice: z.number().int().min(0).max(2).optional(),
});

// POST /api/mercadeo/piezas/[id]/creativo -> análisis creativo con IA (diagrama + propuestas)
// o aplicar una de las propuestas a la pieza.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await autorizarMercadeo(req);
  if (!actor || actor.tipo !== "usuario") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  try {
    const pieza = await prisma.piezaPlan.findFirst({
      where: { id: params.id, plan: { empresaId: actor.empresaId } },
      include: { plan: { select: { estado: true } } },
    });
    if (!pieza) throw new ErrorMercadeo("Pieza no encontrada", 404);
    if (parsed.data.accion === "analizar") {
      await analizarPiezaCreativa(pieza.id);
      return NextResponse.json({ mensaje: `Pieza #${pieza.orden} analizada.` });
    }
    if (pieza.plan.estado === "APROBADO" || pieza.plan.estado === "PUBLICADO") {
      throw new ErrorMercadeo("El plan ya fue aprobado; no se pueden cambiar sus piezas.", 409);
    }
    if (parsed.data.indice === undefined) throw new ErrorMercadeo("Falta la propuesta a aplicar.", 400);
    const usuario = await prisma.usuario.findUnique({ where: { id: actor.id }, select: { nombre: true, email: true } });
    return NextResponse.json(
      await aplicarPropuestaCreativa({
        piezaId: pieza.id,
        indice: parsed.data.indice,
        autor: usuario?.nombre || usuario?.email || "Equipo",
      }),
    );
  } catch (error) {
    return respuestaError(error);
  }
}
