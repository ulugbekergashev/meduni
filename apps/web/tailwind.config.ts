import type { Config } from "tailwindcss";
// Nisbiy yo'l ataylab: komponentlar Vite alias orqali packages/ui/src dan
// keladi, preset ham aynan o'sha manbadan o'qilsin — node_modules'dagi eskirgan
// nusxadan emas (Windows'da workspace havolasi o'rniga nusxa qolib ketgan edi).
import sharedConfig from "../../packages/ui/tailwind.config";

export default {
  presets: [sharedConfig],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
} satisfies Config;
