FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./

COPY packages/shared-types/package.json \
    packages/shared-types/package.json

COPY apps/mobile/frontend/package.json \
    apps/mobile/frontend/package.json

COPY apps/dashboard/frontend/package.json \
    apps/dashboard/frontend/package.json

COPY apps/api/backend/package.json \
    apps/api/backend/package.json

RUN npm ci --ignore-scripts

COPY apps/api/backend/prisma.config.ts \
    apps/api/backend/prisma.config.ts

COPY apps/api/backend/prisma \
    apps/api/backend/prisma

COPY apps/api/backend/tsconfig.json \
    apps/api/backend/tsconfig.json

COPY apps/api/backend/src \
    apps/api/backend/src


RUN DATABASE_URL="postgresql://kamara:kamara_dev@localhost:5432/kamara?schema=public" \
    npm --workspace @kamara/api exec prisma generate

RUN npm --workspace @kamara/api run build

WORKDIR /app/apps/api/backend

EXPOSE 3333


CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]