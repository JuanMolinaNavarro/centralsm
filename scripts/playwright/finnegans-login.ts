import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { APP_URL, STORAGE_STATE_PATH } from "./config";

// Login del portal web de Finnegans (services.finneg.com) con Playwright.
// Requiere: npm i -D playwright && npx playwright install chromium
// Doc: docs/carga-productos-playwright.md
//
// Los selectores del login fueron verificados sobre el DOM real de
// services.finneg.com/login (IDs estables, no cambian con el idioma).
// El script lee la contraseña del entorno (.env). Nunca la hardcodees.

const LOGIN_URL = "https://services.finneg.com/login";

/** Credenciales del portal. Se leen del entorno (.env, fuera de git). */
function credenciales() {
  const usuario = process.env.FINNEGANS_USER;
  const password = process.env.FINNEGANS_PASSWORD;
  const workspace = process.env.FINNEGANS_WORKSPACE;
  if (!usuario || !password || !workspace) {
    throw new Error(
      "Faltan FINNEGANS_USER / FINNEGANS_PASSWORD / FINNEGANS_WORKSPACE en el entorno (.env).",
    );
  }
  return { usuario, password, workspace, idioma: process.env.FINNEGANS_LANG ?? "Español" };
}

/**
 * Rellena y envía el formulario de login (selectores verificados en vivo):
 *   #loginname      → Usuario         (<input name="userName">)
 *   #loginpassword  → Contraseña      (<input type="password" name="password">)
 *   #logincompany   → Esp. de Trabajo (<input name="empresa">)
 *   #loginlanguage  → Idioma          (<select name="idioma">)
 *   input[name="standardSubmit"] → botón "Ingresar"
 */
export async function login(page: Page): Promise<void> {
  const { usuario, password, workspace, idioma } = credenciales();

  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

  await page.fill("#loginname", usuario);
  await page.fill("#loginpassword", password);
  await page.fill("#logincompany", workspace);
  await page.selectOption("#loginlanguage", { label: idioma });

  await page.click('input[name="standardSubmit"]');

  try {
    await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 30_000 });
  } catch {
    throw new Error(
      "El login no avanzó (seguimos en /login). Revisá usuario, contraseña y espacio de trabajo.",
    );
  }
}

type SesionOpts = {
  headless?: boolean;
  /** Ignora la sesión cacheada y fuerza un login nuevo. */
  forceLogin?: boolean;
  statePath?: string;
};

/**
 * Abre un browser con sesión lista para operar.
 * Reutiliza la sesión cacheada (storageState) si existe y sigue viva; si venció,
 * re-loguea y la regraba. Devuelve { browser, context, page }.
 */
export async function abrirSesion(opts: SesionOpts = {}) {
  const headless = opts.headless ?? false;
  const statePath = opts.statePath ?? STORAGE_STATE_PATH;

  const browser: Browser = await chromium.launch({ headless });
  const puedeReusar = !opts.forceLogin && existsSync(statePath);
  const context: BrowserContext = await browser.newContext(
    puedeReusar ? { storageState: statePath } : {},
  );
  const page = await context.newPage();

  if (puedeReusar) {
    // Validamos que la sesión siga viva; si nos manda a /login, re-logueamos.
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    if (page.url().includes("/login")) {
      await login(page);
      await guardarEstado(context, statePath);
    }
  } else {
    await login(page);
    await guardarEstado(context, statePath);
  }

  return { browser, context, page };
}

async function guardarEstado(context: BrowserContext, statePath: string) {
  await mkdir(dirname(statePath), { recursive: true });
  await context.storageState({ path: statePath });
}

// Ejecución directa: `tsx scripts/playwright/finnegans-login.ts`
// Loguea, guarda la sesión y muestra la URL final (útil para completar APP_URL en config.ts).
if (process.argv[1]?.replace(/\\/g, "/").endsWith("finnegans-login.ts")) {
  abrirSesion({ headless: false, forceLogin: true })
    .then(async ({ browser, page }) => {
      console.log("✔ Login OK. URL actual:", page.url());
      console.log("  Sesión guardada en:", STORAGE_STATE_PATH);
      console.log("  → Copiá esa URL a APP_URL en config.ts si difiere.");
      await page.waitForTimeout(4000);
      await browser.close();
    })
    .catch((e) => {
      console.error("Error:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
