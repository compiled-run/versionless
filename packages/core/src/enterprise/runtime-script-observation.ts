import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { charIn, createRegExp, oneOrMore } from 'magic-regexp';
import * as path from 'pathe';
import { normalizeURL, parseURL } from 'ufo';
import { canonicalize, sha256 } from '../receipts/canonicalize.ts';
import type { ScriptSurface } from './script-surface.ts';

export const RUNTIME_SCRIPT_OBSERVATION_SCHEMA =
	'versionless.runtime-script-observation.v1' as const;

export type JourneyProfile = 'react-locale' | 'react-data-flow' | 'angular-phonecat';

export interface RuntimeObservationConfig {
	schemaVersion: typeof RUNTIME_SCRIPT_OBSERVATION_SCHEMA;
	browser: { executable: string; sha256: string };
	profiles: Record<
		JourneyProfile,
		{ journey: string; journeySha256: string; payload?: string; payloadSha256?: string }
	>;
	verticals: Array<{ id: string; profile: JourneyProfile }>;
}

export interface ObservedScript {
	source: string;
	kind: 'local' | 'external';
	resolvedPath: string | null;
	sha256: string | null;
}

export interface RuntimeObservationRun {
	run: number;
	result: 'pass';
	createdScripts: string[];
	removedScripts: string[];
	scriptRequests: string[];
	finalScriptElements: string[];
	scripts: ObservedScript[];
	blockedExternalResources: string[];
	syntheticInterceptions: string[];
	consoleErrors: string[];
	pageErrors: string[];
	successfulNonLoopback: string[];
	journeyProjection: Record<string, unknown>;
}

export interface RuntimeScriptObservation {
	schemaVersion: typeof RUNTIME_SCRIPT_OBSERVATION_SCHEMA;
	summary: {
		verticals: 9;
		sourceApplications: 2;
		lanes: 18;
		runs: 36;
		externalScriptsIntroduced: 0;
	};
	boundaries: {
		scope: 'exact-qualified-journeys';
		globalDynamicInsertionCoverage: 'not-established';
		paymentPageApplicability: 'not-established';
		pciCompliance: 'not-claimed';
		certification: 'not-claimed';
		authenticity: 'not-established';
		locality: 'process-scoped-not-os-wide';
	};
	inputs: Pick<RuntimeObservationConfig, 'browser' | 'profiles'>;
	verticals: Array<{
		id: string;
		sourceApplication: string;
		profile: JourneyProfile;
		lanes: Array<{
			lane: 'legacy' | 'target';
			entrypoint: { path: string; sha256: string };
			receipt: { path: string; digest: string };
			deterministic: true;
			runs: RuntimeObservationRun[];
		}>;
	}>;
	detectorMutation: {
		source: 'https://synthetic.invalid/runtime-detector.js';
		observed: true;
		result: 'intended-refusal';
		restoration: 'no-worktree-write';
	};
}

const identifier = createRegExp(
	oneOrMore(charIn('-').from('0', '9').from('a', 'z')).at.lineStart().at.lineEnd(),
);
const digest = createRegExp(charIn('0123456789abcdef').times(64).at.lineStart().at.lineEnd());
const expectedProfiles = new Map<string, JourneyProfile>([
	['react-boilerplate-v4', 'react-locale'],
	['angular-phonecat', 'angular-phonecat'],
	['react-boilerplate-v4-node24', 'react-locale'],
	['react-boilerplate-v4-vite8', 'react-locale'],
	['angular-phonecat-route-resolve', 'angular-phonecat'],
	['angular-phonecat-composed', 'angular-phonecat'],
	['react-boilerplate-v4-data-flow', 'react-data-flow'],
	['react-boilerplate-v4-composed', 'react-data-flow'],
	['angular-phonecat-vite8', 'angular-phonecat'],
]);
const expectedProfileBindings: RuntimeObservationConfig['profiles'] = {
	'react-locale': {
		journey: 'fixtures/react-boilerplate-v4/journey.json',
		journeySha256: '53bc6577ed9056ad397b768afde2a04a2cec36ad6d8fa410fa7027168958e751',
	},
	'react-data-flow': {
		journey: 'fixtures/react-boilerplate-v4-data-flow/journey.json',
		journeySha256: 'ae221e3605e86a16a5db33baac9126a1b0bc9a63131b4ea3b46c68581f7f4dcd',
		payload: 'fixtures/react-boilerplate-v4-data-flow/repos.json',
		payloadSha256: 'b12675b7f7b0819f4ae12d2e48119a8e94016a0da3e0fa245e7f216a89715c06',
	},
	'angular-phonecat': {
		journey: 'fixtures/angular-phonecat/journey.json',
		journeySha256: '24ff1c763c18700c0b9f7449078da3cd7cf3f85141117cb68a38c83e2386ab3b',
	},
};
const expectedBrowser = {
	executable:
		'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
	sha256: 'a46b3b1e63163fa2d2437fb6ae967cb5a73b50050bca32f1964e6129b6228244',
};

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`${label} must be an object`);
	return value as Record<string, unknown>;
}

