# Multi-stage build pro Next.js 14 com output: 'standalone'.
# Imagem final ~200 MB (Debian slim porque @sparticuz/chromium não roda no Alpine).

# === Stage 1: deps =========================================================
FROM node:20-slim AS deps
WORKDIR /app

# libs nativas mínimas pra build (sharp, node-gyp se aparecer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# === Stage 2: builder ======================================================
FROM node:20-slim AS builder
WORKDIR /app

# NEXT_PUBLIC_* precisam estar disponíveis em build time (são inlineados no bundle)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN
ARG NEXT_PUBLIC_SENTRY_DSN

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_PLAUSIBLE_DOMAIN=$NEXT_PUBLIC_PLAUSIBLE_DOMAIN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# === Stage 3: runner =======================================================
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Chromium do sistema pra Puppeteer em /api/social/render.
# Em vez de @sparticuz/chromium (otimizado pra Lambda, não traceia bem no
# output: standalone), instalamos o binário direto e apontamos via
# PUPPETEER_EXECUTABLE_PATH no .env.production.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --create-home --home-dir /home/nextjs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# next/image precisa do sharp pra OTIMIZAR imagem em produção. Sem ele, o Next
# serve o original (PNG de 2-3 MB) a cada acesso e loga erro — fotos lentas e
# falhando sob carga. O deps roda --ignore-scripts e o standalone não traça o
# binário nativo, então instalamos o sharp (com binário linux) direto no runner.
RUN npm install --no-save --no-audit --no-fund sharp@0.33.5 \
    && chown -R nextjs:nodejs /app/node_modules

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
