import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  EN_NEGOCIACION: "En negociación",
  RECIBIDA: "Recibida",
  APROBADA: "Aprobada",
  DESCARTADA: "Descartada",
};

export async function enviarNotificacionCambioEstado(params: {
  destinatarios: string[];
  proyectoNombre: string;
  contraparteNombre: string;
  estado: string;
  proyectoId: string;
}) {
  const { destinatarios, proyectoNombre, contraparteNombre, estado, proyectoId } =
    params;

  const emailsValidos = destinatarios.filter(Boolean);
  if (emailsValidos.length === 0) return;

  if (!resend) {
    // Sin RESEND_API_KEY configurado, no se envían emails.
    // La app funciona igual, solo se omite esta notificación.
    console.warn(
      "[email] RESEND_API_KEY no configurado — se omite la notificación de cambio de estado."
    );
    return;
  }

  const estadoLabel = ESTADO_LABEL[estado] ?? estado;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "notificaciones@marketplace.local",
      to: emailsValidos,
      subject: `[${proyectoNombre}] Cotización con ${contraparteNombre}: ${estadoLabel}`,
      html: `
        <div style="font-family: sans-serif; color: #111;">
          <p>Hola,</p>
          <p>
            El estado de una cotización del proyecto <strong>${proyectoNombre}</strong>
            con <strong>${contraparteNombre}</strong> cambió a:
            <strong>${estadoLabel}</strong>.
          </p>
          <p>
            <a href="${baseUrl}/proyectos/${proyectoId}">Ver el proyecto</a>
          </p>
        </div>
      `,
    });
  } catch (error) {
    // No queremos que un fallo de email tumbe la actualización de la cotización.
    console.error("[email] Error enviando notificación:", error);
  }
}
