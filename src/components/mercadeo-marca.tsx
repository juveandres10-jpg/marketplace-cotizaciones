"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Marca = { logoUrl: string | null; colorPrimario: string | null; colorOscuro: string | null; colorAcento: string | null };

const DEFECTO = { primario: "#1e3a8a", oscuro: "#0f172a", acento: "#f59e0b" };
const HEX = /^#[0-9a-f]{6}$/i;

function hex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function hsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

/** Sugiere primario / oscuro / acento a partir de los colores dominantes del logo. */
async function coloresDelLogo(url: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 80;
  canvas.height = Math.max(1, Math.round((80 * img.naturalHeight) / img.naturalWidth));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const cubetas = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue; // transparente
    const { s, l } = hsl(r, g, b);
    if (l > 0.93 || (s < 0.12 && l > 0.8)) continue; // fondo blanco / gris claro
    const k = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const c = cubetas.get(k) ?? { r: 0, g: 0, b: 0, n: 0 };
    c.r += r;
    c.g += g;
    c.b += b;
    c.n += 1;
    cubetas.set(k, c);
  }
  const colores = Array.from(cubetas.values())
    .map((c) => ({ r: c.r / c.n, g: c.g / c.n, b: c.b / c.n, n: c.n }))
    .sort((a, b) => b.n - a.n)
    .map((c) => ({ ...c, ...hsl(c.r, c.g, c.b) }));
  if (colores.length === 0) return null;
  const saturados = colores.filter((c) => c.s > 0.25 && c.l > 0.15 && c.l < 0.8);
  const primario = saturados[0] ?? colores[0];
  const acento =
    saturados.find((c) => Math.min(Math.abs(c.h - primario.h), 360 - Math.abs(c.h - primario.h)) > 40) ??
    saturados[1];
  // El oscuro debe ser claramente más oscuro que el principal (textos y franjas).
  const oscuro = colores.filter((c) => c.l < 0.16 && c.l < primario.l - 0.08).sort((a, b) => a.l - b.l)[0];
  const f = 0.35; // oscurecer el primario si el logo no trae un tono oscuro
  return {
    primario: hex(primario.r, primario.g, primario.b),
    oscuro: oscuro ? hex(oscuro.r, oscuro.g, oscuro.b) : hex(primario.r * f, primario.g * f, primario.b * f),
    acento: acento ? hex(acento.r, acento.g, acento.b) : null,
  };
}

/**
 * Recorta los márgenes vacíos del logo (transparentes o blancos) para que se vea
 * grande en las piezas. Si algo falla, devuelve el archivo original.
 */
async function recortarLogo(f: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(f);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const vacio = data[i + 3] < 16 || (data[i] > 242 && data[i + 1] > 242 && data[i + 2] > 242);
        if (!vacio) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return f;
    const margen = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
    x0 = Math.max(0, x0 - margen);
    y0 = Math.max(0, y0 - margen);
    x1 = Math.min(width - 1, x1 + margen);
    y1 = Math.min(height - 1, y1 + margen);
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (w > width * 0.95 && h > height * 0.95) return f; // no había márgenes que quitar
    const salida = document.createElement("canvas");
    salida.width = w;
    salida.height = h;
    salida.getContext("2d")!.drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => salida.toBlob(r, "image/png"));
    return blob ? new File([blob], f.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" }) : f;
  } catch {
    return f;
  }
}

