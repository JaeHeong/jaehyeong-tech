# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/search-service/package.json ./apps/search-service/
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies (no frozen-lockfile since this is a new service)
RUN pnpm install

# Copy source code
COPY apps/search-service ./apps/search-service

# Build shared packages first
RUN pnpm --filter @shared/types build
RUN pnpm --filter @shared/events build
RUN pnpm --filter @shared/utils build

# Build service
RUN pnpm --filter search-service build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy all node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/search-service/node_modules ./apps/search-service/node_modules

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/search-service/package.json ./apps/search-service/

# Copy built files
COPY --from=builder /app/apps/search-service/dist ./apps/search-service/dist

# Copy shared packages (built)
COPY --from=builder /app/packages/shared/types/dist ./packages/shared/types/dist
COPY --from=builder /app/packages/shared/types/package.json ./packages/shared/types/
COPY --from=builder /app/packages/shared/events/dist ./packages/shared/events/dist
COPY --from=builder /app/packages/shared/events/package.json ./packages/shared/events/
COPY --from=builder /app/packages/shared/utils/dist ./packages/shared/utils/dist
COPY --from=builder /app/packages/shared/utils/package.json ./packages/shared/utils/
COPY --from=builder /app/packages/shared/utils/node_modules ./packages/shared/utils/node_modules

WORKDIR /app/apps/search-service

# Expose port
EXPOSE 3007

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3007/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/server.js"]
