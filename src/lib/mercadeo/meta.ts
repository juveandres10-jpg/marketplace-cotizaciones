// Integración con Meta (Facebook + Instagram) vía Graph / Marketing API.
//
//  - sincronizarMetricas(): trae publicaciones orgánicas de la Página y de la
//    cuenta de Instagram, resultados de los anuncios y seguidores.
//  - publicarPlanEnMeta(): SOLO se llama cuando un plan fue aprobado. Crea las
//    campañas/anuncios de las piezas pagadas y programa las orgánicas.
//
// Sobre el pago: la app no maneja tarjetas. Meta cobra la pauta al método de
// pago configurado en la cuenta publicitaria. Por seguridad los anuncios se
// crean en PAUSA salvo que META_ACTIVAR_AL_APROBAR=true.

import { prisma } from "@/lib/prisma";
import type { PiezaPlan, ProyectoVenta } from "@prisma/client";
import type { Formato, Plataforma } from "./analisis";
import { generarImagenPieza } from "./imagen";
import { urlBase } from "./servicio";

const VERSION = process.env.META_API_VERSION || "v23.0";
// META_GRAPH_URL permite apuntar a un servidor simulado en pruebas.
const GRAPH = `${process.env.META_GRAPH_URL || "https://graph.facebook.com"}/${VERSION}`;

function env() {
  return {
    token: process.env.META_ACCESS_TOKEN || "",
    pageToken: process.env.META_PAGE_ACCESS_TOKEN || "",
    pageId: process.env.META_PAGE_ID || "",
    igUserId: process.env.META_IG_USER_ID || "",
    adAccountId: (process.env.META_AD_ACCOUNT_ID || "").replace(/^act_/, ""),
    pais: process.env.META_PAIS || "CO",
    categoriaEspecial: process.env.META_CATEGORIA_ESPECIAL ?? "HOUSING",
    factorMoneda: Number(process.env.META_FACTOR_MONEDA || 100),
    activar: process.env.META_ACTIVAR_AL_APROBAR === "true",
  };
}

export function estadoConfiguracionMeta() {
  const e = env();
  return {
    token: Boolean(e.token),
    pagina: Boolean(e.token && e.pageId),
    instagram: Boolean(e.token && e.igUserId),
    anuncios: Boolean(e.token && e.adAccountId && e.pageId),
    activarAlAprobar: e.activar,
    categoriaEspecial: e.categoriaEspecial || null,
  };
}

export class ErrorMeta extends Error {}

type Params = Record<string, unknown>;

async function graph<T = any>(
  metodo: "GET" | "POST",
  ruta: string,
  params: Params = {},
  token = env().token
): Promise<T> {
  const cuerpo = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    cuerpo.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  cuerpo.set("access_token", token);
  const url = ruta.startsWith("http") ? ruta : `${GRAPH}/${ruta.replace(/^\//, "")}`;
  const res =
    metodo === "GET"
      ? await fetch(ruta.startsWith("http") ? ruta : `${url}?${cuerpo}`, { cache: "no-store" })
      : await fetch(url, { method: "POST", body: cuerpo });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg = json.error?.error_user_msg || json.error?.message || `HTTP ${res.status}`;
    throw new ErrorMeta(`Meta ${ruta.split("?")[0]}: ${msg}`);
  }
  return json as T;
}

async function paginar<T>(ruta: string, params: Params, token: string, hasta: (x: T) => boolean, maxPaginas = 10) {
  const items: T[] = [];
  let pagina: any = await graph("GET", ruta, params, token);
  for (let i = 0; i < maxPaginas; i++) {
    const data: T[] = pagina.data ?? [];
    for (const x of data) {
      if (hasta(x)) return items;
      items.push(x);
    }
    if (!pagina.paging?.next) break;
    pagina = await graph("GET", pagina.paging.next, {}, token);
  }
  return items;
}

let pageTokenCache: string | null = null;
async function tokenDePagina(): Promise<string> {
  const e = env();
  if (e.pageToken) return e.pageToken;
  if (pageTokenCache) return pageTokenCache;
  const r = await graph<{ access_token?: string }>("GET", e.pageId, { fields: "access_token" });
  if (!r.access_token) throw new ErrorMeta("No se pudo obtener el token de la Página (revisa permisos pages_manage_posts / pages_read_engagement).");
  pageTokenCache = r.access_token;
  return pageTokenCache;
}

