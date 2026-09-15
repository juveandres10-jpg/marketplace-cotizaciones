import asyncio
from playwright.async_api import async_playwright
import pandas as pd
from datetime import datetime

TERMINOS_BUSQUEDA = [
    "talento humano",
    "recursos humanos",
    "comercial",
    "servicio al cliente"
]

BASE_URL = "https://co.computrabajo.com/trabajo-de-{termino}-en-cucuta"

async def recolectar_ofertas():
    vacantes_encontradas = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        for termino in TERMINOS_BUSQUEDA:
            termino_slug = termino.replace(" ", "-")
            url = BASE_URL.format(termino=termino_slug)
            print(f"[*] Buscando: {termino} en Cúcuta...")

            try:
                await page.goto(url, timeout=30000)
                await page.wait_for_timeout(2500)

                articulos = await page.query_selector_all("article.box_offer")

                for art in articulos:
                    titulo_elem = await art.query_selector("h1 a, h2 a")
                    titulo = await titulo_elem.inner_text() if titulo_elem else "Sin título"
                    enlace_rel = await titulo_elem.get_attribute("href") if titulo_elem else ""
                    enlace = f"https://co.computrabajo.com{enlace_rel}" if enlace_rel.startswith("/") else enlace_rel

                    empresa_elem = await art.query_selector("p.fs16 a, p.fs16 span")
                    empresa = await empresa_elem.inner_text() if empresa_elem else "Confidencial / No especificada"

                    fecha_elem = await art.query_selector("p.fs13.fc_aux")
                    fecha = await fecha_elem.inner_text() if fecha_elem else "Reciente"

                    vacantes_encontradas.append({
                        "Criterio": termino,
                        "Puesto": titulo.strip(),
                        "Empresa": empresa.strip(),
                        "Publicado": fecha.strip(),
                        "Enlace": enlace,
                        "Fecha_Extraccion": datetime.now().strftime("%Y-%m-%d %H:%M")
                    })

            except Exception as e:
                print(f"[!] Error al procesar '{termino}': {e}")
                continue

        await browser.close()

    if vacantes_encontradas:
        df = pd.DataFrame(vacantes_encontradas)
        df.drop_duplicates(subset=["Enlace"], inplace=True)
        archivo_salida = f"vacantes_cucuta_{datetime.now().strftime('%Y%m%d')}.csv"
        df.to_csv(archivo_salida, index=False, encoding="utf-8-sig")
        print(f"\n[✓] Extracción exitosa. {len(df)} vacantes guardadas en: {archivo_salida}")
    else:
        print("\n[-] No se encontraron vacantes bajo los criterios seleccionados.")

if __name__ == "__main__":
    asyncio.run(recolectar_ofertas())