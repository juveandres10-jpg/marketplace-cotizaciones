"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";

async function llamar(url: string, metodo: string, cuerpo?: unknown) {
  const res = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Error inesperado");
  return json;
}

export function SincronizarMetaBoton({ habilitado }: { habilitado: boolean }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sincronizar() {
    setCargando(true);
    setMsg(null);
    try {
      const r = await llamar("/api/mercadeo/metricas/sincronizar", "POST");
      setMsg(
        `Facebook: ${r.facebook} · Instagram: ${r.instagram} · Anuncios: ${r.anuncios}` +
          (r.errores?.length ? ` · Errores: ${r.errores.join(" | ")}` : "")
      );
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={sincronizar}
        disabled={!habilitado || cargando}
        title={habilitado ? undefined : "Configura META_ACCESS_TOKEN y los IDs de Meta en el servidor"}
        className="border px-4 py-2 rounded-lg font-medium hover:bg-gray-50 text-sm disabled:opacity-50"
      >
        {cargando ? "Sincronizando…" : "Sincronizar con Meta"}
      </button>
      {msg && <span className="text-xs text-gray-500 mt-1 max-w-sm text-right">{msg}</span>}
    </div>
  );
}

export function GenerarPlanBoton({
  proyectoVentaId,
  presupuestoSugerido,
  moneda,
}: {
  proyectoVentaId: string;
  presupuestoSugerido: number | null;
  moneda: string;
}) {
  const router = useRouter();
  const [presupuesto, setPresupuesto] = useState(presupuestoSugerido?.toString() ?? "");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    setCargando(true);
    setError(null);
    try {
      const plan = await llamar("/api/mercadeo/planes", "POST", {
        proyectoVentaId,
        presupuestoSemanal: presupuesto.trim() === "" ? 0 : Number(presupuesto),
      });
      router.push(`/mercadeo/planes/${plan.id}`);
    } catch (e: any) {
      setError(e.message);
      setCargando(false);
    }
  }

  return (
    <div className="flex items-end gap-2 flex-wrap">
      <label className="block">
        <span className="text-xs text-gray-500">Pauta semanal ({moneda})</span>
        <input
          type="number"
          min={0}
          step="any"
          value={presupuesto}
          onChange={(e) => setPresupuesto(e.target.value)}
          placeholder="0 = solo orgánico"
          className="mt-1 w-40 border rounded px-2 py-1 block text-sm"
        />
      </label>
      <button
        onClick={generar}
        disabled={cargando}
        className="bg-brand-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-brand-700 text-sm disabled:opacity-60"
      >
        {cargando ? "Analizando y generando…" : "Generar plan semanal"}
      </button>
      {error && <span className="text-xs text-red-600 w-full">{error}</span>}
    </div>
  );
}

