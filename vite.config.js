import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    watch: {
      // Catalog refreshes save checkpoints; don't interrupt an active game for each one.
      ignored: ["**/public/catalog*.json"],
    },
  },
});
