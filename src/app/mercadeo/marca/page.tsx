import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/nav-bar";
import { KitMarca } from "@/components/mercadeo-marca";

export const dynamic = "force-dynamic";

export default async function MarcaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!user.empresaId) redirect("/dashboard");
  const empresa = await prisma.empresa.findUnique({
    where: { id: user.empresaId },
    select: { nombre: true, logoUrl: true, colorPrimario: true, colorOscuro: true, colorAcento: true },
  });

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link href="/mercadeo" className="text-sm text-gray-500 hover:underline">
          ← Mercadeo
        </Link>
        <h1 className="text-2xl font-bold mt-2">Kit de marca</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Logo y colores de {empresa?.nombre}. Se aplican a todas las piezas gráficas de mercadeo.
        </p>
        <KitMarca
          inicial={{
            logoUrl: empresa?.logoUrl ?? null,
            colorPrimario: empresa?.colorPrimario ?? null,
            colorOscuro: empresa?.colorOscuro ?? null,
            colorAcento: empresa?.colorAcento ?? null,
          }}
          esAdmin={user.rolEmpresa === "ADMIN_EMPRESA"}
        />
      </div>
    </main>
  );
}
