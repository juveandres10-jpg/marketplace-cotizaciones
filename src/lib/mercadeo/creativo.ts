// Análisis creativo de una pieza con IA: Claude mira la imagen final (tal como
// se publicará), la califica en los factores que deciden si detiene el scroll,
// dibuja cómo la recorre el ojo (diagrama) y propone tres versiones originales
// con la herramienta creativa de la web más adecuada para producir cada una.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErrorMercadeo } from "./servicio";
import { correccionAutomaticaDisponible } from "./correcciones";
import { dimensionesPieza, generarImagenPieza } from "./imagen";
import type { Analisis } from "./analisis";
import { FACTORES_CREATIVOS, HERRAMIENTAS_CREATIVAS } from "./creativo-datos";

const NOMBRES_HERRAMIENTAS = Object.keys(HERRAMIENTAS_CREATIVAS) as [
  keyof typeof HERRAMIENTAS_CREATIVAS,
  ...Array<keyof typeof HERRAMIENTAS_CREATIVAS>,
];

const Punto = z.object({
  x: z.number().describe("Posición horizontal de 0 (izquierda) a 1 (derecha) sobre la imagen"),
  y: z.number().describe("Posición vertical de 0 (arriba) a 1 (abajo) sobre la imagen"),
});

const EsquemaCreativo = z.object({
  puntajeGeneral: z.number().int().describe("Potencial de alcance e interacción de la pieza tal como está, de 0 a 100"),
  veredicto: z.string().describe("Una frase contundente con el diagnóstico"),
  contexto: z
    .string()
    .describe(
      "Qué muestra la imagen, qué historia cuenta, a qué deseo del comprador apela y en qué momento del recorrido de compra encaja (2-4 frases)",
    ),
  analisis: z
    .string()
    .describe(
      "Análisis a profundidad en markdown simple (viñetas con '- ' y **negritas**): fortalezas, debilidades, riesgo de que la ignoren, y qué cambiarías primero. 150-300 palabras.",
    ),
  factores: z
    .array(
      z.object({
        factor: z.enum(FACTORES_CREATIVOS),
        puntaje: z.number().describe("0 a 10"),
        comentario: z.string().describe("Por qué ese puntaje, concreto y accionable (máx. 20 palabras)"),
      }),
    )
    .describe("Exactamente un elemento por cada factor, en el orden dado"),
  puntoFocal: Punto.extend({ descripcion: z.string().describe("Qué ve primero el ojo") }),
  recorridoVisual: z
    .array(Punto.extend({ elemento: z.string().describe("Elemento que se lee en este paso (máx. 5 palabras)") }))
    .describe("Orden en que el ojo recorre la pieza: 3 a 5 pasos, empezando por el punto focal"),
  zonas: z
    .array(
      z.object({
        x: z.number().describe("Borde izquierdo 0-1"),
        y: z.number().describe("Borde superior 0-1"),
        ancho: z.number().describe("0-1"),
        alto: z.number().describe("0-1"),
        tipo: z.enum(["fuerte", "mejorar"]),
        etiqueta: z.string().describe("Máx. 4 palabras"),
      }),
    )
    .describe("2 a 4 zonas de la imagen: las que más aportan (fuerte) y las que hay que corregir (mejorar)"),
  propuestas: z
    .array(
      z.object({
        nombre: z.string().describe("Nombre corto y memorable del enfoque creativo"),
        enfoque: z.string().describe("La idea en una frase"),
        titular: z.string().describe("Máx. 36 caracteres"),
        copy: z.string().describe("Texto de la publicación listo para publicar, con gancho en la primera línea"),
        cta: z.string().describe("Llamada a la acción, máx. 30 caracteres"),
        conceptoVisual: z.string().describe("Cómo debe verse la imagen o el video (encuadre, luz, personas, texto en pantalla)"),
        porQueFunciona: z.string().describe("Por qué esta versión consigue más alcance, apoyado en los datos de la cuenta cuando existan"),
        herramientas: z
          .array(
            z.object({
              nombre: z.enum(NOMBRES_HERRAMIENTAS),
              uso: z.string().describe("Qué hacer con esa herramienta para esta propuesta (1 frase)"),
              prompt: z.string().describe("Prompt listo para pegar en la herramienta (en inglés si la herramienta rinde mejor así)"),
            }),
          )
          .describe("1 o 2 herramientas"),
      }),
    )
    .describe("Exactamente 3 propuestas distintas entre sí y distintas a la pieza actual"),
  tacticasAlcance: z.array(z.string()).describe("3 a 5 tácticas concretas para ampliar el alcance orgánico de esta pieza"),
});

