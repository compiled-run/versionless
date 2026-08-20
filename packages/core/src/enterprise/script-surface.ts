import { readFile, stat } from 'node:fs/promises';
import { createRegExp, charIn, oneOrMore } from 'magic-regexp';
import * as path from 'pathe';
import { decodePath, normalizeURL, parseURL } from 'ufo';
import { canonicalize, sha256 } from '../receipts/canonicalize.ts';
import { verifyReceipt } from '../receipts/verify.ts';

export const SCRIPT_SURFACE_SCHEMA = 'versionless.script-surface.v1';

const CANONICAL_BINDINGS = [
	{
		id: 'react-boilerplate-v4',
		sourceApplication: 'react-boilerplate-v4',
		lanes: [
			{
				lane: 'legacy',
				entrypointPath: '.versionless/work/react-boilerplate-v4/legacy/build/index.html',
				entrypointSha256:
					'd1902da2f97985976af52b9df8c907997336e83b763c1d15e1ef44fdc4d3c604',
				receiptPath: 'evidence/runs/react-boilerplate-v4/t008-run.json',
				receiptDigest: '4d32ae0a46041e5ec2ac68aa31a9b8f86bd9d294d312ce41968ddd99dc5ee758',
				observationLane: 'legacy',
			},
			{
				lane: 'target',
				entrypointPath: '.versionless/work/react-boilerplate-v4/target/build/index.html',
				entrypointSha256:
					'4946de84df1c8107d619f5d68d012973f3278ec7b07122204af7c7855773bb2f',
				receiptPath: 'evidence/runs/react-boilerplate-v4/t008-run.json',
				receiptDigest: '4d32ae0a46041e5ec2ac68aa31a9b8f86bd9d294d312ce41968ddd99dc5ee758',
				observationLane: 'target',
			},
		],
	},
	{
		id: 'angular-phonecat',
		sourceApplication: 'angular-phonecat',
		lanes: [
			{
				lane: 'legacy',
				entrypointPath: '.versionless/work/angular-phonecat/legacy/app/index.html',
				entrypointSha256:
					'dfce969bbc5c83ba136d820df778c47e789fd5304454319dac9fa087a21297b3',
				receiptPath: 'evidence/runs/angular-phonecat/t014-run.json',
				receiptDigest: 'a6798081c0b005c76534b5acd4dc647d77d497b0b649748c685b779451035f51',
				observationLane: 'legacy',
			},
			{
				lane: 'target',
				entrypointPath: '.versionless/work/angular-phonecat/target/app/index.html',
				entrypointSha256:
					'dfce969bbc5c83ba136d820df778c47e789fd5304454319dac9fa087a21297b3',
				receiptPath: 'evidence/runs/angular-phonecat/t014-run.json',
				receiptDigest: 'a6798081c0b005c76534b5acd4dc647d77d497b0b649748c685b779451035f51',
				observationLane: 'target',
			},
		],
	},
	{
		id: 'react-boilerplate-v4-node24',
		sourceApplication: 'react-boilerplate-v4',
		lanes: [
			{
				lane: 'legacy',
				entrypointPath: '.versionless/work/react-boilerplate-v4/target/build/index.html',
				entrypointSha256:
					'4946de84df1c8107d619f5d68d012973f3278ec7b07122204af7c7855773bb2f',
				receiptPath: 'evidence/runs/react-boilerplate-v4/t008-run.json',
				receiptDigest: '4d32ae0a46041e5ec2ac68aa31a9b8f86bd9d294d312ce41968ddd99dc5ee758',
				observationLane: 'target',
			},
			{
				lane: 'target',
				entrypointPath:
					'.versionless/work/react-boilerplate-v4-node24/target/build/index.html',
				entrypointSha256:
					'3f90d780617a8f5e9fd83f0b9ac2950e271bcbba04395f377a4db4a45db7438d',
				receiptPath: 'evidence/runs/react-boilerplate-v4-node24/t022-run.json',
				receiptDigest: '815a5416b90c0a0c0a2f0adb779308c0ba0447d67c965003f15d343940d9b593',
				observationLane: 'all',
			},
		],
	},
	{
		id: 'react-boilerplate-v4-vite8',
		sourceApplication: 'react-boilerplate-v4',
		lanes: [
			{
				lane: 'legacy',
				entrypointPath:
					'.versionless/work/react-boilerplate-v4-node24/target/build/index.html',
				entrypointSha256:
					'3f90d780617a8f5e9fd83f0b9ac2950e271bcbba04395f377a4db4a45db7438d',
				receiptPath: 'evidence/runs/react-boilerplate-v4-node24/t022-run.json',
				receiptDigest: '815a5416b90c0a0c0a2f0adb779308c0ba0447d67c965003f15d343940d9b593',
				observationLane: 'all',
			},
			{
				lane: 'target',
				entrypointPath:
					'.versionless/work/react-boilerplate-v4-vite8/target/build-vite/index.html',
				entrypointSha256:
					'e77d403d657e36d070614c51a9db81ce7d998d3b0811126042def41210633dd4',
				receiptPath: 'evidence/runs/react-boilerplate-v4-vite8/t028-run.json',
				receiptDigest: '1caf9dfa24b14b83ac63ceab9ca90829346045aac690c7b95a952ae4d9e72849',
				observationLane: 'all',
			},
		],
	},
	{
		id: 'angular-phonecat-route-resolve',
		sourceApplication: 'angular-phonecat',
		lanes: [
			{
				lane: 'legacy',
				entrypointPath:
					'.versionless/work/angular-phonecat-route-resolve/legacy/app/index.html',
				entrypointSha256:
					'dfce969bbc5c83ba136d820df778c47e789fd5304454319dac9fa087a21297b3',
				receiptPath: 'evidence/runs/angular-phonecat-route-resolve/t032-run.json',
				receiptDigest: 'aa8b2923a38aa5f1adc870b48cdd938b739e107c927aac71b8c2890705f6beef',
				observationLane: 'legacy',
			},
			{
				lane: 'target',
				entrypointPath:
					'.versionless/work/angular-phonecat-route-resolve/target/app/index.html',
				entrypointSha256:
					'dfce969bbc5c83ba136d820df778c47e789fd5304454319dac9fa087a21297b3',
				receiptPath: 'evidence/runs/angular-phonecat-route-resolve/t032-run.json',
				receiptDigest: 'aa8b2923a38aa5f1adc870b48cdd938b739e107c927aac71b8c2890705f6beef',
				observationLane: 'target',
			},
		],
	},
	{
		id: 'angular-phonecat-composed',
		sourceApplication: 'angular-phonecat',
		lanes: [
			{
				lane: 'legacy',
				entrypointPath: '.versionless/work/angular-phonecat-composed/legacy/app/index.html',
				entrypointSha256:
					'dfce969bbc5c83ba136d820df778c47e789fd5304454319dac9fa087a21297b3',
				receiptPath: 'evidence/runs/angular-phonecat-composed/t048-run.json',
				receiptDigest: 'a7e8a9dc864085d77338f1615e3434a8a842fa5f4156a13bd2f5560bd2f8dc12',
				observationLane: 'legacy',
			},
			{
				lane: 'target',
				entrypointPath: '.versionless/work/angular-phonecat-composed/target/app/index.html',
				entrypointSha256:
					'dfce969bbc5c83ba136d820df778c47e789fd5304454319dac9fa087a21297b3',
				receiptPath: 'evidence/runs/angular-phonecat-composed/t048-run.json',
				receiptDigest: 'a7e8a9dc864085d77338f1615e3434a8a842fa5f4156a13bd2f5560bd2f8dc12',
				observationLane: 'target',
			},
		],
	},
	{
		id: 'react-boilerplate-v4-data-flow',
		sourceApplication: 'react-boilerplate-v4',
		lanes: [
			{
				lane: 'legacy',
				entrypointPath:
					'.versionless/work/react-boilerplate-v4-data-flow/legacy/build-vite/index.html',
				entrypointSha256:
					'e77d403d657e36d070614c51a9db81ce7d998d3b0811126042def41210633dd4',
				receiptPath: 'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json',
				receiptDigest: '2bd6e145d611fb0bb5fb89c9d6ed164a3b30e9c0b1b2a290032f56908e5035da',
				observationLane: 'legacy',
			},
			{
				lane: 'target',
				entrypointPath:
					'.versionless/work/react-boilerplate-v4-data-flow/target/build-vite/index.html',
				entrypointSha256:
					'37cff63759f9234c943830b4286184decd13051fb34ffef9639c8b6b83a3fc42',
				receiptPath: 'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json',
				receiptDigest: '2bd6e145d611fb0bb5fb89c9d6ed164a3b30e9c0b1b2a290032f56908e5035da',
				observationLane: 'target',
			},
		],
	},
	{
		id: 'react-boilerplate-v4-composed',
		sourceApplication: 'react-boilerplate-v4',
		lanes: [
			{
				lane: 'legacy',
				entrypointPath:
					'.versionless/work/react-boilerplate-v4-composed/legacy/build/index.html',
				entrypointSha256:
					'ed54fefd3c0e08f77f09ac7932443da26bf8fe63b2221ffc141948b9e45b60cf',
				receiptPath: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
				receiptDigest: '52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21',
				observationLane: 'legacy',
			},
			{
				lane: 'target',
				entrypointPath:
					'.versionless/work/react-boilerplate-v4-composed/target/build-vite/index.html',
				entrypointSha256:
					'37cff63759f9234c943830b4286184decd13051fb34ffef9639c8b6b83a3fc42',
				receiptPath: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
				receiptDigest: '52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21',
				observationLane: 'target',
			},
		],
	},
	{
		id: 'angular-phonecat-vite8',
		sourceApplication: 'angular-phonecat',
		lanes: [
			{
				lane: 'legacy',
				entrypointPath: '.versionless/work/angular-phonecat-vite8/legacy/app/index.html',
				entrypointSha256:
					'dfce969bbc5c83ba136d820df778c47e789fd5304454319dac9fa087a21297b3',
				receiptPath: 'evidence/runs/angular-phonecat-vite8/t069-run.json',
				receiptDigest: '033fc40237975e28df36117cc309625632610a399b5c0f88735079ed21fcad0d',
				observationLane: 'legacy',
			},
			{
				lane: 'target',
				entrypointPath:
					'.versionless/work/angular-phonecat-vite8/target/build-vite/index.html',
				entrypointSha256:
					'951b6c330e54278cf814c5c366f875e3505e487c75d3ef4abf3f7eff45a91391',
				receiptPath: 'evidence/runs/angular-phonecat-vite8/t069-run.json',
				receiptDigest: '033fc40237975e28df36117cc309625632610a399b5c0f88735079ed21fcad0d',
				observationLane: 'target',
			},
		],
	},
] as const;

