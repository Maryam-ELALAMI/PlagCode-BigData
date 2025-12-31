# Multi-stage build: React (Vite) -> Nginx static hosting

FROM node:20-slim AS build
WORKDIR /app

# Install deps first for better layer caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy the frontend source
COPY frontend/ ./

# Build static assets
RUN npm run build


FROM nginx:alpine

# Replace default site config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Static files
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
