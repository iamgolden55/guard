import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      "/api": {
        target: process.env.API_URL || "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "localhost",
        cookiePathRewrite: "/",
      },
      "/ws": {
        target: (process.env.API_URL || "http://localhost:8000").replace("http", "ws"),
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
