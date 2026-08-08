import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	FUXA_APP_MODULE_SHA256,
	FUXA_IFRAME_COMPONENT_SHA256,
	FUXA_IFRAME_SPEC_SHA256,
	FUXA_IFRAME_TEMPLATE_SHA256,
	canonicalize,
	sha256,
	transformFuxaIframeStandalone,
	type AngularStandaloneSources,
} from '../../../core/src/index.ts';
import {
	findArchiveFile,
	indexTarGzip,
	type ArchiveIndex,
} from '../../../core/src/corpus/tier-f-provenance.ts';

const sourceDirectory = import.meta.dirname;
const root =
	path.basename(sourceDirectory) === 'dist'
		? path.resolve(sourceDirectory, '../../..')
		: path.resolve(sourceDirectory, '../../../..');
const archivePath = path.join(
	root,
	'.versionless/cache/tier-f/angular-fuxa/4913aabfec74fc990664a5d60760d8f3438ee067b682f833f5869cd2c9c3c372/source.tar.gz',
);
const defaultWork = path.join(root, '.versionless/work/angular-fuxa-standalone');
const defaultOutput = path.join(root, 'evidence/runs/angular-fuxa-standalone');
const commit = '8b323c177615c0d152a54e5ef0a6f98dae7b8ff0';
const archiveSha256 = '4913aabfec74fc990664a5d60760d8f3438ee067b682f833f5869cd2c9c3c372';
const replaySha256 = 'e34a049f7536b5028a7913f568a3ac1e0b4eccf8fc727e39b8b98cdd5dce42f9';
const dashboardReplaySha256 = '82fa149ecd37ca6d91fa45ea39e7f7b1b6ca19d52fe29365b5e6a049563ec9ef';

const componentPath = 'client/src/app/iframe/iframe.component.ts';
const templatePath = 'client/src/app/iframe/iframe.component.html';
const specPath = 'client/src/app/iframe/iframe.component.spec.ts';
const modulePath = 'client/src/app/app.module.ts';
const useInventory = [
	{
		path: 'client/src/app/cards-view/cards-view.component.html',
		count: 2,
		sha256: 'fd419b443b2b47dc37b4af8d586581aaa50808720a9cbf5cbb45cd1200e774cc',
	},
	{
		path: 'client/src/app/editor/editor.component.html',
		count: 1,
		sha256: 'b38788eeeea94d890eef777cef890dde00cc2299c0c59fdc63448fb7e80c8cb4',
	},
	{
		path: 'client/src/app/fuxa-view/fuxa-view.component.html',
		count: 1,
		sha256: '694093c32dbb4b64ef37c122fb877d216cdcf2793249bd53562108a36775d8a9',
	},
	{
		path: 'client/src/app/home/home.component.html',
		count: 1,
		sha256: '3060b95ec7184ab06b84b9a46c2a0f037ede6aa63de1bc20a7a36ff66cbadd64',
	},
] as const;
const relevantPaths = [
	componentPath,
	templatePath,
	specPath,
	modulePath,
	...useInventory.map((entry) => entry.path),
] as const;

type EvidenceOptions = Readonly<{
	outputRoot?: string;
	workRoot?: string;
	publish?: boolean;
	replay?: boolean;
}>;
type RunResult = Readonly<{
	afterHashes: Record<string, string>;
	patch: string;
	edits: unknown;
	idempotenceDigest: string;
}>;

function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

function count(source: string, needle: string): number {
	let total = 0;
	let offset = 0;
	while (true) {
		const found = source.indexOf(needle, offset);
		if (found < 0) return total;
		total += 1;
		offset = found + needle.length;
	}
}

async function run(
	command: string,
	args: readonly string[],
	env: NodeJS.ProcessEnv,
): Promise<string> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, [...args], {
			cwd: root,
			env,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (value: Buffer) => stdout.push(value));
		child.stderr.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolve(Buffer.concat(stdout).toString('utf8'))
				: reject(
						new Error(
							`Offline T094 replay failed (${code}): ${Buffer.concat(stderr).toString('utf8')}`,
						),
					),
		);
	});
}

