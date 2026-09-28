"use client";

import { useState } from "react";
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
}: {
  planId: string;
  pieza: { id: string; titular: string; copy: string; cta: string; hashtags: string | null; pagada: boolean; presupuesto: number };
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

export function AprobacionForm({ token }: { token: string }) {
  const [nombre, setNombre] = useState("");
  const [comentario, setComentario] = useState("");
  const [cargando, setCargando] = useState<"aprobar" | "rechazar" | null>(null);
  const [resultado, setResultado] = useState<{
    estado: string;
    mensaje: string;
    publicacion: Array<{ orden: number; ok: boolean; detalle: string }> | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decidir(decision: "aprobar" | "rechazar") {
    setError(null);
    if (nombre.trim().length < 2) return setError("Escribe tu nombre para dejar registro de la decisión.");
    if (decision === "rechazar" && !comentario.trim()) return setError("Indica qué se debe ajustar.");
    if (decision === "aprobar" && !confirm("Al aprobar se programan las publicaciones y se crea la pauta en Meta. ¿Continuar?")) return;
    setCargando(decision);
    try {
      const r = await llamar(`/api/mercadeo/aprobacion/${token}`, "POST", {
        decision,
        nombre,
        comentario: comentario || undefined,
      });
      setResultado(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(null);
    }
  }

  if (resultado) {
    return (
      <div className={`rounded-xl p-5 border ${resultado.estado === "RECHAZADO" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
        <p className="font-medium">{resultado.mensaje}</p>
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
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-gray-500">Tu nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Comentarios (obligatorio si rechazas)</span>
          <input value={comentario} onChange={(e) => setComentario(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5" />
        </label>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => decidir("aprobar")}
          disabled={cargando !== null}
          className="bg-green-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-60"
        >
          {cargando === "aprobar" ? "Aprobando y publicando…" : "Aprobar plan"}
        </button>
        <button
          onClick={() => decidir("rechazar")}
          disabled={cargando !== null}
          className="border border-red-300 text-red-700 px-5 py-2 rounded-lg font-medium hover:bg-red-50 disabled:opacity-60"
        >
          {cargando === "rechazar" ? "Enviando…" : "Rechazar"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
