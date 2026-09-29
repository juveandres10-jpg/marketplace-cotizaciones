// Decisión sobre un plan enviado por correo (aprobar / rechazar).
// Aprobar es lo único que dispara la publicación y la pauta en Meta.

import { prisma } from "@/lib/prisma";
import { ErrorMercadeo, enviarAprobacion, planPorToken } from "./servicio";
import { aplicarCorrecciones, correccionAutomaticaDisponible } from "./correcciones";
import { estadoConfiguracionMeta, publicarPlanEnMeta, type ResultadoPublicacion } from "./meta";

export async function decidirPlan(params: {
  token: string;
  decision: "aprobar" | "rechazar" | "corregir";
  nombre: string;
  comentario?: string;
  /** Correcciones puntuales por pieza: nota para la IA y/o foto elegida de la galería ("" = sin foto). */
  porPieza?: { orden: number; nota?: string; imagenFondo?: string }[];
}): Promise<{ estado: string; publicacion: ResultadoPublicacion[] | null; mensaje: string; enlace?: string }> {
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

  if (params.decision === "corregir") {
    // 1) Fotos elegidas por quien aprueba: se aplican directo (no necesitan IA).
    const galeria = [...plan.proyectoVenta.imagenes, ...(plan.proyectoVenta.imagenUrl ? [plan.proyectoVenta.imagenUrl] : [])];
    const fotosElegidas = new Set<number>();
    for (const x of params.porPieza ?? []) {
      if (x.imagenFondo === undefined) continue;
      if (x.imagenFondo !== "" && !galeria.includes(x.imagenFondo)) continue;
      const pieza = plan.piezas.find((p) => p.orden === x.orden);
      if (!pieza) continue;
      await prisma.piezaPlan.update({ where: { id: pieza.id }, data: { imagenFondo: x.imagenFondo } });
      fotosElegidas.add(x.orden);
    }

    // 2) Notas en texto (generales y por pieza) -> IA.
    const notas = (params.porPieza ?? [])
      .filter((x) => x.nota?.trim())
      .map((x) => `Pieza #${x.orden}: ${x.nota!.trim()}${fotosElegidas.has(x.orden) ? " (la foto ya la eligió quien aprueba: no la cambies)" : ""}`);
    const instrucciones = [params.comentario?.trim(), ...notas].filter(Boolean).join("\n");

    let resumen = fotosElegidas.size ? `Fotos cambiadas en ${fotosElegidas.size} pieza(s).` : "";
    if (instrucciones) {
      if (!correccionAutomaticaDisponible()) {
        return {
          estado: "RECHAZADO",
          publicacion: null,
          mensaje: `${resumen} Correcciones recibidas: el equipo ajustará los textos y te reenviará el plan.`.trim(),
        };
      }
      try {
        const correccion = await aplicarCorrecciones({ planId: plan.id, instrucciones, autor: params.nombre });
        resumen = `${resumen} ${correccion.resumen}`.trim();
      } catch (error) {
        console.error("[mercadeo] No se pudo aplicar la corrección automática:", error);
        return {
          estado: "RECHAZADO",
          publicacion: null,
          mensaje: `${resumen} Recibimos tus correcciones, pero no se pudieron aplicar automáticamente. El equipo las hará y te reenviará el plan.`.trim(),
        };
      }
    }

    // 3) Se reenvía el plan corregido a los mismos destinatarios.
    const destinatarios = (plan.enviadoA ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const envio = await enviarAprobacion({ empresaId: plan.empresaId, planId: plan.id, destinatarios });
    return {
      estado: "PENDIENTE_APROBACION",
      publicacion: null,
      enlace: envio.enlace,
      mensaje:
        `Correcciones aplicadas: ${resumen} ` +
        (envio.enviado ? "Te enviamos el plan corregido por correo." : "Revisa el plan corregido en el enlace de abajo."),
    };
  }

  if (!aprobado) {
    return {
      estado: "RECHAZADO",
      publicacion: null,
      mensaje: "Plan rechazado. El equipo recibirá tus comentarios.",
    };
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
