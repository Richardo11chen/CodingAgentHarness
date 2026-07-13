# Stage 1: Builder
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build
RUN npx tsc --outDir dist

# Stage 2: Runtime
FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.harness ./.harness
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
