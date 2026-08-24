#!/bin/sh
# Deploy de CentralSM al servidor LAN (192.168.100.108).
#
# El servidor (2 GB RAM) no puede correr `next build`, así que las imágenes se
# construyen en la PC y viajan por scp. Uso, desde Git Bash en la raíz del repo:
#
#   docker compose -f docker-compose.prod.yml build app cron
#   sh scripts/deploy-lan.sh            # imágenes + código + up
#   sh scripts/deploy-lan.sh --kardex   # además importa scripts/kardex-24m.jsonl
#
# Requiere la clave ~/.ssh/id_ed25519 autorizada para developer@servidor.
set -eu

HOST="developer@192.168.100.108"
PUERTO=5852
DESTINO="~/centralsm"
SSH="ssh -p $PUERTO $HOST"

echo "== 1/5 Verificando servidor =="
$SSH "df -h / | tail -1"

echo "== 2/5 Empaquetando imágenes (app + cron) =="
docker save centralsm-app:prod | gzip > /tmp/centralsm-app.tar.gz
docker save centralsm-cron:prod | gzip > /tmp/centralsm-cron.tar.gz
ls -lh /tmp/centralsm-*.tar.gz

echo "== 3/5 Subiendo imágenes =="
scp -P $PUERTO /tmp/centralsm-app.tar.gz /tmp/centralsm-cron.tar.gz "$HOST:/tmp/"

# El código (compose, prisma, scripts) se actualiza con git en el servidor, al
# mismo commit que se está desplegando. Antes se extraía un tar encima del repo
# y eso dejaba el working tree "modificado" (CRLF + archivos sueltos) y rompía
# el `git pull`. El commit tiene que estar pusheado a origin.
COMMIT=$(git rev-parse HEAD)
if ! git branch -r --contains "$COMMIT" | grep -q "origin/"; then
  echo "ERROR: el commit $COMMIT no está en origin. Hacé git push antes de deployar." >&2
  exit 1
fi

echo "== 4/5 Actualizando código ($COMMIT), cargando imágenes y levantando =="
$SSH "set -e
  cd $DESTINO
  git fetch origin
  git reset --hard $COMMIT
  docker load < /tmp/centralsm-app.tar.gz
  docker load < /tmp/centralsm-cron.tar.gz
  rm -f /tmp/centralsm-app.tar.gz /tmp/centralsm-cron.tar.gz
  docker compose -f docker-compose.prod.yml up -d --no-build db migrate app cron worker backup
  docker image prune -f
  df -h / | tail -1"

if [ "${1:-}" = "--kardex" ]; then
  echo "== 5/5 Importando kardex en producción =="
  gzip -c scripts/kardex-24m.jsonl > /tmp/kardex.jsonl.gz
  scp -P $PUERTO /tmp/kardex.jsonl.gz "$HOST:/tmp/"
  $SSH "set -e
    gunzip -f /tmp/kardex.jsonl.gz
    docker cp /tmp/kardex.jsonl centralsm-cron:/app/scripts/kardex-24m.jsonl
    docker exec centralsm-cron npx tsx scripts/importar-kardex.ts scripts/kardex-24m.jsonl --apply
    rm -f /tmp/kardex.jsonl"
else
  echo "== 5/5 (salteado: sin --kardex) =="
fi

echo "== Listo. Verificá: http://192.168.100.108:3100 =="
