import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/productos?q=panel&categoria=xxx&proveedorId=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const categoriaId = searchParams.get("categoria") ?? undefined;
  const proveedorId = searchParams.get("proveedorId") ?? undefined;

  const productos = await prisma.producto.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { nombre: { contains: q, mode: "insensitive" } },
                { marca: { contains: q, mode: "insensitive" } },
                { modelo: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        categoriaId ? { categoriaId } : {},
        proveedorId ? { proveedorId } : {},
      ],
    },
    include: { categoria: true, proveedor: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json(productos);
}

// POST /api/productos  (solo proveedores publican productos de su empresa)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const user = session.user as any;
  if (user.rol !== "PROVEEDOR" || !user.empresaId) {
    return NextResponse.json(
      { error: "Solo proveedores pueden publicar productos" },
      { status: 403 }
    );
  }
  if (user.rolEmpresa !== "ADMIN_EMPRESA") {
    return NextResponse.json(
      { error: "Solo un administrador de la empresa puede publicar productos" },
      { status: 403 }
    );
  }

  const body = await req.json();

  const producto = await prisma.producto.create({
    data: {
      nombre: body.nombre,
      descripcion: body.descripcion,
      marca: body.marca,
      modelo: body.modelo,
      unidad: body.unidad ?? "unidad",
      precioRef: body.precioRef ? Number(body.precioRef) : null,
      moneda: body.moneda ?? "USD",
      categoriaId: body.categoriaId ?? null,
      proveedorId: user.empresaId,
    },
  });

  return NextResponse.json(producto, { status: 201 });
}
