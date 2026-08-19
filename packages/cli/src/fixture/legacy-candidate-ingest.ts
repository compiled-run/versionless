// Generic legacy-corpus candidate ingest machinery.
//
// One admitted legacy application is described by a LegacyCandidateConfig; every stage below is a
// pure function of that configuration plus injected bytes, so the acquisition shape, the archive to
// git-tree reconciliation, the dependency closure, and the baseline install/build record can all be
// exercised offline. Only the default transport, extractor, and step runner touch the host, and the
// acquisition entry point refuses to run without exact purpose-bound consent.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { charIn, createRegExp } from 'magic-regexp';
import { join, relative, resolve } from 'pathe';
import { joinURL, parseURL, withQuery } from 'ufo';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const LEGACY_CORPUS_CONSENT = 'VL-LEGACY-CORPUS-2026-08-10' as const;

export const lowerHex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
export const lowerHex64 = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);

export type LegacyCandidateId = 'react-papercups-v1-0-0';

export type LegacyAcquisitionCaps = Readonly<{
	maximumAcceptedResponses: number;
	maximumApiResponseBytes: number;
	maximumArchiveBytes: number;
	maximumAggregateWireBytes: number;
	maximumAggregateDecodedBytes: number;
	requiredArchiveStreams: number;
}>;

export type LegacyCandidateConfig = Readonly<{
	id: LegacyCandidateId;
	consentId: typeof LEGACY_CORPUS_CONSENT;
	owner: string;
	repository: string;
	tag: string;
	frontendRoot: string;
	lockFileName: string;
	caps: LegacyAcquisitionCaps;
	requiredRevisionWindow: Readonly<{ from: string; through: string }>;
	legacyCell: Readonly<{
		installCommand: readonly string[];
		buildCommand: readonly string[];
		buildOutputDirectory: string;
	}>;
}>;

const defaultCaps: LegacyAcquisitionCaps = {
	maximumAcceptedResponses: 7,
	maximumApiResponseBytes: 16_777_216,
	maximumArchiveBytes: 134_217_728,
	maximumAggregateWireBytes: 314_572_800,
	maximumAggregateDecodedBytes: 314_572_800,
	requiredArchiveStreams: 2,
};

/**
 * The applications this module's *network acquisition* path is consented for.
 *
 * This list is no longer an admission gate. Admission runs through the
 * `ingest` and `license-at-pin` operator stages
 * (`packages/cli/src/operator/ingest.ts`), which read an application source that
 * is already on disk and require no entry here, no per-application module, and
 * no source edit. What still reads this list is the network half and the
 * evidence it published:
 *
 * - `versionless fixture:ingest --fixture <id>` (`packages/cli/src/cli.ts`),
 *   which acquires an official source over the network under the exact
 *   purpose-bound consent each entry carries;
 * - `versionless fixture:verify --fixture <id>`, which re-verifies the sealed
 *   `evidence/ingests/<id>/` documents that acquisition published;
 * - `isLegacyCandidateId` and `legacyCandidateConfig` below, which serve those
 *   two commands and their tests.
 *
 * An entry is therefore a record of consent already given for a named remote
 * repository, not a permission to migrate. Nothing an operator runs against a
 * local application source consults it.
 */
export const legacyCandidates: readonly LegacyCandidateConfig[] = [
	{
		id: 'react-papercups-v1-0-0',
		consentId: LEGACY_CORPUS_CONSENT,
		owner: 'papercups-io',
		repository: 'papercups',
		tag: 'v1.0.0',
		frontendRoot: 'assets',
		lockFileName: 'package-lock.json',
		caps: defaultCaps,
		requiredRevisionWindow: { from: '2018-01-01T00:00:00Z', through: '2023-08-10T00:00:00Z' },
		legacyCell: {
			installCommand: ['ci', '--ignore-scripts', '--no-audit', '--no-fund'],
			buildCommand: ['run', 'build'],
			buildOutputDirectory: 'build',
		},
	},
] as const;

export function isLegacyCandidateId(id: string | undefined): id is LegacyCandidateId {
	return legacyCandidates.some((candidate) => candidate.id === id);
}

export function legacyCandidateConfig(id: string | undefined): LegacyCandidateConfig {
	const candidate = legacyCandidates.find((entry) => entry.id === id);
	if (!candidate) throw new Error(`Unknown legacy corpus candidate: ${String(id)}`);
	return candidate;
}

export const workspaceRoot = resolve(import.meta.dirname, '../../../..');
export const evidenceRootFor = (config: LegacyCandidateConfig): string =>
	`evidence/ingests/${config.id}`;
export const cacheRootFor = (config: LegacyCandidateConfig): string =>
	`.versionless/cache/${config.id}-source`;
