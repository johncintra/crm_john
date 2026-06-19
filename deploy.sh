#!/bin/bash
set -e

echo "==> Atualizando código..."
git pull origin main

echo "==> Build da imagem..."
docker-compose -f docker-compose.prod.yml --env-file .env.production build crm-backend

echo "==> Recriando container do backend..."
# docker-compose v1 quebra recriando containers em hosts com Docker Engine
# recente (KeyError: 'ContainerConfig'); remover antes evita o bug.
docker rm -f crm-john-backend > /dev/null 2>&1 || true
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

echo "==> Aguardando backend iniciar..."
sleep 5

echo "==> Status dos containers CRM:"
docker-compose -f docker-compose.prod.yml ps

echo "==> Deploy concluído!"
echo "    API disponível em: https://crm.xceducacao.com.br"
