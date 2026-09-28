"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

const TAMANO_MAX_MB = 20;

async function patch(proyectoId: string, cuerpo: Record<string, string>) {
  const res = await fetch(`/api/mercadeo/proyectos/${proyectoId}/imagenes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? "No se pudo guardar");
  return j.imagenes as string[];
}

export function GaleriaImagenesProyecto({ proyectoId, iniciales }: { proyectoId: string; iniciales: string[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [imagenes, setImagenes] = useState(iniciales);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    setError(null);
    const lista = Array.from(archivos);
    try {
      for (let i = 0; i < lista.length; i++) {
        const f = lista[i];
        if (!f.type.startsWith("image/")) throw new Error(`${f.name}: solo se permiten imágenes JPG, PNG o WEBP.`);
        if (f.size > TAMANO_MAX_MB * 1024 * 1024) throw new Error(`${f.name}: supera ${TAMANO_MAX_MB} MB.`);
        setProgreso(`Subiendo ${i + 1} de ${lista.length}: ${f.name}`);
        const limpio = f.name.normalize("NFD").replace(/[^\w.-]+/g, "-");
        const blob = await upload(`mercadeo/${proyectoId}/${limpio}`, f, {
          access: "public",
          handleUploadUrl: `/api/mercadeo/proyectos/${proyectoId}/imagenes`,
          contentType: f.type,
        });
        setImagenes(await patch(proyectoId, { agregar: blob.url }));
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "No se pudo subir");
    } finally {
      setProgreso(null);
      if (input.current) input.current.value = "";
    }
  }

  async function accion(cuerpo: Record<string, string>) {
    setError(null);
    try {
      setImagenes(await patch(proyectoId, cuerpo));
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <section className="bg-white border rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="font-semibold">Fotos y renders del proyecto</h2>
          <p className="text-xs text-gray-500 mt-1">
            Se usan de fondo en las piezas: cada publicación toma una imagen distinta, en este orden. La primera es la
            principal. JPG, PNG o WEBP hasta {TAMANO_MAX_MB} MB.
          </p>
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={progreso !== null}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 text-sm disabled:opacity-60"
        >
          {progreso ? "Subiendo…" : "+ Subir imágenes"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => subir(e.target.files)}
        />
      </div>
      {progreso && <p className="text-sm text-gray-600 mb-2">{progreso}</p>}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {imagenes.length === 0 ? (
        <div
          onClick={() => input.current?.click()}
          className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-gray-400 cursor-pointer hover:bg-gray-50"
        >
          Aún no hay imágenes. Haz clic para subir fotos de fachada, zonas comunes, apartamento modelo, avance de obra…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {imagenes.map((url, i) => (
            <div key={url} className="relative group border rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Imagen ${i + 1}`} className="w-full h-32 object-cover bg-gray-100" loading="lazy" />
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
                  onClick={() => confirm("¿Quitar esta imagen?") && accion({ quitar: url })}
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
