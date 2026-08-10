import { createHash } from 'node:crypto';
import {
	access,
	chmod,
	lstat,
	mkdir,
	readFile,
	readdir,
	readlink,
	rename,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { request } from 'node:https';
import type { Readable } from 'node:stream';
import { gunzipSync } from 'node:zlib';
import { charIn, createRegExp } from 'magic-regexp';
import { basename, dirname, extname, isAbsolute, join, normalize, relative, resolve } from 'pathe';
import { joinURL, parseURL } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { inspectNpmPackageTarball } from '../../../core/src/receipts/npm-lock-acquisition-preflight.ts';

export const REACT_ACTUAL_BUDGET_CONSENT =
	'T584-official-source-actual-budget-v22-12-9-react16-production-symlink-correction' as const;
export const REACT_ACTUAL_BUDGET_REVISION = '3edf94714540837c67e6ac521efef3eed5e15bc6' as const;
export const REACT_ACTUAL_BUDGET_TREE = '1dcc782100f84487473a871b5af099769ab90a07' as const;

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const fixturePath = join(repositoryRoot, 'fixtures/react-actual-budget-v22-12-9/fixture.json');
const cacheRoot = join(repositoryRoot, '.versionless/cache/react-actual-budget-v22-12-9/t584');
const stageRoot = join(repositoryRoot, '.versionless/stage/react-actual-budget-v22-12-9/t584');
const workRoot = join(repositoryRoot, '.versionless/work/react-actual-budget-v22-12-9/t584');
const ingestRoot = join(repositoryRoot, 'evidence/ingests/react-actual-budget-v22-12-9');
const dependencyRoot = join(repositoryRoot, 'evidence/dependencies/react-actual-budget-v22-12-9');
const runRoot = join(repositoryRoot, 'evidence/runs/react-actual-budget-v22-12-9-react16-to-vite8');
const attemptPath = join(ingestRoot, 't584/attempt.json');
const failurePath = join(ingestRoot, 't584/terminal-failure.json');
const ingestReceiptPath = join(ingestRoot, 'receipt.json');
const dependencyReceiptPath = join(dependencyRoot, 'receipt.json');

const maximumGitHubResponseBytes = 100 * 1024 * 1024;
const maximumGitHubAggregateBytes = 160 * 1024 * 1024;
const maximumRegistryResponseBytes = 50 * 1024 * 1024;
const maximumRegistryAggregateBytes = 1_500 * 1024 * 1024;
const maximumPackageIdentities = 1_600;
const maximumRegistryResponses = 3_250;
const requestTimeoutMilliseconds = 45_000;
const maximumSymlinkBytes = 4_096;
const maximumArchiveExpandedBytes = 1_024 * 1_024 * 1_024;
const t582AttemptPath = join(ingestRoot, 't582/attempt.json');
const t582FailurePath = join(ingestRoot, 't582/terminal-failure.json');
const t582AttemptSha256 = '45b8823234b6f0964f778dbf3d8648381711f5478a3eebf5fafa4eb1681ba141';
const t582FailureSha256 = '89451af24c97b8fea5415a1a5a468ad5ffc764fe813ae7021574231d5dce2c33';
const t582CanonicalDigest = '5ef2239379dcd636b1ecd74e86ba68be7e50fcf87a4d9a8eba6ca8e4faa9528b';
const lowerHex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const lowerHex64 = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);

type Fixture = {
	schemaVersion: string;
	repository: string;
	tag: string;
	revision: typeof REACT_ACTUAL_BUDGET_REVISION;
	tree: typeof REACT_ACTUAL_BUDGET_TREE;
	commitUrl: string;
	treeUrl: string;
	archiveUrl: string;
	source: {
		rows: number;
		licensePath: string;
		licenseGitSha: string;
		licenseSha256: string;
		lockPath: string;
		lockGitSha: string;
		lockBytes: number;
		packageManager: string;
	};
	baseline: { node: string; react: string; bundler: string; workspaces: string[] };
	target: { node: string; react: string; reactDom: string; scheduler: string; vite: string };
};

export type GitTreeRow = { path: string; mode: string; type: string; sha: string; size?: number };

export type ActualBudgetSymlinkIdentity = {
	path: string;
	mode: '120000';
	gitSha: string;
	bytes: number;
	target: string;
	targetSha256: string;
	resolvedPath: string;
};

export type ActualBudgetArchiveEntry = {
	path: string;
	kind: 'file' | 'directory' | 'symlink';
	mode: string;
	data: Buffer;
	target: string | null;
};

export type ActualBudgetSourceManifestRow = {
	path: string;
	kind: 'file' | 'symlink';
	mode: string;
	bytes: number;
	gitSha: string;
	sha256: string;
	target: string | null;
};

export class ActualBudgetBoundaryError extends Error {
	readonly code: string;
	readonly row: GitTreeRow | null;
	readonly target: string | null;

	constructor(
		code: string,
		message: string,
		row: GitTreeRow | null = null,
		target: string | null = null,
	) {
		super(message);
		this.name = 'ActualBudgetBoundaryError';
		this.code = code;
		this.row = row;
		this.target = target;
	}
}

export type ActualBudgetPackageIdentity = {
	name: string;
	version: string;
	selectors: string[];
	metadataUrl: string;
	mirror: string;
};

type AccessRow = {
	ordinal: number;
	origin: 'github' | 'registry';
	url: string;
	media: 'json' | 'binary';
	result: 'accepted' | 'failed';
	wireBytes: number;
	decodedBytes: number;
	sha256: string | null;
	sha512: string | null;
	responseCookiePresent: boolean;
};

export type ActualBudgetNetworkState = {
	requests: number;
	responses: number;
	registryResponses: number;
	wire: { github: number; registry: number };
	decoded: { github: number; registry: number };
	ledger: AccessRow[];
};

type LauncherMode = 'launcher-smoke' | 'acquire' | 'verify';

const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;
const exists = (path: string): Promise<boolean> =>
	access(path).then(
		() => true,
		() => false,
	);
const gitBlobSha = (bytes: Uint8Array): string =>
	createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');

function unquote(value: string): string {
	if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
	return value;
}

function parseNpmResolution(value: string): { name: string; version: string } | undefined {
	const marker = value.lastIndexOf('@npm:');
	if (marker < 1) return undefined;
	const name = value.slice(0, marker);
	const versionWithParameters = value.slice(marker + '@npm:'.length);
	const parameter = versionWithParameters.indexOf('::');
	const version =
		parameter < 0 ? versionWithParameters : versionWithParameters.slice(0, parameter);
	if (!name || !version || version.includes('/') || version.includes('\\'))
		throw new Error('Actual Budget Yarn npm resolution differs');
	return { name, version };
}

function metadataUrl(name: string, version: string): string {
	return joinURL('https://registry.npmjs.org', encodeURIComponent(name), version);
}

