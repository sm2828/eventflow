FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

FROM base AS deps
COPY api/package.json ./api/
COPY shared/package.json ./shared/
WORKDIR /app/api
RUN npm install

FROM base AS build
WORKDIR /app
COPY api/     ./api/
COPY shared/  ./shared/
COPY prisma/  ./prisma/
COPY --from=deps /app/api/node_modules ./api/node_modules
WORKDIR /app/api
RUN npx prisma generate --schema=../prisma/schema.prisma
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/api/dist          ./dist
COPY --from=build /app/api/node_modules  ./node_modules
COPY --from=build /app/api/package.json  ./
COPY --from=build /app/api/node_modules/.prisma ./node_modules/.prisma
COPY prisma/ ./prisma/

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss && node dist/api/src/index.js"]
