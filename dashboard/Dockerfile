FROM node:20-alpine AS builder
WORKDIR /app

# Both VITE_ vars must be build args — Vite bakes them into the JS bundle at build time
ARG VITE_API_URL=""
ARG VITE_API_KEY=portfolio_demo_key

COPY dashboard/package.json ./
RUN npm install
COPY dashboard/ .

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_KEY=$VITE_API_KEY
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
