// Generación de la pieza gráfica (PNG) de cada publicación a partir de los
// datos del proyecto: titular, precio desde, ubicación, CTA y contacto sobre
// el render del proyecto (si se cargó `imagenUrl`) o un fondo de marca.
// Se usa tanto para previsualizar/descargar como para subirla a Meta.

import { ImageResponse } from "next/og";
import { formatoMoneda } from "./estrategia";

type PiezaImagen = {
  formato: string;
  titular: string;
  cta: string;
  plataforma: string;
};

type ProyectoImagen = {
  nombre: string;
  tipoInmueble: string;
  ciudad: string;
  zona: string | null;
  precioDesde: number | null;
  moneda: string;
  whatsapp: string | null;
  urlLanding: string | null;
  imagenUrl: string | null;
};

const COLOR_PRIMARIO = process.env.MERCADEO_COLOR_PRIMARIO || "#1e40af";
const COLOR_OSCURO = process.env.MERCADEO_COLOR_OSCURO || "#0f172a";
const COLOR_ACENTO = process.env.MERCADEO_COLOR_ACENTO || "#f59e0b";

export function dimensionesPieza(formato: string) {
  // Reels e historias son verticales 9:16; el resto, cuadrado 1:1 (feed).
  return formato === "REEL" || formato === "HISTORIA"
    ? { width: 1080, height: 1920 }
    : { width: 1080, height: 1080 };
}

function render(pieza: PiezaImagen, p: ProyectoImagen, conFoto: boolean) {
  const { width, height } = dimensionesPieza(pieza.formato);
  const vertical = height > width;
  const ubicacion = [p.zona, p.ciudad].filter(Boolean).join(" · ");
  const contacto = p.whatsapp
    ? `WhatsApp +${p.whatsapp.replace(/\D/g, "")}`
    : p.urlLanding
      ? p.urlLanding.replace(/^https?:\/\//, "")
      : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          fontFamily: "sans-serif",
          color: "white",
          background: `linear-gradient(135deg, ${COLOR_PRIMARIO} 0%, ${COLOR_OSCURO} 100%)`,
        }}
      >
        {conFoto && p.imagenUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.imagenUrl}
            width={width}
            height={height}
            style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            display: "flex",
            background: conFoto && p.imagenUrl
              ? "linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.35) 45%, rgba(15,23,42,0.92) 100%)"
              : "transparent",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: vertical ? "120px 80px 160px" : "70px 80px",
          }}
        >
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                background: "rgba(255,255,255,0.18)",
                borderRadius: 999,
                padding: "12px 28px",
                fontSize: 30,
                letterSpacing: 1,
              }}
            >
              {`${p.tipoInmueble} · ${ubicacion}`}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, opacity: 0.85, marginBottom: 12 }}>{p.nombre}</div>
            <div
              style={{
                fontSize: vertical ? 92 : 78,
                fontWeight: 700,
                lineHeight: 1.08,
                display: "flex",
              }}
            >
              {pieza.titular}
            </div>
            {p.precioDesde != null && !pieza.titular.includes(formatoMoneda(p.precioDesde, p.moneda)) && (
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 28 }}>
                <span style={{ fontSize: 36, opacity: 0.85, marginRight: 14 }}>Desde</span>
                <span style={{ fontSize: 64, fontWeight: 700, color: COLOR_ACENTO }}>
                  {formatoMoneda(p.precioDesde, p.moneda)}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                background: COLOR_ACENTO,
                color: COLOR_OSCURO,
                borderRadius: 16,
                padding: "20px 36px",
                fontSize: 40,
                fontWeight: 700,
              }}
            >
              {pieza.cta}
            </div>
            {contacto && (
              <div style={{ fontSize: 32, marginTop: 22, opacity: 0.9, display: "flex" }}>{contacto}</div>
            )}
          </div>
        </div>
      </div>
    ),
    { width, height }
  );
}

/** Devuelve el PNG de la pieza. Si el render de fondo no carga, usa el fondo de marca. */
export async function generarImagenPieza(pieza: PiezaImagen, proyecto: ProyectoImagen): Promise<Buffer> {
  if (proyecto.imagenUrl) {
    try {
      return Buffer.from(await render(pieza, proyecto, true).arrayBuffer());
    } catch (error) {
      console.warn("[mercadeo] No se pudo usar imagenUrl de fondo, se usa fondo de marca:", error);
    }
  }
  return Buffer.from(await render(pieza, proyecto, false).arrayBuffer());
}
