FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

FROM base AS deps
COPY worker/package.json ./worker/
COPY shared/package.json ./shared/
WORKDIR /app/worker
RUN npm install

FROM base AS build
WORKDIR /app
COPY worker/ ./worker/
COPY shared/ ./shared/
COPY prisma/ ./prisma/
COPY --from=deps /app/worker/node_modules ./worker/node_modules
WORKDIR /app/worker
RUN npx prisma generate --schema=../prisma/schema.prisma
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# dist/ mirrors rootDir=".." so entry is at dist/worker/src/index.js
COPY --from=build /app/worker/dist ./dist
COPY --from=build /app/worker/node_modules ./node_modules
COPY --from=build /app/worker/package.json ./
COPY --from=build /app/worker/node_modules/.prisma ./node_modules/.prisma

CMD ["node", "dist/worker/src/index.js"]
