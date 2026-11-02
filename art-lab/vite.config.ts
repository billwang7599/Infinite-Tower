import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { artLabFiles } from "./fileApi.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const setting = loadEnv(mode, ROOT, "ART_LAB_").ART_LAB_FILES_DIR || "art-lab/files";
  const filesDir = resolve(ROOT, setting.replace(/^~(?=$|\/)/, homedir()));
  return {
    plugins: [tailwindcss(), artLabFiles(filesDir)],
    server: { port: 5175, watch: { ignored: [`${filesDir}/**`] } },
  };
});
