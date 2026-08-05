# Cargar productos en Finnegans Go con Playwright

Guía para automatizar la **carga de productos** que terminan reflejándose en **Finnegans Go**
(el ERP en la nube al que se accede desde `services.finneg.com`).

> Contexto del repo: el maestro de productos vive en Finnegans/Teamplace. El pull (lectura) está en
> [`src/lib/teamplace.ts`](../src/lib/teamplace.ts) / [`docs/API-Teamplace-Finnegans.md`](./API-Teamplace-Finnegans.md).
> Esta guía cubre la **escritura** de productos hacia Finnegans, por la UI (Playwright) y por la API REST.

> 🚀 **¿Buscás la feature ya integrada en la app?** El alta desde CentralSM (formulario en
> `/productos/nuevo` que dispara el bot automáticamente) está documentada en
> **[`alta-productos-centralsm.md`](./alta-productos-centralsm.md)**. Este documento es la referencia
> técnica del flujo Playwright que esa feature usa por debajo.

---

## 0. Antes de empezar: ¿Playwright o API? (leer esto primero)

Hay **dos formas** de que un producto cargado desde CentralSM aparezca en Finnegans Go:

| | **A. API REST** (`POST /producto`) | **B. Playwright** (UI web) |
|---|---|---|
| Qué hace | Habla directo con la API de Finnegans | Simula a una persona usando el navegador |
| Robustez | Alta — contrato estable, documentado | Baja — se rompe si cambia el HTML/menú |
| Velocidad | Muy alta (miles de productos) | Lenta (segundos por producto) |
| Mantenimiento | Bajo | Alto (selectores, timeouts, popups) |
| Autenticación | `client_id` + `client_secret` (ya lo tenés) | Usuario + contraseña del portal |
| Ya está en el repo | Sí, el cliente lee; falta agregar el `POST` | No |
| Cuándo usarla | **Siempre que se pueda** | Solo si un dato **no** existe en la API, o para replicar acciones que la API no expone |

