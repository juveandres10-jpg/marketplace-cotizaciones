import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { put } from "@vercel/blob";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tokenBlob } from "@/lib/blob-token";

const TAMANO_MAX_BYTES = 15 * 1024 * 1024; // 15 MB

// POST /api/cotizaciones/[id]/archivos  (multipart/form-data, campo "file")
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const user = session.user as any;

  const token = tokenBlob();
  if (!token) {
    return NextResponse.json(
      {
        error:
          "El almacenamiento de archivos no está configurado (falta BLOB_READ_WRITE_TOKEN). Ver README.",
      },
      { status: 500 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json(
      { error: "No se envió ningún archivo" },
      { status: 400 }
    );
  }
  if (file.size > TAMANO_MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 15 MB" },
      { status: 400 }
    );
  }

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!cotizacion) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }

  const blob = await put(
    `cotizaciones/${params.id}/${Date.now()}-${file.name}`,
    file,
    { access: "public", token }
  );

  const archivo = await prisma.archivoCotizacion.create({
    data: {
      cotizacionId: params.id,
      nombre: file.name,
      url: blob.url,
      tipo: file.type || null,
      tamanoBytes: file.size,
      subidoPorId: user.id,
    },
  });

  return NextResponse.json(archivo, { status: 201 });
}

// GET /api/cotizaciones/[id]/archivos
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const archivos = await prisma.archivoCotizacion.findMany({
    where: { cotizacionId: params.id },
    include: { subidoPor: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(archivos);
}
