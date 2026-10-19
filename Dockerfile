# syntax=docker/dockerfile:1
# spec.md > Docker Compose. One dependency install, three images built from it:
#   deps     npm ci: every dependency, including what migrations and the seed need
#   builder  next build with output: "standalone" (only the files the server imports)
#   migrate  one-shot service: drizzle-kit migrate; also runs the seed script
#   runner   the app itself: standalone output, non-root, no source and no .env

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM deps AS migrate
COPY drizzle ./drizzle
COPY drizzle.config.ts tsconfig.json ./
COPY lib ./lib
COPY scripts ./scripts
COPY seed/images ./seed/images
# The uploads volume is created from this folder on first use, so it must belong to `node`
# for the app (which also runs as `node`) to write screenshots into it.
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
CMD ["npx", "drizzle-kit", "migrate"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 3000
CMD ["node", "server.js"]
