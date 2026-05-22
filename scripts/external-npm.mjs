import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { EXTERNAL_MODE, EXTERNAL_ROOT } from './with-external-node-modules.mjs';

const args = process.argv.slice(2);
const command = args[0] ?? 'install';
const forwarded = args.slice(1);

function syncPackageManifests() {
	if (!EXTERNAL_MODE || !['ci', 'install', 'i'].includes(command)) {
		return;
	}

	mkdirSync(EXTERNAL_ROOT, { recursive: true });

	for (const manifestPath of ['package.json', 'package-lock.json']) {
		if (existsSync(manifestPath)) {
			copyFileSync(manifestPath, join(EXTERNAL_ROOT, basename(manifestPath)));
		}
	}
}

syncPackageManifests();

const npmArgs = EXTERNAL_MODE
	? [command, '--prefix', EXTERNAL_ROOT, ...forwarded]
	: [command, ...forwarded];

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCommand, npmArgs, {
	stdio: 'inherit',
	cwd: process.cwd(),
	shell: process.platform === 'win32',
	env: EXTERNAL_MODE ? {
		...process.env,
		npm_config_prefix: EXTERNAL_ROOT,
	} : process.env,
});

if (result.error) {
	console.error(result.error);
	process.exit(1);
}

process.exit(result.status ?? 1);
