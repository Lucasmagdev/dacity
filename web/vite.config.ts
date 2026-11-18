import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  // the jackpot replays rounds with the server's engine (server/src/slot/engine.ts): allow reading it in dev
  server: { port: 5317, strictPort: true, fs: { allow: [".."] } },
  build: {
    rollupOptions: {
      // CASINO_ONLY=1: build just the casino page (the standalone free-play site), nothing of the main game
      input: process.env.CASINO_ONLY === "1"
        ? { jackpot: resolve(__dirname, "jackpot.html") }
        : {
            main: resolve(__dirname, "index.html"),
            // jackpot subdomain (vercel.json sends jackpot.* there)
            jackpot: resolve(__dirname, "jackpot.html"),
          },
    },
  },
});
