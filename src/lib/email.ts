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

// ------------------------------------------------------------------
// Mercadeo: informe semanal para aprobación
// ------------------------------------------------------------------

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Markdown mínimo (títulos, viñetas, negritas) a HTML, escapando todo lo demás. */
function markdownSimple(md: string) {
  const html: string[] = [];
  let enLista = false;
  for (const linea of md.split("\n")) {
    const t = linea.trim();
    const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    if (/^[-*] /.test(t)) {
      if (!enLista) html.push("<ul style=\"margin:4px 0 12px;padding-left:20px\">");
      enLista = true;
      html.push(`<li>${inline(t.slice(2))}</li>`);
      continue;
    }
    if (enLista) {
      html.push("</ul>");
      enLista = false;
    }
    if (/^#{1,3} /.test(t)) html.push(`<h3 style="margin:18px 0 6px;font-size:16px">${inline(t.replace(/^#+ /, ""))}</h3>`);
    else if (t) html.push(`<p style="margin:0 0 10px">${inline(t)}</p>`);
  }
  if (enLista) html.push("</ul>");
  return html.join("\n");
}

type PlanParaCorreo = {
  id: string;
  semanaInicio: Date;
  presupuestoTotal: number;
  moneda: string;
  estrategia: string;
  analisis: unknown;
  proyectoVenta: { nombre: string; ciudad: string };
  piezas: Array<{
    id: string;
    orden: number;
    fechaProgramada: Date;
    plataforma: string;
    formato: string;
    tema: string;
    pagada: boolean;
    presupuesto: number;
    titular: string;
    copy: string;
  }>;
};

export async function enviarPlanParaAprobacion(params: {
  destinatarios: string[];
  plan: PlanParaCorreo;
  enlace: string;
  urlBase: string;
}): Promise<{ enviado: boolean; motivo?: string }> {
  const { plan, enlace, urlBase } = params;
  const emails = params.destinatarios.filter(Boolean);
  if (emails.length === 0) return { enviado: false, motivo: "Sin destinatarios" };
  if (!resend) {
    console.warn("[email] RESEND_API_KEY no configurado — se omite el correo de aprobación del plan.");
    return { enviado: false, motivo: "RESEND_API_KEY no configurado: comparte el enlace de aprobación manualmente." };
  }

  const zona = process.env.MERCADEO_ZONA_HORARIA || "America/Bogota";
  const fecha = (d: Date) =>
    new Date(d).toLocaleString("es-CO", { timeZone: zona, weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const dinero = (n: number) => `${plan.moneda} ${Math.round(n).toLocaleString("es-CO")}`;
  const analisis = plan.analisis as {
    confianza?: string;
    alertas?: string[];
    porPlataforma?: Array<{ plataforma: string; publicaciones: number; alcance: number; tasaInteraccion: number | null; cpl: number | null; seguidores: number | null }>;
  };

  const filasKpi = (analisis.porPlataforma ?? [])
    .map(
      (k) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${esc(k.plataforma)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${k.seguidores?.toLocaleString("es-CO") ?? "—"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${k.publicaciones}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${k.alcance.toLocaleString("es-CO")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${k.tasaInteraccion != null ? (k.tasaInteraccion * 100).toFixed(1) + "%" : "—"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${k.cpl != null ? dinero(k.cpl) : "—"}</td>
      </tr>`
    )
    .join("");

  const filasPiezas = plan.piezas
    .map(
      (p) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top;width:120px">
          <img src="${esc(`${urlBase}/api/mercadeo/piezas/${p.id}/imagen`)}" width="110" style="border-radius:6px;display:block" alt="">
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top">
          <div style="font-size:12px;color:#666">#${p.orden} · ${esc(fecha(p.fechaProgramada))} · ${esc(p.plataforma)} · ${esc(p.formato)}${p.pagada ? ` · <strong style="color:#b45309">PAUTA ${esc(dinero(p.presupuesto))}</strong>` : ""}</div>
          <div style="font-weight:bold;margin:4px 0">${esc(p.titular)}</div>
          <div style="font-size:13px;color:#333;white-space:pre-wrap">${esc(p.copy)}</div>
          <div style="font-size:12px;color:#888;margin-top:4px">Tema: ${esc(p.tema)}</div>
        </td>
      </tr>`
    )
    .join("");

  const alertas = (analisis.alertas ?? []).length
    ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 14px;margin:14px 0;font-size:13px">${(analisis.alertas ?? []).map((a) => `⚠️ ${esc(a)}`).join("<br>")}</div>`
    : "";

  const pagadas = plan.piezas.filter((p) => p.pagada).length;
  const semana = new Date(plan.semanaInicio).toLocaleDateString("es-CO", { timeZone: zona, day: "2-digit", month: "long" });

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "notificaciones@marketplace.local",
      to: emails,
      subject: `[Aprobación] Plan de mercadeo ${plan.proyectoVenta.nombre} — semana del ${semana}`,
      html: `
        <div style="font-family:sans-serif;color:#111;max-width:720px;margin:0 auto">
          <h2 style="margin-bottom:4px">Plan de mercadeo semanal</h2>
          <div style="color:#555">${esc(plan.proyectoVenta.nombre)} (${esc(plan.proyectoVenta.ciudad)}) · semana del ${esc(semana)}</div>
          <div style="margin:16px 0;padding:14px;background:#f1f5f9;border-radius:8px">
            <strong>${plan.piezas.length}</strong> publicaciones · <strong>${pagadas}</strong> con pauta ·
            inversión total <strong>${esc(dinero(plan.presupuestoTotal))}</strong> ·
            confianza del análisis: <strong>${esc(analisis.confianza ?? "—")}</strong>
          </div>
          <p style="margin:18px 0">
            <a href="${esc(enlace)}" style="background:#16a34a;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Revisar y aprobar</a>
            &nbsp;
            <a href="${esc(enlace)}" style="color:#b91c1c">Rechazar con comentarios</a>
          </p>
          ${alertas}
          <h3>Estado actual de las redes (últimos 90 días)</h3>
          <table style="border-collapse:collapse;width:100%;font-size:13px">
            <tr style="background:#f8fafc;color:#555;text-align:left">
              <th style="padding:6px 8px">Red</th><th style="padding:6px 8px;text-align:right">Seguidores</th>
              <th style="padding:6px 8px;text-align:right">Publicaciones</th><th style="padding:6px 8px;text-align:right">Alcance</th>
              <th style="padding:6px 8px;text-align:right">Interacción</th><th style="padding:6px 8px;text-align:right">Costo/contacto</th>
            </tr>
            ${filasKpi}
          </table>
          <h3>Estrategia</h3>
          ${markdownSimple(plan.estrategia)}
          <h3>Calendario y piezas</h3>
          <table style="border-collapse:collapse;width:100%">${filasPiezas}</table>
          <p style="font-size:12px;color:#888;margin-top:24px">
            Nada se publica ni se pauta hasta que el plan sea aprobado. El enlace vence en 7 días.
            La pauta se cobra al método de pago configurado en la cuenta publicitaria de Meta.
          </p>
        </div>
      `,
    });
    return { enviado: true };
  } catch (error) {
    console.error("[email] Error enviando plan para aprobación:", error);
    return { enviado: false, motivo: "Error al enviar el correo (ver logs)" };
  }
}
