"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload, uploadPresigned } from "@vercel/blob/client";

const TAMANO_MAX_MB = 500;

async function json(res: Response) {
  const texto = await res.text();
  try {
    return JSON.parse(texto);
  } catch {
    return { error: texto.replace(/<[^>]+>/g, " ").trim().slice(0, 160) || `HTTP ${res.status}` };
  }
}

export function VideosProyecto({ proyectoId, iniciales }: { proyectoId: string; iniciales: string[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState(iniciales);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/mercadeo/proyectos/${proyectoId}/videos`;

  async function patch(cuerpo: Record<string, string>) {
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const j = await json(res);
    if (!res.ok) throw new Error(j.error ?? "No se pudo guardar");
    setVideos(j.videos);
    router.refresh();
  }

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    setError(null);
    try {
      // Verifica sesión y almacenamiento antes de empezar (y elige el modo de subida).
      const conf = await fetch(base);
      const c = await json(conf);
      if (!conf.ok) throw new Error(c.error ?? "No se pudo preparar la subida");
      const subirFn = c.modo === "token" ? upload : uploadPresigned;

      const lista = Array.from(archivos);
      for (let i = 0; i < lista.length; i++) {
        const f = lista[i];
        if (!["video/mp4", "video/quicktime"].includes(f.type)) throw new Error(`${f.name}: solo se permiten videos MP4 o MOV.`);
        if (f.size > TAMANO_MAX_MB * 1024 * 1024) throw new Error(`${f.name}: supera ${TAMANO_MAX_MB} MB.`);
        const limpio = f.name.normalize("NFD").replace(/[^\w.-]+/g, "-");
        const blob = await subirFn(`mercadeo/${proyectoId}/videos/${limpio}`, f, {
          access: "public",
          handleUploadUrl: base,
          contentType: f.type,
          multipart: f.size > 50 * 1024 * 1024,
          onUploadProgress: ({ percentage }) =>
            setProgreso(`Subiendo ${i + 1} de ${lista.length}: ${f.name} — ${Math.round(percentage)}%`),
        });
        await patch({ agregar: blob.url });
      }
    } catch (e: any) {
      setError(e?.message ?? "No se pudo subir el video");
    } finally {
      setProgreso(null);
      if (input.current) input.current.value = "";
    }
  }

  async function accion(cuerpo: Record<string, string>) {
    setError(null);
    try {
      await patch(cuerpo);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <section className="bg-white border rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="font-semibold">Videos del proyecto</h2>
          <p className="text-xs text-gray-500 mt-1">
            Renders animados, recorridos, avance de obra. Se usan en las publicaciones de reel, video e historia (una
            distinta por pieza, en este orden). MP4 o MOV hasta {TAMANO_MAX_MB} MB. Para Instagram lo ideal es vertical
            9:16, de 5 a 90 segundos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={progreso !== null}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 text-sm disabled:opacity-60"
        >
          {progreso ? "Subiendo…" : "+ Subir videos"}
        </button>
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/quicktime"
          multiple
          className="hidden"
          onChange={(e) => subir(e.target.files)}
        />
      </div>
      {progreso && <p className="text-sm text-gray-600 mb-2">{progreso}</p>}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {videos.length === 0 ? (
        <div
          onClick={() => input.current?.click()}
          className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-gray-400 cursor-pointer hover:bg-gray-50"
        >
          Aún no hay videos. Sin video, los reels se publican con la imagen de la pieza.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {videos.map((url, i) => (
            <div key={url} className="relative border rounded-lg overflow-hidden">
              <video src={url} className="w-full h-40 object-cover bg-black" controls preload="metadata" muted />
              <div className="absolute top-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                {i === 0 ? "Principal" : `#${i + 1}`}
              </div>
              <div className="flex text-xs border-t">
                {i !== 0 && (
                  <button type="button" onClick={() => accion({ principal: url })} className="flex-1 py-1 hover:bg-gray-50">
                    Hacer principal
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => confirm("¿Quitar este video?") && accion({ quitar: url })}
                  className="flex-1 py-1 text-red-600 hover:bg-red-50"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
