# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@latest --activate

# 루트 package.json과 workspace 설정 복사
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Shared packages 복사
COPY packages/shared ./packages/shared

# Comment service 복사
COPY apps/comment-service ./apps/comment-service

# 의존성 설치
RUN pnpm install --frozen-lockfile

# Shared packages 빌드
RUN pnpm --filter @shared/types build
RUN pnpm --filter @shared/events build
RUN pnpm --filter @shared/utils build

# Prisma 생성
RUN pnpm --filter comment-service exec prisma generate

# Comment service 빌드
RUN pnpm --filter comment-service build

# Copy generated prisma client to dist
RUN cp -r /app/apps/comment-service/src/generated /app/apps/comment-service/dist/

# Production stage
FROM node:22-alpine

WORKDIR /app

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@latest --activate

# 전체 node_modules 복사 (prisma client 포함)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/comment-service/node_modules ./apps/comment-service/node_modules

# package.json 복사
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/apps/comment-service/package.json ./apps/comment-service/

# 빌드된 파일 복사
COPY --from=builder /app/packages/shared/types/dist ./packages/shared/types/dist
COPY --from=builder /app/packages/shared/types/package.json ./packages/shared/types/
COPY --from=builder /app/packages/shared/events/dist ./packages/shared/events/dist
COPY --from=builder /app/packages/shared/events/package.json ./packages/shared/events/
COPY --from=builder /app/packages/shared/utils/dist ./packages/shared/utils/dist
COPY --from=builder /app/packages/shared/utils/package.json ./packages/shared/utils/
COPY --from=builder /app/packages/shared/utils/node_modules ./packages/shared/utils/node_modules
COPY --from=builder /app/apps/comment-service/dist ./apps/comment-service/dist
COPY --from=builder /app/apps/comment-service/prisma ./apps/comment-service/prisma

WORKDIR /app/apps/comment-service

EXPOSE 3003

CMD ["node", "dist/server.js"]