function SelectorColor({ etiqueta, ayuda, valor, onChange }: { etiqueta: string; ayuda: string; valor: string; onChange: (v: string) => void }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  return (
    <label className="block">
      <span className="text-sm font-medium">{etiqueta}</span>
      <span className="block text-xs text-gray-500 mb-1">{ayuda}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={valor} onChange={(e) => onChange(e.target.value)} className="w-12 h-10 border rounded cursor-pointer" />
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            if (HEX.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
          className="w-28 border rounded px-2 py-1.5 font-mono text-sm"
        />
      </div>
    </label>
  );
}

export function KitMarca({ inicial, esAdmin }: { inicial: Marca; esAdmin: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(inicial.logoUrl);
  const [c, setC] = useState({
    primario: inicial.colorPrimario ?? DEFECTO.primario,
    oscuro: inicial.colorOscuro ?? DEFECTO.oscuro,
    acento: inicial.colorAcento ?? DEFECTO.acento,
  });
  const [preview, setPreview] = useState("");
  const [estado, setEstado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Vista previa en vivo (con pausa para no generar una imagen por cada tecla).
  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams({ primario: c.primario, oscuro: c.oscuro, acento: c.acento, v: String(logo ?? "") });
      setPreview(q.toString());
    }, 500);
    return () => clearTimeout(t);
  }, [c, logo]);

  async function subirLogo(archivos: FileList | null) {
    const f = archivos?.[0];
    if (!f) return;
    setError(null);
    setEstado("Subiendo logo…");
    try {
      const form = new FormData();
      form.set("file", await recortarLogo(f));
      const res = await fetch("/api/mercadeo/marca/logo", { method: "POST", body: form });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "No se pudo subir el logo");
      setLogo(j.logoUrl);
      setEstado("Logo guardado. Puedes sugerir los colores a partir de él.");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setEstado(null);
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function quitarLogo() {
    if (!confirm("¿Quitar el logo de las piezas?")) return;
    const res = await fetch("/api/mercadeo/marca/logo", { method: "DELETE" });
    if (res.ok) {
      setLogo(null);
      router.refresh();
    }
  }

  async function sugerir() {
    if (!logo) return;
    setError(null);
    try {
      const s = await coloresDelLogo(logo);
      if (!s) throw new Error("El logo no tiene colores suficientes para sugerir una paleta.");
      setC({ primario: s.primario, oscuro: s.oscuro, acento: s.acento ?? c.acento });
      setEstado(
        s.acento
          ? "Colores sugeridos a partir del logo. Revísalos en la vista previa y guarda."
          : "Colores sugeridos (el logo tiene un solo color: elige tú el color de los botones)."
      );
    } catch (e: any) {
      setError(e.message ?? "No se pudieron leer los colores del logo.");
    }
  }

  async function guardar() {
    setError(null);
    setEstado("Guardando…");
    const res = await fetch("/api/mercadeo/marca", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colorPrimario: c.primario, colorOscuro: c.oscuro, colorAcento: c.acento }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "No se pudo guardar");
      setEstado(null);
      return;
    }
    setEstado("Kit de marca guardado. Todas las piezas (también las de planes ya generados) usan estos colores.");
    router.refresh();
  }

  return (
    <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-start">
      <div className="space-y-6">
        <section className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-1">Logo</h2>
          <p className="text-xs text-gray-500 mb-3">PNG con fondo transparente (ideal), JPG o WEBP, hasta 3 MB.</p>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-48 h-24 border rounded-lg flex items-center justify-center bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Logo" className="max-w-[180px] max-h-20 object-contain" />
              ) : (
                <span className="text-xs text-gray-400">Sin logo</span>
              )}
            </div>
            {esAdmin && (
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => input.current?.click()} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700">
                  {logo ? "Cambiar logo" : "+ Subir logo"}
                </button>
                {logo && (
                  <>
                    <button type="button" onClick={sugerir} className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                      Sugerir colores del logo
                    </button>
                    <button type="button" onClick={quitarLogo} className="text-xs text-red-600 hover:underline">
                      Quitar logo
                    </button>
                  </>
                )}
              </div>
            )}
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => subirLogo(e.target.files)} />
          </div>
        </section>

        <section className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Colores</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <SelectorColor etiqueta="Principal" ayuda="Ubicación, etiquetas, fondos" valor={c.primario} onChange={(v) => setC({ ...c, primario: v })} />
            <SelectorColor etiqueta="Oscuro" ayuda="Textos y franjas oscuras" valor={c.oscuro} onChange={(v) => setC({ ...c, oscuro: v })} />
            <SelectorColor etiqueta="Acento" ayuda="Botón de llamada a la acción" valor={c.acento} onChange={(v) => setC({ ...c, acento: v })} />
          </div>
          {esAdmin ? (
            <button type="button" onClick={guardar} className="bg-green-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-green-700">
              Guardar kit de marca
            </button>
          ) : (
            <p className="text-xs text-gray-500">Solo un administrador de la empresa puede cambiar el kit de marca.</p>
          )}
        </section>
        {estado && <p className="text-sm text-gray-700">{estado}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <section>
        <div className="text-xs text-gray-500 mb-2">Vista previa (feed y reel)</div>
        <div className="flex gap-3 items-start">
          {preview && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/mercadeo/marca/preview?formato=IMAGEN&${preview}`} alt="Vista previa feed" className="w-64 rounded-lg border shadow-sm" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/mercadeo/marca/preview?formato=REEL&${preview}`} alt="Vista previa reel" className="w-40 rounded-lg border shadow-sm" />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
