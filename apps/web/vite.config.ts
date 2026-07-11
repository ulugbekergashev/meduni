import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Alias to the UI package source dir so Vite applies the React/JSX
      // transform to it (files outside node_modules are treated as source).
      "@meduni/ui": path.resolve(repoRoot, "packages/ui/src"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
    // Allow importing tokens.css from the sibling packages/ui workspace.
    fs: { allow: [repoRoot] },
  },
});
