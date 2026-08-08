import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'pathe';
import {
	analyzeDirectDomAccess,
	classifyDirectDomOrigin,
	type DirectDomInventory,
} from '../../../core/src/analysis/direct-dom-access.ts';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';

const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

function collectFiles(root: string, directory = root): string[] {
	const files: string[] = [];
	for (const name of readdirSync(directory).sort()) {
		const path = join(directory, name);
		const status = lstatSync(path);
		if (status.isSymbolicLink())
			throw new Error(`direct-dom:inventory refuses symbolic links: ${relative(root, path)}`);
		if (status.isDirectory()) files.push(...collectFiles(root, path));
		else if (status.isFile() && sourceExtensions.has(extname(name))) files.push(path);
	}
	return files;
}

export function runDirectDomInventory(options: {
	root: string;
	id: string;
	output: string;
	offline: boolean;
}): DirectDomInventory {
	if (!options.offline) throw new Error('direct-dom:inventory requires --offline');
	if (!options.id) throw new Error('direct-dom:inventory requires a nonempty --id');
	const root = resolve(options.root);
	const rootStatus = lstatSync(root);
	if (!rootStatus.isDirectory())
		throw new Error('direct-dom:inventory --root must be a directory');
	const files = collectFiles(root).map((absolutePath) => {
		const path = relative(root, absolutePath);
		if (isAbsolute(path) || path === '..' || path.startsWith('../'))
			throw new Error(`Source escaped analysis root: ${path}`);
		return {
			path,
			source: readFileSync(absolutePath, 'utf8'),
			origin: classifyDirectDomOrigin(path),
		};
	});
	const inventory = analyzeDirectDomAccess({ id: options.id, files });
	const output = resolve(options.output);
	mkdirSync(dirname(output), { recursive: true });
	writeFileSync(output, `${canonicalize(inventory)}\n`, { flag: 'wx' });
	return inventory;
}