async function replayT094Twice(): Promise<void> {
	for (let index = 0; index < 2; index += 1) {
		const output = await run(
			process.execPath,
			[
				'--experimental-strip-types',
				'packages/cli/src/fixture/tier-f-ingest.ts',
				'--verify-only',
				'--fixture',
				'react-dashboard',
				'--fixture',
				'angular-fuxa',
			],
			{
				...process.env,
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
				VERSIONLESS_CONSENT_ID: undefined,
			},
		);
		const receipt = JSON.parse(output) as {
			networkAttempts?: unknown;
			fixtures?: Array<{ fixture?: unknown; canonicalOutputSha256?: unknown }>;
		};
		const dashboard = receipt.fixtures?.find((item) => item.fixture === 'react-dashboard');
		const fuxa = receipt.fixtures?.find((item) => item.fixture === 'angular-fuxa');
		if (
			receipt.networkAttempts !== 0 ||
			dashboard?.canonicalOutputSha256 !== dashboardReplaySha256 ||
			fuxa?.canonicalOutputSha256 !== replaySha256
		)
			throw new Error('T094 replay digest or zero-attempt invariant differs');
	}
}

async function loadArchive(): Promise<ArchiveIndex> {
	const bytes = await readFile(archivePath);
	if (sha256(bytes) !== archiveSha256) throw new Error('T094 FUXA archive SHA-256 differs');
	return indexTarGzip({ bytes, byteLength: bytes.byteLength, sha256: archiveSha256 }, commit);
}

function sourceText(archive: ArchiveIndex, file: string): string {
	return findArchiveFile(archive, file).bytes.toString('utf8');
}

function bindSources(archive: ArchiveIndex): AngularStandaloneSources {
	const sources = {
		component: sourceText(archive, componentPath),
		module: sourceText(archive, modulePath),
		spec: sourceText(archive, specPath),
	};
	if (
		sha256(sources.component) !== FUXA_IFRAME_COMPONENT_SHA256 ||
		sha256(sources.module) !== FUXA_APP_MODULE_SHA256 ||
		sha256(sources.spec) !== FUXA_IFRAME_SPEC_SHA256
	)
		throw new Error('Exact FUXA standalone source binding differs');
	const template = sourceText(archive, templatePath);
	if (
		sha256(template) !== FUXA_IFRAME_TEMPLATE_SHA256 ||
		count(template, 'sandbox="allow-forms allow-scripts allow-modals allow-same-origin"') !== 1
	)
		throw new Error('Security-sensitive iframe template differs');
	let uses = 0;
	for (const expected of useInventory) {
		const file = findArchiveFile(archive, expected.path);
		if (
			file.sha256 !== expected.sha256 ||
			count(file.bytes.toString('utf8'), '<app-iframe') !== expected.count
		)
			throw new Error(`app-iframe use inventory differs: ${expected.path}`);
		uses += expected.count;
	}
	if (uses !== 5) throw new Error('app-iframe use inventory must equal five');
	return sources;
}

function canonical(value: unknown): string {
	return `${canonicalize(value)}\n`;
}

function patchFor(result: ReturnType<typeof transformFuxaIframeStandalone>): string {
	const rows = ['versionless.patch.v1'];
	for (const edit of result.edits)
		rows.push(
			`${edit.file}\t${edit.start}:${edit.end}\t${edit.beforeSha256}\t${edit.afterSha256}`,
		);
	return `${rows.join('\n')}\n`;
}

async function writeRelevantWorktree(archive: ArchiveIndex, directory: string): Promise<void> {
	for (const file of relevantPaths) {
		const destination = path.join(directory, file);
		await mkdir(path.dirname(destination), { recursive: true });
		await writeFile(destination, findArchiveFile(archive, file).bytes, { flag: 'wx' });
	}
}

