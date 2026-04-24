FROM node:20-alpine AS build
WORKDIR /app

COPY admin/package.json admin/package-lock.json* ./admin/
RUN cd admin && npm ci

COPY admin ./admin

# Build-time env for Vite. Use relative /api so both prod/dev work per-subdomain.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN cd admin && npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/admin/dist /usr/share/nginx/html

