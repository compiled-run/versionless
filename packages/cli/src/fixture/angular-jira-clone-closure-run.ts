/**
 * Record the migrated closure and the one production build attempt made on it.
 *
 * mj1 left this cell red at the install: the migrated manifest asked for an
 * Angular 16.2 closure whose community layer still carried Angular 13 peers, and
 * npm refused it before fetching a single tarball. The cell now declares that
 * layer, so this driver records two things mj1 could not: that the closure
 * resolves and installs, and what the compiler then demands.
 *
 * The build is recorded as it happened. It is red, and the value of the record
 * is the itemisation: every demand the compiler made, by file, by symbol and by
 * the library that moved under it. That list is the input to the next unit. It
 * is not a defect list and it is not a failure report — a build that has not yet
 * been given its source transforms is expected to ask for them.
 *
 * The driver is fixture-scoped: it knows where this fixture's closure was
 * staged. Every decision about *what to change* lives in `@versionless/angular`,
 * which knows nothing about this application.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import { CONSENT_ID, MIGRATION_RECORD_FILE } from './angular-jira-clone-migration-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const evidenceDirectory = path.join(repositoryRoot, 'evidence/runs/angular-jira-clone');

export const STAGE_DIRECTORY = path.join(
	repositoryRoot,
	'.versionless/stage/angular-jira-clone-mj2',
);

export const UNIT = 'lrapr-t005/mj2-ecosystem-cell-closure';
export const CLOSURE_RECORD_FILE = 'mj2-migrated-closure.json';
export const ACQUISITION_RECORD_FILE = 'mj2-acquired-closure.json';

/**
 * What this record replaces.
 *
 * mj1's migrated lane recorded a state, not a lane: no install, no build, no
 * inventory. It is superseded rather than corrected — it was true about the cell
 * it described.
 */
export const SUPERSEDES = Object.freeze({
	record: 'mj1-migrated-lane.json',
	unit: 'lrapr-t005/mj1-jira-clone-migration-lanes',
	why: 'mj1 recorded the migrated lane as red at the closure install, with @ant-design/icons-angular@13.1.0 as the first unresolvable peer. The cell now declares the community layer that conflict came from, so the install this record describes is the same step mj1 attempted, on a manifest that resolves.',
});

export type LockEntry = Readonly<{ path: string; url: string; integrity: string }>;

/**
 * Every artifact the install acquired, read back out of the lockfile the install
 * wrote rather than out of a log: the lockfile is what the resolver committed
 * to, and it carries the integrity digest for each one.
 */
export function acquiredArtifacts(lockfile: string): readonly LockEntry[] {
	const parsed: unknown = JSON.parse(lockfile);
	if (typeof parsed !== 'object' || parsed === null)
		throw new Error('Angular closure record: the lockfile is not a JSON object');
	const packages = (parsed as Record<string, unknown>)['packages'];
	if (typeof packages !== 'object' || packages === null)
		throw new Error('Angular closure record: the lockfile declares no packages');
	const entries: LockEntry[] = [];
	for (const [key, value] of Object.entries(packages as Record<string, unknown>)) {
		if (typeof value !== 'object' || value === null) continue;
		const entry = value as Record<string, unknown>;
		const url = entry['resolved'];
		const integrity = entry['integrity'];
		if (typeof url !== 'string' || typeof integrity !== 'string') continue;
		entries.push({ path: key, url, integrity });
	}
	return Object.freeze(
		entries.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0)),
	);
}

/** Hosts the acquisition is allowed to have reached, as observed. */
export function acquisitionHosts(entries: readonly LockEntry[]): readonly string[] {
	const hosts = new Set<string>();
	for (const entry of entries) hosts.add(new URL(entry.url).host);
	return Object.freeze([...hosts].sort());
}

/**
 * The compiler's demands, itemised from the recorded build log.
 *
 * Each item names the file, the symbol, the library that moved and the transform
 * the demand asks for. The `observed` field is the compiler's own words, quoted
 * from the log this driver reads; everything else is this record's reading of
 * them, and is labelled as such rather than presented as compiler output.
 */
export type BuildDemand = Readonly<{
	file: string;
	symbol: string;
	library: string;
	observed: string;
	neededTransform: string;
}>;