const namePattern = createRegExp(
	oneOrMore(charIn('-_:').from('0', '9').from('A', 'Z').from('a', 'z'))
		.at.lineStart()
		.at.lineEnd(),
);
const digestPattern = createRegExp(
	charIn('0123456789abcdef').times(64).at.lineStart().at.lineEnd(),
);

type LaneName = 'legacy' | 'target';

interface LaneConfig {
	lane: LaneName;
	entrypointPath: string;
	entrypointSha256: string;
	receiptPath: string;
	receiptDigest: string;
	observationLane: LaneName | 'all';
	expectedScriptSources: string[];
	expectedResourceHrefs: string[];
}

interface VerticalConfig {
	id: string;
	sourceApplication: string;
	lanes: LaneConfig[];
}

interface ScriptSurfaceConfig {
	schemaVersion: typeof SCRIPT_SURFACE_SCHEMA;
	verticals: VerticalConfig[];
}

export interface ScriptRecord {
	source: string;
	kind: 'local' | 'external';
	resolvedPath: string | null;
	sha256: string | null;
	integrity: string | null;
	crossorigin: string | null;
	type: string | null;
}

export interface ResourceRecord {
	href: string;
	kind: 'local' | 'external';
	resolvedPath: string | null;
	sha256: string | null;
	rel: string | null;
	sizes: string | null;
	integrity: string | null;
	crossorigin: string | null;
	type: string | null;
}

