"use client";

import { useEffect, useState } from "react";

type Tema = "claro" | "oscuro" | "sistema";

// Se ejecuta en <head> antes de pintar la página (sin parpadeo blanco).
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem('tema')||'sistema';var d=t==='oscuro'||(t==='sistema'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

function aplicar(tema: Tema) {
  const oscuro = tema === "oscuro" || (tema === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", oscuro);
  document.documentElement.style.colorScheme = oscuro ? "dark" : "light";
}

function leer(): Tema {
  try {
    const t = localStorage.getItem("tema");
    return t === "claro" || t === "oscuro" ? t : "sistema";
  } catch {
    return "sistema";
  }
}

const OPCIONES: { valor: Tema; icono: string; nombre: string }[] = [
  { valor: "claro", icono: "☀️", nombre: "Claro" },
  { valor: "oscuro", icono: "🌙", nombre: "Oscuro" },
  { valor: "sistema", icono: "🖥", nombre: "Igual que el dispositivo" },
];

/**
 * Vuelve a aplicar el tema al terminar de cargar: si React tuvo que redibujar la
 * página completa (p. ej. por un error de hidratación), la clase del <html> se pierde.
 */
export function TemaSync() {
  useEffect(() => {
    aplicar(leer());
  }, []);
  return null;
}

/** Selector de tema: claro, oscuro o igual que el dispositivo (se recuerda en este navegador). */
export function TemaToggle({ className = "" }: { className?: string }) {
  const [tema, setTema] = useState<Tema>("sistema");

  useEffect(() => {
    setTema(leer());
    // Si sigue al dispositivo, cambia solo cuando el celular/PC pasa a modo noche.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => leer() === "sistema" && aplicar("sistema");
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);

  function elegir(t: Tema) {
    setTema(t);
    try {
      localStorage.setItem("tema", t);
    } catch {
      // Sin almacenamiento (modo privado): aplica solo en esta visita.
    }
    aplicar(t);
  }

  return (
    <div className={`flex border rounded-lg overflow-hidden text-xs ${className}`} role="group" aria-label="Tema de la pantalla">
      {OPCIONES.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => elegir(o.valor)}
          title={o.nombre}
          aria-label={o.nombre}
          aria-pressed={tema === o.valor}
          className={`px-2 py-1 ${tema === o.valor ? "bg-brand-600 text-white" : "hover:bg-gray-50"}`}
        >
          {o.icono}
        </button>
      ))}
    </div>
  );
}
