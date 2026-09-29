// Generación de la estrategia y del contenido de cada pieza (titular, copy,
// CTA, hashtags, concepto visual y guion de video).
//
// Si hay ANTHROPIC_API_KEY, lo redacta Claude con salida estructurada
// (JSON validado). Si no hay clave o la llamada falla, se usan plantillas
// determinísticas: la app funciona igual, con textos más genéricos.
// En ambos casos solo se usan los datos del proyecto que el usuario cargó:
// nunca se inventan precios, áreas ni subsidios.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import type { Analisis } from "./analisis";
import type { EspacioPieza } from "./planificador";
import { formatoFechaHora } from "./fechas";

export type DatosProyecto = {
  nombre: string;
  tipoInmueble: string;
  ciudad: string;
  zona: string | null;
  direccion: string | null;
  precioDesde: number | null;
  moneda: string;
  areaDesde: number | null;
  habitaciones: string | null;
  amenidades: string | null;
  diferenciales: string | null;
  publicoObjetivo: string | null;
  urlLanding: string | null;
  whatsapp: string | null;
};

export type ContenidoPieza = {
  titular: string;
  copy: string;
  cta: string;
  hashtags: string;
  conceptoVisual: string;
  guionVideo: string | null;
};

export type ResultadoContenido = {
  estrategia: string;
  piezas: ContenidoPieza[];
  generadoCon: "claude" | "plantilla";
  advertencia?: string;
};

export function formatoMoneda(valor: number, moneda: string) {
  if (moneda === "COP") {
    // En Colombia se lee mejor "$ 250 millones" que "$ 250.000.000".
    if (valor >= 1_000_000) {
      const millones = valor / 1_000_000;
      return `$${millones.toLocaleString("es-CO", { maximumFractionDigits: 1 })} millones`;
    }
    return `$${Math.round(valor).toLocaleString("es-CO")}`;
  }
  return `${moneda} ${valor.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

function esVideo(formato: string) {
  return formato === "REEL" || formato === "VIDEO" || formato === "HISTORIA";
}

// ------------------------------------------------------------------
// Plantillas (sin IA)
// ------------------------------------------------------------------

function hashtagsBase(p: DatosProyecto) {
  const limpiar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "");
  const tags = [
    `#${limpiar(p.nombre)}`,
    `#${limpiar(p.tipoInmueble)}En${limpiar(p.ciudad)}`,
    `#Vivienda${limpiar(p.ciudad)}`,
    "#ProyectoDeVivienda",
    "#CasaPropia",
  ];
  if (p.zona) tags.push(`#${limpiar(p.zona)}`);
  return Array.from(new Set(tags)).join(" ");
}

function ctaPara(e: EspacioPieza, p: DatosProyecto) {
  if (e.objetivo === "MENSAJES" && p.whatsapp) return "Escríbenos por WhatsApp";
  if (e.objetivo === "LEADS") return "Déjanos tus datos y te asesoramos";
  if (e.objetivo === "TRAFICO") return "Conoce más aquí";
  return "Agenda tu visita a la sala de ventas";
}

