import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email },
          include: { empresa: true },
        });
        if (!usuario) return null;

        const passwordValida = await bcrypt.compare(
          credentials.password,
          usuario.passwordHash
        );
        if (!passwordValida) return null;

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          rolEmpresa: usuario.rolEmpresa,
          empresaId: usuario.empresaId,
          empresaNombre: usuario.empresa?.nombre ?? null,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.rol = (user as any).rol;
        token.rolEmpresa = (user as any).rolEmpresa;
        token.empresaId = (user as any).empresaId;
        token.empresaNombre = (user as any).empresaNombre;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).rol = token.rol;
        (session.user as any).rolEmpresa = token.rolEmpresa;
        (session.user as any).empresaId = token.empresaId;
        (session.user as any).empresaNombre = token.empresaNombre;
      }
      return session;
    },
  },
};
