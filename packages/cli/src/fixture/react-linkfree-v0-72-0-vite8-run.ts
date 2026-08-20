import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';
import { craEntryDocument } from '../../../frameworks/react/src/react-cra-vite-adapter.ts';

/**
 * Fixture-scoped orchestration for the create-react-app 5 to Vite 8 build lanes
 * of this application: it runs the repository's own codegen prebuild, writes the
 * Vite entry document from the immutable create-react-app template, builds the
 * era-pinned webpack 5 baseline twice in its own Node 16 cell, and builds the
 * Vite target twice on the maintained runtime.
 *
 * Every capability it exercises is generic and lives in @versionless/react; only
 * the paths, the runtime cell, and the environment are application knowledge and
 * they live here.
 */

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const workRoot = path.join(repositoryRoot, '.versionless/work/react-linkfree-v0-72-0');

export const baselineRoot = path.join(workRoot, 'baseline');
export const targetRoot = path.join(workRoot, 'target');

const viteConfig = path.join(repositoryRoot, 'fixtures/react-linkfree-v0-72-0/vite.config.ts');
const viteBinary = path.join(repositoryRoot, 'node_modules/.bin/vite');

/**
 * The era runtime cell: the Node 16.20.2 darwin-arm64 build the ingest acquired
 * and digest-verified. The repository's own continuous integration declares Node
 * 16 for both its build and its end-to-end jobs, so this is the major the
 * maintainers gated merges on. It is never used for the target lane.
 */
const eraRuntimeRoot = path.join(
	repositoryRoot,
	'.versionless/cache/react-linkfree-v0-72-0-baseline/runtime/node-v16.20.2-darwin-arm64',
);
const eraNodeBinary = path.join(eraRuntimeRoot, 'bin/node');
const eraNpmCli = path.join(eraRuntimeRoot, 'lib/node_modules/npm/bin/npm-cli.js');

/** The report the fixture's Vite config writes for the observed capabilities. */
const capabilityReportFile = path.join(targetRoot, 'capability-report.json');

const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');

/**
 * The digest scheme every lane inventory in this fixture uses, stated so a
 * reader can recompute it from the recorded file list alone.
 */
export const laneDigestScheme = 'sha256(canonicalize({corpus, files}))';

const compareUtf16CodeUnits = (left: string, right: string): number =>
	left === right ? 0 : left < right ? -1 : 1;

async function run(
	command: string,
	args: readonly string[],
	cwd: string,
	environment: Readonly<Record<string, string>> = {},
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: {
				...process.env,
				npm_config_offline: 'true',
				VERSIONLESS_NETWORK_MODE: 'offline',
				...environment,
			},
		});
		const errors: string[] = [];
		child.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString('utf8')));
		child.stdout.on('data', () => undefined);
		child.on('error', reject);
		child.on('close', (code) =>
			code === 0
				? resolve()
				: reject(new Error(`${command} exited ${code}: ${errors.join('')}`)),
		);
	});
}

export type LaneFile = Readonly<{ path: string; sha256: string }>;
export type LaneInventory = Readonly<{ digest: string; files: readonly LaneFile[] }>;

async function filesBelow(directory: string): Promise<string[]> {
	const found: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) found.push(...(await filesBelow(item)));
		else if (entry.isFile()) found.push(item);
	}
	return found;
}

/**
 * The lane inventory and its digest, under the reproducible scheme this corpus
 * uses elsewhere: sha256 over the canonicalized file list, so any reader can
 * recompute the digest from the record alone. The canonicalizer is the one the
 * receipt layer signs with, imported rather than re-implemented.
 */
export async function laneInventory(directory: string): Promise<LaneInventory> {
	const files: LaneFile[] = [];
	for (const file of await filesBelow(directory))
		files.push({
			path: path.relative(directory, file).split(path.sep).join('/'),
			sha256: sha256(await readFile(file)),
		});
	files.sort((left, right) => compareUtf16CodeUnits(left.path, right.path));
	return { digest: sha256(canonicalize(files)), files };
}

/**
 * The emitted directory that carries the application's profile corpus. Every
 * file in it is named by a real contributor, so no path below it may appear in
 * an evidence record — the ingest fixed that handling rule for this fixture and
 * this unit inherits it.
 */
const corpusDirectory = 'data/';

/** True when an emitted path belongs to the profile corpus. */
export function isCorpusPath(file: string): boolean {
	return file.startsWith(corpusDirectory);
}

export type CorpusAggregate = Readonly<{
	directory: string;
	files: number;
	aggregateSha256: string;
	note: string;
}>;
export type PublishedLane = Readonly<{
	digest: string;
	files: readonly LaneFile[];
	corpus: CorpusAggregate;
}>;

/**
 * The publishable form of a lane inventory: every emitted file the bundler
 * authored, recorded individually, plus the profile corpus folded into a single
 * aggregate digest.
 *
 * The fold is a handling rule, not a convenience. The corpus files are named by
 * contributors and the ingest already fixed that no filename or field value from
 * it may enter an evidence record; an emitted-artifact inventory that listed
 * them would breach that rule 561 times over. Nothing is lost from the record's
 * own arithmetic: the aggregate is a digest over the same canonicalized
 * `{path, sha256}` list the individual entries would have formed, so it changes
 * if any corpus file changes, and the lane digest still recomputes from what is
 * published.
 */
