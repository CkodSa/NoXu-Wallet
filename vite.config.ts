import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, join } from "path";
import fs from "fs";

// Get target browser from environment variable (default: chrome)
const targetBrowser = process.env.TARGET_BROWSER || "chrome";

const copyExtensionAssets = () => ({
  name: "copy-extension-assets",
  closeBundle() {
    const distDir = resolve(__dirname, "dist");
    const iconsSrc = resolve(__dirname, "src/extension/icons");

    // Copy the appropriate manifest based on target browser
    const manifestSrc = resolve(
      __dirname,
      `src/extension/manifest.${targetBrowser}.json`
    );

    // Fallback to generic manifest if browser-specific doesn't exist
    const manifestPath = fs.existsSync(manifestSrc)
      ? manifestSrc
      : resolve(__dirname, "src/extension/manifest.json");

    fs.copyFileSync(manifestPath, join(distDir, "manifest.json"));

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

    console.log(`\n✓ Built for ${targetBrowser.toUpperCase()}\n`);
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
        popup: resolve(__dirname, "src/ui/popup/index.html"),
        options: resolve(__dirname, "src/ui/options/index.html")
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "background") return "background.js";
          if (chunk.name === "contentScript") return "contentScript.js";
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
