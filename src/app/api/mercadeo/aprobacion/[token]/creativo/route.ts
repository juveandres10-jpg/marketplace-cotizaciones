import { NextResponse } from "next/server";
import { z } from "zod";
import { planPendientePorToken } from "@/lib/mercadeo/aprobacion";
import { analizarPiezaCreativa, aplicarPropuestaCreativa } from "@/lib/mercadeo/creativo";
import { ErrorMercadeo } from "@/lib/mercadeo/servicio";
import { datosInvalidos, respuestaError } from "@/lib/mercadeo/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  orden: z.number().int().positive(),
  accion: z.enum(["analizar", "aplicar"]),
  indice: z.number().int().min(0).max(2).optional(),
  nombre: z.string().trim().max(200).optional(),
});

// POST /api/mercadeo/aprobacion/[token]/creativo -> análisis creativo con IA de una pieza
// (o aplicar una de sus propuestas) desde el enlace de aprobación, sin decidir el plan.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  try {
    const plan = await planPendientePorToken(params.token);
    const pieza = plan.piezas.find((p) => p.orden === parsed.data.orden);
    if (!pieza) throw new ErrorMercadeo("Pieza no encontrada", 404);
    if (parsed.data.accion === "analizar") {
      await analizarPiezaCreativa(pieza.id);
      return NextResponse.json({ mensaje: `Pieza #${pieza.orden} analizada.` });
    }
    if (parsed.data.indice === undefined) throw new ErrorMercadeo("Falta la propuesta a aplicar.", 400);
    const nombre = parsed.data.nombre && parsed.data.nombre.length >= 2 ? parsed.data.nombre : "Quien aprueba";
    return NextResponse.json(await aplicarPropuestaCreativa({ piezaId: pieza.id, indice: parsed.data.indice, autor: nombre }));
  } catch (error) {
    return respuestaError(error);
  }
}
