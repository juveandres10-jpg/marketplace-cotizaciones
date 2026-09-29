import { NextResponse } from "next/server";
import { z } from "zod";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado } from "@/lib/mercadeo/http";
import { tokenBlob, variablesBlobPresentes } from "@/lib/blob-token";

export const dynamic = "force-dynamic";

const MAX_IMAGENES = 30;
const TAMANO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB (renders en alta)
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

function sinBlob() {
  const presentes = variablesBlobPresentes();
  return NextResponse.json(
    {
      error:
        "El almacenamiento de imágenes no está configurado (no hay un token de Vercel Blob válido en esta publicación). " +
        "En Vercel: Storage → Blob → conectar al proyecto (Production) y luego Redeploy. " +
        (presentes.length
          ? `Variables encontradas: ${presentes.join(", ")} (ninguna con un token vercel_blob_rw_ válido).`
          : "No se encontró ninguna variable de Blob."),
    },
    { status: 500 }
  );
}

function esUrlDeBlob(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

// POST /api/mercadeo/proyectos/[id]/imagenes
// Protocolo de "client upload" de Vercel Blob: el navegador sube el archivo
// directo a Blob (sin pasar por la función, que tiene límite de 4.5 MB) con un
// token de corta duración que se emite aquí solo para proyectos de la empresa.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = tokenBlob();
  if (!token) return sinBlob();
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body?.type) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  // El aviso de "subida completada" lo envía Vercel (sin sesión); handleUpload
  // verifica su firma. La URL se registra desde el navegador con PATCH.
  if (body.type === "blob.generate-client-token") {
    const actor = await autorizarMercadeo(req);
    if (!actor) return noAutorizado();
    const proyecto = await prisma.proyectoVenta.findFirst({
      where: { id: params.id, empresaId: actor.empresaId },
      select: { imagenes: true },
    });
    if (!proyecto) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (proyecto.imagenes.length >= MAX_IMAGENES) {
      return NextResponse.json({ error: `Máximo ${MAX_IMAGENES} imágenes por proyecto.` }, { status: 400 });
    }
  }

  try {
    const r = await handleUpload({
      token,
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`mercadeo/${params.id}/`)) throw new Error("Ruta de archivo inválida");
        return { allowedContentTypes: TIPOS, maximumSizeInBytes: TAMANO_MAX_BYTES, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(r);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "No se pudo subir" }, { status: 400 });
  }
}

const schema = z
  .object({
    agregar: z.string().url().optional(),
    quitar: z.string().url().optional(),
    principal: z.string().url().optional(), // mover al primer lugar
  })
  .refine((d) => Boolean(d.agregar || d.quitar || d.principal), "Sin cambios");

// PATCH /api/mercadeo/proyectos/[id]/imagenes -> registrar, quitar o marcar como principal
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  const { agregar, quitar, principal } = parsed.data;

  const proyecto = await prisma.proyectoVenta.findFirst({
    where: { id: params.id, empresaId: actor.empresaId },
    select: { imagenes: true },
  });
  if (!proyecto) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  let imagenes = [...proyecto.imagenes];
  if (agregar) {
    if (!esUrlDeBlob(agregar) || !new URL(agregar).pathname.startsWith(`/mercadeo/${params.id}/`)) {
      return NextResponse.json({ error: "URL de imagen no válida" }, { status: 400 });
    }
    if (!imagenes.includes(agregar)) imagenes.push(agregar);
    imagenes = imagenes.slice(0, MAX_IMAGENES);
  }
  if (quitar && imagenes.includes(quitar)) {
    imagenes = imagenes.filter((u) => u !== quitar);
    const token = tokenBlob();
    if (token && esUrlDeBlob(quitar)) {
      await del(quitar, { token }).catch((e) => console.warn("[mercadeo] no se pudo borrar del Blob:", e));
    }
  }
  if (principal && imagenes.includes(principal)) {
    imagenes = [principal, ...imagenes.filter((u) => u !== principal)];
  }

  await prisma.proyectoVenta.update({ where: { id: params.id }, data: { imagenes } });
  return NextResponse.json({ imagenes });
}