export interface ScriptSurface {
	schemaVersion: typeof SCRIPT_SURFACE_SCHEMA;
	summary: {
		verticals: 9;
		sourceApplications: 2;
		lanes: 18;
		scripts: 198;
		resources: 72;
		localResources: 66;
		externalResources: 6;
		externalScriptsIntroduced: 0;
	};
	boundaries: {
		paymentPageApplicability: 'not-established';
		dynamicScriptInsertion: 'not-tested';
		pciCompliance: 'not-claimed';
		certification: 'not-claimed';
		authenticity: 'not-established';
	};
	verticals: Array<{
		id: string;
		sourceApplication: string;
		externalScriptIntroduced: false;
		lanes: Array<{
			lane: LaneName;
			entrypoint: { path: string; sha256: string };
			receipt: { path: string; digest: string };
			scripts: ScriptRecord[];
			resources: ResourceRecord[];
			network: {
				observations: number;
				blocked: string[];
				successfulNonLoopback: string[];
			};
		}>;
		differences: {
			localScriptCount: { legacy: number; target: number; delta: number };
			localScriptFilenames: { added: string[]; removed: string[] };
			externalResources: { added: string[]; removed: string[] };
		};
	}>;
}

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`${label} must be an object`);
	return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} is missing`);
	return value;
}

function portablePath(value: unknown, label: string): string {
	const candidate = string(value, label);
	if (
		path.isAbsolute(candidate) ||
		candidate.split('/').includes('..') ||
		candidate.includes('\\')
	)
		throw new Error(`${label} must be a portable repository-relative path`);
	return candidate;
}

function digest(value: unknown, label: string): string {
	const candidate = string(value, label);
	if (!digestPattern.test(candidate)) throw new Error(`${label} must be a SHA-256 digest`);
	return candidate;
}

function stringList(value: unknown, label: string): string[] {
	if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
		throw new Error(`${label} must be a string array`);
	if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicates`);
	return value as string[];
}

