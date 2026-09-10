"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/components/providers";

export default function RegistroPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "COMPRADOR",
    empresaNombre: "",
    empresaNit: "",
    empresaPais: "",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setCargando(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al registrar");
      return;
    }

    router.push("/login");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border"
      >
        <h1 className="text-2xl font-bold mb-6">{t.auth.crearCuentaTitulo}</h1>

        {error && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 p-2 rounded">
            {error}
          </p>
        )}

        <label className="block text-sm font-medium mb-1">{t.auth.tipoCuenta}</label>
        <select
          value={form.rol}
          onChange={(e) => update("rol", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        >
          <option value="COMPRADOR">{t.auth.opcionComprador}</option>
          <option value="PROVEEDOR">{t.auth.opcionProveedor}</option>
        </select>

        <label className="block text-sm font-medium mb-1">{t.auth.tuNombre}</label>
        <input
          value={form.nombre}
          onChange={(e) => update("nombre", e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />

        <label className="block text-sm font-medium mb-1">{t.auth.email}</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />

        <label className="block text-sm font-medium mb-1">{t.auth.contrasena}</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          required
          minLength={6}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />

        <hr className="my-4" />

        <label className="block text-sm font-medium mb-1">{t.auth.nombreEmpresa}</label>
        <input
          value={form.empresaNombre}
          onChange={(e) => update("empresaNombre", e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />

        <label className="block text-sm font-medium mb-1">{t.auth.nit}</label>
        <input
          value={form.empresaNit}
          onChange={(e) => update("empresaNit", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />

        <label className="block text-sm font-medium mb-1">{t.auth.pais}</label>
        <input
          value={form.empresaPais}
          onChange={(e) => update("empresaPais", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-6"
        />

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-brand-600 text-white py-2 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {cargando ? t.auth.creandoCuenta : t.auth.crearCuentaBtn}
        </button>

        <p className="text-sm text-gray-600 mt-4 text-center">
          {t.auth.yaTienesCuenta}{" "}
          <Link href="/login" className="text-brand-600 font-medium">
            {t.auth.iniciaSesion}
          </Link>
        </p>
      </form>
    </main>
  );
}
