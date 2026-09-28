"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProyectoVentaInicial = {
  id?: string;
  nombre?: string;
  tipoInmueble?: string;
  ciudad?: string;
  zona?: string | null;
  direccion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  precioDesde?: number | null;
  moneda?: string;
  areaDesde?: number | null;
  habitaciones?: string | null;
  amenidades?: string | null;
  diferenciales?: string | null;
  publicoObjetivo?: string | null;
  urlLanding?: string | null;
  whatsapp?: string | null;
  imagenUrl?: string | null;
  presupuestoSemanal?: number | null;
  activo?: boolean;
};

const s = (v: unknown) => (v == null ? "" : String(v));
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function ProyectoVentaForm({ inicial }: { inicial?: ProyectoVentaInicial }) {
  const router = useRouter();
  const [f, setF] = useState({
    nombre: s(inicial?.nombre),
    tipoInmueble: s(inicial?.tipoInmueble) || "Apartamentos",
    ciudad: s(inicial?.ciudad),
    zona: s(inicial?.zona),
    direccion: s(inicial?.direccion),
    latitud: s(inicial?.latitud),
    longitud: s(inicial?.longitud),
    precioDesde: s(inicial?.precioDesde),
    moneda: s(inicial?.moneda) || "COP",
    areaDesde: s(inicial?.areaDesde),
    habitaciones: s(inicial?.habitaciones),
    amenidades: s(inicial?.amenidades),
    diferenciales: s(inicial?.diferenciales),
    publicoObjetivo: s(inicial?.publicoObjetivo),
    urlLanding: s(inicial?.urlLanding),
    whatsapp: s(inicial?.whatsapp),
    imagenUrl: s(inicial?.imagenUrl),
    presupuestoSemanal: s(inicial?.presupuestoSemanal),
    activo: inicial?.activo ?? true,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const cuerpo = {
      ...f,
      latitud: num(f.latitud),
      longitud: num(f.longitud),
      precioDesde: num(f.precioDesde),
      areaDesde: num(f.areaDesde),
      presupuestoSemanal: num(f.presupuestoSemanal),
    };
    try {
      const res = await fetch(inicial?.id ? `/api/mercadeo/proyectos/${inicial.id}` : "/api/mercadeo/proyectos", {
        method: inicial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const campos = j.detalle?.fieldErrors ? Object.entries(j.detalle.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`) : [];
        throw new Error([j.error ?? "No se pudo guardar", ...campos].join(" · "));
      }
      // Proyecto nuevo -> directo a su página para subir fotos y renders.
      router.push(inicial?.id ? "/mercadeo" : `/mercadeo/proyectos/${j.id}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setGuardando(false);
    }
  }

  const campo = "mt-1 w-full border rounded-lg px-3 py-2 text-sm";
  const etiqueta = "text-xs font-medium text-gray-600";

  return (
    <form onSubmit={guardar} className="space-y-6">
      <section className="bg-white border rounded-xl p-5 grid md:grid-cols-2 gap-4">
        <h2 className="md:col-span-2 font-semibold">Proyecto</h2>
        <label className="block">
          <span className={etiqueta}>Nombre del proyecto *</span>
          <input required value={f.nombre} onChange={set("nombre")} className={campo} placeholder="Reserva del Parque" />
        </label>
        <label className="block">
          <span className={etiqueta}>Tipo de inmueble</span>
          <input value={f.tipoInmueble} onChange={set("tipoInmueble")} className={campo} placeholder="Apartamentos, Casas, Lotes, VIS" />
        </label>
        <label className="block">
          <span className={etiqueta}>Ciudad *</span>
          <input required value={f.ciudad} onChange={set("ciudad")} className={campo} placeholder="Cúcuta" />
        </label>
        <label className="block">
          <span className={etiqueta}>Barrio / sector</span>
          <input value={f.zona} onChange={set("zona")} className={campo} />
        </label>
        <label className="block md:col-span-2">
          <span className={etiqueta}>Dirección de la sala de ventas</span>
          <input value={f.direccion} onChange={set("direccion")} className={campo} />
        </label>
        <label className="block">
          <span className={etiqueta}>Latitud (para segmentar la pauta por radio)</span>
          <input value={f.latitud} onChange={set("latitud")} className={campo} placeholder="7.8939" />
        </label>
        <label className="block">
          <span className={etiqueta}>Longitud</span>
          <input value={f.longitud} onChange={set("longitud")} className={campo} placeholder="-72.5078" />
        </label>
      </section>

      <section className="bg-white border rounded-xl p-5 grid md:grid-cols-3 gap-4">
        <h2 className="md:col-span-3 font-semibold">
          Oferta <span className="text-xs font-normal text-gray-500">(solo se publica lo que escribas aquí — la app no inventa precios ni beneficios)</span>
        </h2>
        <label className="block">
          <span className={etiqueta}>Precio desde</span>
          <input type="number" step="any" min={0} value={f.precioDesde} onChange={set("precioDesde")} className={campo} />
        </label>
        <label className="block">
          <span className={etiqueta}>Moneda</span>
          <select value={f.moneda} onChange={set("moneda")} className={campo}>
            <option>COP</option>
            <option>USD</option>
          </select>
        </label>
        <label className="block">
          <span className={etiqueta}>Área desde (m²)</span>
          <input type="number" step="any" min={0} value={f.areaDesde} onChange={set("areaDesde")} className={campo} />
        </label>
        <label className="block">
          <span className={etiqueta}>Habitaciones</span>
          <input value={f.habitaciones} onChange={set("habitaciones")} className={campo} placeholder="2 y 3 alcobas" />
        </label>
        <label className="block md:col-span-2">
          <span className={etiqueta}>Amenidades</span>
          <input value={f.amenidades} onChange={set("amenidades")} className={campo} placeholder="Piscina, gimnasio, BBQ, parque infantil" />
        </label>
        <label className="block md:col-span-3">
          <span className={etiqueta}>Diferenciales / facilidades de pago</span>
          <textarea rows={2} value={f.diferenciales} onChange={set("diferenciales")} className={campo} placeholder="Aplica subsidio Mi Casa Ya, cuota inicial en 36 meses, entrega 2027" />
        </label>
        <label className="block md:col-span-3">
          <span className={etiqueta}>Público objetivo (para la estrategia; no se usa para segmentar anuncios)</span>
          <input value={f.publicoObjetivo} onChange={set("publicoObjetivo")} className={campo} placeholder="Familias que buscan su primera vivienda" />
        </label>
      </section>

      <section className="bg-white border rounded-xl p-5 grid md:grid-cols-2 gap-4">
        <h2 className="md:col-span-2 font-semibold">Captación y pauta</h2>
        <label className="block">
          <span className={etiqueta}>WhatsApp de ventas (formato internacional)</span>
          <input value={f.whatsapp} onChange={set("whatsapp")} className={campo} placeholder="573001234567" />
        </label>
        <label className="block">
          <span className={etiqueta}>Landing / formulario de contacto</span>
          <input value={f.urlLanding} onChange={set("urlLanding")} className={campo} placeholder="https://..." />
        </label>
        <label className="block">
          <span className={etiqueta}>Imagen por URL (opcional: mejor súbelas en la galería de arriba)</span>
          <input value={f.imagenUrl} onChange={set("imagenUrl")} className={campo} placeholder="https://.../render.jpg" />
        </label>
        <label className="block">
          <span className={etiqueta}>Presupuesto de pauta semanal sugerido ({f.moneda})</span>
          <input type="number" min={0} step="any" value={f.presupuestoSemanal} onChange={set("presupuestoSemanal")} className={campo} />
        </label>
        {inicial?.id && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} />
            Activo (entra en la planificación automática semanal)
          </label>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={guardando} className="bg-brand-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-60">
        {guardando ? "Guardando…" : "Guardar proyecto"}
      </button>
    </form>
  );
}