export function analyzeActualBudgetYarnLock(bytes: Uint8Array): {
	artifacts: ActualBudgetPackageIdentity[];
	selectors: number;
	digest: string;
} {
	const text = Buffer.from(bytes).toString('utf8');
	if (!text.startsWith('__metadata:\n') || !text.includes('  version: 6'))
		throw new Error('Actual Budget requires committed Yarn lock schema 6');
	const byIdentity = new Map<string, ActualBudgetPackageIdentity>();
	let selectors: string[] = [];
	let resolution: string | undefined;
	const flush = (): void => {
		if (selectors.length === 0 && resolution === undefined) return;
		if (selectors.length === 0 || !resolution)
			throw new Error('Actual Budget Yarn stanza lacks selectors or resolution');
		const parsed = parseNpmResolution(resolution);
		if (parsed) {
			const key = `${parsed.name}@${parsed.version}`;
			const prior = byIdentity.get(key);
			if (prior) prior.selectors.push(...selectors);
			else
				byIdentity.set(key, {
					...parsed,
					selectors: [...selectors],
					metadataUrl: metadataUrl(parsed.name, parsed.version),
					mirror: `${sha256(key)}.tgz`,
				});
		}
		selectors = [];
		resolution = undefined;
	};
	for (const line of text.split('\n')) {
		if (line && !line.startsWith(' ') && line.endsWith(':')) {
			flush();
			const key = unquote(line.slice(0, -1));
			selectors = key === '__metadata' ? [] : key.split(', ');
		} else if (line.startsWith('  resolution: ')) {
			resolution = unquote(line.slice('  resolution: '.length));
		}
	}
	flush();
	const artifacts = [...byIdentity.values()]
		.map((artifact) => ({
			...artifact,
			selectors: [...new Set(artifact.selectors)].sort(compareText),
		}))
		.sort((left, right) =>
			compareText(`${left.name}@${left.version}`, `${right.name}@${right.version}`),
		);
	const selectorCount = artifacts.reduce((sum, artifact) => sum + artifact.selectors.length, 0);
	if (artifacts.length < 200 || artifacts.length > maximumPackageIdentities)
		throw new Error('Actual Budget focused closure package cap differs');
	if (artifacts.length * 2 + 3 > maximumRegistryResponses)
		throw new Error('Actual Budget focused closure response cap differs');
	return { artifacts, selectors: selectorCount, digest: sha256(canonicalize(artifacts)) };
}

export function parseActualBudgetLauncher(args: string[]): LauncherMode {
	if (
		args.length !== 1 &&
		(args.length !== 3 || args[1] !== '--consent-id' || args[2] !== REACT_ACTUAL_BUDGET_CONSENT)
	)
		throw new Error('Actual Budget launcher arguments differ');
	if (args[0] === '--verify' && args.length === 1) {
		if (
			process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
			process.env.NPM_CONFIG_OFFLINE !== 'true'
		)
			throw new Error('Actual Budget verification requires strict offline mode');
		return 'verify';
	}
	if (args[0] === '--launcher-smoke') {
		if (
			process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
			process.env.NPM_CONFIG_OFFLINE !== 'true' ||
			process.env.VERSIONLESS_CONSENT_ID !== undefined
		)
			throw new Error('Actual Budget launcher smoke requires strict offline mode');
		return 'launcher-smoke';
	}
	if (
		args[0] !== '--acquire' ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== REACT_ACTUAL_BUDGET_CONSENT
	)
		throw new Error('Actual Budget acquisition requires exact one-shot consent');
	return 'acquire';
}

export function assertActualBudgetUrl(url: string, allowed: ReadonlySet<string>): void {
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.auth ||
		parsed.hash ||
		!allowed.has(url) ||
		!['api.github.com', 'codeload.github.com', 'registry.npmjs.org'].includes(parsed.host ?? '')
	)
		throw new Error('Actual Budget URL is outside exact consent');
}

export function assertActualBudgetTarballUrl(
	url: string,
	identity: Pick<ActualBudgetPackageIdentity, 'name' | 'version'>,
): void {
	const parsed = parseURL(url);
	const decodedPath = decodeURIComponent(parsed.pathname);
	const packageBase = identity.name.startsWith('@')
		? identity.name.slice(identity.name.indexOf('/') + 1)
		: identity.name;
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== 'registry.npmjs.org' ||
		parsed.auth ||
		parsed.search ||
		parsed.hash ||
		!decodedPath.endsWith(`/-/${packageBase}-${identity.version}.tgz`) ||
		!decodedPath.startsWith(`/${identity.name}/`)
	)
		throw new Error('Actual Budget registry tarball URL differs');
}

export function assertActualBudgetTreeRows(rows: GitTreeRow[]): void {
	if (rows.length !== 3_203) throw new Error('Actual Budget Git tree row count differs');
	const paths = new Set<string>();
	for (const row of rows) {
		const parts = row.path.split('/');
		if (
			!row.path ||
			row.path.startsWith('/') ||
			row.path.includes('\\') ||
			parts.some((part) => !part || part === '.' || part === '..') ||
			paths.has(row.path) ||
			!lowerHex40.test(row.sha)
		)
			throw new ActualBudgetBoundaryError(
				'tree-row-identity',
				'Actual Budget Git tree row identity differs',
				row,
			);
		paths.add(row.path);
		if (row.type === 'blob') {
			if (!['100644', '100755', '120000'].includes(row.mode))
				throw new ActualBudgetBoundaryError(
					row.mode === '160000' ? 'gitlink-forbidden' : 'blob-mode-unsupported',
					'Actual Budget Git blob mode differs',
					row,
				);
			if (!Number.isSafeInteger(row.size) || (row.size ?? -1) < 0)
				throw new ActualBudgetBoundaryError(
					'blob-size-invalid',
					'Actual Budget Git blob size differs',
					row,
				);
			if (row.mode === '120000' && (row.size === 0 || row.size! > maximumSymlinkBytes))
				throw new ActualBudgetBoundaryError(
					'symlink-size-invalid',
					'Actual Budget Git symlink blob size differs',
					row,
				);
		} else if (row.type === 'tree') {
			if (row.mode !== '040000' || row.size !== undefined)
				throw new ActualBudgetBoundaryError(
					'tree-mode-unsupported',
					'Actual Budget Git directory identity differs',
					row,
				);
		} else
			throw new ActualBudgetBoundaryError(
				row.mode === '160000' || row.type === 'commit'
					? 'gitlink-forbidden'
					: 'tree-type-unsupported',
				'Actual Budget source contains a submodule or special row',
				row,
			);
	}
}

function roundTripUtf8(bytes: Buffer): string {
	const target = bytes.toString('utf8');
	if (!Buffer.from(target, 'utf8').equals(bytes))
		throw new ActualBudgetBoundaryError(
			'symlink-target-utf8',
			'Actual Budget symlink target is not round-trippable UTF-8',
		);
	return target;
}

