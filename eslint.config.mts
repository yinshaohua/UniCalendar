import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
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
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['src/sync/GoogleProxyRequest.ts'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			'import/no-nodejs-modules': 'off',
		},
	},
	{
		files: ['tests/**/*.ts'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			'import/no-nodejs-modules': 'off',
		},
	},
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
