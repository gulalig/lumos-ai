FROM node:22.22.3-bookworm-slim AS base
WORKDIR /app

FROM base AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace apps/api --include-workspace-root

FROM dependencies AS build
COPY apps/api/ apps/api/
RUN npm run build --workspace apps/api

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --workspace apps/api --include-workspace-root

FROM base AS runtime
ENV NODE_ENV=production API_PORT=3001
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=production-dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=production-dependencies --chown=node:node /app/apps/api /app/apps/api
COPY --from=build --chown=node:node /app/apps/api/dist /app/apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.API_PORT+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
