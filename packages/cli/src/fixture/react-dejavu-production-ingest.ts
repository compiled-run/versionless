import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { gunzipSync } from 'node:zlib';
import { dirname, extname, join, relative, resolve } from 'pathe';
import { joinURL, parseURL, withQuery } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const DEJAVU_CONSENT = 'T606-dejavu-mode120000-production-acquisition' as const;
export const DEJAVU_REPOSITORY_URL = 'https://api.github.com/repos/appbaseio/dejavu' as const;
export const DEJAVU_TAGS_URL =
	'https://api.github.com/repos/appbaseio/dejavu/tags?per_page=10&page=1' as const;
export const DEJAVU_ZERO_RESPONSE_ATTEMPTS = 3 as const;

const root = resolve(import.meta.dirname, '../../../..');
const attemptRoot = join(root, 'evidence/attempts/react-dejavu/t606');
const terminalPath = join(attemptRoot, 'terminal.json');

export type DejavuTransportAttempt = {
	attempt: number;
	url: string;
	method: 'GET';
	acceptEncoding: 'identity';
	observedStatus: false;
	observedHeaders: false;
	observedBodyBytes: 0;
	errorCode: string;
};

export type DejavuArtifact = {
	url: string;
	integrity: string;
	placements: string[];
	mirror: string;
};

type NetworkResponse = {
	status: number;
	headers: Record<string, string | string[] | undefined>;
	body: Buffer;
};

export type DejavuArchiveEntry =
	| { path: string; type: 'file'; mode: number; bytes: Buffer }
	| { path: string; type: 'directory'; mode: number; bytes: Buffer }
	| { path: string; type: 'symlink'; mode: number; bytes: Buffer; target: string };

export type DejavuGitSymlink = {
	path: string;
	sha: string;
	size: number;
	target: string;
};

export type DejavuGitRegular = {
	path: string;
	sha: string;
	size: number;
	mode: '100644' | '100755';
};

export type DejavuRequester = (url: string) => Promise<NetworkResponse>;

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

export function assertDejavuConsent(args: string[]): void {
	if (
		args.length !== 2 ||
		args[0] !== '--consent-id' ||
		args[1] !== DEJAVU_CONSENT ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== DEJAVU_CONSENT
	)
		throw new Error('Dejavu acquisition requires exact fresh one-shot consent');
}

export function assertDejavuUrl(url: string, allowed: ReadonlySet<string>): void {
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.auth ||
		parsed.hash ||
		!allowed.has(url) ||
		!['api.github.com', 'codeload.github.com', 'registry.npmjs.org', 'nodejs.org'].includes(
			parsed.host ?? '',
		)
	)
		throw new Error('Dejavu request is outside exact consent');
}

export function assertDejavuArchiveEntries(entries: string[]): string {
	if (entries.length < 25) throw new Error('Dejavu archive is unexpectedly small');
	let prefix: string | undefined;
	const seen = new Set<string>();
	for (const entry of entries) {
		const parts = entry.split('/');
		if (
			!entry ||
			entry.startsWith('/') ||
			entry.includes('\\') ||
			parts.includes('..') ||
			!parts[0] ||
			seen.has(entry)
		)
			throw new Error('Dejavu archive path is unsafe or ambiguous');
		seen.add(entry);
		prefix ??= parts[0];
		if (parts[0] !== prefix) throw new Error('Dejavu archive root differs');
	}
	if (!prefix) throw new Error('Dejavu archive root is absent');
	return prefix;
}

function safeArchivePath(path: string): void {
	const parts = path.split('/');
	if (!path || path.startsWith('/') || path.includes('\\') || parts.includes('..') || !parts[0])
		throw new Error('Dejavu archive path is unsafe or ambiguous');
}

export function validateDejavuArchiveHeaders(entries: DejavuArchiveEntry[]): void {
	if (entries.length < 25) throw new Error('Dejavu archive is unexpectedly small');
	const paths = new Set<string>();
	let prefix: string | undefined;
	for (const entry of entries) {
		safeArchivePath(entry.path);
		if (paths.has(entry.path)) throw new Error('Dejavu archive path is duplicated');
		paths.add(entry.path);
		const first = entry.path.split('/')[0];
		prefix ??= first;
		if (first !== prefix) throw new Error('Dejavu archive root differs');
		if (entry.mode < 0 || entry.mode > 0o777) throw new Error('Dejavu archive mode is unsafe');
		if (entry.type === 'directory' && entry.bytes.length !== 0)
			throw new Error('Dejavu archive directory carries bytes');
		if (entry.type === 'symlink' && (entry.bytes.length !== 0 || !entry.target))
			throw new Error('Dejavu archive symlink header differs');
	}
}

function tarText(block: Buffer, start: number, length: number): string {
	const bytes = block.subarray(start, start + length);
	const end = bytes.indexOf(0);
	return bytes.subarray(0, end === -1 ? bytes.length : end).toString('utf8');
}

function tarNumber(block: Buffer, start: number, length: number): number {
	const text = tarText(block, start, length).trim();
	if (!text) return 0;
	if (!text.split('').every((character) => '01234567'.includes(character)))
		throw new Error('Dejavu tar numeric header differs');
	return Number.parseInt(text, 8);
}

function paxLinkMetadata(bytes: Buffer): { path?: string; linkPath?: string } {
	const text = bytes.toString('utf8');
	let offset = 0;
	let path: string | undefined;
	let linkPath: string | undefined;
	while (offset < text.length) {
		const space = text.indexOf(' ', offset);
		if (space === -1) throw new Error('Dejavu PAX record differs');
		const lengthText = text.slice(offset, space);
		if (!lengthText.split('').every((character) => '0123456789'.includes(character)))
			throw new Error('Dejavu PAX record length differs');
		const length = Number.parseInt(lengthText, 10);
		const record = text.slice(space + 1, offset + length - 1);
		if (record.startsWith('path=')) path = record.slice('path='.length);
		if (record.startsWith('linkpath=')) linkPath = record.slice('linkpath='.length);
		if (length <= 0 || offset + length > text.length)
			throw new Error('Dejavu PAX record boundary differs');
		offset += length;
	}
	return { path, linkPath };
}

export function decodeDejavuTarGz(archive: Buffer): DejavuArchiveEntry[] {
	const tar = gunzipSync(archive, { maxOutputLength: 268_435_456 });
	const result: DejavuArchiveEntry[] = [];
	let offset = 0;
	let extendedPath: string | undefined;
	let extendedLinkPath: string | undefined;
	while (offset + 512 <= tar.length) {
		const header = tar.subarray(offset, offset + 512);
		if (header.every((byte) => byte === 0)) break;
		const storedChecksum = tarNumber(header, 148, 8);
		let checksum = 0;
		for (let index = 0; index < 512; index += 1)
			checksum += index >= 148 && index < 156 ? 32 : (header[index] ?? 0);
		if (checksum !== storedChecksum) throw new Error('Dejavu tar header checksum differs');
		const name = tarText(header, 0, 100);
		const prefix = tarText(header, 345, 155);
		const rawPath = prefix ? `${prefix}/${name}` : name;
		const mode = tarNumber(header, 100, 8) & 0o777;
		const size = tarNumber(header, 124, 12);
		const typeFlag = String.fromCharCode(header[156] ?? 0);
		const rawLinkPath = tarText(header, 157, 100);
		const bodyStart = offset + 512;
		const bodyEnd = bodyStart + size;
		if (bodyEnd > tar.length) throw new Error('Dejavu tar body is truncated');
		const body = tar.subarray(bodyStart, bodyEnd);
		if (typeFlag === 'x' || typeFlag === 'g') {
			const metadata = paxLinkMetadata(body);
			extendedPath = metadata.path ?? extendedPath;
			extendedLinkPath = metadata.linkPath ?? extendedLinkPath;
		} else if (typeFlag === 'L') {
			extendedPath = tarText(body, 0, body.length);
		} else if (typeFlag === 'K') {
			extendedLinkPath = tarText(body, 0, body.length);
		} else {
			const path = extendedPath ?? rawPath;
			const linkPath = extendedLinkPath ?? rawLinkPath;
			extendedPath = undefined;
			extendedLinkPath = undefined;
			safeArchivePath(path);
			if (typeFlag === '5')
				result.push({ path, type: 'directory', mode, bytes: Buffer.alloc(0) });
			else if (typeFlag === '0' || typeFlag === String.fromCharCode(0))
				result.push({ path, type: 'file', mode, bytes: Buffer.from(body) });
			else if (typeFlag === '2')
				result.push({
					path,
					type: 'symlink',
					mode,
					bytes: Buffer.alloc(0),
					target: linkPath,
				});
			else throw new Error('Dejavu archive contains a link or special entry');
		}
		offset = bodyStart + Math.ceil(size / 512) * 512;
	}
	validateDejavuArchiveHeaders(result);
	return result;
}

