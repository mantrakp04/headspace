FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/site/package.json apps/site/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/spotify/package.json packages/spotify/package.json
RUN npm ci
COPY . .
ENV NITRO_PRESET=node-server
RUN npm run build --workspace=@headspace/site

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/apps/site/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
