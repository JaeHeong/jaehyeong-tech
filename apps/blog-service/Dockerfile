# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY apps/blog-service/package.json ./apps/blog-service/
COPY packages/shared ./packages/shared

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/blog-service ./apps/blog-service
COPY tsconfig.base.json ./

# Generate Prisma client
WORKDIR /app/apps/blog-service
RUN ./node_modules/.bin/prisma generate

# Build
RUN pnpm build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml* ./
COPY --from=builder /app/apps/blog-service/package.json ./apps/blog-service/

# Install pnpm
RUN npm install -g pnpm

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files and Prisma client
COPY --from=builder /app/apps/blog-service/dist ./apps/blog-service/dist
COPY --from=builder /app/apps/blog-service/node_modules/.prisma ./apps/blog-service/node_modules/.prisma
COPY --from=builder /app/apps/blog-service/prisma ./apps/blog-service/prisma

# Copy shared packages
COPY --from=builder /app/packages ./packages

WORKDIR /app/apps/blog-service

# Expose port
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3006) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/server.js"]
