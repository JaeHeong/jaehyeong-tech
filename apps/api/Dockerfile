# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/api ./apps/api

# Generate Prisma client
RUN pnpm --filter api db:generate

# Build
RUN pnpm --filter api build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy package files for production install
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma/

# Install all dependencies (including prisma CLI for generation)
RUN pnpm install --frozen-lockfile

# Generate Prisma client with schema location
RUN cd apps/api && pnpm exec prisma generate

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "dist/index.js"]
