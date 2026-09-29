import { NextResponse } from "next/server";
import { z } from "zod";
import { del, issueSignedToken } from "@vercel/blob";
import { handleUpload, handleUploadPresigned } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { autorizarMercadeo } from "@/lib/mercadeo/auth";
import { datosInvalidos, noAutorizado } from "@/lib/mercadeo/http";
import { blobConfigurado, credencialesBlob, tokenBlob, variablesBlobPresentes } from "@/lib/blob-token";

export const dynamic = "force-dynamic";

const MAX_VIDEOS = 30;
const TAMANO_MAX_BYTES = 500 * 1024 * 1024; // 500 MB
const TIPOS = ["video/mp4", "video/quicktime"];

function sinBlob() {
  const presentes = variablesBlobPresentes();
  return NextResponse.json(
    {
      error:
        "El almacenamiento no está configurado en esta publicación. En Vercel: Storage → Blob → conectar al proyecto y Redeploy. " +
        (presentes.length ? `Variables encontradas: ${presentes.join(", ")}.` : "No se encontró ninguna variable de Blob."),
    },
    { status: 500 }
  );
}

function esVideoDelProyecto(url: string, proyectoId: string) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".public.blob.vercel-storage.com") &&
      u.pathname.startsWith(`/mercadeo/${proyectoId}/videos/`)
    );
  } catch {
    return false;
  }
}

async function proyectoDe(req: Request, id: string) {
  const actor = await autorizarMercadeo(req);
  if (!actor) return { error: noAutorizado() };
  const proyecto = await prisma.proyectoVenta.findFirst({
    where: { id, empresaId: actor.empresaId },
    select: { videos: true },
  });
  if (!proyecto) return { error: NextResponse.json({ error: "No encontrado" }, { status: 404 }) };
  return { proyecto };
}

// GET -> cómo debe subir el navegador: "token" (stores clásicos) o "presigned" (stores OIDC)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const r = await proyectoDe(req, params.id);
  if (r.error) return r.error;
  if (!blobConfigurado()) return sinBlob();
  const modo = tokenBlob() ? "token" : "presigned";
  if (modo === "presigned" && !process.env.BLOB_WEBHOOK_PUBLIC_KEY) {
    return NextResponse.json(
      { error: "Falta BLOB_WEBHOOK_PUBLIC_KEY (la crea Vercel al conectar el Blob store). Reconecta el store al proyecto y haz Redeploy." },
      { status: 500 }
    );
  }
  return NextResponse.json({ modo, maxBytes: TAMANO_MAX_BYTES });
}

// POST -> autoriza una subida directa del navegador a Vercel Blob (el video no
// pasa por la función, que tiene límite de 4.5 MB). La URL se registra con PATCH.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const r = await proyectoDe(req, params.id);
  if (r.error) return r.error;
  if (!blobConfigurado()) return sinBlob();
  if (r.proyecto.videos.length >= MAX_VIDEOS) {
    return NextResponse.json({ error: `Máximo ${MAX_VIDEOS} videos por proyecto.` }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const prefijo = `mercadeo/${params.id}/videos/`;
  const validarRuta = (pathname: string) => {
    if (!pathname.startsWith(prefijo) || pathname.includes("..")) throw new Error("Ruta de archivo inválida");
  };

  try {
    if (body?.type === "blob.generate-client-token") {
      const token = tokenBlob()!;
      const res = await handleUpload({
        token,
        body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          validarRuta(pathname);
          return { allowedContentTypes: TIPOS, maximumSizeInBytes: TAMANO_MAX_BYTES, addRandomSuffix: true };
        },
      });
      return NextResponse.json(res);
    }
    if (body?.type === "blob.generate-presigned-url") {
      const res = await handleUploadPresigned({
        body,
        request: req,
        getSignedToken: async (pathname) => {
          validarRuta(pathname);
          const token = await issueSignedToken({
            pathname,
            operations: ["put"],
            allowedContentTypes: TIPOS,
            maximumSizeInBytes: TAMANO_MAX_BYTES,
            validUntil: Date.now() + 60 * 60 * 1000,
            ...credencialesBlob(),
          });
          return {
            token,
            urlOptions: { allowedContentTypes: TIPOS, maximumSizeInBytes: TAMANO_MAX_BYTES, addRandomSuffix: true },
          };
        },
      });
      return NextResponse.json(res);
    }
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  } catch (error: any) {
    console.error("[mercadeo] Error autorizando subida de video:", error);
    return NextResponse.json({ error: `Vercel Blob: ${error?.message ?? "no se pudo autorizar"}` }, { status: 400 });
  }
}

const schema = z
  .object({
    agregar: z.string().url().optional(),
    quitar: z.string().url().optional(),
    principal: z.string().url().optional(),
  })
  .refine((d) => Boolean(d.agregar || d.quitar || d.principal), "Sin cambios");

// PATCH -> registrar el video subido, quitarlo o marcarlo como principal
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const r = await proyectoDe(req, params.id);
  if (r.error) return r.error;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return datosInvalidos(parsed.error);
  const { agregar, quitar, principal } = parsed.data;

  let videos = [...r.proyecto.videos];
  if (agregar) {
    if (!esVideoDelProyecto(agregar, params.id)) {
      return NextResponse.json({ error: "URL de video no válida" }, { status: 400 });
    }
    if (!videos.includes(agregar)) videos.push(agregar);
    videos = videos.slice(0, MAX_VIDEOS);
  }
  if (quitar && videos.includes(quitar)) {
    videos = videos.filter((u) => u !== quitar);
    if (blobConfigurado() && esVideoDelProyecto(quitar, params.id)) {
      await del(quitar, credencialesBlob()).catch((e) => console.warn("[mercadeo] no se pudo borrar el video:", e));
    }
  }
  if (principal && videos.includes(principal)) {
    videos = [principal, ...videos.filter((u) => u !== principal)];
  }

  await prisma.proyectoVenta.update({ where: { id: params.id }, data: { videos } });
  return NextResponse.json({ videos });
}
