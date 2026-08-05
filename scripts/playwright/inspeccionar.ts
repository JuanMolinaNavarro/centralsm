import "dotenv/config";
import { writeFileSync } from "node:fs";
import type { Frame } from "playwright";
import { abrirSesion } from "./finnegans-login";
import { PRODUCTOS_VIEW_URL } from "./config";

// Fallback: re-descubre los selectores del formulario de alta si Finnegans lo cambia.
// El form vive en un iframe legacy (teamplace.finneg.com/.../appItem.jsp) cuyos inputs
// se identifican por `tabindex`. Este script vuelca ese mapa.
//
// Uso:
//   tsx scripts/playwright/inspeccionar.ts
//     → abre el maestro de Productos, hacé click en "Nuevo" A MANO, volvé a la
//       terminal, ENTER, y vuelca los campos del form (tabindex, tipo, required).
//
// Salida: consola + scripts/playwright/selectores-descubiertos.json + captura .png

function frameLegacy(frames: Frame[]) {
  return frames.find((f) => f.url().includes("appItem.jsp")) ?? null;
}

async function volcarCampos(frame: Frame) {
  return frame.evaluate(() => {
    const visible = (el: Element) => {
      const s = getComputedStyle(el as HTMLElement);
      return s.display !== "none" && s.visibility !== "hidden" && (el as HTMLElement).offsetParent !== null;
    };
    const out: Array<Record<string, unknown>> = [];
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      const e = el as HTMLInputElement;
      if (!visible(el)) return;
      const type = e.getAttribute("type");
      if (type === "hidden") return;
      out.push({
        tag: e.tagName.toLowerCase(),
        type,
        tabindex: e.getAttribute("tabindex"),
        required: e.getAttribute("required") ?? undefined,
        value: e.value || undefined,
        width: (e.style && e.style.width) || undefined,
      });
    });
    return { url: location.href, campos: out };
  });
}

async function esperarEnter(msg: string) {
  process.stdout.write(msg);
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.pause();
      resolve();
    });
  });
}

async function main() {
  const { browser, page } = await abrirSesion({ headless: false });
  await page.goto(PRODUCTOS_VIEW_URL, { waitUntil: "domcontentloaded" });

  await esperarEnter(
    "\n👉 En la ventana: click en 'Nuevo' para abrir el formulario de alta,\n" +
      "   luego presioná ENTER acá para volcar los campos...\n",
  );

  const frame = frameLegacy(page.frames());
  if (!frame) {
    console.error("No encontré el iframe legacy (appItem.jsp). ¿Abriste el formulario 'Nuevo'?");
    await browser.close();
    process.exit(1);
  }

  const data = await volcarCampos(frame);
  const outJson = "scripts/playwright/selectores-descubiertos.json";
  const outPng = "scripts/playwright/selectores-descubiertos.png";
  writeFileSync(outJson, JSON.stringify(data, null, 2), "utf8");
  await page.screenshot({ path: outPng, fullPage: true });

  console.log(`\n✔ Frame: ${data.url}`);
  console.log(`✔ Campos visibles: ${data.campos.length}`);
  console.table(data.campos);
  console.log(`\n📄 Detalle en ${outJson}  ·  🖼  Captura en ${outPng}`);
  console.log("   → Actualizá el mapa CAMPOS (por tabindex) en config.ts si cambió el orden.");

  await browser.close();
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
