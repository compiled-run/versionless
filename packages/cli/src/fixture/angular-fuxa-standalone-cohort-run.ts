import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	FUXA_APP_MODULE_SHA256,
	FUXA_COHORT_MODULE_TARGET_SHA256,
	FUXA_GAUGE_PROGRESS_SHA256,
	FUXA_GAUGE_PROGRESS_SPEC_SHA256,
	FUXA_GAUGE_SEMAPHORE_SHA256,
	FUXA_GAUGE_SEMAPHORE_SPEC_SHA256,
	FUXA_IFRAME_COMPONENT_SHA256,
	FUXA_IFRAME_SPEC_SHA256,
	canonicalize,
	sha256,
	transformFuxaGaugeStandalone,
	transformFuxaIframeStandalone,
	type AngularGaugeStandaloneSources,
	type AngularStandaloneEdit,
	type AngularStandaloneSources,
} from '../../../core/src/index.ts';
import {
	findArchiveFile,
	indexTarGzip,
	type ArchiveIndex,
} from '../../../core/src/corpus/tier-f-provenance.ts';
import { verifyAngularFuxaStandalone } from './angular-fuxa-standalone-run.ts';

const sourceDirectory = import.meta.dirname;
const root =
	path.basename(sourceDirectory) === 'dist'
		? path.resolve(sourceDirectory, '../../..')
		: path.resolve(sourceDirectory, '../../../..');
const archivePath = path.join(
	root,
	'.versionless/cache/tier-f/angular-fuxa/4913aabfec74fc990664a5d60760d8f3438ee067b682f833f5869cd2c9c3c372/source.tar.gz',
);
const defaultWork = path.join(root, '.versionless/work/angular-fuxa-standalone-cohort');
const defaultOutput = path.join(root, 'evidence/runs/angular-fuxa-standalone-cohort');
const t153Output = path.join(root, 'evidence/runs/angular-fuxa-standalone');
const commit = '8b323c177615c0d152a54e5ef0a6f98dae7b8ff0';
const archiveSha256 = '4913aabfec74fc990664a5d60760d8f3438ee067b682f833f5869cd2c9c3c372';
const fuxaReplaySha256 = 'e34a049f7536b5028a7913f568a3ac1e0b4eccf8fc727e39b8b98cdd5dce42f9';
const dashboardReplaySha256 = '82fa149ecd37ca6d91fa45ea39e7f7b1b6ca19d52fe29365b5e6a049563ec9ef';
const t153Artifacts = {
	'receipt.json': '4d0dbd3961a7f0d8200ecbeb810284611927cdf90e18ff311a4ab0c6839ad19e',
	'graph.json': '2fc4b51c34bffa6db187d806c34309b7a848eefcff807451b18067a8e3c6457e',
	'patch.diff': '086c0c3305e7404b501cfef42033ebe7e1953342a9c54c629254f5429a2802d8',
} as const;

