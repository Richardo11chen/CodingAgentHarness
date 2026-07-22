# Stage 1: Builder
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libsecret-1-dev && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build
RUN npx tsc -p tsconfig.build.json

# Stage 2: Runtime
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends libsecret-1-0 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
RUN mkdir -p /workspace
COPY --from=builder /app/.harness /workspace/.harness
WORKDIR /workspace
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "/app/dist/index.js"]