function gitBlobSha(bytes: Buffer): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

export function verifyDejavuSymlinkGitBlob(input: {
	api: unknown;
	path: string;
	expectedSha: string;
	expectedSize: number;
}): DejavuGitSymlink {
	if (!input.api || typeof input.api !== 'object' || Array.isArray(input.api))
		throw new Error('Dejavu symlink Git blob response differs');
	const value = input.api as {
		sha?: unknown;
		size?: unknown;
		encoding?: unknown;
		content?: unknown;
	};
	if (
		value.sha !== input.expectedSha ||
		value.size !== input.expectedSize ||
		value.encoding !== 'base64' ||
		typeof value.content !== 'string'
	)
		throw new Error('Dejavu symlink Git blob identity differs');
	const bytes = Buffer.from(value.content, 'base64');
	if (
		bytes.length !== input.expectedSize ||
		gitBlobSha(bytes) !== input.expectedSha ||
		!Buffer.from(bytes.toString('utf8')).equals(bytes)
	)
		throw new Error('Dejavu reconstructed symlink Git blob identity differs');
	const target = bytes.toString('utf8');
	if (!target || target.includes('\\') || target.includes(String.fromCharCode(0)))
		throw new Error('Dejavu symlink target bytes are unsafe');
	return {
		path: input.path,
		sha: input.expectedSha,
		size: input.expectedSize,
		target,
	};
}

function resolvedSymlinkTarget(path: string, target: string): string {
	if (
		!target ||
		target.startsWith('/') ||
		target.includes('\\') ||
		target.includes(String.fromCharCode(0))
	)
		throw new Error('Dejavu symlink target is empty, absolute, or unsafe');
	const resolved = relative('/', resolve('/', dirname(path), target));
	if (!resolved || resolved === '..' || resolved.startsWith('../') || resolved.startsWith('/'))
		throw new Error('Dejavu symlink target escapes the source root');
	return resolved;
}

export function verifyDejavuGitArchiveParity(input: {
	entries: DejavuArchiveEntry[];
	prefix: string;
	regular: DejavuGitRegular[];
	symlinks: DejavuGitSymlink[];
}): { regularFiles: number; symlinks: number; digest: string } {
	const archiveFiles = new Map(
		input.entries
			.filter(
				(entry): entry is Extract<DejavuArchiveEntry, { type: 'file' }> =>
					entry.type === 'file',
			)
			.map((entry) => [entry.path.slice(input.prefix.length + 1), entry]),
	);
	const archiveLinks = new Map(
		input.entries
			.filter(
				(entry): entry is Extract<DejavuArchiveEntry, { type: 'symlink' }> =>
					entry.type === 'symlink',
			)
			.map((entry) => [entry.path.slice(input.prefix.length + 1), entry]),
	);
	if (archiveFiles.size !== input.regular.length || archiveLinks.size !== input.symlinks.length)
		throw new Error('Dejavu archive/tree entry cardinality differs');
	const regularPaths = new Set(input.regular.map((entry) => entry.path));
	const symlinkPaths = new Set(input.symlinks.map((entry) => entry.path));
	for (const regular of input.regular) {
		const archive = archiveFiles.get(regular.path);
		if (
			!archive ||
			archive.bytes.length !== regular.size ||
			gitBlobSha(archive.bytes) !== regular.sha ||
			Boolean(archive.mode & 0o111) !== (regular.mode === '100755')
		)
			throw new Error(`Dejavu regular archive/Git parity differs: ${regular.path}`);
	}
	for (const link of input.symlinks) {
		safeArchivePath(link.path);
		const targetBytes = Buffer.from(link.target);
		if (targetBytes.length !== link.size || gitBlobSha(targetBytes) !== link.sha)
			throw new Error(`Dejavu symlink target is not bound to its Git blob: ${link.path}`);
		const archive = archiveLinks.get(link.path);
		if (!archive || archive.target !== link.target)
			throw new Error(`Dejavu symlink archive/Git target differs: ${link.path}`);
		const target = resolvedSymlinkTarget(link.path, link.target);
		if (!regularPaths.has(target) || symlinkPaths.has(target))
			throw new Error(
				`Dejavu symlink target is dangling, indirect, or non-regular: ${link.path}`,
			);
		const pathParts = link.path.split('/');
		const targetParts = target.split('/');
		for (let length = 1; length < pathParts.length; length += 1)
			if (symlinkPaths.has(pathParts.slice(0, length).join('/')))
				throw new Error(`Dejavu symlink has a symlink ancestor: ${link.path}`);
		for (let length = 1; length < targetParts.length; length += 1)
			if (symlinkPaths.has(targetParts.slice(0, length).join('/')))
				throw new Error(`Dejavu symlink target has a symlink ancestor: ${link.path}`);
	}
	const proof = {
		regular: input.regular.map(({ path, sha, size, mode }) => ({ path, sha, size, mode })),
		symlinks: input.symlinks,
	};
	return {
		regularFiles: input.regular.length,
		symlinks: input.symlinks.length,
		digest: sha256(canonicalize(proof)),
	};
}

export async function materializeDejavuArchive(
	entries: DejavuArchiveEntry[],
	prefix: string,
	destination: string,
): Promise<void> {
	for (const entry of entries.filter((candidate) => candidate.type !== 'symlink')) {
		const relative = entry.path.slice(prefix.length + 1);
		if (!relative) continue;
		const target = join(destination, relative);
		if (entry.type === 'directory') await mkdir(target, { recursive: true });
		else if (entry.type === 'file') {
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, entry.bytes, {
				flag: 'wx',
				mode: entry.mode & 0o111 ? 0o755 : 0o644,
			});
		}
	}
	for (const entry of entries.filter(
		(candidate): candidate is Extract<DejavuArchiveEntry, { type: 'symlink' }> =>
			candidate.type === 'symlink',
	)) {
		const relativePath = entry.path.slice(prefix.length + 1);
		const target = join(destination, relativePath);
		const resolvedTarget = resolvedSymlinkTarget(relativePath, entry.target);
		const targetStat = await lstat(join(destination, resolvedTarget));
		if (!targetStat.isFile() || targetStat.isSymbolicLink())
			throw new Error(
				`Dejavu materialized symlink target is not a direct regular file: ${relativePath}`,
			);
		await mkdir(dirname(target), { recursive: true });
		const parts = relativePath.split('/');
		for (let length = 1; length < parts.length; length += 1) {
			const ancestor = join(destination, parts.slice(0, length).join('/'));
			const ancestorStat = await lstat(ancestor);
			if (ancestorStat.isSymbolicLink())
				throw new Error(
					`Dejavu materialized symlink has a symlink ancestor: ${relativePath}`,
				);
		}
		await symlink(entry.target, target);
		const stat = await lstat(target);
		if (!stat.isSymbolicLink() || (await readlink(target)) !== entry.target)
			throw new Error(`Dejavu materialized symlink replay differs: ${relativePath}`);
	}
}

