import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import { canonicalize, sha256 } from './canonicalize.ts';

export const DEPENDENCY_CLOSURE_SCHEMA = 'versionless.dependency-closure.v1' as const;
export const FUXA_LOCK_SHA256 = 'b8309c014f39662b170b7d174f24132dfd0d65b43d70eabeca6222a0ef8c23a3';
export const FUXA_REPLAY_SHA256 =
	'e34a049f7536b5028a7913f568a3ac1e0b4eccf8fc727e39b8b98cdd5dce42f9';
export const FUXA_RUNTIME_SHA256 =
	'6a5c4108475871362d742b988566f3fe307f6a67ce14634eb3fbceb4f9eea88c';

export type DependencyIdentity = Readonly<{ name: string; version: string }>;
export type DependencyRequest = Readonly<{
	sequence: number;
	url: string;
	integrity: string;
	identities: readonly DependencyIdentity[];
}>;

export type DependencyArtifact = Readonly<{
	sequence: number;
	url: string;
	integrity: string;
	sha256: string;
	byteLength: number;
	name: string;
	version: string;
	license: string;
	licenseFiles: readonly string[];
}>;

export interface DependencyClosureReceipt {
	schemaVersion: typeof DEPENDENCY_CLOSURE_SCHEMA;
	fixture: 'angular-fuxa';
	repository: 'frangoteam/FUXA';
	commit: '8b323c177615c0d152a54e5ef0a6f98dae7b8ff0';
	lock: {
		path: 'client/package-lock.json';
		sha256: typeof FUXA_LOCK_SHA256;
		lockfileVersion: 1;
		entries: 1468;
		uniqueTarballs: 1222;
		missingResolvedOrIntegrity: 0;
		hosts: readonly ['registry.npmjs.org'];
	};
	runtime: {
		node: '16.20.2';
		npm: '8.19.4';
		archiveSha256: typeof FUXA_RUNTIME_SHA256;
		state: 'eol-compatibility-sandbox-only';
	};
	consent: {
		id: string;
		status: 'closed';
		methods: readonly ['GET'];
		requests: 1222;
		responseBytes: number;
		aggregateBytes: number;
	};
	artifacts: readonly DependencyArtifact[];
	installVerification: {
		runs: 2;
		networkAttempts: 0;
		ignoreScripts: true;
		firstDigest: string;
		secondDigest: string;
		lockUnchanged: true;
		residue: 'none';
	};
	nonclaims: readonly string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
}

