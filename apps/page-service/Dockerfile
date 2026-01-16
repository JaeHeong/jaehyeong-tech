# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY apps/page-service/package.json ./apps/page-service/
COPY packages/shared ./packages/shared

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/page-service ./apps/page-service
COPY tsconfig.base.json ./

# Generate Prisma client
WORKDIR /app/apps/page-service
RUN ./node_modules/.bin/prisma generate

# Build
RUN pnpm build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml* ./
COPY --from=builder /app/apps/page-service/package.json ./apps/page-service/

# Install pnpm
RUN npm install -g pnpm

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files and Prisma client
COPY --from=builder /app/apps/page-service/dist ./apps/page-service/dist
COPY --from=builder /app/apps/page-service/node_modules/.prisma ./apps/page-service/node_modules/.prisma
COPY --from=builder /app/apps/page-service/prisma ./apps/page-service/prisma

# Copy shared packages
COPY --from=builder /app/packages ./packages

WORKDIR /app/apps/page-service

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3004/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/server.js"]