async function worktreeRun(archive: ArchiveIndex, directory: string): Promise<RunResult> {
	await writeRelevantWorktree(archive, directory);
	const sources = bindSources(archive);
	const transformed = transformFuxaIframeStandalone(sources);
	await writeFile(path.join(directory, componentPath), transformed.files.component);
	await writeFile(path.join(directory, modulePath), transformed.files.module);
	await writeFile(path.join(directory, specPath), transformed.files.spec);
	for (const unchanged of [templatePath, ...useInventory.map((entry) => entry.path)])
		if (
			sha256(await readFile(path.join(directory, unchanged))) !==
			findArchiveFile(archive, unchanged).sha256
		)
			throw new Error(`Unrelated worktree byte changed: ${unchanged}`);
	const afterHashes: Record<string, string> = {};
	for (const file of [componentPath, modulePath, specPath])
		afterHashes[file] = sha256(await readFile(path.join(directory, file)));
	const idempotent = transformFuxaIframeStandalone(transformed.files);
	if (
		!idempotent.idempotent ||
		idempotent.edits.length ||
		canonical(idempotent.files) !== canonical(transformed.files)
	)
		throw new Error('Standalone transform is not byte-idempotent');
	return {
		afterHashes,
		patch: patchFor(transformed),
		edits: transformed.edits,
		idempotenceDigest: sha256(canonical(idempotent.files)),
	};
}

function mutationProof(
	sources: AngularStandaloneSources,
): readonly { mutation: string; result: 'refused'; restorationSha256: string }[] {
	const cases = [
		{
			mutation: 'component-selector',
			sources: {
				...sources,
				component: sources.component.replace(
					"selector: 'app-iframe'",
					"selector: 'app-frame'",
				),
			},
			restored: sources.component,
		},
		{
			mutation: 'component-syntax',
			sources: {
				...sources,
				component: sources.component.replace(
					'export class IframeComponent',
					'export class IframeComponent {',
				),
			},
			restored: sources.component,
		},
		{
			mutation: 'module-duplicate-declaration',
			sources: {
				...sources,
				module: sources.module.replace(
					'        IframeComponent,\n',
					'        IframeComponent,\n        IframeComponent,\n',
				),
			},
			restored: sources.module,
		},
		{
			mutation: 'testbed-provider-substitution',
			sources: {
				...sources,
				spec: sources.spec.replace('      declarations:', '      providers:'),
			},
			restored: sources.spec,
		},
	] as const;
	return cases.map((item) => {
		let refused = false;
		try {
			transformFuxaIframeStandalone(item.sources);
		} catch {
			refused = true;
		}
		if (!refused) throw new Error(`Mutation was not refused: ${item.mutation}`);
		return {
			mutation: item.mutation,
			result: 'refused' as const,
			restorationSha256: sha256(item.restored),
		};
	});
}

function graph(archive: ArchiveIndex, result: RunResult): unknown {
	return {
		schemaVersion: 'versionless.angular-source-graph.v1',
		fixture: 'angular-fuxa',
		commit,
		nodes: relevantPaths.map((file) => ({
			path: file,
			beforeSha256: findArchiveFile(archive, file).sha256,
			afterSha256: result.afterHashes[file] ?? findArchiveFile(archive, file).sha256,
		})),
		edges: [
			{ from: componentPath, to: modulePath, relation: 'standalone-imported-by' },
			{ from: componentPath, to: specPath, relation: 'standalone-imported-by-testbed' },
			...useInventory.map((item) => ({
				from: item.path,
				to: componentPath,
				relation: 'selects-app-iframe',
				count: item.count,
			})),
		],
	};
}

function sealReceipt(value: Record<string, unknown>): Record<string, unknown> {
	const receipt = { ...value, integrity: { algorithm: 'sha256', canonicalDigest: '' } };
	(receipt.integrity as { canonicalDigest: string }).canonicalDigest = sha256(canonical(receipt));
	return receipt;
}

