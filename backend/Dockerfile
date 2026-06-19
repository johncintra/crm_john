FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY backend/package.json ./backend/package.json
COPY extension/package.json ./extension/package.json
RUN npm ci
COPY backend/prisma ./backend/prisma
RUN npm --workspace backend exec -- prisma generate
COPY backend ./backend
RUN npm run build:backend

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package*.json ./
COPY backend/package.json ./backend/package.json
COPY extension/package.json ./extension/package.json
RUN npm ci --omit=dev
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
EXPOSE 3000
CMD ["sh", "-c", "cd backend && npx prisma migrate deploy && node dist/main.js"]
