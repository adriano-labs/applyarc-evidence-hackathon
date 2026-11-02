# The hosted demo: build the client with Vite, then run the Hono server on Node 24.
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.1 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY client ./client
COPY vite.config.js ./
RUN NODE_ENV=production pnpm exec vite build

FROM node:24-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.1 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY server ./server
COPY fixtures ./fixtures
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
EXPOSE 3000
RUN mkdir -p /app/data && chown node:node /app/data
USER node
CMD ["node", "server/index.js"]