export const workRootFor = (config: LegacyCandidateConfig): string =>
	`.versionless/work/${config.id}/legacy`;

const apiOrigin = 'https://api.github.com';
const archiveOrigin = 'https://codeload.github.com';
const acquisitionHosts: readonly string[] = ['api.github.com', 'codeload.github.com'];

export const repositoryEndpoint = (config: LegacyCandidateConfig): string =>
	joinURL(apiOrigin, 'repos', config.owner, config.repository);
export const tagRefEndpoint = (config: LegacyCandidateConfig): string =>
	joinURL(repositoryEndpoint(config), 'git/ref/tags', config.tag);
export const tagObjectEndpoint = (config: LegacyCandidateConfig, sha: string): string =>
	joinURL(repositoryEndpoint(config), 'git/tags', sha);
export const commitEndpoint = (config: LegacyCandidateConfig, sha: string): string =>
	joinURL(repositoryEndpoint(config), 'git/commits', sha);
export const treeEndpoint = (config: LegacyCandidateConfig, sha: string): string =>
	withQuery(joinURL(repositoryEndpoint(config), 'git/trees', sha), { recursive: '1' });
export const blobEndpoint = (config: LegacyCandidateConfig, sha: string): string =>
	joinURL(repositoryEndpoint(config), 'git/blobs', sha);
export const archiveEndpoint = (config: LegacyCandidateConfig, commitSha: string): string =>
	joinURL(archiveOrigin, config.owner, config.repository, 'tar.gz', commitSha);

export function candidateAllowlist(config: LegacyCandidateConfig): readonly string[] {
	return [
		repositoryEndpoint(config),
		tagRefEndpoint(config),
		commitEndpoint(config, '<validated-commit-sha>'),
		treeEndpoint(config, '<validated-tree-sha>'),
		archiveEndpoint(config, '<validated-commit-sha>'),
	];
}

export function assertAllowedAcquisitionUrl(url: string, config: LegacyCandidateConfig): void {
	const parsed = parseURL(url);
	const repositoryPath = `/repos/${config.owner}/${config.repository}`;
	const archivePath = `/${config.owner}/${config.repository}/tar.gz/`;
	if (
		parsed.protocol !== 'https:' ||
		!acquisitionHosts.includes(parsed.host ?? '') ||
		parsed.auth ||
		parsed.hash ||
		(parsed.host === 'api.github.com'
			? !(
					parsed.pathname === repositoryPath ||
					parsed.pathname.startsWith(`${repositoryPath}/`)
				)
			: !parsed.pathname.startsWith(archivePath))
	)
		throw new Error(`Legacy acquisition URL is outside literal consent: ${url}`);
}

export type LegacyAcquisitionAttempt = Readonly<{
	schemaVersion: 'versionless.official-source-attempt.v1';
	candidate: Readonly<{ repository: string; requestedTag: string }>;
	consentId: string;
	result: 'started';
	network: Readonly<{
		method: 'GET';
		credentials: 'none';
		requestEncoding: 'identity';
		redirectsAllowed: false;
		retriesAllowed: false;
		alternateHostsAllowed: false;
	}>;
	allowlist: readonly string[];
	caps: LegacyAcquisitionCaps;
	requiredRevisionWindow: Readonly<{ from: string; through: string }>;
	publication: Readonly<{
		evidenceRoot: string;
		cacheRoot: string;
		transactional: true;
		readinessCredit: false;
	}>;
	nonclaims: readonly string[];
}>;

export function acquisitionAttempt(config: LegacyCandidateConfig): LegacyAcquisitionAttempt {
	return {
		schemaVersion: 'versionless.official-source-attempt.v1',
		candidate: {
			repository: `${config.owner}/${config.repository}`,
			requestedTag: config.tag,
		},
		consentId: config.consentId,
		result: 'started',
		network: {
			method: 'GET',
			credentials: 'none',
			requestEncoding: 'identity',
			redirectsAllowed: false,
			retriesAllowed: false,
			alternateHostsAllowed: false,
		},
		allowlist: candidateAllowlist(config),
		caps: config.caps,
		requiredRevisionWindow: config.requiredRevisionWindow,
		publication: {
			evidenceRoot: evidenceRootFor(config),
			cacheRoot: cacheRootFor(config),
			transactional: true,
			readinessCredit: false,
		},
		nonclaims: [
			'Starting this transaction establishes no tag identity, license, source integrity, dependency closure, framework, build, browser behavior, migration feasibility, pilot status, or production readiness.',
			'The resulting evidence is reproducibility evidence, not certification or legal approval.',
		],
	};
}

export const documentBytes = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export function gitBlobId(bytes: Uint8Array): string {
	const header = Buffer.from(`blob ${bytes.byteLength}\0`);
	return createHash('sha1')
		.update(Buffer.concat([header, Buffer.from(bytes)]))
		.digest('hex');
}