function portable(value: unknown, label: string): string {
	if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.includes('\\'))
		throw new Error(`${label} must be a portable repository-relative path`);
	if (value.split('/').includes('..')) throw new Error(`${label} escapes the repository`);
	return value;
}

function exactKeys(value: Record<string, unknown>, expected: string[], label: string): void {
	if (canonicalize(Object.keys(value).sort()) !== canonicalize([...expected].sort()))
		throw new Error(`${label} fields are incomplete or unsupported`);
}

function stringArray(value: unknown, label: string): string[] {
	if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
		throw new Error(`${label} must be a string array`);
	const strings = value as string[];
	if (canonicalize(strings) !== canonicalize([...new Set(strings)].sort()))
		throw new Error(`${label} must be sorted and unique`);
	return strings;
}

export function parseRuntimeObservationConfig(value: unknown): RuntimeObservationConfig {
	const root = object(value, 'runtime observation config');
	exactKeys(root, ['schemaVersion', 'browser', 'profiles', 'verticals'], 'runtime config');
	if (root.schemaVersion !== RUNTIME_SCRIPT_OBSERVATION_SCHEMA)
		throw new Error('Unsupported runtime observation schema');
	const browser = object(root.browser, 'runtime observation browser');
	exactKeys(browser, ['executable', 'sha256'], 'runtime browser');
	const executable = portable(browser.executable, 'browser executable');
	if (typeof browser.sha256 !== 'string' || !digest.test(browser.sha256))
		throw new Error('Browser digest is invalid');
	if (canonicalize({ executable, sha256: browser.sha256 }) !== canonicalize(expectedBrowser))
		throw new Error('Runtime observation browser rebinding refused');
	const rawProfiles = object(root.profiles, 'runtime observation profiles');
	exactKeys(
		rawProfiles,
		['react-locale', 'react-data-flow', 'angular-phonecat'],
		'runtime profiles',
	);
	const profiles = {} as RuntimeObservationConfig['profiles'];
	for (const profile of ['react-locale', 'react-data-flow', 'angular-phonecat'] as const) {
		const item = object(rawProfiles[profile], `${profile} profile`);
		exactKeys(
			item,
			profile === 'react-data-flow'
				? ['journey', 'journeySha256', 'payload', 'payloadSha256']
				: ['journey', 'journeySha256'],
			`${profile} profile`,
		);
		if (typeof item.journeySha256 !== 'string' || !digest.test(item.journeySha256))
			throw new Error(`${profile} journey digest is invalid`);
		if (
			item.payloadSha256 !== undefined &&
			(typeof item.payloadSha256 !== 'string' || !digest.test(item.payloadSha256))
		)
			throw new Error(`${profile} payload digest is invalid`);
		profiles[profile] = {
			journey: portable(item.journey, `${profile} journey`),
			journeySha256: item.journeySha256,
			...(item.payload === undefined
				? {}
				: {
						payload: portable(item.payload, `${profile} payload`),
						payloadSha256: item.payloadSha256 as string,
					}),
		};
	}
	if (canonicalize(profiles) !== canonicalize(expectedProfileBindings))
		throw new Error('Runtime observation journey/payload binding refused');
	if (!Array.isArray(root.verticals) || root.verticals.length !== 9)
		throw new Error('Runtime observation config must contain nine verticals');
	const verticals = root.verticals.map((value) => {
		const item = object(value, 'runtime observation vertical');
		exactKeys(item, ['id', 'profile'], 'runtime observation vertical');
		if (typeof item.id !== 'string' || !identifier.test(item.id))
			throw new Error('Runtime observation vertical ID is invalid');
		if (item.profile !== expectedProfiles.get(item.id))
			throw new Error(`Runtime observation profile rebinding refused: ${item.id}`);
		return { id: item.id, profile: item.profile as JourneyProfile };
	});
	if (
		canonicalize(verticals.map((item) => item.id)) !==
		canonicalize([...expectedProfiles.keys()])
	)
		throw new Error('Runtime observation vertical ID/order rebinding refused');
	return {
		schemaVersion: RUNTIME_SCRIPT_OBSERVATION_SCHEMA,
		browser: { executable, sha256: browser.sha256 },
		profiles,
		verticals,
	};
}

