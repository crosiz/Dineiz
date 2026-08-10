FROM node:22-alpine

WORKDIR /app

COPY package.json /app/package.json
RUN npm i --omit=dev

COPY server.mjs /app/server.mjs

EXPOSE 8092
CMD ["node", "server.mjs"]