function contenidoPlantilla(e: EspacioPieza, p: DatosProyecto): ContenidoPieza {
  const ubicacion = [p.zona, p.ciudad].filter(Boolean).join(", ");
  const precio = p.precioDesde != null ? `desde ${formatoMoneda(p.precioDesde, p.moneda)}` : null;
  const area = p.areaDesde != null ? `desde ${p.areaDesde} m²` : null;
  const detalles = [p.habitaciones, area].filter(Boolean).join(" · ");
  const cta = ctaPara(e, p);
  const contacto = [
    p.whatsapp ? `📲 WhatsApp: +${p.whatsapp.replace(/\D/g, "")}` : null,
    p.urlLanding ? `🔗 ${p.urlLanding}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const t = e.tema;
  let titular: string;
  let cuerpo: string;
  let visual: string;

  if (t.startsWith("Precio")) {
    titular = /subsidio/i.test(p.diferenciales ?? "") ? "Compra tu vivienda con subsidio" : "Hazte propietario este año";
    cuerpo = `${p.nombre} en ${ubicacion}${precio ? `, ${precio}` : ""}.${p.diferenciales ? ` ${p.diferenciales}.` : ""} Te acompañamos con la cuota inicial y el crédito.`;
    visual = `Fachada o render principal de ${p.nombre} con el precio "${precio ?? "consulta precios"}" en grande y el logo de la constructora.`;
  } else if (t.startsWith("Amenidades")) {
    titular = "Espacios para disfrutar en familia";
    cuerpo = p.amenidades
      ? `Disfruta sin salir de casa: ${p.amenidades}. ${p.tipoInmueble} en ${ubicacion}.`
      : `Zonas comunes pensadas para compartir en familia. ${p.tipoInmueble} en ${ubicacion}.`;
    visual = `Carrusel/escena con las zonas comunes${p.amenidades ? ` (${p.amenidades})` : ""}, luz cálida de atardecer.`;
  } else if (t.startsWith("Estilo")) {
    titular = "Imagina tu vida aquí";
    cuerpo = `${p.publicoObjetivo ? `Pensado para ${p.publicoObjetivo.toLowerCase()}. ` : ""}${p.tipoInmueble} en ${ubicacion}${detalles ? ` · ${detalles}` : ""}.`;
    visual = "Familia real (o foto de banco) disfrutando la sala/balcón del apartamento modelo, tono cercano y cálido.";
  } else if (t.startsWith("Avance")) {
    titular = "Así avanza tu nuevo hogar";
    cuerpo = `Seguimos construyendo tu próximo hogar en ${ubicacion}. Compra con respaldo y conoce el avance de obra en persona.`;
    visual = "Foto o video actual de la obra (grúa, estructura, equipo trabajando) con texto 'Avance de obra' y la fecha.";
  } else if (t.startsWith("Invitación")) {
    titular = "Ven a conocer tu nuevo hogar";
    cuerpo = `Conoce el apartamento modelo${p.direccion ? ` en ${p.direccion}` : ` en ${ubicacion}`} y resuelve todas tus dudas con un asesor.`;
    visual = "Apartamento modelo decorado, asesor recibiendo a una familia en la sala de ventas.";
  } else if (t.startsWith("Espacios")) {
    titular = "Espacios pensados para ti";
    cuerpo = `Conoce la distribución de los ${p.tipoInmueble.toLowerCase()} de ${p.nombre}${area ? `, ${area}` : ""}.`;
    visual = "Plano 3D del apartamento tipo con las áreas destacadas.";
  } else {
    titular = `Tu nuevo hogar en ${p.zona || p.ciudad}`;
    cuerpo = `Descubre ${p.nombre}, ${p.tipoInmueble.toLowerCase()} en ${ubicacion}${precio ? ` ${precio}` : ""}.${p.diferenciales ? ` ${p.diferenciales}.` : ""}`;
    visual = `Render aéreo de ${p.nombre} mostrando la ubicación y las vías de acceso cercanas.`;
  }

  const copy = `${cuerpo}\n\n👉 ${cta}.${contacto ? `\n${contacto}` : ""}`;
  const guionVideo = esVideo(e.formato)
    ? [
        `Escena 1 (0-3s): gancho visual — ${visual} Texto en pantalla: "${titular}".`,
        `Escena 2 (3-8s): recorrido rápido por ${p.amenidades ? p.amenidades.split(",").map((a) => a.trim()).filter(Boolean).slice(0, 2).join(" y ").toLowerCase() : "las zonas comunes y el apartamento modelo"}.`,
        `Escena 3 (8-12s): ${precio ? `precio ${precio}` : "beneficios del proyecto"}${detalles ? ` · ${detalles}` : ""}.`,
        `Escena 4 (12-15s): cierre con logo, ubicación (${ubicacion}) y CTA "${cta}".`,
      ].join("\n")
    : null;

  return { titular, copy, cta, hashtags: hashtagsBase(p), conceptoVisual: visual, guionVideo };
}

function estrategiaPlantilla(analisis: Analisis, espacios: EspacioPieza[], p: DatosProyecto) {
  const pagadas = espacios.filter((e) => e.pagada);
  const rec = analisis.recomendacion;
  const lineas = [
    `## Objetivo de la semana`,
    `Generar contactos calificados (leads y conversaciones) para ${p.nombre} en ${p.ciudad}, manteniendo presencia constante en Instagram y Facebook.`,
    ``,
    `## Diagnóstico`,
    ...(analisis.hallazgos.length ? analisis.hallazgos.map((h) => `- ${h}`) : ["- Sin historial suficiente; se parte de referencias del sector."]),
    ``,
    `## Plan`,
    `- Instagram: ${rec.publicacionesSemana.INSTAGRAM} publicaciones. Facebook: ${rec.publicacionesSemana.FACEBOOK} publicaciones.`,
    `- Formato prioritario: ${rec.formatoPrioritario.toLowerCase()}.`,
    `- Franjas: ${analisis.mejoresFranjas.slice(0, 4).map((f) => f.etiqueta).join(", ")}.`,
    pagadas.length
      ? `- Pauta: ${pagadas.length} piezas promocionadas con ${formatoMoneda(rec.presupuestoSemanal, analisis.moneda)} en total (Instagram ${rec.repartoPresupuesto.INSTAGRAM}% / Facebook ${rec.repartoPresupuesto.FACEBOOK}%).`
      : `- Sin pauta esta semana (no hay presupuesto configurado).`,
    ``,
    `## Captación de clientes en cada publicación`,
    `- Cada pieza cierra con una sola llamada a la acción clara (${p.whatsapp ? "WhatsApp" : "formulario/landing"}).`,
    `- Responder comentarios y mensajes en menos de 1 hora en horario laboral: la velocidad de respuesta define la conversión.`,
    `- Registrar cada contacto con la fuente (red y pieza) para medir el costo por lead real la próxima semana.`,
  ];
  return lineas.join("\n");
}