/** The name a tree without the observing browser refuses under. */
export const RUNTIME_OBSERVATION_BROWSER_ABSENT = 'trust.runtime-observation-browser-absent';

/**
 * The refusal a tree that does not carry the observing browser raises.
 *
 * `config.browser.executable` names the exact Chromium build the sealed runtime
 * observation was taken with, and it lives under `.versionless/cache`, which is
 * gitignored. Re-hashing it is a real check on a host that has it and an
 * impossibility on a host that does not; before this class the second case was
 * a bare ENOENT that took `trust:verify` down in every clean checkout. What
 * survives without the binary is the binding between the committed config and
 * the committed evidence, which is checked either way and is not this error's
 * business.
 */
export class RuntimeObservationBrowserAbsentError extends Error {
	readonly missingPath: string;

	constructor(missingPath: string) {
		super(
			`${RUNTIME_OBSERVATION_BROWSER_ABSENT}: ${missingPath} is not in this tree, so the browser the sealed runtime observation was taken with cannot be re-hashed here. The digest binding between trust/runtime-script-observation.json and the emitted evidence is still checked; the binary itself is not.`,
		);
		this.name = 'RuntimeObservationBrowserAbsentError';
		this.missingPath = missingPath;
	}
}

/** The refusal an error carries, or `null` when the error is something else. */
export function runtimeObservationBrowserAbsent(
	error: unknown,
): RuntimeObservationBrowserAbsentError | null {
	return error instanceof RuntimeObservationBrowserAbsentError ? error : null;
}

export async function verifyRuntimeObservationInputs(
	config: RuntimeObservationConfig,
	rootDir = '.',
): Promise<void> {
	const browser = await readFile(path.resolve(rootDir, config.browser.executable)).catch(
		(error: unknown) => {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT')
				throw new RuntimeObservationBrowserAbsentError(config.browser.executable);
			throw error;
		},
	);
	if (sha256(browser) !== config.browser.sha256)
		throw new Error('Runtime browser digest mismatch');
	await verifyRuntimeObservationFixtures(config, rootDir);
}

/** The committed inputs, which every tree carries: journeys and their payloads. */
export async function verifyRuntimeObservationFixtures(
	config: RuntimeObservationConfig,
	rootDir = '.',
): Promise<void> {
	for (const binding of Object.values(config.profiles)) {
		if (
			sha256(await readFile(path.resolve(rootDir, binding.journey))) !== binding.journeySha256
		)
			throw new Error(`Runtime journey digest mismatch: ${binding.journey}`);
		if (
			binding.payload &&
			sha256(await readFile(path.resolve(rootDir, binding.payload))) !== binding.payloadSha256
		)
			throw new Error(`Runtime payload digest mismatch: ${binding.payload}`);
	}
}

interface VerifyRuntimeEvidenceOptions {
	rootDir?: string;
	config: RuntimeObservationConfig;
	surface: ScriptSurface;
}

function expectedProjection(profile: JourneyProfile): Record<string, unknown> {
	if (profile === 'angular-phonecat')
		return { redirectPath: '#!/phones', detailPath: '#!/phones/nexus-s', images: 3 };
	const common = {
		navigationPath: 'features',
		selectedLocale: 'de',
		translatedHeading: 'Beginnen Sie Ihr nächstes React Projekt in Sekunden',
	};
	return profile === 'react-data-flow'
		? { ...common, username: 'octocat', repositories: 2 }
		: common;
}

