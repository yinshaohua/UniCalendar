import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXTERNAL_NODE_MODULES_ENV = 'EXTERNAL_NODE_MODULES';
export const EXTERNAL_NODE_MODULES = process.env[EXTERNAL_NODE_MODULES_ENV]?.trim() || '';
export const EXTERNAL_MODE = EXTERNAL_NODE_MODULES.length > 0;
export const EXTERNAL_ROOT = EXTERNAL_MODE ? dirname(EXTERNAL_NODE_MODULES) : process.cwd();
export const EXTERNAL_BIN = EXTERNAL_MODE ? join(EXTERNAL_NODE_MODULES, '.bin') : join(process.cwd(), 'node_modules/.bin');

const localRequire = createRequire(import.meta.url);
const externalRequire = EXTERNAL_MODE ? createRequire(join(EXTERNAL_ROOT, 'package.json')) : localRequire;

export function requireTool(specifier) {
	return externalRequire(specifier);
}

export function resolveTool(specifier) {
	return externalRequire.resolve(specifier);
}

export function resolveOptionalTool(specifier) {
	try {
		return resolveTool(specifier);
	} catch (error) {
		if (EXTERNAL_MODE) {
			throw error;
		}

		return localRequire.resolve(specifier);
	}
}

export function ensureToolNodeModules() {
	if (EXTERNAL_MODE && !existsSync(EXTERNAL_NODE_MODULES)) {
		throw new Error(
			`${EXTERNAL_NODE_MODULES_ENV} points to ${EXTERNAL_NODE_MODULES}, but that directory does not exist. Run "npm run deps:install" after loading setenv, or unset ${EXTERNAL_NODE_MODULES_ENV} to use local node_modules.`,
		);
	}
}

export function createToolEnv(extra = {}) {
	ensureToolNodeModules();

	if (!EXTERNAL_MODE) {
		return {
			...process.env,
			...extra,
		};
	}

	return {
		...process.env,
		...extra,
		npm_config_prefix: EXTERNAL_ROOT,
		NODE_PATH: [EXTERNAL_NODE_MODULES, process.env.NODE_PATH].filter(Boolean).join(delimiter),
		PATH: [EXTERNAL_BIN, process.env.PATH].filter(Boolean).join(delimiter),
	};
}

export function localScriptPath(relativePath) {
	return fileURLToPath(new URL(relativePath, import.meta.url));
}
