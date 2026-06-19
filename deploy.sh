#!/bin/bash
set -e

echo "==> Atualizando código..."
git pull origin main

echo "==> Build da imagem..."
docker-compose -f docker-compose.prod.yml --env-file .env.production build crm-backend

echo "==> Recriando container do backend..."
# docker-compose v1 quebra recriando containers em hosts com Docker Engine
# recente (KeyError: 'ContainerConfig'); remover antes evita o bug. Usa
# filtro por nome (não nome exato) porque uma tentativa fracassada de
# recreate pode deixar um container renomeado com prefixo de hash.
OLD_BACKEND_IDS=$(docker ps -a --filter 'name=crm-john-backend' --format '{{.ID}}')
if [ -n "$OLD_BACKEND_IDS" ]; then
  docker rm -f $OLD_BACKEND_IDS > /dev/null 2>&1 || true
fi
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

echo "==> Aguardando backend iniciar..."
sleep 5

echo "==> Status dos containers CRM:"
docker-compose -f docker-compose.prod.yml ps

echo "==> Deploy concluído!"
echo "    API disponível em: https://crm.xceducacao.com.br"