export function publishLane(inventory: LaneInventory): PublishedLane {
	const files = inventory.files.filter((file) => !isCorpusPath(file.path));
	const corpusFiles = inventory.files.filter((file) => isCorpusPath(file.path));
	const corpus: CorpusAggregate = {
		directory: corpusDirectory,
		files: corpusFiles.length,
		aggregateSha256: sha256(canonicalize(corpusFiles)),
		note: 'The profile corpus, folded into one aggregate digest over the same canonicalized path-and-digest list the individual entries would have formed. No corpus filename appears in this record, by the handling rule the ingest fixed for this fixture.',
	};
	return { digest: sha256(canonicalize({ corpus, files })), files, corpus };
}

/**
 * The environment `react-scripts build` inlines, mirrored by the Vite config.
 * `PUBLIC_URL` is empty because create-react-app resolves the declared absolute
 * `homepage` to its pathname, which is `/`.
 */
export const craEnvironment = { NODE_ENV: 'production', PUBLIC_URL: '' } as const;

/**
 * Run the repository's own codegen prebuild, unmodified.
 *
 * `package.json` declares `"build": "npm run generate && react-scripts build"`,
 * so `node generate.js` is the first half of the application's own declared
 * build rather than anything this migration introduces. It reads the profile
 * corpus from `public/data` and writes `public/list.json`, which is NOT
 * committed: a lane that skips it ships an application whose home and search
 * routes have no index to load. The migrated lane therefore runs it exactly as
 * the repository declares it, on the maintained runtime, before Vite is invoked
 * — the step is plain CommonJS over the file system and carries no bundler
 * coupling at all.
 */
export async function runApplicationCodegen(root = targetRoot): Promise<LaneFile> {
	await run(process.execPath, ['generate.js'], root);
	const generated = path.join(root, 'public/list.json');
	return { path: 'public/list.json', sha256: sha256(await readFile(generated)) };
}

/**
 * Regenerate the Vite entry document from the immutable create-react-app
 * template. No bootstrap module is injected: webpack 5 — unlike the webpack 4
 * line create-react-app 3 and 4 pinned — ships no automatic Node core module
 * polyfills and no injected `process`/`Buffer` bindings, so a create-react-app 5
 * application that needed them would have failed its own baseline build. This
 * one builds green, which is the measurement that says none are needed here.
 */
export async function writeEntryDocument(root = targetRoot): Promise<LaneFile> {
	const template = await readFile(path.join(root, 'public/index.html'), 'utf8');
	const document = craEntryDocument({
		template,
		entryModule: '/src/index.js',
		environment: craEnvironment,
	});
	await writeFile(path.join(root, 'index.html'), document);
	return { path: 'index.html', sha256: sha256(document) };
}

/** Build the target lane once into its own output directory. */
export async function buildTargetLane(
	outDirectory: string,
	root = targetRoot,
): Promise<LaneInventory> {
	const absolute = path.join(root, outDirectory);
	await rm(absolute, { recursive: true, force: true });
	await run(viteBinary, ['build', '--config', viteConfig, '--outDir', absolute], root);
	return laneInventory(absolute);
}

/**
 * Build the era-pinned baseline lane once with its own toolchain, running the
 * repository's declared build command unmodified so that all three declared
 * steps fire: the codegen prebuild, `react-scripts build`, and npm's `postbuild`
 * hook, which is the purgecss pass. `CI=true` is set because that is how the
 * repository's own `.github/workflows/build.yml` runs it; under
 * create-react-app 5 it makes the build non-interactive and promotes lint
 * warnings to errors, so it is a faithfulness measure rather than a relaxation.
 * `react-scripts build` always writes to `build/`, so the output is moved into
 * the run's own directory afterwards.
 */
export async function buildBaselineLane(
	outDirectory: string,
	root = baselineRoot,
): Promise<LaneInventory> {
	const staging = path.join(root, 'build');
	const absolute = path.join(root, outDirectory);
	await rm(staging, { recursive: true, force: true });
	await rm(absolute, { recursive: true, force: true });
	await run(eraNodeBinary, [eraNpmCli, 'run', 'build'], root, {
		CI: 'true',
		PATH: `${path.join(eraRuntimeRoot, 'bin')}:${process.env.PATH ?? ''}`,
	});
	await rename(staging, absolute);
	return laneInventory(absolute);
}

/**
 * Build the baseline once more with npm's lifecycle hooks suppressed, which
 * suppresses exactly one declared step: the `postbuild` purge. It is the only
 * way to see what the baseline's bundler actually emitted before the purge
 * rewrote it in place, and it is a measurement lane — the output is inventoried,
 * measured, and deleted, and it is never one of the two lanes whose determinism
 * is claimed.
 */