function parseConfig(value: unknown): ScriptSurfaceConfig {
	const root = record(value, 'script-surface configuration');
	if (root.schemaVersion !== SCRIPT_SURFACE_SCHEMA)
		throw new Error('Unsupported script-surface configuration schema');
	if (!Array.isArray(root.verticals) || root.verticals.length !== 9)
		throw new Error('Script-surface configuration must contain exactly nine verticals');
	const verticals = root.verticals.map((raw, verticalIndex) => {
		const item = record(raw, `vertical ${verticalIndex}`);
		const id = string(item.id, `vertical ${verticalIndex}.id`);
		const sourceApplication = string(
			item.sourceApplication,
			`vertical ${verticalIndex}.sourceApplication`,
		);
		if (!namePattern.test(id) || !namePattern.test(sourceApplication))
			throw new Error('Script-surface identifiers are malformed');
		if (!Array.isArray(item.lanes) || item.lanes.length !== 2)
			throw new Error(`${id} must contain exactly two lanes`);
		const lanes = item.lanes.map((rawLane, laneIndex) => {
			const lane = record(rawLane, `${id} lane ${laneIndex}`);
			if (lane.lane !== 'legacy' && lane.lane !== 'target')
				throw new Error(`${id} lane name is invalid`);
			const laneName: LaneName = lane.lane;
			if (
				lane.observationLane !== 'legacy' &&
				lane.observationLane !== 'target' &&
				lane.observationLane !== 'all'
			)
				throw new Error(`${id} observation lane is invalid`);
			const observationLane: LaneName | 'all' = lane.observationLane;
			return {
				lane: laneName,
				entrypointPath: portablePath(lane.entrypointPath, `${id} entrypointPath`),
				entrypointSha256: digest(lane.entrypointSha256, `${id} entrypointSha256`),
				receiptPath: portablePath(lane.receiptPath, `${id} receiptPath`),
				receiptDigest: digest(lane.receiptDigest, `${id} receiptDigest`),
				observationLane,
				expectedScriptSources: stringList(
					lane.expectedScriptSources,
					`${id} expectedScriptSources`,
				),
				expectedResourceHrefs: stringList(
					lane.expectedResourceHrefs,
					`${id} expectedResourceHrefs`,
				),
			};
		});
		if (lanes[0]?.lane !== 'legacy' || lanes[1]?.lane !== 'target')
			throw new Error(`${id} lanes must be ordered legacy then target`);
		return { id, sourceApplication, lanes };
	});
	if (new Set(verticals.map((item) => item.id)).size !== 9)
		throw new Error('Script-surface vertical IDs must be unique');
	if (new Set(verticals.map((item) => item.sourceApplication)).size !== 2)
		throw new Error(
			'Script-surface configuration must contain exactly two source applications',
		);
	const bindings = verticals.map((vertical) => ({
		id: vertical.id,
		sourceApplication: vertical.sourceApplication,
		lanes: vertical.lanes.map((lane) => ({
			lane: lane.lane,
			entrypointPath: lane.entrypointPath,
			entrypointSha256: lane.entrypointSha256,
			receiptPath: lane.receiptPath,
			receiptDigest: lane.receiptDigest,
			observationLane: lane.observationLane,
		})),
	}));
	if (canonicalize(bindings) !== canonicalize(CANONICAL_BINDINGS))
		throw new Error('Script-surface configuration is not bound to canonical evidence');
	return { schemaVersion: SCRIPT_SURFACE_SCHEMA, verticals };
}

function tagEnd(html: string, start: number): number {
	let quote = '';
	for (let index = start; index < html.length; index++) {
		const character = html[index] ?? '';
		if (quote) {
			if (character === quote) quote = '';
		} else if (character === '"' || character === "'") quote = character;
		else if (character === '>') return index;
	}
	throw new Error('Malformed HTML tag is not closed');
}

function attributes(source: string): Map<string, string> {
	const result = new Map<string, string>();
	let index = 0;
	while (index < source.length) {
		while (
			source[index] === ' ' ||
			source[index] === '\n' ||
			source[index] === '\r' ||
			source[index] === '\t'
		)
			index++;
		if (index >= source.length || source[index] === '/') break;
		const start = index;
		while (
			index < source.length &&
			![' ', '\n', '\r', '\t', '=', '/'].includes(source[index] ?? '')
		)
			index++;
		const name = source.slice(start, index).toLowerCase();
		if (!namePattern.test(name) || result.has(name))
			throw new Error('Malformed or duplicate HTML attribute');
		while ([' ', '\n', '\r', '\t'].includes(source[index] ?? '')) index++;
		let value = '';
		if (source[index] === '=') {
			index++;
			while ([' ', '\n', '\r', '\t'].includes(source[index] ?? '')) index++;
			const quote = source[index];
			if (quote !== '"' && quote !== "'")
				throw new Error('Unquoted HTML attribute is ambiguous');
			index++;
			const valueStart = index;
			while (index < source.length && source[index] !== quote) index++;
			if (index >= source.length) throw new Error('Unclosed HTML attribute value');
			value = source.slice(valueStart, index);
			index++;
		}
		result.set(name, value);
	}
	return result;
}

