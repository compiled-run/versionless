import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import { canonicalize, sha256 } from './canonicalize.ts';

export const NPM_LOCK_ACQUISITION_PREFLIGHT_SCHEMA =
	'versionless.npm-lock-acquisition-preflight.v1' as const;
export const DASHBOARD_CONTACTS_ROW_SET_SHA256 =
	'02f6522dc9cae9939a9b5c1adf7bb4af56aa9967e564a10d11ac3e960c102e61' as const;

export type NpmLockIdentity = Readonly<{ name: string; version: string }>;
export type NpmLockPair = Readonly<{
	url: string;
	integrity: string;
	identities: readonly NpmLockIdentity[];
}>;

export type NpmLockPlan = Readonly<{
	lockfileVersion: 1 | 3;
	pairs: readonly NpmLockPair[];
}>;

export type PackageMetadata = Readonly<{
	layout: 'package' | 'legacy-single-root';
	name: string;
	version: string;
	license: Readonly<{
		state: 'declared' | 'file-only' | 'empty' | 'ambiguous';
		declarations: readonly string[];
		files: readonly string[];
	}>;
	lifecycleScripts: readonly Readonly<{
		name: string;
		state: 'declared' | 'ambiguous';
	}>[];
	nativeIndicators: Readonly<{
		bindingGyp: boolean;
		gypfile: 'true' | 'false' | 'absent' | 'ambiguous';
		nodeGypDependency: boolean;
		lifecycleMentionsNodeGyp: boolean;
	}>;
	engines: Readonly<{
		state: 'declared' | 'absent' | 'ambiguous';
		values: Readonly<Record<string, string>>;
	}>;
	os: Readonly<{ state: 'declared' | 'absent' | 'ambiguous'; values: readonly string[] }>;
	cpu: Readonly<{ state: 'declared' | 'absent' | 'ambiguous'; values: readonly string[] }>;
	optionalDependencies: Readonly<{
		state: 'declared' | 'absent' | 'ambiguous';
		names: readonly string[];
	}>;
}>;

export type CachedNpmArtifact = Readonly<{
	url: string;
	integrities: readonly string[];
	identities: readonly NpmLockIdentity[];
	sha256: string;
	byteLength: number;
	cacheRoots: readonly string[];
	metadata: PackageMetadata;
}>;

export type MissingNpmArtifact = Readonly<{
	url: string;
	integrities: readonly string[];
	integrityState: 'sha512' | 'legacy-sha1-only' | 'dual-sha512-sha1';
	metadata: 'unknown-uncached';
}>;

type LockEntry = Readonly<{
	name?: unknown;
	version?: unknown;
	resolved?: unknown;
	integrity?: unknown;
	dependencies?: unknown;
}>;

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`npm lock preflight ${label} must be an object`);
	return value as Record<string, unknown>;
}

function compareCodeUnits(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function parseSri(integrity: string): Readonly<{
	algorithm: 'sha1' | 'sha512';
	encoded: string;
	digest: Buffer;
}> {
	const separator = integrity.indexOf('-');
	const algorithm = integrity.slice(0, separator);
	const encoded = integrity.slice(separator + 1);
	if ((algorithm !== 'sha1' && algorithm !== 'sha512') || separator < 1 || !encoded)
		throw new Error('npm lock preflight SRI must be exact SHA-512 or legacy SHA-1');
	if (encoded.includes(' ') || encoded.includes('\t') || encoded.includes('\n'))
		throw new Error('npm lock preflight SRI contains whitespace');
	const digest = Buffer.from(encoded, 'base64');
	const expectedLength = algorithm === 'sha512' ? 64 : 20;
	if (digest.byteLength !== expectedLength || digest.toString('base64') !== encoded)
		throw new Error('npm lock preflight SRI encoding is invalid');
	return { algorithm, encoded, digest };
}

function requireRegistryUrl(url: string): void {
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== 'registry.npmjs.org' ||
		Boolean(parsed.auth) ||
		Boolean(parsed.search) ||
		Boolean(parsed.hash) ||
		!parsed.pathname.endsWith('.tgz') ||
		!parsed.pathname.includes('/-/')
	)
		throw new Error('npm lock preflight URL is outside the exact HTTPS registry tarball shape');
}

