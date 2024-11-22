FROM node:16-alpine

WORKDIR /app

COPY package*.json ./

RUN npm pkg delete scripts.prepare && \
    npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]