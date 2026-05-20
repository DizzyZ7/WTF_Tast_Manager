FROM node:24-alpine AS base

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @wtf/ui build && pnpm --filter @wtf/web build
RUN mkdir -p apps/web/.next/standalone/apps/web/.next \
  && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static

WORKDIR /app/apps/web/.next/standalone/apps/web

EXPOSE 3000
CMD ["node", "server.js"]
