FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package.json /app/package.json
RUN npm i --omit=dev

COPY server.mjs /app/server.mjs

EXPOSE 8091
CMD ["node", "server.mjs"]

