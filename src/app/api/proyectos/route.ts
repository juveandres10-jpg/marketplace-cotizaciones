import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/proyectos  -> proyectos de la empresa del usuario autenticado
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const user = session.user as any;

  const proyectos = await prisma.proyecto.findMany({
    where: { empresaId: user.empresaId },
    include: {
      _count: { select: { cotizaciones: true, items: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(proyectos);
}

// POST /api/proyectos  -> crear proyecto (solo compradores)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const user = session.user as any;
  if (user.rol !== "COMPRADOR" || !user.empresaId) {
    return NextResponse.json(
      { error: "Solo compradores pueden crear proyectos" },
      { status: 403 }
    );
  }
  if (user.rolEmpresa !== "ADMIN_EMPRESA") {
    return NextResponse.json(
      { error: "Solo un administrador de la empresa puede crear proyectos" },
      { status: 403 }
    );
  }

  const body = await req.json();

  const proyecto = await prisma.proyecto.create({
    data: {
      nombre: body.nombre,
      descripcion: body.descripcion,
      empresaId: user.empresaId,
      creadoPorId: user.id,
    },
  });

  return NextResponse.json(proyecto, { status: 201 });
}