export const BUILD_DEMANDS: readonly BuildDemand[] = Object.freeze([
	Object.freeze({
		file: 'src/main.ts',
		symbol: "import { Integrations } from '@sentry/tracing'",
		library: '@sentry/tracing → @sentry/angular 8',
		observed:
			"src/main.ts:4:30 - error TS2307: Cannot find module '@sentry/tracing' or its corresponding type declarations. / ./src/main.ts:4:0-47 - Error: Module not found: Error: Can't resolve '@sentry/tracing'",
		neededTransform:
			'The package was dropped by the cell as a no-successor package. The v8 SDK exposes tracing from @sentry/angular itself, so the import has to move and the `Integrations.BrowserTracing` construction it fed has to become the integration factory the v8 SDK exports.',
	}),
	Object.freeze({
		file: 'src/main.ts',
		symbol: 'Sentry.routingInstrumentation',
		library: '@sentry/angular 6 → 8',
		observed:
			"src/main.ts:15:40 - error TS2339: Property 'routingInstrumentation' does not exist on type 'typeof import(\"@sentry/angular\")' / ./src/main.ts:13:30-59 - Error: export 'routingInstrumentation' (imported as 'Sentry') was not found in '@sentry/angular'",
		neededTransform:
			'The v8 SDK removed the standalone routing instrumentation hook; the browser tracing integration performs the routing instrumentation itself. The `routingInstrumentation` option passed into the tracing integration has to go, and whatever the v8 integration takes in its place has to be established from the library rather than guessed.',
	}),
	Object.freeze({
		file: 'src/styles.scss',
		symbol: "@import 'ng-zorro-antd/style/index.min.css' and eight sibling component imports",
		library: 'ng-zorro-antd 13 → 16',
		observed:
			'./src/styles.scss - Error: Module build failed (from ./node_modules/css-loader/dist/cjs.js): Error: "./style/index.min.css" is not exported under the condition "style" from package .../node_modules/ng-zorro-antd (see exports field in .../ng-zorro-antd/package.json)',
		neededTransform:
			'ng-zorro-antd 16 publishes an `exports` map, and the era stylesheet paths are not in it under the `style` condition webpack resolves stylesheets with. Every one of the nine style imports has to be rewritten to a path the package exports, or the stylesheet entry point the package does export has to replace them.',
	}),
	Object.freeze({
		file: 'node_modules/ng-zorro-antd/fesm2022/ng-zorro-antd-core-color.mjs and -core-config.mjs',
		symbol: "import '@ctrl/tinycolor'",
		library: 'ng-zorro-antd 16.2.2',
		observed:
			"./node_modules/ng-zorro-antd/fesm2022/ng-zorro-antd-core-color.mjs:1:0-65 - Error: Module not found: Error: Can't resolve '@ctrl/tinycolor'",
		neededTransform:
			'ng-zorro-antd 16.2.2 imports @ctrl/tinycolor from two of its own bundles but declares it in neither `dependencies` nor `peerDependencies`, so the resolved closure does not contain it. This is a demand of the library on its consumer, not of the application on itself: the manifest has to carry the package the library omitted, and that is a cell-level fact about ng-zorro-antd rather than a source transform.',
	}),
	Object.freeze({
		file: 'src/app/project/components/issues/issue-card/issue-card.component.ts:45, src/app/project/components/issues/issue-detail/issue-detail.component.ts:31, src/app/project/components/search/search-drawer/search-drawer.component.ts:60',
		symbol: 'nzComponentParams in NzModalService.create options',
		library: 'ng-zorro-antd 13 → 16',
		observed:
			"error TS2345: Object literal may only specify known properties, and 'nzComponentParams' does not exist in type 'ModalOptions<…>'",
		neededTransform:
			'`ModalOptions.nzComponentParams` was removed from the ng-zorro-antd modal API. Three call sites pass component inputs through it. The replacement the library offers has to be read off the 16 API and applied at each site; the three sites are the same shape, so one transform covers them.',
	}),
]);