export function verifyDejavuArchiveParity(input: {
	first: Buffer;
	second: Buffer;
	entries: string[];
	expectedTreeFiles: ReadonlySet<string>;
}): { archiveSha256: string; files: number } {
	if (!input.first.equals(input.second)) throw new Error('Dejavu archive replay differs');
	const prefix = assertDejavuArchiveEntries(input.entries);
	const files = input.entries
		.filter((entry) => !entry.endsWith('/'))
		.map((entry) => entry.slice(prefix.length + 1))
		.sort(compareText);
	const expected = [...input.expectedTreeFiles].sort(compareText);
	if (canonicalize(files) !== canonicalize(expected))
		throw new Error('Dejavu archive/tree parity differs');
	return { archiveSha256: sha256(input.first), files: files.length };
}

export function analyzeDejavuNpmLock(value: unknown): {
	placements: number;
	artifacts: DejavuArtifact[];
	digest: string;
} {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Dejavu lock must be an object');
	const lock = value as { lockfileVersion?: unknown; packages?: unknown };
	if (lock.lockfileVersion === 1 && !lock.packages)
		return analyzeDejavuNpmV1Lock(value as { dependencies?: unknown });
	if (
		(lock.lockfileVersion !== 2 && lock.lockfileVersion !== 3) ||
		!lock.packages ||
		typeof lock.packages !== 'object' ||
		Array.isArray(lock.packages)
	)
		throw new Error('Dejavu requires a committed complete npm lock');
	const artifacts = new Map<string, DejavuArtifact>();
	let placements = 0;
	for (const [placement, raw] of Object.entries(lock.packages as Record<string, unknown>)) {
		if (!placement || placement === '') continue;
		if (!raw || typeof raw !== 'object' || Array.isArray(raw))
			throw new Error(`Dejavu lock placement differs: ${placement}`);
		const row = raw as { resolved?: unknown; integrity?: unknown; link?: unknown };
		if (row.link === true) continue;
		placements += 1;
		if (
			typeof row.resolved !== 'string' ||
			typeof row.integrity !== 'string' ||
			(!row.integrity.startsWith('sha512-') && !row.integrity.startsWith('sha1-'))
		)
			throw new Error(`Dejavu lock identity differs: ${placement}`);
		const normalized = normalizeRegistryUrl(row.resolved);
		const prior = artifacts.get(normalized);
		if (prior && prior.integrity !== row.integrity)
			throw new Error('Dejavu lock same-URL integrity conflict');
		if (prior) prior.placements.push(placement);
		else
			artifacts.set(normalized, {
				url: normalized,
				integrity: row.integrity,
				placements: [placement],
				mirror: `${sha256(`${normalized}\0${row.integrity}`)}.tgz`,
			});
	}
	const rows = [...artifacts.values()].sort((left, right) => compareText(left.url, right.url));
	if (rows.length < 20) throw new Error('Dejavu lock closure is unexpectedly small');
	return { placements, artifacts: rows, digest: sha256(canonicalize(rows)) };
}

function analyzeDejavuNpmV1Lock(value: { dependencies?: unknown }): {
	placements: number;
	artifacts: DejavuArtifact[];
	digest: string;
} {
	if (
		!value.dependencies ||
		typeof value.dependencies !== 'object' ||
		Array.isArray(value.dependencies)
	)
		throw new Error('Dejavu npm-v1 lock dependencies differ');
	const artifacts = new Map<string, DejavuArtifact>();
	let placements = 0;
	const visit = (dependencies: Record<string, unknown>, ancestry: string): void => {
		for (const [name, raw] of Object.entries(dependencies)) {
			if (!raw || typeof raw !== 'object' || Array.isArray(raw))
				throw new Error(`Dejavu npm-v1 row differs: ${name}`);
			const row = raw as {
				resolved?: unknown;
				integrity?: unknown;
				dependencies?: unknown;
			};
			const placement = ancestry ? `${ancestry}>${name}` : name;
			placements += 1;
			if (
				typeof row.resolved !== 'string' ||
				typeof row.integrity !== 'string' ||
				(!row.integrity.startsWith('sha512-') && !row.integrity.startsWith('sha1-'))
			)
				throw new Error(`Dejavu npm-v1 identity differs: ${placement}`);
			addArtifact(artifacts, row.resolved, row.integrity, placement);
			if (row.dependencies !== undefined) {
				if (typeof row.dependencies !== 'object' || Array.isArray(row.dependencies))
					throw new Error(`Dejavu npm-v1 descendants differ: ${placement}`);
				visit(row.dependencies as Record<string, unknown>, placement);
			}
		}
	};
	visit(value.dependencies as Record<string, unknown>, '');
	return finishArtifacts(artifacts, placements);
}

export function analyzeDejavuYarnV1Lock(text: string): {
	placements: number;
	artifacts: DejavuArtifact[];
	digest: string;
} {
	if (!text.includes('yarn lockfile v1')) throw new Error('Dejavu Yarn lock version differs');
	const artifacts = new Map<string, DejavuArtifact>();
	let selectors: string[] = [];
	let resolved: string | undefined;
	let integrity: string | undefined;
	let placements = 0;
	const flush = (): void => {
		if (selectors.length === 0) return;
		if (!resolved || !integrity) throw new Error('Dejavu Yarn lock identity differs');
		for (const selector of selectors) {
			placements += 1;
			addArtifact(artifacts, resolved, integrity, selector);
		}
		selectors = [];
		resolved = undefined;
		integrity = undefined;
	};
	for (const rawLine of text.split('\n')) {
		const line = rawLine.trimEnd();
		if (line && !line.startsWith(' ') && line.endsWith(':') && !line.startsWith('#')) {
			flush();
			selectors = line
				.slice(0, -1)
				.split(',')
				.map((value) => value.trim().split('"').join(''))
				.filter(Boolean);
		} else if (line.startsWith('  resolved ')) {
			resolved = line.slice('  resolved '.length).trim().split('"').join('');
		} else if (line.startsWith('  integrity ')) {
			integrity = line.slice('  integrity '.length).trim();
		}
	}
	flush();
	return finishArtifacts(artifacts, placements);
}

function addArtifact(
	artifacts: Map<string, DejavuArtifact>,
	resolved: string,
	integrity: string,
	placement: string,
): void {
	const normalized = normalizeRegistryUrl(resolved);
	const prior = artifacts.get(normalized);
	if (prior && prior.integrity !== integrity)
		throw new Error('Dejavu lock same-URL integrity conflict');
	if (prior) prior.placements.push(placement);
	else
		artifacts.set(normalized, {
			url: normalized,
			integrity,
			placements: [placement],
			mirror: `${sha256(`${normalized}\0${integrity}`)}.tgz`,
		});
}

