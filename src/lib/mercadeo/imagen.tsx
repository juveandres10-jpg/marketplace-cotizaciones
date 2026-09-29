// Generación de la pieza gráfica (PNG) de cada publicación.
//
// Diseño: la foto/render del proyecto ocupa la parte superior SIN texto
// encima (así no se mezcla con textos que ya traiga la imagen) y la
// información va en una franja inferior limpia: ubicación, titular corto,
// 2-3 beneficios concretos del proyecto, precio y llamada a la acción.
// Formatos: 1080x1350 (4:5, feed de Instagram/Facebook) y 1080x1920 (9:16,
// reels e historias). Se usa para previsualizar, descargar y subir a Meta.

import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { formatoMoneda } from "./estrategia";
import { prisma } from "@/lib/prisma";

type PiezaImagen = {
  orden?: number;
  formato: string;
  titular: string;
  cta: string;
  plataforma: string;
  tema?: string;
  imagenFondo?: string | null;
};

type ProyectoImagen = {
  nombre: string;
  tipoInmueble: string;
  ciudad: string;
  zona: string | null;
  precioDesde: number | null;
  moneda: string;
  areaDesde?: number | null;
  habitaciones?: string | null;
  amenidades?: string | null;
  diferenciales?: string | null;
  whatsapp: string | null;
  urlLanding: string | null;
  imagenUrl: string | null;
  imagenes?: string[];
};

export type Marca = {
  logoUrl?: string | null;
  colorPrimario?: string | null;
  colorOscuro?: string | null;
  colorAcento?: string | null;
};

type Paleta = { primario: string; oscuro: string; acento: string; suave: string; textoAcento: string };

const HEX = /^#[0-9a-f]{6}$/i;

function mezclar(hex: string, con: string, peso: number) {
  const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(con.slice(i, i + 2), 16));
  return `#${a.map((v, i) => Math.round(v * (1 - peso) + b[i] * peso).toString(16).padStart(2, "0")).join("")}`;
}

function luminancia(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Colores de la pieza: los del kit de marca de la empresa, o los de respaldo. */
export function paletaDe(marca?: Marca | null): Paleta {
  const color = (valor: string | null | undefined, env: string | undefined, defecto: string) =>
    [valor, env, defecto].find((x) => x && HEX.test(x)) as string;
  const primario = color(marca?.colorPrimario, process.env.MERCADEO_COLOR_PRIMARIO, "#1e3a8a");
  const oscuro = color(marca?.colorOscuro, process.env.MERCADEO_COLOR_OSCURO, "#0f172a");
  const acento = color(marca?.colorAcento, process.env.MERCADEO_COLOR_ACENTO, "#f59e0b");
  return {
    primario,
    oscuro,
    acento,
    suave: mezclar(primario, "#ffffff", 0.9), // fondo de las etiquetas
    textoAcento: luminancia(acento) > 0.35 ? oscuro : "#ffffff", // legible sobre el botón
  };
}

/** Imagen de la pieza: la elegida en el editor o, si no, rota por la galería del proyecto. */
export function fondoPieza(pieza: PiezaImagen, p: ProyectoImagen): string | null {
  if (pieza.imagenFondo === "") return null; // "sin foto" elegido en el editor
  if (pieza.imagenFondo) return pieza.imagenFondo;
  const galeria = [...(p.imagenes ?? []), ...(p.imagenUrl ? [p.imagenUrl] : [])];
  if (galeria.length === 0) return null;
  return galeria[Math.max(0, (pieza.orden ?? 1) - 1) % galeria.length];
}

export function dimensionesPieza(formato: string) {
  return formato === "REEL" || formato === "HISTORIA"
    ? { width: 1080, height: 1920 }
    : { width: 1080, height: 1350 };
}

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------

let fuentesCache: Promise<{ name: string; data: ArrayBuffer; weight: 500 | 700 | 800; style: "normal" }[]> | null = null;
function fuentes() {
  if (!fuentesCache) {
    const dir = path.join(process.cwd(), "src/lib/mercadeo/fuentes");
    fuentesCache = Promise.all(
      ([500, 700, 800] as const).map(async (weight) => {
        const buf = await readFile(path.join(dir, `montserrat-latin-${weight}-normal.woff`));
        return {
          name: "Montserrat",
          data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
          weight,
          style: "normal" as const,
        };
      })
    ).catch((error) => {
      console.warn("[mercadeo] No se pudieron cargar las fuentes, se usa la de sistema:", error);
      fuentesCache = null;
      return [];
    });
  }
  return fuentesCache;
}

/** Tamaño en píxeles de un JPG/PNG/WEBP leyendo su cabecera. */
function tamanoImagen(b: Buffer): { w: number; h: number; tipo: string } | null {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), tipo: "image/png" };
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), tipo: "image/webp" };
    if (chunk === "VP8L") {
      const bits = b.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1, tipo: "image/webp" };
    }
    if (chunk === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, tipo: "image/webp" };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marcador = b[i + 1];
      const largo = b.readUInt16BE(i + 2);
      if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), tipo: "image/jpeg" };
      }
      i += 2 + largo;
    }
  }
  return null;
}

