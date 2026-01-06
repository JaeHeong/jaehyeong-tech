# Build stage
FROM node:22-alpine AS builder

# Build arguments for Vite environment variables
ARG VITE_API_URL=/api
ARG VITE_GOOGLE_CLIENT_ID

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/web ./apps/web

# Build
RUN pnpm --filter web build

# Production stage
FROM nginx:alpine AS production

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
