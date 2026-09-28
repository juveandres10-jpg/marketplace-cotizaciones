// Motor de análisis de métricas de redes sociales.
//
// Funciones puras (sin base de datos ni red) para que el resultado sea
// reproducible y fácil de verificar. A partir de las publicaciones de las
// últimas semanas calcula:
//  - KPIs por plataforma (alcance, tasa de interacción, CTR, costo por lead...)
//  - Qué formato funciona mejor
//  - Las mejores franjas día/hora para publicar (en hora local)
//  - Recomendación de frecuencia semanal y reparto del presupuesto de pauta
//
// Cuando hay pocos datos se mezclan con valores de referencia del sector
// inmobiliario y se marca la confianza como "baja" (nunca se presenta una
// suposición como si fuera un dato medido).

import { DIAS_SEMANA, partesEnZona, ZONA_HORARIA } from "./fechas";

export type Plataforma = "FACEBOOK" | "INSTAGRAM";
export type Formato = "IMAGEN" | "CARRUSEL" | "VIDEO" | "REEL" | "HISTORIA";

export const PLATAFORMAS: Plataforma[] = ["INSTAGRAM", "FACEBOOK"];

export type PublicacionMetrica = {
  plataforma: Plataforma;
  formato: Formato;
  pagada: boolean;
  fechaPublicacion: Date;
  horaConocida: boolean;
  alcance: number;
  impresiones: number;
  interacciones: number;
  clics: number;
  leads: number;
  mensajes: number;
  gasto: number;
};

export type SnapshotSeguidores = {
  plataforma: Plataforma;
  fecha: Date;
  seguidores: number;
};

export type KpiPlataforma = {
  plataforma: Plataforma;
  publicaciones: number;
  organicas: number;
  pagadas: number;
  alcance: number;
  impresiones: number;
  interacciones: number;
  clics: number;
  leads: number;
  mensajes: number;
  gasto: number;
  tasaInteraccion: number | null; // interacciones / alcance
  ctr: number | null; // clics / impresiones
  cpl: number | null; // gasto / (leads + mensajes), solo pauta
  cpm: number | null; // gasto / impresiones * 1000, solo pauta
  seguidores: number | null;
  crecimientoSeguidores: number | null; // diferencia entre el primer y último snapshot de la ventana
};

export type KpiFormato = {
  formato: Formato;
  publicaciones: number;
  tasaInteraccion: number | null;
  contactosPorPublicacion: number; // (leads + mensajes) / publicaciones
  puntaje: number;
};

export type Franja = {
  diaSemana: number; // 0=domingo
  dia: string;
  hora: number; // inicio de la franja de 2 horas (hora local)
  etiqueta: string; // "Martes 19:00–21:00"
  publicaciones: number;
  puntaje: number;
  fuente: "datos" | "referencia";
};

export type Analisis = {
  generadoEn: string;
  ventanaDias: number;
  zonaHoraria: string;
  totalPublicaciones: number;
  confianza: "baja" | "media" | "alta";
  moneda: string;
  porPlataforma: KpiPlataforma[];
  porFormato: KpiFormato[];
  mejoresFranjas: Franja[];
  recomendacion: {
    publicacionesSemana: Record<Plataforma, number>;
    pautasSemana: number;
    repartoPresupuesto: Record<Plataforma, number>; // porcentaje 0-100
    formatoPrioritario: Formato;
    presupuestoSemanal: number;
  };
  hallazgos: string[];
  alertas: string[];
};

// Franjas de referencia para inmobiliaria en Colombia cuando no hay datos
// propios suficientes: hora de almuerzo y noche entre semana, y mañanas de
// fin de semana (cuando las familias planean visitas a salas de ventas).
const FRANJAS_REFERENCIA: Array<[number, number]> = [
  [2, 19], // martes 19-21
  [4, 19], // jueves 19-21
  [6, 9], // sábado 9-11
  [3, 12], // miércoles 12-14
  [0, 10], // domingo 10-12
  [1, 19], // lunes 19-21
  [5, 12], // viernes 12-14
];

const MIN_PUBLICACIONES_CONFIANZA_MEDIA = 12;
const MIN_PUBLICACIONES_CONFIANZA_ALTA = 40;

