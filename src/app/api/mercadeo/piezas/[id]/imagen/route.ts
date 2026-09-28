import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generarImagenPieza } from "@/lib/mercadeo/imagen";

export const dynamic = "force-dynamic";

// GET /api/mercadeo/piezas/[id]/imagen -> PNG de la pieza.
// Público a propósito: es material publicitario, el correo de aprobación lo
// muestra y Instagram necesita descargarlo por URL para publicarlo.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const pieza = await prisma.piezaPlan.findUnique({
    where: { id: params.id },
    include: { plan: { include: { proyectoVenta: true } } },
  });
  if (!pieza) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const png = await generarImagenPieza(pieza, pieza.plan.proyectoVenta);
  const descargar = new URL(req.url).searchParams.has("descargar");
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300",
      ...(descargar
        ? { "Content-Disposition": `attachment; filename="pieza-${pieza.orden}-${pieza.plataforma.toLowerCase()}.png"` }
        : {}),
    },
  });
}
