FROM node:20-alpine AS builder
WORKDIR /app

# Declare build args so Vite can bake them in at build time
ARG VITE_API_KEY=dev_key_123

COPY dashboard/package.json ./
RUN npm install
COPY dashboard/ .

# Vite reads VITE_* env vars at build time
ENV VITE_API_KEY=$VITE_API_KEY
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
