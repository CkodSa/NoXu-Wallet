import { defineConfig } from "vite";
import { resolve } from "path";

// Separate build config for content script that produces IIFE (no ES module imports)
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false, // Don't clear dist - main build runs first
    sourcemap: process.env.NODE_ENV === "development",
    lib: {
      entry: resolve(__dirname, "src/contentScript/index.ts"),
      name: "NoXuContentScript",
      formats: ["iife"],
      fileName: () => "contentScript"
    },
    rollupOptions: {
      output: {
        entryFileNames: "contentScript.js",
        // Ensure all dependencies are bundled inline
        inlineDynamicImports: true
      }
    }
  }
});