export type TreeRow = Readonly<{ path: string; mode: string; type: string; sha: string }>;

export type TreeSummary = Readonly<{
	treeEntries: number;
	treeBlobs: number;
	treeDirectories: number;
	treeSymlinks: number;
	treeGitlinks: number;
}>;

export function summarizeTree(rows: readonly TreeRow[]): TreeSummary {
	return {
		treeEntries: rows.length,
		treeBlobs: rows.filter((row) => row.type === 'blob').length,
		treeDirectories: rows.filter((row) => row.type === 'tree').length,
		treeSymlinks: rows.filter((row) => row.mode === '120000').length,
		treeGitlinks: rows.filter((row) => row.type === 'commit').length,
	};
}

export function regularBlobIndex(rows: readonly TreeRow[]): Map<string, string> {
	return new Map(
		rows
			.filter((row) => row.type === 'blob' && row.mode !== '120000')
			.map((row) => [row.path, row.sha]),
	);
}

export type ExtractedFile = Readonly<{ path: string; bytes: Uint8Array }>;

export type NormalizedManifest = Readonly<{ text: string; sha256: string }>;

export function normalizedManifest(files: readonly ExtractedFile[]): NormalizedManifest {
	const lines = files
		.map((file) => `${file.path} ${sha256(Buffer.from(file.bytes))} ${file.bytes.byteLength}`)
		.sort();
	const text = `${lines.join('\n')}\n`;
	return { text, sha256: sha256(Buffer.from(text, 'utf8')) };
}

export type ArchiveParity = Readonly<{
	singleRoot: string;
	safeEntries: number;
	regularFiles: number;
	directories: number;
	specialEntries: number;
	gitBlobs: number;
	missingFiles: number;
	extraFiles: number;
	mismatchedBlobs: number;
	normalizedManifestSha256: string;
}>;

export function reconcileArchiveWithTree(input: {
	singleRoot: string;
	rows: readonly TreeRow[];
	files: readonly ExtractedFile[];
	directories: number;
	specialEntries: number;
}): ArchiveParity {
	const blobs = regularBlobIndex(input.rows);
	const seen = new Set<string>();
	let mismatchedBlobs = 0;
	let extraFiles = 0;
	for (const file of input.files) {
		const expected = blobs.get(file.path);
		if (expected === undefined) extraFiles += 1;
		else {
			seen.add(file.path);
			if (gitBlobId(file.bytes) !== expected) mismatchedBlobs += 1;
		}
	}
	return {
		singleRoot: input.singleRoot,
		safeEntries: input.files.length + input.directories,
		regularFiles: input.files.length,
		directories: input.directories,
		specialEntries: input.specialEntries,
		gitBlobs: blobs.size,
		missingFiles: blobs.size - seen.size,
		extraFiles,
		mismatchedBlobs,
		normalizedManifestSha256: normalizedManifest(input.files).sha256,
	};
}

export const archiveMatchesGitTree = (parity: ArchiveParity): boolean =>
	parity.mismatchedBlobs === 0 && parity.missingFiles === 0 && parity.extraFiles === 0;

type LockNode = Readonly<{
	version?: unknown;
	resolved?: unknown;
	integrity?: unknown;
	dependencies?: unknown;
	dev?: unknown;
	optional?: unknown;
	bundled?: unknown;
}>;

export type LockPlacement = Readonly<{
	name: string;
	version: string;
	path: string;
	resolved: string | null;
	integrity: string | null;
	dev: boolean;
	optional: boolean;
	bundled: boolean;
}>;

export function collectLockPlacements(lock: unknown): LockPlacement[] {
	const placements: LockPlacement[] = [];
	const walk = (dependencies: unknown, parents: readonly string[]): void => {
		if (dependencies === undefined || dependencies === null) return;
		if (typeof dependencies !== 'object' || Array.isArray(dependencies))
			throw new Error('Legacy lock dependencies must be an object');
		for (const [name, value] of Object.entries(dependencies as Record<string, unknown>)) {
			if (!value || typeof value !== 'object' || Array.isArray(value))
				throw new Error(`Legacy lock node differs: ${[...parents, name].join('/')}`);
			const node = value as LockNode;
			if (typeof node.version !== 'string')
				throw new Error(`Legacy lock version differs: ${[...parents, name].join('/')}`);
			placements.push({
				name,
				version: node.version,
				path: [...parents, name].join('/'),
				resolved: typeof node.resolved === 'string' ? node.resolved : null,
				integrity: typeof node.integrity === 'string' ? node.integrity : null,
				dev: node.dev === true,
				optional: node.optional === true,
				bundled: node.bundled === true,
			});
			walk(node.dependencies, [...parents, name]);
		}
	};
	if (!lock || typeof lock !== 'object' || Array.isArray(lock))
		throw new Error('Legacy lock document must be an object');
	walk((lock as { dependencies?: unknown }).dependencies, []);
	return placements;
}

