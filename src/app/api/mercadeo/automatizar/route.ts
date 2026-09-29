import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado } from "@/lib/mercadeo/http";
import { estadoConfiguracionMeta, publicarInstagramPendientes, sincronizarMetricas } from "@/lib/mercadeo/meta";
import { enviarAprobacion, generarPlan } from "@/lib/mercadeo/servicio";
import { proximoLunes } from "@/lib/mercadeo/fechas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Accion = "sincronizar" | "planificar" | "publicar";
const ACCIONES = ["sincronizar", "planificar", "publicar"] as const;

const schema = z.object({
  acciones: z.array(z.enum(ACCIONES)).min(1).default([...ACCIONES]),
});

async function planificarEmpresa(empresaId: string) {
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
  return planes;
}

/**
 * Ejecuta las acciones para las empresas indicadas.
 *  - sincronizar: trae métricas frescas de Meta (la cuenta de Meta configurada
 *    pertenece a una sola empresa: MERCADEO_EMPRESA_ID, o la única con proyectos)
 *  - planificar: por cada proyecto activo genera el plan de la próxima semana
 *    (si aún no existe) y lo envía a MERCADEO_EMAIL_APROBACION
 *  - publicar: publica en Instagram las piezas aprobadas cuya hora llegó
 */
async function ejecutar(empresas: string[], acciones: Accion[]) {
  const salida: Record<string, unknown> = { empresas };
  if (acciones.includes("sincronizar")) {
    const empresaMeta = process.env.MERCADEO_EMPRESA_ID || (empresas.length === 1 ? empresas[0] : null);
    salida.sincronizar = !estadoConfiguracionMeta().token
      ? { omitido: "Meta no configurado" }
      : !empresaMeta
        ? { omitido: "Varias empresas con proyectos: define MERCADEO_EMPRESA_ID para saber a cuál pertenece la cuenta de Meta" }
        : await sincronizarMetricas(empresaMeta).catch((e) => ({ error: e.message }));
  }
  if (acciones.includes("planificar")) {
    const planes: Record<string, unknown> = {};
    for (const empresaId of empresas) planes[empresaId] = await planificarEmpresa(empresaId);
    salida.planificar = planes;
  }
  if (acciones.includes("publicar")) {
    salida.publicar = await publicarInstagramPendientes().catch((e) => ({ error: e.message }));
  }
  return salida;
}

// POST /api/mercadeo/automatizar  (sesión o Bearer MERCADEO_CRON_SECRET) -> empresa del actor
export async function POST(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  return NextResponse.json(await ejecutar([actor.empresaId], parsed.data.acciones));
}

function secretoValido(header: string, secreto: string | undefined) {
  if (!secreto) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secreto}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * GET /api/mercadeo/automatizar?acciones=publicar  — para Vercel Cron (ver vercel.json).
 * Vercel envía `Authorization: Bearer $CRON_SECRET`; también se acepta MERCADEO_CRON_SECRET.
 * Opera sobre MERCADEO_EMPRESA_ID o, si no está definido, sobre todas las
 * empresas que tienen proyectos de venta activos.
 */
export async function GET(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  if (!secretoValido(header, process.env.CRON_SECRET) && !secretoValido(header, process.env.MERCADEO_CRON_SECRET)) {
    return noAutorizado();
  }
  const pedidas = (new URL(req.url).searchParams.get("acciones") ?? "").split(",").filter(Boolean);
  const parsed = schema.safeParse({ acciones: pedidas.length ? pedidas : undefined });
  if (!parsed.success) return datosInvalidos(parsed.error);

  const empresas = process.env.MERCADEO_EMPRESA_ID
    ? [process.env.MERCADEO_EMPRESA_ID]
    : Array.from(
        new Set(
          (await prisma.proyectoVenta.findMany({ where: { activo: true }, select: { empresaId: true } })).map((p) => p.empresaId)
        )
      );
  return NextResponse.json(await ejecutar(empresas, parsed.data.acciones));
}
