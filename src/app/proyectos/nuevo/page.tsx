"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav-bar";
import { useLocale } from "@/components/providers";

export default function NuevoProyectoPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState("");

  const textos =
    locale === "en"
      ? {
          titulo: "New project",
          nombre: "Name",
          nombrePlaceholder: "E.g: 1ha Solar Farm",
          descripcion: "Description",
          crear: "Create project",
        }
      : {
          titulo: "Nuevo proyecto",
          nombre: "Nombre",
          nombrePlaceholder: "Ej: Granja Solar 1ha",
          descripcion: "Descripción",
          crear: "Crear proyecto",
        };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/proyectos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, descripcion }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al crear el proyecto");
      return;
    }

    const proyecto = await res.json();
    router.push(`/proyectos/${proyecto.id}`);
  }

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-6">{textos.titulo}</h1>
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6">
          {error && (
            <p className="text-red-600 text-sm mb-4 bg-red-50 p-2 rounded">
              {error}
            </p>
          )}
          <label className="block text-sm font-medium mb-1">{textos.nombre}</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder={textos.nombrePlaceholder}
            className="w-full border rounded-lg px-3 py-2 mb-4"
          />
          <label className="block text-sm font-medium mb-1">{textos.descripcion}</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            className="w-full border rounded-lg px-3 py-2 mb-6"
          />
          <button
            type="submit"
            className="bg-brand-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-brand-700"
          >
            {textos.crear}
          </button>
        </form>
      </div>
    </main>
  );
}
