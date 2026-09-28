import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado } from "@/lib/mercadeo/http";
import { analisisDeEmpresa } from "@/lib/mercadeo/servicio";

export const dynamic = "force-dynamic";

const entero = z.number().int().nonnegative().default(0);

const filaSchema = z.object({
  plataforma: z.enum(["FACEBOOK", "INSTAGRAM"]),
  fechaPublicacion: z.coerce.date(),
  horaConocida: z.boolean().default(true),
  formato: z.enum(["IMAGEN", "CARRUSEL", "VIDEO", "REEL", "HISTORIA"]).default("IMAGEN"),
  pagada: z.boolean().default(false),
  texto: z.string().max(2000).nullable().optional(),
  alcance: entero,
  impresiones: entero,
  interacciones: entero,
  clics: entero,
  leads: entero,
  mensajes: entero,
  gasto: z.number().nonnegative().default(0),
  moneda: z.string().length(3).default("COP"),
  proyectoVentaId: z.string().nullable().optional(),
});

const cargaSchema = z.object({
  publicaciones: z.array(filaSchema).max(2000).default([]),
  seguidores: z
    .array(z.object({ plataforma: z.enum(["FACEBOOK", "INSTAGRAM"]), seguidores: z.number().int().nonnegative(), fecha: z.coerce.date().optional() }))
    .max(10)
    .default([]),
});

// GET /api/mercadeo/metricas?presupuesto=  -> análisis actual de las redes
export async function GET(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const { searchParams } = new URL(req.url);
  const presupuesto = Math.max(0, Number(searchParams.get("presupuesto") ?? "0") || 0);
  return NextResponse.json(await analisisDeEmpresa(actor.empresaId, presupuesto));
}

// POST /api/mercadeo/metricas -> carga manual (p. ej. desde CSV exportado de Meta Business Suite)
export async function POST(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const parsed = cargaSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  const { publicaciones, seguidores } = parsed.data;

  // Un proyecto de venta ajeno a la empresa no se puede asociar.
  const idsProyecto = Array.from(new Set(publicaciones.map((p) => p.proyectoVentaId).filter(Boolean))) as string[];
  if (idsProyecto.length) {
    const propios = await prisma.proyectoVenta.count({ where: { id: { in: idsProyecto }, empresaId: actor.empresaId } });
    if (propios !== idsProyecto.length) return NextResponse.json({ error: "Proyecto de venta inválido" }, { status: 400 });
  }

  const [creadas] = await prisma.$transaction([
    prisma.metricaPublicacion.createMany({
      data: publicaciones.map((p) => ({ ...p, empresaId: actor.empresaId, fuente: "MANUAL" as const })),
    }),
    prisma.snapshotCuenta.createMany({
      data: seguidores.map((s) => ({ ...s, fecha: s.fecha ?? new Date(), empresaId: actor.empresaId, fuente: "MANUAL" as const })),
    }),
  ]);
  return NextResponse.json({ publicaciones: creadas.count, seguidores: seguidores.length }, { status: 201 });
}
