# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json ./
RUN npm install

# Schema and migrations change more often than dependencies. Copy them after
# dependency installation so Prisma changes don't invalidate the npm layer.
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src/
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install production dependencies + tsx (needed for prisma seed)
COPY package.json package-lock.json ./
RUN npm install --omit=dev && npm install tsx

# Keep this after dependency installation so Prisma changes don't reinstall packages.
COPY prisma ./prisma/
RUN npx prisma generate

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
