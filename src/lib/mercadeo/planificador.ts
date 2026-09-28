// Convierte un Analisis en la grilla de la semana: qué se publica, dónde,
// cuándo, en qué formato, con qué tema comercial y cuáles piezas se pautan
// (y con cuánto presupuesto). Funciones puras: el contenido (copies,
// guiones) lo genera `estrategia.ts` sobre estos espacios.

import type { Analisis, Formato, Plataforma } from "./analisis";
import { diaDeSemana } from "./fechas";

export type Objetivo = "LEADS" | "MENSAJES" | "TRAFICO" | "ALCANCE";

export type EspacioPieza = {
  orden: number;
  fechaProgramada: Date;
  plataforma: Plataforma;
  formato: Formato;
  objetivo: Objetivo;
  tema: string;
  pagada: boolean;
  presupuesto: number;
  diasPauta: number;
};

// Temas comerciales que se rotan durante la semana. Cubren el embudo:
// descubrir el proyecto -> desear vivir ahí -> resolver la duda del dinero ->
// agendar la visita a la sala de ventas.
export const TEMAS = [
  "Lanzamiento y ubicación del proyecto",
  "Precio desde y facilidades de pago (cuota inicial, subsidios, crédito)",
  "Amenidades y zonas comunes",
  "Estilo de vida / familia en el proyecto",
  "Avance de obra y respaldo de la constructora",
  "Invitación a visitar la sala de ventas / apartamento modelo",
  "Espacios del apartamento tipo (áreas y distribución)",
];

const PLATAFORMAS_ORDEN: Plataforma[] = ["INSTAGRAM", "FACEBOOK"];

const ROTACION_FORMATOS: Record<Plataforma, Formato[]> = {
  INSTAGRAM: ["REEL", "CARRUSEL", "IMAGEN", "REEL", "HISTORIA", "CARRUSEL"],
  FACEBOOK: ["IMAGEN", "VIDEO", "CARRUSEL", "IMAGEN", "VIDEO"],
};

const FORMATOS_VALIDOS: Record<Plataforma, Formato[]> = {
  INSTAGRAM: ["REEL", "CARRUSEL", "IMAGEN", "HISTORIA", "VIDEO"],
  FACEBOOK: ["IMAGEN", "VIDEO", "CARRUSEL", "REEL"],
};

export function planificarSemana(params: {
  analisis: Analisis;
  semanaInicio: Date;
  tieneWhatsapp: boolean;
}): EspacioPieza[] {
  const { analisis, semanaInicio, tieneWhatsapp } = params;
  const rec = analisis.recomendacion;
  const franjas = analisis.mejoresFranjas;
  const espacios: EspacioPieza[] = [];

  // --- Publicaciones por plataforma, en las mejores franjas ---
  let temaIdx = 0;
  PLATAFORMAS_ORDEN.forEach((plataforma, pIdx) => {
    const n = rec.publicacionesSemana[plataforma] ?? 0;
    const rotacion = [...ROTACION_FORMATOS[plataforma]];
    if (FORMATOS_VALIDOS[plataforma].includes(rec.formatoPrioritario)) {
      rotacion.unshift(rec.formatoPrioritario);
    }
    for (let i = 0; i < n; i++) {
      // Facebook arranca donde terminó Instagram, así la semana queda
      // cubierta en más días en vez de repetir las mismas franjas.
      const desplazamiento = pIdx === 0 ? 0 : rec.publicacionesSemana.INSTAGRAM ?? 0;
      const franja = franjas[(i + desplazamiento) % Math.max(1, franjas.length)];
      espacios.push({
        orden: 0,
        fechaProgramada: diaDeSemana(semanaInicio, franja?.diaSemana ?? 2, franja?.hora ?? 19),
        plataforma,
        formato: rotacion[i % rotacion.length],
        objetivo: tieneWhatsapp ? "MENSAJES" : "ALCANCE",
        tema: TEMAS[temaIdx++ % TEMAS.length],
        pagada: false,
        presupuesto: 0,
        diasPauta: 0,
      });
    }
  });

  // --- Pauta: se promocionan las piezas en las mejores franjas ---
  const totalPautas = rec.pautasSemana;
  if (totalPautas > 0 && rec.presupuestoSemanal > 0) {
    let pautasIG = Math.round((totalPautas * rec.repartoPresupuesto.INSTAGRAM) / 100);
    if (totalPautas >= 2) pautasIG = Math.min(totalPautas - 1, Math.max(1, pautasIG));
    const cuantas: Record<Plataforma, number> = {
      INSTAGRAM: pautasIG,
      FACEBOOK: totalPautas - pautasIG,
    };
    for (const plataforma of PLATAFORMAS_ORDEN) {
      const c = cuantas[plataforma];
      if (c <= 0) continue;
      // Si el reparto le da presupuesto a una sola plataforma, se lleva el 100%.
      const pct = cuantas.INSTAGRAM > 0 && cuantas.FACEBOOK > 0 ? rec.repartoPresupuesto[plataforma] : 100;
      const presupuestoPlataforma = (rec.presupuestoSemanal * pct) / 100;
      // Se pautan las primeras piezas de la semana de esa plataforma (tienen
      // más días de circulación), excepto historias (duran 24h).
      const candidatas = espacios
        .filter((e) => e.plataforma === plataforma && e.formato !== "HISTORIA")
        .sort((a, b) => a.fechaProgramada.getTime() - b.fechaProgramada.getTime())
        .slice(0, c);
      candidatas.forEach((e, i) => {
        e.pagada = true;
        e.presupuesto = Math.round(presupuestoPlataforma / candidatas.length);
        e.objetivo = i % 2 === 0 ? "LEADS" : tieneWhatsapp ? "MENSAJES" : "TRAFICO";
        const finSemana = semanaInicio.getTime() + 7 * 86_400_000;
        e.diasPauta = Math.max(3, Math.ceil((finSemana - e.fechaProgramada.getTime()) / 86_400_000));
      });
    }
  }

  espacios.sort((a, b) => a.fechaProgramada.getTime() - b.fechaProgramada.getTime());
  espacios.forEach((e, i) => (e.orden = i + 1));
  return espacios;
}