export const NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'The closure resolves and installs. That establishes nothing about whether the application compiles: it did not, and the demands above are why.',
	'No migrated artifact exists, so there is still no build-level parity for this cell and no inventory to compare with the era lane.',
	'No browser opened anything here. Nothing about behaviour, runtime parity or user-visible equivalence is observed.',
	'The itemisation is this record’s reading of one build log on one host. A second host, or a later resolution of the same ranges, could surface demands this list does not carry.',
	'The dropped packages are recorded as dropped. Nothing here establishes that the capabilities they provided — Sentry tracing, the Storybook analytics addon, the TSLint lint gate — are replaced, or that the application no longer needs them.',
	'Nothing here is a production-readiness, pilot, certification or general Angular support claim.',
]);

export const RECORDED_RISKS: readonly string[] = Object.freeze([
	'The application initialises Sentry with a hard-coded DSN in src/main.ts. Its value is deliberately not reproduced anywhere in this evidence tree.',
	'The application initialises Google Analytics with a hard-coded measurement id in src/app/core/services/google-analytics.service.ts. Its value is deliberately not reproduced anywhere in this evidence tree.',
	'The install reached the public npm registry under the recorded consent and wrote 1,981 packages into a staged tree outside this repository. No package was executed beyond the lifecycle scripts npm runs on install, and no build product of that tree is committed here.',
]);

export type SealedRecord = Readonly<Record<string, unknown>> & Readonly<{ digest: string }>;

export function seal(body: Readonly<Record<string, unknown>>): SealedRecord {
	return Object.freeze({ ...body, digest: sha256(canonical(body)) });
}

export function verifySeal(record: SealedRecord): SealedRecord {
	const { digest, ...body } = record;
	const recomputed = sha256(canonical(body));
	if (recomputed !== digest)
		throw new Error(
			`Angular jira-clone closure record digest differs: recorded ${digest}, recomputed ${recomputed}`,
		);
	return record;
}

export function buildClosureRecord(input: {
	manifest: string;
	lockfile: string;
	installExitStatus: number;
	installStderrWarningKinds: readonly string[];
	buildExitStatus: number;
	buildErrorLines: readonly string[];
	packagesAdded: number;
}): { closure: SealedRecord; acquisition: SealedRecord } {
	const artifacts = acquiredArtifacts(input.lockfile);
	const acquisition = seal({
		schemaVersion: 'versionless.angular-jira-clone-acquired-closure.v1',
		unit: UNIT,
		consentId: CONSENT_ID,
		meaning:
			'Every artifact the migrated closure install acquired, with the URL it came from and the integrity digest the resolver committed to. Read back out of the lockfile the install wrote.',
		networkMode: 'consented',
		hosts: acquisitionHosts(artifacts),
		count: artifacts.length,
		artifacts,
	});
	const closure = seal({
		schemaVersion: 'versionless.angular-jira-clone-migrated-closure.v1',
		unit: UNIT,
		consentId: CONSENT_ID,
		result:
			input.installExitStatus === 0
				? input.buildExitStatus === 0
					? 'closure-resolved-build-green'
					: 'closure-resolved-build-red-itemised'
				: 'closure-unresolved',
		meaning:
			'The migrated manifest the extended cell produces resolves and installs. The production build was then run once and is recorded as it happened: red, with every demand the compiler made itemised below. No source transform was attempted in this unit.',
		supersedes: SUPERSEDES,
		changeset: MIGRATION_RECORD_FILE,
		cell: {
			node: 'v16.20.2',
			architecture: 'darwin-arm64, native — no translation layer',
			npm: '8.19.4 (bundled with the runtime)',
			builder: '@angular-devkit/build-angular:browser (Angular 16.2), the builder the absorption restored',
			environment: { NG_CLI_ANALYTICS: 'false' },
		},
		acquisition: {
			purpose: 'Install the declared Angular 16.2 dependency closure the migrated manifest asks for.',
			consentId: CONSENT_ID,
			networkMode: 'consented',
			method:
				'npm install --no-audit --no-fund (no lockfile carried over: the era lockfileVersion 2 pins the Angular 13 closure)',
			outcome: input.installExitStatus === 0 ? 'succeeded' : 'failed',
			exitStatus: input.installExitStatus,
			packagesAdded: input.packagesAdded,
			migratedManifestSha256: sha256(input.manifest),
			lockfileSha256: sha256(input.lockfile),
			artifactsAcquired: artifacts.length,
			artifactRecord: ACQUISITION_RECORD_FILE,
			hosts: acquisitionHosts(artifacts),
			warningKinds: input.installStderrWarningKinds,
			warningNote:
				'The install emitted engine warnings only. npm was not run with engine-strict, so a package declaring a Node line this cell does not meet was installed with a warning rather than refused; each such package is a transitive dependency, not one this cell names.',
		},
		buildAttempt: {
			command: 'npx ng build --configuration production',
			runs: 1,
			exitStatus: input.buildExitStatus,
			outcome: input.buildExitStatus === 0 ? 'green' : 'red',
			artifactsEmitted: 0,
			demands: BUILD_DEMANDS,
			observedErrorLines: input.buildErrorLines,
			itemisationMeaning:
				'This list is the product of this unit, not a defect report. Each demand is a transform the migrated source has not yet been given; deciding and applying them is the next unit’s work.',
		},
		notEstablished: NOT_ESTABLISHED,
		recordedRisks: RECORDED_RISKS,
	});
	return { closure, acquisition };
}

