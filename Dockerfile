FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json eslint.config.js ./
COPY packages packages
COPY apps apps
RUN npm ci && npm run build

FROM node:22-alpine AS stream-server
WORKDIR /app
COPY --from=build /app /app
ENV ADAPTER=mock
ENV HOST=0.0.0.0
ENV PORT=8765
EXPOSE 8765
CMD ["node", "apps/stream-server/dist/index.js"]

FROM nginx:1.27-alpine AS demo-web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/demo-web/dist /usr/share/nginx/html
EXPOSE 80
