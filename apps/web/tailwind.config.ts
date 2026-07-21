import type { Config } from "tailwindcss";
import sharedConfig from "@meduni/ui/tailwind.config";

export default {
  presets: [sharedConfig],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
} satisfies Config;