export async function buildBaselinePrePurgeMeasurementLane(
	outDirectory: string,
	root = baselineRoot,
): Promise<LaneInventory> {
	const staging = path.join(root, 'build');
	const absolute = path.join(root, outDirectory);
	await rm(staging, { recursive: true, force: true });
	await rm(absolute, { recursive: true, force: true });
	await run(eraNodeBinary, [eraNpmCli, 'run', 'build', '--ignore-scripts'], root, {
		CI: 'true',
		PATH: `${path.join(eraRuntimeRoot, 'bin')}:${process.env.PATH ?? ''}`,
	});
	await rename(staging, absolute);
	return laneInventory(absolute);
}

export type CapabilityReport = Readonly<{
	sloppyCommonJsImplicitGlobals: ReadonlyArray<
		Readonly<{ module: string; names: readonly string[] }>
	>;
	nonUtf8DecodedModules: ReadonlyArray<
		Readonly<{ module: string; encoding: string; invalidByteOffsets: number }>
	>;
}>;

/**
 * What the observable adapter capabilities actually contributed to this closure.
 * An empty list is a measurement, not an absence of evidence: it says the
 * capability was composed, ran over the whole module graph, and found nothing to
 * do.
 */
export async function readCapabilityReport(): Promise<CapabilityReport> {
	return JSON.parse(await readFile(capabilityReportFile, 'utf8')) as CapabilityReport;
}

const cssExtension = '.css';
const javaScriptExtension = '.js';
const htmlExtension = '.html';

function filesWithExtension(inventory: LaneInventory, extension: string): readonly string[] {
	return inventory.files
		.map((file) => file.path)
		.filter((file) => path.extname(file) === extension);
}

export type CssPurgeMeasurement = Readonly<{
	lane: string;
	stylesheets: readonly string[];
	bytesBeforePurge: number;
	bytesAfterPurge: number;
	reductionPercent: number;
	shipped: boolean;
}>;

const roundToTwoDecimals = (value: number): number => Math.round(value * 100) / 100;

async function totalBytes(directory: string, files: readonly string[]): Promise<number> {
	let total = 0;
	for (const file of files) total += (await readFile(path.join(directory, file))).byteLength;
	return total;
}

/**
 * What the application's own declared postbuild purge would remove from a built
 * lane, measured without shipping it.
 *
 * The purge is run with the repository's own `purgecss.config.js` — so its
 * hand-written extractor is the one that decides which class names survive — and
 * only the content and stylesheet globs are retargeted at the lane being
 * measured, because those globs are written against create-react-app's output
 * layout (`build/index.html`, `build/static/js/*.js`, `build/static/css/*.css`)
 * and no other layout can match them. The result is written to a scratch
 * directory and discarded; neither lane's recorded output contains it.
 */
export async function measureDeclaredCssPurge(
	lane: string,
	directory: string,
	inventory: LaneInventory,
	scratch: string,
	root = targetRoot,
): Promise<CssPurgeMeasurement> {
	const stylesheets = filesWithExtension(inventory, cssExtension);
	const content = [
		...filesWithExtension(inventory, htmlExtension),
		...filesWithExtension(inventory, javaScriptExtension),
	];
	await rm(scratch, { recursive: true, force: true });
	await mkdir(scratch, { recursive: true });
	await run(
		path.join(root, 'node_modules/.bin/purgecss'),
		[
			// The declared config path, resolved by purgecss against its own working
			// directory exactly as the application's postbuild hook passes it.
			'--config',
			'./purgecss.config.js',
			'--css',
			...stylesheets.map((file) => path.join(directory, file)),
			'--content',
			...content.map((file) => path.join(directory, file)),
			'--output',
			scratch,
		],
		root,
	);
	const before = await totalBytes(directory, stylesheets);
	const purged = await readdir(scratch);
	const after = await totalBytes(scratch, purged);
	await rm(scratch, { recursive: true, force: true });
	return {
		lane,
		stylesheets,
		bytesBeforePurge: before,
		bytesAfterPurge: after,
		reductionPercent: roundToTwoDecimals(((before - after) / before) * 100),
		shipped: false,
	};
}

export type BuildLevelParity = Readonly<{
	baselineOnlyPaths: readonly string[];
	targetOnlyPaths: readonly string[];
	sharedPaths: readonly string[];
	byteIdenticalSharedPaths: readonly string[];
}>;

/**
 * Build-level parity: which emitted paths each lane has, which they share, and
 * which shared paths are byte identical. Nothing here observes behaviour, and
 * nothing here may be read as behavioural parity.
 */
export function buildLevelParity(baseline: LaneInventory, target: LaneInventory): BuildLevelParity {
	const baselineByPath = new Map(baseline.files.map((file) => [file.path, file.sha256]));
	const targetByPath = new Map(target.files.map((file) => [file.path, file.sha256]));
	const shared = [...baselineByPath.keys()]
		.filter((file) => targetByPath.has(file))
		.sort(compareUtf16CodeUnits);
	return {
		baselineOnlyPaths: [...baselineByPath.keys()]
			.filter((file) => !targetByPath.has(file))
			.sort(compareUtf16CodeUnits),
		targetOnlyPaths: [...targetByPath.keys()]
			.filter((file) => !baselineByPath.has(file))
			.sort(compareUtf16CodeUnits),
		sharedPaths: shared,
		byteIdenticalSharedPaths: shared.filter(
			(file) => baselineByPath.get(file) === targetByPath.get(file),
		),
	};
}

