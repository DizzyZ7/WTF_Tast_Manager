FROM node:24-alpine AS base

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @wtf/core build && pnpm --filter @wtf/db build && pnpm --filter @wtf/api build

EXPOSE 8080
CMD ["pnpm", "--filter", "@wtf/api", "start"]
