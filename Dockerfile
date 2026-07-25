# MedUni — bitta konteyner: API + qurilgan web (SERVE_WEB=1), ffmpeg/TTS bilan.
# ARM (Oracle) va x86 ikkalasida ishlaydi (node:20-bookworm ko'p-arxitektura).
FROM node:20-bookworm

# Tizim bog'liqliklari: ffmpeg (video), python3+edge-tts (TTS fallback),
# openssl (prisma). sharp uchun bookworm (slim emas) — prebuilt binary yetadi.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg python3 python3-pip openssl ca-certificates \
    && pip3 install --break-system-packages edge-tts \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Butun monorepo (dockerignore node_modules/dist/.env'ni chiqarib tashlaydi).
COPY . .

# Bog'liqliklar (npm workspaces) + prisma client + web build (relativ URL).
RUN npm install
RUN cd packages/db && npx prisma generate
RUN cd apps/web && VITE_API_URL= npx vite build

ENV SERVE_WEB=1 PORT=8080
EXPOSE 8080

RUN chmod +x docker-entrypoint.sh
CMD ["./docker-entrypoint.sh"]
