import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/nav-bar";
import { ProyectoVentaForm } from "@/components/mercadeo-proyecto-form";
import { GaleriaImagenesProyecto } from "@/components/mercadeo-galeria";

export const dynamic = "force-dynamic";

export default async function EditarProyectoVentaPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const proyecto = await prisma.proyectoVenta.findFirst({
    where: { id: params.id, empresaId: (session.user as any).empresaId ?? "" },
  });
  if (!proyecto) notFound();
  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/mercadeo" className="text-sm text-gray-500 hover:underline">
          ← Mercadeo
        </Link>
        <h1 className="text-2xl font-bold mt-2 mb-6">{proyecto.nombre}</h1>
        <GaleriaImagenesProyecto proyectoId={proyecto.id} iniciales={proyecto.imagenes} />
        <ProyectoVentaForm inicial={proyecto} />
      </div>
    </main>
  );
}
