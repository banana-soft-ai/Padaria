# syntax=docker/dockerfile:1

# NOTE: Do NOT bake secrets into this image. Pass runtime envs via
# `docker run --env-file .env.local` or configure them in your deploy platform (Railway/Vercel/Render).

# Build arguments for secrets and public envs required during Next.js server-side build
# These should be provided by your CI or local build command via --build-arg
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY
ARG DATABASE_URL
ARG JWT_SECRET
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
## Re-declare ARGs in this stage (make them available here)
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY
ARG DATABASE_URL
ARG JWT_SECRET
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Export as ENVs so Next.js build (server-side & public build) can read them at build time.
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
ENV SUPABASE_URL=${SUPABASE_URL}
ENV SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
ENV DATABASE_URL=${DATABASE_URL}
ENV JWT_SECRET=${JWT_SECRET}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

RUN npm ci
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Usuário não-root
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copiar artefatos necessários
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone .
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]