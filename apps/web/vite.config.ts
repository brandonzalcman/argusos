import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = import.meta.dirname;

/** Origins allowed to fetch dev/preview assets: localhost plus the opaque origin of the sandbox frame. */
const corsOrigins = [
  /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
  "null",
];

/**
 * Dev only. The sandbox document runs in an opaque origin, so its module scripts are fetched with
 * CORS from origin "null" (allowed via `server.cors`). Vite's HMR client and the React refresh
 * preamble are inline/websocket based and would violate the strict CSP, and the sandbox does not
 * need them, so they are removed from the sandbox page. The CSP itself is left untouched.
 */
function sandboxDevHtml(): Plugin {
  return {
    name: "argus-sandbox-dev-html",
    apply: "serve",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.path.endsWith("/sandbox/component.html")) return html;
        return html
          .replace(/<script[^>]*src="\/@vite\/client"[^>]*><\/script>\s*/g, "")
          .replace(/<script type="module">[^<]*@react-refresh[^<]*<\/script>\s*/g, "");
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), sandboxDevHtml()],
  server: { cors: { origin: corsOrigins } },
  preview: { cors: { origin: corsOrigins } },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        // Served at /sandbox/component.html; embedded by @argus/sdk/host SandboxFrame.
        sandbox: resolve(root, "sandbox/component.html"),
      },
    },
  },
});
