import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function igual(a: string, b: string) {
  const ba = Buffer.from(a.trim());
  const bb = Buffer.from(b.trim());
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// GET /api/mercadeo/exportar  (Authorization: Bearer <EXPORTAR_SECRETO>)
// Exportación temporal para migrar el mercadeo a la app independiente Marketing Oasis.
// Devuelve solo datos de mercadeo (sin usuarios ni contraseñas). Deshabilitada si
// EXPORTAR_SECRETO no está definido; bórralo al terminar la migración.
export async function GET(req: Request) {
  const secreto = process.env.EXPORTAR_SECRETO;
  const header = req.headers.get("authorization") ?? "";
  if (!secreto || secreto.trim().length < 20 || !header.startsWith("Bearer ") || !igual(header.slice(7), secreto)) {
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Empresa del mercadeo: la indicada o la que más proyectos de venta tiene.
  const empresaId =
    process.env.MERCADEO_EMPRESA_ID ||
    (
      await prisma.proyectoVenta.groupBy({
        by: ["empresaId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 1,
      })
    )[0]?.empresaId;
  if (!empresaId) return NextResponse.json({ error: "No hay proyectos de mercadeo." }, { status: 404 });

  const [empresa, proyectos, metricas, snapshots, planes] = await Promise.all([
    prisma.empresa.findUniqueOrThrow({
      where: { id: empresaId },
      select: { id: true, nombre: true, logoUrl: true, colorPrimario: true, colorOscuro: true, colorAcento: true },
    }),
    prisma.proyectoVenta.findMany({ where: { empresaId } }),
    prisma.metricaPublicacion.findMany({ where: { empresaId } }),
    prisma.snapshotCuenta.findMany({ where: { empresaId } }),
    prisma.planSemanal.findMany({ where: { empresaId }, include: { piezas: true } }),
  ]);
  const piezas = planes.flatMap((p) => p.piezas);
  return NextResponse.json({
    version: 1,
    empresa,
    proyectos,
    metricas,
    snapshots,
    planes: planes.map(({ piezas: _p, tokenAprobacionHash: _t, ...p }) => p),
    piezas,
  });
}