// ------------------------------------------------------------------
// Claude
// ------------------------------------------------------------------

const EsquemaContenido = z.object({
  estrategia: z
    .string()
    .describe(
      "Estrategia de la semana en markdown (secciones ## Objetivo, ## Diagnóstico, ## Plan, ## Captación de clientes). Máximo ~350 palabras."
    ),
  piezas: z
    .array(
      z.object({
        orden: z.number().int().describe("El mismo 'orden' del espacio recibido"),
        titular: z
          .string()
          .describe(
            "Titular de la imagen: máximo 36 caracteres, emocional y concreto (ej. 'Estrena casa propia con subsidio'). No repitas el nombre del proyecto, el precio ni la ubicación: ya aparecen en la pieza."
          ),
        copy: z.string().describe("Texto de la publicación, 2-5 líneas, termina con la CTA"),
        cta: z.string().describe("Llamada a la acción corta"),
        hashtags: z.string().describe("5 a 8 hashtags separados por espacio"),
        conceptoVisual: z.string().describe("Descripción precisa de la imagen o escena a producir"),
        guionVideo: z
          .string()
          .nullable()
          .describe("Guion por escenas con tiempos para REEL/VIDEO/HISTORIA; null para IMAGEN/CARRUSEL"),
      })
    )
    .describe("Una entrada por cada espacio recibido, en el mismo orden"),
});