function resolveSafeSymlinkTarget(row: GitTreeRow, target: string): string {
	const parsed = parseURL(target);
	if (
		!target ||
		Buffer.byteLength(target) > maximumSymlinkBytes ||
		target.includes('\0') ||
		target.includes('\n') ||
		target.includes('\r') ||
		target.includes('\\') ||
		isAbsolute(target) ||
		parsed.protocol ||
		parsed.host ||
		parsed.auth
	)
		throw new ActualBudgetBoundaryError(
			'symlink-target-malformed',
			'Actual Budget symlink target is malformed',
			row,
			target,
		);
	const resolvedPath = normalize(join(dirname(row.path), target));
	if (!resolvedPath || resolvedPath === '..' || resolvedPath.startsWith('../'))
		throw new ActualBudgetBoundaryError(
			'symlink-target-escape',
			'Actual Budget symlink target escapes the immutable source root',
			row,
			target,
		);
	return resolvedPath;
}

export function validateActualBudgetSymlinkRows(
	rows: GitTreeRow[],
	linkBytesBySha: ReadonlyMap<string, Uint8Array>,
): ActualBudgetSymlinkIdentity[] {
	const rowByPath = new Map(rows.map((row) => [row.path, row] as const));
	const links = rows.filter((row) => row.type === 'blob' && row.mode === '120000');
	const identities = links.map((row) => {
		const source = linkBytesBySha.get(row.sha);
		if (!source)
			throw new ActualBudgetBoundaryError(
				'symlink-blob-absent',
				'Actual Budget symlink Git blob is absent',
				row,
			);
		const bytes = Buffer.from(source);
		if (bytes.length !== row.size || gitBlobSha(bytes) !== row.sha)
			throw new ActualBudgetBoundaryError(
				'symlink-blob-identity',
				'Actual Budget symlink Git blob identity differs',
				row,
			);
		const target = roundTripUtf8(bytes);
		const resolvedPath = resolveSafeSymlinkTarget(row, target);
		const resolved = rowByPath.get(resolvedPath);
		if (!resolved)
			throw new ActualBudgetBoundaryError(
				'symlink-target-dangling',
				'Actual Budget symlink target is dangling',
				row,
				target,
			);
		if (resolved.type === 'tree')
			throw new ActualBudgetBoundaryError(
				'symlink-target-directory',
				'Actual Budget symlink target is a directory',
				row,
				target,
			);
		return {
			path: row.path,
			mode: '120000' as const,
			gitSha: row.sha,
			bytes: bytes.length,
			target,
			targetSha256: sha256(bytes),
			resolvedPath,
		};
	});
	const byPath = new Map(identities.map((identity) => [identity.path, identity] as const));
	for (const identity of identities) {
		const seen = new Set([identity.path]);
		let current = identity;
		while (byPath.has(current.resolvedPath)) {
			if (seen.has(current.resolvedPath))
				throw new ActualBudgetBoundaryError(
					'symlink-target-cycle',
					'Actual Budget symlink target chain is cyclic',
					rowByPath.get(identity.path) ?? null,
					identity.target,
				);
			seen.add(current.resolvedPath);
			current = byPath.get(current.resolvedPath)!;
		}
		const terminal = rowByPath.get(current.resolvedPath);
		if (!terminal || terminal.type !== 'blob' || !['100644', '100755'].includes(terminal.mode))
			throw new ActualBudgetBoundaryError(
				'symlink-target-terminal',
				'Actual Budget symlink chain does not terminate at a regular blob',
				rowByPath.get(identity.path) ?? null,
				identity.target,
			);
	}
	return identities.sort((left, right) => compareText(left.path, right.path));
}

export function parseActualBudgetSymlinkBlob(
	value: unknown,
	row: GitTreeRow,
	expectedUrl: string,
): Buffer {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new ActualBudgetBoundaryError(
			'symlink-blob-document',
			'Actual Budget symlink Git blob document differs',
			row,
		);
	const blob = value as {
		sha?: unknown;
		size?: unknown;
		url?: unknown;
		encoding?: unknown;
		content?: unknown;
	};
	if (
		row.type !== 'blob' ||
		row.mode !== '120000' ||
		blob.sha !== row.sha ||
		blob.size !== row.size ||
		blob.url !== expectedUrl ||
		blob.encoding !== 'base64' ||
		typeof blob.content !== 'string'
	)
		throw new ActualBudgetBoundaryError(
			'symlink-blob-document',
			'Actual Budget symlink Git blob document differs',
			row,
		);
	const encoded = blob.content.split('\n').join('').split('\r').join('');
	const bytes = Buffer.from(encoded, 'base64');
	if (
		!encoded ||
		bytes.toString('base64') !== encoded ||
		bytes.length !== row.size ||
		gitBlobSha(bytes) !== row.sha
	)
		throw new ActualBudgetBoundaryError(
			'symlink-blob-base64-identity',
			'Actual Budget symlink Git blob base64 identity differs',
			row,
		);
	roundTripUtf8(bytes);
	return bytes;
}

function tarString(header: Buffer, offset: number, length: number): string {
	const field = header.subarray(offset, offset + length);
	const end = field.indexOf(0);
	return field.subarray(0, end < 0 ? field.length : end).toString('utf8');
}

function tarOctal(header: Buffer, offset: number, length: number): number {
	const raw = tarString(header, offset, length).trim();
	if (!raw) return 0;
	if ([...raw].some((character) => character < '0' || character > '7'))
		throw new ActualBudgetBoundaryError(
			'archive-octal-invalid',
			'Actual Budget archive octal field differs',
		);
	const value = Number.parseInt(raw, 8);
	if (!Number.isSafeInteger(value) || value < 0)
		throw new ActualBudgetBoundaryError(
			'archive-octal-invalid',
			'Actual Budget archive octal value differs',
		);
	return value;
}

function safeArchivePath(rawPath: string): string {
	const path = rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
	const parts = path.split('/');
	if (
		!path ||
		path.startsWith('/') ||
		path.includes('\\') ||
		parts.some((part) => !part || part === '.' || part === '..')
	)
		throw new ActualBudgetBoundaryError(
			'archive-path-unsafe',
			'Actual Budget source archive path is unsafe',
		);
	return path;
}

