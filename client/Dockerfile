# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:24.22.1-alpine3.24 AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY tsconfig.json tsconfig.app.json tsconfig.node.json index.html vite.config.ts components.json ./
COPY public ./public/
COPY src ./src/
COPY @/ ./@/

# Build arg for API URL (baked into static files at build time)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Skip tsc type-checking in Docker (Vite handles TS transpilation; type-check runs in CI/local dev)
RUN npx vite build

# ── Stage 2: Serve with nginx ────────────────────────────────────────────────
FROM nginx:alpine AS production

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN nginx -t

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Security: nginx runs as non-root on port 80 by default in alpine image
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
