import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Deployed to GitHub Pages at https://<user>.github.io/pt-progression/
export default defineConfig({
  base: "/pt-progression/",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