export function inspectActualBudgetSourceArchive(
	archive: Uint8Array,
	rows: GitTreeRow[],
	symlinks: ActualBudgetSymlinkIdentity[],
	maximumExpandedBytes = maximumArchiveExpandedBytes,
): ActualBudgetArchiveEntry[] {
	let expanded: Buffer;
	try {
		expanded = gunzipSync(Buffer.from(archive), { maxOutputLength: maximumExpandedBytes });
	} catch {
		throw new ActualBudgetBoundaryError(
			'archive-expansion-failed',
			'Actual Budget source archive is invalid or exceeds its expansion cap',
		);
	}
	const expected = new Map(rows.map((row) => [row.path, row] as const));
	const symlinkByPath = new Map(symlinks.map((row) => [row.path, row] as const));
	const entries: ActualBudgetArchiveEntry[] = [];
	const seen = new Set<string>();
	let offset = 0;
	let archiveRoot: string | undefined;
	let terminators = 0;
	while (offset + 512 <= expanded.length) {
		const header = expanded.subarray(offset, offset + 512);
		if (header.every((byte) => byte === 0)) {
			terminators += 1;
			offset += 512;
			if (terminators === 2) break;
			continue;
		}
		if (terminators !== 0)
			throw new ActualBudgetBoundaryError(
				'archive-terminator-invalid',
				'Actual Budget archive terminator differs',
			);
		const expectedChecksum = tarOctal(header, 148, 8);
		let checksum = 0;
		for (let index = 0; index < header.length; index += 1)
			checksum += index >= 148 && index < 156 ? 32 : header[index]!;
		if (checksum !== expectedChecksum)
			throw new ActualBudgetBoundaryError(
				'archive-header-checksum',
				'Actual Budget archive header checksum differs',
			);
		const name = tarString(header, 0, 100);
		const prefix = tarString(header, 345, 155);
		const rawPath = safeArchivePath(prefix ? `${prefix}/${name}` : name);
		const pathParts = rawPath.split('/');
		archiveRoot ??= pathParts[0];
		if (pathParts[0] !== archiveRoot)
			throw new ActualBudgetBoundaryError(
				'archive-root-multiple',
				'Actual Budget source archive has multiple roots',
			);
		const path = pathParts.slice(1).join('/');
		const size = tarOctal(header, 124, 12);
		const bodyStart = offset + 512;
		const bodyEnd = bodyStart + size;
		const next = bodyStart + Math.ceil(size / 512) * 512;
		if (bodyEnd > expanded.length || next > expanded.length)
			throw new ActualBudgetBoundaryError(
				'archive-entry-truncated',
				'Actual Budget source archive entry is truncated',
			);
		const rawType = header[156] === 0 ? '0' : String.fromCharCode(header[156]!);
		if (!path) {
			if (rawType !== '5' || size !== 0)
				throw new ActualBudgetBoundaryError(
					'archive-root-entry',
					'Actual Budget source archive root entry differs',
				);
			offset = next;
			continue;
		}
		if (seen.has(path))
			throw new ActualBudgetBoundaryError(
				'archive-path-duplicate',
				'Actual Budget source archive path is duplicated',
				expected.get(path) ?? null,
			);
		seen.add(path);
		const row = expected.get(path);
		if (!row)
			throw new ActualBudgetBoundaryError(
				'archive-path-unexpected',
				'Actual Budget source archive path is not in the immutable tree',
			);
		const data = Buffer.from(expanded.subarray(bodyStart, bodyEnd));
		if (rawType === '0' || rawType === '\0') {
			if (
				row.type !== 'blob' ||
				!['100644', '100755'].includes(row.mode) ||
				size !== row.size ||
				gitBlobSha(data) !== row.sha
			)
				throw new ActualBudgetBoundaryError(
					'archive-file-identity',
					'Actual Budget archive regular-file identity differs',
					row,
				);
			entries.push({ path, kind: 'file', mode: row.mode, data, target: null });
		} else if (rawType === '5') {
			if (row.type !== 'tree' || row.mode !== '040000' || size !== 0)
				throw new ActualBudgetBoundaryError(
					'archive-directory-identity',
					'Actual Budget archive directory identity differs',
					row,
				);
			entries.push({ path, kind: 'directory', mode: row.mode, data, target: null });
		} else if (rawType === '2') {
			const link = symlinkByPath.get(path);
			const target = tarString(header, 157, 100);
			if (
				row.type !== 'blob' ||
				row.mode !== '120000' ||
				size !== 0 ||
				!link ||
				target !== link.target ||
				gitBlobSha(Buffer.from(target, 'utf8')) !== row.sha
			)
				throw new ActualBudgetBoundaryError(
					'archive-symlink-identity',
					'Actual Budget archive symlink identity differs',
					row,
					target,
				);
			entries.push({ path, kind: 'symlink', mode: row.mode, data, target });
		} else
			throw new ActualBudgetBoundaryError(
				['1', '3', '4', '6'].includes(rawType)
					? 'archive-special-entry'
					: rawType === 'x' || rawType === 'g' || rawType === 'L' || rawType === 'K'
						? 'archive-pax-or-longname-forbidden'
						: 'archive-type-unsupported',
				'Actual Budget source archive entry type is forbidden',
				row,
			);
		offset = next;
	}
	if (
		terminators !== 2 ||
		expanded.subarray(offset).some((byte) => byte !== 0) ||
		expected.size !== seen.size
	)
		throw new ActualBudgetBoundaryError(
			'archive-membership-incomplete',
			'Actual Budget source archive does not exactly cover the immutable tree',
		);
	const linkPaths = new Set(symlinks.map((link) => link.path));
	for (const entry of entries) {
		let parent = dirname(entry.path);
		while (parent && parent !== '.') {
			if (linkPaths.has(parent))
				throw new ActualBudgetBoundaryError(
					'archive-entry-below-symlink',
					'Actual Budget archive contains an entry below a symlink',
					expected.get(entry.path) ?? null,
				);
			const nextParent = dirname(parent);
			if (nextParent === parent) break;
			parent = nextParent;
		}
	}
	return entries.sort((left, right) => compareText(left.path, right.path));
}

export function assertActualBudgetArchiveEntries(entries: string[]): void {
	if (entries.length < 3_000 || entries.length > 20_000)
		throw new Error('Actual Budget source archive cardinality differs');
	let archiveRoot: string | undefined;
	for (const rawEntry of entries) {
		const entry = rawEntry.endsWith('/') ? rawEntry.slice(0, -1) : rawEntry;
		if (!entry) continue;
		const parts = entry.split('/');
		if (
			entry.startsWith('/') ||
			entry.includes('\\') ||
			parts.some((part) => !part || part === '.' || part === '..')
		)
			throw new Error('Actual Budget source archive path is unsafe');
		archiveRoot ??= parts[0];
		if (parts[0] !== archiveRoot) throw new Error('Actual Budget source archive root differs');
	}
}

export async function collectActualBudgetIdentityStream(
	stream: Readable,
	limit: number,
	onWire: (bytes: number) => void = () => undefined,
): Promise<Buffer> {
	return await new Promise((resolvePromise, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;
		let settled = false;
		const finish = (error?: Error): void => {
			if (settled) return;
			settled = true;
			if (error) reject(error);
			else resolvePromise(Buffer.concat(chunks));
		};
		stream.on('data', (chunk: Buffer) => {
			total += chunk.length;
			onWire(chunk.length);
			if (total > limit) {
				stream.destroy(new Error('Actual Budget response byte cap exceeded'));
				return;
			}
			chunks.push(chunk);
		});
		stream.once('end', () => finish());
		stream.once('error', (error) => finish(error));
		stream.once('aborted', () => finish(new Error('Actual Budget response aborted')));
	});
}

