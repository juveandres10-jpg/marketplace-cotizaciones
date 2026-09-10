import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/proveedores?q=texto  -> lista de empresas proveedoras (para selects)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;

  const proveedores = await prisma.empresa.findMany({
    where: {
      tipo: { in: ["PROVEEDOR", "AMBOS"] },
      ...(q ? { nombre: { contains: q, mode: "insensitive" } } : {}),
    },
    select: { id: true, nombre: true, pais: true },
    orderBy: { nombre: "asc" },
    take: 50,
  });

  return NextResponse.json(proveedores);
}