export function EnviarAprobacionForm({
  planId,
  emailPorDefecto,
  enviadoA,
}: {
  planId: string;
  emailPorDefecto: string;
  enviadoA: string | null;
}) {
  const router = useRouter();
  const [emails, setEmails] = useState(enviadoA ?? emailPorDefecto);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<{ enlace: string; enviado: boolean; motivo?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const destinatarios = emails
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await llamar(`/api/mercadeo/planes/${planId}/enviar`, "POST", { destinatarios });
      setResultado(r);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div>
      <form onSubmit={enviar} className="flex items-end gap-2 flex-wrap">
        <label className="block flex-1 min-w-[240px]">
          <span className="text-xs text-gray-500">Correo(s) de quien aprueba</span>
          <input
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="oasissas8@gmail.com"
            className="mt-1 w-full border rounded px-2 py-1.5 block text-sm"
          />
        </label>
        <button
          disabled={cargando}
          className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 text-sm disabled:opacity-60"
        >
          {cargando ? "Enviando…" : enviadoA ? "Reenviar para aprobación" : "Enviar para aprobación"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {resultado && (
        <div className="text-sm mt-3 p-3 rounded-lg bg-gray-50 border">
          {resultado.enviado ? (
            <p className="text-green-700">Correo enviado. El plan queda pendiente de aprobación.</p>
          ) : (
            <p className="text-amber-700">No se envió el correo: {resultado.motivo}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <input readOnly value={resultado.enlace} className="flex-1 border rounded px-2 py-1 text-xs bg-white" />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(resultado.enlace).then(() => setCopiado(true));
              }}
              className="border px-2 py-1 rounded text-xs hover:bg-white"
            >
              {copiado ? "Copiado" : "Copiar enlace"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Enlace de un solo uso, vence en 7 días. Compártelo solo con quien aprueba.</p>
        </div>
      )}
    </div>
  );
}

export function PlanAccionesSecundarias({
  planId,
  puedeBorrar,
  puedePublicar,
}: {
  planId: string;
  puedeBorrar: boolean;
  puedePublicar: boolean;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function borrar() {
    if (!confirm("¿Descartar este plan? No se puede deshacer.")) return;
    setCargando(true);
    try {
      await llamar(`/api/mercadeo/planes/${planId}`, "DELETE");
      router.push("/mercadeo");
    } catch (e: any) {
      setMsg(e.message);
      setCargando(false);
    }
  }

  async function publicar() {
    setCargando(true);
    setMsg(null);
    try {
      const r = await llamar(`/api/mercadeo/planes/${planId}/publicar`, "POST");
      const ok = r.resultados.filter((x: any) => x.ok).length;
      setMsg(`${ok} de ${r.resultados.length} piezas enviadas a Meta.`);
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {puedePublicar && (
        <button
          onClick={publicar}
          disabled={cargando}
          className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
        >
          Enviar / reintentar en Meta
        </button>
      )}
      {puedeBorrar && (
        <button onClick={borrar} disabled={cargando} className="text-sm text-red-600 hover:underline disabled:opacity-60">
          Descartar plan
        </button>
      )}
      {msg && <span className="text-xs text-gray-600">{msg}</span>}
    </div>
  );
}

export function EditorPieza({
  planId,
  pieza,
  imagenes = [],
}: {
  planId: string;
  pieza: {
    id: string;
    titular: string;
    copy: string;
    cta: string;
    hashtags: string | null;
    pagada: boolean;
    presupuesto: number;
    imagenFondo?: string | null;
  };
  imagenes?: string[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({
    titular: pieza.titular,
    copy: pieza.copy,
    cta: pieza.cta,
    hashtags: pieza.hashtags ?? "",
    pagada: pieza.pagada,
    presupuesto: pieza.presupuesto.toString(),
    imagenFondo: pieza.imagenFondo ?? null,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await llamar(`/api/mercadeo/planes/${planId}`, "PATCH", {
        piezaId: pieza.id,
        titular: form.titular,
        copy: form.copy,
        cta: form.cta,
        hashtags: form.hashtags,
        pagada: form.pagada,
        presupuesto: form.pagada ? Number(form.presupuesto || 0) : 0,
        ...(form.imagenFondo !== (pieza.imagenFondo ?? null) && form.imagenFondo !== null
          ? { imagenFondo: form.imagenFondo }
          : {}),
      });
      setAbierto(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="text-xs text-brand-700 hover:underline mt-2">
        Editar pieza
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-2 text-sm border-t pt-3">
      <input
        value={form.titular}
        onChange={(e) => setForm({ ...form, titular: e.target.value })}
        className="w-full border rounded px-2 py-1"
        placeholder="Titular"
      />
      <textarea
        value={form.copy}
        onChange={(e) => setForm({ ...form, copy: e.target.value })}
        rows={5}
        className="w-full border rounded px-2 py-1"
      />
      <div className="flex gap-2 flex-wrap">
        <input
          value={form.cta}
          onChange={(e) => setForm({ ...form, cta: e.target.value })}
          className="flex-1 min-w-[160px] border rounded px-2 py-1"
          placeholder="Llamada a la acción"
        />
        <input
          value={form.hashtags}
          onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
          className="flex-1 min-w-[160px] border rounded px-2 py-1"
          placeholder="#hashtags"
        />
      </div>
      {imagenes.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Foto de la pieza</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setForm({ ...form, imagenFondo: "" })}
              className={`shrink-0 w-20 h-20 rounded border text-[10px] text-gray-500 ${form.imagenFondo === "" ? "ring-2 ring-brand-600" : ""}`}
            >
              Sin foto
            </button>
            {imagenes.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => setForm({ ...form, imagenFondo: url })}
                className={`shrink-0 w-20 h-20 rounded overflow-hidden border ${form.imagenFondo === url ? "ring-2 ring-brand-600" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.pagada} onChange={(e) => setForm({ ...form, pagada: e.target.checked })} />
          Pautar esta pieza
        </label>
        {form.pagada && (
          <input
            type="number"
            min={0}
            value={form.presupuesto}
            onChange={(e) => setForm({ ...form, presupuesto: e.target.value })}
            className="w-36 border rounded px-2 py-1"
            placeholder="Presupuesto"
          />
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={guardar}
          disabled={guardando}
          className="bg-brand-600 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={() => setAbierto(false)} className="text-xs text-gray-500">
          Cancelar
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

type NotaCorreccion = { nota?: string; imagenFondo?: string };
const CorreccionesContext = createContext<{
  notas: Record<number, NotaCorreccion>;
  actualizar: (orden: number, cambio: NotaCorreccion) => void;
} | null>(null);

/** Guarda las correcciones que quien aprueba escribe pieza por pieza. */
export function CorreccionesProvider({ children }: { children: React.ReactNode }) {
  const [notas, setNotas] = useState<Record<number, NotaCorreccion>>({});
  const actualizar = (orden: number, cambio: NotaCorreccion) =>
    setNotas((n) => ({ ...n, [orden]: { ...n[orden], ...cambio } }));
  return <CorreccionesContext.Provider value={{ notas, actualizar }}>{children}</CorreccionesContext.Provider>;
}

/** Corrección de una pieza en la página de aprobación: nota para la IA y/o elegir otra foto. */
export function NotaPieza({ orden, galeria, fotoActual }: { orden: number; galeria: string[]; fotoActual: string | null }) {
  const ctx = useContext(CorreccionesContext);
  const [verFotos, setVerFotos] = useState(false);
  if (!ctx) return null;
  const actual = ctx.notas[orden] ?? {};
  const elegida = actual.imagenFondo;
  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Corrección para la pieza #{orden}</span>
        <textarea
          value={actual.nota ?? ""}
          onChange={(e) => ctx.actualizar(orden, { nota: e.target.value })}
          rows={2}
          placeholder="Ej.: título más corto, resalta el subsidio, menos emojis…"
          className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
        />
      </label>
      {galeria.length > 0 && (
        <div>
          <button type="button" onClick={() => setVerFotos(!verFotos)} className="text-xs text-brand-700 hover:underline">
            {elegida !== undefined ? "✓ Foto cambiada — ver fotos" : verFotos ? "Ocultar fotos" : "Cambiar la foto de esta pieza"}
          </button>
          {verFotos && (
            <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
              <button
                type="button"
                onClick={() => ctx.actualizar(orden, { imagenFondo: "" })}
                className={`shrink-0 w-20 h-20 rounded border text-[10px] text-gray-500 ${elegida === "" ? "ring-2 ring-brand-600" : ""}`}
              >
                Sin foto
              </button>
              {galeria.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => ctx.actualizar(orden, { imagenFondo: url })}
                  className={`shrink-0 w-20 h-20 rounded overflow-hidden border ${
                    (elegida ?? fotoActual) === url ? "ring-2 ring-brand-600" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AprobacionForm({ token, correccionAutomatica = false }: { token: string; correccionAutomatica?: boolean }) {
  const [nombre, setNombre] = useState("");
  const [comentario, setComentario] = useState("");
  const [cargando, setCargando] = useState<"aprobar" | "corregir" | null>(null);
  const [resultado, setResultado] = useState<{
    estado: string;
    mensaje: string;
    enlace?: string;
    publicacion: Array<{ orden: number; ok: boolean; detalle: string }> | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ctx = useContext(CorreccionesContext);
  const porPieza = Object.entries(ctx?.notas ?? {})
    .map(([orden, n]) => ({ orden: Number(orden), nota: n.nota?.trim() || undefined, imagenFondo: n.imagenFondo }))
    .filter((x) => x.nota || x.imagenFondo !== undefined);

  async function decidir(decision: "aprobar" | "corregir") {
    setError(null);
    if (nombre.trim().length < 2) return setError("Escribe tu nombre para dejar registro de la decisión.");
    if (decision === "corregir" && comentario.trim().length < 3 && porPieza.length === 0) {
      return setError("Escribe qué hay que corregir (aquí o debajo de cada pieza).");
    }
    if (decision === "aprobar" && porPieza.length > 0 && !confirm("Escribiste correcciones en algunas piezas. ¿Aprobar de todas formas sin aplicarlas?")) return;
    if (decision === "aprobar" && !confirm("Al aprobar se programan las publicaciones y se crea la pauta en Meta. ¿Continuar?")) return;
    setCargando(decision);
    try {
      const r = await llamar(`/api/mercadeo/aprobacion/${token}`, "POST", {
        decision,
        nombre,
        comentario: comentario || undefined,
        porPieza: decision === "corregir" ? porPieza : undefined,
      });
      setResultado(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(null);
    }
  }

  if (resultado) {
    const aprobado = resultado.estado === "APROBADO" || resultado.estado === "PUBLICADO";
    return (
      <div className={`rounded-xl p-5 border ${aprobado ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
        <p className="font-medium">{resultado.mensaje}</p>
        {resultado.enlace && (
          <a href={resultado.enlace} className="inline-block mt-3 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Ver el plan corregido
          </a>
        )}
        {resultado.publicacion && (
          <ul className="text-sm mt-3 space-y-1">
            {resultado.publicacion.map((r) => (
              <li key={r.orden} className={r.ok ? "text-gray-700" : "text-red-700"}>
                #{r.orden}: {r.detalle}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-xl bg-white p-5 space-y-3">
      <label className="block">
        <span className="text-xs text-gray-500">Tu nombre</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 w-full sm:w-80 border rounded px-2 py-1.5 block" />
      </label>
      <label className="block">
        <span className="text-xs text-gray-500">
          ¿Algo por corregir? Escríbelo aquí
          {correccionAutomatica ? " — se corrige automáticamente y te llega el plan ajustado" : ""}
        </span>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={3}
          placeholder='Ej.: "La entrega es noviembre de 2026. En la pieza 4 cambia la foto. Menos texto en Facebook."'
          className="mt-1 w-full border rounded px-2 py-1.5"
        />
      </label>
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => decidir("aprobar")}
          disabled={cargando !== null}
          className="bg-green-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-60"
        >
          {cargando === "aprobar" ? "Aprobando y publicando…" : "Aprobar plan"}
        </button>
        <button
          onClick={() => decidir("corregir")}
          disabled={cargando !== null}
          className="border border-amber-400 text-amber-800 px-5 py-2 rounded-lg font-medium hover:bg-amber-50 disabled:opacity-60"
        >
          {cargando === "corregir"
            ? correccionAutomatica
              ? "Aplicando correcciones… (hasta 1 minuto)"
              : "Enviando…"
            : porPieza.length
              ? `Pedir correcciones (${porPieza.length} pieza${porPieza.length === 1 ? "" : "s"})`
              : "Pedir correcciones"}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        También puedes escribir una corrección o cambiar la foto debajo de cada pieza, más abajo en esta página.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function CorregirPlanForm({
  planId,
  piezas,
  disponible,
  hayDestinatario,
}: {
  planId: string;
  piezas: { id: string; orden: number; titular: string }[];
  disponible: boolean;
  hayDestinatario: boolean;
}) {
  const router = useRouter();
  const [instrucciones, setInstrucciones] = useState("");
  const [piezaId, setPiezaId] = useState("");
  const [reenviar, setReenviar] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<{
    resumen: string;
    cambios: { orden: number; campos: string[]; motivo: string }[];
    envio: { enlace: string; enviado: boolean; motivo?: string } | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function corregir(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const r = await llamar(`/api/mercadeo/planes/${planId}/corregir`, "POST", {
        instrucciones,
        piezaId: piezaId || null,
        reenviar: reenviar && hayDestinatario,
      });
      setResultado(r);
      setInstrucciones("");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={corregir} className="space-y-2">
      <div className="text-sm font-medium">Corregir con IA</div>
      {!disponible && (
        <p className="text-xs text-amber-700">
          Requiere activar Claude (ANTHROPIC_API_KEY en Vercel). Mientras tanto, usa “Editar pieza”.
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        <select
          value={piezaId}
          onChange={(e) => setPiezaId(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="">Todo el plan</option>
          {piezas.map((p) => (
            <option key={p.id} value={p.id}>
              Pieza #{p.orden} — {p.titular.slice(0, 40)}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={instrucciones}
        onChange={(e) => setInstrucciones(e.target.value)}
        rows={3}
        placeholder='Ej.: "La entrega es a partir de noviembre de 2026, no mayo. En la pieza 4 cambia la foto."'
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-3 flex-wrap">
        <button
          disabled={!disponible || cargando || instrucciones.trim().length < 3}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {cargando ? "Aplicando correcciones…" : reenviar && hayDestinatario ? "Corregir y reenviar" : "Corregir"}
        </button>
        {hayDestinatario && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={reenviar} onChange={(e) => setReenviar(e.target.checked)} />
            Reenviar el plan corregido para aprobación
          </label>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {resultado && (
        <div className="text-sm bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
          <p className="font-medium">{resultado.resumen}</p>
          {resultado.cambios.length === 0 ? (
            <p className="text-gray-600">No hubo cambios en las piezas.</p>
          ) : (
            <ul className="list-disc pl-5 text-gray-700">
              {resultado.cambios.map((c) => (
                <li key={c.orden}>
                  #{c.orden}: {c.campos.join(", ")} — {c.motivo}
                </li>
              ))}
            </ul>
          )}
          {resultado.envio && (
            <p className="text-gray-600">
              {resultado.envio.enviado ? "Plan corregido reenviado por correo." : `No se envió el correo: ${resultado.envio.motivo}`}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