function staticTags(
	html: string,
): Array<{ name: 'script' | 'link'; attributes: Map<string, string> }> {
	const lower = html.toLowerCase();
	const tags: Array<{ name: 'script' | 'link'; attributes: Map<string, string> }> = [];
	let cursor = 0;
	while (cursor < html.length) {
		const open = lower.indexOf('<', cursor);
		if (open < 0) break;
		const name = lower.startsWith('<script', open)
			? 'script'
			: lower.startsWith('<link', open)
				? 'link'
				: null;
		if (!name) {
			cursor = open + 1;
			continue;
		}
		const boundary = lower[open + name.length + 1] ?? '';
		if (![' ', '\n', '\r', '\t', '>', '/'].includes(boundary)) {
			cursor = open + 1;
			continue;
		}
		const end = tagEnd(html, open);
		tags.push({ name, attributes: attributes(html.slice(open + name.length + 1, end)) });
		if (name === 'script') {
			const close = lower.indexOf('</script', end + 1);
			if (close < 0 || html.slice(end + 1, close).trim())
				throw new Error('Inline, nested, or unclosed script is not accepted');
			const closeEnd = tagEnd(html, close);
			if (html.slice(close + '</script'.length, closeEnd).trim())
				throw new Error('Malformed script closing tag');
			cursor = closeEnd + 1;
		} else cursor = end + 1;
	}
	return tags;
}

function externalURL(reference: string): string | null {
	const parsed = parseURL(reference);
	if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
		if (!parsed.host) throw new Error(`External URL has no host: ${reference}`);
		return normalizeURL(reference);
	}
	if (parsed.protocol || parsed.host || reference.startsWith('//'))
		throw new Error(`Unsupported or ambiguous resource URL: ${reference}`);
	return null;
}

async function localResource(
	root: string,
	entrypointPath: string,
	reference: string,
): Promise<{ path: string; sha256: string }> {
	const parsed = parseURL(reference);
	if (parsed.search || parsed.hash)
		throw new Error(`Local resource URL is unresolved: ${reference}`);
	const pathname = decodePath(parsed.pathname);
	if (!pathname) throw new Error('Local resource reference is empty');
	const deploymentRoot = path.dirname(path.resolve(root, entrypointPath));
	const file = path.resolve(
		deploymentRoot,
		pathname.startsWith('/') ? pathname.slice(1) : pathname,
	);
	const relative = path.relative(deploymentRoot, file);
	if (!relative || path.isAbsolute(relative) || relative.split(path.sep).includes('..'))
		throw new Error(`Local resource escapes or resolves ambiguously: ${reference}`);
	if (!(await stat(file)).isFile()) throw new Error(`Local resource is missing: ${reference}`);
	return { path: relative.split(path.sep).join('/'), sha256: sha256(await readFile(file)) };
}

/** The name a tree without the scanned deployment refuses under. */
export const SCRIPT_SURFACE_SOURCE_ABSENT = 'trust.script-surface-source-absent';

/**
 * The refusal a tree that does not carry the scanned deployment raises.
 *
 * The script surface is read from built lanes under `.versionless/work`, which
 * is gitignored: a fresh clone has the committed declaration and the emitted
 * evidence but not the trees they were read from. Before this class that showed
 * up as a bare ENOENT from `readFile`, which took `trust:verify`,
 * `report:coverage --verify-only` and `supported-matrix` down with it in every
 * clean checkout. A missing source is a named condition a caller can decide
 * about, not a crash.
 */
export class ScriptSurfaceSourceAbsentError extends Error {
	readonly missingPath: string;

	constructor(missingPath: string) {
		super(
			`${SCRIPT_SURFACE_SOURCE_ABSENT}: ${missingPath} is not in this tree, so the script surface cannot be re-read from the deployment it was scanned from. Build the lane, or verify the emitted surface against the committed declaration in trust/script-surface.json instead.`,
		);
		this.name = 'ScriptSurfaceSourceAbsentError';
		this.missingPath = missingPath;
	}
}

/** The refusal an error carries, or `null` when the error is something else. */
export function scriptSurfaceSourceAbsent(error: unknown): ScriptSurfaceSourceAbsentError | null {
	return error instanceof ScriptSurfaceSourceAbsentError ? error : null;
}

