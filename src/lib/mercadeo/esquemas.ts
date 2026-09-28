import { z } from "zod";

const texto = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => v || null);

export const proyectoVentaSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  tipoInmueble: z.string().trim().min(2).max(60).default("Apartamentos"),
  ciudad: z.string().trim().min(2).max(80),
  zona: texto(120),
  direccion: texto(200),
  latitud: z.number().min(-90).max(90).nullable().optional(),
  longitud: z.number().min(-180).max(180).nullable().optional(),
  precioDesde: z.number().positive().nullable().optional(),
  moneda: z.string().trim().length(3).default("COP"),
  areaDesde: z.number().positive().nullable().optional(),
  habitaciones: texto(80),
  amenidades: texto(500),
  diferenciales: texto(500),
  publicoObjetivo: texto(300),
  urlLanding: z.string().trim().url().nullable().optional().or(z.literal("").transform(() => null)),
  whatsapp: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || (v.length >= 10 && v.length <= 15), "Número inválido (usa formato internacional, ej. 573001234567)")
    .transform((v) => v || null)
    .nullable()
    .optional(),
  imagenUrl: z.string().trim().url().nullable().optional().or(z.literal("").transform(() => null)),
  presupuestoSemanal: z.number().nonnegative().nullable().optional(),
  activo: z.boolean().optional(),
});
