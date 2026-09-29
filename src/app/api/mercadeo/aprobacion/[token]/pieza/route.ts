import { NextResponse } from "next/server";
import { z } from "zod";
import { corregirPiezaPorToken } from "@/lib/mercadeo/aprobacion";
import { datosInvalidos, respuestaError } from "@/lib/mercadeo/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  orden: z.number().int().positive(),
  nombre: z.string().trim().min(2).max(200),
  nota: z.string().trim().max(1000).optional(),
  imagenFondo: z.string().max(1000).optional(),
});

// POST /api/mercadeo/aprobacion/[token]/pieza -> corrige una sola pieza sin decidir el plan
// (el enlace sigue vigente para revisar el resultado y aprobar al final).
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  try {
    return NextResponse.json(await corregirPiezaPorToken({ token: params.token, ...parsed.data }));
  } catch (error) {
    return respuestaError(error);
  }
}