function packageNameFromV3Path(packagePath: string, entry: LockEntry): string {
	if (typeof entry.name === 'string' && entry.name) return entry.name;
	const marker = 'node_modules/';
	const index = packagePath.lastIndexOf(marker);
	if (index < 0) throw new Error('npm lock v3 entry name is not derivable');
	const remainder = packagePath.slice(index + marker.length);
	const segments = remainder.split('/');
	const name = remainder.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
	if (!name) throw new Error('npm lock v3 entry name is empty');
	return name;
}

export function parseNpmLockPlan(lockBytes: Buffer): NpmLockPlan {
	let root: Record<string, unknown>;
	try {
		root = object(JSON.parse(lockBytes.toString('utf8')), 'document');
	} catch {
		throw new Error('npm lock preflight document is invalid JSON');
	}
	if (root.lockfileVersion !== 1 && root.lockfileVersion !== 3)
		throw new Error('npm lock preflight supports only lockfileVersion 1 or 3');
	const rows: Array<NpmLockIdentity & { url: string; integrity: string }> = [];
	const add = (name: string, raw: unknown): void => {
		const entry = object(raw, `entry ${name}`) as LockEntry;
		if (entry.resolved === undefined && entry.integrity === undefined) return;
		if (
			typeof entry.version !== 'string' ||
			!entry.version ||
			typeof entry.resolved !== 'string' ||
			!entry.resolved ||
			typeof entry.integrity !== 'string' ||
			!entry.integrity
		)
			throw new Error(`npm lock preflight entry ${name} has incomplete immutable identity`);
		requireRegistryUrl(entry.resolved);
		parseSri(entry.integrity);
		rows.push({
			name,
			version: entry.version,
			url: entry.resolved,
			integrity: entry.integrity,
		});
	};
	if (root.lockfileVersion === 3) {
		for (const [packagePath, raw] of Object.entries(object(root.packages, 'packages'))) {
			const entry = object(raw, `package ${packagePath}`) as LockEntry;
			if (entry.resolved === undefined && entry.integrity === undefined) continue;
			add(packageNameFromV3Path(packagePath, entry), entry);
		}
	} else {
		const visit = (dependencies: unknown): void => {
			for (const [name, raw] of Object.entries(object(dependencies, 'dependencies'))) {
				const entry = object(raw, `dependency ${name}`) as LockEntry;
				add(name, entry);
				if (entry.dependencies !== undefined) visit(entry.dependencies);
			}
		};
		visit(root.dependencies);
	}
	const grouped = new Map<string, Array<NpmLockIdentity>>();
	for (const row of rows) {
		const key = `${row.url}\0${row.integrity}`;
		grouped.set(key, [...(grouped.get(key) ?? []), { name: row.name, version: row.version }]);
	}
	const pairs = [...grouped.entries()]
		.sort(([left], [right]) => compareCodeUnits(left, right))
		.map(([key, identities]) => {
			const separator = key.indexOf('\0');
			return {
				url: key.slice(0, separator),
				integrity: key.slice(separator + 1),
				identities: [
					...new Map(
						identities.map((identity) => [
							`${identity.name}\0${identity.version}`,
							identity,
						]),
					).values(),
				].sort(
					(left, right) =>
						compareCodeUnits(left.name, right.name) ||
						compareCodeUnits(left.version, right.version),
				),
			};
		});
	return { lockfileVersion: root.lockfileVersion, pairs };
}

export function npmLockRowSetDigest(pairs: readonly NpmLockPair[]): string {
	const keys = [...new Set(pairs.map((pair) => `${pair.url}\0${pair.integrity}`))].sort(
		compareCodeUnits,
	);
	return sha256(keys.join('\n'));
}

export function verifyNpmSri(bytes: Buffer, integrity: string): void {
	const sri = parseSri(integrity);
	const actual = createHash(sri.algorithm).update(bytes).digest();
	if (!actual.equals(sri.digest)) throw new Error('npm cache content does not satisfy lock SRI');
}

function tarString(bytes: Buffer, start: number, length: number): string {
	const end = bytes.indexOf(0, start);
	return bytes
		.subarray(start, end < 0 || end > start + length ? start + length : end)
		.toString('utf8');
}

function tarOctal(bytes: Buffer, start: number, length: number): number {
	const text = tarString(bytes, start, length).trim();
	if (!text || [...text].some((character) => character < '0' || character > '7'))
		throw new Error('npm package tarball numeric header is invalid');
	return Number.parseInt(text, 8);
}

function safeTarPath(value: string): string {
	const normalized = path.normalize(value).replaceAll('\\', '/');
	if (
		!value ||
		path.isAbsolute(value) ||
		normalized !== value ||
		value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
	)
		throw new Error('npm package tarball path is unsafe');
	return value;
}

