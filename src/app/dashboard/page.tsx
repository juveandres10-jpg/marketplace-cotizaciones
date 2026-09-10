import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/nav-bar";
import { getServerLocale } from "@/lib/get-server-locale";
import { getDictionary } from "@/lib/i18n";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  const t = getDictionary(getServerLocale());

  const proyectos = await prisma.proyecto.findMany({
    where: { empresaId: user.empresaId },
    include: { _count: { select: { cotizaciones: true, items: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t.dashboard.tusProyectos}</h1>
          {user.rol === "COMPRADOR" && user.rolEmpresa === "ADMIN_EMPRESA" && (
            <Link
              href="/proyectos/nuevo"
              className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700"
            >
              {t.dashboard.nuevoProyecto}
            </Link>
          )}
        </div>

        {proyectos.length === 0 && (
          <p className="text-gray-500">{t.dashboard.sinProyectos}</p>
        )}

        <div className="grid gap-4">
          {proyectos.map((p) => (
            <Link
              key={p.id}
              href={`/proyectos/${p.id}`}
              className="bg-white border rounded-xl p-5 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">{p.nombre}</h2>
                <span className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full">
                  {p.estado}
                </span>
              </div>
              {p.descripcion && (
                <p className="text-gray-600 text-sm mt-1">{p.descripcion}</p>
              )}
              <div className="flex gap-4 text-sm text-gray-500 mt-3">
                <span>{p._count.items} {t.dashboard.itemsBom}</span>
                <span>{p._count.cotizaciones} {t.dashboard.cotizaciones}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
