# Kubernetes desde cero, con el worker de CentralSM

Esta carpeta es tu campo de práctica de Kubernetes (k8s). El plan: desplegar el
worker de Finnegans (`Dockerfile.worker`) en un cluster local, mientras la app
y la base de datos siguen corriendo en docker-compose como siempre. El worker
del cluster lee la misma tabla de Postgres, así que **todo sigue funcionando
igual** — solo cambia quién procesa los jobs.

```
[compose: app :3100] --INSERT--> [compose: db :5433] <--polling-- [k8s: pod finnegans-worker]
                                          ↑ host.docker.internal:5433
```

## Glosario mínimo (los 6 conceptos que necesitás)

| Concepto | Qué es | Analogía compose |
|---|---|---|
| **Pod** | La unidad mínima de ejecución: uno o más contenedores que viven y mueren juntos. Casi siempre = 1 contenedor. | un contenedor |
| **Deployment** | "Quiero N réplicas de este pod, siempre." Si un pod muere, crea otro. Maneja también los redeploys. | `restart: unless-stopped`, con esteroides |
| **Service** | Nombre DNS + IP estable delante de un grupo de pods (los pods son efímeros y cambian de IP). El worker no lo necesita: nadie le habla, él sale a buscar trabajo. | el nombre de servicio (`db`) en la red de compose |
| **ConfigMap** | Config no sensible como recurso del cluster, inyectable como env vars. | el bloque `environment:` |
| **Secret** | Igual pero para credenciales. ⚠️ Base64 NO es cifrado — es solo encoding. | las vars que vienen de `.env` |
| **Namespace** | Carpeta lógica para agrupar recursos. Usamos `centralsm`. | un proyecto de compose |

La idea central de k8s: **vos declarás el estado deseado** (archivos YAML) y el
cluster trabaja continuamente para que la realidad coincida. No le das órdenes
("ejecutá esto"), le das un objetivo ("que siempre haya 1 worker corriendo").

## Paso 0 — Levantar el cluster

1. Docker Desktop → Settings → **Kubernetes** → Enable Kubernetes → Apply.
   (En Settings → Resources, dale al menos ~6 GB de RAM a Docker Desktop: el
   cluster de base consume 1-2 GB y el worker con Chromium pide lo suyo.)

   > ⚠️ Aplicar esto **reinicia Docker Desktop** y tumba todos los contenedores
   > de compose (mordió de verdad: el pod arrancaba en CrashLoopBackOff con
   > "Can't reach database server" porque la DB había quedado abajo). Después
   > de habilitar Kubernetes: `docker compose up -d`.
2. Verificá:

```bash
kubectl get nodes
```

Deberías ver un nodo `docker-desktop` en estado `Ready`. `kubectl` es tu única
herramienta: todo lo que hagas en k8s pasa por ahí.

3. Calentamiento (tu primer pod, nada que ver con CentralSM):

```bash
kubectl run test --image=nginx
```

```bash
kubectl get pods
```

```bash
kubectl delete pod test
```

## Paso 1 — Construir la imagen del worker

```bash
docker build -f Dockerfile.worker -t centralsm-worker:0.1 .
```

Ventaja clave de Docker Desktop para aprender: su Kubernetes **comparte el
daemon de Docker**, así que esta imagen local ya es visible para el cluster sin
registry ni push (con kind o minikube habría que cargarla a mano). Por eso el
deployment usa `imagePullPolicy: IfNotPresent`.

## Paso 2 — Namespace, ConfigMap y Secret

```bash
kubectl apply -f k8s/00-namespace.yaml
```

```bash
kubectl apply -f k8s/worker/configmap.yaml
```

El Secret con las credenciales se crea **imperativamente** (nunca se commitea;
`secret.example.yaml` es solo la plantilla documentada). Completá con los
valores de tu `.env`:

```bash
kubectl -n centralsm create secret generic finnegans-creds --from-literal=FINNEGANS_USER='TU_USUARIO' --from-literal=FINNEGANS_PASSWORD='TU_PASSWORD' --from-literal=FINNEGANS_WORKSPACE='TU_WORKSPACE' --from-literal=DATABASE_URL='postgresql://centralsm:centralsm@host.docker.internal:5433/centralsm?schema=public'
```

Nota el `host.docker.internal:5433`: desde adentro del cluster, así se llega al
Postgres que compose publica en el puerto 5433 del host. Primer aprendizaje de
redes en k8s: el cluster es una red aparte, el host se alcanza por ese nombre.

Verificá y espiá cómo se ve por dentro (base64, no cifrado):

```bash
kubectl -n centralsm get secret finnegans-creds -o yaml
```

## Paso 3 — Desplegar el worker

Antes, apagá el worker de compose para que quede claro quién procesa:

```bash
docker compose stop worker
```

Desplegá y mirá cómo levanta:

```bash
kubectl apply -f k8s/worker/deployment.yaml
```

```bash
kubectl -n centralsm get pods -w
```

(`-w` = watch; Ctrl+C para salir.) Cuando esté `Running`, colgate de los logs:

```bash
kubectl -n centralsm logs -f deploy/finnegans-worker
```

Tiene que decir `[worker] Arrancando. Polling cada 4000 ms...`.