function originFor(url: string): AccessRow['origin'] {
	return parseURL(url).host === 'registry.npmjs.org' ? 'registry' : 'github';
}

function assertAggregateCaps(state: ActualBudgetNetworkState): void {
	if (
		state.wire.github > maximumGitHubAggregateBytes ||
		state.decoded.github > maximumGitHubAggregateBytes ||
		state.wire.registry > maximumRegistryAggregateBytes ||
		state.decoded.registry > maximumRegistryAggregateBytes
	)
		throw new Error('Actual Budget aggregate byte cap exceeded');
}

async function getExact(
	url: string,
	media: AccessRow['media'],
	allowed: ReadonlySet<string>,
	state: ActualBudgetNetworkState,
): Promise<Buffer> {
	assertActualBudgetUrl(url, allowed);
	const origin = originFor(url);
	if (origin === 'registry' && state.registryResponses >= maximumRegistryResponses)
		throw new Error('Actual Budget registry response cap exceeded');
	state.requests += 1;
	if (origin === 'registry') state.registryResponses += 1;
	const ordinal = state.requests;
	const responseLimit =
		origin === 'registry' ? maximumRegistryResponseBytes : maximumGitHubResponseBytes;
	let wireBytes = 0;
	let responseCookiePresent = false;
	try {
		const bytes = await new Promise<Buffer>((resolvePromise, reject) => {
			const call = request(
				url,
				{
					method: 'GET',
					headers: {
						accept: media === 'json' ? 'application/json' : 'application/octet-stream',
						'accept-encoding': 'identity',
						'user-agent': 'versionless-t582',
					},
				},
				(response) => {
					responseCookiePresent = response.headers['set-cookie'] !== undefined;
					const encoding = response.headers['content-encoding'];
					const accepted =
						response.statusCode === 200 &&
						response.headers.location === undefined &&
						(encoding === undefined || encoding === 'identity');
					collectActualBudgetIdentityStream(response, responseLimit, (size) => {
						wireBytes += size;
					}).then(
						(value) =>
							accepted
								? resolvePromise(value)
								: reject(new Error('Actual Budget response boundary differs')),
						reject,
					);
				},
			);
			call.setTimeout(requestTimeoutMilliseconds, () =>
				call.destroy(new Error('Actual Budget response timeout')),
			);
			call.once('error', reject);
			call.end();
		});
		state.responses += 1;
		state.wire[origin] += wireBytes;
		state.decoded[origin] += bytes.length;
		assertAggregateCaps(state);
		if (wireBytes !== bytes.length)
			throw new Error('Actual Budget identity transfer counters differ');
		state.ledger.push({
			ordinal,
			origin,
			url,
			media,
			result: 'accepted',
			wireBytes,
			decodedBytes: bytes.length,
			sha256: sha256(bytes),
			sha512: createHash('sha512').update(bytes).digest('hex'),
			responseCookiePresent,
		});
		return bytes;
	} catch (error) {
		state.wire[origin] += wireBytes;
		state.decoded[origin] += wireBytes;
		state.ledger.push({
			ordinal,
			origin,
			url,
			media,
			result: 'failed',
			wireBytes,
			decodedBytes: wireBytes,
			sha256: null,
			sha512: null,
			responseCookiePresent,
		});
		assertAggregateCaps(state);
		throw error;
	}
}

export async function materializeActualBudgetSource(
	destination: string,
	entries: ActualBudgetArchiveEntry[],
): Promise<void> {
	const root = normalize(resolve(destination));
	const materializedPath = (entry: ActualBudgetArchiveEntry): string => {
		const normalized = normalize(entry.path);
		const absolute = resolve(root, normalized);
		if (
			!entry.path ||
			entry.path !== normalized ||
			normalized === '..' ||
			normalized.startsWith('../') ||
			relative(root, absolute).startsWith('../')
		)
			throw new ActualBudgetBoundaryError(
				'materialize-path-unsafe',
				'Actual Budget materialization path is unsafe',
			);
		return absolute;
	};
	await mkdir(root, { recursive: true });
	for (const entry of entries.filter((row) => row.kind === 'directory'))
		await mkdir(materializedPath(entry), { recursive: true });
	for (const entry of entries.filter((row) => row.kind === 'file')) {
		const path = materializedPath(entry);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, entry.data, {
			flag: 'wx',
			mode: entry.mode === '100755' ? 0o755 : 0o644,
		});
		await chmod(path, entry.mode === '100755' ? 0o755 : 0o644);
	}
	for (const entry of entries.filter((row) => row.kind === 'symlink')) {
		if (!entry.target)
			throw new ActualBudgetBoundaryError(
				'materialize-symlink-target-absent',
				'Actual Budget materialized symlink target is absent',
			);
		resolveSafeSymlinkTarget(
			{
				path: entry.path,
				mode: '120000',
				type: 'blob',
				sha: gitBlobSha(Buffer.from(entry.target, 'utf8')),
				size: Buffer.byteLength(entry.target),
			},
			entry.target,
		);
		const path = materializedPath(entry);
		await mkdir(dirname(path), { recursive: true });
		await symlink(entry.target, path);
	}
}

