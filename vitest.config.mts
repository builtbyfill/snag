import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': fromRoot('./'),
      // Same module Next resolves on the server (react-server condition): a no-op.
      'server-only': fromRoot('./node_modules/server-only/empty.js'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/setup/test-database.ts'],
    // DB-backed test files share snag_test and truncate it, so files run one at a time.
    fileParallelism: false,
  },
});
