import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, join } from "path";
import fs from "fs";

const copyExtensionAssets = () => ({
  name: "copy-extension-assets",
  closeBundle() {
    const manifestSrc = resolve(__dirname, "src/extension/manifest.json");
    const iconsSrc = resolve(__dirname, "src/extension/icons");
    const distDir = resolve(__dirname, "dist");
    fs.copyFileSync(manifestSrc, join(distDir, "manifest.json"));
    if (fs.existsSync(iconsSrc)) {
      fs.cpSync(iconsSrc, join(distDir, "icons"), { recursive: true });
    }
    // Copy popup/options html from build output to root for manifest
    const popupBuilt = resolve(distDir, "src/ui/popup/index.html");
    if (fs.existsSync(popupBuilt)) {
      let html = fs.readFileSync(popupBuilt, "utf8");
      html = html.replace(/src="[^"]*assets\//g, 'src="assets/');
      html = html.replace(/href="[^"]*assets\//g, 'href="assets/');
      fs.writeFileSync(resolve(distDir, "popup.html"), html);
    }
    const optionsBuilt = resolve(distDir, "src/ui/options/index.html");
    if (fs.existsSync(optionsBuilt)) {
      let html = fs.readFileSync(optionsBuilt, "utf8");
      html = html.replace(/src="[^"]*assets\//g, 'src="assets/');
      html = html.replace(/href="[^"]*assets\//g, 'href="assets/');
      fs.writeFileSync(resolve(distDir, "options.html"), html);
    }
  }
});

export default defineConfig({
  base: "./",
  plugins: [react(), copyExtensionAssets()],
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/extension/background/index.ts"),
        contentScript: resolve(__dirname, "src/extension/contentScript/index.ts"),
        // 🔥 provider removed – now comes from public/provider.js
        popup: resolve(__dirname, "src/ui/popup/index.html"),
        options: resolve(__dirname, "src/ui/options/index.html")
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "background") return "background.js";
          if (chunk.name === "contentScript") return "contentScript.js";
          // 🔥 provider mapping removed
          return "assets/[name].js";
        },
        assetFileNames: (asset) => {
          if (asset.name === "manifest.json") return "manifest.json";
          return "assets/[name][extname]";
        }
      }
    }
  }
});