/**
 * What `analyzeLegacyLockClosure` actually reads off a candidate.
 *
 * The closure analysis never needed the acquisition half of a
 * `LegacyCandidateConfig` — no consent id, no owner, no caps, no revision
 * window. Naming the three fields it does read is what lets the generic
 * `ingest` operator stage produce the same `versionless.legacy-dependency-closure.v1`
 * record for an application that has no entry in `legacyCandidates` and no
 * per-application module. A `LegacyCandidateConfig` still satisfies it, so
 * every existing caller is unchanged.
 */
export type LegacyClosureIdentity = Readonly<{
	id: string;
	frontendRoot: string;
	lockFileName: string;
}>;

export type LegacyClosureRecord = Readonly<{
	schemaVersion: 'versionless.legacy-dependency-closure.v1';
	slug: string;
	frontendRoot: string;
	source: Readonly<{
		verifiedSourceRoot: string;
		packageJsonSha256: string;
		packageLockSha256: string;
		packageLockBytes: number;
	}>;
	lockState: Readonly<{
		file: string;
		lockfileVersion: number | null;
		requiresField: boolean | null;
		committedWithSource: true;
		coversDevDependencies: boolean;
		everyEntryHasResolvedUrl: boolean;
		everyEntryHasIntegrityHash: boolean;
		entriesWithoutResolvedUrl: readonly string[];
		entriesWithoutIntegrityHash: readonly string[];
		lockfileIntegrityAlgorithms: readonly string[];
	}>;
	counts: Readonly<{
		declaredDependencies: number;
		declaredDevDependencies: number;
		lockedPlacements: number;
		distinctNameVersionPairs: number;
		devPlacements: number;
		optionalPlacements: number;
		bundledPlacements: number;
	}>;
	registryHosts: Readonly<Record<string, number>>;
	closureSha256: string;
	nonclaims: readonly string[];
}>;

export function analyzeLegacyLockClosure(
	config: LegacyClosureIdentity,
	input: {
		verifiedSourceRoot: string;
		packageBytes: Uint8Array;
		lockBytes: Uint8Array;
	},
): LegacyClosureRecord {
	const manifest = JSON.parse(Buffer.from(input.packageBytes).toString('utf8')) as {
		dependencies?: Record<string, unknown>;
		devDependencies?: Record<string, unknown>;
	};
	const lock = JSON.parse(Buffer.from(input.lockBytes).toString('utf8')) as {
		lockfileVersion?: unknown;
		requires?: unknown;
	};
	const placements = collectLockPlacements(lock);
	const hosts = new Map<string, number>();
	for (const placement of placements) {
		if (placement.resolved === null) continue;
		const host = parseURL(placement.resolved).host ?? '';
		hosts.set(host, (hosts.get(host) ?? 0) + 1);
	}
	const withoutResolved = placements.filter(
		(placement) => placement.resolved === null && !placement.bundled,
	);
	const withoutIntegrity = placements.filter(
		(placement) => placement.integrity === null && !placement.bundled,
	);
	const closureLines = placements
		.map(
			(placement) =>
				`${placement.path} ${placement.version} ${placement.integrity ?? 'none'}`,
		)
		.sort();
	return {
		schemaVersion: 'versionless.legacy-dependency-closure.v1',
		slug: config.id,
		frontendRoot: config.frontendRoot,
		source: {
			verifiedSourceRoot: input.verifiedSourceRoot,
			packageJsonSha256: sha256(Buffer.from(input.packageBytes)),
			packageLockSha256: sha256(Buffer.from(input.lockBytes)),
			packageLockBytes: input.lockBytes.byteLength,
		},
		lockState: {
			file: config.lockFileName,
			lockfileVersion: typeof lock.lockfileVersion === 'number' ? lock.lockfileVersion : null,
			requiresField: typeof lock.requires === 'boolean' ? lock.requires : null,
			committedWithSource: true,
			coversDevDependencies: placements.some((placement) => placement.dev),
			everyEntryHasResolvedUrl: withoutResolved.length === 0,
			everyEntryHasIntegrityHash: withoutIntegrity.length === 0,
			entriesWithoutResolvedUrl: withoutResolved.map((placement) => placement.path),
			entriesWithoutIntegrityHash: withoutIntegrity.map((placement) => placement.path),
			lockfileIntegrityAlgorithms: [
				...new Set(
					placements.map(
						(placement) => (placement.integrity ?? 'none').split('-')[0] ?? 'none',
					),
				),
			].sort(),
		},
		counts: {
			declaredDependencies: Object.keys(manifest.dependencies ?? {}).length,
			declaredDevDependencies: Object.keys(manifest.devDependencies ?? {}).length,
			lockedPlacements: placements.length,
			distinctNameVersionPairs: new Set(
				placements.map((placement) => `${placement.name}@${placement.version}`),
			).size,
			devPlacements: placements.filter((placement) => placement.dev).length,
			optionalPlacements: placements.filter((placement) => placement.optional).length,
			bundledPlacements: placements.filter((placement) => placement.bundled).length,
		},
		registryHosts: Object.fromEntries(
			[...hosts].sort(([left], [right]) => compare(left, right)),
		),
		closureSha256: sha256(Buffer.from(`${closureLines.join('\n')}\n`, 'utf8')),
		nonclaims: [
			'Per-artifact byte digests were not independently mirrored in this unit; the recorded integrity hashes are the ones the committed lockfile declares.',
			'A resolvable closure establishes no build, browser behavior, licence compatibility of transitive dependencies, migration feasibility, or production readiness.',
		],
	};
}

