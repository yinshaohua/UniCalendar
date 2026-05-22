import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
	EXTERNAL_MODE,
	EXTERNAL_NODE_MODULES,
	createToolEnv,
	resolveTool,
} from './with-external-node-modules.mjs';

const command = process.argv[2];
const rawArgs = process.argv.slice(3);

const tools = {
	tsc: () => resolveTool('typescript/bin/tsc'),
	eslint: () => join(dirname(resolveTool('eslint/package.json')), 'bin/eslint.js'),
	vitest: () => join(dirname(resolveTool('vitest/package.json')), 'vitest.mjs'),
};

if (!command || !(command in tools)) {
	console.error(`Usage: node scripts/run-tool.mjs ${Object.keys(tools).join('|')} [args...]`);
	process.exit(1);
}

function createExternalTsConfig() {
	const baseConfig = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
	const compilerOptions = baseConfig.compilerOptions ?? {};
	const existingPaths = compilerOptions.paths?.['*'] ?? ['src/*', 'node_modules/*'];

	baseConfig.compilerOptions = {
		...compilerOptions,
		paths: {
			...(compilerOptions.paths ?? {}),
			'*': [
				...existingPaths,
				`${EXTERNAL_NODE_MODULES.replaceAll('\\', '/')}/*`,
			],
		},
		typeRoots: [
			'node_modules/@types',
			`${EXTERNAL_NODE_MODULES.replaceAll('\\', '/')}/@types`,
		],
	};

	const externalTsConfigPath = '.tsconfig.external-node-modules.json';
	writeFileSync(externalTsConfigPath, `${JSON.stringify(baseConfig, null, '\t')}\n`);
	return externalTsConfigPath;
}

function argsForCommand() {
	if (EXTERNAL_MODE && (command === 'tsc' || command === 'eslint')) {
		const externalTsConfig = createExternalTsConfig();

		if (command === 'tsc' && !rawArgs.includes('--project') && !rawArgs.includes('-p')) {
			return ['--project', externalTsConfig, ...rawArgs];
		}
	}

	return rawArgs;
}

const entry = tools[command]();
const result = spawnSync(process.execPath, [entry, ...argsForCommand()], {
	stdio: 'inherit',
	cwd: process.cwd(),
	env: createToolEnv(),
});

process.exit(result.status ?? 1);
