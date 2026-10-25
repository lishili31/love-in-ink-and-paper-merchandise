# ---- build ----
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
# package.json is needed so Node treats dist/boot.js as an ES module.
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
EXPOSE 3000
# Secrets are injected at runtime, never baked into the image:
#   docker run --env-file .env -p 3000:3000 <image>
CMD ["node", "dist/boot.js"]
