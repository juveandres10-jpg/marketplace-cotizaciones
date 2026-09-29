import { NextResponse } from "next/server";
import { z } from "zod";
import { del, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado } from "@/lib/mercadeo/http";
import { blobConfigurado, credencialesBlob, variablesBlobPresentes } from "@/lib/blob-token";

export const dynamic = "force-dynamic";

const MAX_IMAGENES = 100;
// El navegador reduce las imágenes (máx. 2400 px) antes de enviarlas; el
// cuerpo de una función de Vercel admite hasta 4.5 MB.
const TAMANO_MAX_BYTES = 4 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

function sinBlob() {
  const presentes = variablesBlobPresentes();
  return NextResponse.json(
    {
      error:
        "El almacenamiento de imágenes no está configurado en esta publicación. " +
        "En Vercel: Storage → Blob → conectar al proyecto (Production) y luego Redeploy. " +
        (presentes.length ? `Variables encontradas: ${presentes.join(", ")}.` : "No se encontró ninguna variable de Blob."),
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

// POST /api/mercadeo/proyectos/[id]/imagenes  (multipart/form-data, campo "file")
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  if (!blobConfigurado()) return sinBlob();

  const proyecto = await prisma.proyectoVenta.findFirst({
    where: { id: params.id, empresaId: actor.empresaId },
    select: { imagenes: true },
  });
  if (!proyecto) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (proyecto.imagenes.length >= MAX_IMAGENES) {
    return NextResponse.json({ error: `Máximo ${MAX_IMAGENES} imágenes por proyecto.` }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No se envió ninguna imagen" }, { status: 400 });
  if (!TIPOS.includes(file.type)) {
    return NextResponse.json({ error: "Solo se permiten imágenes JPG, PNG o WEBP." }, { status: 400 });
  }
  if (file.size > TAMANO_MAX_BYTES) {
    return NextResponse.json({ error: "La imagen supera 4 MB después de optimizarla." }, { status: 400 });
  }

  const nombre = (file.name || "imagen.jpg").normalize("NFD").replace(/[^\w.-]+/g, "-");
  try {
    const blob = await put(`mercadeo/${params.id}/${nombre}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      ...credencialesBlob(),
    });
    // Se lee de nuevo para no perder imágenes subidas en paralelo.
    const actual = await prisma.proyectoVenta.findUniqueOrThrow({ where: { id: params.id }, select: { imagenes: true } });
    const imagenes = [...actual.imagenes, blob.url].slice(0, MAX_IMAGENES);
    await prisma.proyectoVenta.update({ where: { id: params.id }, data: { imagenes } });
    return NextResponse.json({ imagenes }, { status: 201 });
  } catch (error: any) {
    console.error("[mercadeo] Error subiendo imagen a Blob:", error);
    return NextResponse.json({ error: `Vercel Blob: ${error?.message ?? "no se pudo subir"}` }, { status: 502 });
  }
}

const schema = z
  .object({
    quitar: z.string().url().optional(),
    principal: z.string().url().optional(), // mover al primer lugar
  })
  .refine((d) => Boolean(d.quitar || d.principal), "Sin cambios");

// PATCH /api/mercadeo/proyectos/[id]/imagenes -> quitar o marcar como principal
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return noAutorizado();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  const { quitar, principal } = parsed.data;

  const proyecto = await prisma.proyectoVenta.findFirst({
    where: { id: params.id, empresaId: actor.empresaId },
    select: { imagenes: true },
  });
  if (!proyecto) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  let imagenes = [...proyecto.imagenes];
  if (quitar && imagenes.includes(quitar)) {
    imagenes = imagenes.filter((u) => u !== quitar);
    if (blobConfigurado() && esUrlDeBlob(quitar)) {
      await del(quitar, credencialesBlob()).catch((e) => console.warn("[mercadeo] no se pudo borrar del Blob:", e));
    }
  }
  if (principal && imagenes.includes(principal)) {
    imagenes = [principal, ...imagenes.filter((u) => u !== principal)];
  }

  await prisma.proyectoVenta.update({ where: { id: params.id }, data: { imagenes } });
  return NextResponse.json({ imagenes });
}
