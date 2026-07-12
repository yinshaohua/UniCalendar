export default {
  resolve: {
    conditions: ['node'],
    dedupe: ['obsidian'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    alias: {
      'obsidian': './tests/mocks/obsidian.ts',
    },
  },
};
