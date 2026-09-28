import { NextResponse } from "next/server";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { noAutorizado, respuestaError } from "@/lib/mercadeo/http";
import { sincronizarMetricas } from "@/lib/mercadeo/meta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/mercadeo/metricas/sincronizar -> trae métricas de Facebook, Instagram y anuncios
export async function POST(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  try {
    return NextResponse.json(await sincronizarMetricas(actor.empresaId));
  } catch (error) {
    return respuestaError(error);
  }
}
