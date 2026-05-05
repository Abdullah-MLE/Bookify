# AI Summary Maker — Frontend Dockerfile
# Static export served via nginx

FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Public Clerk key is safe to bake in (it starts with pk_, designed for client-side)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

ARG NEXT_PUBLIC_TWIN_API_URL=https://urwnupwmdf.execute-api.us-east-1.amazonaws.com/
ENV NEXT_PUBLIC_TWIN_API_URL=$NEXT_PUBLIC_TWIN_API_URL

RUN npm run build

# Serve static export with nginx
FROM nginx:alpine

COPY --from=builder /app/out /usr/share/nginx/html

# nginx config that handles SPA routing (404 → index.html)
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { try_files $uri $uri/ /index.html; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
