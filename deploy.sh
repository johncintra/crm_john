#!/bin/bash
set -e

echo "==> Atualizando código..."
git pull origin main

echo "==> Build e deploy do CRM backend..."
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo "==> Aguardando backend iniciar..."
sleep 5

echo "==> Status dos containers CRM:"
docker-compose -f docker-compose.prod.yml ps

echo "==> Deploy concluído!"
echo "    API disponível em: https://crm.xceducacao.com.br"
