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

# Save prisma version so runner can install matching CLI via npm
RUN node -e "process.stdout.write(require('./node_modules/prisma/package.json').version)" > /tmp/prisma.version


# Stage 3: Production runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Install prisma CLI via npm (flat node_modules — resolves @prisma/engines correctly)
COPY --from=builder /tmp/prisma.version /tmp/prisma.version
RUN npm install --prefix /prisma-cli "prisma@$(cat /tmp/prisma.version)"

RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 5000

ENV PORT=5000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "node /prisma-cli/node_modules/prisma/build/index.js migrate deploy && node server.js"]