export const compare = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;

export type LegacyStepOutcome = Readonly<{
	exitCode: number | null;
	signal: string | null;
	stdout: string;
	stderr: string;
}>;
export type LegacyStepRunner = (args: readonly string[]) => LegacyStepOutcome;
export type LegacyClock = Readonly<{ now: () => Date; elapsedMs: () => number }>;

export type LegacyBaselineStep = Readonly<{
	name: string;
	command: string;
	startedAt: string;
	durationMs: number;
	exitCode: number | null;
	signal: string | null;
	outcome: 'succeeded' | 'failed';
	stdoutBytes: number;
	stderrBytes: number;
	stdoutSha256: string;
	stderrSha256: string;
	stdoutTail: string;
	stderrTail: string;
}>;

const tail = (text: string): string => text.split('\n').slice(-40).join('\n').trim();

export function recordLegacyStep(input: {
	name: string;
	args: readonly string[];
	startedAt: string;
	durationMs: number;
	outcome: LegacyStepOutcome;
}): LegacyBaselineStep {
	const { stdout, stderr } = input.outcome;
	return {
		name: input.name,
		command: `npm ${input.args.join(' ')}`,
		startedAt: input.startedAt,
		durationMs: input.durationMs,
		exitCode: input.outcome.exitCode,
		signal: input.outcome.signal,
		outcome: input.outcome.exitCode === 0 ? 'succeeded' : 'failed',
		stdoutBytes: Buffer.byteLength(stdout),
		stderrBytes: Buffer.byteLength(stderr),
		stdoutSha256: sha256(Buffer.from(stdout)),
		stderrSha256: sha256(Buffer.from(stderr)),
		stdoutTail: tail(stdout),
		stderrTail: tail(stderr),
	};
}

export type LegacyBaselineArtifacts = Readonly<{
	root: string;
	files: number;
	bytes: number;
	manifestSha256: string;
}>;

export type LegacyBaselineRecord = Readonly<{
	schemaVersion: 'versionless.legacy-baseline-attempt.v1';
	slug: LegacyCandidateId;
	cell: Readonly<{
		node: string;
		npm: string;
		platform: string;
		lifecycleScripts: string;
		network: string;
	}>;
	workRoot: string;
	steps: readonly LegacyBaselineStep[];
	outcome: 'succeeded' | 'failed';
	artifacts: LegacyBaselineArtifacts | null;
	nonclaims: readonly string[];
}>;

// A build step only runs when the install step succeeded: a failing install is recorded, not repaired.
export function runLegacyBaselineSteps(
	config: LegacyCandidateConfig,
	runner: LegacyStepRunner,
	clock: LegacyClock = systemClock(),
): LegacyBaselineStep[] {
	const steps: LegacyBaselineStep[] = [];
	const execute = (name: string, args: readonly string[]): LegacyBaselineStep => {
		const startedAt = clock.now().toISOString();
		const started = clock.elapsedMs();
		const outcome = runner(args);
		return recordLegacyStep({
			name,
			args,
			startedAt,
			durationMs: clock.elapsedMs() - started,
			outcome,
		});
	};
	const install = execute('install', config.legacyCell.installCommand);
	steps.push(install);
	if (install.exitCode === 0) steps.push(execute('build', config.legacyCell.buildCommand));
	return steps;
}

export function systemClock(): LegacyClock {
	return { now: () => new Date(), elapsedMs: () => Date.now() };
}

