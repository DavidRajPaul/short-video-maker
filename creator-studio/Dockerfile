FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg gosu && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY creator-studio/ /app/creator-studio/
COPY public/grace-logo.jpg /app/public/grace-logo.jpg
RUN mkdir /app/studio-data && chown node:node /app/studio-data
ENV PORT=8080 STUDIO_DATA_DIR=/app/studio-data
EXPOSE 8080
# Railway mounts an empty volume at runtime; give the non-root app access.
CMD ["sh","-c","mkdir -p /app/studio-data && chown node:node /app/studio-data && chmod 700 /app/studio-data && exec gosu node node creator-studio/server.mjs"]