export async function scanStaticEntrypoint(options: {
	rootDir: string;
	entrypointPath: string;
	entrypointSha256: string;
	expectedScriptSources: string[];
	expectedResourceHrefs: string[];
}): Promise<{ scripts: ScriptRecord[]; resources: ResourceRecord[] }> {
	if (!digestPattern.test(options.entrypointSha256)) throw new Error('Entrypoint is unhashed');
	const file = path.resolve(options.rootDir, options.entrypointPath);
	const body = await readFile(file).catch((error: unknown) => {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT')
			throw new ScriptSurfaceSourceAbsentError(options.entrypointPath);
		throw error;
	});
	if (sha256(body) !== options.entrypointSha256) throw new Error('Entrypoint SHA-256 mismatch');
	const tags = staticTags(body.toString('utf8'));
	const scripts: ScriptRecord[] = [];
	const observedScriptSources: string[] = [];
	const observedResourceHrefs: string[] = [];
	const resources: ResourceRecord[] = [];
	for (const tag of tags) {
		const integrity = tag.attributes.get('integrity') ?? null;
		const crossorigin = tag.attributes.get('crossorigin') ?? null;
		const type = tag.attributes.get('type') ?? null;
		if (tag.name === 'script') {
			const source = tag.attributes.get('src');
			if (!source) throw new Error('Every static script tag must have a non-empty src');
			observedScriptSources.push(source);
			const external = externalURL(source);
			const local = external
				? null
				: await localResource(options.rootDir, options.entrypointPath, source);
			scripts.push({
				source: external ?? local?.path ?? source,
				kind: external ? 'external' : 'local',
				resolvedPath: local?.path ?? null,
				sha256: local?.sha256 ?? (integrity ? sha256(integrity) : null),
				integrity,
				crossorigin,
				type,
			});
			if (external && !integrity) throw new Error(`External script is unhashed: ${external}`);
		} else {
			const href = tag.attributes.get('href');
			if (!href) throw new Error('Every static link tag must have a non-empty href');
			observedResourceHrefs.push(href);
			const external = externalURL(href);
			const local = external
				? null
				: await localResource(options.rootDir, options.entrypointPath, href);
			resources.push({
				href: external ?? local?.path ?? href,
				kind: external ? 'external' : 'local',
				resolvedPath: local?.path ?? null,
				sha256: local?.sha256 ?? null,
				rel: tag.attributes.get('rel') ?? null,
				sizes: tag.attributes.get('sizes') ?? null,
				integrity,
				crossorigin,
				type,
			});
		}
	}
	if (canonicalize(observedScriptSources) !== canonicalize(options.expectedScriptSources))
		throw new Error('Static script tags are missing or unaccounted');
	if (canonicalize(observedResourceHrefs) !== canonicalize(options.expectedResourceHrefs))
		throw new Error('Static resource links are missing or unaccounted');
	return { scripts, resources };
}

async function networkObservations(
	root: string,
	lane: LaneConfig,
): Promise<{ observations: number; blocked: string[]; successfulNonLoopback: string[] }> {
	const receiptFile = path.join(root, lane.receiptPath);
	const verified = await verifyReceipt(receiptFile);
	if (verified.digest !== lane.receiptDigest)
		throw new Error(`Receipt digest mismatch: ${lane.receiptPath}`);
	const receipt = record(JSON.parse(await readFile(receiptFile, 'utf8')), 'migration receipt');
	if (!Array.isArray(receipt.artifacts)) throw new Error('Receipt artifact list is missing');
	const journey = receipt.artifacts.find((raw) => {
		const artifact = record(raw, 'receipt artifact');
		return typeof artifact.path === 'string' && artifact.path.endsWith('/journey.json');
	});
	if (!journey) throw new Error('Receipt journey artifact is missing');
	const artifact = record(journey, 'journey artifact');
	const journeyPath = portablePath(artifact.path, 'journey artifact path');
	const journeyBody = await readFile(path.join(root, journeyPath));
	if (sha256(journeyBody) !== digest(artifact.sha256, 'journey artifact digest'))
		throw new Error('Receipt journey artifact digest mismatch');
	const values = JSON.parse(journeyBody.toString('utf8')) as unknown;
	if (!Array.isArray(values)) throw new Error('Journey observations must be an array');
	const selected = values
		.map((value) => record(value, 'journey observation'))
		.filter((value) =>
			lane.observationLane === 'all'
				? value.lane === undefined
				: value.lane === lane.observationLane,
		);
	if (selected.length === 0) throw new Error('Receipt has no observations for configured lane');
	const blocked = new Set<string>();
	const successful = new Set<string>();
	for (const observation of selected) {
		for (const value of stringList(observation.blocked, 'blocked requests'))
			blocked.add(normalizeURL(value));
		for (const value of stringList(observation.successfulNonLoopback, 'successful requests'))
			successful.add(normalizeURL(value));
	}
	return {
		observations: selected.length,
		blocked: [...blocked].sort(),
		successfulNonLoopback: [...successful].sort(),
	};
}

