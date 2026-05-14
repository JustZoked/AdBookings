# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --ignore-scripts


# Stage 2: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

RUN npm install -g pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV SKIP_ENV_VALIDATION=1
ENV DATABASE_URL=postgresql://build:build@localhost/build
ENV BOOKING_ACTION_SECRET=build-time-placeholder-secret-32-chars-minimum
RUN mkdir -p /app/public
RUN pnpm prisma generate && pnpm build

# Dereference pnpm symlinks for Prisma CLI tools into an isolated dir
RUN cp -rL node_modules/@prisma /tmp/prisma-scope && \
    cp -rL node_modules/prisma /tmp/prisma-pkg


# Stage 3: Production runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma CLI in isolated dir so it doesn't conflict with standalone node_modules
COPY --from=builder /tmp/prisma-scope /prisma-cli/node_modules/@prisma
COPY --from=builder /tmp/prisma-pkg /prisma-cli/node_modules/prisma
COPY --from=builder /app/prisma ./prisma

# Uploads directory (bound as volume)
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 5000

ENV PORT=5000
ENV HOSTNAME="0.0.0.0"

# Run migrations then start the app
CMD ["sh", "-c", "node /prisma-cli/node_modules/prisma/build/index.js migrate deploy && node server.js"]