type LockEntry = {
	version?: unknown;
	resolved?: unknown;
	integrity?: unknown;
	dependencies?: unknown;
};

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Dependency closure ${label} must be an object`);
	return value as Record<string, unknown>;
}

function exactSha512Integrity(value: string): boolean {
	if (!value.startsWith('sha512-')) return false;
	const encoded = value.slice('sha512-'.length);
	if (!encoded || encoded.includes(' ') || encoded.includes('\t')) return false;
	const decoded = Buffer.from(encoded, 'base64');
	return decoded.byteLength === 64 && decoded.toString('base64') === encoded;
}

export function parseFuxaDependencyPlan(lockBytes: Buffer): readonly DependencyRequest[] {
	if (sha256(lockBytes) !== FUXA_LOCK_SHA256)
		throw new Error('FUXA dependency lock SHA-256 mismatch');
	let root: Record<string, unknown>;
	try {
		root = object(JSON.parse(lockBytes.toString('utf8')), 'package lock');
	} catch {
		throw new Error('FUXA dependency lock is invalid JSON');
	}
	if (root.lockfileVersion !== 1)
		throw new Error('FUXA dependency lockfileVersion must be exactly 1');
	const rows: Array<{ name: string; version: string; url: string; integrity: string }> = [];
	const visit = (dependencies: unknown): void => {
		const map = object(dependencies, 'dependencies');
		for (const [name, raw] of Object.entries(map)) {
			const entry = object(raw, `entry ${name}`) as LockEntry;
			if (
				typeof entry.version !== 'string' ||
				!entry.version ||
				typeof entry.resolved !== 'string' ||
				!entry.resolved ||
				typeof entry.integrity !== 'string' ||
				!exactSha512Integrity(entry.integrity)
			)
				throw new Error(
					`FUXA dependency entry ${name} lacks exact version, URL, or SHA-512 SRI`,
				);
			const parsed = parseURL(entry.resolved);
			if (
				parsed.protocol !== 'https:' ||
				parsed.host !== 'registry.npmjs.org' ||
				parsed.auth ||
				parsed.search ||
				parsed.hash ||
				!parsed.pathname?.endsWith('.tgz')
			)
				throw new Error(`FUXA dependency entry ${name} has an unauthorized registry URL`);
			rows.push({
				name,
				version: entry.version,
				url: entry.resolved,
				integrity: entry.integrity,
			});
			if (entry.dependencies !== undefined) visit(entry.dependencies);
		}
	};
	visit(root.dependencies);
	if (rows.length !== 1468)
		throw new Error(
			`FUXA dependency lock must contain exactly 1468 entries, received ${rows.length}`,
		);
	const grouped = new Map<string, typeof rows>();
	for (const row of rows) {
		const key = `${row.url}\0${row.integrity}`;
		const values = grouped.get(key) ?? [];
		values.push(row);
		grouped.set(key, values);
	}
	if (grouped.size !== 1222)
		throw new Error(
			`FUXA dependency lock must contain exactly 1222 unique URL/SRI pairs, received ${grouped.size}`,
		);
	return [...grouped.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, values], index) => {
			const separator = key.indexOf('\0');
			const identities = [
				...new Map(
					values.map((row) => [
						`${row.name}\0${row.version}`,
						{ name: row.name, version: row.version },
					]),
				).values(),
			].sort(
				(left, right) =>
					left.name.localeCompare(right.name) ||
					left.version.localeCompare(right.version),
			);
			return Object.freeze({
				sequence: index + 1,
				url: key.slice(0, separator),
				integrity: key.slice(separator + 1),
				identities: Object.freeze(identities),
			});
		});
}

export function verifyDependencySri(bytes: Buffer, integrity: string): void {
	if (!exactSha512Integrity(integrity)) throw new Error('Dependency SRI is not exact SHA-512');
	const actual = createHash('sha512').update(bytes).digest('base64');
	if (`sha512-${actual}` !== integrity) throw new Error('Dependency tarball SRI mismatch');
}

function tarString(bytes: Buffer, start: number, length: number): string {
	const end = bytes.indexOf(0, start);
	return bytes
		.subarray(start, end === -1 || end > start + length ? start + length : end)
		.toString('utf8');
}

function tarOctal(bytes: Buffer, start: number, length: number): number {
	const text = tarString(bytes, start, length).trim();
	if (!text || [...text].some((character) => character < '0' || character > '7'))
		throw new Error('Dependency tarball contains an invalid numeric header');
	return Number.parseInt(text, 8);
}

function portableTarPath(value: string): boolean {
	if (value === 'package') return true;
	if (!value.startsWith('package/') || value.includes('\\') || path.isAbsolute(value))
		return false;
	return value.split('/').every((segment) => segment && segment !== '.' && segment !== '..');
}

function paxPath(bytes: Buffer): string {
	let offset = 0;
	let found: string | undefined;
	const decoder = new TextDecoder('utf-8', { fatal: true });
	while (offset < bytes.byteLength) {
		const space = bytes.indexOf(32, offset);
		if (space <= offset) throw new Error('Dependency tarball PAX framing is invalid');
		const digits = bytes.subarray(offset, space).toString('ascii');
		if (![...digits].every((character) => character >= '0' && character <= '9'))
			throw new Error('Dependency tarball PAX length is invalid');
		const length = Number.parseInt(digits, 10);
		const end = offset + length;
		if (!Number.isSafeInteger(length) || end > bytes.byteLength || bytes[end - 1] !== 10)
			throw new Error('Dependency tarball PAX record is incomplete');
		const record = decoder.decode(bytes.subarray(space + 1, end - 1));
		const separator = record.indexOf('=');
		if (separator < 1) throw new Error('Dependency tarball PAX field is invalid');
		const key = record.slice(0, separator);
		const value = record.slice(separator + 1);
		if (key === 'linkpath') throw new Error('Dependency tarball PAX link target is forbidden');
		if (key === 'path') {
			if (found !== undefined) throw new Error('Dependency tarball PAX path is duplicated');
			found = value;
		}
		offset = end;
	}
	if (!found || !portableTarPath(found)) throw new Error('Dependency tarball PAX path is unsafe');
	return found;
}

export function inspectDependencyTarball(
	bytes: Buffer,
	identities: readonly DependencyIdentity[],
): { name: string; version: string; license: string; licenseFiles: readonly string[] } {
	if (!identities.length) throw new Error('Dependency tarball has no lock identity');
	let archive: Buffer;
	try {
		archive = gunzipSync(bytes, { maxOutputLength: 256 * 1_024 * 1_024 });
	} catch {
		throw new Error('Dependency tarball gzip is invalid or exceeds the expansion limit');
	}
	let manifestBytes: Buffer | undefined;
	const licenseFiles: string[] = [];
	let offset = 0;
	let entries = 0;
	let ended = false;
	let pendingPaxPath: string | undefined;
	const paths = new Set<string>();
	while (offset + 512 <= archive.byteLength) {
		const header = archive.subarray(offset, offset + 512);
		if (header.every((byte) => byte === 0)) {
			const second = archive.subarray(offset + 512, offset + 1024);
			if (second.byteLength !== 512 || !second.every((byte) => byte === 0))
				throw new Error('Dependency tarball lacks two complete terminator blocks');
			if (!archive.subarray(offset + 1024).every((byte) => byte === 0))
				throw new Error('Dependency tarball has nonzero trailing data');
			ended = true;
			break;
		}
		entries += 1;
		if (entries > 100_000) throw new Error('Dependency tarball entry limit exceeded');
		const expectedChecksum = tarOctal(header, 148, 8);
		let actualChecksum = 0;
		for (let index = 0; index < header.byteLength; index += 1)
			actualChecksum += index >= 148 && index < 156 ? 32 : header[index]!;
		if (actualChecksum !== expectedChecksum)
			throw new Error('Dependency tarball header checksum differs');
		if (tarString(header, 257, 6) !== 'ustar')
			throw new Error('Dependency tarball format signature is unsupported');
		const name = tarString(header, 0, 100);
		const prefix = tarString(header, 345, 155);
		const filePath = prefix ? `${prefix}/${name}` : name;
		const type = header[156] === 0 ? '0' : String.fromCharCode(header[156]!);
		if (tarString(header, 157, 100))
			throw new Error('Dependency tarball link target is forbidden');
		const size = tarOctal(header, 124, 12);
		const bodyStart = offset + 512;
		const bodyEnd = bodyStart + size;
		if (bodyEnd > archive.byteLength) throw new Error('Dependency tarball entry is truncated');
		if (type === 'x') {
			if (pendingPaxPath || !filePath.startsWith('PaxHeader/package/'))
				throw new Error('Dependency tarball PAX header is misplaced');
			pendingPaxPath = paxPath(archive.subarray(bodyStart, bodyEnd));
			offset = bodyStart + Math.ceil(size / 512) * 512;
			continue;
		}
		if (type !== '0' && type !== '5')
			throw new Error('Dependency tarball links or special entries are forbidden');
		if (!portableTarPath(filePath)) throw new Error('Dependency tarball path is unsafe');
		if (pendingPaxPath && pendingPaxPath !== filePath)
			throw new Error('Dependency tarball PAX path differs from its entry');
		pendingPaxPath = undefined;
		if (paths.has(filePath)) throw new Error('Dependency tarball path is duplicated');
		paths.add(filePath);
		if (type === '5' && size !== 0)
			throw new Error('Dependency tarball directory body is forbidden');
		if (type === '0') {
			const relative = filePath.slice('package/'.length);
			if (relative === 'package.json') manifestBytes = archive.subarray(bodyStart, bodyEnd);
			const base = path.basename(relative).toLowerCase();
			if (
				base.startsWith('license') ||
				base.startsWith('licence') ||
				base.startsWith('copying') ||
				base.startsWith('notice')
			)
				licenseFiles.push(relative);
		}
		offset = bodyStart + Math.ceil(size / 512) * 512;
	}
	if (!ended || pendingPaxPath) throw new Error('Dependency tarball terminator is absent');
	if (!manifestBytes) throw new Error('Dependency tarball package.json is absent');
	const manifest = object(JSON.parse(manifestBytes.toString('utf8')), 'tarball package.json');
	if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string')
		throw new Error('Dependency tarball package identity is absent');
	if (
		!identities.some(
			(identity) => identity.name === manifest.name && identity.version === manifest.version,
		)
	)
		throw new Error('Dependency tarball package identity differs from the lock');
	let license = '';
	if (typeof manifest.license === 'string') license = manifest.license.trim();
	else if (
		manifest.license &&
		typeof manifest.license === 'object' &&
		!Array.isArray(manifest.license)
	) {
		const type = (manifest.license as Record<string, unknown>).type;
		if (typeof type === 'string') license = type.trim();
	} else if (Array.isArray(manifest.licenses)) {
		license = manifest.licenses
			.map((item) => (typeof item === 'string' ? item : object(item, 'license entry').type))
			.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
			.join(' OR ');
	}
	if (!license && licenseFiles.length === 0)
		throw new Error(
			'Dependency tarball has neither a license declaration nor license/NOTICE file',
		);
	return {
		name: manifest.name,
		version: manifest.version,
		license: license || 'file-only',
		licenseFiles: [...licenseFiles].sort((left, right) => left.localeCompare(right)),
	};
}

export function dependencyClosureDigest(receipt: DependencyClosureReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

export function finalizeDependencyClosureReceipt(
	receipt: Omit<DependencyClosureReceipt, 'schemaVersion' | 'integrity'>,
): DependencyClosureReceipt {
	const complete: DependencyClosureReceipt = {
		schemaVersion: DEPENDENCY_CLOSURE_SCHEMA,
		...receipt,
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	complete.integrity.canonicalDigest = dependencyClosureDigest(complete);
	return complete;
}

export function verifyDependencyClosureReceipt(value: unknown): DependencyClosureReceipt {
	const receipt = object(value, 'receipt') as unknown as DependencyClosureReceipt;
	if (
		receipt.schemaVersion !== DEPENDENCY_CLOSURE_SCHEMA ||
		receipt.fixture !== 'angular-fuxa' ||
		receipt.repository !== 'frangoteam/FUXA' ||
		receipt.commit !== '8b323c177615c0d152a54e5ef0a6f98dae7b8ff0' ||
		receipt.lock?.sha256 !== FUXA_LOCK_SHA256 ||
		receipt.lock?.entries !== 1468 ||
		receipt.lock?.uniqueTarballs !== 1222 ||
		receipt.lock?.missingResolvedOrIntegrity !== 0 ||
		JSON.stringify(receipt.lock?.hosts) !== JSON.stringify(['registry.npmjs.org']) ||
		receipt.runtime?.node !== '16.20.2' ||
		receipt.runtime?.npm !== '8.19.4' ||
		receipt.runtime?.archiveSha256 !== FUXA_RUNTIME_SHA256 ||
		receipt.runtime?.state !== 'eol-compatibility-sandbox-only' ||
		receipt.consent?.status !== 'closed' ||
		JSON.stringify(receipt.consent?.methods) !== JSON.stringify(['GET']) ||
		receipt.consent?.requests !== 1222 ||
		!Number.isSafeInteger(receipt.consent?.responseBytes) ||
		receipt.consent.responseBytes < 0 ||
		receipt.consent.responseBytes > 1_024 * 1_024 * 1_024 ||
		receipt.consent?.aggregateBytes !== 1_024 * 1_024 * 1_024 ||
		receipt.artifacts?.length !== 1222 ||
		receipt.installVerification?.runs !== 2 ||
		receipt.installVerification?.networkAttempts !== 0 ||
		receipt.installVerification?.ignoreScripts !== true ||
		receipt.installVerification?.firstDigest !== receipt.installVerification?.secondDigest ||
		receipt.installVerification?.lockUnchanged !== true ||
		receipt.installVerification?.residue !== 'none' ||
		receipt.integrity?.algorithm !== 'sha256' ||
		dependencyClosureDigest(receipt) !== receipt.integrity?.canonicalDigest
	)
		throw new Error('Dependency closure receipt is invalid');
	const pairs = new Set<string>();
	for (const [index, artifact] of receipt.artifacts.entries()) {
		const parsed = parseURL(artifact.url);
		if (
			artifact.sequence !== index + 1 ||
			parsed.protocol !== 'https:' ||
			parsed.host !== 'registry.npmjs.org' ||
			parsed.auth ||
			parsed.search ||
			parsed.hash ||
			!parsed.pathname.endsWith('.tgz') ||
			!exactSha512Integrity(artifact.integrity) ||
			artifact.sha256.length !== 64 ||
			!Number.isSafeInteger(artifact.byteLength) ||
			artifact.byteLength < 1 ||
			artifact.byteLength > 64 * 1_024 * 1_024 ||
			!artifact.name ||
			!artifact.version ||
			(!artifact.license && artifact.licenseFiles.length === 0)
		)
			throw new Error('Dependency closure receipt artifact is invalid');
		pairs.add(`${artifact.url}\0${artifact.integrity}`);
	}
	if (pairs.size !== 1222)
		throw new Error('Dependency closure receipt artifact pairs are not unique');
	return receipt;
}