function expectedSynthetic(profile: JourneyProfile): string[] {
	return profile === 'react-data-flow'
		? ['https://api.github.com/users/octocat/repos?type=all&sort=updated']
		: [];
}

export async function verifyRuntimeScriptObservationEvidence(
	value: unknown,
	options: VerifyRuntimeEvidenceOptions,
): Promise<RuntimeScriptObservation> {
	const checkout = path.resolve(options.rootDir ?? '.');
	/**
	 * A checkout without the observing browser still gets every check that does
	 * not need it: the journey and payload fixtures are committed and are hashed
	 * below by the same call, and the config-to-evidence input binding is
	 * compared further down. Only the re-hash of the binary is skipped, and it
	 * is skipped by name rather than by a swallowed ENOENT.
	 */
	try {
		await verifyRuntimeObservationInputs(options.config, checkout);
	} catch (error) {
		if (runtimeObservationBrowserAbsent(error) === null) throw error;
		await verifyRuntimeObservationFixtures(options.config, checkout);
	}
	bindRuntimeObservationConfig(options.config, options.surface);
	const root = object(value, 'runtime observation evidence');
	exactKeys(
		root,
		['schemaVersion', 'summary', 'boundaries', 'inputs', 'verticals', 'detectorMutation'],
		'runtime observation evidence',
	);
	if (root.schemaVersion !== RUNTIME_SCRIPT_OBSERVATION_SCHEMA)
		throw new Error('Runtime observation evidence schema mismatch');
	const expectedSummary = {
		verticals: 9,
		sourceApplications: 2,
		lanes: 18,
		runs: 36,
		externalScriptsIntroduced: 0,
	};
	if (canonicalize(root.summary) !== canonicalize(expectedSummary))
		throw new Error('Runtime observation summary mismatch');
	const expectedBoundaries: RuntimeScriptObservation['boundaries'] = {
		scope: 'exact-qualified-journeys',
		globalDynamicInsertionCoverage: 'not-established',
		paymentPageApplicability: 'not-established',
		pciCompliance: 'not-claimed',
		certification: 'not-claimed',
		authenticity: 'not-established',
		locality: 'process-scoped-not-os-wide',
	};
	if (canonicalize(root.boundaries) !== canonicalize(expectedBoundaries))
		throw new Error('Runtime observation boundary overclaim refused');
	const expectedInputs = { browser: options.config.browser, profiles: options.config.profiles };
	if (canonicalize(root.inputs) !== canonicalize(expectedInputs))
		throw new Error('Runtime observation input rebinding refused');
	if (!Array.isArray(root.verticals) || root.verticals.length !== 9)
		throw new Error('Runtime observation must contain nine verticals');
	let scriptCount = 0;
	for (const [verticalIndex, rawVertical] of root.verticals.entries()) {
		const vertical = object(rawVertical, `runtime vertical ${verticalIndex}`);
		exactKeys(vertical, ['id', 'sourceApplication', 'profile', 'lanes'], 'runtime vertical');
		const configured = options.config.verticals[verticalIndex];
		const staticVertical = options.surface.verticals[verticalIndex];
		if (
			!configured ||
			!staticVertical ||
			vertical.id !== configured.id ||
			vertical.id !== staticVertical.id ||
			vertical.sourceApplication !== staticVertical.sourceApplication ||
			vertical.profile !== configured.profile
		)
			throw new Error('Runtime vertical/source/profile/order rebinding refused');
		if (!Array.isArray(vertical.lanes) || vertical.lanes.length !== 2)
			throw new Error('Runtime vertical must contain two lanes');
		for (const [laneIndex, rawLane] of vertical.lanes.entries()) {
			const lane = object(rawLane, `runtime lane ${laneIndex}`);
			exactKeys(
				lane,
				['lane', 'entrypoint', 'receipt', 'deterministic', 'runs'],
				'runtime lane',
			);
			const staticLane = staticVertical.lanes[laneIndex];
			if (
				!staticLane ||
				lane.lane !== (laneIndex === 0 ? 'legacy' : 'target') ||
				lane.lane !== staticLane.lane ||
				canonicalize(lane.entrypoint) !== canonicalize(staticLane.entrypoint) ||
				canonicalize(lane.receipt) !== canonicalize(staticLane.receipt) ||
				lane.deterministic !== true
			)
				throw new Error('Runtime lane/entrypoint/receipt rebinding refused');
			if (!Array.isArray(lane.runs) || lane.runs.length !== 2)
				throw new Error('Runtime lane must contain exactly two runs');
			const parsedRuns: RuntimeObservationRun[] = [];
			for (const [runIndex, rawRun] of lane.runs.entries()) {
				const run = object(rawRun, `runtime run ${runIndex}`);
				exactKeys(
					run,
					[
						'run',
						'result',
						'createdScripts',
						'removedScripts',
						'scriptRequests',
						'finalScriptElements',
						'scripts',
						'blockedExternalResources',
						'syntheticInterceptions',
						'consoleErrors',
						'pageErrors',
						'successfulNonLoopback',
						'journeyProjection',
					],
					'runtime run',
				);
				if (run.run !== runIndex + 1 || run.result !== 'pass')
					throw new Error('Runtime run identity/result mismatch');
				for (const field of [
					'consoleErrors',
					'pageErrors',
					'successfulNonLoopback',
				] as const)
					if (stringArray(run[field], `runtime ${field}`).length !== 0)
						throw new Error(`Runtime qualification ${field} must be empty`);
				const created = stringArray(run.createdScripts, 'created scripts');
				const removed = stringArray(run.removedScripts, 'removed scripts');
				const requests = stringArray(run.scriptRequests, 'script requests');
				const final = stringArray(run.finalScriptElements, 'final scripts');
				for (const item of [...created, ...removed, ...requests, ...final])
					portable(item, 'runtime script lifecycle path');
				const blocked = stringArray(run.blockedExternalResources, 'blocked resources');
				const synthetic = stringArray(
					run.syntheticInterceptions,
					'synthetic interceptions',
				);
				if (
					blocked.some((item) => {
						const parsed = parseURL(item);
						return !parsed.protocol || !parsed.host || synthetic.includes(item);
					})
				)
					throw new Error('Runtime blocked-resource classification drift');
				const expectedBlocked = staticLane.resources
					.filter((item) => item.kind === 'external')
					.map((item) => item.href)
					.sort();
				if (canonicalize(blocked) !== canonicalize(expectedBlocked))
					throw new Error(
						'Runtime blocked resources differ from canonical lane evidence',
					);
				if (canonicalize(synthetic) !== canonicalize(expectedSynthetic(configured.profile)))
					throw new Error('Runtime synthetic classification drift');
				if (
					canonicalize(run.journeyProjection) !==
					canonicalize(expectedProjection(configured.profile))
				)
					throw new Error('Runtime journey projection drift');
				if (!Array.isArray(run.scripts) || run.scripts.length === 0)
					throw new Error('Runtime script inventory is empty');
				const deploymentRoot = path.dirname(
					path.join(checkout, staticLane.entrypoint.path),
				);
				/**
				 * Whether the built lane is in this tree, decided once per lane.
				 *
				 * The lanes live under `.versionless/work`, which is gitignored, so
				 * a fresh clone carries the evidence and not the deployment it was
				 * taken from. Where the deployment is here every local script is
				 * re-hashed and nothing is relaxed. Where it is not, the re-hash is
				 * dropped for the whole lane rather than per file — a lane that
				 * re-hashed the files that happen to be present and skipped the
				 * rest would report a check it did not perform. Everything that
				 * does not need the deployment is still enforced below: the paths
				 * reconcile with the recorded digests, the inventory matches the
				 * static surface, and the blocked and synthetic classifications
				 * must equal the canonical lane evidence.
				 */
				const deploymentPresent = existsSync(deploymentRoot);
				const sources: string[] = [];
				for (const rawScript of run.scripts) {
					const script = object(rawScript, 'runtime script');
					exactKeys(
						script,
						['source', 'kind', 'resolvedPath', 'sha256'],
						'runtime script',
					);
					if (script.kind !== 'local')
						throw new Error('Runtime external script or target introduction refused');
					const source = portable(script.source, 'runtime script source');
					const resolvedPath = portable(
						script.resolvedPath,
						'runtime script resolved path',
					);
					if (
						source !== resolvedPath ||
						typeof script.sha256 !== 'string' ||
						!digest.test(script.sha256)
					)
						throw new Error('Runtime script path/hash reconciliation failed');
					const file = path.resolve(deploymentRoot, resolvedPath);
					if (!file.startsWith(`${deploymentRoot}${path.sep}`))
						throw new Error('Runtime local script independent rehash failed');
					if (deploymentPresent && sha256(await readFile(file)) !== script.sha256)
						throw new Error('Runtime local script independent rehash failed');
					sources.push(source);
				}
				if (
					new Set(sources).size !== sources.length ||
					canonicalize(requests) !== canonicalize([...sources].sort())
				)
					throw new Error(
						'Runtime script request inventory is not completely reconciled',
					);
				if (
					created.some((item) => !requests.includes(item)) ||
					final.some((item) => !created.includes(item)) ||
					removed.some((item) => !created.includes(item))
				)
					throw new Error('Runtime script element lifecycle is inconsistent');
				const staticScripts = staticLane.scripts
					.map((item) =>
						item.source.startsWith('/') ? item.source.slice(1) : item.source,
					)
					.sort();
				const expectedCreated = staticScripts.length === 1 ? staticScripts : requests;
				if (
					removed.length !== 0 ||
					canonicalize(created) !== canonicalize(expectedCreated) ||
					canonicalize(final) !== canonicalize(created)
				)
					throw new Error('Runtime script element lifecycle is incomplete');
				scriptCount += sources.length;
				parsedRuns.push(run as unknown as RuntimeObservationRun);
			}
			if (
				canonicalize({ ...parsedRuns[0], run: 0 }) !==
				canonicalize({ ...parsedRuns[1], run: 0 })
			)
				throw new Error('Runtime lane normalized runs differ');
		}
	}
	if (scriptCount !== 476) throw new Error('Runtime script inventory must contain 476 records');
	const mutation = object(root.detectorMutation, 'runtime detector mutation');
	if (
		canonicalize(mutation) !==
		canonicalize({
			source: 'https://synthetic.invalid/runtime-detector.js',
			observed: true,
			result: 'intended-refusal',
			restoration: 'no-worktree-write',
		})
	)
		throw new Error('Runtime detector mutation truth mismatch');
	return value as RuntimeScriptObservation;
}

