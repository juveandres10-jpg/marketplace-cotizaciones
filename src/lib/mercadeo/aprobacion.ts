// Decisión sobre un plan enviado por correo (aprobar / rechazar).
// Aprobar es lo único que dispara la publicación y la pauta en Meta.

import { prisma } from "@/lib/prisma";
import { ErrorMercadeo, planPorToken } from "./servicio";
import { estadoConfiguracionMeta, publicarPlanEnMeta, type ResultadoPublicacion } from "./meta";

export async function decidirPlan(params: {
  token: string;
  decision: "aprobar" | "rechazar";
  nombre: string;
  comentario?: string;
}): Promise<{ estado: string; publicacion: ResultadoPublicacion[] | null; mensaje: string }> {
  const plan = await planPorToken(params.token);
  if (!plan) throw new ErrorMercadeo("Enlace inválido o ya utilizado.", 404);
  if (plan.estado !== "PENDIENTE_APROBACION") {
    throw new ErrorMercadeo(`Este plan ya fue ${plan.estado.toLowerCase().replace("_", " ")}.`, 409);
  }
  if (plan.tokenExpira && plan.tokenExpira < new Date()) {
    throw new ErrorMercadeo("El enlace venció. Pide que se reenvíe el plan.", 410);
  }

  // Transición atómica: si dos personas hacen clic a la vez, solo una gana.
  const aprobado = params.decision === "aprobar";
  const actualizado = await prisma.planSemanal.updateMany({
    where: { id: plan.id, estado: "PENDIENTE_APROBACION" },
    data: {
      estado: aprobado ? "APROBADO" : "RECHAZADO",
      decididoPor: params.nombre.slice(0, 200),
      decididoEn: new Date(),
      comentarioDecision: params.comentario?.slice(0, 4000) || null,
      tokenAprobacionHash: null, // el enlace es de un solo uso
    },
  });
  if (actualizado.count === 0) throw new ErrorMercadeo("Este plan ya fue decidido.", 409);

  if (!aprobado) {
    return { estado: "RECHAZADO", publicacion: null, mensaje: "Plan rechazado. El equipo recibirá tus comentarios." };
  }

  const conf = estadoConfiguracionMeta();
  if (!conf.pagina && !conf.instagram && !conf.anuncios) {
    return {
      estado: "APROBADO",
      publicacion: null,
      mensaje: "Plan aprobado. Meta no está conectado: descarga las piezas y publícalas manualmente.",
    };
  }
  const publicacion = await publicarPlanEnMeta(plan.id);
  const errores = publicacion.filter((r) => !r.ok).length;
  const hayPauta = plan.piezas.some((p) => p.pagada);
  return {
    estado: errores === publicacion.length && publicacion.length > 0 ? "APROBADO" : "PUBLICADO",
    publicacion,
    mensaje: errores
      ? `Plan aprobado. ${publicacion.length - errores} piezas enviadas a Meta, ${errores} con error (ver detalle).`
      : !hayPauta
        ? "Plan aprobado y enviado a Meta. Las publicaciones quedaron programadas."
        : conf.activarAlAprobar
          ? "Plan aprobado y enviado a Meta. Los anuncios quedaron activos."
          : "Plan aprobado y enviado a Meta. Los anuncios quedaron en pausa: actívalos en el Administrador de anuncios.",
  };
}
