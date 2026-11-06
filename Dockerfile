FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install --global typescript@5.8.3
COPY tsconfig*.json ./
COPY src ./src
RUN tsc --project tsconfig.build.json --noCheck

FROM gyoridavid/short-video-maker:1.3.4-tiny
WORKDIR /app
COPY --from=build /app/dist/ ./dist/
COPY public/ ./public/