function paxPath(bytes: Buffer): string | undefined {
	let offset = 0;
	let result: string | undefined;
	const decoder = new TextDecoder('utf-8', { fatal: true });
	while (offset < bytes.byteLength) {
		const space = bytes.indexOf(32, offset);
		if (space <= offset) throw new Error('npm package tarball PAX framing is invalid');
		const digits = bytes.subarray(offset, space).toString('ascii');
		if (![...digits].every((character) => character >= '0' && character <= '9'))
			throw new Error('npm package tarball PAX length is invalid');
		const length = Number.parseInt(digits, 10);
		const end = offset + length;
		if (!Number.isSafeInteger(length) || end > bytes.byteLength || bytes[end - 1] !== 10)
			throw new Error('npm package tarball PAX record is incomplete');
		const record = decoder.decode(bytes.subarray(space + 1, end - 1));
		const separator = record.indexOf('=');
		if (separator < 1) throw new Error('npm package tarball PAX field is invalid');
		const key = record.slice(0, separator);
		if (key === 'linkpath') throw new Error('npm package tarball PAX link target is forbidden');
		if (key === 'path') {
			if (result !== undefined) throw new Error('npm package tarball PAX path is duplicated');
			result = safeTarPath(record.slice(separator + 1));
		}
		offset = end;
	}
	return result;
}

function isExactTarField(header: Buffer, start: number, length: number, value: string): boolean {
	const expected = Buffer.from(value, 'ascii');
	return (
		expected.byteLength <= length &&
		header.subarray(start, start + expected.byteLength).equals(expected) &&
		header.subarray(start + expected.byteLength, start + length).every((byte) => byte === 0)
	);
}

function isExactGlobalPaxComment(bytes: Buffer): boolean {
	const prefix = Buffer.from('52 comment=', 'ascii');
	if (
		bytes.byteLength !== 52 ||
		!bytes.subarray(0, prefix.byteLength).equals(prefix) ||
		bytes[51] !== 10
	)
		return false;
	for (const byte of bytes.subarray(prefix.byteLength, 51)) {
		if (!((byte >= 48 && byte <= 57) || (byte >= 97 && byte <= 102))) return false;
	}
	return true;
}

function stringMap(value: unknown): Readonly<{
	state: 'declared' | 'absent' | 'ambiguous';
	values: Readonly<Record<string, string>>;
}> {
	if (value === undefined) return { state: 'absent', values: {} };
	if (!value || typeof value !== 'object' || Array.isArray(value))
		return { state: 'ambiguous', values: {} };
	const entries = Object.entries(value as Record<string, unknown>);
	if (entries.some(([, item]) => typeof item !== 'string'))
		return { state: 'ambiguous', values: {} };
	return {
		state: 'declared',
		values: Object.fromEntries(
			entries.sort(([left], [right]) => compareCodeUnits(left, right)),
		) as Record<string, string>,
	};
}

function stringList(value: unknown): Readonly<{
	state: 'declared' | 'absent' | 'ambiguous';
	values: readonly string[];
}> {
	if (value === undefined) return { state: 'absent', values: [] };
	const values = typeof value === 'string' ? [value] : value;
	if (!Array.isArray(values) || values.some((item) => typeof item !== 'string'))
		return { state: 'ambiguous', values: [] };
	return { state: 'declared', values: [...values].sort(compareCodeUnits) };
}

const lifecycleNames = [
	'preinstall',
	'install',
	'postinstall',
	'prepublish',
	'prepublishOnly',
	'prepare',
	'prepack',
	'postpack',
] as const;

