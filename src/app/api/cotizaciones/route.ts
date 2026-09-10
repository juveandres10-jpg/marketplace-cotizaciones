import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enviarNotificacionCambioEstado } from "@/lib/email";

// POST /api/cotizaciones
// body: { proyectoId, proveedorId, notas, items: [{ productoId?, descripcion, cantidad }] }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const user = session.user as any;
  if (user.rol !== "COMPRADOR") {
    return NextResponse.json(
      { error: "Solo compradores pueden solicitar cotizaciones" },
      { status: 403 }
    );
  }

  const body = await req.json();

  const cotizacion = await prisma.cotizacion.create({
    data: {
      proyectoId: body.proyectoId,
      proveedorId: body.proveedorId,
      enviadaPorId: user.id,
      estado: "ENVIADA",
      notas: body.notas,
      items: {
        create: (body.items ?? []).map((item: any) => ({
          productoId: item.productoId ?? null,
          descripcion: item.descripcion,
          cantidad: Number(item.cantidad),
          precioUnit: item.precioUnit ? Number(item.precioUnit) : null,
          subtotal:
            item.precioUnit && item.cantidad
              ? Number(item.precioUnit) * Number(item.cantidad)
              : null,
        })),
      },
    },
    include: {
      items: true,
      proveedor: { include: { usuarios: true } },
      proyecto: true,
    },
  });

  enviarNotificacionCambioEstado({
    destinatarios: cotizacion.proveedor.usuarios.map((u) => u.email),
    proyectoNombre: cotizacion.proyecto.nombre,
    contraparteNombre: cotizacion.proveedor.nombre,
    estado: cotizacion.estado,
    proyectoId: cotizacion.proyectoId,
  }).catch(() => {});

  return NextResponse.json(cotizacion, { status: 201 });
}
