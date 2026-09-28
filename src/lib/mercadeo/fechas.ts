// Utilidades de fecha en la zona horaria de la empresa (por defecto Bogotá).
// Todo el análisis de "mejor día/hora para publicar" se hace en hora local,
// no en UTC: publicar a las 7pm en Colombia es 00:00 UTC del día siguiente.

export const ZONA_HORARIA = process.env.MERCADEO_ZONA_HORARIA || "America/Bogota";

export const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

type Partes = { anio: number; mes: number; dia: number; hora: number; minuto: number; diaSemana: number };

const DIA_CORTO: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Descompone una fecha en sus partes en la zona horaria dada. */
export function partesEnZona(fecha: Date, zona = ZONA_HORARIA): Partes {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(fecha)) p[part.type] = part.value;
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    diaSemana: DIA_CORTO[p.weekday] ?? 0,
  };
}

/** Construye el instante UTC que corresponde a una fecha/hora local en `zona`. */
export function fechaEnZona(
  anio: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0,
  zona = ZONA_HORARIA
): Date {
  const supuesto = Date.UTC(anio, mes - 1, dia, hora, minuto);
  const p = partesEnZona(new Date(supuesto), zona);
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto);
  const offset = comoUtc - supuesto; // cuánto adelanta la zona respecto a UTC
  return new Date(supuesto - offset);
}

/** Lunes 00:00 (hora local) de la semana siguiente a `desde`. */
export function proximoLunes(desde = new Date(), zona = ZONA_HORARIA): Date {
  const p = partesEnZona(desde, zona);
  const diasHastaLunes = ((8 - p.diaSemana) % 7) || 7;
  const base = new Date(Date.UTC(p.anio, p.mes - 1, p.dia + diasHastaLunes));
  return fechaEnZona(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), 0, 0, zona);
}

/** Fecha local = lunes de `semanaInicio` + `offsetDias`, a la hora indicada. */
export function diaDeSemana(
  semanaInicio: Date,
  diaSemana: number, // 0=domingo..6=sábado
  hora: number,
  zona = ZONA_HORARIA
): Date {
  const p = partesEnZona(semanaInicio, zona);
  const offsetDias = (diaSemana + 6) % 7; // lunes=0 ... domingo=6
  const base = new Date(Date.UTC(p.anio, p.mes - 1, p.dia + offsetDias));
  return fechaEnZona(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hora, 0, zona);
}

export function formatoFechaHora(fecha: Date | string, zona = ZONA_HORARIA) {
  return new Date(fecha).toLocaleString("es-CO", {
    timeZone: zona,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatoFecha(fecha: Date | string, zona = ZONA_HORARIA) {
  return new Date(fecha).toLocaleDateString("es-CO", {
    timeZone: zona,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
