FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY creator-studio/ /app/creator-studio/
COPY public/grace-logo.jpg /app/public/grace-logo.jpg
RUN mkdir /app/studio-data && chown -R node:node /app
USER node
ENV PORT=8080 STUDIO_DATA_DIR=/app/studio-data
EXPOSE 8080
CMD ["node","creator-studio/server.mjs"]
