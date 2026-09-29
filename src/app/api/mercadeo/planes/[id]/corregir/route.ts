import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado, respuestaError } from "@/lib/mercadeo/http";
import { aplicarCorrecciones } from "@/lib/mercadeo/correcciones";
import { enviarAprobacion } from "@/lib/mercadeo/servicio";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  instrucciones: z.string().trim().min(3).max(2000),
  piezaId: z.string().optional().nullable(),
  reenviar: z.boolean().default(true),
});

const CORREGIBLE = ["BORRADOR", "RECHAZADO", "PENDIENTE_APROBACION"];

// POST /api/mercadeo/planes/[id]/corregir -> aplica correcciones en lenguaje
// natural (con IA) y, opcionalmente, reenvía el plan corregido a aprobación.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);

  const plan = await prisma.planSemanal.findFirst({
    where: { id: params.id, empresaId: actor.empresaId },
    include: { creadoPor: { select: { nombre: true } } },
  });
  if (!plan) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!CORREGIBLE.includes(plan.estado)) {
    return NextResponse.json({ error: "El plan ya fue aprobado; las correcciones aplican antes de aprobar." }, { status: 409 });
  }

  try {
    const autor = actor.tipo === "usuario"
      ? (await prisma.usuario.findUnique({ where: { id: actor.id }, select: { nombre: true } }))?.nombre ?? "Equipo"
      : "Tarea automática";
    const resultado = await aplicarCorrecciones({
      planId: plan.id,
      instrucciones: parsed.data.instrucciones,
      piezaId: parsed.data.piezaId,
      autor,
    });

    let envio: Awaited<ReturnType<typeof enviarAprobacion>> | null = null;
    const destinatarios = (plan.enviadoA || process.env.MERCADEO_EMAIL_APROBACION || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.data.reenviar && destinatarios.length) {
      envio = await enviarAprobacion({ empresaId: actor.empresaId, planId: plan.id, destinatarios });
    }
    return NextResponse.json({ ...resultado, envio });
  } catch (error) {
    return respuestaError(error);
  }
}
