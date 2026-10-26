// Stands in for apps/web's server bundle in tests (see vitest.config.ts), so they don't need a web build.
export default {
  fetch: () => new Response("rendered by the web app", { headers: { "content-type": "text/plain" } }),
};
