FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000 --network-concurrency 4

FROM deps AS builder
COPY . .
RUN yarn build

FROM base AS production-deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true --network-timeout 600000 --network-concurrency 4 && yarn cache clean

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