export function inspectNpmPackageTarball(
	bytes: Buffer,
	identities: readonly NpmLockIdentity[],
): PackageMetadata {
	if (bytes.byteLength > 64 * 1_024 * 1_024)
		throw new Error('npm package tarball compressed byte limit exceeded');
	let archive: Buffer;
	try {
		archive = gunzipSync(bytes, { maxOutputLength: 512 * 1_024 * 1_024 });
	} catch {
		throw new Error('npm package tarball gzip is invalid or exceeds the expansion limit');
	}
	const files = new Map<string, Buffer>();
	let offset = 0;
	let entries = 0;
	let ended = false;
	let pendingPath: string | undefined;
	while (offset + 512 <= archive.byteLength) {
		const header = archive.subarray(offset, offset + 512);
		if (header.every((byte) => byte === 0)) {
			const second = archive.subarray(offset + 512, offset + 1024);
			if (second.byteLength !== 512 || !second.every((byte) => byte === 0))
				throw new Error('npm package tarball terminator is incomplete');
			if (!archive.subarray(offset + 1024).every((byte) => byte === 0))
				throw new Error('npm package tarball has nonzero trailing data');
			ended = true;
			break;
		}
		entries += 1;
		if (entries > 100_000) throw new Error('npm package tarball entry limit exceeded');
		const expectedChecksum = tarOctal(header, 148, 8);
		let checksum = 0;
		for (let index = 0; index < 512; index += 1)
			checksum += index >= 148 && index < 156 ? 32 : header[index]!;
		if (checksum !== expectedChecksum) throw new Error('npm package tarball checksum differs');
		const name = tarString(header, 0, 100);
		const prefix = tarString(header, 345, 155);
		const rawPath = prefix ? `${prefix}/${name}` : name;
		const type = header[156] === 0 ? '0' : String.fromCharCode(header[156]!);
		const size = tarOctal(header, 124, 12);
		const bodyStart = offset + 512;
		const bodyEnd = bodyStart + size;
		if (bodyEnd > archive.byteLength) throw new Error('npm package tarball entry is truncated');
		const paddedBodyEnd = bodyStart + Math.ceil(size / 512) * 512;
		if (type === 'g') {
			if (
				entries !== 1 ||
				offset !== 0 ||
				!isExactTarField(header, 0, 100, 'pax_global_header') ||
				!isExactTarField(header, 345, 155, '') ||
				!isExactTarField(header, 157, 100, '') ||
				size !== 52 ||
				!isExactGlobalPaxComment(archive.subarray(bodyStart, bodyEnd)) ||
				!archive.subarray(bodyEnd, paddedBodyEnd).every((byte) => byte === 0)
			)
				throw new Error('npm package tarball global PAX comment is invalid');
			offset = paddedBodyEnd;
			continue;
		}
		if (type === 'x') {
			if (pendingPath) throw new Error('npm package tarball PAX path is already pending');
			pendingPath = paxPath(archive.subarray(bodyStart, bodyEnd));
			offset = paddedBodyEnd;
			continue;
		}
		const rawZeroBodyDirectoryWithOneTerminator =
			pendingPath === undefined &&
			type === '5' &&
			size === 0 &&
			rawPath.endsWith('/') &&
			!rawPath.endsWith('//');
		const filePath = safeTarPath(
			rawZeroBodyDirectoryWithOneTerminator ? rawPath.slice(0, -1) : (pendingPath ?? rawPath),
		);
		pendingPath = undefined;
		if (tarString(header, 157, 100))
			throw new Error('npm package tarball link target is forbidden');
		if (type === '0') {
			if (files.has(filePath)) throw new Error('npm package tarball file path is duplicated');
			files.set(filePath, Buffer.from(archive.subarray(bodyStart, bodyEnd)));
		} else if (type === '5') {
			if (size !== 0) throw new Error('npm package tarball directory body is forbidden');
		} else {
			throw new Error('npm package tarball entry type is unsupported');
		}
		offset = paddedBodyEnd;
	}
	if (!ended || pendingPath) throw new Error('npm package tarball terminator is absent');
	const manifestCandidates = [...files.keys()].filter(
		(file) =>
			file === 'package/package.json' ||
			file === 'package.json' ||
			file.endsWith('/package.json'),
	);
	const legacyCandidates = manifestCandidates.filter((file) => file.split('/').length <= 2);
	if (!manifestCandidates.includes('package/package.json') && legacyCandidates.length !== 1)
		throw new Error('npm package tarball package.json root is ambiguous');
	const preferred = manifestCandidates.includes('package/package.json')
		? 'package/package.json'
		: legacyCandidates[0];
	if (!preferred) throw new Error('npm package tarball package.json is absent or ambiguous');
	const layout = preferred === 'package/package.json' ? 'package' : 'legacy-single-root';
	const rootPrefix = preferred.slice(0, -'package.json'.length);
	if ([...files.keys()].some((file) => !file.startsWith(rootPrefix)))
		throw new Error('npm package tarball contains files outside its single package root');
	const manifest = object(JSON.parse(files.get(preferred)!.toString('utf8')), 'manifest');
	if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string')
		throw new Error('npm package tarball identity is absent');
	if (
		!identities.some(
			(identity) => identity.name === manifest.name && identity.version === manifest.version,
		)
	)
		throw new Error('npm package tarball identity differs from the lock');
	const licenseFiles = [...files.keys()]
		.filter((file) => {
			const base = path.basename(file).toLowerCase();
			return (
				base.startsWith('license') ||
				base.startsWith('licence') ||
				base.startsWith('copying') ||
				base.startsWith('notice')
			);
		})
		.map((file) => file.slice(rootPrefix.length))
		.sort(compareCodeUnits);
	const declarations: string[] = [];
	let licenseAmbiguous = false;
	if (typeof manifest.license === 'string' && manifest.license.trim())
		declarations.push(manifest.license.trim());
	else if (manifest.license !== undefined && manifest.license !== null) {
		if (typeof manifest.license === 'object' && !Array.isArray(manifest.license)) {
			const type = (manifest.license as Record<string, unknown>).type;
			if (typeof type === 'string' && type.trim()) declarations.push(type.trim());
			else licenseAmbiguous = true;
		} else licenseAmbiguous = true;
	}
	if (Array.isArray(manifest.licenses)) {
		for (const item of manifest.licenses) {
			if (typeof item === 'string' && item.trim()) declarations.push(item.trim());
			else if (item && typeof item === 'object' && !Array.isArray(item)) {
				const type = (item as Record<string, unknown>).type;
				if (typeof type === 'string' && type.trim()) declarations.push(type.trim());
				else licenseAmbiguous = true;
			} else licenseAmbiguous = true;
		}
	} else if (manifest.licenses !== undefined) licenseAmbiguous = true;
	const scripts =
		manifest.scripts && typeof manifest.scripts === 'object' && !Array.isArray(manifest.scripts)
			? (manifest.scripts as Record<string, unknown>)
			: {};
	const lifecycleScripts = lifecycleNames
		.filter((name) => Object.hasOwn(scripts, name))
		.map((name) => ({
			name,
			state:
				typeof scripts[name] === 'string' ? ('declared' as const) : ('ambiguous' as const),
		}));
	const optional = stringMap(manifest.optionalDependencies);
	return {
		layout,
		name: manifest.name,
		version: manifest.version,
		license: {
			state: licenseAmbiguous
				? 'ambiguous'
				: declarations.length > 0
					? 'declared'
					: licenseFiles.length > 0
						? 'file-only'
						: 'empty',
			declarations: [...new Set(declarations)].sort(compareCodeUnits),
			files: licenseFiles,
		},
		lifecycleScripts,
		nativeIndicators: {
			bindingGyp: files.has(`${rootPrefix}binding.gyp`),
			gypfile:
				manifest.gypfile === undefined
					? 'absent'
					: manifest.gypfile === true
						? 'true'
						: manifest.gypfile === false
							? 'false'
							: 'ambiguous',
			nodeGypDependency:
				Boolean(
					(manifest.dependencies as Record<string, unknown> | undefined)?.['node-gyp'],
				) ||
				Boolean(
					(manifest.optionalDependencies as Record<string, unknown> | undefined)?.[
						'node-gyp'
					],
				),
			lifecycleMentionsNodeGyp: lifecycleNames.some(
				(name) => typeof scripts[name] === 'string' && scripts[name].includes('node-gyp'),
			),
		},
		engines: stringMap(manifest.engines),
		os: stringList(manifest.os),
		cpu: stringList(manifest.cpu),
		optionalDependencies: {
			state: optional.state,
			names: Object.keys(optional.values).sort(compareCodeUnits),
		},
	};
}

