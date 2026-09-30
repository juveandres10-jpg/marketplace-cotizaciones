// Datos fijos del análisis creativo, sin dependencias de servidor (los usa también la interfaz).

export const FACTORES_CREATIVOS = [
  "Detiene el scroll",
  "Claridad del mensaje",
  "Composición y jerarquía",
  "Legibilidad en celular",
  "Emoción y aspiración",
  "Relevancia local",
  "Llamado a la acción",
  "Coherencia de marca",
] as const;

/** Herramientas creativas con IA recomendables (la IA solo puede elegir de esta lista). */
export const HERRAMIENTAS_CREATIVAS = {
  "Canva Magic Studio": "https://www.canva.com/magic/",
  "Adobe Firefly": "https://firefly.adobe.com/",
  "Adobe Express": "https://www.adobe.com/express/",
  "Photoshop (Relleno generativo)": "https://www.adobe.com/products/photoshop/generative-fill.html",
  Ideogram: "https://ideogram.ai/",
  Midjourney: "https://www.midjourney.com/",
  "Magnific (mejorar resolución)": "https://magnific.ai/",
  CapCut: "https://www.capcut.com/",
  Runway: "https://runwayml.com/",
  "Kling AI": "https://klingai.com/",
  "Luma Dream Machine": "https://lumalabs.ai/dream-machine",
  "Meta Advantage+ creativo": "https://www.facebook.com/business/ads/meta-advantage-plus/creative",
} as const;
