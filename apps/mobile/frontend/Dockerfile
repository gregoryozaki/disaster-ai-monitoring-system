FROM node:22-alpine AS deps

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

# Não executamos scripts dos outros workspaces neste estágio.
RUN npm ci --ignore-scripts


FROM node:22-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_API_URL=http://localhost:3333

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Copia o /app inteiro do estágio deps, não só o node_modules da raiz.
# O npm às vezes instala uma dependência dentro do próprio workspace
# (apps/*/frontend/node_modules), e ela sumiria do build.
COPY --from=deps /app ./

COPY package.json package-lock.json ./

COPY packages/shared-types \
    ./packages/shared-types

COPY apps/mobile/frontend \
    ./apps/mobile/frontend

WORKDIR /app/apps/mobile/frontend

RUN npm run build


FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/node_modules \
    ./node_modules

COPY --from=builder /app/package.json \
    ./package.json

COPY --from=builder /app/packages/shared-types \
    ./packages/shared-types

COPY --from=builder /app/apps/mobile/frontend \
    ./apps/mobile/frontend

WORKDIR /app/apps/mobile/frontend

EXPOSE 3001

CMD ["npm", "run", "start"]