export async function actualBudgetSourceManifestFromFilesystem(
	source: string,
	rows: GitTreeRow[],
): Promise<ActualBudgetSourceManifestRow[]> {
	const rowByPath = new Map(rows.map((row) => [row.path, row] as const));
	const manifest: ActualBudgetSourceManifestRow[] = [];
	const visit = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const absolute = join(directory, entry.name);
			const path = relative(source, absolute);
			const row = rowByPath.get(path);
			if (!row)
				throw new ActualBudgetBoundaryError(
					'materialized-path-unexpected',
					'Actual Budget materialized path is not in the immutable tree',
				);
			const statistics = await lstat(absolute);
			if (entry.isDirectory()) {
				if (!statistics.isDirectory() || row.type !== 'tree' || row.mode !== '040000')
					throw new ActualBudgetBoundaryError(
						'materialized-directory-identity',
						'Actual Budget materialized directory identity differs',
						row,
					);
				await visit(absolute);
			} else if (entry.isFile()) {
				const bytes = await readFile(absolute);
				const executable = (statistics.mode & 0o111) !== 0;
				if (
					!statistics.isFile() ||
					row.type !== 'blob' ||
					!['100644', '100755'].includes(row.mode) ||
					(row.mode === '100755') !== executable ||
					row.size !== bytes.length ||
					row.sha !== gitBlobSha(bytes)
				)
					throw new ActualBudgetBoundaryError(
						'materialized-file-identity',
						'Actual Budget materialized regular-file identity differs',
						row,
					);
				manifest.push({
					path,
					kind: 'file',
					mode: row.mode,
					bytes: bytes.length,
					gitSha: row.sha,
					sha256: sha256(bytes),
					target: null,
				});
			} else if (entry.isSymbolicLink()) {
				const target = await readlink(absolute);
				const bytes = Buffer.from(target, 'utf8');
				if (
					!statistics.isSymbolicLink() ||
					row.type !== 'blob' ||
					row.mode !== '120000' ||
					row.size !== bytes.length ||
					row.sha !== gitBlobSha(bytes) ||
					resolveSafeSymlinkTarget(row, target) === ''
				)
					throw new ActualBudgetBoundaryError(
						'materialized-symlink-identity',
						'Actual Budget materialized symlink identity differs',
						row,
						target,
					);
				manifest.push({
					path,
					kind: 'symlink',
					mode: row.mode,
					bytes: bytes.length,
					gitSha: row.sha,
					sha256: sha256(bytes),
					target,
				});
			} else
				throw new ActualBudgetBoundaryError(
					'materialized-special-entry',
					'Actual Budget materialized source contains a special entry',
					row,
				);
		}
	};
	await visit(source);
	const expectedBlobs = rows.filter((row) => row.type === 'blob').length;
	if (manifest.length !== expectedBlobs)
		throw new ActualBudgetBoundaryError(
			'materialized-membership-incomplete',
			'Actual Budget materialized source omits immutable blobs',
		);
	return manifest.sort((left, right) => compareText(left.path, right.path));
}

function verifyRootSource(source: string, fixture: Fixture): Promise<void> {
	return Promise.all([
		readFile(join(source, fixture.source.licensePath)),
		readFile(join(source, fixture.source.lockPath)),
		readFile(join(source, 'package.json')),
	]).then(([licenseBytes, lockBytes, packageBytes]) => {
		if (
			gitBlobSha(licenseBytes) !== fixture.source.licenseGitSha ||
			sha256(licenseBytes) !== fixture.source.licenseSha256 ||
			!licenseBytes.toString('utf8').includes('MIT License')
		)
			throw new Error('Actual Budget root MIT license identity differs');
		if (
			gitBlobSha(lockBytes) !== fixture.source.lockGitSha ||
			lockBytes.length !== fixture.source.lockBytes
		)
			throw new Error('Actual Budget committed Yarn lock identity differs');
		const manifest = JSON.parse(packageBytes.toString('utf8')) as {
			packageManager?: unknown;
			workspaces?: unknown;
			scripts?: Record<string, unknown>;
		};
		if (
			manifest.packageManager !== fixture.source.packageManager ||
			!Array.isArray(manifest.workspaces) ||
			manifest.scripts?.['start:browser'] === undefined
		)
			throw new Error('Actual Budget root Yarn/browser script identity differs');
	});
}

const targetPackages = Object.freeze([
	Object.freeze({ name: 'react', version: '18.3.1' }),
	Object.freeze({ name: 'react-dom', version: '18.3.1' }),
	Object.freeze({ name: 'scheduler', version: '0.23.2' }),
]);

function allIdentities(closure: ActualBudgetPackageIdentity[]): ActualBudgetPackageIdentity[] {
	const result = new Map(closure.map((row) => [`${row.name}@${row.version}`, row]));
	for (const target of targetPackages) {
		const key = `${target.name}@${target.version}`;
		if (!result.has(key))
			result.set(key, {
				...target,
				selectors: [`versionless-target:${key}`],
				metadataUrl: metadataUrl(target.name, target.version),
				mirror: `${sha256(key)}.tgz`,
			});
	}
	const identities = [...result.values()].sort((left, right) =>
		compareText(`${left.name}@${left.version}`, `${right.name}@${right.version}`),
	);
	if (identities.length > maximumPackageIdentities)
		throw new Error('Actual Budget target closure package cap exceeded');
	if (identities.length * 2 + 3 > maximumRegistryResponses)
		throw new Error('Actual Budget target closure response cap exceeded');
	return identities;
}