export function bindRuntimeObservationConfig(
	config: RuntimeObservationConfig,
	surface: ScriptSurface,
): void {
	if (surface.summary.verticals !== 9 || surface.summary.lanes !== 18)
		throw new Error('Canonical static surface shape changed');
	const binding = config.verticals.map((item) => {
		const vertical = surface.verticals.find((candidate) => candidate.id === item.id);
		if (!vertical) throw new Error(`Static surface binding missing: ${item.id}`);
		return {
			id: vertical.id,
			sourceApplication: vertical.sourceApplication,
			profile: item.profile,
			lanes: vertical.lanes.map((lane) => ({
				lane: lane.lane,
				entrypoint: lane.entrypoint,
				receipt: lane.receipt,
			})),
		};
	});
	if (binding.some((item) => item.lanes.map((lane) => lane.lane).join(',') !== 'legacy,target'))
		throw new Error('Runtime observation ordered lane rebinding refused');
}

export function normalizeObservedUrl(value: string, localOrigin: string): string {
	const parsed = parseURL(value);
	const origin = parseURL(localOrigin);
	if (parsed.host === origin.host) {
		const normalized = normalizeURL(parsed.pathname || '/').replaceAll('\\', '/');
		return normalized.startsWith('/') ? normalized.slice(1) : normalized;
	}
	return normalizeURL(value);
}

export function renderRuntimeObservation(result: RuntimeScriptObservation): string {
	return `# Qualified-journey runtime script observation

- Schema: \`${result.schemaVersion}\`
- Coverage: ${result.summary.verticals} verified verticals, ${result.summary.lanes} lanes, ${result.summary.runs} qualified journey runs
- Result: zero target-introduced external scripts
- Detector mutation: ${result.detectorMutation.result}; ${result.detectorMutation.restoration}

This evidence records script behavior during the exact qualified journeys. It is not global dynamic-insertion coverage. Payment-page applicability is not established, PCI compliance and certification are not claimed, authenticity is not established, and locality remains process-scoped rather than OS-wide.
`;
}
