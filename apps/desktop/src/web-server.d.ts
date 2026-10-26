// The web app's production server bundle (apps/web/dist/server/server.js). esbuild maps this
// specifier to the real file (scripts/build.mjs); it only exists after `npm run build -w @taskfile/web`.
declare module "taskfile-web-server" {
  const server: { fetch(request: Request): Response | Promise<Response> };
  export default server;
}
