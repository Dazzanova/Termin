import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      TERMIN_DB_PATH: ":memory:",
    },
  },
});
