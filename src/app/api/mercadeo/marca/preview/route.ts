import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { noAutorizado } from "@/lib/mercadeo/http";
import { generarImagenPieza } from "@/lib/mercadeo/imagen";

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{6}$/;

// GET /api/mercadeo/marca/preview?formato=IMAGEN|REEL&primario=&oscuro=&acento=
// Pieza de ejemplo con los colores elegidos (aún sin guardar), el logo actual y
// el primer proyecto activo de la empresa.
export async function GET(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const q = new URL(req.url).searchParams;
  const color = (k: string) => (HEX.test(q.get(k) ?? "") ? q.get(k) : null);

  const [empresa, proyecto] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: actor.empresaId }, select: { logoUrl: true } }),
    prisma.proyectoVenta.findFirst({ where: { empresaId: actor.empresaId }, orderBy: [{ activo: "desc" }, { createdAt: "asc" }] }),
  ]);
  const ejemplo = proyecto ?? {
    nombre: "Tu proyecto",
    tipoInmueble: "Apartamentos",
    ciudad: "Cúcuta",
    zona: null,
    precioDesde: 190000000,
    moneda: "COP",
    areaDesde: 70,
    habitaciones: "3 habitaciones, 2 baños",
    amenidades: null,
    diferenciales: "Aplica subsidio de caja de compensación",
    whatsapp: "573000000000",
    urlLanding: null,
    imagenUrl: null,
    imagenes: [],
  };
  const formato = q.get("formato") === "REEL" ? "REEL" : "IMAGEN";
  const png = await generarImagenPieza(
    {
      orden: 1,
      formato,
      titular: "Tu nuevo hogar te espera",
      cta: ejemplo.whatsapp ? "Escríbenos por WhatsApp" : "Conoce más",
      plataforma: "INSTAGRAM",
      tema: "Lanzamiento y ubicación del proyecto",
    },
    ejemplo,
    { logoUrl: empresa?.logoUrl, colorPrimario: color("primario"), colorOscuro: color("oscuro"), colorAcento: color("acento") }
  );
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}
