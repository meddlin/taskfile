// Startup banner for server.mjs. srvx's own "Listening on" line reports the address the process
// bound, which inside Docker is the container's internal port (8080), not a URL anyone can open.
//
// `url` is where the server actually listens; `env` is process.env. Inside the Docker image
// (TASKFILE_CONTAINER=1) the banner points at the host port instead: docker-compose.yml passes the
// chosen one as TASKFILE_PUBLISHED_PORT, and when Docker picked it nobody inside the container
// can know it, so the banner says how to look it up.
const WILDCARD_HOSTS = new Set(["0.0.0.0", "[::]"]);

/**
 * @param {string} url
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function listenMessage(url, env) {
  const { hostname, port } = new URL(url);
  if (env.TASKFILE_CONTAINER !== "1") {
    const wildcard = WILDCARD_HOSTS.has(hostname);
    // 127.0.0.1 rather than "localhost": Docker and many dev setups only listen on IPv4 loopback.
    return `Taskfile is running at http://${wildcard ? "127.0.0.1" : hostname}:${port}/${wildcard ? " (all interfaces)" : ""}`;
  }
  const published = env.TASKFILE_PUBLISHED_PORT;
  if (published) {
    return [
      `Taskfile is running. Open http://127.0.0.1:${published}/`,
      `(port ${port} is internal to the container; it is published on host port ${published})`,
    ].join("\n");
  }
  // nosemgrep: opengrep-rules.javascript.browser.security.raw-html-join -- terminal text, never HTML
  return [
    `Taskfile is running on port ${port} inside the container. That port is not reachable from your machine.`,
    `Find the host port Docker assigned with: docker compose port web ${port}`,
    // nosemgrep: opengrep-rules.javascript.lang.security.html-in-template-string -- "<that port>" is a placeholder in terminal text
    `(or, after docker run: docker port <container> ${port}), then open http://127.0.0.1:<that port>/`,
  ].join("\n");
}
