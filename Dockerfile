# MedUni API — Render.com uchun (web Vercel'da alohida turadi).
# ffmpeg + TTS ichida: video generatsiya (Modul 9) to'liq ishlaydi.
FROM node:20-bookworm

# Tizim bog'liqliklari: ffmpeg (video montaj), python3+edge-tts (TTS fallback),
# openssl (prisma). sharp uchun bookworm (slim emas) — prebuilt binary yetadi.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg python3 python3-pip openssl ca-certificates \
    && pip3 install --break-system-packages edge-tts \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Butun monorepo (dockerignore node_modules/dist/.env'ni chiqarib tashlaydi).
COPY . .

# Bog'liqliklar (npm workspaces) + prisma client.
RUN npm install
RUN cd packages/db && npx prisma generate

# BUILD_WEB=1 bo'lsa web ham shu konteynerдан tarqatiladi (zaxira rejim —
# Vercel ishlamay qolsa). Odatda 0: web Vercel'da, bu yerda faqat API.
ARG BUILD_WEB=0
ARG VITE_API_URL=
RUN if [ "$BUILD_WEB" = "1" ]; then cd apps/web && VITE_API_URL="$VITE_API_URL" npx vite build; fi
ENV SERVE_WEB=""

ENV PORT=8080
EXPOSE 8080

RUN chmod +x docker-entrypoint.sh
CMD ["./docker-entrypoint.sh"]