const SYSTEM = `Eres el estratega de mercadeo digital de una constructora en Colombia. Escribes en español colombiano, cercano y profesional, para Instagram y Facebook.
Reglas:
- Usa ÚNICAMENTE los datos del proyecto que se te entregan. Si un dato (precio, área, subsidio, fecha de entrega) no aparece, no lo menciones ni lo inventes.
- Cada pieza debe estar orientada a captar un cliente potencial: una sola llamada a la acción clara, alineada con el objetivo del espacio (LEADS = dejar datos en formulario/landing, MENSAJES = escribir por WhatsApp, TRAFICO = visitar la landing, ALCANCE = conocer el proyecto / agendar visita).
- Respeta el tema, formato y plataforma de cada espacio. En Instagram usa ganchos visuales en la primera línea; en Facebook puedes ser un poco más descriptivo.
- Las piezas pagadas de vivienda se publican bajo la categoría especial de Meta: no hagas referencia a edad, género, estado civil, religión u origen del público.
- En la estrategia usa el análisis de métricas entregado y menciona su nivel de confianza.`;

async function contenidoConClaude(
  analisis: Analisis,
  espacios: EspacioPieza[],
  p: DatosProyecto
): Promise<{ estrategia: string; piezas: ContenidoPieza[] }> {
  const client = new Anthropic();
  const entrada = {
    proyecto: p,
    analisis: {
      confianza: analisis.confianza,
      ventanaDias: analisis.ventanaDias,
      totalPublicaciones: analisis.totalPublicaciones,
      porPlataforma: analisis.porPlataforma,
      porFormato: analisis.porFormato,
      mejoresFranjas: analisis.mejoresFranjas.map((f) => f.etiqueta),
      recomendacion: analisis.recomendacion,
      hallazgos: analisis.hallazgos,
      alertas: analisis.alertas,
    },
    espacios: espacios.map((e) => ({
      orden: e.orden,
      fecha: formatoFechaHora(e.fechaProgramada),
      plataforma: e.plataforma,
      formato: e.formato,
      objetivo: e.objetivo,
      tema: e.tema,
      pagada: e.pagada,
      presupuesto: e.presupuesto,
    })),
  };

  const response = await client.beta.messages.parse({
    model: process.env.MERCADEO_MODELO_CLAUDE || "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(EsquemaContenido) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Genera la estrategia de la semana y el contenido de cada espacio.\n\n${JSON.stringify(entrada, null, 2)}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declinó generar el contenido");
  }
  const salida = response.parsed_output;
  if (!salida) throw new Error("Respuesta de Claude sin contenido estructurado");

  const porOrden = new Map(salida.piezas.map((x) => [x.orden, x]));
  const piezas = espacios.map((e) => {
    const x = porOrden.get(e.orden);
    if (!x) return contenidoPlantilla(e, p);
    return {
      titular: x.titular.slice(0, 120),
      copy: x.copy,
      cta: x.cta,
      hashtags: x.hashtags,
      conceptoVisual: x.conceptoVisual,
      guionVideo: esVideo(e.formato) ? x.guionVideo : null,
    };
  });
  return { estrategia: salida.estrategia, piezas };
}

export async function generarContenido(
  analisis: Analisis,
  espacios: EspacioPieza[],
  proyecto: DatosProyecto
): Promise<ResultadoContenido> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await contenidoConClaude(analisis, espacios, proyecto);
      return { ...r, generadoCon: "claude" };
    } catch (error) {
      console.error("[mercadeo] Falló la generación con Claude, se usan plantillas:", error);
      return {
        estrategia: estrategiaPlantilla(analisis, espacios, proyecto),
        piezas: espacios.map((e) => contenidoPlantilla(e, proyecto)),
        generadoCon: "plantilla",
        advertencia: "No se pudo usar Claude; el contenido se generó con plantillas.",
      };
    }
  }
  return {
    estrategia: estrategiaPlantilla(analisis, espacios, proyecto),
    piezas: espacios.map((e) => contenidoPlantilla(e, proyecto)),
    generadoCon: "plantilla",
  };
}