**Prueba de fuego**: creá un producto en la app de siempre
(http://localhost:3100/productos/nuevo). En los logs del pod vas a ver al
worker tomar el job y procesarlo; la UI pasa a SINCRONIZADO como siempre —
sin enterarse de que el bot ahora corre adentro de un cluster.

## Paso 4 — Romper cosas (acá es donde se aprende)

**Matá el pod a mitad de un job:**

```bash
kubectl -n centralsm delete pod -l app=finnegans-worker
```

El Deployment crea otro pod solo (mirá `get pods -w`). El job que quedó a
medias aparece como ERROR con el aviso de "el worker se reinició" — el nuevo
worker lo marcó al arrancar (huérfanos, `worker/index.ts`). Reintentalo desde
`/productos` tras verificar en Finnegans que no se haya creado.

**Redeploy prolijo:**

```bash
kubectl -n centralsm rollout restart deploy/finnegans-worker
```

Si hay un job corriendo, fijate en los logs que el worker recibe SIGTERM,
termina el job y recién ahí muere: eso es el `terminationGracePeriodSeconds`
del deployment trabajando con el manejo de señales del worker.

**Nueva versión de la imagen** (cambiaste código del worker):

```bash
docker build -f Dockerfile.worker -t centralsm-worker:0.2 .
```

```bash
kubectl -n centralsm set image deploy/finnegans-worker worker=centralsm-worker:0.2
```

Versionar el tag (0.1 → 0.2) en vez de reusar `latest` es deliberado: con
`IfNotPresent`, un tag repetido no se vuelve a leer y te quedás corriendo la
imagen vieja sin darte cuenta.

## Diagnóstico: los tres errores clásicos

| Síntoma (`kubectl get pods`) | Causa típica | Cómo mirarlo |
|---|---|---|
| `ImagePullBackOff` | k8s intenta bajar la imagen de Docker Hub: falta `imagePullPolicy: IfNotPresent` o el tag no existe localmente | `kubectl -n centralsm describe pod <pod>` (sección Events) |
| `CrashLoopBackOff` | el proceso muere al arrancar (env faltante, DB inaccesible) y k8s lo reintenta con espera creciente | `kubectl -n centralsm logs <pod> --previous` |
| `OOMKilled` | Chromium superó el `limits.memory` | `describe pod` lo dice; subí el limit en el deployment |

Comandos de cabecera: `get pods`, `describe pod`, `logs -f`, `exec -it <pod> -- bash`.

## Paso 5 — La app Next.js al cluster

Acá aparecen los conceptos que el worker no necesitaba: **Service** (a la app sí
le hablan), **probes**, **initContainer** y **PVC**. Los manifests viven en
`k8s/app/` y están comentados uno por uno.

Diferencia clave con el worker: la app usa la imagen **`production`** del
Dockerfile (standalone, mínima, sin código montado) — la misma que usarías en
un deploy real, no la `dev` de compose.

1. **Construir la imagen de producción:**

```bash
docker build --target production -t centralsm-app:0.1 .
```

2. **Secret de la app** (DATABASE_URL + credenciales Teamplace; la app NO lleva
   las FINNEGANS_*, esas son del worker — cada servicio ve solo lo suyo):

```bash
kubectl -n centralsm create secret generic app-secrets --from-literal=DATABASE_URL='postgresql://centralsm:centralsm@host.docker.internal:5433/centralsm?schema=public' --from-literal=TEAMPLACE_CLIENT_ID='TU_CLIENT_ID' --from-literal=TEAMPLACE_CLIENT_SECRET='TU_CLIENT_SECRET'
```

3. **Aplicar todo** (`kubectl apply -f` acepta una carpeta entera):

```bash
kubectl apply -f k8s/app/
```

4. **Mirar el arranque en orden:** primero corre el initContainer `migrate`
   (`prisma migrate deploy`, reusa la imagen del worker que ya tiene el CLI y
   el schema), recién después arranca la app, y hasta que la readinessProbe no
   responda el Service no le manda tráfico:

```bash
kubectl -n centralsm get pods -w
```

   Vas a ver el pod pasar por `Init:0/1` → `PodInitializing` → `Running 0/1`
   (vivo pero aún no Ready) → `Running 1/1`.

5. **Entrar:** el Service es `type: LoadBalancer`, que en Docker Desktop
   publica en localhost → **http://localhost:3300** (3300 para no chocar con
   la app de compose en 3100). La alternativa didáctica sin LoadBalancer:
   `kubectl -n centralsm port-forward svc/centralsm-app 3300:3000`.

6. **La prueba de fuego:** con el worker del Paso 3 corriendo, creá un
   producto desde http://localhost:3300/productos/nuevo → la app del cluster
   encola en la DB de compose y el worker del cluster lo procesa. Todo el
   flujo pasa por Kubernetes; compose solo aporta la DB (y el cron).

Cosas para romper acá: `kubectl -n centralsm delete pod -l app=centralsm-app`
mientras navegás (el Service deja de mandarle tráfico al pod muerto y el nuevo
no recibe hasta estar Ready — casi ni lo notás); subí una imagen con un bug que
no responda `/` y mirá cómo la liveness lo reinicia (`describe pod` → Events).

## Limpiar todo

```bash
kubectl delete namespace centralsm
```

(y `docker compose start worker` si querés volver al worker de compose).

## Próximos ejercicios (cuando esto te quede cómodo)

1. **El cron como CronJob** nativo de k8s (reemplaza el contenedor `cron`).
   Aprendés: Job vs CronJob, schedule, historia de ejecuciones, TZ.
2. **Postgres como StatefulSet** (con una DB descartable, no la real).
   Aprendés: StatefulSet vs Deployment, PV/PVC, la storageclass `hostpath`.
3. **Multi-nodo** con kind o minikube, cuando quieras ver scheduling de verdad.
