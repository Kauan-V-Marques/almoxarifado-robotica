# Build a partir da raiz do monorepo: docker build -f apps/web/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @almox/web
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @almox/web

FROM nginx:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
