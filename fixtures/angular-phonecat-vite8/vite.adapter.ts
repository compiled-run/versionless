import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRegExp, exactly } from 'magic-regexp';
import * as path from 'pathe';
import { joinURL } from 'ufo';
import { defineConfig, type Plugin } from 'vite';

const target = process.cwd();
const application = path.join(target, 'app');
const output = path.join(target, 'build-vite');
const specification = createRegExp(exactly('.spec.js').at.lineEnd());
const sha256 = (value: string | Uint8Array): string =>
	createHash('sha256').update(value).digest('hex');

async function filesBelow(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesBelow(item)));
		else if (entry.isFile()) files.push(item);
	}
	return files.sort();
}

function deterministicRuntimeEmission(): Plugin {
	return {
		name: 'versionless-angular-phonecat-vite8-runtime-emission',
		async closeBundle() {
			for (const source of await filesBelow(application)) {
				const relative = path.relative(application, source).split(path.sep).join('/');
				if (relative === 'index.html' || specification.test(relative) || relative === 'img/.gitkeep')
					continue;
				await mkdir(path.dirname(path.join(output, relative)), { recursive: true });
				await cp(source, path.join(output, relative));
			}
			const entries = await Promise.all(
				(await filesBelow(output))
					.map((file) => path.relative(output, file).split(path.sep).join('/'))
					.filter((file) => file !== 'runtime-inventory.json')
					.sort()
					.map(async (file) => ({
						path: file,
						url: joinURL('/', file),
						sha256: sha256(await readFile(path.join(output, file))),
					})),
			);
			await writeFile(
				path.join(output, 'runtime-inventory.json'),
				`${JSON.stringify({ schemaVersion: 'versionless.angular-phonecat-vite8-inventory.v1', entries }, null, 2)}\n`,
			);
		},
	};
}

export default defineConfig({
	root: application,
	base: joinURL('/', ''),
	plugins: [deterministicRuntimeEmission()],
	build: {
		outDir: output,
		emptyOutDir: true,
	},
});
