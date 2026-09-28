import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado } from "@/lib/mercadeo/http";
import { estadoConfiguracionMeta, publicarInstagramPendientes, sincronizarMetricas } from "@/lib/mercadeo/meta";
import { enviarAprobacion, generarPlan } from "@/lib/mercadeo/servicio";
import { proximoLunes } from "@/lib/mercadeo/fechas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  acciones: z.array(z.enum(["sincronizar", "planificar", "publicar"])).min(1).default(["sincronizar", "planificar", "publicar"]),
});

/**
 * POST /api/mercadeo/automatizar  (tarea programada; Bearer MERCADEO_CRON_SECRET)
 *  - sincronizar: trae métricas frescas de Meta
 *  - planificar: por cada proyecto de venta activo genera el plan de la próxima
 *    semana (si aún no existe) y lo envía a MERCADEO_EMAIL_APROBACION
 *  - publicar: publica en Instagram las piezas aprobadas cuya hora llegó
 * Recomendado: "planificar" semanal (jueves/viernes) y "publicar" cada hora.
 */
export async function POST(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  const { acciones } = parsed.data;
  const empresaId = actor.empresaId;
  const salida: Record<string, unknown> = {};

  if (acciones.includes("sincronizar")) {
    salida.sincronizar = estadoConfiguracionMeta().token
      ? await sincronizarMetricas(empresaId).catch((e) => ({ error: e.message }))
      : { omitido: "Meta no configurado" };
  }

  if (acciones.includes("planificar")) {
    const semana = proximoLunes();
    const destinatarios = (process.env.MERCADEO_EMAIL_APROBACION ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const proyectos = await prisma.proyectoVenta.findMany({ where: { empresaId, activo: true } });
    const planes = [];
    for (const p of proyectos) {
      const existente = await prisma.planSemanal.findFirst({
        where: { proyectoVentaId: p.id, semanaInicio: semana },
        select: { id: true },
      });
      if (existente) {
        planes.push({ proyecto: p.nombre, planId: existente.id, omitido: "ya existe plan para esa semana" });
        continue;
      }
      try {
        const plan = await generarPlan({ empresaId, proyectoVentaId: p.id, semanaInicio: semana });
        const envio = destinatarios.length
          ? await enviarAprobacion({ empresaId, planId: plan.id, destinatarios })
          : { enviado: false, motivo: "MERCADEO_EMAIL_APROBACION no configurado" };
        planes.push({ proyecto: p.nombre, planId: plan.id, generadoCon: plan.generadoCon, envio });
      } catch (e: any) {
        planes.push({ proyecto: p.nombre, error: e.message });
      }
    }
    salida.planificar = planes;
  }

  if (acciones.includes("publicar")) {
    salida.publicar = await publicarInstagramPendientes().catch((e) => ({ error: e.message }));
  }

  return NextResponse.json(salida);
}