const paths = {
	module: 'client/src/app/app.module.ts',
	iframeComponent: 'client/src/app/iframe/iframe.component.ts',
	iframeSpec: 'client/src/app/iframe/iframe.component.spec.ts',
	iframeTemplate: 'client/src/app/iframe/iframe.component.html',
	progressComponent: 'client/src/app/gauges/controls/gauge-progress/gauge-progress.component.ts',
	progressSpec: 'client/src/app/gauges/controls/gauge-progress/gauge-progress.component.spec.ts',
	progressTemplate: 'client/src/app/gauges/controls/gauge-progress/gauge-progress.component.html',
	semaphoreComponent:
		'client/src/app/gauges/controls/gauge-semaphore/gauge-semaphore.component.ts',
	semaphoreSpec:
		'client/src/app/gauges/controls/gauge-semaphore/gauge-semaphore.component.spec.ts',
	semaphoreTemplate:
		'client/src/app/gauges/controls/gauge-semaphore/gauge-semaphore.component.html',
	editor: 'client/src/app/editor/editor.component.ts',
	gauges: 'client/src/app/gauges/gauges.component.ts',
} as const;
const iframeUses = [
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
const fixedSourceHashes = {
	[paths.module]: FUXA_APP_MODULE_SHA256,
	[paths.iframeComponent]: FUXA_IFRAME_COMPONENT_SHA256,
	[paths.iframeSpec]: FUXA_IFRAME_SPEC_SHA256,
	[paths.iframeTemplate]: 'ef25d3411f36e1058ac0f54982b17d50cb671d2975a1c17a334ea48638e8f6b7',
	[paths.progressComponent]: FUXA_GAUGE_PROGRESS_SHA256,
	[paths.progressSpec]: FUXA_GAUGE_PROGRESS_SPEC_SHA256,
	[paths.progressTemplate]: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
	[paths.semaphoreComponent]: FUXA_GAUGE_SEMAPHORE_SHA256,
	[paths.semaphoreSpec]: FUXA_GAUGE_SEMAPHORE_SPEC_SHA256,
	[paths.semaphoreTemplate]: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
	[paths.editor]: '75e3a5d94d62b96b52b4240b02f2b8f3ca2fef58e35226ed1736e7499305804b',
	[paths.gauges]: 'b45935e388ea11f03bdaaf4fe3db9f0896d4bc828426bf2b4d2144cadf2db22e',
} as const;
const relevantPaths = [
	...Object.keys(fixedSourceHashes),
	...iframeUses.map((item) => item.path),
] as const;
const changedPaths = [
	paths.module,
	paths.iframeComponent,
	paths.iframeSpec,
	paths.progressComponent,
	paths.progressSpec,
	paths.semaphoreComponent,
	paths.semaphoreSpec,
] as const;

type CohortOptions = Readonly<{
	outputRoot?: string;
	workRoot?: string;
	publish?: boolean;
	replay?: boolean;
	verifyT153?: boolean;
}>;
type Order = 'iframe-first' | 'gauges-first';
type Trace = Readonly<{
	order: Order;
	steps: readonly { transform: string; edits: readonly AngularStandaloneEdit[] }[];
	digest: string;
}>;
type WorktreeResult = Readonly<{
	finalHashes: Record<string, string>;
	trace: Trace;
	patch: string;
}>;

function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

function canonical(value: unknown): string {
	return `${canonicalize(value)}\n`;
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

async function child(command: string, args: readonly string[]): Promise<string> {
	return await new Promise((resolve, reject) => {
		const processChild = spawn(command, [...args], {
			cwd: root,
			env: {
				...process.env,
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
				VERSIONLESS_CONSENT_ID: undefined,
			},
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		processChild.stdout.on('data', (value: Buffer) => stdout.push(value));
		processChild.stderr.on('data', (value: Buffer) => stderr.push(value));
		processChild.once('error', reject);
		processChild.once('exit', (code) =>
			code === 0
				? resolve(Buffer.concat(stdout).toString('utf8'))
				: reject(
						new Error(
							`Offline replay failed (${code}): ${Buffer.concat(stderr).toString('utf8')}`,
						),
					),
		);
	});
}

async function replayT094Twice(): Promise<void> {
	for (let index = 0; index < 2; index += 1) {
		const output = await child(process.execPath, [
			'--experimental-strip-types',
			'packages/cli/src/fixture/tier-f-ingest.ts',
			'--verify-only',
			'--fixture',
			'react-dashboard',
			'--fixture',
			'angular-fuxa',
		]);
		const parsed = JSON.parse(output) as {
			networkAttempts?: unknown;
			fixtures?: Array<{ fixture?: unknown; canonicalOutputSha256?: unknown }>;
		};
		if (
			parsed.networkAttempts !== 0 ||
			parsed.fixtures?.find((item) => item.fixture === 'react-dashboard')
				?.canonicalOutputSha256 !== dashboardReplaySha256 ||
			parsed.fixtures?.find((item) => item.fixture === 'angular-fuxa')
				?.canonicalOutputSha256 !== fuxaReplaySha256
		)
			throw new Error('T094 pair replay differs');
	}
}

async function verifyT153(workRoot: string): Promise<void> {
	for (const [file, digest] of Object.entries(t153Artifacts))
		if (sha256(await readFile(path.join(t153Output, file))) !== digest)
			throw new Error(`Immutable T153 artifact differs: ${file}`);
	const digest = await verifyAngularFuxaStandalone({
		outputRoot: t153Output,
		workRoot,
		replay: false,
	});
	if (digest !== t153Artifacts['receipt.json']) throw new Error('T153 replay digest differs');
}

async function loadArchive(): Promise<ArchiveIndex> {
	const bytes = await readFile(archivePath);
	if (sha256(bytes) !== archiveSha256) throw new Error('T094 archive SHA-256 differs');
	const archive = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: archiveSha256 },
		commit,
	);
	for (const [file, digest] of Object.entries(fixedSourceHashes))
		if (findArchiveFile(archive, file).sha256 !== digest)
			throw new Error(`Cohort source hash differs: ${file}`);
	for (const item of iframeUses)
		if (
			findArchiveFile(archive, item.path).sha256 !== item.sha256 ||
			count(findArchiveFile(archive, item.path).bytes.toString('utf8'), '<app-iframe') !==
				item.count
		)
			throw new Error(`T153 selector inventory differs: ${item.path}`);
	const editor = findArchiveFile(archive, paths.editor).bytes.toString('utf8');
	const gauges = findArchiveFile(archive, paths.gauges).bytes.toString('utf8');
	for (const [source, expected] of [
		[
			editor,
			{
				GaugeProgressComponent: 2,
				GaugeSemaphoreComponent: 2,
				'gauge-progress': 2,
				'gauge-semaphore': 2,
			},
		],
		[
			gauges,
			{
				GaugeProgressComponent: 14,
				GaugeSemaphoreComponent: 8,
				'gauge-progress': 2,
				'gauge-semaphore': 2,
			},
		],
	] as const)
		for (const [needle, expectedCount] of Object.entries(expected))
			if (count(source, needle) !== expectedCount)
				throw new Error(`Gauge reference inventory differs: ${needle}`);
	if (
		findArchiveFile(archive, paths.progressTemplate).byteLength !== 0 ||
		findArchiveFile(archive, paths.semaphoreTemplate).byteLength !== 0
	)
		throw new Error('Gauge empty-template boundary differs');
	return archive;
}

async function writeWorktree(archive: ArchiveIndex, directory: string): Promise<void> {
	for (const file of relevantPaths) {
		const destination = path.join(directory, file);
		await mkdir(path.dirname(destination), { recursive: true });
		await writeFile(destination, findArchiveFile(archive, file).bytes, { flag: 'wx' });
	}
}

async function readIframe(directory: string): Promise<AngularStandaloneSources> {
	return {
		component: await readFile(path.join(directory, paths.iframeComponent), 'utf8'),
		module: await readFile(path.join(directory, paths.module), 'utf8'),
		spec: await readFile(path.join(directory, paths.iframeSpec), 'utf8'),
	};
}

async function readGauges(directory: string): Promise<AngularGaugeStandaloneSources> {
	return {
		progressComponent: await readFile(path.join(directory, paths.progressComponent), 'utf8'),
		progressSpec: await readFile(path.join(directory, paths.progressSpec), 'utf8'),
		semaphoreComponent: await readFile(path.join(directory, paths.semaphoreComponent), 'utf8'),
		semaphoreSpec: await readFile(path.join(directory, paths.semaphoreSpec), 'utf8'),
		module: await readFile(path.join(directory, paths.module), 'utf8'),
	};
}

async function applyIframe(directory: string): Promise<readonly AngularStandaloneEdit[]> {
	const result = transformFuxaIframeStandalone(await readIframe(directory));
	await writeFile(path.join(directory, paths.iframeComponent), result.files.component);
	await writeFile(path.join(directory, paths.iframeSpec), result.files.spec);
	await writeFile(path.join(directory, paths.module), result.files.module);
	return result.edits;
}

async function applyGauges(directory: string): Promise<readonly AngularStandaloneEdit[]> {
	const result = transformFuxaGaugeStandalone(await readGauges(directory));
	await writeFile(path.join(directory, paths.progressComponent), result.files.progressComponent);
	await writeFile(path.join(directory, paths.progressSpec), result.files.progressSpec);
	await writeFile(
		path.join(directory, paths.semaphoreComponent),
		result.files.semaphoreComponent,
	);
	await writeFile(path.join(directory, paths.semaphoreSpec), result.files.semaphoreSpec);
	await writeFile(path.join(directory, paths.module), result.files.module);
	return result.edits;
}

function patchFor(edits: readonly AngularStandaloneEdit[]): string {
	if (edits.length !== 11) throw new Error('Canonical cohort patch must contain eleven spans');
	return `${['versionless.patch.v1', ...edits.map((edit) => `${edit.file}\t${edit.start}:${edit.end}\t${edit.beforeSha256}\t${edit.afterSha256}`)].join('\n')}\n`;
}

async function worktreeRun(
	archive: ArchiveIndex,
	directory: string,
	order: Order,
): Promise<WorktreeResult> {
	await writeWorktree(archive, directory);
	const steps: { transform: string; edits: readonly AngularStandaloneEdit[] }[] = [];
	if (order === 'iframe-first') {
		steps.push({ transform: 'iframe', edits: await applyIframe(directory) });
		steps.push({ transform: 'gauges', edits: await applyGauges(directory) });
	} else {
		steps.push({ transform: 'gauges', edits: await applyGauges(directory) });
		steps.push({ transform: 'iframe', edits: await applyIframe(directory) });
	}
	const edits = steps.flatMap((step) => step.edits);
	if (edits.length !== 11) throw new Error('Cohort composition span count differs');
	const finalHashes: Record<string, string> = {};
	const changed: string[] = [];
	for (const file of relevantPaths) {
		const digest = sha256(await readFile(path.join(directory, file)));
		finalHashes[file] = digest;
		if (digest !== findArchiveFile(archive, file).sha256) changed.push(file);
	}
	if (
		canonical(changed.sort((left, right) => left.localeCompare(right))) !==
			canonical([...changedPaths].sort((left, right) => left.localeCompare(right))) ||
		finalHashes[paths.module] !== FUXA_COHORT_MODULE_TARGET_SHA256
	)
		throw new Error('Cohort final file count or module hash differs');
	if (
		!transformFuxaIframeStandalone(await readIframe(directory)).idempotent ||
		!transformFuxaGaugeStandalone(await readGauges(directory)).idempotent
	)
		throw new Error('Cohort transform is not idempotent');
	const traceValue = { order, steps };
	return {
		finalHashes,
		trace: { ...traceValue, digest: sha256(canonical(traceValue)) },
		patch: order === 'iframe-first' ? patchFor(edits) : '',
	};
}

function mutationProof(
	archive: ArchiveIndex,
): readonly { mutation: string; result: 'refused'; restorationSha256: string }[] {
	const text = (file: string) => findArchiveFile(archive, file).bytes.toString('utf8');
	const iframe: AngularStandaloneSources = {
		component: text(paths.iframeComponent),
		module: text(paths.module),
		spec: text(paths.iframeSpec),
	};
	const gauges: AngularGaugeStandaloneSources = {
		progressComponent: text(paths.progressComponent),
		progressSpec: text(paths.progressSpec),
		semaphoreComponent: text(paths.semaphoreComponent),
		semaphoreSpec: text(paths.semaphoreSpec),
		module: text(paths.module),
	};
	const requireExact = (file: string, value: string): void => {
		if (sha256(value) !== findArchiveFile(archive, file).sha256)
			throw new Error(`Preservation mutation refused: ${file}`);
	};
	const cases: readonly { mutation: string; run: () => unknown; restorationSha256: string }[] = [
		{
			mutation: 'progress-inheritance',
			run: () =>
				transformFuxaGaugeStandalone({
					...gauges,
					progressComponent: gauges.progressComponent.replace(
						'extends GaugeBaseComponent',
						'',
					),
				}),
			restorationSha256: FUXA_GAUGE_PROGRESS_SHA256,
		},
		{
			mutation: 'progress-static-method',
			run: () =>
				transformFuxaGaugeStandalone({
					...gauges,
					progressComponent: gauges.progressComponent.replace(
						'static getSignals',
						'getSignals',
					),
				}),
			restorationSha256: FUXA_GAUGE_PROGRESS_SHA256,
		},
		{
			mutation: 'semaphore-selector',
			run: () =>
				transformFuxaGaugeStandalone({
					...gauges,
					semaphoreComponent: gauges.semaphoreComponent.replace(
						"selector: 'gauge-semaphore'",
						"selector: 'semaphore'",
					),
				}),
			restorationSha256: FUXA_GAUGE_SEMAPHORE_SHA256,
		},
		{
			mutation: 'semaphore-testbed',
			run: () =>
				transformFuxaGaugeStandalone({
					...gauges,
					semaphoreSpec: gauges.semaphoreSpec.replace('declarations:', 'providers:'),
				}),
			restorationSha256: FUXA_GAUGE_SEMAPHORE_SPEC_SHA256,
		},
		{
			mutation: 'app-module',
			run: () =>
				transformFuxaIframeStandalone({
					...iframe,
					module: iframe.module.replace('        IframeComponent,\n', ''),
				}),
			restorationSha256: FUXA_APP_MODULE_SHA256,
		},
		{
			mutation: 'progress-empty-template',
			run: () => requireExact(paths.progressTemplate, ' '),
			restorationSha256: fixedSourceHashes[paths.progressTemplate],
		},
		{
			mutation: 'semaphore-empty-template',
			run: () => requireExact(paths.semaphoreTemplate, '\n'),
			restorationSha256: fixedSourceHashes[paths.semaphoreTemplate],
		},
		{
			mutation: 'progress-base-import',
			run: () =>
				transformFuxaGaugeStandalone({
					...gauges,
					progressComponent: gauges.progressComponent.replace(
						"import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';\n",
						'',
					),
				}),
			restorationSha256: FUXA_GAUGE_PROGRESS_SHA256,
		},
		{
			mutation: 'editor-reference',
			run: () =>
				requireExact(
					paths.editor,
					text(paths.editor).replace('GaugeProgressComponent', 'GaugeProgress'),
				),
			restorationSha256: fixedSourceHashes[paths.editor],
		},
		{
			mutation: 'gauges-reference',
			run: () =>
				requireExact(
					paths.gauges,
					text(paths.gauges).replace('GaugeSemaphoreComponent', 'GaugeSemaphore'),
				),
			restorationSha256: fixedSourceHashes[paths.gauges],
		},
	];
	return cases.map((item) => {
		let refused = false;
		try {
			item.run();
		} catch {
			refused = true;
		}
		if (!refused) throw new Error(`Cohort mutation was not refused: ${item.mutation}`);
		return {
			mutation: item.mutation,
			result: 'refused' as const,
			restorationSha256: item.restorationSha256,
		};
	});
}

function graph(archive: ArchiveIndex, result: WorktreeResult): unknown {
	return {
		schemaVersion: 'versionless.angular-source-graph.v1',
		fixture: 'angular-fuxa-standalone-cohort',
		commit,
		nodes: relevantPaths.map((file) => ({
			path: file,
			beforeSha256: findArchiveFile(archive, file).sha256,
			afterSha256: result.finalHashes[file],
		})),
		edges: [
			...['IframeComponent', 'GaugeProgressComponent', 'GaugeSemaphoreComponent'].flatMap(
				(component) => [
					{ from: component, to: paths.module, relation: 'standalone-imported-by' },
					{
						from: component,
						to:
							component === 'IframeComponent'
								? paths.iframeSpec
								: component === 'GaugeProgressComponent'
									? paths.progressSpec
									: paths.semaphoreSpec,
						relation: 'standalone-imported-by-testbed',
					},
				],
			),
			{
				from: paths.editor,
				to: paths.progressComponent,
				relation: 'static-reference',
				count: 2,
			},
			{
				from: paths.editor,
				to: paths.semaphoreComponent,
				relation: 'static-reference',
				count: 2,
			},
			{
				from: paths.gauges,
				to: paths.progressComponent,
				relation: 'static-reference',
				count: 14,
			},
			{
				from: paths.gauges,
				to: paths.semaphoreComponent,
				relation: 'static-reference',
				count: 8,
			},
		],
	};
}

function seal(value: Record<string, unknown>): Record<string, unknown> {
	const receipt = { ...value, integrity: { algorithm: 'sha256', canonicalDigest: '' } };
	(receipt.integrity as { canonicalDigest: string }).canonicalDigest = sha256(canonical(receipt));
	return receipt;
}

export async function createAngularFuxaStandaloneCohortEvidence(
	options: CohortOptions = {},
): Promise<Record<string, string>> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Angular FUXA standalone cohort requires explicit offline mode');
	const workRoot = options.workRoot ?? defaultWork;
	const outputRoot = options.outputRoot ?? defaultOutput;
	if (await exists(workRoot)) throw new Error('Angular cohort worktree residue exists');
	if (options.publish !== false && (await exists(outputRoot)))
		throw new Error('Angular cohort evidence already exists');
	if (options.replay !== false) await replayT094Twice();
	if (options.verifyT153 !== false) await verifyT153(workRoot);
	const archive = await loadArchive();
	let first: WorktreeResult;
	let second: WorktreeResult;
	try {
		await mkdir(workRoot, { recursive: true });
		first = await worktreeRun(archive, path.join(workRoot, 'iframe-first'), 'iframe-first');
		second = await worktreeRun(archive, path.join(workRoot, 'gauges-first'), 'gauges-first');
		if (canonical(first.finalHashes) !== canonical(second.finalHashes))
			throw new Error('Cohort composition orders diverge');
		if (first.trace.digest === second.trace.digest)
			throw new Error('Cohort composition traces are not distinct');
	} finally {
		await rm(workRoot, { recursive: true, force: true });
	}
	if (await exists(workRoot)) throw new Error('Angular cohort worktree cleanup failed');
	const graphText = canonical(graph(archive, first));
	const traceIframe = canonical(first.trace);
	const traceGauges = canonical(second.trace);
	const receipt = canonical(
		seal({
			schemaVersion: 'versionless.angular-source-migration-cohort.v1',
			fixture: 'angular-fuxa',
			repository: 'frangoteam/FUXA',
			commit,
			source: { archiveSha256, fuxaReplaySha256, dashboardReplaySha256, t153Artifacts },
			migration: {
				components: [
					'IframeComponent',
					'GaugeProgressComponent',
					'GaugeSemaphoreComponent',
				],
				changedFiles: 7,
				spans: 11,
				finalHashes: first.finalHashes,
				orderConvergent: true,
				distinctTraces: true,
				semanticEngine: {
					parser: 'yuku-parser@0.7.0',
					analyzer: 'yuku-analyzer@0.7.0',
					diagnostics: 0,
				},
			},
			preservation: {
				emptyTemplates: 2,
				inheritance: true,
				staticMethods: true,
				imports: true,
				editorReferences: true,
				gaugesReferences: true,
				selectors: true,
				unrelatedBytes: true,
				t153ByteIdentical: true,
			},
			verification: {
				independentWorktrees: 2,
				idempotent: true,
				mutations: mutationProof(archive),
				networkAttempts: 0,
				residue: 'none',
			},
			artifacts: {
				graphSha256: sha256(graphText),
				patchSha256: sha256(first.patch),
				iframeFirstTraceSha256: sha256(traceIframe),
				gaugesFirstTraceSha256: sha256(traceGauges),
			},
			nonclaims: [
				'Exact source cohort only; no dependency, install, compiler, Angular CLI, build, server, browser, runtime, locality, generalization, Tier, pilot, support, compliance, or certification claim.',
			],
		}),
	);
	const artifacts = {
		'receipt.json': receipt,
		'graph.json': graphText,
		'patch.diff': first.patch,
		'iframe-first.json': traceIframe,
		'gauges-first.json': traceGauges,
	};
	if (options.publish !== false) {
		const staging = `${outputRoot}.staging`;
		await mkdir(staging, { recursive: true });
		try {
			for (const [file, contents] of Object.entries(artifacts))
				await writeFile(path.join(staging, file), contents, { flag: 'wx' });
			await rename(staging, outputRoot);
		} catch (error) {
			await rm(staging, { recursive: true, force: true });
			throw error;
		}
	}
	return artifacts;
}

export async function verifyAngularFuxaStandaloneCohort(
	options: Omit<CohortOptions, 'publish'> = {},
): Promise<string> {
	const outputRoot = options.outputRoot ?? defaultOutput;
	const expected: Record<string, string> = {};
	for (const file of [
		'receipt.json',
		'graph.json',
		'patch.diff',
		'iframe-first.json',
		'gauges-first.json',
	])
		expected[file] = await readFile(path.join(outputRoot, file), 'utf8');
	const actual = await createAngularFuxaStandaloneCohortEvidence({ ...options, publish: false });
	if (canonical(expected) !== canonical(actual))
		throw new Error('Angular standalone cohort evidence differs');
	return sha256(actual['receipt.json']!);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (!args.includes('--offline'))
		throw new Error('Angular standalone cohort command requires --offline');
	const digest = args.includes('--verify-only')
		? await verifyAngularFuxaStandaloneCohort()
		: sha256((await createAngularFuxaStandaloneCohortEvidence())['receipt.json']!);
	process.stdout.write(
		canonical({
			result: args.includes('--verify-only') ? 'pass' : 'migrated',
			digest,
			networkAttempts: 0,
			residue: 'none',
		}),
	);
}

if (process.argv[1]?.endsWith('angular-fuxa-standalone-cohort-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
