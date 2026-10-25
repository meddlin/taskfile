// Production server for the built app (`npm run build` first). TanStack Start emits a fetch
// handler (dist/server/server.js) and static assets (dist/client); this serves both.
//
// Port: set PORT to choose one (fails if it's taken). Leave it unset and the OS assigns a free
// port, which is printed at startup. HOST defaults to 127.0.0.1; the Docker image sets 0.0.0.0.
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";
import server from "./dist/server/server.js";

const port = process.env.PORT === undefined || process.env.PORT === "" ? 0 : Number(process.env.PORT);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}

serve({
  fetch: server.fetch,
  port,
  hostname: process.env.HOST ?? "127.0.0.1",
  middleware: [staticMiddleware({ dir: new URL("./dist/client", import.meta.url).pathname })],
});
