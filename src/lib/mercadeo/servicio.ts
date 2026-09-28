// Orquestación con base de datos: generar plan, enviarlo a aprobación y
// registrar la decisión. Las rutas API y la tarea automática usan esto.

import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { analizarMetricas } from "./analisis";
import { planificarSemana } from "./planificador";
import { generarContenido } from "./estrategia";
import { proximoLunes } from "./fechas";
import { enviarPlanParaAprobacion } from "@/lib/email";

export const VENTANA_ANALISIS_DIAS = 90;
const VIGENCIA_TOKEN_DIAS = 7;

export function urlBase() {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function analisisDeEmpresa(empresaId: string, presupuestoSemanal: number, moneda = "COP") {
  const desde = new Date(Date.now() - VENTANA_ANALISIS_DIAS * 86_400_000);
  const [publicaciones, snapshots] = await Promise.all([
    prisma.metricaPublicacion.findMany({
      where: { empresaId, fechaPublicacion: { gte: desde } },
    }),
    prisma.snapshotCuenta.findMany({
      where: { empresaId, fecha: { gte: desde } },
      orderBy: { fecha: "asc" },
    }),
  ]);
  return analizarMetricas({
    publicaciones,
    snapshots,
    ventanaDias: VENTANA_ANALISIS_DIAS,
    presupuestoSemanal,
    moneda,
  });
}

export async function generarPlan(params: {
  empresaId: string;
  proyectoVentaId: string;
  creadoPorId?: string | null;
  presupuestoSemanal?: number;
  semanaInicio?: Date;
}) {
  const proyecto = await prisma.proyectoVenta.findFirst({
    where: { id: params.proyectoVentaId, empresaId: params.empresaId },
  });
  if (!proyecto) throw new ErrorMercadeo("Proyecto de venta no encontrado", 404);

  const presupuesto = params.presupuestoSemanal ?? proyecto.presupuestoSemanal ?? 0;
  const tope = Number(process.env.MERCADEO_TOPE_PRESUPUESTO_SEMANAL || 0);
  if (tope > 0 && presupuesto > tope) {
    throw new ErrorMercadeo(
      `El presupuesto semanal (${presupuesto}) supera el tope configurado (${tope}).`,
      400
    );
  }

  const semanaInicio = params.semanaInicio ?? proximoLunes();
  const analisis = await analisisDeEmpresa(params.empresaId, presupuesto, proyecto.moneda);
  const espacios = planificarSemana({
    analisis,
    semanaInicio,
    tieneWhatsapp: Boolean(proyecto.whatsapp),
  });
  const contenido = await generarContenido(analisis, espacios, proyecto);
  if (contenido.advertencia) analisis.alertas.push(contenido.advertencia);

  return prisma.planSemanal.create({
    data: {
      empresaId: params.empresaId,
      proyectoVentaId: proyecto.id,
      semanaInicio,
      presupuestoTotal: espacios.reduce((a, e) => a + e.presupuesto, 0),
      moneda: proyecto.moneda,
      analisis: analisis as unknown as Prisma.InputJsonValue,
      estrategia: contenido.estrategia,
      generadoCon: contenido.generadoCon,
      creadoPorId: params.creadoPorId ?? null,
      piezas: {
        create: espacios.map((e, i) => ({
          orden: e.orden,
          fechaProgramada: e.fechaProgramada,
          plataforma: e.plataforma,
          formato: e.formato,
          objetivo: e.objetivo,
          tema: e.tema,
          pagada: e.pagada,
          presupuesto: e.presupuesto,
          diasPauta: e.diasPauta,
          ...contenido.piezas[i],
        })),
      },
    },
    include: { piezas: true },
  });
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Genera un token de aprobación nuevo (invalida el anterior), lo guarda
 * hasheado y envía el informe por correo. Devuelve el enlace para poder
 * compartirlo manualmente si el correo no está configurado.
 */
export async function enviarAprobacion(params: {
  empresaId: string;
  planId: string;
  destinatarios: string[];
}) {
  const plan = await prisma.planSemanal.findFirst({
    where: { id: params.planId, empresaId: params.empresaId },
    include: { proyectoVenta: true, piezas: { orderBy: { orden: "asc" } } },
  });
  if (!plan) throw new ErrorMercadeo("Plan no encontrado", 404);
  if (plan.estado !== "BORRADOR" && plan.estado !== "PENDIENTE_APROBACION" && plan.estado !== "RECHAZADO") {
    throw new ErrorMercadeo(`El plan ya está ${plan.estado.toLowerCase()} y no se puede reenviar.`, 409);
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const enlace = `${urlBase()}/mercadeo/aprobacion/${token}`;

  await prisma.planSemanal.update({
    where: { id: plan.id },
    data: {
      estado: "PENDIENTE_APROBACION",
      tokenAprobacionHash: hashToken(token),
      tokenExpira: new Date(Date.now() + VIGENCIA_TOKEN_DIAS * 86_400_000),
      enviadoA: params.destinatarios.join(", "),
      enviadoEn: new Date(),
      decididoPor: null,
      decididoEn: null,
      comentarioDecision: null,
    },
  });

  const envio = await enviarPlanParaAprobacion({
    destinatarios: params.destinatarios,
    plan,
    enlace,
    urlBase: urlBase(),
  });

  return { enlace, ...envio };
}

export async function planPorToken(token: string) {
  if (!token || token.length < 20) return null;
  const plan = await prisma.planSemanal.findUnique({
    where: { tokenAprobacionHash: hashToken(token) },
    include: { proyectoVenta: true, piezas: { orderBy: { orden: "asc" } } },
  });
  return plan;
}

export class ErrorMercadeo extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}
