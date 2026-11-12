import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({ plugins: [react(), tailwindcss()], server: { proxy: {
  "/health": "http://localhost:2567",
  "/api": "http://localhost:2567",
  "/matchmake": "http://localhost:2567",
  "/colyseus": { target: "ws://localhost:2567", ws: true, rewrite: path => path.replace(/^\/colyseus/, "") },
} } });
