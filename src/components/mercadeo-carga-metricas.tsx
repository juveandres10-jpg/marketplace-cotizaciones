"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const EJEMPLO = `fecha,hora,plataforma,formato,pagada,alcance,impresiones,interacciones,clics,leads,mensajes,gasto
2026-09-01,19:10,instagram,reel,no,5400,7200,310,45,0,6,0
2026-09-02,12:30,facebook,imagen,no,2100,2600,58,12,0,1,0
2026-09-03,,instagram,imagen,si,18000,26000,120,410,14,9,250000`;

const PLATAFORMAS: Record<string, "FACEBOOK" | "INSTAGRAM"> = {
  facebook: "FACEBOOK",
  fb: "FACEBOOK",
  instagram: "INSTAGRAM",
  ig: "INSTAGRAM",
};
const FORMATOS: Record<string, string> = {
  imagen: "IMAGEN",
  foto: "IMAGEN",
  image: "IMAGEN",
  carrusel: "CARRUSEL",
  carousel: "CARRUSEL",
  video: "VIDEO",
  reel: "REEL",
  reels: "REEL",
  historia: "HISTORIA",
  story: "HISTORIA",
};

type Fila = Record<string, unknown>;

function parsear(csv: string): { filas: Fila[]; errores: string[] } {
  const lineas = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lineas.length < 2) return { filas: [], errores: [] };
  const sep = lineas[0].includes(";") ? ";" : ",";
  const cab = lineas[0].split(sep).map((c) => c.trim().toLowerCase());
  const filas: Fila[] = [];
  const errores: string[] = [];
  lineas.slice(1).forEach((linea, i) => {
    const celdas = linea.split(sep).map((c) => c.trim());
    const v = (k: string) => celdas[cab.indexOf(k)] ?? "";
    const n = (k: string) => {
      const x = v(k).replace(/[^\d.-]/g, "");
      return x === "" ? 0 : Number(x);
    };
    const plataforma = PLATAFORMAS[v("plataforma").toLowerCase()];
    const fecha = v("fecha");
    const hora = v("hora");
    if (!plataforma || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      errores.push(`Línea ${i + 2}: plataforma o fecha inválida (usa AAAA-MM-DD)`);
      return;
    }
    // La hora se interpreta en hora de Colombia (UTC-5, sin horario de verano).
    const fechaPublicacion = `${fecha}T${/^\d{1,2}:\d{2}$/.test(hora) ? hora.padStart(5, "0") : "12:00"}:00-05:00`;
    filas.push({
      plataforma,
      fechaPublicacion,
      horaConocida: /^\d{1,2}:\d{2}$/.test(hora),
      formato: FORMATOS[v("formato").toLowerCase()] ?? "IMAGEN",
      pagada: ["si", "sí", "true", "1", "yes"].includes(v("pagada").toLowerCase()),
      alcance: Math.round(n("alcance")),
      impresiones: Math.round(n("impresiones")),
      interacciones: Math.round(n("interacciones")),
      clics: Math.round(n("clics")),
      leads: Math.round(n("leads")),
      mensajes: Math.round(n("mensajes")),
      gasto: n("gasto"),
    });
  });
  return { filas, errores };
}

export function CargaMetricas() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [segIG, setSegIG] = useState("");
  const [segFB, setSegFB] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const { filas, errores } = useMemo(() => parsear(csv), [csv]);

  async function enviar() {
    setEnviando(true);
    setMsg(null);
    const seguidores = [
      segIG.trim() ? { plataforma: "INSTAGRAM", seguidores: Number(segIG) } : null,
      segFB.trim() ? { plataforma: "FACEBOOK", seguidores: Number(segFB) } : null,
    ].filter(Boolean);
    try {
      const res = await fetch("/api/mercadeo/metricas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicaciones: filas, seguidores }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "No se pudo cargar");
      setMsg({ ok: true, texto: `Cargadas ${j.publicaciones} publicaciones y ${j.seguidores} registros de seguidores.` });
      setCsv("");
      router.refresh();
    } catch (e: any) {
      setMsg({ ok: false, texto: e.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Publicaciones (CSV)</h2>
          <button onClick={() => setCsv(EJEMPLO)} className="text-xs text-brand-700 hover:underline">
            Pegar ejemplo
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Columnas: <code>fecha,hora,plataforma,formato,pagada,alcance,impresiones,interacciones,clics,leads,mensajes,gasto</code>.
          Puedes exportarlas desde Meta Business Suite → Estadísticas → Contenido. Hora en formato 24h (hora Colombia); si
          no se conoce, déjala vacía.
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={10}
          className="w-full border rounded-lg px-3 py-2 font-mono text-xs"
          placeholder={EJEMPLO}
        />
        <div className="text-xs text-gray-500 mt-1">
          {filas.length} filas válidas{errores.length > 0 && <span className="text-red-600"> · {errores.length} con error</span>}
        </div>
        {errores.length > 0 && (
          <ul className="text-xs text-red-600 mt-1 list-disc pl-4">
            {errores.slice(0, 5).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold mb-2">Seguidores actuales (opcional)</h2>
        <div className="flex gap-4 flex-wrap">
          <label className="block">
            <span className="text-xs text-gray-500">Instagram</span>
            <input type="number" min={0} value={segIG} onChange={(e) => setSegIG(e.target.value)} className="mt-1 w-40 border rounded px-2 py-1 block" />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Facebook</span>
            <input type="number" min={0} value={segFB} onChange={(e) => setSegFB(e.target.value)} className="mt-1 w-40 border rounded px-2 py-1 block" />
          </label>
        </div>
      </div>

      <button
        onClick={enviar}
        disabled={enviando || (filas.length === 0 && !segIG && !segFB)}
        className="bg-brand-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
      >
        {enviando ? "Cargando…" : "Cargar métricas"}
      </button>
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.texto}</p>}
    </div>
  );
}
