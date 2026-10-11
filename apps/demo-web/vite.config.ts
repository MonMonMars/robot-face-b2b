import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  resolve: {
    alias: {
      "@robot-face/sdk": path.resolve(
        __dirname,
        "../../packages/robot-face-sdk/src/index.ts",
      ),
    },
  },
  server: {
    port: 5173,
  },
});
