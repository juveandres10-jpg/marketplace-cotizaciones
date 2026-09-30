"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalisisCreativo } from "@/lib/mercadeo/creativo";
import { HERRAMIENTAS_CREATIVAS } from "@/lib/mercadeo/creativo-datos";
import { MarkdownSimple } from "@/components/mercadeo-plan-vista";
import { useNombreAprobador } from "@/components/mercadeo-acciones";

async function llamar(url: string, cuerpo: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Error inesperado");
  return json;
}

// Colores del diagrama sobre la foto: trazos claros con halo oscuro para leerse sobre cualquier imagen.
const TRAZO = "#ffffff";
const HALO = "rgba(15,23,42,0.75)";
const FUERTE = "#34d399";
const MEJORAR = "#fbbf24";
const MARCA = "#1d4ed8";

/** Diagrama de lectura: la pieza con guías de tercios, zonas, punto focal y recorrido del ojo. */
function DiagramaLectura({ imagenUrl, a, guias }: { imagenUrl: string; a: AnalisisCreativo; guias: boolean }) {
  const W = 100;
  const H = 100 * (a.proporcion || 1.25);
  const px = (x: number) => x * W;
  const py = (y: number) => y * H;
  const camino = a.recorridoVisual.map((p) => `${px(p.x)},${py(p.y)}`).join(" ");
  const halo = {
    paintOrder: "stroke" as const,
    stroke: HALO,
    strokeWidth: 0.9,
  };
  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imagenUrl} alt="Pieza analizada" className="w-full rounded-lg border block" />
      {guias && (
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" role="img" aria-label="Diagrama de lectura de la pieza">
          {[1, 2].map((i) => (
            <g key={i} stroke={TRAZO} strokeOpacity={0.45} strokeWidth={0.25} strokeDasharray="1 1">
              <line x1={(W * i) / 3} y1={0} x2={(W * i) / 3} y2={H} />
              <line x1={0} y1={(H * i) / 3} x2={W} y2={(H * i) / 3} />
            </g>
          ))}
          {a.zonas.map((z, i) => {
            const color = z.tipo === "fuerte" ? FUERTE : MEJORAR;
            return (
              <g key={i}>
                <title>{`${z.tipo === "fuerte" ? "Fortaleza" : "A mejorar"}: ${z.etiqueta}`}</title>
                <rect
                  x={px(z.x)}
                  y={py(z.y)}
                  width={px(z.ancho)}
                  height={py(z.alto)}
                  rx={1.2}
                  fill={color}
                  fillOpacity={0.12}
                  stroke={color}
                  strokeWidth={0.6}
                  strokeDasharray={z.tipo === "mejorar" ? "2 1.2" : undefined}
                />
                <text x={px(z.x) + 1.2} y={py(z.y) + 3.6} fontSize={2.9} fontWeight={700} fill={color} style={halo}>
                  {z.tipo === "fuerte" ? "✓ " : "! "}
                  {z.etiqueta}
                </text>
              </g>
            );
          })}
          {camino && (
            <polyline
              points={camino}
              fill="none"
              stroke={TRAZO}
              strokeWidth={0.6}
              strokeOpacity={0.9}
              strokeLinejoin="round"
              style={halo}
            />
          )}
          <g>
            <title>{`Punto focal: ${a.puntoFocal.descripcion}`}</title>
            <circle
              cx={px(a.puntoFocal.x)}
              cy={py(a.puntoFocal.y)}
              r={6}
              fill="none"
              stroke={TRAZO}
              strokeWidth={0.5}
              strokeOpacity={0.9}
            />
            <circle cx={px(a.puntoFocal.x)} cy={py(a.puntoFocal.y)} r={3.2} fill="none" stroke={TRAZO} strokeWidth={0.5} />
          </g>
          {a.recorridoVisual.map((p, i) => (
            <g key={i}>
              <title>{`${i + 1}. ${p.elemento}`}</title>
              <circle cx={px(p.x)} cy={py(p.y)} r={2.6} fill={MARCA} stroke={TRAZO} strokeWidth={0.5} />
              <text x={px(p.x)} y={py(p.y) + 1.05} fontSize={3} fontWeight={700} fill="#fff" textAnchor="middle">
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

/** Puntaje por factor: barras horizontales de un solo tono, escala fija 0-10. */
function BarrasFactores({ factores }: { factores: AnalisisCreativo["factores"] }) {
  return (
    <ul className="space-y-2" aria-label="Puntaje por factor (0 a 10)">
      {factores.map((f) => (
        <li key={f.factor} title={`${f.factor}: ${f.puntaje}/10 — ${f.comentario}`}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-gray-700">{f.factor}</span>
            <span className="text-gray-900 font-medium tabular-nums">
              {Number.isInteger(f.puntaje) ? f.puntaje : f.puntaje.toFixed(1)}
              <span className="text-gray-400 font-normal">/10</span>
              {f.puntaje < 6 && <span className="ml-1 text-gray-500 font-normal">· a mejorar</span>}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full mt-1">
            <div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.max(2, f.puntaje * 10)}%` }} />
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">{f.comentario}</p>
        </li>
      ))}
    </ul>
  );
}

function CopiarPrompt({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        } catch {
          window.prompt("Copia el prompt:", texto);
        }
      }}
      className="text-[11px] text-brand-700 hover:underline"
    >
      {copiado ? "✓ Copiado" : "Copiar prompt"}
    </button>
  );
}

/**
 * Análisis creativo con IA de una pieza: diagnóstico, diagrama de lectura,
 * puntaje por factor y 3 propuestas originales con la herramienta para producirlas.
 * `endpoint` + `cuerpo` permiten usarlo con sesión o con el enlace de aprobación.
 */
export function AnalisisCreativoPieza({
  imagenUrl,
  analisis,
  endpoint,
  cuerpo,
  disponible,
  puedeAplicar,
}: {
  imagenUrl: string;
  analisis: AnalisisCreativo | null;
  endpoint: string;
  cuerpo: Record<string, unknown>;
  disponible: boolean;
  puedeAplicar: boolean;
}) {
  const router = useRouter();
  const nombre = useNombreAprobador();
  const [cargando, setCargando] = useState<"analizar" | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guias, setGuias] = useState(true);

  async function accion(tipo: "analizar" | "aplicar", indice?: number) {
    setError(null);
    setAviso(null);
    if (
      tipo === "aplicar" &&
      !confirm("Se reemplazan el titular, el texto, la llamada a la acción y el concepto visual de esta pieza. ¿Continuar?")
    )
      return;
    setCargando(tipo === "analizar" ? "analizar" : indice!);
    try {
      const r = await llamar(endpoint, {
        ...cuerpo,
        accion: tipo,
        indice,
        nombre: nombre || undefined,
      });
      setAviso(r.mensaje);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(null);
    }
  }

  if (!analisis) {
    return (
      <div className="mt-3 border-t pt-3 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => accion("analizar")}
          disabled={!disponible || cargando !== null}
          className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-black disabled:opacity-40"
        >
          {cargando === "analizar" ? "Analizando la imagen… (hasta 1-2 min)" : "✦ Análisis creativo con IA"}
        </button>
        <span className="text-xs text-gray-500">
          {disponible
            ? "Diagnóstico, diagrama de lectura y 3 propuestas originales para ganar alcance."
            : "Requiere ANTHROPIC_API_KEY en Vercel."}
        </span>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
      </div>
    );
  }

  const a = analisis;
  return (
    <details className="mt-3 border-t pt-3 group" open={Boolean(aviso)}>
      <summary className="cursor-pointer list-none flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold">✦ Análisis creativo IA</span>
        <span className="text-sm tabular-nums">
          <strong className="text-lg">{a.puntajeGeneral}</strong>
          <span className="text-gray-400">/100</span>
        </span>
        <span className="text-xs text-gray-500 flex-1 min-w-[12rem]">{a.veredicto}</span>
        <span className="text-xs text-brand-700 group-open:hidden">Ver diagrama y propuestas ▾</span>
      </summary>

      <div className="mt-4 space-y-5">
        {a.aplicada && (
          <p className="text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Se aplicó la propuesta “{a.propuestas[a.aplicada.indice]?.nombre}”. Vuelve a analizar para medir la nueva versión.
          </p>
        )}

        <div className="grid md:grid-cols-[280px_1fr] gap-5">
          <div>
            <DiagramaLectura imagenUrl={imagenUrl} a={a} guias={guias} />
            <button type="button" onClick={() => setGuias(!guias)} className="text-xs text-brand-700 hover:underline mt-2">
              {guias ? "Ver imagen sin guías" : "Mostrar diagrama"}
            </button>
            <ol className="text-xs text-gray-600 mt-2 space-y-0.5">
              <li className="text-gray-500">◎ Punto focal: {a.puntoFocal.descripcion}</li>
              {a.recorridoVisual.map((p, i) => (
                <li key={i}>
                  <span className="inline-flex w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] items-center justify-center mr-1">
                    {i + 1}
                  </span>
                  {p.elemento}
                </li>
              ))}
              <li className="text-gray-500 pt-1">
                <span className="inline-block w-3 border-t-2 border-emerald-400 align-middle mr-1" />
                fortaleza · <span className="inline-block w-3 border-t-2 border-dashed border-amber-400 align-middle mx-1" />a mejorar ·
                líneas: tercios
              </li>
            </ol>
          </div>
          <div className="space-y-4 min-w-0">
            <div>
              <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-1">Contexto de la imagen</h4>
              <p className="text-sm text-gray-800">{a.contexto}</p>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Puntaje por factor</h4>
              <BarrasFactores factores={a.factores} />
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-1">Análisis a profundidad</h4>
          <div className="text-sm">
            <MarkdownSimple texto={a.analisis} />
          </div>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">3 propuestas originales</h4>
          <div className="grid lg:grid-cols-3 gap-3">
            {a.propuestas.map((q, i) => (
              <div
                key={i}
                className={`border rounded-xl p-3 flex flex-col gap-2 ${a.aplicada?.indice === i ? "border-green-400 bg-green-50/40" : ""}`}
              >
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Propuesta {i + 1}</div>
                  <div className="font-semibold">{q.nombre}</div>
                  <div className="text-xs text-gray-600">{q.enfoque}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="font-semibold text-sm">{q.titular}</div>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap mt-1">{q.copy}</p>
                  <div className="text-xs font-medium text-brand-700 mt-1">{q.cta}</div>
                </div>
                <p className="text-xs text-gray-600">
                  <strong>Visual:</strong> {q.conceptoVisual}
                </p>
                <p className="text-xs text-gray-600">
                  <strong>Por qué funciona:</strong> {q.porQueFunciona}
                </p>
                <div className="space-y-1.5">
                  {q.herramientas.map((h, j) => (
                    <div key={j} className="text-xs border-l-2 border-brand-100 pl-2">
                      <a
                        href={HERRAMIENTAS_CREATIVAS[h.nombre] ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {h.nombre} ↗
                      </a>
                      <div className="text-gray-600">{h.uso}</div>
                      <div className="flex items-start gap-2 mt-0.5">
                        <code className="text-[11px] text-gray-500 line-clamp-2 flex-1">{h.prompt}</code>
                        <CopiarPrompt texto={h.prompt} />
                      </div>
                    </div>
                  ))}
                </div>
                {puedeAplicar && (
                  <button
                    type="button"
                    onClick={() => accion("aplicar", i)}
                    disabled={cargando !== null}
                    className="mt-auto border border-brand-600 text-brand-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-50 disabled:opacity-50"
                  >
                    {cargando === i ? "Aplicando…" : a.aplicada?.indice === i ? "✓ Aplicada" : "Aplicar esta propuesta"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {a.tacticasAlcance.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-1">Tácticas para más alcance</h4>
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
              {a.tacticasAlcance.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-400">
          <button
            type="button"
            onClick={() => accion("analizar")}
            disabled={!disponible || cargando !== null}
            className="text-brand-700 hover:underline disabled:opacity-40"
          >
            {cargando === "analizar" ? "Analizando…" : "Volver a analizar"}
          </button>
          <span>
            Analizado el{" "}
            {new Date(a.generadoEn).toLocaleString("es-CO", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
      </div>
      {aviso && <p className="text-xs text-green-700 mt-2">✓ {aviso}</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </details>
  );
}

/** Analiza todas las piezas una por una (cada una es una llamada corta, sin agotar el tiempo del servidor). */
export function AnalizarTodasBoton({
  peticiones,
  disponible,
}: {
  peticiones: { orden: number; url: string; cuerpo: Record<string, unknown> }[];
  disponible: boolean;
}) {
  const router = useRouter();
  const [progreso, setProgreso] = useState<string | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [corriendo, setCorriendo] = useState(false);

  async function correr() {
    setCorriendo(true);
    setErrores([]);
    const fallas: string[] = [];
    for (let i = 0; i < peticiones.length; i++) {
      const p = peticiones[i];
      setProgreso(`Analizando pieza #${p.orden} (${i + 1} de ${peticiones.length})…`);
      try {
        await llamar(p.url, { ...p.cuerpo, accion: "analizar" });
      } catch (e: any) {
        fallas.push(`#${p.orden}: ${e.message}`);
      }
    }
    setErrores(fallas);
    setProgreso(fallas.length ? `Listo, con ${fallas.length} error(es).` : "✓ Todas las piezas analizadas.");
    setCorriendo(false);
    router.refresh();
  }

  if (peticiones.length === 0 && !progreso) return null;
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {peticiones.length > 0 && (
        <button
          type="button"
          onClick={correr}
          disabled={!disponible || corriendo}
          className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-black disabled:opacity-40"
        >
          {corriendo ? "Analizando…" : `✦ Análisis creativo IA de las ${peticiones.length} piezas`}
        </button>
      )}
      {progreso && <span className="text-xs text-gray-600">{progreso}</span>}
      {errores.map((e, i) => (
        <span key={i} className="text-xs text-red-600 w-full">
          {e}
        </span>
      ))}
    </div>
  );
}
