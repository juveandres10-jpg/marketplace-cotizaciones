import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registroSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  rol: z.enum(["COMPRADOR", "PROVEEDOR"]),
  empresaNombre: z.string().min(2),
  empresaNit: z.string().optional(),
  empresaPais: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const datos = registroSchema.parse(body);

    const existente = await prisma.usuario.findUnique({
      where: { email: datos.email },
    });
    if (existente) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 400 }
      );
    }

    // Busca o crea la empresa
    let empresa = datos.empresaNit
      ? await prisma.empresa.findUnique({ where: { nit: datos.empresaNit } })
      : null;

    const empresaYaExistia = !!empresa;

    if (!empresa) {
      empresa = await prisma.empresa.create({
        data: {
          nombre: datos.empresaNombre,
          nit: datos.empresaNit,
          pais: datos.empresaPais,
          tipo: datos.rol === "COMPRADOR" ? "COMPRADOR" : "PROVEEDOR",
        },
      });
    }

    const passwordHash = await bcrypt.hash(datos.password, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nombre: datos.nombre,
        email: datos.email,
        passwordHash,
        rol: datos.rol,
        rolEmpresa: empresaYaExistia ? "MIEMBRO" : "ADMIN_EMPRESA",
        empresaId: empresa.id,
      },
    });

    return NextResponse.json({
      id: usuario.id,
      email: usuario.email,
      empresa: empresa.nombre,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Error al registrar usuario" },
      { status: 400 }
    );
  }
}
