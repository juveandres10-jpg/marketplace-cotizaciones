import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { noAutorizado } from "@/lib/mercadeo/http";
import { blobConfigurado, credencialesBlob } from "@/lib/blob-token";

export const dynamic = "force-dynamic";

const TIPOS = ["image/png", "image/jpeg", "image/webp"];
const TAMANO_MAX = 3 * 1024 * 1024;

async function autorizarAdmin(req: Request) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return { error: noAutorizado() };
  if (actor.tipo === "usuario" && actor.rolEmpresa !== "ADMIN_EMPRESA") {
    return { error: NextResponse.json({ error: "Solo un administrador de la empresa puede cambiar el logo." }, { status: 403 }) };
  }
  return { actor };
}

function esLogoDeEmpresa(url: string | null | undefined, empresaId: string) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith(`/marca/${empresaId}/`);
  } catch {
    return false;
  }
}

// POST /api/mercadeo/marca/logo (multipart, campo "file") -> sube y reemplaza el logo
export async function POST(req: Request) {
  const r = await autorizarAdmin(req);
  if (r.error) return r.error;
  const empresaId = r.actor.empresaId;
  if (!blobConfigurado()) {
    return NextResponse.json({ error: "El almacenamiento de archivos no está configurado (Vercel Blob)." }, { status: 500 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
  if (!TIPOS.includes(file.type)) {
    return NextResponse.json({ error: "El logo debe ser PNG (ideal, con fondo transparente), JPG o WEBP." }, { status: 400 });
  }
  if (file.size > TAMANO_MAX) return NextResponse.json({ error: "El logo supera 3 MB." }, { status: 400 });

  const anterior = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { logoUrl: true } });
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const blob = await put(`marca/${empresaId}/logo.${extension}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
    ...credencialesBlob(),
  });
  await prisma.empresa.update({ where: { id: empresaId }, data: { logoUrl: blob.url } });
  if (esLogoDeEmpresa(anterior?.logoUrl, empresaId)) {
    await del(anterior!.logoUrl!, credencialesBlob()).catch(() => {});
  }
  return NextResponse.json({ logoUrl: blob.url }, { status: 201 });
}

// DELETE /api/mercadeo/marca/logo -> quitar el logo
export async function DELETE(req: Request) {
  const r = await autorizarAdmin(req);
  if (r.error) return r.error;
  const empresaId = r.actor.empresaId;
  const anterior = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { logoUrl: true } });
  await prisma.empresa.update({ where: { id: empresaId }, data: { logoUrl: null } });
  if (blobConfigurado() && esLogoDeEmpresa(anterior?.logoUrl, empresaId)) {
    await del(anterior!.logoUrl!, credencialesBlob()).catch(() => {});
  }
  return NextResponse.json({ logoUrl: null });
}