export async function createAngularFuxaStandaloneEvidence(
	options: EvidenceOptions = {},
): Promise<{ receipt: string; graph: string; patch: string }> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Angular FUXA standalone migration requires explicit offline mode');
	if (options.replay !== false) await replayT094Twice();
	const outputRoot = options.outputRoot ?? defaultOutput;
	const workRoot = options.workRoot ?? defaultWork;
	if (await exists(workRoot)) throw new Error('Angular standalone worktree residue exists');
	if (options.publish !== false && (await exists(outputRoot)))
		throw new Error('Angular standalone evidence already exists');
	const archive = await loadArchive();
	const sources = bindSources(archive);
	let first: RunResult;
	let second: RunResult;
	try {
		await mkdir(workRoot, { recursive: true });
		first = await worktreeRun(archive, path.join(workRoot, 'run-1'));
		second = await worktreeRun(archive, path.join(workRoot, 'run-2'));
		if (canonical(first) !== canonical(second))
			throw new Error('Independent standalone worktree results differ');
	} finally {
		await rm(workRoot, { recursive: true, force: true });
	}
	if (await exists(workRoot)) throw new Error('Angular standalone worktree cleanup failed');
	const graphText = canonical(graph(archive, first));
	const patch = first.patch;
	const receiptText = canonical(
		sealReceipt({
			schemaVersion: 'versionless.angular-source-migration.v1',
			fixture: 'angular-fuxa',
			repository: 'frangoteam/FUXA',
			commit,
			source: {
				archiveSha256,
				replaySha256,
				componentSha256: FUXA_IFRAME_COMPONENT_SHA256,
				templateSha256: FUXA_IFRAME_TEMPLATE_SHA256,
				specSha256: FUXA_IFRAME_SPEC_SHA256,
				appModuleSha256: FUXA_APP_MODULE_SHA256,
			},
			migration: {
				component: 'IframeComponent',
				selector: 'app-iframe',
				changedFiles: 3,
				spans: 4,
				afterHashes: first.afterHashes,
				semanticEngine: {
					parser: 'yuku-parser@0.7.0',
					analyzer: 'yuku-analyzer@0.7.0',
					diagnostics: 0,
				},
			},
			template: { byteIdentical: true, sandboxPreserved: true },
			selectorUses: { total: 5, templates: useInventory },
			verification: {
				independentRuns: 2,
				identical: true,
				idempotent: true,
				idempotenceDigest: first.idempotenceDigest,
				mutations: mutationProof(sources),
				networkAttempts: 0,
				worktreeResidue: 'none',
			},
			artifacts: { graphSha256: sha256(graphText), patchSha256: sha256(patch) },
			nonclaims: [
				'Source transform only; no dependency, install, compiler, Angular CLI, build, server, browser, runtime, locality, Tier, pilot, support, compliance, or certification claim.',
			],
		}),
	);
	if (options.publish !== false) {
		const staging = `${outputRoot}.staging`;
		await mkdir(staging, { recursive: true });
		try {
			await writeFile(path.join(staging, 'graph.json'), graphText, { flag: 'wx' });
			await writeFile(path.join(staging, 'patch.diff'), patch, { flag: 'wx' });
			await writeFile(path.join(staging, 'receipt.json'), receiptText, { flag: 'wx' });
			await rename(staging, outputRoot);
		} catch (error) {
			await rm(staging, { recursive: true, force: true });
			throw error;
		}
	}
	return { receipt: receiptText, graph: graphText, patch };
}

export async function verifyAngularFuxaStandalone(
	options: Omit<EvidenceOptions, 'publish'> = {},
): Promise<string> {
	const outputRoot = options.outputRoot ?? defaultOutput;
	const expected = {
		receipt: await readFile(path.join(outputRoot, 'receipt.json'), 'utf8'),
		graph: await readFile(path.join(outputRoot, 'graph.json'), 'utf8'),
		patch: await readFile(path.join(outputRoot, 'patch.diff'), 'utf8'),
	};
	const actual = await createAngularFuxaStandaloneEvidence({ ...options, publish: false });
	if (canonical(expected) !== canonical(actual))
		throw new Error('Angular standalone evidence verification differs');
	return sha256(actual.receipt);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (!args.includes('--offline'))
		throw new Error('Angular standalone command requires --offline');
	if (args.includes('--verify-only')) {
		const digest = await verifyAngularFuxaStandalone();
		process.stdout.write(
			canonical({ result: 'pass', digest, networkAttempts: 0, residue: 'none' }),
		);
	} else {
		const result = await createAngularFuxaStandaloneEvidence();
		process.stdout.write(
			canonical({
				result: 'migrated',
				digest: sha256(result.receipt),
				networkAttempts: 0,
				residue: 'none',
			}),
		);
	}
}

if (process.argv[1]?.endsWith('angular-fuxa-standalone-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
