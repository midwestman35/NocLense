FROM node:20-slim

WORKDIR /app

# Copy shared types from parent
COPY src/types.ts /app/src/types.ts

# Copy server code
COPY server/package.json server/package-lock.json* /app/server/
WORKDIR /app/server
RUN npm ci --omit=dev

COPY server/ /app/server/

# Create data directory for SQLite
RUN mkdir -p /data

ENV DB_PATH=/data/noclense.db
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "--import", "tsx", "src/index.ts"]
