"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/components/providers";
import { TemaToggle } from "@/components/tema";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setCargando(false);

    if (res?.error) {
      setError(t.auth.credencialesInvalidas);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <TemaToggle className="fixed top-4 right-4 bg-white" />
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white p-8 rounded-xl shadow-sm border"
      >
        <h1 className="text-2xl font-bold mb-6">{t.auth.iniciarSesion}</h1>

        {error && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 p-2 rounded">
            {error}
          </p>
        )}

        <label className="block text-sm font-medium mb-1">{t.auth.email}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />

        <label className="block text-sm font-medium mb-1">{t.auth.contrasena}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 mb-6"
        />

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-brand-600 text-white py-2 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {cargando ? t.auth.ingresando : t.auth.ingresar}
        </button>

        <p className="text-sm text-gray-600 mt-4 text-center">
          {t.auth.noTienesCuenta}{" "}
          <Link href="/registro" className="text-brand-600 font-medium">
            {t.auth.registrate}
          </Link>
        </p>
      </form>
    </main>
  );
}
