# Bot de carga de productos por UI (Playwright)

Automatiza la carga de productos en **Finnegans Go** manejando el navegador (no la API).
El flujo está **verificado en vivo** (workspace `MULTIMEDIOS`, 2026-07-23): login, navegación al
maestro de Productos y llenado del formulario de alta. Ver detalle en
[`../../docs/carga-productos-playwright.md`](../../docs/carga-productos-playwright.md) §5.

> ¿Por qué por UI y no por API? La API (`POST /producto`) es más robusta y rápida. Este bot es para
> cuando querés/necesitás hacerlo por la interfaz. El form de alta es un **JSP legacy en un iframe**
> con campos sin `id`/`name` (se targetean por `tabindex`), así que es más frágil que la API.

## Instalación (una vez)

```bash
npm i -D playwright
npx playwright install chromium
```

`.env` (ya gitigneado):

```dotenv
FINNEGANS_USER=impuestos@multireg.com.ar
FINNEGANS_PASSWORD=********
FINNEGANS_WORKSPACE=MULTIMEDIOS
FINNEGANS_LANG=Español
# opcionales:
# FINNEGANS_APP_URL=https://go.finneg.com/home/externos
# FINNEGANS_PRODUCTOS_URL=https://go.finneg.com/mas/vista?viewID=104
```

## Correr

```bash
# Probar solo el login (abre el navegador y guarda la sesión)
tsx scripts/playwright/finnegans-login.ts

# DRY-RUN: completa cada form y lo cierra SIN guardar (valida sin crear datos)
tsx scripts/playwright/cargar-productos-ui.ts scripts/playwright/productos.example.json --dry-run

# Real: crea los productos
tsx scripts/playwright/cargar-productos-ui.ts scripts/playwright/productos.example.csv
tsx scripts/playwright/cargar-productos-ui.ts mis-productos.json --headless
```

**Empezá siempre con `--dry-run` y 1–2 productos, sin `--headless`**, para ver qué hace. El guardado
real (`Guardar y nuevo`) no lo probé contra tu ERP productivo: validalo en la primera corrida.

## Qué hace el bot

- Login + **sesión persistida** en `.auth/` (reutiliza cookies; si vencen, re-loguea solo).
- Navega directo a `PRODUCTOS_VIEW_URL` (el maestro), abre **Nuevo** dentro del iframe.
- Completa **Código** (`tabindex 0`) y **Nombre** (`tabindex 2`) — el mínimo real (Tipo ya es "Otros").
  Campos opcionales (peso, volumen, y los F4: rubro/marca/familia…) si vienen en el dato.
- Encadena con **"Guardar y nuevo"**; ante error saca captura y sigue con el resto.
- Reporte final en `resultados/resultado-<timestamp>.json`.

## Formato de entrada (JSON o CSV)

Mínimo: `codigo` y `nombre`. Opcionales: `descripcion`, `tipo`, `peso`, `volumen`, `rubro`, `marca`,
`familia`, `subfamilia`. Ver [`productos.example.json`](./productos.example.json) / [`.csv`](./productos.example.csv).

## Archivos

| Archivo | Qué es |
|---------|--------|
| `config.ts` | URLs + mapa de campos por `tabindex` (**verificado**) + textos de botones |
| `finnegans-login.ts` | Login (selectores verificados) + sesión persistida |
| `cargar-productos-ui.ts` | El bot: alta por form dentro del iframe, con reporte |
| `inspeccionar.ts` | Fallback: si Finnegans cambia el form, re-descubre selectores |
| `productos.example.json` / `.csv` | Datos de ejemplo |

## Si Finnegans cambia el formulario

Los `tabindex` podrían correrse si agregan/quitan campos. Para re-mapear: abrí el alta a mano y usá
`npx playwright codegen https://go.finneg.com/mas/vista?viewID=104`, o corré `inspeccionar.ts` y
mirá el orden de los `input[type="textbox"]`. Actualizá `CAMPOS` en `config.ts`.

## Alternativa más robusta dentro de la UI: importación masiva por Excel

Finnegans Go tiene **Inventarios → Importación masiva de productos** (subís un Excel y crea todos de
una). Se automatiza igual con Playwright (`setInputFiles`) y es menos frágil que el form uno por uno.
Ref: <https://bc.finneg.com/t/importacion-masiva-de-productos/4590>

## Notas

- La contraseña se lee del `.env`; nunca la hardcodees.
- `.auth/`, `resultados/` y `selectores-descubiertos.*` están en `.gitignore` (la sesión = cookies).
