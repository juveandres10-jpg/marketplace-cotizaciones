"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { NavBar } from "@/components/nav-bar";

type Producto = {
  id: string;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  unidad: string;
  moneda: string;
};

export default function NuevaCotizacionPage() {
  return (
    <Suspense fallback={null}>
      <NuevaCotizacionForm />
    </Suspense>
  );
}

function NuevaCotizacionForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    productoId: search.get("productoId") ?? "",
    proveedorNombre: "",
    proveedorPais: "",
    proveedorUrl: "",
    precioUnit: "",
    moneda: "USD",
    unidad: "",
    moq: "",
    incoterm: "",
    tiempoEntregaDias: "",
    notas: "",
  });

  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((data: Producto[]) => setProductos(data))
      .catch(() => {});
  }, []);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.productoId) return setError("Selecciona un producto.");
    if (!form.proveedorNombre.trim())
      return setError("El nombre del proveedor es obligatorio.");

    setEnviando(true);
    try {
      const item: Record<string, unknown> = {
        productoId: form.productoId,
        proveedorNombre: form.proveedorNombre.trim(),
        fuente: "MANUAL",
      };
      if (form.proveedorPais.trim()) item.proveedorPais = form.proveedorPais.trim();
      if (form.proveedorUrl.trim()) item.proveedorUrl = form.proveedorUrl.trim();
      if (form.precioUnit) item.precioUnit = Number(form.precioUnit);
      if (form.moneda.trim()) item.moneda = form.moneda.trim().toUpperCase();
      if (form.unidad.trim()) item.unidad = form.unidad.trim();
      if (form.moq) item.moq = Number(form.moq);
      if (form.incoterm.trim()) item.incoterm = form.incoterm.trim().toUpperCase();
      if (form.tiempoEntregaDias)
        item.tiempoEntregaDias = Number(form.tiempoEntregaDias);
      if (form.notas.trim()) item.notas = form.notas.trim();

      const res = await fetch("/api/sondeo/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fuente: "MANUAL", items: [item] }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "No se pudo guardar la cotización");
      }
      router.push(`/sondeo/producto/${form.productoId}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link href="/sondeo" className="text-sm text-brand-700 hover:underline">
          ← Volver al sondeo
        </Link>
        <h1 className="text-2xl font-bold mt-3 mb-6">
          Cargar cotización de mercado
        </h1>

        <form onSubmit={enviar} className="grid gap-4">
          <Campo label="Producto *">
            <select
              value={form.productoId}
              onChange={(e) => set("productoId", e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Selecciona un producto…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.marca ? ` — ${p.marca}` : ""}
                  {p.modelo ? ` ${p.modelo}` : ""}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Proveedor *">
            <input
              value={form.proveedorNombre}
              onChange={(e) => set("proveedorNombre", e.target.value)}
              placeholder="Nombre del proveedor / tienda en Alibaba"
              className="w-full border rounded-lg px-3 py-2"
            />
          </Campo>

          <div className="grid grid-cols-2 gap-4">
            <Campo label="País del proveedor">
              <input
                value={form.proveedorPais}
                onChange={(e) => set("proveedorPais", e.target.value)}
                placeholder="China, India, …"
                className="w-full border rounded-lg px-3 py-2"
              />
            </Campo>
            <Campo label="Fuente">
              <input
                value="MANUAL"
                disabled
                className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-500"
              />
            </Campo>
          </div>

          <Campo label="Enlace (ficha del proveedor / producto)">
            <input
              value={form.proveedorUrl}
              onChange={(e) => set("proveedorUrl", e.target.value)}
              placeholder="https://…"
              className="w-full border rounded-lg px-3 py-2"
            />
          </Campo>

          <div className="grid grid-cols-3 gap-4">
            <Campo label="Precio unitario">
              <input
                type="number"
                step="any"
                value={form.precioUnit}
                onChange={(e) => set("precioUnit", e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </Campo>
            <Campo label="Moneda">
              <input
                value={form.moneda}
                onChange={(e) => set("moneda", e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </Campo>
            <Campo label="Unidad">
              <input
                value={form.unidad}
                onChange={(e) => set("unidad", e.target.value)}
                placeholder="unidad, kg, m²…"
                className="w-full border rounded-lg px-3 py-2"
              />
            </Campo>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Campo label="MOQ (cantidad mín.)">
              <input
                type="number"
                step="any"
                value={form.moq}
                onChange={(e) => set("moq", e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </Campo>
            <Campo label="Incoterm">
              <input
                value={form.incoterm}
                onChange={(e) => set("incoterm", e.target.value)}
                placeholder="FOB, CIF, EXW…"
                className="w-full border rounded-lg px-3 py-2"
              />
            </Campo>
            <Campo label="Entrega (días)">
              <input
                type="number"
                value={form.tiempoEntregaDias}
                onChange={(e) => set("tiempoEntregaDias", e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </Campo>
          </div>

          <Campo label="Notas">
            <textarea
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
            />
          </Campo>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={enviando}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {enviando ? "Guardando…" : "Guardar cotización"}
            </button>
            <Link
              href="/sondeo"
              className="px-4 py-2 rounded-lg border hover:bg-gray-50"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
