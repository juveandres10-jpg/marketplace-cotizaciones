import { NextResponse } from "next/server";
import { z } from "zod";
import { decidirPlan } from "@/lib/mercadeo/aprobacion";
import { datosInvalidos, respuestaError } from "@/lib/mercadeo/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  decision: z.enum(["aprobar", "rechazar", "corregir"]),
  nombre: z.string().trim().min(2).max(200),
  comentario: z.string().trim().max(4000).optional(),
});

// POST /api/mercadeo/aprobacion/[token] -> aprobar o rechazar (el token del correo es la credencial).
// Se exige POST (no basta abrir el enlace) para que los antivirus de correo que
// visitan los links no aprueben planes por accidente.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  if (parsed.data.decision !== "aprobar" && !parsed.data.comentario) {
    return NextResponse.json({ error: "Escribe qué hay que corregir para poder ajustar el plan." }, { status: 400 });
  }
  try {
    return NextResponse.json(await decidirPlan({ token: params.token, ...parsed.data }));
  } catch (error) {
    return respuestaError(error);
  }
}
