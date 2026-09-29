// Correcciones en lenguaje natural sobre un plan ("la entrega es noviembre
// 2026", "en la pieza 4 cambia la foto", "menos formal en Facebook"...).
// Claude reescribe solo lo necesario de las piezas afectadas y, mirando la
// foto de cada pieza, decide si hay que cambiarla (p. ej. si la imagen trae
// escrito un dato equivocado). Los cambios se guardan en el historial del plan.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErrorMercadeo } from "./servicio";

export function correccionAutomaticaDisponible() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const EsquemaCorreccion = z.object({
  resumen: z.string().describe("Qué se cambió, en 1-3 frases en español, para mostrar al equipo."),
  piezas: z
    .array(
      z.object({
        orden: z.number().int().describe("Número de la pieza (#)"),
        titular: z.string().nullable().describe("Nuevo titular (máx. 36 caracteres) o null si no cambia"),
        copy: z.string().nullable().describe("Nuevo texto de la publicación o null si no cambia"),
        cta: z.string().nullable().describe("Nueva llamada a la acción o null si no cambia"),
        hashtags: z.string().nullable().describe("Nuevos hashtags o null si no cambian"),
        conceptoVisual: z.string().nullable().describe("Nuevo concepto visual o null si no cambia"),
        guionVideo: z.string().nullable().describe("Nuevo guion o null si no cambia"),
        cambiarFoto: z
          .boolean()
          .describe("true si la foto actual contradice la corrección (p. ej. tiene escrito un dato equivocado) o si se pidió cambiarla"),
        motivo: z.string().describe("Por qué se cambió esta pieza"),
      })
    )
    .describe("Solo las piezas que cambian"),
});

const SYSTEM = `Eres el editor de contenido de mercadeo de una constructora en Colombia. Recibes un plan de publicaciones y unas correcciones pedidas por el equipo o por quien aprueba.
Reglas:
- Aplica exactamente lo pedido y nada más. No reescribas piezas que no se ven afectadas.
- Usa solo los datos del proyecto entregados y lo que diga la corrección. No inventes precios, fechas ni beneficios.
- Si la corrección cambia un dato (fecha de entrega, precio, subsidio...), actualízalo en TODAS las piezas del alcance que lo mencionen.
- Mira la foto de cada pieza: si trae escrito un dato que contradice la corrección o los datos del proyecto, marca cambiarFoto=true.
- Mantén el tono, la longitud y la llamada a la acción salvo que se pida otra cosa. Español colombiano.
- En piezas de vivienda pautadas no hagas referencia a edad, género, estado civil, religión u origen del público.`;

type Cambio = { orden: number; campos: string[]; motivo: string };

export async function aplicarCorrecciones(params: {
  planId: string;
  instrucciones: string;
  piezaId?: string | null;
  autor: string;
}): Promise<{ resumen: string; cambios: Cambio[] }> {
  if (!correccionAutomaticaDisponible()) {
    throw new ErrorMercadeo(
      "La corrección automática necesita la IA de Claude (falta ANTHROPIC_API_KEY en Vercel). Mientras tanto, edita la pieza con 'Editar pieza'.",
      400
    );
  }
  const plan = await prisma.planSemanal.findUnique({
    where: { id: params.planId },
    include: { proyectoVenta: true, piezas: { orderBy: { orden: "asc" } } },
  });
  if (!plan) throw new ErrorMercadeo("Plan no encontrado", 404);
  const alcance = params.piezaId ? plan.piezas.filter((p) => p.id === params.piezaId) : plan.piezas;
  if (alcance.length === 0) throw new ErrorMercadeo("Pieza no encontrada", 404);

  const p = plan.proyectoVenta;
  const galeria = [...p.imagenes, ...(p.imagenUrl ? [p.imagenUrl] : [])];
  const fotoDe = (pieza: (typeof plan.piezas)[number]) =>
    pieza.imagenFondo === "" ? null : pieza.imagenFondo || (galeria.length ? galeria[(pieza.orden - 1) % galeria.length] : null);

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
      whatsapp: p.whatsapp,
      urlLanding: p.urlLanding,
    },
    alcance: params.piezaId ? `solo la pieza #${alcance[0].orden}` : "todo el plan",
    piezas: alcance.map((x) => ({
      orden: x.orden,
      plataforma: x.plataforma,
      formato: x.formato,
      tema: x.tema,
      titular: x.titular,
      copy: x.copy,
      cta: x.cta,
      hashtags: x.hashtags,
      conceptoVisual: x.conceptoVisual,
      guionVideo: x.guionVideo,
    })),
  };

  // Fotos actuales de las piezas del alcance (máx. 12) para que Claude las revise.
  const bloquesFotos: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const x of alcance.slice(0, 12)) {
    const url = fotoDe(x);
    if (!url || !url.startsWith("https://")) continue;
    bloquesFotos.push({ type: "text", text: `Foto actual de la pieza #${x.orden}:` });
    bloquesFotos.push({ type: "image", source: { type: "url", url } });
  }

  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: process.env.MERCADEO_MODELO_CLAUDE || "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(EsquemaCorreccion) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...bloquesFotos,
          {
            type: "text",
            text: `Corrección pedida por ${params.autor}:\n"""${params.instrucciones}"""\n\nPlan actual:\n${JSON.stringify(datos, null, 2)}`,
          },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new ErrorMercadeo("La IA no pudo procesar esta corrección.", 400);
  const salida = response.parsed_output;
  if (!salida) throw new ErrorMercadeo("La IA no devolvió una corrección válida; intenta redactarla de otra forma.", 502);

  const usadas = new Set(plan.piezas.map((x) => fotoDe(x)).filter(Boolean) as string[]);
  const cambios: Cambio[] = [];
  for (const c of salida.piezas) {
    const pieza = alcance.find((x) => x.orden === c.orden);
    if (!pieza) continue;
    const data: Prisma.PiezaPlanUpdateInput = {};
    const campos: string[] = [];
    const set = (campo: keyof typeof c & string, valor: string | null, max: number) => {
      if (valor != null && valor.trim() && valor.trim() !== (pieza as any)[campo]) {
        (data as any)[campo] = valor.trim().slice(0, max);
        campos.push(campo);
      }
    };
    set("titular", c.titular, 80);
    set("copy", c.copy, 2200);
    set("cta", c.cta, 80);
    set("hashtags", c.hashtags, 500);
    set("conceptoVisual", c.conceptoVisual, 2000);
    set("guionVideo", c.guionVideo, 4000);
    if (c.cambiarFoto) {
      const actual = fotoDe(pieza);
      const nueva = galeria.find((u) => u !== actual && !usadas.has(u)) ?? galeria.find((u) => u !== actual) ?? "";
      data.imagenFondo = nueva;
      if (nueva) usadas.add(nueva);
      campos.push(nueva ? "foto" : "foto (sin foto disponible)");
    }
    if (campos.length) {
      await prisma.piezaPlan.update({ where: { id: pieza.id }, data });
      cambios.push({ orden: c.orden, campos, motivo: c.motivo });
    }
  }

  const historial = Array.isArray(plan.historialCorrecciones) ? (plan.historialCorrecciones as unknown[]) : [];
  await prisma.planSemanal.update({
    where: { id: plan.id },
    data: {
      historialCorrecciones: [
        ...historial,
        {
          fecha: new Date().toISOString(),
          autor: params.autor,
          alcance: datos.alcance,
          instrucciones: params.instrucciones,
          resumen: salida.resumen,
          cambios,
        },
      ] as Prisma.InputJsonValue,
    },
  });

  return { resumen: salida.resumen, cambios };
}
