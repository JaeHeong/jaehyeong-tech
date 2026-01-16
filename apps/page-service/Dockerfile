# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/page-service/package.json ./apps/page-service/
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/page-service ./apps/page-service

# Build shared packages first
RUN pnpm --filter @shared/types build
RUN pnpm --filter @shared/events build
RUN pnpm --filter @shared/utils build

# Generate Prisma client
RUN pnpm --filter page-service exec prisma generate

# Build service
RUN pnpm --filter page-service build

# Copy generated prisma client to dist
RUN cp -r /app/apps/page-service/src/generated /app/apps/page-service/dist/

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy all node_modules from builder (includes prisma client)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/page-service/node_modules ./apps/page-service/node_modules

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/page-service/package.json ./apps/page-service/

# Copy built files
COPY --from=builder /app/apps/page-service/dist ./apps/page-service/dist
COPY --from=builder /app/apps/page-service/prisma ./apps/page-service/prisma

# Copy shared packages (built)
COPY --from=builder /app/packages/shared/types/dist ./packages/shared/types/dist
COPY --from=builder /app/packages/shared/types/package.json ./packages/shared/types/
COPY --from=builder /app/packages/shared/events/dist ./packages/shared/events/dist
COPY --from=builder /app/packages/shared/events/package.json ./packages/shared/events/
COPY --from=builder /app/packages/shared/utils/dist ./packages/shared/utils/dist
COPY --from=builder /app/packages/shared/utils/package.json ./packages/shared/utils/

WORKDIR /app/apps/page-service

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3004/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/server.js"]
