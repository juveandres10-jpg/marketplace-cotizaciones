import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: params.id },
    include: {
      items: { include: { producto: true } },
      cotizaciones: {
        include: {
          proveedor: true,
          items: { include: { producto: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!proyecto) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json(proyecto);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();

  const proyecto = await prisma.proyecto.update({
    where: { id: params.id },
    data: {
      nombre: body.nombre,
      descripcion: body.descripcion,
      estado: body.estado,
    },
  });

  return NextResponse.json(proyecto);
}
