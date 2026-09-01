# Bot de alta de productos por UI (Playwright)

Automatiza el alta de productos en **Finnegans Go** manejando el navegador (no la API).
El flujo está **verificado en vivo** (workspace `MULTIMEDIOS`, 2026-07-23): login, navegación al
maestro de Productos y llenado del formulario de alta. Ver detalle en
[`../../docs/carga-productos-playwright.md`](../../docs/carga-productos-playwright.md) §5.

> ¿Por qué por UI y no por API? La API (`POST /producto`) es más robusta y rápida. Este bot es para
> cuando querés/necesitás hacerlo por la interfaz. El form de alta es un **JSP legacy en un iframe**
> con campos sin `id`/`name` (se targetean por `tabindex`), así que es más frágil que la API.

El consumidor real es el **worker** (`worker/index.ts`): la app encola `FinnegansPushJob` y el worker
procesa los jobs de a uno con `push-producto.ts`. (Existió un bot batch `cargar-productos-ui.ts`
para cargar lotes desde JSON/CSV; se eliminó por falta de uso — está en el historial de git.)

## Instalación (una vez)

```bash
npm i -D playwright
npx playwright install chromium
```

`.env` (ya gitigneado):

```dotenv
FINNEGANS_USER=usuario@empresa.com.ar
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

# Procesar un job puntual de la cola sin levantar el worker (debe estar PENDIENTE)
tsx scripts/playwright/push-producto.ts <jobId>

# El loop completo es el worker:
npm run worker
```

## Qué hace el bot

- Login + **sesión persistida** en `.auth/` (reutiliza cookies; si vencen, re-loguea solo).
- Navega directo a `PRODUCTOS_VIEW_URL` (el maestro), abre **Nuevo** dentro del iframe.
- Completa **Código** (`tabindex 0`) y **Nombre** (`tabindex 2`) — el mínimo real (Tipo ya es "Otros").
  Campos opcionales (peso, volumen, y los F4: rubro/marca/familia…) si vienen en el dato.
- Ante error saca captura en `resultados/` y marca el job `ERROR`.

## Archivos

| Archivo | Qué es |
|---------|--------|
| `config.ts` | URLs + mapa de campos por `tabindex` (**verificado**) + textos de botones |
| `finnegans-login.ts` | Login (selectores verificados) + sesión persistida |
| `push-producto.ts` | El bot vigente: procesa un `FinnegansPushJob` (lo importa el worker) |
| `inspeccionar.ts` / `inspeccionar-form.ts` | Fallback: si Finnegans cambia el form, re-descubren selectores |

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
