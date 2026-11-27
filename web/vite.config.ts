import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The public testnet sends no CORS headers, so the page reads /chain/* on its own origin.
// Dev: this proxy. Production: the rewrite in vercel.json.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [".."] }, proxy: { "/chain": { target: "https://api-testnet.qore.host", changeOrigin: true, rewrite: (p) => p.replace(/^\/chain/, "") } } },
  resolve: { dedupe: ["@qorechain/rdk"] },
});