function valorInsight(insights: any, nombre: string): number {
  const m = insights?.data?.find((d: any) => d.name === nombre);
  if (!m) return 0;
  const v = m.values?.[0]?.value ?? m.total_value?.value ?? 0;
  return typeof v === "number" ? v : 0;
}

// ------------------------------------------------------------------
// Sincronización de métricas
// ------------------------------------------------------------------

export async function sincronizarMetricas(empresaId: string, dias = 90) {
  const e = env();
  const conf = estadoConfiguracionMeta();
  if (!conf.token) throw new ErrorMeta("Meta no está configurado (falta META_ACCESS_TOKEN).");
  const desde = new Date(Date.now() - dias * 86_400_000);
  const desdeUnix = Math.floor(desde.getTime() / 1000);
  const resumen = { facebook: 0, instagram: 0, anuncios: 0, seguidores: 0, errores: [] as string[] };

  async function guardar(m: {
    plataforma: Plataforma;
    externoId: string;
    fechaPublicacion: Date;
    horaConocida?: boolean;
    formato: Formato;
    pagada: boolean;
    texto?: string | null;
    alcance: number;
    impresiones: number;
    interacciones: number;
    clics: number;
    leads: number;
    mensajes: number;
    gasto: number;
    proyectoVentaId?: string | null;
  }) {
    const data = { ...m, fuente: "META_API" as const, empresaId, texto: m.texto?.slice(0, 2000) ?? null };
    await prisma.metricaPublicacion.upsert({
      where: {
        empresaId_plataforma_externoId: { empresaId, plataforma: m.plataforma, externoId: m.externoId },
      },
      create: data,
      update: data,
    });
  }

  // --- Página de Facebook ---
  if (conf.pagina) {
    try {
      const token = await tokenDePagina();
      const campos =
        "id,message,created_time,attachments{media_type},reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares";
      // Los seguidores se registran aunque la lectura de publicaciones falle.
      try {
        const pagina = await graph<{ followers_count?: number }>("GET", e.pageId, { fields: "followers_count" }, token);
        if (pagina.followers_count != null) {
          await prisma.snapshotCuenta.create({
            data: { empresaId, plataforma: "FACEBOOK", seguidores: pagina.followers_count, fuente: "META_API" },
          });
          resumen.seguidores++;
        }
      } catch (err: any) {
        resumen.errores.push(err.message);
      }

      // Se prueba de la consulta más completa a la más simple: algunas métricas
      // de insights cambian entre versiones, y /posts puede exigir el permiso
      // pages_read_user_content, que /published_posts no necesita.
      const intentos: Array<[string, string]> = [
        ["posts", `${campos},insights.metric(post_impressions_unique,post_clicks)`],
        ["posts", campos],
        ["published_posts", `${campos},insights.metric(post_impressions_unique,post_clicks)`],
        ["published_posts", campos],
      ];
      let posts: any[] = [];
      let ultimoError: unknown = null;
      for (const [edge, fields] of intentos) {
        try {
          posts = await paginar<any>(`${e.pageId}/${edge}`, { fields, since: desdeUnix, limit: 50 }, token, (p) => new Date(p.created_time) < desde);
          ultimoError = null;
          break;
        } catch (err) {
          ultimoError = err;
        }
      }
      if (ultimoError) throw ultimoError;
      for (const p of posts) {
        const tipo = p.attachments?.data?.[0]?.media_type;
        const interacciones =
          (p.reactions?.summary?.total_count ?? 0) + (p.comments?.summary?.total_count ?? 0) + (p.shares?.count ?? 0);
        await guardar({
          plataforma: "FACEBOOK",
          externoId: p.id,
          fechaPublicacion: new Date(p.created_time),
          formato: tipo === "video" ? "VIDEO" : tipo === "album" ? "CARRUSEL" : "IMAGEN",
          pagada: false,
          texto: p.message,
          alcance: valorInsight(p.insights, "post_impressions_unique"),
          impresiones: 0,
          interacciones,
          clics: valorInsight(p.insights, "post_clicks"),
          leads: 0,
          mensajes: 0,
          gasto: 0,
        });
        resumen.facebook++;
      }
    } catch (err: any) {
      resumen.errores.push(err.message);
    }
  }

  // --- Instagram ---
  if (conf.instagram) {
    try {
      const campos = "id,caption,media_type,media_product_type,timestamp,like_count,comments_count";
      let medias: any[];
      try {
        medias = await paginar<any>(
          `${e.igUserId}/media`,
          { fields: `${campos},insights.metric(reach,saved,shares)`, limit: 50 },
          e.token,
          (m) => new Date(m.timestamp) < desde
        );
      } catch {
        medias = await paginar<any>(`${e.igUserId}/media`, { fields: campos, limit: 50 }, e.token, (m) => new Date(m.timestamp) < desde);
      }
      for (const m of medias) {
        const formato: Formato =
          m.media_product_type === "REELS"
            ? "REEL"
            : m.media_product_type === "STORY"
              ? "HISTORIA"
              : m.media_type === "CAROUSEL_ALBUM"
                ? "CARRUSEL"
                : m.media_type === "VIDEO"
                  ? "VIDEO"
                  : "IMAGEN";
        await guardar({
          plataforma: "INSTAGRAM",
          externoId: m.id,
          fechaPublicacion: new Date(m.timestamp),
          formato,
          pagada: false,
          texto: m.caption,
          alcance: valorInsight(m.insights, "reach"),
          impresiones: 0,
          interacciones:
            (m.like_count ?? 0) + (m.comments_count ?? 0) + valorInsight(m.insights, "saved") + valorInsight(m.insights, "shares"),
          clics: 0,
          leads: 0,
          mensajes: 0,
          gasto: 0,
        });
        resumen.instagram++;
      }
      const cuenta = await graph<{ followers_count?: number }>("GET", e.igUserId, { fields: "followers_count" });
      if (cuenta.followers_count != null) {
        await prisma.snapshotCuenta.create({
          data: { empresaId, plataforma: "INSTAGRAM", seguidores: cuenta.followers_count, fuente: "META_API" },
        });
        resumen.seguidores++;
      }
    } catch (err: any) {
      resumen.errores.push(err.message);
    }
  }

  // --- Anuncios (pauta) ---
  if (e.token && e.adAccountId) {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const filas = await paginar<any>(
        `act_${e.adAccountId}/insights`,
        {
          level: "ad",
          fields: "ad_id,ad_name,spend,impressions,reach,clicks,inline_link_clicks,actions",
          breakdowns: "publisher_platform",
          time_increment: 1,
          time_range: { since: desde.toISOString().slice(0, 10), until: hoy },
          limit: 200,
        },
        e.token,
        () => false,
        20
      );
      const porAnuncio = new Map<string, any>();
      for (const f of filas) {
        const plataforma: Plataforma | null =
          f.publisher_platform === "instagram" ? "INSTAGRAM" : f.publisher_platform === "facebook" ? "FACEBOOK" : null;
        if (!plataforma) continue;
        const clave = `${f.ad_id}:${plataforma}`;
        const acc = porAnuncio.get(clave) ?? {
          adId: f.ad_id,
          nombre: f.ad_name,
          plataforma,
          fecha: f.date_start,
          alcance: 0,
          impresiones: 0,
          clics: 0,
          leads: 0,
          mensajes: 0,
          gasto: 0,
        };
        if (f.date_start < acc.fecha) acc.fecha = f.date_start;
        const accion = (tipo: string) => Number(f.actions?.find((a: any) => a.action_type === tipo)?.value ?? 0);
        acc.alcance += Number(f.reach ?? 0); // suma diaria: aproximación (Meta deduplica el alcance por periodo)
        acc.impresiones += Number(f.impressions ?? 0);
        acc.clics += Number(f.inline_link_clicks ?? f.clicks ?? 0);
        acc.gasto += Number(f.spend ?? 0);
        acc.leads += accion("lead") || accion("onsite_conversion.lead_grouped") || accion("offsite_conversion.fb_pixel_lead");
        acc.mensajes += accion("onsite_conversion.messaging_conversation_started_7d");
        porAnuncio.set(clave, acc);
      }
      const piezas = await prisma.piezaPlan.findMany({
        where: { metaAdId: { in: Array.from(porAnuncio.values()).map((a) => a.adId) } },
        select: { metaAdId: true, formato: true, plan: { select: { proyectoVentaId: true } } },
      });
      const piezaPorAd = new Map(piezas.map((p) => [p.metaAdId, p]));
      for (const a of Array.from(porAnuncio.values())) {
        const pieza = piezaPorAd.get(a.adId);
        await guardar({
          plataforma: a.plataforma,
          externoId: `ad:${a.adId}`,
          fechaPublicacion: new Date(`${a.fecha}T12:00:00Z`),
          horaConocida: false,
          formato: (pieza?.formato as Formato) ?? "IMAGEN",
          pagada: true,
          texto: a.nombre,
          alcance: a.alcance,
          impresiones: a.impresiones,
          interacciones: 0,
          clics: a.clics,
          leads: a.leads,
          mensajes: a.mensajes,
          gasto: a.gasto,
          proyectoVentaId: pieza?.plan.proyectoVentaId ?? null,
        });
        resumen.anuncios++;
      }
    } catch (err: any) {
      resumen.errores.push(err.message);
    }
  }

  return resumen;
}

