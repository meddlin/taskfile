import { createServer } from "node:net";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Asks the OS for a currently-free port.
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

// Dev server port: PORT=1234 pins it (and fails loudly if taken). With PORT unset, a free port is
// picked automatically, so the app never fights other dev servers over 3000/5173/8080.
export default defineConfig(async () => {
  const pinned = process.env.PORT ? Number(process.env.PORT) : undefined;
  return {
    resolve: { tsconfigPaths: true },
    server: { port: pinned ?? (await freePort()), strictPort: pinned !== undefined },
    plugins: [
      tailwindcss(),
      tanstackStart(), // must come before react()
      viteReact(),
    ],
  };
});
