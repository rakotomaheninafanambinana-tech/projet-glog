FROM node:20-alpine

# Outils de compilation pour Alpine
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Recompilation de sqlite3
RUN npm rebuild sqlite3 --build-from-source

EXPOSE 5000

CMD ["node", "server.js"]