function finishArtifacts(
	artifacts: Map<string, DejavuArtifact>,
	placements: number,
): { placements: number; artifacts: DejavuArtifact[]; digest: string } {
	const rows = [...artifacts.values()].sort((left, right) => compareText(left.url, right.url));
	if (rows.length < 20) throw new Error('Dejavu lock closure is unexpectedly small');
	return { placements, artifacts: rows, digest: sha256(canonicalize(rows)) };
}

function normalizeRegistryUrl(url: string): string {
	const parsed = parseURL(url);
	if (
		(parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
		parsed.host !== 'registry.npmjs.org' ||
		parsed.auth ||
		parsed.search ||
		parsed.hash
	)
		throw new Error('Dejavu lock contains a foreign or moving dependency');
	return parsed.protocol === 'http:'
		? joinURL('https://registry.npmjs.org', parsed.pathname ?? '')
		: url;
}

export function verifyDejavuSourceAndLicense(input: {
	repository: unknown;
	commit: unknown;
	license: Buffer;
	packageJson: unknown;
	lock: unknown;
}): { repositoryId: number; commit: string; licenseSha256: string; lockDigest: string } {
	if (
		!input.repository ||
		typeof input.repository !== 'object' ||
		Array.isArray(input.repository)
	)
		throw new Error('Dejavu repository response differs');
	const repository = input.repository as {
		id?: unknown;
		full_name?: unknown;
		archived?: unknown;
		license?: { spdx_id?: unknown };
	};
	if (
		typeof repository.id !== 'number' ||
		repository.full_name !== 'appbaseio/dejavu' ||
		typeof repository.archived !== 'boolean' ||
		repository.license?.spdx_id !== 'MIT'
	)
		throw new Error('Dejavu repository identity or license differs');
	if (!input.commit || typeof input.commit !== 'object' || Array.isArray(input.commit))
		throw new Error('Dejavu commit response differs');
	const commit = input.commit as { sha?: unknown; commit?: { committer?: { date?: unknown } } };
	const revision = typeof commit.sha === 'string' ? commit.sha : '';
	const date = commit.commit?.committer?.date;
	if (
		revision.length !== 40 ||
		!revision.split('').every((character) => '0123456789abcdef'.includes(character)) ||
		typeof date !== 'string' ||
		date < '2019-01-01T00:00:00Z' ||
		date >= '2022-01-01T00:00:00Z'
	)
		throw new Error('Dejavu immutable revision/date differs');
	const licenseText = input.license.toString('utf8').toLowerCase();
	if (
		!licenseText.includes('mit license') ||
		!licenseText.includes('permission is hereby granted')
	)
		throw new Error('Dejavu retained license is not proven permissive');
	if (
		!input.packageJson ||
		typeof input.packageJson !== 'object' ||
		Array.isArray(input.packageJson)
	)
		throw new Error('Dejavu package manifest differs');
	const manifest = input.packageJson as { scripts?: unknown; dependencies?: unknown };
	if (!manifest.scripts || !manifest.dependencies)
		throw new Error('Dejavu product manifest is incomplete');
	return {
		repositoryId: repository.id,
		commit: revision,
		licenseSha256: sha256(input.license),
		lockDigest:
			typeof input.lock === 'string'
				? analyzeDejavuYarnV1Lock(input.lock).digest
				: analyzeDejavuNpmLock(input.lock).digest,
	};
}

export function bindDejavuRetainedAssets(
	entries: DejavuArchiveEntry[],
	prefix: string,
	rootLicense: Buffer,
): Array<{ path: string; sha256: string; licenseSha256: string; classification: string }> {
	const assetExtensions = new Set([
		'.png',
		'.jpg',
		'.jpeg',
		'.gif',
		'.svg',
		'.ico',
		'.woff',
		'.woff2',
		'.ttf',
		'.eot',
		'.map',
	]);
	const licenseSha256 = sha256(rootLicense);
	const nestedLicenses = entries.filter((entry) => {
		const name = entry.path.split('/').at(-1)?.toLowerCase() ?? '';
		return (
			entry.type === 'file' &&
			['license', 'copying', 'notice'].some((word) => name.startsWith(word))
		);
	});
	for (const license of nestedLicenses) {
		const text = license.bytes.toString('utf8').toLowerCase();
		if (
			!['mit license', 'apache license', 'bsd license', 'isc license'].some((marker) =>
				text.includes(marker),
			)
		)
			throw new Error(`Dejavu nested license is not proven permissive: ${license.path}`);
	}
	const assets: Array<{
		path: string;
		sha256: string;
		licenseSha256: string;
		classification: string;
	}> = [];
	for (const entry of entries) {
		if (entry.type !== 'file') continue;
		const relative = entry.path.slice(prefix.length + 1);
		const segments = relative.toLowerCase().split('/');
		const extension = extname(relative).toLowerCase();
		const isGenerated =
			segments.some((segment) =>
				['vendor', 'generated', 'dist', 'build'].includes(segment),
			) ||
			relative.toLowerCase().endsWith('.min.js') ||
			extension === '.map';
		if (isGenerated)
			throw new Error(
				`Dejavu retained generated/vendor asset is not independently licensed: ${relative}`,
			);
		if (assetExtensions.has(extension))
			assets.push({
				path: relative,
				sha256: sha256(entry.bytes),
				licenseSha256,
				classification: segments.includes('node_modules')
					? 'dependency-rejected'
					: 'repository-source-asset-bound-to-permissive-license-set',
			});
	}
	if (assets.some((asset) => asset.classification === 'dependency-rejected'))
		throw new Error('Dejavu source archive unexpectedly retains dependency assets');
	return assets.sort((left, right) => compareText(left.path, right.path));
}

export function verifyDejavuProductSource(input: {
	packageJson: unknown;
	entries: DejavuArchiveEntry[];
	prefix: string;
}): { react: string; bundler: 'webpack'; sourceDigest: string; seams: string[] } {
	if (
		!input.packageJson ||
		typeof input.packageJson !== 'object' ||
		Array.isArray(input.packageJson)
	)
		throw new Error('Dejavu product manifest differs');
	const manifest = input.packageJson as {
		dependencies?: Record<string, unknown>;
		devDependencies?: Record<string, unknown>;
		scripts?: Record<string, unknown>;
	};
	const react = manifest.dependencies?.react;
	const webpack = manifest.devDependencies?.webpack ?? manifest.dependencies?.webpack;
	const scripts = canonicalize(manifest.scripts ?? {});
	if (
		typeof react !== 'string' ||
		typeof webpack !== 'string' ||
		!scripts.toLowerCase().includes('webpack')
	)
		throw new Error('Dejavu authentic React/Webpack product boundary is absent');
	const sourceFiles = input.entries.filter((entry) => {
		if (entry.type !== 'file') return false;
		const extension = extname(entry.path).toLowerCase();
		return ['.ts', '.tsx', '.js', '.jsx', '.json'].includes(extension);
	});
	const text = sourceFiles.map((entry) => entry.bytes.toString('utf8').toLowerCase()).join('\n');
	const seams = [
		'_search',
		'_mapping',
		'_cat/indices',
		'connect',
		'document',
		'filter',
		'sort',
		'create',
		'edit',
		'delete',
	];
	const missing = seams.filter((seam) => !text.includes(seam));
	if (missing.length > 0)
		throw new Error(
			`Dejavu authentic product/request/journey seams are absent: ${missing.join(',')}`,
		);
	return {
		react,
		bundler: 'webpack',
		sourceDigest: sha256(
			canonicalize(
				sourceFiles.map((entry) => ({
					path: entry.path.slice(input.prefix.length + 1),
					sha256: sha256(entry.bytes),
				})),
			),
		),
		seams,
	};
}

function firstMajorAfter(value: string, marker: string): number | undefined {
	const start = value.indexOf(marker);
	if (start === -1) return undefined;
	let digits = '';
	for (const character of value.slice(start + marker.length).trimStart()) {
		if ('0123456789'.includes(character)) digits += character;
		else if (digits) break;
	}
	return digits ? Number.parseInt(digits, 10) : undefined;
}

export function deriveDejavuNativeArm64Lane(runtimeHints: string[]): {
	version: string;
	basis: string[];
} {
	if (runtimeHints.length === 0 || runtimeHints.some((hint) => !hint.trim()))
		throw new Error('Dejavu runtime support hints are absent or ambiguous');
	let minimum = 0;
	let exclusiveMaximum = Number.POSITIVE_INFINITY;
	for (const hint of runtimeHints) {
		minimum = Math.max(minimum, firstMajorAfter(hint, '>=') ?? firstMajorAfter(hint, '^') ?? 0);
		exclusiveMaximum = Math.min(
			exclusiveMaximum,
			firstMajorAfter(hint, '<') ?? Number.POSITIVE_INFINITY,
		);
	}
	for (const major of [16, 18, 20, 22, 24])
		if (major >= minimum && major < exclusiveMaximum)
			return { version: major === 16 ? '16.20.2' : `${major}.0.0`, basis: [...runtimeHints] };
	throw new Error('Dejavu has no source-supported official native arm64 Node compatibility lane');
}

function unquoteLockKey(value: string): string {
	const first = value[0];
	const last = value.at(-1);
	return (first === "'" || first === '"') && last === first ? value.slice(1, -1) : value;
}

export function analyzeDejavuTargetPnpmClosure(lockText: string): DejavuArtifact[] {
	const lines = lockText.replaceAll('\r\n', '\n').split('\n');
	const section = lines.indexOf('packages:');
	if (section === -1 || lines.indexOf('packages:', section + 1) !== -1)
		throw new Error('Dejavu target pnpm lock packages section differs');
	const artifacts: DejavuArtifact[] = [];
	for (let index = section + 1; index < lines.length; index += 1) {
		const line = lines[index] ?? '';
		if (line && !line.startsWith(' ')) break;
		if (!line.startsWith('  ') || line.startsWith('   ') || !line.endsWith(':')) continue;
		const key = unquoteLockKey(line.slice(2, -1));
		const slash = key.startsWith('@') ? key.indexOf('/') : -1;
		const separator = key.startsWith('@') ? key.indexOf('@', slash + 1) : key.indexOf('@');
		if (separator <= 0) throw new Error(`Dejavu target package coordinate differs: ${key}`);
		const name = key.slice(0, separator);
		const version = key.slice(separator + 1).split('(')[0] ?? '';
		if (
			!version ||
			!version
				.split('')
				.every((character) =>
					'0123456789.-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.includes(
						character,
					),
				)
		)
			throw new Error(`Dejavu target package version differs: ${key}`);
		let integrity: string | undefined;
		for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
			const detail = lines[cursor] ?? '';
			if (detail.startsWith('  ') && !detail.startsWith('   ')) break;
			const marker = 'integrity: ';
			const start = detail.indexOf(marker);
			if (start !== -1) {
				const tail = detail.slice(start + marker.length);
				integrity = tail.split('}')[0]?.trim().split(',')[0]?.trim();
				break;
			}
		}
		if (!integrity || (!integrity.startsWith('sha512-') && !integrity.startsWith('sha1-')))
			throw new Error(`Dejavu target package integrity differs: ${key}`);
		const basename = name.split('/').at(-1) ?? name;
		const url = joinURL('https://registry.npmjs.org', name, '-', `${basename}-${version}.tgz`);
		artifacts.push({
			url,
			integrity,
			placements: [`target:${name}@${version}`],
			mirror: `${sha256(`${url}\0${integrity}`)}.tgz`,
		});
	}
	for (const required of ['vite@8.0.16', '@types/node@24.12.2'])
		if (!artifacts.some((artifact) => artifact.placements.includes(`target:${required}`)))
			throw new Error(`Dejavu target closure omits ${required}`);
	return artifacts.sort((left, right) => compareText(left.url, right.url));
}

