# syntax=docker/dockerfile:1

# A self-contained image for running Unwrap on your own machine. See
# docs/self-hosting.md; the TrueNAS instructions are the same image.
#
# Debian rather than Alpine on purpose: better-sqlite3 ships prebuilt binaries
# for glibc Linux, and on musl it would have to compile itself from source with
# a toolchain we would then be carrying around.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 normally just downloads a prebuilt binary. Keep a toolchain
# here anyway, so a platform with no prebuild compiles instead of failing the
# build. None of this reaches the final image, and the layer caches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# `npm ci` rather than install: the lockfile decides, and the native binary is
# fetched for this container's platform rather than the developer's laptop.
RUN npm ci


FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Keep the build away from any real database: page data collection imports the
# db module, which would otherwise create a file in the image.
ENV DATABASE_URL=file:/tmp/build.db
ENV DB_AUTO_MIGRATE=0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build


FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The standalone server listens on localhost unless told otherwise, which inside
# a container means nothing outside it can reach the port.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Both live on the one mounted volume: lose it and you have lost the lists.
ENV DATABASE_URL=file:/app/data/app.db

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# `output: "standalone"` leaves the server plus only the node_modules it uses,
# so there is nothing to install here. It excludes these two by design.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The database and the uploaded gift photos. Mount something durable here, and
# make sure it is writable by uid 1001.
RUN mkdir -p /app/data/uploads && chown -R nextjs:nodejs /app/data
VOLUME ["/app/data"]

USER nextjs
EXPOSE 3000

# robots.txt is served from memory and touches neither the database nor a
# session, so it answers even while the disk is busy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