export function composeLegacyBaseline(input: {
	config: LegacyCandidateConfig;
	cell: LegacyBaselineRecord['cell'];
	steps: readonly LegacyBaselineStep[];
	artifacts: LegacyBaselineArtifacts | null;
}): LegacyBaselineRecord {
	const last = input.steps.at(-1);
	if (!last) throw new Error('Legacy baseline requires at least one recorded step');
	return {
		schemaVersion: 'versionless.legacy-baseline-attempt.v1',
		slug: input.config.id,
		cell: input.cell,
		workRoot: workRootFor(input.config),
		steps: input.steps,
		outcome: last.outcome,
		artifacts: input.artifacts,
		nonclaims: [
			'A recorded install or build outcome establishes no browser behavior, journey coverage, migration feasibility, pilot status, or production readiness.',
			'A failing step is recorded as observed; no repair, pin, or flag was applied to make it pass.',
		],
	};
}

export function spawnStepRunner(input: {
	npmBinary: string;
	workDirectory: string;
	environment: NodeJS.ProcessEnv;
}): LegacyStepRunner {
	return (args) => {
		const result = spawnSync(input.npmBinary, [...args], {
			cwd: input.workDirectory,
			env: input.environment,
			encoding: 'utf8',
			maxBuffer: 1 << 28,
		});
		return {
			exitCode: result.status,
			signal: result.signal ?? null,
			stdout: result.stdout ?? '',
			stderr: result.stderr ?? '',
		};
	};
}

export type LegacyAcquiredResponse = Readonly<{
	endpoint: string;
	status: 200;
	bytes: number;
	sha256: string;
	stream?: number;
}>;

export type LegacyAcquisitionState = {
	requests: LegacyAcquiredResponse[];
	aggregateBytes: number;
	redirectsObserved: number;
	setCookiesUsed: number;
};

export type LegacyTransport = (
	url: string,
	kind: 'json' | 'archive',
	state: LegacyAcquisitionState,
	stream?: number,
) => Promise<Buffer>;

export function newAcquisitionState(): LegacyAcquisitionState {
	return { requests: [], aggregateBytes: 0, redirectsObserved: 0, setCookiesUsed: 0 };
}

export function httpsTransport(config: LegacyCandidateConfig): LegacyTransport {
	return (url, kind, state, stream) =>
		new Promise<Buffer>((resolvePromise, reject) => {
			assertAllowedAcquisitionUrl(url, config);
			const cap =
				kind === 'json'
					? config.caps.maximumApiResponseBytes
					: config.caps.maximumArchiveBytes;
			const call = request(
				url,
				{
					method: 'GET',
					headers: {
						accept:
							kind === 'json'
								? 'application/vnd.github+json'
								: 'application/octet-stream',
						'accept-encoding': 'identity',
						'user-agent': 'versionless-shared-acquisition',
						'x-versionless-consent-id': config.consentId,
					},
				},
				(response) => {
					const status = response.statusCode ?? 0;
					if (status >= 300 && status < 400) state.redirectsObserved += 1;
					if (response.headers['set-cookie']) state.setCookiesUsed += 1;
					if (status !== 200) {
						response.resume();
						reject(new Error(`Legacy acquisition status differs: ${status} ${url}`));
						return;
					}
					if ((response.headers['content-encoding'] ?? 'identity') !== 'identity') {
						response.resume();
						reject(new Error(`Legacy acquisition content encoding differs: ${url}`));
						return;
					}
					const chunks: Buffer[] = [];
					let bytes = 0;
					response.on('data', (chunk: Buffer) => {
						bytes += chunk.byteLength;
						if (
							bytes > cap ||
							state.aggregateBytes + bytes > config.caps.maximumAggregateWireBytes
						)
							response.destroy(new Error(`Legacy acquisition cap exceeded: ${url}`));
						else chunks.push(Buffer.from(chunk));
					});
					response.once('error', reject);
					response.once('end', () => {
						const body = Buffer.concat(chunks, bytes);
						state.aggregateBytes += bytes;
						state.requests.push({
							endpoint: url,
							status: 200,
							bytes,
							sha256: sha256(body),
							...(stream === undefined ? {} : { stream }),
						});
						if (state.requests.length > config.caps.maximumAcceptedResponses) {
							reject(new Error('Legacy acquisition accepted-response cap exceeded'));
							return;
						}
						resolvePromise(body);
					});
				},
			);
			call.setTimeout(120_000, () =>
				call.destroy(new Error(`Legacy acquisition timeout: ${url}`)),
			);
			call.once('error', reject);
			call.end();
		});
}

export function assertLegacyAcquisitionConsent(
	config: LegacyCandidateConfig,
	options: { allowNetwork: boolean; consentId?: string },
): void {
	if (
		!options.allowNetwork ||
		options.consentId !== config.consentId ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== config.consentId
	)
		throw new Error(`Legacy corpus ingest requires explicit consent ${config.consentId}`);
}