export type AnalisisCreativo = z.infer<typeof EsquemaCreativo> & {
  generadoEn: string;
  modelo: string;
  /** Relación alto/ancho de la imagen analizada (para dibujar el diagrama encima). */
  proporcion: number;
  aplicada?: { indice: number; fecha: string; autor: string };
};

const SYSTEM = `Eres director creativo y estratega de contenido para redes sociales de una constructora en Colombia (vivienda nueva). Tu trabajo es que cada pieza detenga el scroll, se entienda en 2 segundos en un celular y genere contactos por WhatsApp.
Reglas:
- Analiza la imagen real que recibes (es exactamente lo que se publicará). Sé honesto: si es mediocre, dilo y explica por qué.
- Coordenadas del diagrama normalizadas de 0 a 1 sobre esa imagen.
- Las propuestas deben ser originales (nada de frases gastadas como "el hogar de tus sueños"), distintas entre sí y distintas a las demás piezas del plan.
- Usa solo los datos del proyecto entregados. No inventes precios, fechas, subsidios, áreas ni amenidades.
- Apóyate en las métricas de la cuenta cuando existan (formatos y horarios que mejor funcionan).
- En piezas de vivienda no hagas referencia a edad, género, estado civil, religión u origen del público.
- Español colombiano, cercano y elegante.`;

function limitar(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
}

/** Resumen de métricas útil para la IA (sin volcar el análisis completo). */
function contextoMetricas(analisis: Analisis | null) {
  if (!analisis) return null;
  return {
    confianza: analisis.confianza,
    formatos: analisis.porFormato,
    mejoresFranjas: analisis.mejoresFranjas.slice(0, 3),
    hallazgos: analisis.hallazgos,
  };
}

export async function analizarPiezaCreativa(piezaId: string): Promise<AnalisisCreativo> {
  if (!correccionAutomaticaDisponible()) {
    throw new ErrorMercadeo("El análisis creativo necesita la IA de Claude (falta ANTHROPIC_API_KEY en Vercel).", 400);
  }
  const pieza = await prisma.piezaPlan.findUnique({
    where: { id: piezaId },
    include: { plan: { include: { proyectoVenta: true, piezas: { orderBy: { orden: "asc" } } } } },
  });
  if (!pieza) throw new ErrorMercadeo("Pieza no encontrada", 404);
  const p = pieza.plan.proyectoVenta;

  const png = await generarImagenPieza(pieza, p);
  const { width, height } = dimensionesPieza(pieza.formato);

  const datos = {
    proyecto: {
      nombre: p.nombre,
      tipoInmueble: p.tipoInmueble,
      ciudad: p.ciudad,
      zona: p.zona,
      precioDesde: p.precioDesde,
      moneda: p.moneda,
      areaDesde: p.areaDesde,
      habitaciones: p.habitaciones,
      amenidades: p.amenidades,
      diferenciales: p.diferenciales,
      publicoObjetivo: p.publicoObjetivo,
    },
    pieza: {
      orden: pieza.orden,
      plataforma: pieza.plataforma,
      formato: pieza.formato,
      objetivo: pieza.objetivo,
      pagada: pieza.pagada,
      tema: pieza.tema,
      titular: pieza.titular,
      copy: pieza.copy,
      cta: pieza.cta,
      hashtags: pieza.hashtags,
      conceptoVisual: pieza.conceptoVisual,
      conVideo: Boolean(pieza.videoUrl),
    },
    otrasPiezasDelPlan: pieza.plan.piezas.filter((x) => x.id !== pieza.id).map((x) => `#${x.orden} ${x.formato}: ${x.titular}`),
    metricasCuenta: contextoMetricas(pieza.plan.analisis as unknown as Analisis | null),
  };

  const modelo = process.env.MERCADEO_MODELO_CLAUDE || "claude-opus-5-5";
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: modelo,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(EsquemaCreativo) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `Imagen final de la pieza #${pieza.orden} (${width}x${height}):` },
          { type: "image", source: { type: "base64", media_type: "image/png", data: png.toString("base64") } },
          {
            type: "text",
            text: `Datos de la pieza, del proyecto y de la cuenta:\n${JSON.stringify(datos, null, 2)}\n\nHaz el análisis creativo y las 3 propuestas.`,
          },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new ErrorMercadeo("La IA no pudo analizar esta pieza.", 400);
  const salida = response.parsed_output;
  if (!salida) throw new ErrorMercadeo("La IA no devolvió un análisis válido; intenta de nuevo.", 502);

  // Se normaliza lo que se dibuja para que un valor fuera de rango no rompa el diagrama.
  const punto = <T extends { x: number; y: number }>(q: T): T => ({ ...q, x: limitar(q.x, 0, 1), y: limitar(q.y, 0, 1) });
  const resultado: AnalisisCreativo = {
    ...salida,
    puntajeGeneral: Math.round(limitar(salida.puntajeGeneral, 0, 100)),
    factores: FACTORES_CREATIVOS.map((f) => {
      const x = salida.factores.find((y) => y.factor === f);
      return { factor: f, puntaje: limitar(x?.puntaje ?? 0, 0, 10), comentario: x?.comentario ?? "" };
    }),
    puntoFocal: punto(salida.puntoFocal),
    recorridoVisual: salida.recorridoVisual.slice(0, 6).map(punto),
    zonas: salida.zonas.slice(0, 5).map((z) => {
      const x = limitar(z.x, 0, 1);
      const y = limitar(z.y, 0, 1);
      return { ...z, x, y, ancho: limitar(z.ancho, 0.02, 1 - x), alto: limitar(z.alto, 0.02, 1 - y) };
    }),
    propuestas: salida.propuestas.slice(0, 3).map((q) => ({ ...q, titular: q.titular.slice(0, 80), cta: q.cta.slice(0, 80) })),
    generadoEn: new Date().toISOString(),
    modelo: response.model,
    proporcion: height / width,
  };

  await prisma.piezaPlan.update({
    where: { id: pieza.id },
    data: { analisisCreativo: resultado as unknown as Prisma.InputJsonValue },
  });
  return resultado;
}

