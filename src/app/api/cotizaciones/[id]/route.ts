import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enviarNotificacionCambioEstado } from "@/lib/email";

// PATCH /api/cotizaciones/[id]
// El comprador cambia estado (aprobar/descartar); el proveedor responde precios y pasa a RECIBIDA
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const user = session.user as any;

  const body = await req.json();

  const cotizacionActual = await prisma.cotizacion.findUnique({
    where: { id: params.id },
    select: { estado: true },
  });
  if (!cotizacionActual) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  const estadoAnterior = cotizacionActual.estado;

  const ESTADOS_RESERVADOS_ADMIN = ["APROBADA", "DESCARTADA"];
  if (
    body.estado &&
    ESTADOS_RESERVADOS_ADMIN.includes(body.estado) &&
    user.rol === "COMPRADOR" &&
    user.rolEmpresa !== "ADMIN_EMPRESA"
  ) {
    return NextResponse.json(
      {
        error:
          "Solo un administrador de la empresa puede aprobar o descartar una cotización",
      },
      { status: 403 }
    );
  }

  // Actualiza precios de items si vienen incluidos (respuesta del proveedor)
  if (Array.isArray(body.items)) {
    for (const item of body.items) {
      await prisma.itemCotizacion.update({
        where: { id: item.id },
        data: {
          precioUnit: item.precioUnit !== undefined ? Number(item.precioUnit) : undefined,
          subtotal:
            item.precioUnit !== undefined && item.cantidad
              ? Number(item.precioUnit) * Number(item.cantidad)
              : undefined,
        },
      });
    }
  }

  const cotizacion = await prisma.cotizacion.update({
    where: { id: params.id },
    data: {
      estado: body.estado,
      notas: body.notas,
      validaHasta: body.validaHasta ? new Date(body.validaHasta) : undefined,
    },
    include: {
      items: { include: { producto: true } },
      proveedor: { include: { usuarios: true } },
      enviadaPor: true,
      proyecto: true,
    },
  });

  // Notifica por email a la contraparte solo si el estado realmente cambió
  if (body.estado && body.estado !== estadoAnterior) {
    const destinatarios =
      user.rol === "PROVEEDOR"
        ? [cotizacion.enviadaPor.email] // el proveedor actualizó -> avisa al comprador
        : cotizacion.proveedor.usuarios.map((u) => u.email); // el comprador actualizó -> avisa al proveedor

    const contraparteNombre =
      user.rol === "PROVEEDOR" ? cotizacion.enviadaPor.nombre : cotizacion.proveedor.nombre;

    // No bloquea la respuesta si el email falla; se envía en segundo plano.
    enviarNotificacionCambioEstado({
      destinatarios,
      proyectoNombre: cotizacion.proyecto.nombre,
      contraparteNombre,
      estado: cotizacion.estado,
      proyectoId: cotizacion.proyectoId,
    }).catch(() => {});
  }

  return NextResponse.json(cotizacion);
}
