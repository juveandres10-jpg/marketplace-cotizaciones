// Vista de solo lectura de un plan (análisis + estrategia + piezas).
// Se usa en la página interna del plan y en la página pública de aprobación.

import type { Analisis } from "@/lib/mercadeo/analisis";
import { formatoFechaHora } from "@/lib/mercadeo/fechas";

export const ESTADO_PLAN_BADGE: Record<string, string> = {
  BORRADOR: "bg-gray-100 text-gray-700",
  PENDIENTE_APROBACION: "bg-amber-50 text-amber-700",
  APROBADO: "bg-green-50 text-green-700",
  RECHAZADO: "bg-red-50 text-red-700",
  PUBLICADO: "bg-brand-50 text-brand-700",
};

export const ESTADO_PLAN_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  PENDIENTE_APROBACION: "Pendiente de aprobación",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  PUBLICADO: "Publicado en Meta",
};

export function dinero(n: number | null | undefined, moneda = "COP") {
  if (n == null) return "—";
  return `${moneda} ${Math.round(n).toLocaleString("es-CO")}`;
}

function pct(n: number | null | undefined) {
  return n == null ? "—" : `${(n * 100).toFixed(1)}%`;
}

/** Markdown mínimo (##, viñetas, **negrita**) renderizado como elementos React (sin HTML crudo). */
export function MarkdownSimple({ texto }: { texto: string }) {
  const bloques: JSX.Element[] = [];
  let lista: string[] = [];
  const inline = (s: string, k: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
      parte.startsWith("**") && parte.endsWith("**") ? (
        <strong key={`${k}-${i}`}>{parte.slice(2, -2)}</strong>
      ) : (
        <span key={`${k}-${i}`}>{parte}</span>
      )
    );
  const cerrarLista = () => {
    if (lista.length) {
      const items = lista;
      bloques.push(
        <ul key={`ul-${bloques.length}`} className="list-disc pl-5 mb-3 space-y-1">
          {items.map((it, i) => (
            <li key={i}>{inline(it, `li${i}`)}</li>
          ))}
        </ul>
      );
      lista = [];
    }
  };
  texto.split("\n").forEach((linea, i) => {
    const t = linea.trim();
    if (/^[-*] /.test(t)) {
      lista.push(t.slice(2));
      return;
    }
    cerrarLista();
    if (/^#{1,3} /.test(t)) {
      bloques.push(
        <h4 key={i} className="font-semibold mt-4 mb-1">
          {t.replace(/^#+ /, "")}
        </h4>
      );
    } else if (t) {
      bloques.push(
        <p key={i} className="mb-2">
          {inline(t, `p${i}`)}
        </p>
      );
    }
  });
  cerrarLista();
  return <div className="text-sm text-gray-700">{bloques}</div>;
}

export function AnalisisVista({ analisis }: { analisis: Analisis }) {
  return (
    <div className="space-y-4">
      {analisis.alertas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
          {analisis.alertas.map((a, i) => (
            <div key={i}>⚠️ {a}</div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Red</th>
              <th className="px-4 py-2 font-medium text-right">Seguidores</th>
              <th className="px-4 py-2 font-medium text-right">Publicaciones</th>
              <th className="px-4 py-2 font-medium text-right">Alcance</th>
              <th className="px-4 py-2 font-medium text-right">Interacción</th>
              <th className="px-4 py-2 font-medium text-right">CTR</th>
              <th className="px-4 py-2 font-medium text-right">Contactos</th>
              <th className="px-4 py-2 font-medium text-right">Inversión</th>
              <th className="px-4 py-2 font-medium text-right">Costo/contacto</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {analisis.porPlataforma.map((k) => (
              <tr key={k.plataforma}>
                <td className="px-4 py-2 font-medium">{k.plataforma === "INSTAGRAM" ? "Instagram" : "Facebook"}</td>
                <td className="px-4 py-2 text-right">
                  {k.seguidores?.toLocaleString("es-CO") ?? "—"}
                  {k.crecimientoSeguidores != null && (
                    <span className={`text-xs ml-1 ${k.crecimientoSeguidores >= 0 ? "text-green-600" : "text-red-600"}`}>
                      ({k.crecimientoSeguidores >= 0 ? "+" : ""}
                      {k.crecimientoSeguidores})
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {k.publicaciones}
                  {k.pagadas > 0 && <span className="text-xs text-gray-400"> ({k.pagadas} pauta)</span>}
                </td>
                <td className="px-4 py-2 text-right">{k.alcance.toLocaleString("es-CO")}</td>
                <td className="px-4 py-2 text-right">{pct(k.tasaInteraccion)}</td>
                <td className="px-4 py-2 text-right">{pct(k.ctr)}</td>
                <td className="px-4 py-2 text-right">{k.leads + k.mensajes}</td>
                <td className="px-4 py-2 text-right">{k.gasto > 0 ? dinero(k.gasto, analisis.moneda) : "—"}</td>
                <td className="px-4 py-2 text-right">{dinero(k.cpl, analisis.moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-xl bg-white p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">
            Mejores franjas para publicar ({analisis.zonaHoraria})
          </div>
          <ol className="text-sm space-y-1">
            {analisis.mejoresFranjas.map((f, i) => (
              <li key={i} className="flex justify-between">
                <span>
                  {i + 1}. {f.etiqueta}
                </span>
                <span className="text-xs text-gray-400">
                  {f.fuente === "datos" ? `${f.publicaciones} pub. · puntaje ${f.puntaje.toFixed(1)}` : "referencia sector"}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="border rounded-xl bg-white p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">
            Recomendación semanal · confianza {analisis.confianza} ({analisis.totalPublicaciones} publicaciones en{" "}
            {analisis.ventanaDias} días)
          </div>
          <ul className="text-sm space-y-1">
            <li>Instagram: {analisis.recomendacion.publicacionesSemana.INSTAGRAM} publicaciones/semana</li>
            <li>Facebook: {analisis.recomendacion.publicacionesSemana.FACEBOOK} publicaciones/semana</li>
            <li>Formato prioritario: {analisis.recomendacion.formatoPrioritario.toLowerCase()}</li>
            {analisis.recomendacion.presupuestoSemanal > 0 && (
              <li>
                Pauta: {analisis.recomendacion.pautasSemana} piezas · Instagram{" "}
                {analisis.recomendacion.repartoPresupuesto.INSTAGRAM}% / Facebook{" "}
                {analisis.recomendacion.repartoPresupuesto.FACEBOOK}%
              </li>
            )}
          </ul>
          {analisis.hallazgos.length > 0 && (
            <ul className="text-xs text-gray-500 mt-3 space-y-1 list-disc pl-4">
              {analisis.hallazgos.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export type PiezaVista = {
  id: string;
  orden: number;
  fechaProgramada: Date | string;
  plataforma: string;
  formato: string;
  objetivo: string;
  tema: string;
  pagada: boolean;
  presupuesto: number;
  diasPauta: number;
  titular: string;
  copy: string;
  cta: string;
  hashtags: string | null;
  conceptoVisual: string;
  guionVideo: string | null;
  videoUrl?: string | null;
  estadoMeta: string | null;
  errorMeta: string | null;
  updatedAt?: Date | string;
};

export function PiezaTarjeta({ pieza, moneda, children }: { pieza: PiezaVista; moneda: string; children?: React.ReactNode }) {
  const vertical = pieza.formato === "REEL" || pieza.formato === "HISTORIA";
  // Cambia cuando se edita la pieza, para no mostrar una imagen vieja en caché.
  const version = pieza.updatedAt ? new Date(pieza.updatedAt).getTime() : 0;
  return (
    <div id={`pieza-${pieza.orden}`} className="border rounded-xl bg-white p-4 flex gap-4 flex-col sm:flex-row scroll-mt-4">
      <a href={`/api/mercadeo/piezas/${pieza.id}/imagen?v=${version}`} target="_blank" rel="noreferrer" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/mercadeo/piezas/${pieza.id}/imagen?v=${version}`}
          alt={pieza.titular}
          loading="lazy"
          className={`rounded-lg border bg-gray-100 ${vertical ? "w-32 h-[227px]" : "w-40 h-[200px]"} object-cover`}
        />
      </a>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="font-medium text-gray-700">#{pieza.orden}</span>
          <span>{formatoFechaHora(pieza.fechaProgramada)}</span>
          <span className="px-2 py-0.5 rounded-full bg-gray-100">
            {pieza.plataforma === "INSTAGRAM" ? "Instagram" : "Facebook"}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-gray-100">{pieza.formato.toLowerCase()}</span>
          {pieza.videoUrl && (
            <a href={pieza.videoUrl} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 hover:underline">
              🎬 con video
            </a>
          )}
          {pieza.pagada ? (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
              Pauta {dinero(pieza.presupuesto, moneda)} · {pieza.diasPauta} días · {pieza.objetivo.toLowerCase()}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700">orgánica</span>
          )}
          {pieza.estadoMeta && (
            <span
              className={`px-2 py-0.5 rounded-full ${pieza.estadoMeta === "ERROR" ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700"}`}
              title={pieza.errorMeta ?? undefined}
            >
              Meta: {pieza.estadoMeta.toLowerCase().replace("_", " ")}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Tema: {pieza.tema} ·{" "}
          <a href={`/api/mercadeo/piezas/${pieza.id}/imagen?v=${version}`} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
            Abrir imagen en grande
          </a>
        </div>
        <div className="font-semibold mt-2">{pieza.titular}</div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{pieza.copy}</p>
        {pieza.hashtags && <p className="text-xs text-brand-700 mt-1">{pieza.hashtags}</p>}
        <details className="mt-2 text-xs text-gray-600">
          <summary className="cursor-pointer text-gray-500">Concepto visual{pieza.guionVideo ? " y guion de video" : ""}</summary>
          <p className="mt-1">
            <strong>Visual:</strong> {pieza.conceptoVisual}
          </p>
          {pieza.guionVideo && <p className="mt-1 whitespace-pre-wrap">{pieza.guionVideo}</p>}
        </details>
        {pieza.errorMeta && <p className="text-xs text-red-600 mt-2">{pieza.errorMeta}</p>}
        {children}
      </div>
    </div>
  );
}