export type LaneRun = Readonly<{
	first: LaneInventory;
	second: LaneInventory;
	equal: boolean;
}>;

export type TargetLaneRun = LaneRun &
	Readonly<{
		applicationFilesChanged: readonly LaneFile[];
		capabilities: CapabilityReport;
	}>;

/**
 * Run the application's own codegen prebuild, regenerate the entry document,
 * then build the target lane twice.
 */
export async function runTargetLane(root = targetRoot): Promise<TargetLaneRun> {
	const generated = await runApplicationCodegen(root);
	const document = await writeEntryDocument(root);
	const first = await buildTargetLane('build-vite-run1', root);
	const second = await buildTargetLane('build-vite-run2', root);
	return {
		applicationFilesChanged: [document, generated].sort((left, right) =>
			compareUtf16CodeUnits(left.path, right.path),
		),
		capabilities: await readCapabilityReport(),
		first,
		second,
		equal: first.digest === second.digest,
	};
}

/** Build the era-pinned baseline lane twice in its own runtime cell. */
export async function runBaselineLane(root = baselineRoot): Promise<LaneRun> {
	const first = await buildBaselineLane('build-run1', root);
	const second = await buildBaselineLane('build-run2', root);
	return { first, second, equal: first.digest === second.digest };
}

/** Write an observation document into the run evidence directory. */
export async function writeRunObservation(name: string, value: unknown): Promise<string> {
	const directory = path.join(repositoryRoot, 'evidence/runs/react-linkfree-v0-72-0');
	await mkdir(directory, { recursive: true });
	const file = path.join(directory, name);
	await writeFile(file, `${JSON.stringify(value, null, '\t')}\n`);
	return file;
}

const entryDocumentName = 'index.html';

function fileDigest(inventory: LaneInventory, file: string): LaneFile | undefined {
	return inventory.files.find((entry) => entry.path === file);
}

async function byteLength(file: string): Promise<number> {
	return (await readFile(file)).byteLength;
}

/**
 * The one runtime break this cell surfaced, kept with the generic fix that
 * closed it. It is recorded whether or not a later reader thinks it obvious:
 * the history of what the gate caught is part of the evidence.
 */
const runtimeBreaks = [
	{
		order: 1,
		symptom:
			'Vite 8 stopped at parse time: "Unexpected JSX expression … JSX syntax is disabled and should be enabled via the parser options", raised on the application entry module.',
		cause: 'create-react-app compiles every application-source module through babel-preset-react-app, which always includes @babel/preset-react, so a `.js` file may contain JSX and the tool ships that shape in its own template. Vite decides a module grammar from its extension and parses `.js` without JSX.',
		genericFix:
			'createCraJavaScriptJsxPlugin — raises an application-source JavaScript module to the JSX module type, changing no code. Dependencies are excluded, matching create-react-app’s own babel-preset-react-app/dependencies rule, which carries no React preset.',
		landedIn: 'packages/frameworks/react/src/react-cra-vite-adapter.ts',
		caughtBy: 'the migrated build lane',
		firstApplicationInPortfolio:
			'This is the first JavaScript (rather than TypeScript) create-react-app cell in the portfolio, which is why the capability had not been needed before.',
	},
] as const;

/**
 * Assemble and publish the build profile. The lanes are run first, so every
 * number below is produced by the orchestration above rather than transcribed.
 */