function difference(left: string[], right: string[]): { added: string[]; removed: string[] } {
	const before = new Set(left);
	const after = new Set(right);
	return {
		added: [...after].filter((item) => !before.has(item)).sort(),
		removed: [...before].filter((item) => !after.has(item)).sort(),
	};
}

export function assertNoIntroducedExternalScripts(
	legacy: ScriptRecord[],
	target: ScriptRecord[],
): void {
	const legacyExternal = new Set(
		legacy.filter((item) => item.kind === 'external').map((item) => item.source),
	);
	if (target.some((item) => item.kind === 'external' && !legacyExternal.has(item.source)))
		throw new Error('Target introduces an external script');
}

/**
 * Verify an emitted script surface in a tree that no longer carries the builds.
 *
 * This is the reading a fresh clone can actually take, and it is deliberately
 * narrower than {@link verifyScriptSurface}. Two halves are checked, and the
 * boundary between them is the point of the function.
 *
 * The network half is re-derived in full: the per-lane receipt is verified by
 * digest, its journey artifact is re-hashed, its observations are re-filtered,
 * and the result must equal what the emitted record says — the same computation
 * `verifyScriptSurface` performs, from the same committed evidence, with
 * nothing borrowed from the emitted document.
 *
 * The static half is *not* re-derived, because the deployment it was read from
 * is not here. It is instead reconciled with `trust/script-surface.json`, a
 * separately committed declaration: entrypoint path and digest, receipt path
 * and digest, and the external scripts and resources, which the declaration
 * spells literally. The local script and resource digests are the emitted
 * record's own and are re-checked by nothing here. A caller must not read this
 * as a re-derivation of the static surface; it is a consistency check against a
 * second committed file, which is a weaker claim and is recorded as one.
 */