/** Aplica a la pieza una de las propuestas del análisis creativo y lo deja en el historial del plan. */
export async function aplicarPropuestaCreativa(params: { piezaId: string; indice: number; autor: string }) {
  const pieza = await prisma.piezaPlan.findUnique({ where: { id: params.piezaId }, include: { plan: true } });
  if (!pieza) throw new ErrorMercadeo("Pieza no encontrada", 404);
  const analisis = pieza.analisisCreativo as unknown as AnalisisCreativo | null;
  const propuesta = analisis?.propuestas?.[params.indice];
  if (!analisis || !propuesta) throw new ErrorMercadeo("Primero analiza la pieza con IA.", 400);

  await prisma.piezaPlan.update({
    where: { id: pieza.id },
    data: {
      titular: propuesta.titular.trim().slice(0, 80),
      copy: propuesta.copy.trim().slice(0, 2200),
      cta: propuesta.cta.trim().slice(0, 80),
      conceptoVisual: propuesta.conceptoVisual.trim().slice(0, 2000),
      analisisCreativo: {
        ...analisis,
        aplicada: { indice: params.indice, fecha: new Date().toISOString(), autor: params.autor },
      } as unknown as Prisma.InputJsonValue,
    },
  });

  const historial = Array.isArray(pieza.plan.historialCorrecciones) ? (pieza.plan.historialCorrecciones as unknown[]) : [];
  await prisma.planSemanal.update({
    where: { id: pieza.planId },
    data: {
      historialCorrecciones: [
        ...historial,
        {
          fecha: new Date().toISOString(),
          autor: params.autor,
          alcance: `solo la pieza #${pieza.orden}`,
          instrucciones: `Aplicar propuesta creativa "${propuesta.nombre}"`,
          resumen: `Nuevo titular: ${propuesta.titular}`,
          cambios: [{ orden: pieza.orden, campos: ["titular", "copy", "cta", "conceptoVisual"], motivo: propuesta.porQueFunciona }],
        },
      ] as Prisma.InputJsonValue,
    },
  });
  return { mensaje: `Propuesta "${propuesta.nombre}" aplicada a la pieza #${pieza.orden}.` };
}
