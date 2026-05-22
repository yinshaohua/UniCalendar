import { dirname, join } from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolveTool } from './with-external-node-modules.mjs';

const jitiRegister = join(dirname(resolveTool('jiti/package.json')), 'lib/jiti-register.mjs');

register(pathToFileURL(jitiRegister), pathToFileURL(`${process.cwd()}/`));
