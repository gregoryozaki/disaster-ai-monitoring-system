FROM node:20-alpine

WORKDIR /app

COPY package.json ./

COPY prisma.config.ts ./
COPY prisma ./prisma

RUN npm install

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3333

CMD ["npm", "run", "dev"]