export type LegacySourceRecord = Readonly<{
	schemaVersion: 'versionless.official-source.v1';
	consentId: string;
	attemptSha256: string;
	result: 'source-bound';
	startedAt: string;
	completedAt: string;
	repository: Readonly<{
		id: number;
		fullName: string;
		private: boolean;
		archived: boolean;
		disabled: boolean;
		responseBytes: number;
		responseSha256: string;
	}>;
	revision: Readonly<
		{
			ref: string;
			tagObjectSha: string | null;
			tagKind: 'annotated' | 'lightweight';
			tagDate: string | null;
			tagVerification: 'verified' | 'unsigned';
			commitSha: string;
			commitDate: string | null;
			commitVerification: 'verified' | 'unsigned';
			rootTreeSha: string;
			treeTruncated: boolean;
		} & TreeSummary
	>;
	requests: readonly LegacyAcquiredResponse[];
	archiveParity: ArchiveParity;
	transaction: Readonly<{
		attemptedRequests: number;
		acceptedResponses: number;
		acceptedWireBytes: number;
		acceptedDecodedBytes: number;
		redirectsObserved: number;
		setCookiesUsed: number;
		retries: number;
		archivesByteIdentical: boolean;
		archiveMatchesGitTree: boolean;
		publishedSource: boolean;
		readinessCredit: false;
		implementationStarted: false;
	}>;
	cache: Readonly<{
		root: string;
		archive1: string;
		archive2: string;
		verifiedSource: string;
		rawMetadataPortable: false;
	}>;
	nonclaims: readonly string[];
}>;

export type LegacyExtractor = (archive: string, destination: string) => void;

export const tarExtractor: LegacyExtractor = (archive, destination) => {
	execFileSync('tar', ['-xzf', archive, '-C', destination]);
};

async function walkExtracted(
	directory: string,
	base: string,
): Promise<{ files: ExtractedFile[]; directories: number; specialEntries: number }> {
	const files: ExtractedFile[] = [];
	let directories = 0;
	let specialEntries = 0;
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const full = join(directory, entry.name);
		if (entry.isDirectory()) {
			directories += 1;
			const nested = await walkExtracted(full, base);
			files.push(...nested.files);
			directories += nested.directories;
			specialEntries += nested.specialEntries;
		} else if (entry.isFile())
			files.push({ path: relative(base, full), bytes: await readFile(full) });
		else specialEntries += 1;
	}
	return { files, directories, specialEntries };
}

