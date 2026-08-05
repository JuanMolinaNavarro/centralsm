import "dotenv/config";
import { writeFileSync } from "node:fs";
import { abrirSesion } from "./finnegans-login";
import { PRODUCTOS_VIEW_URL, IFRAME_SELECTOR } from "./config";

// Diagnóstico: abre el alta de productos y vuelca los selectores REALES
// (nombres exactos de botones + estructura de los checkboxes). NO guarda nada.
//
//   docker compose exec app npx tsx scripts/playwright/inspeccionar-form.ts
//
// Salida: consola + scripts/playwright/resultados/form-dump.json + .png

async function main() {
  const { browser, page } = await abrirSesion({ headless: true });
  try {
    await page.goto(PRODUCTOS_VIEW_URL, { waitUntil: "domcontentloaded" });
    const f = page.frameLocator(IFRAME_SELECTOR);
    await f.getByRole("link", { name: "Nuevo" }).first().waitFor({ timeout: 30_000 });
    await f.getByRole("link", { name: "Nuevo" }).first().click();
    await page.waitForTimeout(3000);

    const frame = page.frames().find((x) => x.url().includes("appItem.jsp"));
    if (!frame) throw new Error("No encontré el iframe del formulario");

    // Se pasa como STRING: si se pasa como función, tsx/esbuild inyecta helpers
    // (__name) que no existen en el navegador y el evaluate revienta.
    const dump = (await frame.evaluate(`(() => {
      function visible(el) {
        var s = getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
      }

      // 1) Nombres EXACTOS de los links de acción (Guardar, Guardar y nuevo, ...)
      var links = [];
      document.querySelectorAll('a').forEach(function (a) {
        var t = (a.textContent || '').replace(/\\s+/g, ' ').trim();
        if (t && visible(a)) links.push(t);
      });

      // 2) Checkboxes: cómo están renderizados y qué etiqueta tienen al lado
      var checks = [];
      document.querySelectorAll('input[type="checkbox" i], input[type="checkBox"]').forEach(function (e) {
        var s = getComputedStyle(e);
        var label = null;
        var p = e.parentElement;
        for (var up = 0; up < 5 && p && !label; up++) {
          var t = (p.innerText || '').replace(/\\s+/g, ' ').trim();
          if (t && t.length < 40) label = t;
          p = p.parentElement;
        }
        checks.push({
          id: e.id || null,
          name: e.getAttribute('name'),
          cls: (e.className || '').toString().slice(0, 60) || null,
          display: s.display,
          visibility: s.visibility,
          tieneOffsetParent: e.offsetParent !== null,
          label: label,
          padreHtml: (e.parentElement ? e.parentElement.outerHTML : '').replace(/\\s+/g, ' ').slice(0, 200)
        });
      });

      // 3) Campos de texto: ¿tienen contenedor con name="wdg_*" como los checkboxes?
      var textos = [];
      document.querySelectorAll('input[type="textbox"], input[type="text"], textarea').forEach(function (e) {
        if (!visible(e)) return;
        var w = e.closest('.widget');
        var label = null;
        var p = e.parentElement;
        for (var up = 0; up < 5 && p && !label; up++) {
          var t = (p.innerText || '').replace(/\\s+/g, ' ').trim();
          if (t && t.length < 40) label = t;
          p = p.parentElement;
        }
        textos.push({
          widget: w ? w.getAttribute('name') : null,
          tabindex: e.getAttribute('tabindex'),
          required: e.getAttribute('required'),
          value: e.value || null,
          label: label
        });
      });

      return { url: location.href, links: links, checks: checks, textos: textos };
    })()`)) as {
      url: string;
      links: string[];
      checks: Array<Record<string, unknown>>;
      textos: Array<Record<string, unknown>>;
    };

    // Empresa/espacio activos (están en la página externa, no en el iframe)
    const contexto = (await page.evaluate(
      `document.body.innerText.slice(0, 300)`,
    )) as string;

    const out = "scripts/playwright/resultados/form-dump.json";
    writeFileSync(out, JSON.stringify({ ...dump, contexto }, null, 2), "utf8");
    await page.screenshot({ path: "scripts/playwright/resultados/form-dump.png", fullPage: true });

    console.log("== CAMPOS DE TEXTO ==");
    for (const t of dump.textos) console.log(JSON.stringify(t));
    console.log("\n== CHECKBOXES (widget / label) ==");
    for (const c of dump.checks) {
      if (c.tieneOffsetParent) console.log(JSON.stringify({ label: c.label, html: c.padreHtml }));
    }
    console.log(`\nDump completo en ${out}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