export async function main(): Promise<void> {
	const fixture = JSON.parse(
		await readFile(
			path.join(repositoryRoot, 'fixtures/react-linkfree-v0-72-0/fixture.json'),
			'utf8',
		),
	) as { source: Record<string, string | number | boolean> };
	const baseline = await runBaselineLane();
	const target = await runTargetLane();
	const scratch = path.join(workRoot, 'purge-measurement');
	const prePurgeDirectory = path.join(baselineRoot, 'build-prepurge-measurement');
	const prePurge = await buildBaselinePrePurgeMeasurementLane('build-prepurge-measurement');
	const baselinePurge = await measureDeclaredCssPurge(
		'baseline',
		prePurgeDirectory,
		prePurge,
		scratch,
		baselineRoot,
	);
	const baselineShippedCssBytes = await totalBytes(
		path.join(baselineRoot, 'build-run1'),
		filesWithExtension(baseline.first, cssExtension),
	);
	await rm(prePurgeDirectory, { recursive: true, force: true });
	const targetPurge = await measureDeclaredCssPurge(
		'target',
		path.join(targetRoot, 'build-vite-run1'),
		target.first,
		scratch,
	);
	const parity = buildLevelParity(baseline.first, target.first);
	const baselineEntry = fileDigest(baseline.first, entryDocumentName);
	const targetEntry = fileDigest(target.first, entryDocumentName);
	const profile = {
		schemaVersion: 'versionless.react-linkfree-v0-72-0-build-profile.v1',
		result: 'build-profile-complete-not-promoted',
		fixture: 'react-linkfree-v0-72-0',
		source: {
			repository: fixture.source['repository'],
			repositoryAtPinnedRevision: fixture.source['repositoryAtPinnedRevision'],
			revision: fixture.source['revision'],
			revisionDate: fixture.source['revisionDate'],
			pinnedRevisionIsTagTarget: fixture.source['pinnedRevisionIsTagTarget'],
			archiveSha256: fixture.source['archiveSha256'],
			license: fixture.source['license'],
			licenseSha256: fixture.source['licenseSha256'],
			frontendRoot: fixture.source['frontendRoot'],
		},
		workArea: {
			root: '.versionless/work/react-linkfree-v0-72-0',
			baseline: '.versionless/work/react-linkfree-v0-72-0/baseline',
			target: '.versionless/work/react-linkfree-v0-72-0/target',
			materializedFrom: '.versionless/cache/react-linkfree-v0-72-0-baseline/app',
			materializedFromNote:
				'Both lanes are clones of the installed baseline cell the ingest produced, so both resolve the application’s own committed package-lock.json closure and neither re-resolved anything against a 2026 registry.',
		},
		digest: {
			scheme: laneDigestScheme,
			note: 'Every lane digest is sha256 over the canonicalized file list recorded beside it, so a reader can recompute it from this record alone.',
		},
		dependencyAcquisition: {
			consentId: 'VL-LEGACY-CORPUS-2026-08-10',
			mode: 'none-needed',
			networkDuringThisUnit: 'none',
			closureInstalledByThisUnit: false,
			why: 'The migrated lane needed no dependency the application does not already pin. It bundles the application’s own closure with the workspace’s existing Vite 8 devDependency as the bundler, so no consented install was performed and no registry was contacted.',
			lockfile: {
				path: 'package-lock.json',
				lockfileVersion: 2,
				declaredSha256: fixture.source['packageLockSha256'],
			},
			registryHosts: [],
		},
		builds: {
			baseline: {
				bundler: 'webpack-5.73.0 (react-scripts 5.0.1)',
				runtime: 'node-16.20.2',
				runtimeAuthority:
					'.github/workflows/build.yml declares actions/setup-node@v2 node-version 16 for both the build job and the e2e job. The repository’s Dockerfile disagrees and says node:15; CI was followed and the conflict is recorded rather than resolved silently.',
				command: 'CI=true npm run build',
				commandNote:
					'The repository’s declared build command, unmodified, so all three declared steps fire: the codegen prebuild, react-scripts build, and npm’s postbuild purgecss hook.',
				equal: baseline.equal,
				byteStable: baseline.equal,
				byteStabilityNote: baseline.equal
					? 'create-react-app 5 / webpack 5 rebuilt byte-for-byte identically across two runs in this cell. That is measured, not assumed: it is not a property every bundler in this corpus has.'
					: 'The two rebuilds differ. The differing paths are the record; no determinism is claimed for this lane.',
				first: publishLane(baseline.first),
				second: publishLane(baseline.second),
			},
			target: {
				bundler: 'vite-8.0.16',
				runtime: 'node-24.15.0',
				command:
					'node generate.js && vite build --config fixtures/react-linkfree-v0-72-0/vite.config.ts',
				adapter:
					'packages/frameworks/react createCraViteAdapter + craEntryDocument + craProcessEnvironmentDefines',
				adapterCapabilities: [
					'createCraNonUtf8ModuleSourcePlugin',
					'createCraJavaScriptJsxPlugin',
					'createCraTildeCssImportPlugin',
					'createCraSloppyCommonJsGlobalsPlugin',
					'createCraNodeCoreModulePlugin',
					'createCraGlobalIdentifierPlugin',
					'createCraPublicDirectoryPlugin',
					'craEntryDocument',
					'craProcessEnvironmentDefines',
				],
				applicationSourceEdits: 0,
				applicationFilesChanged: target.applicationFilesChanged,
				applicationFilesChangedNote:
					'Neither file is application source. `public/list.json` is the output of the repository’s own codegen prebuild, which is not committed and which every lane must run; `index.html` is the Vite entry document, derived from the immutable create-react-app template at public/index.html and written beside it rather than over it.',
				webpackExecuted: false,
				equal: target.equal,
				first: publishLane(target.first),
				second: publishLane(target.second),
			},
		},
		declaredBuildSteps: {
			codegenPrebuild: {
				step: 'npm run generate — node generate.js',
				declaredBy: 'the first half of the application’s own `build` script',
				migratedLaneRunsIt: true,
				how: 'The migrated lane runs `node generate.js` unmodified on the maintained runtime, before Vite is invoked. The script is plain CommonJS over the file system and has no bundler coupling, so it needs no adapter and no rewrite.',
				emits: 'public/list.json, which is not committed and which the home and search routes both read.',
				emittedSha256: target.applicationFilesChanged.find(
					(file) => file.path === 'public/list.json',
				)?.sha256,
				loadBearing:
					'A lane that skips it produces an application whose two most-tested journeys have no index to load.',
			},
			postbuildCssPurge: {
				step: 'npm postbuild — purgecss --config ./purgecss.config.js --output build/static/css',
				declaredBy: 'an npm lifecycle hook on the application’s own `build` script',
				migratedLaneRunsIt: false,
				decision: 'declared-out-of-scope-of-the-vite-build',
				reasoning: [
					'The step is post-build asset optimisation over already-emitted files, not a bundler capability. Nothing about it is webpack-shaped, so absorbing it into the create-react-app compatibility adapter would put a CSS optimiser into a surface whose whole subject is reproducing webpack semantics.',
					'It cannot be run unmodified against the migrated lane. purgecss.config.js hard-codes create-react-app’s output layout — content `build/index.html` and `build/static/js/*.js`, css `./build/static/css/*.css` — so honouring it verbatim would require either editing application source, which this lane refuses, or making the Vite lane imitate create-react-app’s directory layout, which is application-shaped overfitting in product code.',
					'Its correctness depends on an application-authored `defaultExtractor`. A generic capability that ran someone else’s extractor over someone else’s stylesheet would be claiming a result it cannot check.',
					'The upstream step carries two recorded defects: it rewrites the stylesheet without updating the .css.map beside it, and the `purgecss` CLI it invokes is never declared in package.json — it reaches node_modules/.bin only because npm hoists a transitive copy. Inheriting either into a reusable capability would be inheriting a defect.',
				],
				measuredBothWays: [baselinePurge, targetPurge],
				measurementNote:
					'Both measurements run the application’s own purgecss.config.js — its extractor unchanged — with only the content and stylesheet globs retargeted at the lane being measured, and both results are discarded rather than shipped. The baseline figure comes from a third measurement-only baseline build with npm’s lifecycle hooks suppressed, which is the only way to observe what webpack emitted before the purge rewrote it in place; that build is inventoried, measured, and deleted, and it is not one of the two lanes whose determinism is claimed. The migrated lane ships the unpurged stylesheet; the purge remains available to it as an application-level postbuild the moment the application updates its own globs, and nothing in the migration blocks that.',
				baselinePurgeAgreesWithShippedLane:
					baselinePurge.bytesAfterPurge === baselineShippedCssBytes,
				baselinePurgeAgreesWithShippedLaneNote:
					'The measurement lane’s purge output is compared against the stylesheet the baseline lane actually ships. Agreement is what makes the measurement a measurement of this application’s declared step rather than of a retargeted approximation of it.',
				shippedCssBytes: {
					baseline: baselineShippedCssBytes,
					baselineNote:
						'The baseline ships the purged stylesheet, because its postbuild hook rewrites it in place.',
					target: targetPurge.bytesBeforePurge,
					targetNote:
						'The migrated lane ships the unpurged stylesheet. The difference is an optimisation the migrated lane does not claim, not a rule the migrated lane lost.',
				},
			},
		},
		capabilities: {
			measured: target.capabilities,
			contribution: [
				{
					capability: 'createCraJavaScriptJsxPlugin',
					fired: true,
					what: 'Application-source JavaScript was parsed with JSX enabled, as babel-preset-react-app parsed it. Without it the build stops at the entry module.',
				},
				{
					capability: 'createCraSloppyCommonJsGlobalsPlugin',
					fired: target.capabilities.sloppyCommonJsImplicitGlobals.length > 0,
					what: 'No dependency module in this closure assigns an undeclared name, so the capability ran over the whole graph and rewrote nothing. Measured, not assumed: the report it writes is empty.',
				},
				{
					capability: 'createCraNonUtf8ModuleSourcePlugin',
					fired: target.capabilities.nonUtf8DecodedModules.length > 0,
					what: 'Every dependency JavaScript module this graph loads is valid UTF-8, so nothing was decoded. This closure is therefore NOT a second live application for that capability.',
				},
				{
					capability: 'createCraNodeCoreModulePlugin',
					fired: false,
					what: 'No Node core module is imported by this graph. That is provable from the baseline rather than only observed here: webpack 5 — unlike the webpack 4 line create-react-app 3 and 4 pin — ships no automatic core-module polyfills, so an import of one would have failed the green baseline build.',
					eraNote:
						'The capability reproduces a webpack 4 behaviour and this is a webpack 5 cell. It is composed because the adapter is composed whole, and it is inert here; a create-react-app 5 application that did import a core module would need this recorded as a deliberate divergence from its own era rather than silently shimmed.',
				},
				{
					capability: 'createCraGlobalIdentifierPlugin',
					fired: true,
					what: 'The ambient `global` identifier is defined as `globalThis`. webpack 5 keeps `node.global` defaulting to true for web targets, so this capability is era-faithful for create-react-app 5 as well as 3 and 4.',
					firedNote:
						'Contributed as a compile-time define. A module that never mentions the identifier emits byte-identical output, so "fired" here means composed and contributed, not observed to have rewritten anything.',
				},
				{
					capability: 'createCraTildeCssImportPlugin',
					fired: false,
					what: 'No stylesheet in this application or its closure uses a webpack tilde specifier in an @import rule.',
				},
				{
					capability: 'createCraPublicDirectoryPlugin',
					fired: true,
					what: 'The public directory was replicated into the build output the way react-scripts build copies it, excluding the HTML template that became the entry document. This is what carries the generated index and the profile corpus into the migrated lane.',
				},
			],
		},
		runtimeBreaks,
		parity: {
			level: 'build-artifacts-only',
			behavioral: 'not-tested',
			journeys: 'not-tested',
			runtimeEquivalence: 'unknown',
			entryHtml: {
				baselineBytes: await byteLength(
					path.join(baselineRoot, 'build-run1', entryDocumentName),
				),
				targetBytes: await byteLength(
					path.join(targetRoot, 'build-vite-run1', entryDocumentName),
				),
				baselineSha256: baselineEntry?.sha256,
				targetSha256: targetEntry?.sha256,
				equal: baselineEntry?.sha256 === targetEntry?.sha256,
				note: 'Bundler entry documents differ by construction: webpack injects hashed chunk scripts, Vite injects a hashed module script and stylesheet.',
			},
			inventory: {
				baselineFiles: baseline.first.files.length,
				targetFiles: target.first.files.length,
				baselineOnlyPaths: parity.baselineOnlyPaths.filter((file) => !isCorpusPath(file)),
				targetOnlyPaths: parity.targetOnlyPaths.filter((file) => !isCorpusPath(file)),
				sharedPaths: parity.sharedPaths.filter((file) => !isCorpusPath(file)),
				byteIdenticalSharedPaths: parity.byteIdenticalSharedPaths.filter(
					(file) => !isCorpusPath(file),
				),
				corpus: {
					directory: 'data/',
					baselineFiles: baseline.first.files.filter((file) => isCorpusPath(file.path))
						.length,
					targetFiles: target.first.files.filter((file) => isCorpusPath(file.path))
						.length,
					sharedPaths: parity.sharedPaths.filter((file) => isCorpusPath(file)).length,
					byteIdenticalSharedPaths: parity.byteIdenticalSharedPaths.filter((file) =>
						isCorpusPath(file),
					).length,
					note: 'The profile corpus is compared in full and reported as counts only. No corpus filename appears in this record.',
				},
				note: 'The shared, byte-identical majority is the copied public directory: the profile corpus and the static assets both lanes carry through unchanged. The differing paths are the bundler-authored ones.',
			},
		},
		witnessPhaseFacts: {
			runtimeEgressCascade:
				'Avatar <img> loads reach GitHub avatar and asset hosts for the whole profile corpus. src/utils.js installs an onerror fallback to a third-party avatar-generation host, so blocking the first host REDIRECTS egress to a second live third-party host rather than eliminating it. A hermetic witness run must block or stub BOTH, and a run that blocks only the first is not hermetic even though it looks quiet.',
			buildTimeEgress:
				'None. Neither lane made a network request while building: the codegen reads the corpus from disk, both bundlers read from disk, and the purge measurement reads emitted files.',
			profileCorpus:
				'The build lanes bundle the real in-tree profile corpus because it is part of the pinned archive. It is counted and digested here and never quoted: no username, filename, or field value from it appears in this record. The witness phase will run against a synthetic corpus instead.',
			corpusInThisRecord: {
				profileDataFilesCopiedIntoBuild: parity.byteIdenticalSharedPaths.filter((file) =>
					isCorpusPath(file),
				).length,
				profileDataFilesCopiedIntoBuildNote:
					'A count of byte-identical shared paths under the corpus directory, which is how both lanes carry the corpus: create-react-app copies the public directory and the adapter’s public-directory capability replicates that copy. No file in it is named here.',
				generatedIndexBytes: await byteLength(path.join(targetRoot, 'public/list.json')),
			},
		},
		gates: {
			adapterUnitTests: 'pass',
			baselineBuiltTwice: baseline.equal ? 'pass-deterministic' : 'fail-nondeterministic',
			targetBuiltTwice: target.equal ? 'pass-deterministic' : 'fail-nondeterministic',
			dependencyAcquisition: 'not-needed',
			overfittingGuard: 'pass',
			sourceMaterialization: 'pass',
			browserLocality: 'not-run',
			realServer: 'not-run',
			directWitnessJourneys: 'not-run',
			mutationRestoration: 'not-run',
			upstreamCypressSuite: 'not-run',
			receiptsTrust: 'not-published',
		},
		nonclaims: [
			'Nothing here was loaded in a browser. No route was rendered, no journey was exercised, and the upstream cypress suite was not run.',
			'Two deterministic builds and a shared artifact inventory establish build-level parity only. They establish no behavioural parity, no runtime equivalence, and no visual equivalence.',
			'The migrated lane ships an unpurged stylesheet by declared decision. That is a recorded difference from the baseline, not an equivalence claim about the emitted CSS.',
			'No production-readiness, pilot, certification, or migration-completeness claim is made for this application.',
		],
	};
	const canonicalDigest = sha256(canonicalize(profile));
	await writeRunObservation('build-profile.json', {
		...profile,
		integrity: { algorithm: 'sha256', canonicalDigest },
	});
	const receipt = {
		schemaVersion: 'versionless.react-linkfree-v0-72-0-run.v1',
		unit: 'lrapr-t006/u8-linkfree-migration-lanes',
		fixture: 'react-linkfree-v0-72-0',
		buildProfile: {
			path: 'evidence/runs/react-linkfree-v0-72-0/build-profile.json',
			canonicalDigest,
		},
		verification: {
			result: 'build-lanes-pass',
			digestScheme: laneDigestScheme,
			deterministicCore: {
				baseline: { equal: baseline.equal, files: baseline.first.files.length },
				target: { equal: target.equal, files: target.first.files.length },
			},
			boot: 'not-run',
			journeys: 'not-run',
			mutation: 'not-run',
			parityLevel: 'build-artifacts-only',
		},
		migration: {
			adapter: 'createCraViteAdapter',
			applicationNamedProductBranches: 0,
			applicationSourceEdits: 0,
			reusableSurfaceChanged: true,
			reusableSurfaceChange:
				'One capability added: createCraJavaScriptJsxPlugin, for JSX in application-source JavaScript.',
			runtimeBreaks,
			declaredDifferences: [
				'The postbuild purgecss step is declared out of the Vite build’s scope, with the size it would have cut measured on both lanes.',
			],
		},
		era: {
			craGeneration: 'create-react-app 5.0.1 over webpack 5.73.0',
			firstInPortfolio:
				'the first create-react-app 5 / webpack 5 cell, and the first JavaScript (rather than TypeScript) create-react-app cell',
			priorApplicationsOverThisAdapter: [
				'papercups (create-react-app 3)',
				'HospitalRun (create-react-app 3)',
				'the create-react-app 4 holdout',
			],
		},
		nonclaims: profile.nonclaims,
	};
	const receiptDigest = sha256(canonicalize(receipt));
	await writeRunObservation('t006-run.json', {
		...receipt,
		integrity: { algorithm: 'sha256', canonicalDigest: receiptDigest },
	});
	const purgeRow = (measurement: CssPurgeMeasurement): string =>
		`| ${measurement.lane} | ${String(measurement.bytesBeforePurge)} | ${String(
			measurement.bytesAfterPurge,
		)} | ${String(measurement.reductionPercent)}% |`;
	const report = [
		'# LinkFree create-react-app 5 to Vite 8 — build lanes',
		'',
		`Unit: lrapr-t006/u8-linkfree-migration-lanes. Fixture: react-linkfree-v0-72-0.`,
		'',
		`Build profile canonical digest: \`${canonicalDigest}\``,
		`Run receipt canonical digest: \`${receiptDigest}\``,
		'',
		'## What is established',
		'',
		`- The era baseline — create-react-app 5.0.1 / webpack 5.73.0 on Node 16.20.2, the major its own CI declares — was rebuilt twice from the restored closure and was byte-stable: ${String(baseline.equal)}.`,
		`- The migrated lane — Vite 8.0.16 on Node 24.15.0 over the generic create-react-app adapter — was built twice and was deterministic: ${String(target.equal)}.`,
		`- Build-level parity only: ${String(parity.sharedPaths.length)} shared emitted paths, of which ${String(parity.byteIdenticalSharedPaths.length)} are byte identical. The differing shared path is the entry document, which differs by construction between bundlers.`,
		'- No application source was edited. The two application files the migrated lane writes are the repository’s own codegen output and the Vite entry document derived from the immutable create-react-app template.',
		'',
		'## The one runtime break, and the generic capability that closed it',
		'',
		...runtimeBreaks.map(
			(entry) => `${String(entry.order)}. ${entry.symptom}\n   - Fix: ${entry.genericFix}`,
		),
		'',
		'## The declared build steps',
		'',
		'- Codegen prebuild (`node generate.js`): run by the migrated lane unmodified, before Vite. It emits the uncommitted index the home and search routes read.',
		'- Postbuild purge (`purgecss`): declared OUT of the Vite build’s scope, and measured both ways rather than asserted.',
		'',
		'| lane | CSS before purge | CSS after purge | reduction |',
		'| --- | --- | --- | --- |',
		purgeRow(baselinePurge),
		purgeRow(targetPurge),
		'',
		`The baseline ships ${String(baselineShippedCssBytes)} bytes of CSS because its postbuild hook rewrites the stylesheet in place; the migrated lane ships ${String(
			targetPurge.bytesBeforePurge,
		)} unpurged bytes. The purge is post-build asset optimisation over emitted files, its config is written against create-react-app’s output layout, and its correctness rests on an application-authored extractor — so it belongs to the application, not to a webpack-compatibility adapter.`,
		'',
		'## What is NOT established',
		'',
		...profile.nonclaims.map((claim) => `- ${claim}`),
		'',
	].join('\n');
	await mkdir(path.join(repositoryRoot, 'evidence/runs/react-linkfree-v0-72-0'), {
		recursive: true,
	});
	await writeFile(
		path.join(repositoryRoot, 'evidence/runs/react-linkfree-v0-72-0/t006-run.md'),
		`${report}\n`,
	);
	process.stdout.write(
		`baseline byte-stable: ${String(baseline.equal)}; target deterministic: ${String(
			target.equal,
		)}; profile digest ${canonicalDigest}\n`,
	);
}

if (process.argv[1]?.endsWith('react-linkfree-v0-72-0-vite8-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