**Recomendación:** para cargar productos que se reflejen en Finnegans Go, usá la **API REST**
(sección [6](#6-vía-recomendada-carga-por-api-rest)). Es la vía oficial, ya la tenés documentada y
autenticada en el proyecto. Reservá **Playwright** (secciones 1–5) para casos donde la UI hace algo
que la API no permite, o para pruebas de humo end-to-end sobre la interfaz real.

Esta guía documenta **las dos**, empezando por Playwright porque es lo que pediste.

> **Nota sobre las credenciales.** El único paso que no puedo hacer yo es **tipear la contraseña**
> (mis reglas me lo impiden, aun con tu autorización). En esta sesión vos la escribiste en la ventana
> del navegador y desde ahí **yo recorrí y mapeé el flujo real** (sección 5). En los scripts, la clave
> se lee de una variable de entorno (`.env`, fuera de git) que **vos** cargás una vez; el script la
> tipea por vos, yo nunca la veo. Todo lo de la sección 5 (rutas, `viewID`, campos por `tabindex`)
> está **verificado en vivo** en tu instancia.

---

## 1. Instalar Playwright como librería

Playwright **no** está en el proyecto todavía. Se instala como dependencia de desarrollo:

```bash
# Desde la raíz del proyecto (C:\Users\Olart\OneDrive\Desktop\CentralSM)
npm i -D playwright
npx playwright install chromium
```

- `playwright` = la librería (API `chromium`, `page`, etc.). Usamos el paquete `playwright`
  (no `@playwright/test`) porque son **scripts de automatización**, no una suite de tests.
- `npx playwright install chromium` descarga el navegador que Playwright va a manejar.

Los scripts corren con `tsx`, igual que el resto del repo. Sumá estos atajos a `package.json`
(sección `scripts`):

```jsonc
{
  "scripts": {
    // ... los que ya tenés ...
    "fin:login":      "tsx scripts/playwright/finnegans-login.ts",
    "fin:inspeccionar":"tsx scripts/playwright/inspeccionar.ts",
    "fin:cargar-ui":  "tsx scripts/playwright/cargar-productos-ui.ts"
  }
}
```

---

## 2. Variables de entorno

Agregá a tu `.env` (y documentá los nombres en `.env.example`, **sin** valores):

```dotenv
# Login del portal web de Finnegans (solo para la vía Playwright / UI)
FINNEGANS_USER=impuestos@multireg.com.ar
FINNEGANS_PASSWORD=********
FINNEGANS_WORKSPACE=MULTIMEDIOS
FINNEGANS_LANG=Español
```

> `.env` ya está en `.gitignore`. **Nunca** hardcodees la contraseña en un `.ts`.

Para la **vía API** (sección 6) se usan las que ya tenés: `TEAMPLACE_CLIENT_ID`,
`TEAMPLACE_CLIENT_SECRET`, `TEAMPLACE_BASE_URL`, `TEAMPLACE_TOKEN_URL`.

---

## 3. El formulario de login (referencia real)

Inspeccioné el DOM de `https://services.finneg.com/login` en vivo. Estos son los selectores
**estables** (los IDs no cambian con el idioma):

| Campo | Selector recomendado | Detalle |
|-------|----------------------|---------|
| Usuario | `#loginname` | `<input name="userName">` |
| Contraseña | `#loginpassword` | `<input type="password" name="password">` |
| Espacio de Trabajo | `#logincompany` | `<input name="empresa">` |
| Idioma | `#loginlanguage` | `<select name="idioma">` (opciones: `Español`, `English`, `Português`, …) |
| Botón **Ingresar** | `input[name="standardSubmit"]` | `<input type="button">` (dispara el login por JS) |

> ⚠️ Ojo con `getByLabel('Contraseña')`: la página tiene además "Nueva contraseña" y
> "Confirmar contraseña" (para el cambio de clave), así que un match por texto es ambiguo.
> Por eso usamos los **IDs**, que son unívocos.

---

## 4. Helper de login reutilizable

Archivo: [`scripts/playwright/finnegans-login.ts`](../scripts/playwright/finnegans-login.ts)
(incluido en el repo). Exporta `login(page)` y `abrirSesion()` para reusar en cualquier script.

Probá que loguea:

```bash
npm run fin:login
```

Abre Chromium (visible), completa el formulario con tus credenciales de `.env`, presiona
**Ingresar** y confirma que salió de `/login`. Si algo falla (workspace mal escrito, clave
incorrecta), tira un error claro.

---

## 5. Cargar productos por la UI con Playwright (el bot)

Este flujo **lo recorrí y verifiqué en vivo** en tu instancia (`go.finneg.com`, workspace
`MULTIMEDIOS`, empresa "Tartagal Comunica…") el 2026-07-23. Lo que sigue son las rutas y selectores
**reales**, no genéricos. El bot está en [`scripts/playwright/`](../scripts/playwright/); toda la
config específica de tu instancia vive en [`config.ts`](../scripts/playwright/config.ts).

### 5.1. Cómo se llega al alta de productos (mapa real)

1. **Login** → tras entrar, la app queda en `https://go.finneg.com/home/externos`.
2. **Buscador global** (barra "Buscar…" arriba): escribí `producto` y Enter. Abre
   `…/buscador/global?filter=producto` con tiles de "Opciones de menú".
3. Click en el tile **"Productos"** → abre el maestro en
   **`https://go.finneg.com/mas/vista?viewID=104`** (título "Productos", **3194 registros** —
   coincide con la API 👍).
   > El `viewID=104` puede variar por workspace. Es la forma de saltar directo; el bot navega ahí.
4. En la grilla, barra de acciones: **Nuevo**, Imprimir, Eliminar, Administrar, Buscar.
   Click en **Nuevo** abre el formulario de alta.

### 5.2. El formulario de alta es un JSP legacy embebido (dato clave)

El listado y el formulario **no** son la SPA moderna de Go: son una app **JSP legacy de Teamplace**
servida dentro de un **`<iframe>`** desde
`teamplace.finneg.com/BSA/general/includes/appItem.jsp?appItem=104&viewID=104`.

Consecuencias para automatizar (todo verificado en vivo):

- Hay que operar **dentro del iframe**: en Playwright, `page.frameLocator('iframe')`.
- Los `<input>` **no tienen `id`, `name` ni `<label for>`** → `getByLabel` NO sirve.
- **Pero cada campo está envuelto en `<div class="widget" name="wdg_XXX">`.** Ese nombre es
  semántico y estable: es la llave correcta para automatizar (mejor que `tabindex`, que se corre
  si agregan o quitan campos).

**Mapa de campos verificado — pestaña "General"** (volcado con `inspeccionar-form.ts`):

| Campo | Widget contenedor | Requerido |
|-------|-------------------|-----------|
| Código | `wdg_Codigo` | **Sí** ⭐ |
| Nombre | `wdg_Nombre` | **Sí** ⭐ |
| Descripción | `wdg_Descripcion` | no |
| Tipo | `wdg_ProductoTipo` (default `Otros`) | **Sí** ⭐ |
| Peso | `wdg_Peso` | no |
| Volumen | `wdg_Volumen` | no |
| Rubro | `wdg_ProductoRubroID` | no |
| Marca | `wdg_Marca` | no |
| Familia | `wdg_ProductoFamiliaID` | no |
| SubFamilia | `wdg_ProductoSubFamiliaID` | no |

**Checkboxes** (mismo esquema): `wdg_activo`, `wdg_EsStockeable`, `wdg_SolapaSeVende`,
`wdg_SolapaSeCompra`, `wdg_SolapaManejaRetenciones`, `wdg_SolapaCodigoBarra` (Presentación),
`wdg_SolapaDistribuye`, `wdg_SolapaOtrosPaises`, `wdg_SolapaPrecios`.

> ⚠️ **Trampa:** existe un `#CKBox_first` que **no es** el "Activo" — es el checkbox de la cabecera
> de la grilla (`webix_hcell`), ni siquiera está en el layout del form. Usá `wdg_activo`.

La pestaña **"Config. Avanzada"** no tiene campos requeridos.

> ✅ **Mínimo real para crear un producto: Código + Nombre + Tipo** (y Tipo ya viene "Otros"). O sea,
> en la práctica alcanza con **Código y Nombre**.

**Guardar:** dentro del iframe los links visibles son, en orden:
`Nuevo, Guardar, Imprimir, Duplicar, Historial, Adjuntar, Tarea, Novedad, Comentario, Cerrar`
(barra superior) y `Guardar, Guardar y nuevo, Cerrar` (barra inferior).

> ⚠️ **Trampa crítica:** `getByRole('link', { name: 'Guardar' })` matchea **por substring**, así que
> también agarra **"Guardar y nuevo"**. Con `.last()` terminás apretando ese botón, que guarda y abre
> un formulario vacío → tu verificación falla aunque el alta haya funcionado.
> **Usá siempre `exact: true`.**

Selectores reales (así los usa el bot):

```ts
const frame = page.frameLocator('iframe');
const campo = (w: string) => frame.locator(`div.widget[name="${w}"] input`);

await frame.getByRole('link', { name: 'Nuevo', exact: true }).first().click();
await campo('wdg_Codigo').first().fill('DEMO-001');
await campo('wdg_Nombre').first().fill('Mi producto');
await campo('wdg_activo').first().check();          // Activo
// Tipo (wdg_ProductoTipo) ya vale "Otros" → no hace falta tocarlo

await frame.getByRole('link', { name: 'Guardar', exact: true }).last().click();
// Éxito = aparece "Eliminar" (solo existe en registros ya guardados)
await frame.getByRole('link', { name: 'Eliminar', exact: true }).first().waitFor();
```

> 💡 El form es legacy y hace postbacks: conviene una pausa (~2s) entre abrir el form, completar y
> guardar. El runner lo hace con `ESPERA_MS` (`FINNEGANS_PUSH_ESPERA_MS`, default 2000).

> ✅ **Verificado de punta a punta (2026-07-23):** creé el producto `DEMO-PW-001` completando
> solo Código + Nombre y presionando **Guardar**. Quedó persistido (aparece el botón "Eliminar" y se
> encuentra en la grilla). Señal fiable de "guardado OK": tras Guardar aparece el botón **"Eliminar"**
> (solo existe en registros ya guardados).
>
> ⚠️ **Ojo — se crea INACTIVO:** el producto quedó con **Activo = NO** y **Stockeable = NO** porque no
> tildé esos checkboxes. Si querés que nazca activo/stockeable, hay que marcar los checkboxes
> **"Activo"** / **"Es Stockeable"**. Estos checkboxes del form legacy no tienen `tabindex`; el primero
> ("Activo") es `#CKBox_first`. Para marcarlos con Playwright:
> `await frame.locator('#CKBox_first').check()` (validá el selector con `inspeccionar.ts`).

### 5.3. Correr el bot

El bot ([`cargar-productos-ui.ts`](../scripts/playwright/cargar-productos-ui.ts)) navega al maestro,
abre "Nuevo", completa por `tabindex` dentro del iframe y usa **"Guardar y nuevo"** para encadenar.
Lee JSON o CSV, reutiliza la sesión, saca captura ante error y deja un reporte.

```bash
# 1) instalar Playwright (una vez)  →  ver sección 1
# 2) cargar credenciales en .env    →  ver sección 2

# DRY-RUN: completa cada form y lo cierra SIN guardar (valida selectores sin crear datos)
tsx scripts/playwright/cargar-productos-ui.ts scripts/playwright/productos.example.json --dry-run

# Real: crea los productos
tsx scripts/playwright/cargar-productos-ui.ts scripts/playwright/productos.example.csv
tsx scripts/playwright/cargar-productos-ui.ts mis-productos.json --headless
```

Empezá **siempre con `--dry-run`** y 1–2 productos, mirando la ventana (sin `--headless`).

### 5.4. Alternativa más robusta dentro de la UI: importación masiva por Excel

Finnegans Go tiene **Inventarios → Importación masiva de productos** (subís un Excel y crea todos de
una). Para un bot es más sólido que rellenar el form N veces: se automatiza navegando a esa pantalla,
usando `page.setInputFiles('input[type=file]', 'productos.xlsx')` y confirmando. Si te sirve, se arma
la variante sobre ese flujo. Ref: <https://bc.finneg.com/t/importacion-masiva-de-productos/4590>.

### 5.5. Buenas prácticas para la vía UI

- **Idempotencia:** antes de crear, buscá el código; si ya existe, editá en vez de duplicar.
- **Esperas por estado, no por tiempo:** usá `await page.waitForSelector(...)` /
  `expect(locator).toBeVisible()` en lugar de `waitForTimeout` fijo.
- **Un producto por transacción:** si uno falla, seguí con el resto y registrá el error; no cortes todo.
- **`headless: false` mientras desarrollás** (para ver qué pasa), `true` en producción.
- **Reutilizá la sesión:** logueá una vez y cargá los N productos en el mismo `page` (no re-loguees por producto).
- **Rate limit:** meté una pausa corta entre altas para no saturar la UI.

---

## 6. Vía recomendada: carga por API REST

Esta es la forma robusta de "cargar productos que se carguen en Finnegans Go". El endpoint ya está
documentado en [`docs/API-Teamplace-Finnegans.md` §3.1](./API-Teamplace-Finnegans.md). Solo falta
agregar la función de escritura al cliente (hoy es de solo lectura).

### 6.1. Extender el cliente con `crearProducto` / `upsertProducto`

Sumá esto a [`src/lib/teamplace.ts`](../src/lib/teamplace.ts) (reutiliza `getToken()` y el manejo de
token que ya tiene). Es un `POST`/`PUT` con el token en query string, igual que los `GET`:

```ts
// --- agregar en src/lib/teamplace.ts ---

/** ProductoVO mínimo. Ampliá según docs/API-Teamplace-Finnegans.md §3.6. */
export type ProductoVO = {
  Codigo: string;
  Nombre: string;
  Descripcion?: string;
  Activo?: boolean;
  EsStockeable: boolean;
  ManejaStockOrganizaciones: boolean;
  NoControlaStock: number;      // 0 = controla stock, 1 = no
  UtilizaPartidas: boolean;
  UtilizaNumerosSerie: boolean;
  MonedaCodigo?: string;        // ej. "PES"  (requerido si EsStockeable)
  UnidadCodigoStock1?: string;  // ej. "UNI"  (requerido si EsStockeable)
  ConceptoCodigoLogistica?: string;
  ProductoFamiliaCodigo?: string;
  Depositos: unknown[];
  ComposicionKit: unknown[];
  ProductoProveedor: unknown[];
  Retenciones: unknown[];
  Dimensiones: unknown[];
  "Codigo de Barras": unknown[];
  "Tasas Impositivas": unknown[];
};

/** Helper interno para POST/PUT con ACCESS_TOKEN en la query (mismo estilo que apiGet). */
async function apiWrite<T>(
  method: "POST" | "PUT",
  path: string,
  body: unknown,
  _retry = false,
): Promise<T> {
  const { baseUrl } = cfg();
  const token = await getToken();
  const url = `${baseUrl}${path}?ACCESS_TOKEN=${encodeURIComponent(token)}`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const raw = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }

  const errorMsg =
    data && typeof data === "object" && "error" in data
      ? String((data as { error: unknown }).error)
      : null;

  if (!_retry && errorMsg && /invalid token/i.test(errorMsg)) {
    await getToken(true);
    return apiWrite<T>(method, path, body, true);
  }
  if (!res.ok || errorMsg) {
    throw new Error(`Teamplace ${method} ${path} falló: ${errorMsg ?? res.status}`);
  }
  return data as T;
}

/** Crea un producto en Finnegans. Respuesta: { status: "created" }. */
export function crearProducto(p: ProductoVO) {
  return apiWrite<{ status: string }>("POST", "/producto", p);
}

/** Crea o actualiza (upsert) por código. Respuesta: { status: "created" | "updated" }. */
export function upsertProducto(p: ProductoVO) {
  return apiWrite<{ status: string }>(
    "PUT",
    `/producto/${encodeURIComponent(p.Codigo)}?createIfNotExists=1`,
    p,
  );
}
```

> El `apiGet` original ya usa exactamente este patrón (token en query, reintento ante `invalid token`);
> `apiWrite` es su gemelo para escritura. Ver [`teamplace.ts:47`](../src/lib/teamplace.ts).

### 6.2. Script de carga masiva por API (desde CSV/JSON)

```ts
// scripts/teamplace-crear-productos.ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { upsertProducto, type ProductoVO } from "../src/lib/teamplace";

// Rellena los campos obligatorios que sean fijos para tu operación.
function aProductoVO(row: { codigo: string; nombre: string; descripcion?: string }): ProductoVO {
  return {
    Codigo: row.codigo,
    Nombre: row.nombre,
    Descripcion: row.descripcion ?? "",
    Activo: true,
    EsStockeable: true,
    ManejaStockOrganizaciones: false,
    NoControlaStock: 0,
    UtilizaPartidas: false,
    UtilizaNumerosSerie: false,
    MonedaCodigo: "PES",
    UnidadCodigoStock1: "UNI",
    ConceptoCodigoLogistica: "MERCADERIA",
    ProductoFamiliaCodigo: "FERRETERIA",
    Depositos: [],
    ComposicionKit: [],
    ProductoProveedor: [],
    Retenciones: [],
    Dimensiones: [],
    "Codigo de Barras": [],
    "Tasas Impositivas": [],
  };
}

async function main() {
  const path = process.argv[2] ?? "scripts/playwright/productos.example.json";
  const rows: Array<{ codigo: string; nombre: string; descripcion?: string }> =
    JSON.parse(readFileSync(path, "utf8"));

  let ok = 0;
  for (const row of rows) {
    try {
      const r = await upsertProducto(aProductoVO(row));
      console.log(`✔ ${row.codigo} → ${r.status}`);
      ok++;
    } catch (e) {
      console.error(`✖ ${row.codigo}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`\nListo: ${ok}/${rows.length} productos cargados.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Correr:

```bash
tsx scripts/teamplace-crear-productos.ts scripts/playwright/productos.example.json
```

> Los códigos referenciados (`UnidadCodigoStock1`, `MonedaCodigo`, `ProductoFamiliaCodigo`,
> `DepositoCodigo`, etc.) **deben existir** en Finnegans. Si no existen, el `POST` falla. Las APIs
> de listado para descubrirlos están en [`docs/API-Teamplace-Finnegans.md` §3.7](./API-Teamplace-Finnegans.md).

---

## 7. Verificar que el producto llegó a Finnegans Go

Después de cargar (por cualquier vía), confirmá contra la **misma** API que ya usás para leer:

```bash
# ¿Aparece en el listado?
npm run teamplace:ping

# Detalle de uno puntual (ajustá el código)
curl "https://api.teamplace.finneg.com/api/producto/PROD001?ACCESS_TOKEN=TU_TOKEN"
```

O desde código, con el cliente existente:

```ts
import { getProducto } from "../src/lib/teamplace";
console.log(await getProducto("PROD001"));
```

Y en la UI de Finnegans Go: módulo de **Artículos/Productos**, buscá por código. El producto cargado
por API y el cargado por UI son el **mismo** registro del maestro.

Para bajarlo a la base local de CentralSM, corré tu sync habitual:

```bash
npm run teamplace:sync
```

---

## 8. Recomendación final

1. **Para carga real de productos → usá la API** (sección 6). Es rápida, robusta, idempotente
   (`upsertProducto`) y ya encaja con el cliente y los env vars del proyecto.
2. **Usá Playwright** (secciones 1–5) solo si necesitás automatizar algo que la API **no** expone,
   o para un smoke-test de la interfaz. Es más frágil y lento.
3. Sea cual sea la vía, **cerrá el círculo** con `teamplace:sync` para que CentralSM refleje lo cargado.

---

## 9. Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| Playwright: sigue en `/login` tras enviar | Workspace/clave incorrectos, o carga lenta | Revisá `.env`; subí el timeout de `waitForURL` |
| Playwright: "selector not found" en el alta | El HTML de tu instancia difiere | Regrabá con `npx playwright codegen` (sección 5.1) |
| API: `credentials not found` al pedir token | `CLIENT_ID`/`SECRET` mal | Regenerá las keys en Teamplace → Configuración → Seguridad → Usuarios → "Keys API" |
| API `POST`: falla por código inexistente | `Unidad`/`Moneda`/`Familia`/`Deposito` no existen | Creálos primero o usá códigos válidos (APIs de listado, §3.7) |
| API `POST`: `invalid token` | Token vencido | El cliente reintenta solo una vez; si persiste, verificá reloj/credenciales |

---

### Archivos de esta guía

- [`scripts/playwright/README.md`](../scripts/playwright/README.md) — guía operativa del bot (empezá acá).
- [`scripts/playwright/config.ts`](../scripts/playwright/config.ts) — **el único archivo a editar**: selectores de tu instancia.
- [`scripts/playwright/finnegans-login.ts`](../scripts/playwright/finnegans-login.ts) — login (selectores reales) + sesión persistida.
- [`scripts/playwright/inspeccionar.ts`](../scripts/playwright/inspeccionar.ts) — descubre los selectores del alta post-login.
- [`scripts/playwright/cargar-productos-ui.ts`](../scripts/playwright/cargar-productos-ui.ts) — el bot: carga por UI con reintentos y reporte.
- [`scripts/playwright/productos.example.json`](../scripts/playwright/productos.example.json) · [`.csv`](../scripts/playwright/productos.example.csv) — datos de ejemplo.
- [`docs/API-Teamplace-Finnegans.md`](./API-Teamplace-Finnegans.md) — referencia completa de la API (vía alternativa).
