import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ZodError } from "zod";
import { ErrorMercadeo } from "./servicio";
import { ErrorMeta } from "./meta";

export function noAutorizado() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

export function datosInvalidos(error: ZodError) {
  return NextResponse.json({ error: "Datos inválidos", detalle: error.flatten() }, { status: 400 });
}

export function respuestaError(error: unknown) {
  if (error instanceof ErrorMercadeo) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ErrorMeta) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  if (error instanceof Anthropic.APIError) {
    console.error("[mercadeo] Error de la API de Claude:", error);
    const motivo =
      error instanceof Anthropic.AuthenticationError
        ? "la clave ANTHROPIC_API_KEY no es válida"
        : error instanceof Anthropic.RateLimitError
          ? "límite de uso alcanzado, intenta en unos minutos"
          : "no se pudo contactar la IA, intenta de nuevo";
    return NextResponse.json({ error: `IA de Claude: ${motivo}.` }, { status: 502 });
  }
  console.error("[mercadeo]", error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
