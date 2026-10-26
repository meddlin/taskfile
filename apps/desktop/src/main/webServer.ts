import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";
import web from "taskfile-web-server";
import { checkRequest } from "./guard";

export interface RunningServer {
  /** e.g. http://127.0.0.1:51234 */
  origin: string;
  host: string;
  close(): Promise<void>;
}

// Runs the web app (the same fetch handler apps/web/server.mjs serves) inside this process, so its
// server functions use the app's own Node and node:sqlite and the tasks stay in the same database
// as the CLI. The port is never fixed: the OS picks a free one.
export async function startWebServer(options: { clientDir: string; token: string }): Promise<RunningServer> {
  let host = "";
  const instance = serve({
    port: 0,
    hostname: "127.0.0.1",
    silent: true,
    fetch: (request) => web.fetch(request),
    middleware: [
      (request, next) => {
        const result = checkRequest(request.headers, { host, token: options.token });
        if (!result.ok) return new Response(result.reason, { status: result.status });
        return next();
      },
      staticMiddleware({ dir: options.clientDir }),
    ],
  });
  await instance.ready();
  const url = new URL(instance.url!);
  host = url.host;
  return { origin: url.origin, host, close: () => instance.close() };
}