function contentPath(cacheRoot: string, integrity: string): string {
	const sri = parseSri(integrity);
	const hex = sri.digest.toString('hex');
	return path.join(
		cacheRoot,
		'_cacache/content-v2',
		sri.algorithm,
		hex.slice(0, 2),
		hex.slice(2, 4),
		hex.slice(4),
	);
}

function indexPath(cacheRoot: string, url: string): string {
	const digest = sha256(`make-fetch-happen:request-cache:${url}`);
	return path.join(
		cacheRoot,
		'_cacache/index-v5',
		digest.slice(0, 2),
		digest.slice(2, 4),
		digest.slice(4),
	);
}

function errorCode(error: unknown): string | undefined {
	return error && typeof error === 'object' && 'code' in error
		? String((error as { code?: unknown }).code)
		: undefined;
}

export async function auditNpmContentCaches(
	pairs: readonly NpmLockPair[],
	cacheRoots: readonly Readonly<{ label: string; path: string }>[],
): Promise<
	Readonly<{ cached: readonly CachedNpmArtifact[]; missing: readonly MissingNpmArtifact[] }>
> {
	const grouped = new Map<string, NpmLockPair[]>();
	for (const pair of pairs) grouped.set(pair.url, [...(grouped.get(pair.url) ?? []), pair]);
	const cached: CachedNpmArtifact[] = [];
	const missing: MissingNpmArtifact[] = [];
	for (const [url, urlPairs] of [...grouped.entries()].sort(([left], [right]) =>
		compareCodeUnits(left, right),
	)) {
		const integrities = [...new Set(urlPairs.map((pair) => pair.integrity))].sort(
			compareCodeUnits,
		);
		const identities = [
			...new Map(
				urlPairs
					.flatMap((pair) => pair.identities)
					.map((identity) => [`${identity.name}\0${identity.version}`, identity]),
			).values(),
		].sort(
			(left, right) =>
				compareCodeUnits(left.name, right.name) ||
				compareCodeUnits(left.version, right.version),
		);
		const candidates = new Map<string, { bytes: Buffer; roots: Set<string> }>();
		for (const integrity of integrities) {
			for (const cache of cacheRoots) {
				try {
					const bytes = await readFile(contentPath(cache.path, integrity));
					verifyNpmSri(bytes, integrity);
					const digest = sha256(bytes);
					const candidate = candidates.get(digest) ?? { bytes, roots: new Set<string>() };
					candidate.roots.add(cache.label);
					candidates.set(digest, candidate);
				} catch (error) {
					if (errorCode(error) !== 'ENOENT') throw error;
				}
			}
		}
		for (const cache of cacheRoots) {
			let indexBytes: Buffer;
			try {
				indexBytes = await readFile(indexPath(cache.path, url));
			} catch (error) {
				if (errorCode(error) === 'ENOENT') continue;
				throw error;
			}
			for (const line of indexBytes.toString('utf8').split('\n').filter(Boolean)) {
				const separator = line.indexOf('\t');
				if (separator < 1) throw new Error('npm cache index framing is invalid');
				const record = object(JSON.parse(line.slice(separator + 1)), 'cache index record');
				if (record.key !== `make-fetch-happen:request-cache:${url}`) continue;
				const metadata = object(record.metadata, 'cache index metadata');
				if (metadata.url !== url || typeof record.integrity !== 'string')
					throw new Error('npm cache index exact URL binding differs');
				const indexIntegrities = record.integrity.split(' ').filter(Boolean);
				if (!indexIntegrities.length)
					throw new Error('npm cache index content integrity is absent');
				for (const indexIntegrity of indexIntegrities) {
					parseSri(indexIntegrity);
					const bytes = await readFile(contentPath(cache.path, indexIntegrity));
					verifyNpmSri(bytes, indexIntegrity);
					for (const integrity of integrities) verifyNpmSri(bytes, integrity);
					if (
						typeof record.size !== 'number' ||
						!Number.isSafeInteger(record.size) ||
						record.size !== bytes.byteLength
					)
						throw new Error('npm cache index byte count differs from hashed content');
					const digest = sha256(bytes);
					const candidate = candidates.get(digest) ?? { bytes, roots: new Set<string>() };
					candidate.roots.add(cache.label);
					candidates.set(digest, candidate);
				}
			}
		}
		if (candidates.size === 0) {
			const algorithms = integrities.map((integrity) => parseSri(integrity).algorithm);
			missing.push({
				url,
				integrities,
				integrityState: algorithms.includes('sha512')
					? algorithms.includes('sha1')
						? 'dual-sha512-sha1'
						: 'sha512'
					: 'legacy-sha1-only',
				metadata: 'unknown-uncached',
			});
			continue;
		}
		if (candidates.size !== 1)
			throw new Error('npm caches contain divergent content for one exact URL');
		const [digest, candidate] = [...candidates.entries()][0]!;
		for (const integrity of integrities) verifyNpmSri(candidate.bytes, integrity);
		cached.push({
			url,
			integrities,
			identities,
			sha256: digest,
			byteLength: candidate.bytes.byteLength,
			cacheRoots: [...candidate.roots].sort(compareCodeUnits),
			metadata: inspectNpmPackageTarball(candidate.bytes, identities),
		});
	}
	return { cached, missing };
}

export function canonicalNpmPreflightDigest(value: unknown): string {
	return sha256(canonicalize(value));
}
