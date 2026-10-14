# syntax=docker/dockerfile:1
# Portable container image for the web app (any container host: AWS ECS
# Fargate is the recommended target, docs/platform/HOSTING.md).
#
#   docker build -t tourism-web .                   # runtime image
#   docker build --target migrate -t tourism-migrate .   # one-off: prisma migrate deploy
#
# No secrets are baked in: configuration comes from the environment at
# runtime (task definition + secret manager).

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# Runs database migrations, then exits. Used as a release step before
# rolling out new web/worker tasks.
FROM deps AS migrate
WORKDIR /app
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system app && useradd --system --gid app --no-create-home app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