function assetLicenseRows(
	manifest: Array<{ path: string; sha256: string }>,
): Array<{ path: string; sha256: string; license: string }> {
	const extensions = new Set(['.css', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.wasm']);
	return manifest
		.filter((row) => extensions.has(extname(row.path).toLowerCase()))
		.map((row) => ({
			...row,
			license: row.path.startsWith('packages/loot-core/') ? 'ISC' : 'MIT',
		}));
}

async function assertFreshRoots(): Promise<void> {
	for (const path of [
		cacheRoot,
		stageRoot,
		workRoot,
		runRoot,
		ingestReceiptPath,
		dependencyReceiptPath,
		attemptPath,
		failurePath,
	])
		if (await exists(path)) throw new Error('Actual Budget acquisition requires fresh roots');
}

async function assertT582EvidencePreserved(): Promise<void> {
	const attempt = await readFile(t582AttemptPath);
	const terminal = await readFile(t582FailurePath);
	if (sha256(attempt) !== t582AttemptSha256 || sha256(terminal) !== t582FailureSha256)
		throw new Error('Actual Budget T582 negative evidence identity differs');
	const value = JSON.parse(terminal.toString('utf8')) as {
		integrity?: { canonicalDigest?: string };
	};
	if (!value.integrity || value.integrity.canonicalDigest !== t582CanonicalDigest)
		throw new Error('Actual Budget T582 terminal canonical identity differs');
	value.integrity.canonicalDigest = '';
	if (sha256(canonicalize(value)) !== t582CanonicalDigest)
		throw new Error('Actual Budget T582 terminal canonical replay differs');
}

async function sealFailure(error: unknown, state: ActualBudgetNetworkState): Promise<void> {
	await mkdir(dirname(failurePath), { recursive: true });
	if (await exists(failurePath)) return;
	const message = error instanceof Error ? error.message : String(error);
	const boundary =
		error instanceof ActualBudgetBoundaryError
			? {
					code: error.code,
					row: error.row,
					target:
						error.target === null
							? null
							: {
									bytes: Buffer.byteLength(error.target),
									sha256: sha256(error.target),
									value: error.target,
								},
				}
			: { code: 'unclassified-boundary', row: null, target: null };
	const receipt = {
		schemaVersion: 'versionless.react-actual-budget-v22-12-9-terminal-failure.v2',
		result: 'terminal-failure',
		counted: false,
		consentId: REACT_ACTUAL_BUDGET_CONSENT,
		consentConsumed: true,
		retry: false,
		reusable: false,
		requestAttempts: state.requests,
		successfulResponses: state.responses,
		positiveResidue: false,
		reason: message.includes('cap')
			? 'resource-cap-failed'
			: message.includes('identity') || message.includes('differs')
				? 'immutable-identity-failed'
				: 'acquisition-boundary-failed',
		boundary,
		access: state,
		nonclaims: ['not certification', 'not signer authenticity', 'not OS-wide isolation'],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
	await writeFile(failurePath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
}

async function rollbackPositiveOutputs(): Promise<void> {
	for (const path of [
		cacheRoot,
		stageRoot,
		workRoot,
		runRoot,
		ingestReceiptPath,
		dependencyReceiptPath,
	])
		await rm(path, { recursive: true, force: true });
}

export async function verifyActualBudgetIngest(): Promise<{ valid: true; digest: string }> {
	const receiptBytes = await readFile(ingestReceiptPath);
	const receipt = JSON.parse(receiptBytes.toString('utf8')) as {
		schemaVersion?: unknown;
		counted?: unknown;
		source?: { manifest?: ActualBudgetSourceManifestRow[]; manifestDigest?: string };
		provenance?: { treeRows?: unknown };
		closure?: { packages?: Array<Record<string, unknown>>; digest?: string };
		integrity?: { canonicalDigest?: string };
	};
	const digest = receipt.integrity?.canonicalDigest;
	if (
		receipt.schemaVersion !== 'versionless.react-actual-budget-v22-12-9-ingest.v1' ||
		receipt.counted !== false ||
		typeof digest !== 'string' ||
		!lowerHex64.test(digest)
	)
		throw new Error('Actual Budget ingest receipt identity differs');
	const copy = structuredClone(receipt);
	copy.integrity!.canonicalDigest = '';
	if (sha256(canonicalize(copy)) !== digest)
		throw new Error('Actual Budget ingest receipt digest differs');
	const source = join(cacheRoot, 'source');
	const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;
	const treeDocument = JSON.parse(await readFile(join(cacheRoot, 'tree.json'), 'utf8')) as {
		sha?: unknown;
		truncated?: unknown;
		tree?: unknown;
	};
	if (
		treeDocument.sha !== fixture.tree ||
		treeDocument.truncated !== false ||
		!Array.isArray(treeDocument.tree) ||
		treeDocument.tree.length !== receipt.provenance?.treeRows
	)
		throw new Error('Actual Budget cached immutable tree differs');
	const treeRows = treeDocument.tree as GitTreeRow[];
	assertActualBudgetTreeRows(treeRows);
	const sourceRows = await actualBudgetSourceManifestFromFilesystem(source, treeRows);
	const expectedSource = receipt.source?.manifest ?? [];
	if (
		canonicalize(sourceRows) !== canonicalize(expectedSource) ||
		sha256(canonicalize(receipt.source?.manifest)) !== receipt.source?.manifestDigest
	)
		throw new Error('Actual Budget cached source replay differs');
	const packages = receipt.closure?.packages ?? [];
	for (const packageRow of packages) {
		if (
			typeof packageRow.mirror !== 'string' ||
			typeof packageRow.sha256 !== 'string' ||
			typeof packageRow.sha512 !== 'string'
		)
			throw new Error('Actual Budget cached package row differs');
		const bytes = await readFile(join(cacheRoot, 'mirror', packageRow.mirror));
		if (
			sha256(bytes) !== packageRow.sha256 ||
			createHash('sha512').update(bytes).digest('hex') !== packageRow.sha512
		)
			throw new Error('Actual Budget cached package replay differs');
	}
	if (sha256(canonicalize(packages)) !== receipt.closure?.digest)
		throw new Error('Actual Budget dependency closure digest differs');
	if (!(await readFile(dependencyReceiptPath)).equals(receiptBytes))
		throw new Error('Actual Budget dependency receipt publication differs');
	if (!(await readFile(join(cacheRoot, 'receipt.json'))).equals(receiptBytes))
		throw new Error('Actual Budget cached receipt publication differs');
	return { valid: true, digest };
}

export async function acquireActualBudget(): Promise<void> {
	await assertT582EvidencePreserved();
	await assertFreshRoots();
	await mkdir(dirname(attemptPath), { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-actual-budget-v22-12-9-attempt.v1', consentId: REACT_ACTUAL_BUDGET_CONSENT, invoked: true })}\n`,
		{ flag: 'wx' },
	);
	const state: ActualBudgetNetworkState = {
		requests: 0,
		responses: 0,
		registryResponses: 0,
		wire: { github: 0, registry: 0 },
		decoded: { github: 0, registry: 0 },
		ledger: [],
	};
	try {
		const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;
		if (
			fixture.schemaVersion !== 'versionless.react-actual-budget-v22-12-9-fixture.v1' ||
			fixture.revision !== REACT_ACTUAL_BUDGET_REVISION ||
			fixture.tree !== REACT_ACTUAL_BUDGET_TREE ||
			fixture.source.rows !== 3_203
		)
			throw new Error('Actual Budget fixture identity differs');
		const allowed = new Set([fixture.commitUrl, fixture.treeUrl, fixture.archiveUrl]);
		const commit = JSON.parse(
			(await getExact(fixture.commitUrl, 'json', allowed, state)).toString('utf8'),
		) as { sha?: unknown; tree?: { sha?: unknown } };
		if (commit.sha !== fixture.revision || commit.tree?.sha !== fixture.tree)
			throw new Error('Actual Budget immutable commit-to-tree identity differs');
		const treeBytes = await getExact(fixture.treeUrl, 'json', allowed, state);
		const treeDocument = JSON.parse(treeBytes.toString('utf8')) as {
			sha?: unknown;
			truncated?: unknown;
			tree?: unknown;
		};
		if (
			treeDocument.sha !== fixture.tree ||
			treeDocument.truncated !== false ||
			!Array.isArray(treeDocument.tree)
		)
			throw new Error('Actual Budget immutable Git tree differs');
		const treeRows = treeDocument.tree as GitTreeRow[];
		assertActualBudgetTreeRows(treeRows);
		const linkBytesBySha = new Map<string, Buffer>();
		for (const row of treeRows.filter((row) => row.type === 'blob' && row.mode === '120000')) {
			if (linkBytesBySha.has(row.sha)) continue;
			const blobUrl = joinURL(
				'https://api.github.com/repos/actualbudget/actual/git/blobs',
				row.sha,
			);
			allowed.add(blobUrl);
			const blob = JSON.parse(
				(await getExact(blobUrl, 'json', allowed, state)).toString('utf8'),
			) as unknown;
			linkBytesBySha.set(row.sha, parseActualBudgetSymlinkBlob(blob, row, blobUrl));
		}
		const symlinkIdentities = validateActualBudgetSymlinkRows(treeRows, linkBytesBySha);
		const archive = await getExact(fixture.archiveUrl, 'binary', allowed, state);
		const acquisition = join(stageRoot, 'acquisition');
		const source = join(acquisition, 'source');
		const mirror = join(acquisition, 'mirror');
		await mkdir(mirror, { recursive: true });
		const archiveEntries = inspectActualBudgetSourceArchive(
			archive,
			treeRows,
			symlinkIdentities,
		);
		await materializeActualBudgetSource(source, archiveEntries);
		const sourceManifest = await actualBudgetSourceManifestFromFilesystem(source, treeRows);
		await verifyRootSource(source, fixture);
		const lockBytes = await readFile(join(source, fixture.source.lockPath));
		const closure = analyzeActualBudgetYarnLock(lockBytes);
		const identities = allIdentities(closure.artifacts);
		for (const identity of identities) allowed.add(identity.metadataUrl);
		const packageRows: Array<Record<string, unknown>> = [];
		for (const identity of identities) {
			const metadataBytes = await getExact(identity.metadataUrl, 'json', allowed, state);
			const metadata = JSON.parse(metadataBytes.toString('utf8')) as {
				name?: unknown;
				version?: unknown;
				license?: unknown;
				dist?: { tarball?: unknown; integrity?: unknown; shasum?: unknown };
			};
			if (
				metadata.name !== identity.name ||
				metadata.version !== identity.version ||
				typeof metadata.dist?.tarball !== 'string' ||
				typeof metadata.dist.integrity !== 'string'
			)
				throw new Error('Actual Budget registry metadata identity differs');
			assertActualBudgetTarballUrl(metadata.dist.tarball, identity);
			allowed.add(metadata.dist.tarball);
			const tarball = await getExact(metadata.dist.tarball, 'binary', allowed, state);
			const integrity = metadata.dist.integrity;
			const separator = integrity.indexOf('-');
			const algorithm = integrity.slice(0, separator);
			if (
				separator < 1 ||
				!['sha1', 'sha512'].includes(algorithm) ||
				createHash(algorithm).update(tarball).digest('base64') !==
					integrity.slice(separator + 1) ||
				(typeof metadata.dist.shasum === 'string' &&
					createHash('sha1').update(tarball).digest('hex') !== metadata.dist.shasum)
			)
				throw new Error('Actual Budget package checksum differs');
			const inspection = inspectNpmPackageTarball(tarball, [identity]);
			await writeFile(join(mirror, identity.mirror), tarball, { flag: 'wx' });
			packageRows.push({
				...identity,
				tarballUrl: metadata.dist.tarball,
				integrity,
				sha1: createHash('sha1').update(tarball).digest('hex'),
				sha256: sha256(tarball),
				sha512: createHash('sha512').update(tarball).digest('hex'),
				bytes: tarball.length,
				license: inspection.license,
				lifecycleScripts: inspection.lifecycleScripts,
				nativeIndicators: inspection.nativeIndicators,
			});
		}
		const receipt = {
			schemaVersion: 'versionless.react-actual-budget-v22-12-9-ingest.v1',
			result: 'pass',
			counted: false,
			consentId: REACT_ACTUAL_BUDGET_CONSENT,
			provenance: {
				repository: fixture.repository,
				tag: fixture.tag,
				revision: fixture.revision,
				tree: fixture.tree,
				archiveSha256: sha256(archive),
				treeRows: treeRows.length,
			},
			source: {
				manifest: sourceManifest,
				manifestDigest: sha256(canonicalize(sourceManifest)),
				symlinks: symlinkIdentities,
				license: {
					root: 'MIT',
					lootCore: 'ISC',
					rootSha256: fixture.source.licenseSha256,
				},
				assets: assetLicenseRows(sourceManifest),
			},
			closure: {
				selection: ['@actual-app/web', '@actual-app/loot-core'],
				lockSchema: 6,
				lockGitSha: fixture.source.lockGitSha,
				lockBytes: fixture.source.lockBytes,
				selectors: closure.selectors,
				packages: packageRows,
				digest: sha256(canonicalize(packageRows)),
				replaysRequired: 2,
			},
			access: {
				...state,
				method: 'GET',
				credentialsSent: false,
				authorizationSent: false,
				cookiesSent: false,
				responseCookiesStored: false,
				redirects: 0,
				retries: 0,
			},
			policy: {
				defaultNetwork: 'offline',
				lifecycleExecuted: false,
				nativeExecuted: false,
				electronExecuted: false,
				mobileExecuted: false,
				hostedSyncExecuted: false,
				telemetryExecuted: false,
			},
			privacy: {
				paymentData: false,
				customerData: false,
				credentials: false,
				hostPaths: false,
			},
			nonclaims: [
				'not certification',
				'not a compliance or legal opinion',
				'not signer authenticity',
				'not OS-wide isolation',
				'not an earned SLSA level',
			],
			integrity: { algorithm: 'sha256', canonicalDigest: '' },
		};
		receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
		const receiptBytes = Buffer.from(`${canonicalize(receipt)}\n`);
		await writeFile(join(acquisition, 'receipt.json'), receiptBytes, { flag: 'wx' });
		await writeFile(join(acquisition, 'tree.json'), treeBytes, { flag: 'wx' });
		const publication = join(stageRoot, 'publication');
		await mkdir(publication, { recursive: true });
		await writeFile(join(publication, 'ingest.json'), receiptBytes, { flag: 'wx' });
		await writeFile(join(publication, 'dependencies.json'), receiptBytes, { flag: 'wx' });
		await mkdir(dirname(cacheRoot), { recursive: true });
		await mkdir(dirname(ingestReceiptPath), { recursive: true });
		await mkdir(dirname(dependencyReceiptPath), { recursive: true });
		await rename(acquisition, cacheRoot);
		await rename(join(publication, 'ingest.json'), ingestReceiptPath);
		await rename(join(publication, 'dependencies.json'), dependencyReceiptPath);
		await rm(stageRoot, { recursive: true, force: true });
		await verifyActualBudgetIngest();
		await verifyActualBudgetIngest();
	} catch (error) {
		await rollbackPositiveOutputs();
		await sealFailure(error, state);
		throw error;
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const mode = parseActualBudgetLauncher(args);
	if (mode === 'launcher-smoke') {
		await assertT582EvidencePreserved();
		await assertFreshRoots();
		process.stdout.write(
			`${canonicalize({ result: 'pass', mode, consentId: REACT_ACTUAL_BUDGET_CONSENT, requestAttempts: 0, positiveRootsAbsent: true })}\n`,
		);
		return;
	}
	if (mode === 'verify') {
		const result = await verifyActualBudgetIngest();
		process.stdout.write(`${canonicalize(result)}\n`);
		return;
	}
	await acquireActualBudget();
	process.stdout.write(
		`${canonicalize({ result: 'pass', consentId: REACT_ACTUAL_BUDGET_CONSENT })}\n`,
	);
}

if (basename(process.argv[1] ?? '') === 'react-actual-budget-v22-12-9-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
