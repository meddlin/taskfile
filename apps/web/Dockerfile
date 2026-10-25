# Runs the Taskfile web app locally. Build from the repository root (npm workspaces need the
# root package.json and lockfile):
#
#   docker build -f apps/web/Dockerfile -t taskfile-web .
#   docker run --rm -p 127.0.0.1::8080 -v taskfile-data:/data taskfile-web
#
# `-p 127.0.0.1::8080` lets Docker pick a free host port (find it with `docker port <container>`);
# use `-p 127.0.0.1:4321:8080` to choose one yourself. 8080 is only the port inside the container.
# See also docker-compose.yml.

FROM node:24-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/cli/package.json apps/cli/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace @taskfile/web
COPY apps/web apps/web
RUN npm run build --workspace @taskfile/web \
 && npm prune --omit=dev --workspace @taskfile/web

FROM node:24-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    TASKFILE_CONTAINER=1 \
    TASKFILE_DB=/data/tasks.db
WORKDIR /repo/apps/web
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/web/package.json ./
COPY --from=build /repo/apps/web/server.mjs /repo/apps/web/listen-message.mjs ./
COPY --from=build /repo/apps/web/dist ./dist
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
CMD ["node", "server.mjs"]