function div(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

/**
 * Puntaje de desempeño de una publicación orgánica: interacción por alcance,
 * con más peso a lo que acerca a una venta (clics, mensajes, leads).
 */
export function puntajePublicacion(p: PublicacionMetrica): number {
  const base = Math.max(p.alcance, p.impresiones * 0.7, 1);
  return ((p.interacciones + 3 * p.clics + 15 * p.mensajes + 20 * p.leads) / base) * 100;
}

function franjaDeHora(hora: number) {
  return Math.floor(hora / 2) * 2;
}

function etiquetaFranja(diaSemana: number, hora: number) {
  const h = (n: number) => `${String(n % 24).padStart(2, "0")}:00`;
  return `${DIAS_SEMANA[diaSemana]} ${h(hora)}–${h(hora + 2)}`;
}

export function analizarMetricas(params: {
  publicaciones: PublicacionMetrica[];
  snapshots?: SnapshotSeguidores[];
  ventanaDias: number;
  presupuestoSemanal: number;
  moneda?: string;
  zona?: string;
  ahora?: Date;
}): Analisis {
  const {
    publicaciones,
    snapshots = [],
    ventanaDias,
    presupuestoSemanal,
    moneda = "COP",
    zona = ZONA_HORARIA,
    ahora = new Date(),
  } = params;

  const hallazgos: string[] = [];
  const alertas: string[] = [];
  const total = publicaciones.length;
  const confianza: Analisis["confianza"] =
    total >= MIN_PUBLICACIONES_CONFIANZA_ALTA
      ? "alta"
      : total >= MIN_PUBLICACIONES_CONFIANZA_MEDIA
        ? "media"
        : "baja";

  if (total === 0) {
    alertas.push(
      "No hay métricas cargadas en la ventana analizada: el plan usa valores de referencia del sector. Sincroniza con Meta o carga métricas para afinarlo."
    );
  } else if (confianza === "baja") {
    alertas.push(
      `Solo hay ${total} publicaciones en los últimos ${ventanaDias} días: las recomendaciones combinan tus datos con valores de referencia.`
    );
  }

  // ---- KPIs por plataforma ----
  const porPlataforma: KpiPlataforma[] = PLATAFORMAS.map((plataforma) => {
    const pubs = publicaciones.filter((p) => p.plataforma === plataforma);
    const pagadas = pubs.filter((p) => p.pagada);
    const suma = (arr: PublicacionMetrica[], k: keyof PublicacionMetrica) =>
      arr.reduce((a, p) => a + (p[k] as number), 0);
    const alcance = suma(pubs, "alcance");
    const impresiones = suma(pubs, "impresiones");
    const interacciones = suma(pubs, "interacciones");
    const clics = suma(pubs, "clics");
    const leads = suma(pubs, "leads");
    const mensajes = suma(pubs, "mensajes");
    const gasto = suma(pubs, "gasto");
    const contactosPagados = suma(pagadas, "leads") + suma(pagadas, "mensajes");

    const snaps = snapshots
      .filter((s) => s.plataforma === plataforma)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    const seguidores = snaps.length ? snaps[snaps.length - 1].seguidores : null;
    const crecimientoSeguidores =
      snaps.length >= 2 ? snaps[snaps.length - 1].seguidores - snaps[0].seguidores : null;

    return {
      plataforma,
      publicaciones: pubs.length,
      organicas: pubs.length - pagadas.length,
      pagadas: pagadas.length,
      alcance,
      impresiones,
      interacciones,
      clics,
      leads,
      mensajes,
      gasto,
      tasaInteraccion: div(interacciones, alcance),
      ctr: div(clics, impresiones),
      cpl: gasto > 0 ? div(gasto, contactosPagados) : null,
      cpm: gasto > 0 ? div(gasto * 1000, suma(pagadas, "impresiones")) : null,
      seguidores,
      crecimientoSeguidores,
    };
  });

  for (const k of porPlataforma) {
    const nombre = k.plataforma === "INSTAGRAM" ? "Instagram" : "Facebook";
    if (k.publicaciones === 0) {
      alertas.push(`${nombre}: sin publicaciones registradas en la ventana.`);
      continue;
    }
    if (k.tasaInteraccion != null) {
      hallazgos.push(
        `${nombre}: ${k.publicaciones} publicaciones, alcance total ${k.alcance.toLocaleString("es-CO")}, tasa de interacción ${(k.tasaInteraccion * 100).toFixed(1)}%.`
      );
    }
    if (k.cpl != null) {
      hallazgos.push(
        `${nombre}: costo por contacto (lead o mensaje) de ${moneda} ${Math.round(k.cpl).toLocaleString("es-CO")} con ${moneda} ${Math.round(k.gasto).toLocaleString("es-CO")} invertidos.`
      );
    } else if (k.gasto > 0) {
      alertas.push(
        `${nombre}: se invirtieron ${moneda} ${Math.round(k.gasto).toLocaleString("es-CO")} en pauta sin leads ni mensajes registrados. Revisa el objetivo de campaña y el formulario/WhatsApp de destino.`
      );
    }
    if (k.crecimientoSeguidores != null) {
      hallazgos.push(
        `${nombre}: ${k.crecimientoSeguidores >= 0 ? "+" : ""}${k.crecimientoSeguidores} seguidores en la ventana (hoy ${k.seguidores?.toLocaleString("es-CO")}).`
      );
    }
  }

  // ---- Formatos ----
  const organicas = publicaciones.filter((p) => !p.pagada);
  const formatos = Array.from(new Set(publicaciones.map((p) => p.formato)));
  const porFormato: KpiFormato[] = formatos
    .map((formato) => {
      const pubs = publicaciones.filter((p) => p.formato === formato);
      const org = organicas.filter((p) => p.formato === formato);
      const alcance = pubs.reduce((a, p) => a + p.alcance, 0);
      const inter = pubs.reduce((a, p) => a + p.interacciones, 0);
      const contactos = pubs.reduce((a, p) => a + p.leads + p.mensajes, 0);
      const puntaje = org.length
        ? org.reduce((a, p) => a + puntajePublicacion(p), 0) / org.length
        : 0;
      return {
        formato,
        publicaciones: pubs.length,
        tasaInteraccion: div(inter, alcance),
        contactosPorPublicacion: pubs.length ? contactos / pubs.length : 0,
        puntaje,
      };
    })
    .sort((a, b) => b.puntaje - a.puntaje);

  // Con pocos datos por formato, los reels suelen tener más alcance orgánico
  // en Instagram; se usan como prioridad de referencia.
  const formatoPrioritario: Formato =
    porFormato.find((f) => f.publicaciones >= 3)?.formato ?? "REEL";
  if (porFormato.length > 1 && porFormato[0].publicaciones >= 3) {
    hallazgos.push(
      `El formato con mejor desempeño orgánico es ${porFormato[0].formato.toLowerCase()} (puntaje ${porFormato[0].puntaje.toFixed(1)} vs ${porFormato[porFormato.length - 1].puntaje.toFixed(1)} del más bajo).`
    );
  }

  // ---- Mejores franjas día/hora (solo orgánicas con hora conocida) ----
  const conHora = organicas.filter((p) => p.horaConocida);
  const promedioGlobal = conHora.length
    ? conHora.reduce((a, p) => a + puntajePublicacion(p), 0) / conHora.length
    : 0;
  const grupos = new Map<string, { diaSemana: number; hora: number; n: number; suma: number }>();
  for (const p of conHora) {
    const partes = partesEnZona(p.fechaPublicacion, zona);
    const hora = franjaDeHora(partes.hora);
    const clave = `${partes.diaSemana}-${hora}`;
    const g = grupos.get(clave) ?? { diaSemana: partes.diaSemana, hora, n: 0, suma: 0 };
    g.n += 1;
    g.suma += puntajePublicacion(p);
    grupos.set(clave, g);
  }
  // Suavizado bayesiano: una franja con 1 sola publicación buena no debe
  // ganarle a una con 6 publicaciones consistentemente buenas.
  const K = 2;
  const franjasDatos: Franja[] = Array.from(grupos.values())
    .map((g) => ({
      diaSemana: g.diaSemana,
      dia: DIAS_SEMANA[g.diaSemana],
      hora: g.hora,
      etiqueta: etiquetaFranja(g.diaSemana, g.hora),
      publicaciones: g.n,
      puntaje: (g.suma + promedioGlobal * K) / (g.n + K),
      fuente: "datos" as const,
    }))
    .filter((f) => f.publicaciones >= 2)
    .sort((a, b) => b.puntaje - a.puntaje);

  const mejoresFranjas: Franja[] = [];
  const diasUsados = new Set<number>();
  // Primero la mejor franja de cada día distinto (para repartir la semana)...
  for (const f of franjasDatos) {
    if (mejoresFranjas.length >= 7) break;
    if (diasUsados.has(f.diaSemana)) continue;
    mejoresFranjas.push(f);
    diasUsados.add(f.diaSemana);
  }
  // ...y se completa con referencias en días que aún no tengan franja.
  for (const [diaSemana, hora] of FRANJAS_REFERENCIA) {
    if (mejoresFranjas.length >= 7) break;
    if (diasUsados.has(diaSemana)) continue;
    mejoresFranjas.push({
      diaSemana,
      dia: DIAS_SEMANA[diaSemana],
      hora,
      etiqueta: etiquetaFranja(diaSemana, hora),
      publicaciones: 0,
      puntaje: 0,
      fuente: "referencia",
    });
    diasUsados.add(diaSemana);
  }
  if (franjasDatos.length) {
    hallazgos.push(
      `Mejor franja medida: ${franjasDatos[0].etiqueta} (${franjasDatos[0].publicaciones} publicaciones, puntaje ${franjasDatos[0].puntaje.toFixed(1)} vs promedio ${promedioGlobal.toFixed(1)}).`
    );
  }

  // ---- Frecuencia recomendada ----
  const tasaGlobal = div(
    porPlataforma.reduce((a, k) => a + k.interacciones, 0),
    porPlataforma.reduce((a, k) => a + k.alcance, 0)
  );
  const publicacionesSemana = {} as Record<Plataforma, number>;
  for (const k of porPlataforma) {
    let n = k.plataforma === "INSTAGRAM" ? 4 : 3;
    if (k.tasaInteraccion != null && tasaGlobal != null && k.publicaciones >= 4) {
      if (k.tasaInteraccion > tasaGlobal * 1.2) n += 1;
      else if (k.tasaInteraccion < tasaGlobal * 0.6) n -= 1;
    }
    // Si se publicaba muy poco, subir gradualmente (no duplicar de golpe).
    const semanas = Math.max(1, ventanaDias / 7);
    const actualPorSemana = k.organicas / semanas;
    if (k.publicaciones > 0 && actualPorSemana < n - 2) n = Math.ceil(actualPorSemana) + 2;
    publicacionesSemana[k.plataforma] = Math.max(2, Math.min(6, n));
  }

  // ---- Pauta y reparto de presupuesto ----
  const minPorPauta = Number(process.env.MERCADEO_MIN_PRESUPUESTO_PAUTA || 100000);
  const pautasSemana =
    presupuestoSemanal > 0
      ? Math.max(1, Math.min(4, Math.floor(presupuestoSemanal / Math.max(1, minPorPauta))))
      : 0;

  const repartoPresupuesto: Record<Plataforma, number> = { INSTAGRAM: 55, FACEBOOK: 45 };
  const conCpl = porPlataforma.filter((k) => k.cpl != null && k.pagadas >= 2);
  if (conCpl.length === 2) {
    // Proporcional a la eficiencia (1/CPL), con un piso de 20% para no
    // abandonar del todo ninguna plataforma y seguir aprendiendo.
    const ef = conCpl.map((k) => ({ p: k.plataforma, e: 1 / (k.cpl as number) }));
    const sumaEf = ef.reduce((a, x) => a + x.e, 0);
    for (const x of ef) {
      repartoPresupuesto[x.p] = Math.round(Math.max(20, Math.min(80, (x.e / sumaEf) * 100)));
    }
    const [a, b] = PLATAFORMAS;
    repartoPresupuesto[b] = 100 - repartoPresupuesto[a];
    hallazgos.push(
      `Reparto de pauta según costo por contacto: Instagram ${repartoPresupuesto.INSTAGRAM}% / Facebook ${repartoPresupuesto.FACEBOOK}%.`
    );
  } else if (presupuestoSemanal > 0) {
    alertas.push(
      "Aún no hay suficiente historial de pauta con leads para comparar plataformas: el presupuesto se reparte 55% Instagram / 45% Facebook (referencia) y se ajustará con los resultados."
    );
  }

  if (presupuestoSemanal > 0 && pautasSemana === 1 && presupuestoSemanal < minPorPauta) {
    alertas.push(
      `El presupuesto semanal (${moneda} ${presupuestoSemanal.toLocaleString("es-CO")}) está por debajo del mínimo recomendado por pauta (${moneda} ${minPorPauta.toLocaleString("es-CO")}); los resultados pueden ser poco concluyentes.`
    );
  }

  return {
    generadoEn: ahora.toISOString(),
    ventanaDias,
    zonaHoraria: zona,
    totalPublicaciones: total,
    confianza,
    moneda,
    porPlataforma,
    porFormato,
    mejoresFranjas,
    recomendacion: {
      publicacionesSemana,
      pautasSemana,
      repartoPresupuesto,
      formatoPrioritario,
      presupuestoSemanal,
    },
    hallazgos,
    alertas,
  };
}
