FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/mobile/frontend/package.json apps/mobile/frontend/package.json
COPY apps/dashboard/frontend/package.json apps/dashboard/frontend/package.json
COPY apps/api/backend/package.json apps/api/backend/package.json
RUN npm install

FROM node:20-alpine AS runner
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages ./packages
COPY apps ./apps
WORKDIR /app/apps/dashboard/frontend
EXPOSE 3002
CMD ["npm", "run", "dev"]
