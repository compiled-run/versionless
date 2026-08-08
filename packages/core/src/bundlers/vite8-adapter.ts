import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { joinURL, parseURL } from 'ufo';
import { canonicalize } from '../receipts/canonicalize.ts';

export type Vite8OutputEntry = Readonly<{ path: string; url: string; sha256: string }>;
export type Vite8KernelRun = Readonly<{
	lifecycle: readonly ['config-resolved', 'build-start', 'close-bundle'];
	output: readonly Vite8OutputEntry[];
	outputSha256: string;
}>;
export type Vite8KernelEvidence = Readonly<{
	schemaVersion: 'versionless.vite8-adapter-kernel.v1';
	profile: string;
	vite: '8.0.16';
	locality: 'process-scoped';
	runs: readonly Vite8KernelRun[];
}>;

type ResolvedConfig = Readonly<{
	command: string;
	build: Readonly<{ outDir: string }>;
}>;
export type Vite8KernelPlugin = Readonly<{
	name: string;
	enforce: 'post';
	configResolved(config: ResolvedConfig): void;
	buildStart(): void;
	closeBundle: Readonly<{
		order: 'post';
		sequential: true;
		handler(): Promise<void>;
	}>;
}>;

function sha256(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

export function compareUtf16CodeUnits(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

async function filesBelow(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesBelow(item)));
		else if (entry.isFile()) files.push(item);
	}
	return files.sort(compareUtf16CodeUnits);
}

export async function normalizedVite8OutputInventory(
	outputDirectory: string,
): Promise<readonly Vite8OutputEntry[]> {
	return await Promise.all(
		(await filesBelow(outputDirectory)).map(async (file) => {
			const relative = path.relative(outputDirectory, file).split(path.sep).join('/');
			const url = joinURL('/', relative);
			if (parseURL(url).host)
				throw new Error('Vite 8 output inventory contains a remote URL');
			return { path: relative, url, sha256: sha256(await readFile(file)) };
		}),
	);
}

export function assertVite8KernelEvidence(value: Vite8KernelEvidence): void {
	if (
		value.schemaVersion !== 'versionless.vite8-adapter-kernel.v1' ||
		value.vite !== '8.0.16' ||
		value.locality !== 'process-scoped' ||
		value.runs.length < 2
	)
		throw new Error('Vite 8 kernel lifecycle evidence is incomplete');
	for (const run of value.runs) {
		if (
			canonicalize(run.lifecycle) !==
			canonicalize(['config-resolved', 'build-start', 'close-bundle'])
		)
			throw new Error('Vite 8 kernel lifecycle order differs');
		if (run.outputSha256 !== sha256(canonicalize(run.output)))
			throw new Error('Vite 8 normalized output inventory digest differs');
		const paths = run.output.map((entry) => entry.path);
		if (
			canonicalize(paths) !== canonicalize([...paths].sort(compareUtf16CodeUnits)) ||
			new Set(paths).size !== paths.length
		)
			throw new Error('Vite 8 normalized output inventory is not unique and sorted');
	}
}

export function assertVite8Restoration(
	baseline: readonly Vite8OutputEntry[],
	restored: readonly Vite8OutputEntry[],
): void {
	if (canonicalize(baseline) !== canonicalize(restored))
		throw new Error('Vite 8 output restoration is not byte-identical');
}

export function createVite8AdapterKernel(options: {
	profile: string;
	evidencePath?: string;
}): Vite8KernelPlugin {
	const evidencePath =
		options.evidencePath ?? path.join(process.cwd(), '.versionless-vite8-kernel.json');
	let outputDirectory = '';
	let lifecycle: Array<'config-resolved' | 'build-start' | 'close-bundle'> = [];
	return {
		name: `versionless-vite8-kernel:${options.profile}`,
		enforce: 'post',
		configResolved(config) {
			if (config.command !== 'build')
				throw new Error('Vite 8 kernel requires build lifecycle');
			outputDirectory = path.resolve(config.build.outDir);
			lifecycle = ['config-resolved'];
		},
		buildStart() {
			if (canonicalize(lifecycle) !== canonicalize(['config-resolved']))
				throw new Error('Vite 8 kernel buildStart lifecycle differs');
			lifecycle.push('build-start');
		},
		closeBundle: {
			order: 'post',
			sequential: true,
			async handler() {
				if (canonicalize(lifecycle) !== canonicalize(['config-resolved', 'build-start']))
					throw new Error('Vite 8 kernel closeBundle lifecycle differs');
				lifecycle.push('close-bundle');
				const output = await normalizedVite8OutputInventory(outputDirectory);
				let previous: Vite8KernelEvidence | null = null;
				try {
					previous = JSON.parse(
						await readFile(evidencePath, 'utf8'),
					) as Vite8KernelEvidence;
				} catch {
					previous = null;
				}
				if (previous && previous.profile !== options.profile)
					throw new Error('Vite 8 kernel evidence profile differs');
				const evidence: Vite8KernelEvidence = {
					schemaVersion: 'versionless.vite8-adapter-kernel.v1',
					profile: options.profile,
					vite: '8.0.16',
					locality: 'process-scoped',
					runs: [
						...(previous?.runs ?? []),
						{
							lifecycle: ['config-resolved', 'build-start', 'close-bundle'],
							output,
							outputSha256: sha256(canonicalize(output)),
						},
					],
				};
				await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
			},
		},
	};
}
