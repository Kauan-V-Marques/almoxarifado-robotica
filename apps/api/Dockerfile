# Build a partir da raiz do monorepo: docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @almox/api
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @almox/api

# Imagem final: só o bundle (um arquivo) e as migrations, sem node_modules
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/drizzle ./drizzle
USER node
EXPOSE 3333
CMD ["node", "dist/server.cjs"]