function verifyExactPackageManifest(value: unknown, name: string, version: string): DejavuArtifact {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Dejavu target ${name} manifest differs`);
	const manifest = value as {
		name?: unknown;
		version?: unknown;
		dist?: { tarball?: unknown; integrity?: unknown };
	};
	if (
		manifest.name !== name ||
		manifest.version !== version ||
		typeof manifest.dist?.tarball !== 'string' ||
		typeof manifest.dist.integrity !== 'string'
	)
		throw new Error(`Dejavu target ${name} immutable distribution differs`);
	const url = normalizeRegistryUrl(manifest.dist.tarball);
	return {
		url,
		integrity: manifest.dist.integrity,
		placements: [`target:${name}@${version}`],
		mirror: `${sha256(`${url}\0${manifest.dist.integrity}`)}.tgz`,
	};
}

export function assertDejavuRollbackPlan(input: {
	created: string[];
	preexisting: ReadonlySet<string>;
}): void {
	const allowedPrefixes = [
		'fixtures/react-dejavu/',
		'evidence/dependencies/react-dejavu/',
		'evidence/runs/react-dejavu-',
		'evidence/runs/witness-react-dejavu/',
		'.versionless/cache/react-dejavu/',
		'.versionless/work/react-dejavu/t606/',
	];
	for (const path of input.created)
		if (
			input.preexisting.has(path) ||
			!allowedPrefixes.some((prefix) => path.startsWith(prefix))
		)
			throw new Error('Dejavu rollback would escape task-owned positive roots');
}

export async function requestDejavuWithZeroResponseRetry(
	url: string,
	requester: DejavuRequester,
): Promise<{ response?: NetworkResponse; attempts: DejavuTransportAttempt[] }> {
	const attempts: DejavuTransportAttempt[] = [];
	for (let attempt = 1; attempt <= DEJAVU_ZERO_RESPONSE_ATTEMPTS; attempt += 1) {
		try {
			const response = await requester(url);
			return { response, attempts };
		} catch (error) {
			const value = error as NodeJS.ErrnoException & { observed?: boolean };
			if (value.observed === true)
				throw new Error('Dejavu response-observed failure is not retryable');
			attempts.push({
				attempt,
				url,
				method: 'GET',
				acceptEncoding: 'identity',
				observedStatus: false,
				observedHeaders: false,
				observedBodyBytes: 0,
				errorCode: value.code ?? value.name ?? 'UNKNOWN',
			});
		}
	}
	return { attempts };
}

export const requestExactDejavu: DejavuRequester = async (url) =>
	await new Promise((resolvePromise, reject) => {
		assertDejavuUrl(url, new Set([url]));
		const call = request(
			url,
			{
				method: 'GET',
				headers: {
					accept: 'application/vnd.github+json',
					'accept-encoding': 'identity',
					'user-agent': 'versionless-t606',
				},
			},
			(response) => {
				const encoding = response.headers['content-encoding'];
				const declaredLength = Number(response.headers['content-length'] ?? 0);
				if (
					response.statusCode !== 200 ||
					response.headers.location !== undefined ||
					(encoding !== undefined && encoding !== 'identity') ||
					(Number.isFinite(declaredLength) && declaredLength > 83_886_080)
				) {
					const error = Object.assign(new Error('Dejavu response policy differs'), {
						observed: true,
					});
					response.destroy(error);
					reject(error);
					return;
				}
				const chunks: Buffer[] = [];
				let bytes = 0;
				response.on('data', (chunk: Buffer) => {
					bytes += chunk.length;
					if (bytes > 83_886_080) {
						const error = Object.assign(
							new Error('Dejavu streaming response cap exceeded'),
							{
								observed: true,
							},
						);
						response.destroy(error);
						reject(error);
						return;
					}
					chunks.push(chunk);
				});
				response.once('error', (error: NodeJS.ErrnoException) => {
					Object.assign(error, { observed: true });
					reject(error);
				});
				response.once('end', () => {
					const headers: Record<string, string | string[] | undefined> = {
						...response.headers,
					};
					resolvePromise({
						status: response.statusCode ?? 0,
						headers,
						body: Buffer.concat(chunks),
					});
				});
			},
		);
		call.setTimeout(10_000, () => {
			const error = Object.assign(new Error('Dejavu request timed out'), {
				code: 'ETIMEDOUT',
			});
			call.destroy(error);
		});
		call.once('error', reject);
		call.end();
	});

function requireIdentityResponse(
	response: NetworkResponse,
	label: string,
	maxBytes: number,
): Buffer {
	const encoding = response.headers['content-encoding'];
	if (
		response.status !== 200 ||
		response.headers.location !== undefined ||
		(encoding !== undefined && encoding !== 'identity') ||
		response.body.length > maxBytes
	)
		throw new Error(`Dejavu ${label} response differs`);
	return response.body;
}

function parseJson(bytes: Buffer, label: string): unknown {
	try {
		return JSON.parse(bytes.toString('utf8'));
	} catch {
		throw new Error(`Dejavu ${label} JSON differs`);
	}
}

function isStableTag(name: string): boolean {
	const lower = name.toLowerCase();
	return (
		name.split('').some((character) => '0123456789'.includes(character)) &&
		!['alpha', 'beta', 'rc', 'next', 'canary', 'nightly', 'dev', 'snapshot'].some((marker) =>
			lower.includes(marker),
		)
	);
}

type TagCandidate = { name: string; sha: string; date: string; tree: string };

function selectBoundedTagSeeds(tags: Array<{ name: string; sha: string }>): Array<{
	name: string;
	sha: string;
}> {
	const stable = tags.filter((tag) => isStableTag(tag.name));
	if (stable.length <= 6) return stable;
	const selected: Array<{ name: string; sha: string }> = [];
	for (let slot = 0; slot < 6; slot += 1) {
		const index = Math.floor((slot * (stable.length - 1)) / 5);
		const candidate = stable[index];
		if (candidate && !selected.some((prior) => prior.sha === candidate.sha))
			selected.push(candidate);
	}
	return selected;
}

function verifyIntegrity(bytes: Buffer, integrity: string): void {
	const choices = integrity.split(' ').filter(Boolean);
	const selected =
		choices.find((choice) => choice.startsWith('sha512-')) ??
		choices.find((choice) => choice.startsWith('sha1-'));
	if (!selected) throw new Error('Dejavu dependency has no supported immutable integrity');
	const separator = selected.indexOf('-');
	const algorithm = selected.slice(0, separator);
	const expected = selected.slice(separator + 1);
	if (createHash(algorithm).update(bytes).digest('base64') !== expected)
		throw new Error('Dejavu dependency integrity differs');
}

async function writeCanonical(path: string, value: unknown): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const temporary = `${path}.tmp-t606`;
	await writeFile(temporary, `${canonicalize(value)}\n`, { flag: 'wx' });
	await rename(temporary, path);
}

export async function runDejavuAcquisition(args = process.argv.slice(2)): Promise<void> {
	assertDejavuConsent(args);
	const attempts: DejavuTransportAttempt[] = [];
	const accepted: Array<{ url: string; bytes: number; sha256: string }> = [];
	let acceptedBytes = 0;
	const publishedRoots: string[] = [];
	const transactionRoot = join(root, '.versionless/work/react-dejavu/t606/transaction');
	const fetchExact = async (url: string, label: string, maxBytes: number): Promise<Buffer> => {
		if (accepted.length >= 5_000) throw new Error('Dejavu accepted-response cap exceeded');
		const result = await requestDejavuWithZeroResponseRetry(url, requestExactDejavu);
		attempts.push(...result.attempts);
		if (!result.response)
			throw Object.assign(
				new Error('Dejavu transport exhausted three identical zero-response attempts'),
				{
					zeroResponseExhausted: true,
				},
			);
		const body = requireIdentityResponse(result.response, label, maxBytes);
		acceptedBytes += body.length;
		if (acceptedBytes > 4_294_967_296)
			throw new Error('Dejavu aggregate accepted-byte cap exceeded');
		accepted.push({ url, bytes: body.length, sha256: sha256(body) });
		return body;
	};
	try {
		const frozenTargetClosure = analyzeDejavuTargetPnpmClosure(
			await readFile(join(root, 'pnpm-lock.yaml'), 'utf8'),
		);
		const repositoryBytes = await fetchExact(DEJAVU_REPOSITORY_URL, 'repository', 10_485_760);
		const repository = parseJson(repositoryBytes, 'repository');
		if (!repository || typeof repository !== 'object' || Array.isArray(repository))
			throw new Error('Dejavu repository response differs');
		const repositoryRecord = repository as {
			id?: unknown;
			full_name?: unknown;
			archived?: unknown;
			license?: { spdx_id?: unknown };
		};
		if (
			typeof repositoryRecord.id !== 'number' ||
			repositoryRecord.full_name !== 'appbaseio/dejavu'
		)
			throw new Error('Dejavu repository identity differs');

		const tags: Array<{ name: string; sha: string }> = [];
		for (let page = 1; page <= 12; page += 1) {
			const url = withQuery('https://api.github.com/repos/appbaseio/dejavu/tags', {
				per_page: 10,
				page,
			});
			const value = parseJson(await fetchExact(url, `tags page ${page}`, 10_485_760), 'tags');
			if (!Array.isArray(value)) throw new Error('Dejavu tags response differs');
			for (const raw of value) {
				if (!raw || typeof raw !== 'object' || Array.isArray(raw))
					throw new Error('Dejavu tag row differs');
				const row = raw as { name?: unknown; commit?: { sha?: unknown } };
				if (typeof row.name !== 'string' || typeof row.commit?.sha !== 'string')
					throw new Error('Dejavu tag identity differs');
				tags.push({ name: row.name, sha: row.commit.sha });
			}
			if (value.length < 10) break;
		}
		const candidates: TagCandidate[] = [];
		for (const seed of selectBoundedTagSeeds(tags)) {
			const url = joinURL('https://api.github.com/repos/appbaseio/dejavu/commits', seed.sha);
			const value = parseJson(
				await fetchExact(url, `commit ${seed.name}`, 10_485_760),
				'commit',
			);
			if (!value || typeof value !== 'object' || Array.isArray(value))
				throw new Error('Dejavu commit response differs');
			const row = value as {
				sha?: unknown;
				commit?: { committer?: { date?: unknown }; tree?: { sha?: unknown } };
			};
			if (
				typeof row.sha !== 'string' ||
				row.sha.length !== 40 ||
				typeof row.commit?.committer?.date !== 'string' ||
				typeof row.commit.tree?.sha !== 'string'
			)
				throw new Error('Dejavu commit identity differs');
			candidates.push({
				name: seed.name,
				sha: row.sha,
				date: row.commit.committer.date,
				tree: row.commit.tree.sha,
			});
		}
		const eligible = candidates
			.filter(
				(candidate) =>
					candidate.date >= '2019-01-01T00:00:00Z' &&
					candidate.date < '2022-01-01T00:00:00Z',
			)
			.sort((left, right) => compareText(left.date, right.date));
		const selected = eligible[0];
		if (!selected)
			throw new Error(
				'No stable 2019-2021 Dejavu revision exists in the bounded inspected set',
			);

		const archiveUrl = joinURL(
			'https://codeload.github.com/appbaseio/dejavu/tar.gz',
			selected.sha,
		);
		const firstArchive = await fetchExact(archiveUrl, 'source archive replay 1', 47_185_920);
		const secondArchive = await fetchExact(archiveUrl, 'source archive replay 2', 47_185_920);
		const treeUrl = withQuery(
			joinURL('https://api.github.com/repos/appbaseio/dejavu/git/trees', selected.tree),
			{ recursive: 1 },
		);
		const treeValue = parseJson(
			await fetchExact(treeUrl, 'recursive tree', 10_485_760),
			'tree',
		);
		if (!treeValue || typeof treeValue !== 'object' || Array.isArray(treeValue))
			throw new Error('Dejavu recursive tree differs');
		const treeRecord = treeValue as { truncated?: unknown; tree?: unknown };
		if (treeRecord.truncated !== false || !Array.isArray(treeRecord.tree))
			throw new Error('Dejavu recursive tree is truncated or absent');
		const treeFiles = new Set<string>();
		const regularTreeFiles: DejavuGitRegular[] = [];
		const symlinkSeeds: Array<{ path: string; sha: string; size: number }> = [];
		for (const raw of treeRecord.tree) {
			if (!raw || typeof raw !== 'object' || Array.isArray(raw))
				throw new Error('Dejavu tree row differs');
			const row = raw as {
				path?: unknown;
				type?: unknown;
				mode?: unknown;
				sha?: unknown;
				size?: unknown;
			};
			if (
				row.type === 'blob' &&
				typeof row.path === 'string' &&
				(row.mode === '100644' || row.mode === '100755') &&
				typeof row.sha === 'string' &&
				typeof row.size === 'number'
			) {
				treeFiles.add(row.path);
				regularTreeFiles.push({
					path: row.path,
					sha: row.sha,
					size: row.size,
					mode: row.mode,
				});
			} else if (
				row.type === 'blob' &&
				row.mode === '120000' &&
				typeof row.path === 'string' &&
				typeof row.sha === 'string' &&
				typeof row.size === 'number'
			) {
				treeFiles.add(row.path);
				symlinkSeeds.push({ path: row.path, sha: row.sha, size: row.size });
			} else if (row.type !== 'tree' || row.mode !== '040000')
				throw new Error('Dejavu tree contains a gitlink or special entry');
		}
		const gitSymlinks: DejavuGitSymlink[] = [];
		for (const seed of symlinkSeeds) {
			const blobUrl = joinURL(
				'https://api.github.com/repos/appbaseio/dejavu/git/blobs',
				seed.sha,
			);
			gitSymlinks.push(
				verifyDejavuSymlinkGitBlob({
					api: parseJson(
						await fetchExact(blobUrl, `symlink Git blob ${seed.path}`, 10_485_760),
						'symlink Git blob',
					),
					path: seed.path,
					expectedSha: seed.sha,
					expectedSize: seed.size,
				}),
			);
		}

		const archivePath = join(transactionRoot, 'source.tar.gz');
		await mkdir(transactionRoot, { recursive: true });
		await writeFile(archivePath, firstArchive, { flag: 'wx' });
		const decodedEntries = decodeDejavuTarGz(firstArchive);
		const entries = decodedEntries.map((entry) => entry.path);
		const parity = verifyDejavuArchiveParity({
			first: firstArchive,
			second: secondArchive,
			entries,
			expectedTreeFiles: treeFiles,
		});
		const prefix = assertDejavuArchiveEntries(entries);
		const gitArchiveParity = verifyDejavuGitArchiveParity({
			entries: decodedEntries,
			prefix,
			regular: regularTreeFiles,
			symlinks: gitSymlinks,
		});
		const fileEntry = (names: string[]): string | undefined =>
			names.map((name) => `${prefix}/${name}`).find((name) => entries.includes(name));
		const packageEntry = fileEntry(['package.json']);
		const lockEntry = fileEntry(['package-lock.json', 'yarn.lock']);
		const licenseEntry = fileEntry(['LICENSE', 'LICENSE.md', 'license', 'license.md']);
		if (!packageEntry || !lockEntry || !licenseEntry)
			throw new Error('Dejavu selected source lacks manifest, committed lock, or license');
		const bytesFor = (path: string): Buffer => {
			const entry = decodedEntries.find(
				(candidate) => candidate.path === path && candidate.type === 'file',
			);
			if (!entry) throw new Error(`Dejavu archive file is absent: ${path}`);
			return entry.bytes;
		};
		const packageBytes = bytesFor(packageEntry);
		const lockBytes = bytesFor(lockEntry);
		const licenseBytes = bytesFor(licenseEntry);
		const packageJson = parseJson(packageBytes, 'package manifest');
		const product = verifyDejavuProductSource({
			packageJson,
			entries: decodedEntries,
			prefix,
		});
		const assets = bindDejavuRetainedAssets(decodedEntries, prefix, licenseBytes);
		const lockAnalysis = lockEntry.endsWith('yarn.lock')
			? analyzeDejavuYarnV1Lock(lockBytes.toString('utf8'))
			: analyzeDejavuNpmLock(parseJson(lockBytes, 'npm lock'));
		const source = verifyDejavuSourceAndLicense({
			repository,
			commit: {
				sha: selected.sha,
				commit: { committer: { date: selected.date } },
			},
			license: licenseBytes,
			packageJson,
			lock: lockEntry.endsWith('yarn.lock')
				? lockBytes.toString('utf8')
				: parseJson(lockBytes, 'npm lock'),
		});
		const packageRecord = packageJson as { engines?: { node?: unknown } };
		const runtimeHints: string[] = [];
		if (typeof packageRecord.engines?.node === 'string')
			runtimeHints.push(packageRecord.engines.node);
		for (const hintName of ['.nvmrc', '.node-version']) {
			const hintEntry = fileEntry([hintName]);
			if (hintEntry) runtimeHints.push(`>=${bytesFor(hintEntry).toString('utf8').trim()}`);
		}
		for (const entry of decodedEntries) {
			const relative = entry.path.slice(prefix.length + 1).toLowerCase();
			if (
				entry.type === 'file' &&
				(relative === '.travis.yml' ||
					relative === '.circleci/config.yml' ||
					relative.startsWith('.github/workflows/'))
			) {
				const text = entry.bytes.toString('utf8').toLowerCase();
				if (text.includes('node')) {
					const major = firstMajorAfter(text, '');
					if (major !== undefined) runtimeHints.push(`>=${major}`);
				}
			}
		}
		const legacyRuntime = deriveDejavuNativeArm64Lane(runtimeHints);

		const dependencyRoot = join(transactionRoot, 'dependencies');
		await mkdir(dependencyRoot, { recursive: true });
		for (const artifact of lockAnalysis.artifacts) {
			const bytes = await fetchExact(
				artifact.url,
				`dependency ${artifact.mirror}`,
				33_554_432,
			);
			verifyIntegrity(bytes, artifact.integrity);
			await writeFile(join(dependencyRoot, artifact.mirror), bytes, { flag: 'wx' });
		}
		const targetDependencyRoot = join(transactionRoot, 'target-dependencies');
		await mkdir(targetDependencyRoot, { recursive: true });
		const targetArtifacts = [...frozenTargetClosure];
		for (const [name, version] of [
			['react', '18.3.1'],
			['react-dom', '18.3.1'],
			['scheduler', '0.23.2'],
		] as const) {
			const manifestUrl = joinURL('https://registry.npmjs.org', name, version);
			const manifest = parseJson(
				await fetchExact(manifestUrl, `target ${name}@${version} manifest`, 33_554_432),
				`target ${name}@${version}`,
			);
			targetArtifacts.push(verifyExactPackageManifest(manifest, name, version));
		}
		const targetByUrl = new Map<string, DejavuArtifact>();
		for (const artifact of targetArtifacts) {
			const prior = targetByUrl.get(artifact.url);
			if (prior && prior.integrity !== artifact.integrity)
				throw new Error('Dejavu target closure same-URL integrity conflict');
			targetByUrl.set(artifact.url, prior ?? artifact);
		}
		for (const artifact of [...targetByUrl.values()].sort((left, right) =>
			compareText(left.url, right.url),
		)) {
			const bytes = await fetchExact(
				artifact.url,
				`target dependency ${artifact.mirror}`,
				33_554_432,
			);
			verifyIntegrity(bytes, artifact.integrity);
			await writeFile(join(targetDependencyRoot, artifact.mirror), bytes, { flag: 'wx' });
		}

		const runtimes = [
			{
				version: legacyRuntime.version,
				lane: 'oldest-source-supported-native-arm64-compatibility',
				basis: legacyRuntime.basis,
			},
			{ version: '24.15.0', lane: 'target-native-arm64' },
		];
		const runtimeRoot = join(transactionRoot, 'runtimes');
		await mkdir(runtimeRoot, { recursive: true });
		const runtimeEvidence: Array<Record<string, unknown>> = [];
		for (const runtime of runtimes) {
			const base = joinURL('https://nodejs.org/dist', `v${runtime.version}`);
			const sumsUrl = joinURL(base, 'SHASUMS256.txt');
			const filename = `node-v${runtime.version}-darwin-arm64.tar.gz`;
			const archive = await fetchExact(
				joinURL(base, filename),
				`Node ${runtime.version}`,
				83_886_080,
			);
			const sums = (
				await fetchExact(sumsUrl, `Node ${runtime.version} sums`, 1_048_576)
			).toString('utf8');
			const line = sums.split('\n').find((candidate) => candidate.endsWith(`  ${filename}`));
			const expected = line?.slice(0, 64);
			if (!expected || sha256(archive) !== expected)
				throw new Error(`Dejavu Node ${runtime.version} archive identity differs`);
			await writeFile(join(runtimeRoot, filename), archive, { flag: 'wx' });
			runtimeEvidence.push({ ...runtime, filename, sha256: expected });
		}

		const sourceRoot = join(transactionRoot, 'source');
		await mkdir(sourceRoot, { recursive: true });
		await materializeDejavuArchive(decodedEntries, prefix, sourceRoot);
		const manifest = {
			schemaVersion: 1,
			task: 'T606',
			consentId: DEJAVU_CONSENT,
			repositoryId: source.repositoryId,
			repository: 'appbaseio/dejavu',
			tag: selected.name,
			revision: source.commit,
			tree: selected.tree,
			date: selected.date,
			archive: {
				sha256: parity.archiveSha256,
				bytes: firstArchive.length,
				files: parity.files,
				gitObjectParityDigest: gitArchiveParity.digest,
				symlinks: gitArchiveParity.symlinks,
				links: gitSymlinks,
			},
			license: { spdx: 'MIT', sha256: source.licenseSha256 },
			assets,
			product,
			lock: {
				kind: lockEntry.endsWith('yarn.lock') ? 'yarn-v1' : 'npm',
				placements: lockAnalysis.placements,
				artifacts: lockAnalysis.artifacts.length,
				digest: source.lockDigest,
			},
			targetClosure: {
				react: '18.3.1',
				reactDom: '18.3.1',
				vite: '8.0.16',
				node: '24.15.0',
				artifacts: targetByUrl.size,
				digest: sha256(canonicalize([...targetByUrl.values()])),
			},
			runtimes: runtimeEvidence,
		};
		await writeCanonical(join(transactionRoot, 'fixture.json'), manifest);
		await writeCanonical(join(transactionRoot, 'closure.json'), {
			...manifest.lock,
			legacyArtifacts: lockAnalysis.artifacts,
			targetArtifacts: [...targetByUrl.values()].sort((left, right) =>
				compareText(left.url, right.url),
			),
		});
		await writeCanonical(join(transactionRoot, 'acquisition.json'), {
			schemaVersion: 1,
			task: 'T606',
			accepted,
			acceptedBytes,
			zeroResponseAttempts: attempts,
		});

		const fixtureRoot = join(root, 'fixtures/react-dejavu');
		const cacheRoot = join(root, '.versionless/cache/react-dejavu');
		const publishedDependencyRoot = join(root, 'evidence/dependencies/react-dejavu');
		await mkdir(fixtureRoot, { recursive: true });
		await mkdir(dirname(cacheRoot), { recursive: true });
		await mkdir(dirname(publishedDependencyRoot), { recursive: true });
		await rename(sourceRoot, join(fixtureRoot, 'source'));
		publishedRoots.push(join(fixtureRoot, 'source'));
		await rename(join(transactionRoot, 'fixture.json'), join(fixtureRoot, 'fixture.json'));
		publishedRoots.push(join(fixtureRoot, 'fixture.json'));
		await mkdir(cacheRoot, { recursive: true });
		await rename(archivePath, join(cacheRoot, 'source.tar.gz'));
		publishedRoots.push(join(cacheRoot, 'source.tar.gz'));
		await rename(runtimeRoot, join(cacheRoot, 'runtimes'));
		publishedRoots.push(join(cacheRoot, 'runtimes'));
		await rename(dependencyRoot, join(cacheRoot, 'dependencies'));
		publishedRoots.push(join(cacheRoot, 'dependencies'));
		await rename(targetDependencyRoot, join(cacheRoot, 'target-dependencies'));
		publishedRoots.push(join(cacheRoot, 'target-dependencies'));
		await mkdir(publishedDependencyRoot, { recursive: true });
		await rename(
			join(transactionRoot, 'closure.json'),
			join(publishedDependencyRoot, 'closure.json'),
		);
		publishedRoots.push(join(publishedDependencyRoot, 'closure.json'));
		await rename(
			join(transactionRoot, 'acquisition.json'),
			join(attemptRoot, 'acquisition.json'),
		);
	} catch (error) {
		const value = error as Error & { zeroResponseExhausted?: boolean };
		const terminal = {
			schemaVersion: 1,
			task: 'T606',
			candidate: 'appbaseio/dejavu',
			consentId: DEJAVU_CONSENT,
			result: value.zeroResponseExhausted
				? 'zero-response-transport-exhausted'
				: 'observed-transaction-blocked',
			excluded: false,
			qualified: false,
			acceptedResponses: accepted.length,
			acceptedBytes,
			accepted,
			attempts,
			failure: value.message,
			digest: sha256(canonicalize({ accepted, attempts, failure: value.message })),
		};
		for (const path of publishedRoots.reverse())
			await rm(path, { recursive: true, force: true });
		await rm(transactionRoot, { recursive: true, force: true });
		await writeCanonical(terminalPath, terminal);
		throw error;
	}
}

if (import.meta.url === `file://${process.argv[1]}`)
	runDejavuAcquisition().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