// ------------------------------------------------------------------
// Publicación / pauta de un plan aprobado
// ------------------------------------------------------------------

function destino(p: ProyectoVenta, objetivo: string): string | null {
  const whatsapp = p.whatsapp ? `https://wa.me/${p.whatsapp.replace(/\D/g, "")}` : null;
  // Las piezas de "mensajes" llevan directo a WhatsApp; el resto a la landing.
  if (objetivo === "MENSAJES" && whatsapp) return whatsapp;
  return p.urlLanding || whatsapp;
}

function textoCompleto(pieza: PiezaPlan) {
  return pieza.hashtags ? `${pieza.copy}\n\n${pieza.hashtags}` : pieza.copy;
}

export function urlImagenPieza(piezaId: string) {
  return `${urlBase()}/api/mercadeo/piezas/${piezaId}/imagen`;
}

async function crearAnuncio(
  pieza: PiezaPlan,
  proyecto: ProyectoVenta,
  campanas: Map<string, string>,
  nombrePlan: string
) {
  const e = env();
  const link = destino(proyecto, pieza.objetivo);
  if (!link) throw new ErrorMeta("El proyecto no tiene landing ni WhatsApp: no hay a dónde llevar la pauta.");
  const estado = e.activar ? "ACTIVE" : "PAUSED";
  const alcance = pieza.objetivo === "ALCANCE";
  const objetivoMeta = alcance ? "OUTCOME_AWARENESS" : "OUTCOME_TRAFFIC";

  // Una campaña por objetivo dentro del plan.
  let campaignId = campanas.get(objetivoMeta);
  if (!campaignId) {
    const categorias = e.categoriaEspecial ? [e.categoriaEspecial] : [];
    const c = await graph<{ id: string }>("POST", `act_${e.adAccountId}/campaigns`, {
      name: `${nombrePlan} · ${alcance ? "Alcance" : "Tráfico/Leads"}`,
      objective: objetivoMeta,
      status: estado,
      special_ad_categories: categorias,
      special_ad_category_country: categorias.length ? [e.pais] : undefined,
      is_adset_budget_sharing_enabled: false,
    });
    campaignId = c.id;
    campanas.set(objetivoMeta, campaignId);
  }

  // Segmentación: radio alrededor del proyecto (vivienda = categoría especial:
  // Meta exige radio mínimo de 15 millas (~25 km) y no permite edad/género).
  const radioKm = Math.max(e.categoriaEspecial === "HOUSING" ? 25 : 10, Number(process.env.MERCADEO_RADIO_KM || 25));
  const geo =
    proyecto.latitud != null && proyecto.longitud != null
      ? {
          custom_locations: [
            { latitude: proyecto.latitud, longitude: proyecto.longitud, radius: radioKm, distance_unit: "kilometer" },
          ],
        }
      : { countries: [e.pais] };
  const esIG = pieza.plataforma === "INSTAGRAM";
  const vertical = pieza.formato === "HISTORIA" || pieza.formato === "REEL";
  const targeting = {
    geo_locations: geo,
    publisher_platforms: [esIG ? "instagram" : "facebook"],
    ...(esIG
      ? { instagram_positions: vertical ? ["story", "reels"] : ["stream", "explore"] }
      : { facebook_positions: vertical ? ["story", "facebook_reels"] : ["feed"] }),
  };

  const inicio = new Date(Math.max(pieza.fechaProgramada.getTime(), Date.now() + 15 * 60_000));
  const fin = new Date(inicio.getTime() + Math.max(1, pieza.diasPauta) * 86_400_000);
  const adset = await graph<{ id: string }>("POST", `act_${e.adAccountId}/adsets`, {
    name: `#${pieza.orden} ${pieza.plataforma} · ${pieza.tema}`.slice(0, 200),
    campaign_id: campaignId,
    lifetime_budget: Math.round(pieza.presupuesto * e.factorMoneda),
    start_time: inicio.toISOString(),
    end_time: fin.toISOString(),
    billing_event: "IMPRESSIONS",
    optimization_goal: alcance ? "REACH" : "LINK_CLICKS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
    status: estado,
  });

  const png = await generarImagenPieza(pieza, proyecto);
  const img = await graph<{ images: Record<string, { hash: string }> }>("POST", `act_${e.adAccountId}/adimages`, {
    bytes: png.toString("base64"),
  });
  const imageHash = Object.values(img.images ?? {})[0]?.hash;
  if (!imageHash) throw new ErrorMeta("Meta no devolvió el hash de la imagen subida.");

  const creative = await graph<{ id: string }>("POST", `act_${e.adAccountId}/adcreatives`, {
    name: `${proyecto.nombre} #${pieza.orden}`,
    object_story_spec: {
      page_id: e.pageId,
      ...(e.igUserId ? { instagram_user_id: e.igUserId } : {}),
      link_data: {
        image_hash: imageHash,
        link,
        message: textoCompleto(pieza),
        name: pieza.titular,
        call_to_action: {
          type: pieza.objetivo === "MENSAJES" ? "CONTACT_US" : "LEARN_MORE",
          value: { link },
        },
      },
    },
  });

  const ad = await graph<{ id: string }>("POST", `act_${e.adAccountId}/ads`, {
    name: `${proyecto.nombre} #${pieza.orden} ${pieza.plataforma}`,
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status: estado,
  });

  return { campaignId, adSetId: adset.id, adId: ad.id, estado };
}

