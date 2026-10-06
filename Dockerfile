FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY backend backend
COPY frontend frontend
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/dist frontend/dist

USER node
EXPOSE 3000
CMD ["node", "backend/dist/index.js"]
