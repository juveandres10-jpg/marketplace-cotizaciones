import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { NavBar } from "@/components/nav-bar";
import { ProyectoVentaForm } from "@/components/mercadeo-proyecto-form";

export default async function NuevoProyectoVentaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/mercadeo" className="text-sm text-gray-500 hover:underline">
          ← Mercadeo
        </Link>
        <h1 className="text-2xl font-bold mt-2 mb-6">Nuevo proyecto en venta</h1>
        <ProyectoVentaForm />
      </div>
    </main>
  );
}