async function programarPostFacebook(pieza: PiezaPlan, proyecto: ProyectoVenta) {
  const e = env();
  const token = await tokenDePagina();
  const png = await generarImagenPieza(pieza, proyecto);
  const form = new FormData();
  form.set("source", new Blob([new Uint8Array(png)], { type: "image/png" }), "pieza.png");
  form.set("caption", textoCompleto(pieza));
  // Facebook permite programar entre 10 minutos y 30 días en el futuro.
  const programable = pieza.fechaProgramada.getTime() > Date.now() + 15 * 60_000;
  if (programable) {
    form.set("published", "false");
    form.set("scheduled_publish_time", String(Math.floor(pieza.fechaProgramada.getTime() / 1000)));
  }
  form.set("access_token", token);
  const res = await fetch(`${GRAPH}/${e.pageId}/photos`, { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new ErrorMeta(`Meta /photos: ${json.error?.message ?? res.status}`);
  return { postId: (json.post_id ?? json.id) as string, estado: programable ? "PROGRAMADA" : "PUBLICADA" };
}

/** Publica en Instagram (la API no permite programar: la tarea automática llama esto a la hora). */
async function publicarInstagram(pieza: PiezaPlan) {
  const e = env();
  const esHistoria = pieza.formato === "HISTORIA";
  // Reels necesitan video; mientras la pieza sea una imagen se publica en el feed.
  const contenedor = await graph<{ id: string }>("POST", `${e.igUserId}/media`, {
    image_url: urlImagenPieza(pieza.id),
    ...(esHistoria ? { media_type: "STORIES" } : { caption: textoCompleto(pieza) }),
  });
  const pub = await graph<{ id: string }>("POST", `${e.igUserId}/media_publish`, { creation_id: contenedor.id });
  return pub.id;
}

export type ResultadoPublicacion = {
  piezaId: string;
  orden: number;
  ok: boolean;
  detalle: string;
};

export async function publicarPlanEnMeta(planId: string) {
  const conf = estadoConfiguracionMeta();
  const plan = await prisma.planSemanal.findUniqueOrThrow({
    where: { id: planId },
    include: { proyectoVenta: true, piezas: { orderBy: { orden: "asc" } } },
  });
  const resultados: ResultadoPublicacion[] = [];
  const campanas = new Map<string, string>();
  const nombrePlan = `${plan.proyectoVenta.nombre} · semana ${plan.semanaInicio.toISOString().slice(0, 10)}`;

  for (const pieza of plan.piezas) {
    if (pieza.metaAdId || pieza.metaPostId) continue; // ya publicada (reintento)
    try {
      if (pieza.pagada) {
        if (!conf.anuncios) throw new ErrorMeta("Cuenta publicitaria no configurada (META_AD_ACCOUNT_ID, META_PAGE_ID).");
        const r = await crearAnuncio(pieza, plan.proyectoVenta, campanas, nombrePlan);
        await prisma.piezaPlan.update({
          where: { id: pieza.id },
          data: { metaAdSetId: r.adSetId, metaAdId: r.adId, estadoMeta: "PAUTA_CREADA", errorMeta: null },
        });
        resultados.push({ piezaId: pieza.id, orden: pieza.orden, ok: true, detalle: `Anuncio ${r.adId} creado (${r.estado === "ACTIVE" ? "activo" : "en pausa"})` });
      } else if (pieza.plataforma === "FACEBOOK") {
        if (!conf.pagina) throw new ErrorMeta("Página de Facebook no configurada (META_PAGE_ID).");
        const r = await programarPostFacebook(pieza, plan.proyectoVenta);
        await prisma.piezaPlan.update({
          where: { id: pieza.id },
          data: { metaPostId: r.postId, estadoMeta: r.estado, errorMeta: null },
        });
        resultados.push({ piezaId: pieza.id, orden: pieza.orden, ok: true, detalle: r.estado === "PROGRAMADA" ? "Publicación programada en Facebook" : "Publicada en Facebook" });
      } else {
        if (!conf.instagram) throw new ErrorMeta("Cuenta de Instagram no configurada (META_IG_USER_ID).");
        await prisma.piezaPlan.update({ where: { id: pieza.id }, data: { estadoMeta: "PENDIENTE", errorMeta: null } });
        resultados.push({ piezaId: pieza.id, orden: pieza.orden, ok: true, detalle: "En cola: se publicará en Instagram a la hora programada" });
      }
    } catch (err: any) {
      await prisma.piezaPlan.update({ where: { id: pieza.id }, data: { estadoMeta: "ERROR", errorMeta: err.message } });
      resultados.push({ piezaId: pieza.id, orden: pieza.orden, ok: false, detalle: err.message });
    }
  }

  const algunoOk = resultados.some((r) => r.ok);
  await prisma.planSemanal.update({
    where: { id: plan.id },
    data: {
      estado: algunoOk ? "PUBLICADO" : plan.estado,
      metaCampaignId: Array.from(campanas.values()).join(",") || plan.metaCampaignId,
      metaResultado: { fecha: new Date().toISOString(), resultados },
    },
  });
  return resultados;
}

/** Publica las piezas orgánicas de Instagram cuya hora ya llegó. */
export async function publicarInstagramPendientes() {
  if (!estadoConfiguracionMeta().instagram) return [];
  const piezas = await prisma.piezaPlan.findMany({
    where: {
      plataforma: "INSTAGRAM",
      pagada: false,
      estadoMeta: "PENDIENTE",
      fechaProgramada: { lte: new Date() },
      plan: { estado: "PUBLICADO" },
    },
    take: 20,
  });
  const resultados: ResultadoPublicacion[] = [];
  for (const pieza of piezas) {
    try {
      const id = await publicarInstagram(pieza);
      await prisma.piezaPlan.update({ where: { id: pieza.id }, data: { metaPostId: id, estadoMeta: "PUBLICADA", errorMeta: null } });
      resultados.push({ piezaId: pieza.id, orden: pieza.orden, ok: true, detalle: `Publicada en Instagram (${id})` });
    } catch (err: any) {
      await prisma.piezaPlan.update({ where: { id: pieza.id }, data: { estadoMeta: "ERROR", errorMeta: err.message } });
      resultados.push({ piezaId: pieza.id, orden: pieza.orden, ok: false, detalle: err.message });
    }
  }
  return resultados;
}
