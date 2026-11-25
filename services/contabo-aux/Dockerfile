FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY src ./src
COPY tsconfig.json ./tsconfig.json
COPY services/contabo-aux ./services/contabo-aux
RUN ./node_modules/.bin/esbuild services/contabo-aux/match-worker.ts --bundle --platform=node --format=esm --target=node22 --tsconfig=tsconfig.json --outfile=services/contabo-aux/match-worker.mjs

FROM node:22-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build /repo/services/contabo-aux/server.mjs ./server.mjs
COPY --from=build /repo/services/contabo-aux/match-worker.mjs ./match-worker.mjs
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
