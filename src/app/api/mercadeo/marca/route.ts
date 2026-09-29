import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado } from "@/lib/mercadeo/http";

export const dynamic = "force-dynamic";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (usa formato #RRGGBB)").nullable().optional();

const schema = z.object({
  colorPrimario: color,
  colorOscuro: color,
  colorAcento: color,
});

const CAMPOS = { logoUrl: true, colorPrimario: true, colorOscuro: true, colorAcento: true } as const;

// GET /api/mercadeo/marca -> kit de marca de la empresa
export async function GET(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  return NextResponse.json(await prisma.empresa.findUnique({ where: { id: actor.empresaId }, select: CAMPOS }));
}

// PATCH /api/mercadeo/marca -> actualizar colores (solo administradores de la empresa)
export async function PATCH(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  if (actor.tipo === "usuario" && actor.rolEmpresa !== "ADMIN_EMPRESA") {
    return NextResponse.json({ error: "Solo un administrador de la empresa puede cambiar el kit de marca." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  const data = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, typeof v === "string" ? v.toLowerCase() : v])
  );
  return NextResponse.json(await prisma.empresa.update({ where: { id: actor.empresaId }, data, select: CAMPOS }));
}