// Acquires one candidate's official source under exact purpose-bound consent and publishes the
// attempt and source documents. Every remote byte flows through the injected transport, so the
// composition above stays testable without a network.
export async function acquireLegacyCandidateSource(
	config: LegacyCandidateConfig,
	options: {
		allowNetwork: boolean;
		consentId?: string;
		transport?: LegacyTransport;
		extract?: LegacyExtractor;
		root?: string;
	},
): Promise<{
	manifest: { id: LegacyCandidateId };
	consent: { consentId: string };
	source: LegacySourceRecord;
}> {
	assertLegacyAcquisitionConsent(config, options);
	const root = options.root ?? workspaceRoot;
	const transport = options.transport ?? httpsTransport(config);
	const extract = options.extract ?? tarExtractor;
	const evidenceDirectory = join(root, evidenceRootFor(config));
	const cacheDirectory = join(root, cacheRootFor(config));
	const archiveDirectory = join(cacheDirectory, 'archive');
	const extractDirectory = join(cacheDirectory, 'verify/extracted');
	await mkdir(archiveDirectory, { recursive: true });
	await mkdir(evidenceDirectory, { recursive: true });

	const state = newAcquisitionState();
	const startedAt = new Date().toISOString();
	const readJson = async (url: string): Promise<Record<string, unknown>> =>
		JSON.parse((await transport(url, 'json', state)).toString('utf8')) as Record<
			string,
			unknown
		>;
	const repository = await readJson(repositoryEndpoint(config));
	const reference = await readJson(tagRefEndpoint(config));
	const referenceObject = reference.object as { sha: string; type: string };
	let tagObject: Record<string, unknown> | undefined;
	let commitSha = referenceObject.sha;
	if (referenceObject.type === 'tag') {
		tagObject = await readJson(tagObjectEndpoint(config, referenceObject.sha));
		commitSha = (tagObject.object as { sha: string }).sha;
	}
	const commit = await readJson(commitEndpoint(config, commitSha));
	const rootTreeSha = (commit.tree as { sha: string }).sha;
	const tree = await readJson(treeEndpoint(config, rootTreeSha));
	if (tree.truncated === true)
		throw new Error('Legacy git tree is truncated; refusing partial reconciliation');
	const rows = tree.tree as TreeRow[];

	const archives: { file: string; sha256: string; bytes: number }[] = [];
	for (let stream = 1; stream <= config.caps.requiredArchiveStreams; stream += 1) {
		const body = await transport(archiveEndpoint(config, commitSha), 'archive', state, stream);
		const file = join(archiveDirectory, `archive-${stream}.tar.gz`);
		await writeFile(file, body);
		archives.push({ file, sha256: sha256(body), bytes: body.byteLength });
	}
	const archivesByteIdentical = archives.every(
		(archive) => archive.sha256 === (archives[0]?.sha256 ?? ''),
	);
	if (!archivesByteIdentical)
		throw new Error('Legacy archive streams differ; refusing to publish source');

	await rm(extractDirectory, { recursive: true, force: true });
	await mkdir(extractDirectory, { recursive: true });
	extract(archives[0]?.file ?? '', extractDirectory);
	const roots = await readdir(extractDirectory);
	const singleRoot = roots[0];
	if (roots.length !== 1 || singleRoot === undefined)
		throw new Error(`Legacy archive has ${roots.length} roots`);
	const sourceRoot = join(extractDirectory, singleRoot);
	const walked = await walkExtracted(sourceRoot, sourceRoot);
	const parity = reconcileArchiveWithTree({
		singleRoot,
		rows,
		files: walked.files,
		directories: walked.directories + 1,
		specialEntries: walked.specialEntries,
	});
	await writeFile(join(cacheDirectory, 'manifest.txt'), normalizedManifest(walked.files).text);

	const attempt = acquisitionAttempt(config);
	const attemptBytes = Buffer.from(documentBytes(attempt), 'utf8');
	await writeFile(join(evidenceDirectory, 'attempt.json'), attemptBytes);
	const first = state.requests[0];
	if (!first) throw new Error('Legacy acquisition recorded no accepted responses');
	const verification = (value: unknown): 'verified' | 'unsigned' =>
		(value as { verified?: boolean } | undefined)?.verified === true ? 'verified' : 'unsigned';
	const source: LegacySourceRecord = {
		schemaVersion: 'versionless.official-source.v1',
		consentId: config.consentId,
		attemptSha256: sha256(attemptBytes),
		result: 'source-bound',
		startedAt,
		completedAt: new Date().toISOString(),
		repository: {
			id: repository.id as number,
			fullName: repository.full_name as string,
			private: repository.private === true,
			archived: repository.archived === true,
			disabled: repository.disabled === true,
			responseBytes: first.bytes,
			responseSha256: first.sha256,
		},
		revision: {
			ref: `refs/tags/${config.tag}`,
			tagObjectSha: (tagObject?.sha as string | undefined) ?? null,
			tagKind: tagObject ? 'annotated' : 'lightweight',
			tagDate: ((tagObject?.tagger as { date?: string } | undefined)?.date ?? null) as
				| string
				| null,
			tagVerification: verification(tagObject?.verification),
			commitSha,
			commitDate: ((commit.committer as { date?: string } | undefined)?.date ?? null) as
				| string
				| null,
			commitVerification: verification(commit.verification),
			rootTreeSha,
			...summarizeTree(rows),
			treeTruncated: tree.truncated === true,
		},
		requests: state.requests,
		archiveParity: parity,
		transaction: {
			attemptedRequests: state.requests.length,
			acceptedResponses: state.requests.length,
			acceptedWireBytes: state.aggregateBytes,
			acceptedDecodedBytes: state.aggregateBytes,
			redirectsObserved: state.redirectsObserved,
			setCookiesUsed: state.setCookiesUsed,
			retries: 0,
			archivesByteIdentical,
			archiveMatchesGitTree: archiveMatchesGitTree(parity),
			publishedSource: true,
			readinessCredit: false,
			implementationStarted: false,
		},
		cache: {
			root: cacheRootFor(config),
			archive1: relative(root, archives[0]?.file ?? ''),
			archive2: relative(root, archives[1]?.file ?? ''),
			verifiedSource: relative(root, extractDirectory),
			rawMetadataPortable: false,
		},
		nonclaims: [
			'A lightweight or unsigned tag does not establish signer authenticity.',
			'No dependency closure, build, browser behavior, migration feasibility, pilot status, production readiness, certification, or legal approval is established by this record.',
		],
	};
	await writeFile(join(evidenceDirectory, 'source.json'), documentBytes(source));
	return { manifest: { id: config.id }, consent: { consentId: config.consentId }, source };
}

export async function ingestLegacyCandidate(options: {
	fixture?: string;
	allowNetwork: boolean;
	consentId?: string;
}): Promise<{ manifest: { id: LegacyCandidateId }; consent: { consentId: string } }> {
	const config = legacyCandidateConfig(options.fixture);
	return acquireLegacyCandidateSource(config, options);
}