type FotoCargada = { src: string; w: number; h: number };

async function cargarFoto(url: string): Promise<FotoCargada | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const t = tamanoImagen(buf);
    if (!t || !t.w || !t.h) return null;
    return { src: `data:${t.tipo};base64,${buf.toString("base64")}`, w: t.w, h: t.h };
  } catch {
    return null;
  }
}

function telefonoLegible(numero: string) {
  const d = numero.replace(/\D/g, "");
  if (d.startsWith("57") && d.length === 12) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return `+${d}`;
}

function recortar(texto: string, max: number) {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max).replace(/\s+\S*$/, "");
  return `${corte}…`;
}

/** 2-3 beneficios cortos y concretos del proyecto, elegidos según el tema de la pieza. */
export function beneficiosPieza(tema: string | undefined, p: ProyectoImagen): string[] {
  const t = (tema ?? "").toLowerCase();
  const habitaciones = (p.habitaciones ?? "")
    .split(/[,;]| y /)
    .map((s) => s.trim())
    .filter((s) => s && s.length <= 24);
  const area = p.areaDesde ? [`${p.areaDesde.toLocaleString("es-CO")} m²`] : [];
  const diferenciales = (p.diferenciales ?? "")
    .split(/[.;\n]/)
    .map((s) => s.trim().replace(/^aplica\s+/i, ""))
    .filter((s) => s && s.length <= 34)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  const amenidades = (p.amenidades ?? "")
    .split(/[,;]| y /)
    .map((s) => s.trim())
    .filter((s) => s && s.length <= 24)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  let orden: string[];
  if (t.includes("precio") || t.includes("pago")) orden = [...diferenciales, ...area, ...habitaciones];
  else if (t.includes("amenidad")) orden = [...amenidades, ...area, ...diferenciales];
  else if (t.includes("espacio") || t.includes("estilo")) orden = [...habitaciones, ...area, ...amenidades];
  else if (t.includes("avance") || t.includes("sala de ventas")) orden = [...diferenciales.slice().reverse(), ...area];
  else orden = [...habitaciones.slice(0, 1), ...area, ...diferenciales];
  return Array.from(new Set(orden)).slice(0, 3);
}

// ------------------------------------------------------------------
// Diseño
// ------------------------------------------------------------------

