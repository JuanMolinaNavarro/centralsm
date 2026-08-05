# Worker de Finnegans

Microservicio que da de alta productos nuevos en Finnegans Go con Playwright.

## Cómo funciona (DB-as-queue)

La app Next.js **no** habla con este proceso: solo inserta filas en la tabla
`FinnegansPushJob` (Postgres) en estado `PENDIENTE` — eso hace
`lanzarPushFinnegans` en `src/lib/finnegans-push.ts`. Este worker hace polling
de esa tabla, reclama los jobs de a uno y los procesa con el bot de
`scripts/playwright/push-producto.ts`. La UI consulta la misma tabla vía
`GET /api/finnegans-push/[jobId]`.

```
[app Next.js] --INSERT PENDIENTE--> [Postgres: FinnegansPushJob] <--polling-- [worker]
```

Estados del job:

| Estado | Quién lo escribe | Significado |
|---|---|---|
| `PENDIENTE` | app | encolado, esperando al worker |
| `EN_PROCESO` | worker (claim atómico) | el bot está corriendo el alta |
| `SINCRONIZADO` | worker | producto creado en Finnegans |
| `ERROR` | worker (o timeout de la UI) | falló; ver `error` y la captura |

El claim `PENDIENTE → EN_PROCESO` es un `updateMany` condicionado por estado:
si dos consumidores compiten, solo uno gana. Se procesa **de a un job** (Chromium
es pesado y la sesión cacheada del bot no se comparte).

## Correr local (fuera de Docker)

```bash
npm run worker
```

Necesita en `.env`: `DATABASE_URL` (local: `localhost:5433`) y las credenciales
del bot `FINNEGANS_USER/PASSWORD/WORKSPACE` (+ opcionales, ver abajo).

Para depurar un job puntual sin levantar el loop:

```bash
npx tsx scripts/playwright/push-producto.ts <jobId>
```

(solo funciona si el job está `PENDIENTE`: el CLI hace el mismo claim que el worker).

## Variables de entorno

| Variable | Default | Qué hace |
|---|---|---|
| `DATABASE_URL` | — | Postgres con la tabla `FinnegansPushJob` |
| `FINNEGANS_USER` / `FINNEGANS_PASSWORD` / `FINNEGANS_WORKSPACE` | — | login del bot |
| `FINNEGANS_LANG` | `Español` | idioma del login |
| `FINNEGANS_PRODUCTOS_URL` | vista 104 | maestro de Productos |
| `FINNEGANS_PUSH_HEADLESS` | `true` (salvo `"false"`) | Chromium sin ventana |
| `FINNEGANS_PUSH_ESPERA_MS` | `2000` | pausa entre acciones del form legacy |
| `FINNEGANS_STATE_PATH` | `scripts/playwright/.auth/finnegans-state.json` | sesión cacheada (efímera: si se pierde, re-loguea solo) |
| `FINNEGANS_RESULTADOS_DIR` | `scripts/playwright/resultados` | capturas de errores |
| `WORKER_POLL_MS` | `4000` | intervalo de polling de la cola |
| `WORKER_JOB_TIMEOUT_MS` | `300000` (5 min) | timeout duro por job |

## Ciclo de vida y fallos

- **SIGTERM/SIGINT** (docker stop, `kubectl rollout restart`): si está idle sale
  al instante; si hay un job en curso lo termina y recién ahí sale. En k8s,
  `terminationGracePeriodSeconds` debe dar margen (usamos 180 s).
- **Huérfanos**: al arrancar, todo job `EN_PROCESO` viene de una corrida que
  murió → se marca `ERROR` con aviso. **No** se reintenta automático: el alta
  pudo haberse completado en Finnegans y reintentarla duplicaría el producto.
  El reintento es el botón "Reintentar" en `/productos`, previa verificación.
- **Timeout**: además del timeout duro del worker, la UI (`getPushJob`) marca
  `ERROR` a los 10 min a un job que nadie atendió (worker caído).

## Evolución futura

Si algún día hacen falta prioridades, delays, reintentos automáticos o varios
tipos de job, el paso natural es una cola real (BullMQ + Redis) o el patrón
`SELECT ... FOR UPDATE SKIP LOCKED` con N réplicas. Hoy sería sobre-ingeniería.
