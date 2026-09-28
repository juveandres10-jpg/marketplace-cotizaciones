import { NextResponse } from "next/server";
import { z } from "zod";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado, respuestaError } from "@/lib/mercadeo/http";
import { enviarAprobacion } from "@/lib/mercadeo/servicio";

export const dynamic = "force-dynamic";

const schema = z.object({
  destinatarios: z.array(z.string().trim().email()).min(1).max(10).optional(),
});

// POST /api/mercadeo/planes/[id]/enviar -> envía el informe por correo para aprobación
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);

  const destinatarios =
    parsed.data.destinatarios ??
    (process.env.MERCADEO_EMAIL_APROBACION ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (destinatarios.length === 0) {
    return NextResponse.json(
      { error: "Indica al menos un correo de aprobación (o configura MERCADEO_EMAIL_APROBACION)." },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await enviarAprobacion({ empresaId: actor.empresaId, planId: params.id, destinatarios }));
  } catch (error) {
    return respuestaError(error);
  }
}
