# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:24.22.1-alpine3.24 AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json ./
RUN npm install

# Schema and migrations change more often than dependencies. Copy them after
# dependency installation so Prisma changes don't invalidate the npm layer.
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Generate Prisma client
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate

# Copy source and build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src/
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

# ── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:24.22.1-alpine3.24 AS production

WORKDIR /app

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install only the locked production dependency tree. Prisma CLI and tsx are
# production dependencies because deploy.sh uses them for migrations and seeding.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Keep this after dependency installation so Prisma changes don't reinstall packages.
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate

# Copy built output from builder
COPY --from=builder /app/dist ./dist/

# Own files by non-root user
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
