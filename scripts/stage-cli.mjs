import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(here, '..');
const source =
	process.env.CDK_MAKE_ASSISTANT_EXE ??
	resolve(extensionRoot, '..', 'cdk-make-assistant', 'target', 'release', 'cdk-make-assistant.exe');
const destination = resolve(
	extensionRoot,
	'resources',
	'win32-x64',
	'cdk-make-assistant.exe',
);

if (!existsSync(source)) {
	throw new Error(`cdk-make-assistant release executable not found: ${source}`);
}
mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.log(`Staged ${source} -> ${destination}`);

