import { NextResponse } from "next/server";
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
  console.error("[mercadeo]", error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
