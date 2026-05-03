// Backend test kosumunun Vitest ayarlari bu dosyada toplanir.
// Test ortamindaki include, alias ve runtime davranislari burada belirlenir.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
});
