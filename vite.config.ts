import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        "terminal-popout": path.resolve(__dirname, "terminal-popout.html"),
        "terminal": path.resolve(__dirname, "terminal.html"),
        "image-viewer": path.resolve(__dirname, "image-viewer.html"),
      },
    },
  },
});