/** Error lines the build log carries, quoted rather than summarised. */
export function buildErrorLinesOf(log: string): readonly string[] {
	return Object.freeze(
		log
			.split('\n')
			.filter((line) => line.startsWith('Error:') || line.includes(' - Error: '))
			.map((line) => (line.length > 400 ? `${line.slice(0, 400)}…` : line)),
	);
}

/** The distinct kinds of warning the install emitted, without their volume. */
export function warningKindsOf(log: string): readonly string[] {
	const kinds = new Set<string>();
	for (const line of log.split('\n')) {
		const marker = line.startsWith('npm WARN ') ? line.slice(9).split(' ')[0] : undefined;
		if (marker !== undefined && marker.length > 0) kinds.add(marker);
	}
	return Object.freeze([...kinds].sort());
}

async function readNumberFrom(file: string, prefix: string): Promise<number> {
	const text = await readFile(file, 'utf8');
	const line = text.split('\n').find((entry) => entry.startsWith(prefix));
	if (line === undefined) throw new Error(`Angular closure record: no "${prefix}" line in ${file}`);
	const value = Number.parseInt(line.slice(prefix.length), 10);
	if (Number.isNaN(value)) throw new Error(`Angular closure record: "${line}" is not a status`);
	return value;
}

function packagesAddedFrom(log: string): number {
	for (const line of log.split('\n')) {
		if (!line.startsWith('added ')) continue;
		const value = Number.parseInt(line.slice(6).split(' ')[0] ?? '', 10);
		if (!Number.isNaN(value)) return value;
	}
	throw new Error('Angular closure record: the install log records no package count');
}

export async function main(): Promise<void> {
	const read = async (name: string): Promise<string> =>
		readFile(path.join(STAGE_DIRECTORY, name), 'utf8');
	const installStdout = await read('install-1.stdout.log');
	const records = buildClosureRecord({
		manifest: await read('app/package.json'),
		lockfile: await read('app/package-lock.json'),
		installExitStatus: await readNumberFrom(path.join(STAGE_DIRECTORY, 'install-1.exit'), 'EXIT='),
		installStderrWarningKinds: warningKindsOf(await read('install-1.stderr.log')),
		buildExitStatus: await readNumberFrom(path.join(STAGE_DIRECTORY, 'build-1.exit'), 'EXIT='),
		buildErrorLines: buildErrorLinesOf(await read('build-1.stderr.log')),
		packagesAdded: packagesAddedFrom(installStdout),
	});
	await mkdir(evidenceDirectory, { recursive: true });
	await writeFile(
		path.join(evidenceDirectory, CLOSURE_RECORD_FILE),
		canonical(verifySeal(records.closure)),
	);
	await writeFile(
		path.join(evidenceDirectory, ACQUISITION_RECORD_FILE),
		canonical(verifySeal(records.acquisition)),
	);
	process.stdout.write(
		`closure: ${String(records.closure['result'])}; artifacts ${String(
			(records.acquisition['count'] as number) ?? 0,
		)}; demands ${String(BUILD_DEMANDS.length)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-jira-clone-closure-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
