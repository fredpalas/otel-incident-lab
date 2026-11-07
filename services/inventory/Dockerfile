# Build context: repository root (pnpm workspace lockfile).
FROM node:24.22.2-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY services/inventory/package.json services/inventory/
RUN pnpm install --frozen-lockfile --filter @lab/inventory
COPY services/inventory services/inventory
RUN pnpm --filter @lab/inventory build

FROM node:24.22.2-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS deps
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/inventory/package.json services/inventory/
RUN pnpm install --frozen-lockfile --prod --filter @lab/inventory

FROM node:24.22.2-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8
ENV NODE_ENV=production
WORKDIR /repo/services/inventory
COPY --from=deps /repo /repo
COPY --from=build /repo/services/inventory/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
