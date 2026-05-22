import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { EXTERNAL_MODE, EXTERNAL_NODE_MODULES } from './scripts/with-external-node-modules.mjs';

const require = EXTERNAL_MODE
	? createRequire(`${EXTERNAL_NODE_MODULES}/../package.json`)
	: createRequire(import.meta.url);
const tseslint = require('typescript-eslint');
const globals = require('globals');
const { globalIgnores } = require('eslint/config');
const obsidianmd = (await import(pathToFileURL(require.resolve('eslint-plugin-obsidianmd')).href)).default;

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				project: EXTERNAL_MODE ? './.tsconfig.external-node-modules.json' : './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	globalIgnores([
		"node_modules",
		"dist",
		".gsd",
		".planning",
		".claude",
		".bg-shell",
		".github",
		"package-lock.json",
		"esbuild.config.mjs",
		"eslint.config.js",
		"eslint.config.mts",
		"vitest.config.ts",
		"version-bump.mjs",
		"scripts/**",
		"versions.json",
		"main.js",
		"**/*.md",
	]),
);
