import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  base: process.env.VITE_PUBLIC_BASE || "/",
  plugins: [basicSsl()],
  build: {
    target: "esnext"
  },
  server: {
    port: 5173
  }
});
