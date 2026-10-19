FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/types/package.json packages/shared/types/package.json
COPY packages/shared/utils/package.json packages/shared/utils/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @shared/types build && pnpm --filter @shared/utils build \
    && pnpm --filter @jaehyeong-tech/api prisma:generate \
    && pnpm --filter @jaehyeong-tech/api build \
    && pnpm --filter @shared/utils test && pnpm --filter @jaehyeong-tech/api test
RUN pnpm --filter @jaehyeong-tech/api deploy --prod /runtime

FROM node:22-alpine AS production
RUN apk add --no-cache openssl
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /runtime ./
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
