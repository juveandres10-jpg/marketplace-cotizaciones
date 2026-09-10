"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale } from "@/components/providers";

const ESTADOS = [
  "BORRADOR",
  "ENVIADA",
  "EN_NEGOCIACION",
  "RECIBIDA",
  "APROBADA",
  "DESCARTADA",
];

const ESTADOS_RESERVADOS_ADMIN = ["APROBADA", "DESCARTADA"];

const COLOR_ESTADO: Record<string, string> = {
  BORRADOR: "bg-gray-100 text-gray-700",
  ENVIADA: "bg-blue-50 text-blue-700",
  EN_NEGOCIACION: "bg-amber-50 text-amber-700",
  RECIBIDA: "bg-purple-50 text-purple-700",
  APROBADA: "bg-green-50 text-green-700",
  DESCARTADA: "bg-red-50 text-red-700",
};

export function CotizacionesPanel({
  proyectoId,
  cotizaciones,
}: {
  proyectoId: string;
  cotizaciones: any[];
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLocale();
  const user = session?.user as any;
  const esAdminComprador =
    user?.rol === "COMPRADOR" && user?.rolEmpresa === "ADMIN_EMPRESA";
  const [mostrarForm, setMostrarForm] = useState(false);
  const [errorEstado, setErrorEstado] = useState("");

  async function cambiarEstado(cotizacionId: string, estado: string) {
    setErrorEstado("");
    const res = await fetch(`/api/cotizaciones/${cotizacionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    if (!res.ok) {
      const data = await res.json();
      setErrorEstado(data.error ?? "No se pudo cambiar el estado");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="mb-4 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700"
      >
        {mostrarForm ? t.cotizaciones.cancelar : t.cotizaciones.solicitar}
      </button>

      {errorEstado && (
        <p className="text-red-600 text-sm mb-3 bg-red-50 p-2 rounded">
          {errorEstado}
        </p>
      )}

      {mostrarForm && (
        <NuevaCotizacionForm
          proyectoId={proyectoId}
          onCreated={() => {
            setMostrarForm(false);
            router.refresh();
          }}
        />
      )}

      {cotizaciones.length === 0 ? (
        <p className="text-gray-500 text-sm">{t.cotizaciones.sinCotizaciones}</p>
      ) : (
        <div className="grid gap-4">
          {cotizaciones.map((c) => (
            <div key={c.id} className="bg-white border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{c.proveedor.nombre}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${COLOR_ESTADO[c.estado]}`}
                >
                  {c.estado}
                </span>
              </div>

              <table className="w-full text-sm mb-3">
                <thead className="text-left text-gray-500">
                  <tr>
                    <th className="py-1">{t.cotizaciones.item}</th>
                    <th className="py-1">{t.cotizaciones.cant}</th>
                    <th className="py-1">{t.cotizaciones.precioUnit}</th>
                    <th className="py-1">{t.cotizaciones.subtotal}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.items.map((it: any) => (
                    <tr key={it.id} className="border-t">
                      <td className="py-1">
                        {it.producto?.nombre ?? it.descripcion}
                      </td>
                      <td className="py-1">{it.cantidad}</td>
                      <td className="py-1">
                        {it.precioUnit != null
                          ? `${c.moneda} ${it.precioUnit}`
                          : "—"}
                      </td>
                      <td className="py-1">
                        {it.subtotal != null
                          ? `${c.moneda} ${it.subtotal.toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <ArchivosAdjuntos cotizacionId={c.id} archivosIniciales={c.archivos ?? []} />

              <div className="flex items-center gap-2 mt-3">
                <label className="text-xs text-gray-500">
                  {t.cotizaciones.cambiarEstado}
                </label>
                <select
                  value={c.estado}
                  onChange={(e) => cambiarEstado(c.id, e.target.value)}
                  className="border rounded-lg px-2 py-1 text-sm"
                >
                  {ESTADOS.map((e) => (
                    <option
                      key={e}
                      value={e}
                      disabled={
                        ESTADOS_RESERVADOS_ADMIN.includes(e) &&
                        user?.rol === "COMPRADOR" &&
                        !esAdminComprador
                      }
                    >
                      {e}
                      {ESTADOS_RESERVADOS_ADMIN.includes(e) &&
                      user?.rol === "COMPRADOR" &&
                      !esAdminComprador
                        ? " (admin)"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArchivosAdjuntos({
  cotizacionId,
  archivosIniciales,
}: {
  cotizacionId: string;
  archivosIniciales: any[];
}) {
  const { t } = useLocale();
  const [archivos, setArchivos] = useState<any[]>(archivosIniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSubiendo(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/cotizaciones/${cotizacionId}/archivos`, {
      method: "POST",
      body: formData,
    });

    setSubiendo(false);
    e.target.value = "";

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al subir el archivo");
      return;
    }

    const nuevo = await res.json();
    setArchivos((prev) => [nuevo, ...prev]);
  }

  return (
    <div className="border-t pt-3 mt-1">
      <p className="text-xs text-gray-500 mb-2">{t.cotizaciones.adjuntos}</p>

      {error && (
        <p className="text-red-600 text-xs mb-2 bg-red-50 p-1.5 rounded">
          {error}
        </p>
      )}

      {archivos.length > 0 && (
        <ul className="mb-2 space-y-1">
          {archivos.map((a) => (
            <li key={a.id} className="text-sm">
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                {a.nombre}
              </a>
              {a.subidoPor?.nombre && (
                <span className="text-gray-400 text-xs">
                  {" "}
                  · {t.cotizaciones.subidoPor} {a.subidoPor.nombre}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <label className="inline-block text-xs text-brand-600 hover:underline cursor-pointer">
        {subiendo ? t.cotizaciones.subiendo : t.cotizaciones.adjuntar}
        <input
          type="file"
          onChange={handleFile}
          disabled={subiendo}
          className="hidden"
        />
      </label>
    </div>
  );
}

function NuevaCotizacionForm({
  proyectoId,
  onCreated,
}: {
  proyectoId: string;
  onCreated: () => void;
}) {
  const { t } = useLocale();
  const [proveedores, setProveedores] = useState<
    { id: string; nombre: string; pais: string | null }[]
  >([]);
  const [proveedorId, setProveedorId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/proveedores")
      .then((res) => res.json())
      .then((data) => setProveedores(Array.isArray(data) ? data : []))
      .catch(() => setProveedores([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!proveedorId) {
      setError(t.cotizaciones.seleccionaProveedor);
      return;
    }

    const res = await fetch("/api/cotizaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proyectoId,
        proveedorId,
        notas,
        items: [{ descripcion, cantidad }],
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al crear la cotización");
      return;
    }

    onCreated();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border rounded-xl p-5 mb-4"
    >
      {error && (
        <p className="text-red-600 text-sm mb-3 bg-red-50 p-2 rounded">
          {error}
        </p>
      )}
      <label className="block text-sm font-medium mb-1">
        {t.cotizaciones.proveedor}
      </label>
      <select
        value={proveedorId}
        onChange={(e) => setProveedorId(e.target.value)}
        required
        className="w-full border rounded-lg px-3 py-2 mb-3"
      >
        <option value="">
          {proveedores.length === 0
            ? t.cotizaciones.cargandoProveedores
            : t.cotizaciones.seleccionaProveedor}
        </option>
        {proveedores.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
            {p.pais ? ` (${p.pais})` : ""}
          </option>
        ))}
      </select>
      <label className="block text-sm font-medium mb-1">
        {t.cotizaciones.descripcionItem}
      </label>
      <input
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        required
        placeholder="Ej: Panel bifacial TOPCon 620Wp"
        className="w-full border rounded-lg px-3 py-2 mb-3"
      />
      <label className="block text-sm font-medium mb-1">
        {t.proyecto.cantidad}
      </label>
      <input
        type="number"
        value={cantidad}
        onChange={(e) => setCantidad(e.target.value)}
        required
        className="w-full border rounded-lg px-3 py-2 mb-3"
      />
      <label className="block text-sm font-medium mb-1">
        {t.cotizaciones.notas}
      </label>
      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={2}
        className="w-full border rounded-lg px-3 py-2 mb-4"
      />
      <button
        type="submit"
        className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700"
      >
        {t.cotizaciones.enviarSolicitud}
      </button>
    </form>
  );
}
