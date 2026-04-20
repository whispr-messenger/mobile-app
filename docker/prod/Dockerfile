# =============================================================================
# Whispr Mobile App - Web Build
# Multi-stage: build Expo web bundle, serve with nginx
# =============================================================================

# -----------------------------------------------------------------------------
# STAGE 1: Build
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Build args for API URLs (injected at build time)
ARG API_BASE_URL=http://localhost
ARG MESSAGING_HTTP_PORT=4010
ARG AUTH_PORT=3010
ARG USER_PORT=3011
ARG MEDIA_PORT=3012
ARG SCHEDULING_PORT=3013

ENV API_BASE_URL=${API_BASE_URL} \
    EXPO_PUBLIC_API_BASE_URL=${API_BASE_URL} \
    EXPO_PUBLIC_MESSAGING_PORT=${MESSAGING_HTTP_PORT} \
    EXPO_PUBLIC_AUTH_PORT=${AUTH_PORT} \
    EXPO_PUBLIC_USER_PORT=${USER_PORT} \
    EXPO_PUBLIC_MEDIA_PORT=${MEDIA_PORT} \
    EXPO_PUBLIC_SCHEDULING_PORT=${SCHEDULING_PORT}

COPY package.json yarn.lock* package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npx expo export --platform web --output-dir dist

# -----------------------------------------------------------------------------
# STAGE 2: Serve
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

COPY docker/prod/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3020

CMD ["nginx", "-g", "daemon off;"]