export async function verifyScriptSurfaceAgainstDeclaration(
	emitted: ScriptSurface,
	options: {
		rootDir?: string;
		configPath?: string;
		environment?: NodeJS.ProcessEnv;
	} = {},
): Promise<void> {
	const environment = options.environment ?? process.env;
	if (environment.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('Script-surface verification requires VERSIONLESS_NETWORK_MODE=offline');
	const root = path.resolve(options.rootDir ?? '.');
	const configPath = path.resolve(root, options.configPath ?? 'trust/script-surface.json');
	const config = parseConfig(JSON.parse(await readFile(configPath, 'utf8')));
	if (emitted.schemaVersion !== config.schemaVersion)
		throw new Error('Emitted script surface and its declaration disagree on the schema');
	if (emitted.verticals.length !== config.verticals.length)
		throw new Error(
			'Emitted script surface and its declaration disagree on the vertical count',
		);
	for (const [index, vertical] of config.verticals.entries()) {
		const emittedVertical = emitted.verticals[index];
		if (emittedVertical === undefined || emittedVertical.id !== vertical.id)
			throw new Error(`Emitted script surface is missing vertical ${vertical.id}`);
		if (emittedVertical.sourceApplication !== vertical.sourceApplication)
			throw new Error(`${vertical.id} source application does not match its declaration`);
		if (emittedVertical.lanes.length !== vertical.lanes.length)
			throw new Error(`${vertical.id} lane count does not match its declaration`);
		for (const [laneIndex, lane] of vertical.lanes.entries()) {
			const emittedLane = emittedVertical.lanes[laneIndex];
			if (emittedLane === undefined || emittedLane.lane !== lane.lane)
				throw new Error(`${vertical.id} is missing lane ${lane.lane}`);
			if (
				emittedLane.entrypoint.path !== lane.entrypointPath ||
				emittedLane.entrypoint.sha256 !== lane.entrypointSha256 ||
				emittedLane.receipt.path !== lane.receiptPath ||
				emittedLane.receipt.digest !== lane.receiptDigest
			)
				throw new Error(
					`${vertical.id}/${lane.lane} binding does not match its declaration`,
				);
			const declaredExternal = [
				...lane.expectedScriptSources.filter((source) => externalURL(source) !== null),
				...lane.expectedResourceHrefs.filter((href) => externalURL(href) !== null),
			].sort();
			const emittedExternal = [
				...emittedLane.scripts
					.filter((item) => item.kind === 'external')
					.map((item) => item.source),
				...emittedLane.resources
					.filter((item) => item.kind === 'external')
					.map((item) => item.href),
			].sort();
			if (canonicalize(emittedExternal) !== canonicalize(declaredExternal))
				throw new Error(
					`${vertical.id}/${lane.lane} external resources do not match their declaration`,
				);
			if (
				emittedLane.scripts.length !== lane.expectedScriptSources.length ||
				emittedLane.resources.length !== lane.expectedResourceHrefs.length
			)
				throw new Error(
					`${vertical.id}/${lane.lane} static tag counts do not match their declaration`,
				);
			const network = await networkObservations(root, lane);
			if (canonicalize(emittedLane.network) !== canonicalize(network))
				throw new Error(
					`${vertical.id}/${lane.lane} network observations do not match independent re-derivation`,
				);
			if (canonicalize(emittedExternal) !== canonicalize(network.blocked))
				throw new Error(
					`${vertical.id}/${lane.lane} static resources do not reconcile with blocked requests`,
				);
			if (network.successfulNonLoopback.length !== 0)
				throw new Error(
					`${vertical.id}/${lane.lane} observed successful non-loopback traffic`,
				);
		}
	}
}

export async function verifyScriptSurface(
	options: {
		rootDir?: string;
		configPath?: string;
		environment?: NodeJS.ProcessEnv;
	} = {},
): Promise<ScriptSurface> {
	const environment = options.environment ?? process.env;
	if (environment.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('Script-surface verification requires VERSIONLESS_NETWORK_MODE=offline');
	const root = path.resolve(options.rootDir ?? '.');
	const configPath = path.resolve(root, options.configPath ?? 'trust/script-surface.json');
	const config = parseConfig(JSON.parse(await readFile(configPath, 'utf8')));
	const verticals: ScriptSurface['verticals'] = [];
	for (const vertical of config.verticals) {
		const lanes = [];
		for (const lane of vertical.lanes) {
			const scanned = await scanStaticEntrypoint({ rootDir: root, ...lane });
			const network = await networkObservations(root, lane);
			const externalStatic = [
				...scanned.scripts
					.filter((item) => item.kind === 'external')
					.map((item) => item.source),
				...scanned.resources
					.filter((item) => item.kind === 'external')
					.map((item) => item.href),
			].sort();
			if (canonicalize(externalStatic) !== canonicalize(network.blocked))
				throw new Error(
					`${vertical.id}/${lane.lane} static resources do not reconcile with blocked requests`,
				);
			if (network.successfulNonLoopback.length !== 0)
				throw new Error(
					`${vertical.id}/${lane.lane} observed successful non-loopback traffic`,
				);
			lanes.push({
				lane: lane.lane,
				entrypoint: { path: lane.entrypointPath, sha256: lane.entrypointSha256 },
				receipt: { path: lane.receiptPath, digest: lane.receiptDigest },
				...scanned,
				network,
			});
		}
		const legacy = lanes[0];
		const target = lanes[1];
		if (!legacy || !target) throw new Error('Vertical lanes are incomplete');
		assertNoIntroducedExternalScripts(legacy.scripts, target.scripts);
		const legacyLocal = legacy.scripts.filter((item) => item.kind === 'local');
		const targetLocal = target.scripts.filter((item) => item.kind === 'local');
		verticals.push({
			id: vertical.id,
			sourceApplication: vertical.sourceApplication,
			externalScriptIntroduced: false,
			lanes,
			differences: {
				localScriptCount: {
					legacy: legacyLocal.length,
					target: targetLocal.length,
					delta: targetLocal.length - legacyLocal.length,
				},
				localScriptFilenames: difference(
					legacyLocal.map((item) => item.resolvedPath ?? ''),
					targetLocal.map((item) => item.resolvedPath ?? ''),
				),
				externalResources: difference(
					legacy.resources
						.filter((item) => item.kind === 'external')
						.map((item) => item.href),
					target.resources
						.filter((item) => item.kind === 'external')
						.map((item) => item.href),
				),
			},
		});
	}
	const lanes = verticals.flatMap((vertical) => vertical.lanes);
	const scripts = lanes.flatMap((lane) => lane.scripts);
	const resources = lanes.flatMap((lane) => lane.resources);
	if (
		scripts.length !== 198 ||
		scripts.some((item) => item.kind !== 'local' || !item.sha256) ||
		resources.length !== 72 ||
		resources.filter((item) => item.kind === 'local' && item.sha256).length !== 66 ||
		resources.filter((item) => item.kind === 'external').length !== 6
	)
		throw new Error('Canonical static script/resource inventory count mismatch');
	return {
		schemaVersion: SCRIPT_SURFACE_SCHEMA,
		summary: {
			verticals: 9,
			sourceApplications: 2,
			lanes: 18,
			scripts: 198,
			resources: 72,
			localResources: 66,
			externalResources: 6,
			externalScriptsIntroduced: 0,
		},
		boundaries: {
			paymentPageApplicability: 'not-established',
			dynamicScriptInsertion: 'not-tested',
			pciCompliance: 'not-claimed',
			certification: 'not-claimed',
			authenticity: 'not-established',
		},
		verticals,
	};
}
