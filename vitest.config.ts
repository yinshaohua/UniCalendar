import { createRequire } from 'node:module';
import { EXTERNAL_MODE, EXTERNAL_NODE_MODULES, EXTERNAL_ROOT } from './scripts/with-external-node-modules.mjs';

const externalRequire = EXTERNAL_MODE ? createRequire(`${EXTERNAL_NODE_MODULES}/../package.json`) : undefined;

export default {
  ...(EXTERNAL_MODE ? { cacheDir: `${EXTERNAL_ROOT}/.vite-cache` } : {}),
  resolve: {
    alias: {
      ...(EXTERNAL_MODE ? {
        'chinese-days': externalRequire!.resolve('chinese-days'),
        'ical.js': externalRequire!.resolve('ical.js'),
      } : {}),
    },
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
    deps: {
      ...(EXTERNAL_MODE ? { moduleDirectories: [EXTERNAL_NODE_MODULES] } : {}),
    },
  },
};