function Foto({ foto, ancho, alto, c }: { foto: FotoCargada | null; ancho: number; alto: number; c: Paleta }) {
  if (!foto) {
    return (
      <div
        style={{
          width: ancho,
          height: alto,
          display: "flex",
          background: `linear-gradient(135deg, ${c.primario} 0%, ${c.oscuro} 100%)`,
        }}
      />
    );
  }
  const ratioFoto = foto.w / foto.h;
  const ratioCaja = ancho / alto;
  // Si la foto tiene una proporción muy distinta a la del espacio (p. ej. una
  // foto vertical de WhatsApp en un espacio horizontal), se muestra completa
  // sobre una versión ampliada y oscurecida de sí misma, en vez de recortarla.
  const encaja = Math.abs(Math.log(ratioFoto / ratioCaja)) < 0.35;
  if (encaja) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={foto.src} width={ancho} height={alto} style={{ width: ancho, height: alto, objectFit: "cover" }} />;
  }
  const escala = Math.min(ancho / foto.w, alto / foto.h);
  const w = Math.round(foto.w * escala);
  const h = Math.round(foto.h * escala);
  return (
    <div style={{ width: ancho, height: alto, display: "flex", position: "relative", overflow: "hidden", background: c.oscuro }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.src}
        width={ancho}
        height={alto}
        style={{ position: "absolute", top: 0, left: 0, width: ancho, height: alto, objectFit: "cover", opacity: 0.35 }}
      />
      <div style={{ position: "absolute", top: 0, left: 0, width: ancho, height: alto, display: "flex", background: "rgba(15,23,42,0.55)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.src}
        width={w}
        height={h}
        style={{ position: "absolute", top: Math.round((alto - h) / 2), left: Math.round((ancho - w) / 2), width: w, height: h }}
      />
    </div>
  );
}

type Fuente = Awaited<ReturnType<typeof fuentes>>[number];

function render(
  pieza: PiezaImagen,
  p: ProyectoImagen,
  foto: FotoCargada | null,
  fuentesCargadas: Fuente[],
  c: Paleta,
  logo: FotoCargada | null
) {
  const conFuentes = fuentesCargadas.length > 0;
  const { width, height } = dimensionesPieza(pieza.formato);
  const vertical = height === 1920; // reels e historias (9:16); el feed es 4:5
  // Historias y reels: Instagram tapa ~250 px arriba y abajo con su interfaz.
  const margenSuperior = vertical ? 200 : 0;
  const altoFoto = vertical ? 1000 : 780;
  const padX = 72;
  const ubicacion = [p.zona, p.ciudad].filter(Boolean).join(", ");
  const titular = recortar(pieza.titular.trim(), 60);
  const tamTitular = titular.length <= 24 ? 78 : titular.length <= 36 ? 66 : titular.length <= 48 ? 56 : 48;
  const beneficios = beneficiosPieza(pieza.tema, p);
  const precio = p.precioDesde != null ? formatoMoneda(p.precioDesde, p.moneda) : null;
  const contacto = p.whatsapp ? telefonoLegible(p.whatsapp) : p.urlLanding ? p.urlLanding.replace(/^https?:\/\//, "") : "";
  const familia = conFuentes ? "Montserrat" : "sans-serif";

  return new ImageResponse(
    (
      <div style={{ width, height, display: "flex", flexDirection: "column", background: "#ffffff", fontFamily: familia }}>
        {vertical && (
          <div
            style={{
              height: margenSuperior,
              display: "flex",
              alignItems: "flex-end",
              padding: `0 ${padX}px 36px`,
              background: c.oscuro,
              color: "#ffffff",
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 4,
            }}
          >
            {logo && (
              <div style={{ display: "flex", background: "#ffffff", borderRadius: 16, padding: "10px 16px", marginRight: 28 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo.src} width={Math.round((80 * logo.w) / logo.h)} height={80} style={{ maxWidth: 360, objectFit: "contain" }} />
              </div>
            )}
            {p.nombre.toUpperCase()}
          </div>
        )}
        <Foto foto={foto} ancho={width} alto={altoFoto} c={c} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: vertical ? `56px ${padX}px 240px` : `44px ${padX}px 48px`,
            background: "#ffffff",
            color: c.oscuro,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 3, color: c.primario }}>
                {(vertical ? ubicacion : `${p.nombre} · ${ubicacion}`).toUpperCase()}
              </div>
              {logo && !vertical && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo.src}
                  width={Math.min(260, Math.round((64 * logo.w) / logo.h))}
                  height={64}
                  style={{ objectFit: "contain" }}
                />
              )}
            </div>
            <div style={{ display: "flex", fontSize: tamTitular, fontWeight: 800, lineHeight: 1.08, marginTop: 14 }}>
              {titular}
            </div>
            {beneficios.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", marginTop: 24 }}>
                {beneficios.map((b) => (
                  <div
                    key={b}
                    style={{
                      display: "flex",
                      fontSize: 26,
                      fontWeight: 500,
                      padding: "10px 22px",
                      marginRight: 14,
                      marginBottom: 12,
                      borderRadius: 999,
                      background: c.suave,
                      color: c.primario,
                    }}
                  >
                    {b}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            {precio ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: "#64748b" }}>Desde</div>
                <div style={{ display: "flex", fontSize: 58, fontWeight: 800, color: c.oscuro, lineHeight: 1 }}>{precio}</div>
              </div>
            ) : (
              <div style={{ display: "flex" }} />
            )}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div
                style={{
                  display: "flex",
                  background: c.acento,
                  color: c.textoAcento,
                  borderRadius: 999,
                  padding: "18px 34px",
                  fontSize: 28,
                  fontWeight: 800,
                }}
              >
                {recortar(pieza.cta, 30)}
              </div>
              {contacto && (
                <div style={{ display: "flex", fontSize: 26, fontWeight: 700, marginTop: 12, color: "#334155" }}>
                  {p.whatsapp ? `WhatsApp ${contacto}` : contacto}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    { width, height, ...(conFuentes ? { fonts: fuentesCargadas } : {}) }
  );
}

async function marcaDeEmpresa(empresaId: string | undefined): Promise<Marca | null> {
  if (!empresaId) return null;
  return prisma.empresa
    .findUnique({ where: { id: empresaId }, select: { logoUrl: true, colorPrimario: true, colorOscuro: true, colorAcento: true } })
    .catch(() => null);
}

/**
 * Devuelve el PNG de la pieza. Usa el kit de marca de la empresa del proyecto
 * (o el `marca` recibido, p. ej. para la vista previa). Si la foto no carga, usa
 * un fondo de marca.
 */
export async function generarImagenPieza(
  pieza: PiezaImagen,
  proyecto: ProyectoImagen & { empresaId?: string },
  marca?: Marca | null
): Promise<Buffer> {
  const url = fondoPieza(pieza, proyecto);
  const m = marca !== undefined ? marca : await marcaDeEmpresa(proyecto.empresaId);
  const [foto, logo, fuentesCargadas] = await Promise.all([
    url ? cargarFoto(url) : null,
    m?.logoUrl ? cargarFoto(m.logoUrl) : null,
    fuentes(),
  ]);
  const c = paletaDe(m);
  try {
    return Buffer.from(await render(pieza, proyecto, foto, fuentesCargadas, c, logo).arrayBuffer());
  } catch (error) {
    // Una imagen corrupta no debe impedir publicar: se usa el fondo de marca.
    console.warn("[mercadeo] Error dibujando la pieza con foto, se usa fondo de marca:", error);
    return Buffer.from(await render(pieza, proyecto, null, fuentesCargadas, c, null).arrayBuffer());
  }
}
