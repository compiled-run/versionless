import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { charIn, createRegExp } from 'magic-regexp';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import { assertSyntheticEvidence } from '../policy/payment-signals.ts';

export type CompleteBody = Readonly<{
	bytes: Buffer;
	byteLength: number;
	sha256: string;
}>;

export class BodyReadError extends Error {
	readonly kind: 'response-limit' | 'stream-failure';
	readonly receivedBytes: number;

	constructor(kind: 'response-limit' | 'stream-failure', receivedBytes: number) {
		super(
			kind === 'response-limit'
				? 'Response exceeds the consented byte limit'
				: 'Response stream failed before completion',
		);
		this.name = 'BodyReadError';
		this.kind = kind;
		this.receivedBytes = receivedBytes;
	}
}

export type ArchiveFile = Readonly<{
	path: string;
	bytes: Buffer;
	byteLength: number;
	sha256: string;
}>;

export type ArchiveIndex = Readonly<{
	root: string;
	files: readonly ArchiveFile[];
	manifestSha256: string;
	globalMetadata: TarGlobalMetadata | null;
	pathMetadata: readonly TarPathMetadata[];
}>;

export type AssetClassification = Readonly<{
	path: string;
	sha256: string;
	classification: 'verified-compatible' | 'excluded' | 'unknown';
	reason: string;
}>;

const assetExtensions = new Set([
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.ico',
	'.svg',
	'.woff',
	'.woff2',
	'.ttf',
	'.otf',
	'.eot',
	'.mp3',
	'.mp4',
	'.webm',
	'.wav',
	'.ogg',
]);

const nestedArchiveSuffixes = [
	'.tar',
	'.tar.gz',
	'.tgz',
	'.zip',
	'.7z',
	'.rar',
	'.gz',
	'.bz2',
	'.xz',
];

const tarBlockBytes = 512;
const maximumTarBytes = 256 * 1_024 * 1_024;
const maximumPhysicalHeaders = 100_000;
const maximumMetadataHeaders = 4_096;
const maximumActualEntries = 50_000;
const maximumPathBytes = 4_096;
const maximumPathSegmentBytes = 255;

export type TarPathMetadata =
	| Readonly<{ kind: 'gnu-long-name'; value: string; bytes: number }>
	| Readonly<{ kind: 'pax-path'; value: string; bytes: number }>;

export type TarGlobalMetadata = Readonly<{
	kind: 'pax-global-comment';
	comment: string;
	bytes: 52;
}>;

type PendingTarPath = {
	gnuLongName?: Extract<TarPathMetadata, { kind: 'gnu-long-name' }>;
	paxPath?: Extract<TarPathMetadata, { kind: 'pax-path' }>;
	metadataCount: number;
};

const fatalUtf8 = new TextDecoder('utf-8', { fatal: true });
const immutableCommitPattern = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);

export function hashBytes(bytes: Uint8Array | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export function completeBuffer(chunks: readonly Uint8Array[]): CompleteBody {
	const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
	return { bytes, byteLength: bytes.byteLength, sha256: hashBytes(bytes) };
}

export async function readCompleteBody(
	stream: AsyncIterable<Uint8Array>,
	maximumBytes: number,
	onReceived?: (receivedBytes: number) => void,
): Promise<CompleteBody> {
	const chunks: Buffer[] = [];
	let received = 0;
	try {
		for await (const chunk of stream) {
			const bytes = Buffer.from(chunk);
			received += bytes.byteLength;
			onReceived?.(received);
			if (received > maximumBytes) throw new BodyReadError('response-limit', received);
			chunks.push(bytes);
		}
	} catch (error) {
		if (error instanceof BodyReadError) throw error;
		throw new BodyReadError('stream-failure', received);
	}
	return completeBuffer(chunks);
}

export function requireRepeatedBodies(first: CompleteBody, second: CompleteBody): void {
	if (
		first.byteLength !== second.byteLength ||
		first.sha256 !== second.sha256 ||
		!first.bytes.equals(second.bytes)
	)
		throw new Error('Repeated immutable endpoint bodies differ');
}

export function requireRawArchiveMatch(raw: CompleteBody, archive: ArchiveFile): void {
	if (
		raw.byteLength !== archive.byteLength ||
		raw.sha256 !== archive.sha256 ||
		!raw.bytes.equals(archive.bytes)
	)
		throw new Error(`Raw/archive bytes differ for ${archive.path}`);
}

function strictFieldBytes(block: Buffer, start: number, length: number, label: string): Buffer {
	const field = block.subarray(start, start + length);
	const nul = field.indexOf(0);
	if (nul !== -1 && !isAllZero(field.subarray(nul)))
		throw new Error(`Invalid tar ${label} padding`);
	return field.subarray(0, nul === -1 ? field.length : nul);
}

function parseOctal(block: Buffer, start: number, length: number, label: string): number {
	const field = block.subarray(start, start + length);
	if ((field[0] ?? 0) >= 128) throw new Error(`Invalid tar ${label}`);
	let first = 0;
	while (first < field.length && (field[first] === 0 || field[first] === 32)) first += 1;
	let last = field.length;
	while (last > first && (field[last - 1] === 0 || field[last - 1] === 32)) last -= 1;
	if (first === last) return 0;
	let result = 0;
	for (let index = first; index < last; index++) {
		const byte = field[index] ?? 0;
		if (byte < 48 || byte > 55) throw new Error(`Invalid tar ${label}`);
		result = result * 8 + byte - 48;
		if (!Number.isSafeInteger(result)) throw new Error(`Unsafe tar ${label}`);
	}
	return result;
}

function decodeUtf8(bytes: Uint8Array, label: string): string {
	try {
		return fatalUtf8.decode(bytes);
	} catch {
		throw new Error(`Invalid UTF-8 in tar ${label}`);
	}
}

function safeArchivePath(value: string): string {
	if (!value) throw new Error('Archive contains an empty path');
	if (
		value.includes('\0') ||
		value.includes('\r') ||
		value.includes('\n') ||
		value.includes('\\')
	)
		throw new Error('Archive path contains a forbidden character');
	if (value !== value.normalize('NFC')) throw new Error('Archive path is not Unicode NFC');
	if (value.startsWith('/') || path.isAbsolute(value))
		throw new Error('Archive contains an absolute path');
	if (
		value.length >= 3 &&
		((value.charCodeAt(0) >= 65 && value.charCodeAt(0) <= 90) ||
			(value.charCodeAt(0) >= 97 && value.charCodeAt(0) <= 122)) &&
		value[1] === ':' &&
		value[2] === '/'
	)
		throw new Error('Archive contains a Windows drive path');
	const withoutTrailingSlash = value.endsWith('/') ? value.slice(0, -1) : value;
	if (!withoutTrailingSlash || Buffer.byteLength(withoutTrailingSlash, 'utf8') > maximumPathBytes)
		throw new Error('Archive path length is outside limits');
	const segments = withoutTrailingSlash.split('/');
	if (
		segments.some(
			(segment) =>
				!segment ||
				segment === '.' ||
				segment === '..' ||
				Buffer.byteLength(segment, 'utf8') > maximumPathSegmentBytes,
		)
	)
		throw new Error('Archive path contains an unsafe or oversized segment');
	const normalized = path.normalize(withoutTrailingSlash);
	if (normalized !== withoutTrailingSlash)
		throw new Error('Archive path changes during normalization');
	return normalized;
}

function isAllZero(block: Buffer): boolean {
	for (const value of block) if (value !== 0) return false;
	return true;
}

function validateHeaderChecksum(header: Buffer): void {
	const storedChecksum = parseOctal(header, 148, 8, 'checksum');
	let calculatedChecksum = 0;
	for (let index = 0; index < header.length; index++)
		calculatedChecksum += index >= 148 && index < 156 ? 32 : (header[index] ?? 0);
	if (storedChecksum !== calculatedChecksum) throw new Error('Archive tar checksum mismatch');
}

function requireTarSignature(header: Buffer): void {
	const magic = header.subarray(257, 263);
	const version = header.subarray(263, 265);
	const posix =
		magic.equals(Buffer.from([117, 115, 116, 97, 114, 0])) && version.equals(Buffer.from('00'));
	const gnu = magic.equals(Buffer.from('ustar ')) && version.equals(Buffer.from([32, 0]));
	if (!posix && !gnu) throw new Error('Archive tar signature is not recognized');
}

function headerPath(header: Buffer, allowGnuLongNameMarker: boolean): string {
	const name = decodeUtf8(strictFieldBytes(header, 0, 100, 'name'), 'name');
	const prefix = decodeUtf8(strictFieldBytes(header, 345, 155, 'prefix'), 'prefix');
	if (!name) throw new Error('Archive tar header name is empty');
	if (allowGnuLongNameMarker && !prefix && name === '././@LongLink') return name;
	if (prefix) safeArchivePath(prefix);
	return safeArchivePath(prefix ? path.join(prefix, name) : name);
}

function requireEmptyLinkName(header: Buffer): void {
	if (strictFieldBytes(header, 157, 100, 'linkname').byteLength !== 0)
		throw new Error('Archive entry linkname must be empty');
}

function parseGnuLongName(payload: Buffer): Extract<TarPathMetadata, { kind: 'gnu-long-name' }> {
	if (payload.byteLength < 2 || payload.byteLength > maximumPathBytes + 1)
		throw new Error('GNU long-name payload length is outside limits');
	if (payload[payload.byteLength - 1] !== 0 || payload.subarray(0, -1).includes(0))
		throw new Error('GNU long-name payload must contain exactly one terminal NUL');
	const bytes = payload.subarray(0, -1);
	const value = decodeUtf8(bytes, 'GNU long name');
	if (Buffer.byteLength(value, 'utf8') < 1 || Buffer.byteLength(value, 'utf8') > maximumPathBytes)
		throw new Error('GNU long-name value length is outside limits');
	safeArchivePath(value);
	return { kind: 'gnu-long-name', value, bytes: bytes.byteLength };
}

function parsePaxPath(payload: Buffer): Extract<TarPathMetadata, { kind: 'pax-path' }> {
	if (!payload.byteLength || payload.byteLength > 8_192)
		throw new Error('PAX payload length is outside limits');
	let digitsEnd = 0;
	while (digitsEnd < payload.length && payload[digitsEnd]! >= 48 && payload[digitsEnd]! <= 57)
		digitsEnd += 1;
	if (digitsEnd < 1 || digitsEnd > 6 || payload[0] === 48 || payload[digitsEnd] !== 32)
		throw new Error('PAX record length framing is invalid');
	let declaredLength = 0;
	for (let index = 0; index < digitsEnd; index++)
		declaredLength = declaredLength * 10 + (payload[index]! - 48);
	if (declaredLength !== payload.byteLength || payload[payload.length - 1] !== 10)
		throw new Error('PAX record declared length or terminal LF is invalid');
	const content = payload.subarray(digitsEnd + 1, -1);
	const equals = content.indexOf(61);
	if (equals < 1 || content.indexOf(61, equals + 1) !== -1)
		throw new Error('PAX record key/value framing is invalid');
	const key = decodeUtf8(content.subarray(0, equals), 'PAX key');
	if (key !== 'path') throw new Error(`Unsupported PAX key: ${key}`);
	const valueBytes = content.subarray(equals + 1);
	if (!valueBytes.byteLength || valueBytes.byteLength > maximumPathBytes)
		throw new Error('PAX path value length is outside limits');
	const value = decodeUtf8(valueBytes, 'PAX path');
	safeArchivePath(value);
	return { kind: 'pax-path', value, bytes: valueBytes.byteLength };
}

function parsePaxGlobalComment(payload: Buffer, expectedCommit: string): TarGlobalMetadata {
	if (payload.byteLength !== 52)
		throw new Error('Global PAX comment payload must be exactly 52 bytes');
	let digitsEnd = 0;
	while (digitsEnd < payload.length && payload[digitsEnd]! >= 48 && payload[digitsEnd]! <= 57)
		digitsEnd += 1;
	if (digitsEnd !== 2 || payload[0] !== 53 || payload[1] !== 50 || payload[2] !== 32)
		throw new Error('Global PAX comment record length framing is invalid');
	if (payload[payload.length - 1] !== 10)
		throw new Error('Global PAX comment record terminal LF is invalid');
	const content = payload.subarray(3, -1);
	const equals = content.indexOf(61);
	if (equals < 1 || content.indexOf(61, equals + 1) !== -1)
		throw new Error('Global PAX comment key/value framing is invalid');
	const key = decodeUtf8(content.subarray(0, equals), 'global PAX key');
	if (key !== 'comment') throw new Error(`Unsupported global PAX key: ${key}`);
	const comment = decodeUtf8(content.subarray(equals + 1), 'global PAX comment');
	if (!immutableCommitPattern.test(comment) || comment !== expectedCommit)
		throw new Error('Global PAX comment does not match the expected immutable commit');
	return { kind: 'pax-global-comment', comment, bytes: 52 };
}

function hasHiddenNestedArchive(file: string): boolean {
	const lower = file.toLowerCase();
	return nestedArchiveSuffixes.some((suffix) => lower.endsWith(suffix));
}

export function indexTarGzip(archive: CompleteBody, expectedCommit: string): ArchiveIndex {
	if (!immutableCommitPattern.test(expectedCommit))
		throw new Error('Expected archive commit must be 40-character lowercase hexadecimal');
	let tar: Buffer;
	try {
		tar = gunzipSync(archive.bytes, { maxOutputLength: maximumTarBytes });
	} catch {
		throw new Error('Archive is not a complete bounded gzip stream');
	}
	const files: ArchiveFile[] = [];
	const pathMetadata: TarPathMetadata[] = [];
	let globalMetadata: TarGlobalMetadata | null = null;
	const allPaths = new Set<string>();
	let offset = 0;
	let ended = false;
	let physicalHeaders = 0;
	let metadataHeaders = 0;
	let actualEntries = 0;
	let pending: PendingTarPath = { metadataCount: 0 };
	while (offset + tarBlockBytes <= tar.byteLength) {
		const header = tar.subarray(offset, offset + tarBlockBytes);
		if (isAllZero(header)) {
			if (pending.metadataCount) throw new Error('Archive contains dangling path metadata');
			const second = tar.subarray(offset + tarBlockBytes, offset + tarBlockBytes * 2);
			if (second.byteLength !== tarBlockBytes || !isAllZero(second))
				throw new Error('Archive lacks two complete zero terminator blocks');
			if (!isAllZero(tar.subarray(offset + tarBlockBytes * 2)))
				throw new Error('Archive contains nonzero trailing tar data');
			ended = true;
			break;
		}
		physicalHeaders += 1;
		if (physicalHeaders > maximumPhysicalHeaders)
			throw new Error('Archive physical header limit exceeded');
		validateHeaderChecksum(header);
		const size = parseOctal(header, 124, 12, 'entry size');
		parseOctal(header, 100, 8, 'mode');
		parseOctal(header, 108, 8, 'uid');
		parseOctal(header, 116, 8, 'gid');
		parseOctal(header, 136, 12, 'mtime');
		requireTarSignature(header);
		const type = String.fromCharCode(header[156] ?? 0);
		const rawPath = headerPath(header, type === 'L');
		const bodyStart = offset + tarBlockBytes;
		const bodyEnd = bodyStart + size;
		const paddedSize = Math.ceil(size / tarBlockBytes) * tarBlockBytes;
		const nextOffset = bodyStart + paddedSize;
		if (
			!Number.isSafeInteger(bodyEnd) ||
			!Number.isSafeInteger(nextOffset) ||
			bodyEnd > tar.byteLength ||
			nextOffset > tar.byteLength
		)
			throw new Error('Truncated tar entry body or padding');
		const payload = tar.subarray(bodyStart, bodyEnd);
		if (type === 'g') {
			if (physicalHeaders !== 1 || globalMetadata)
				throw new Error(
					'Global PAX comment must be the first physical header and occur once',
				);
			if (rawPath !== 'pax_global_header')
				throw new Error('Global PAX comment header name is invalid');
			requireEmptyLinkName(header);
			globalMetadata = parsePaxGlobalComment(payload, expectedCommit);
			offset = nextOffset;
			continue;
		}
		if (type === 'L') {
			if (pending.metadataCount || pending.gnuLongName)
				throw new Error('Archive contains repeated or out-of-order GNU path metadata');
			metadataHeaders += 1;
			if (metadataHeaders > maximumMetadataHeaders)
				throw new Error('Archive metadata header limit exceeded');
			requireEmptyLinkName(header);
			const metadata = parseGnuLongName(payload);
			pathMetadata.push(metadata);
			pending = { gnuLongName: metadata, metadataCount: 1 };
			offset = nextOffset;
			continue;
		}
		if (type === 'x') {
			if (pending.paxPath) throw new Error('Archive contains repeated PAX path metadata');
			metadataHeaders += 1;
			if (metadataHeaders > maximumMetadataHeaders)
				throw new Error('Archive metadata header limit exceeded');
			requireEmptyLinkName(header);
			const metadata = parsePaxPath(payload);
			pathMetadata.push(metadata);
			pending = {
				...pending,
				paxPath: metadata,
				metadataCount: pending.metadataCount + 1,
			};
			offset = nextOffset;
			continue;
		}
		if (type !== '0' && type !== '\0' && type !== '5')
			throw new Error(`Archive contains unsupported entry type ${type || 'NUL'}`);
		actualEntries += 1;
		if (actualEntries > maximumActualEntries)
			throw new Error('Archive actual entry limit exceeded');
		requireEmptyLinkName(header);
		if (type === '5' && size !== 0) throw new Error('Archive directory body must be empty');
		if (pending.gnuLongName && pending.paxPath) {
			const gnu = safeArchivePath(pending.gnuLongName.value);
			const pax = safeArchivePath(pending.paxPath.value);
			if (pending.gnuLongName.value !== pending.paxPath.value || gnu !== pax)
				throw new Error('GNU and PAX path metadata conflict');
		}
		const finalPath = safeArchivePath(
			pending.paxPath?.value ?? pending.gnuLongName?.value ?? rawPath,
		);
		pending = { metadataCount: 0 };
		if (allPaths.has(finalPath))
			throw new Error(`Duplicate normalized archive path: ${finalPath}`);
		allPaths.add(finalPath);
		if (type !== '5') {
			if (hasHiddenNestedArchive(finalPath))
				throw new Error(`Archive contains nested archive material: ${finalPath}`);
			const bytes = Buffer.from(tar.subarray(bodyStart, bodyEnd));
			files.push({
				path: finalPath,
				bytes,
				byteLength: bytes.byteLength,
				sha256: hashBytes(bytes),
			});
		}
		offset = nextOffset;
	}
	if (!ended) throw new Error('Archive lacks a complete tar terminator');
	if (!files.length) throw new Error('Archive contains no files');
	const roots = new Set(files.map((file) => file.path.split('/')[0]));
	if (roots.size !== 1) throw new Error('Archive does not have exactly one root');
	const root = [...roots][0];
	if (!root) throw new Error('Archive root is empty');
	const stripped = files
		.map((file) => ({ ...file, path: file.path.slice(root.length + 1) }))
		.sort((left, right) => left.path.localeCompare(right.path));
	if (stripped.some((file) => !file.path)) throw new Error('Archive root is also a file');
	const manifest = stripped.map(({ path: file, byteLength, sha256: digest }) => ({
		path: file,
		byteLength,
		sha256: digest,
	}));
	return {
		root,
		files: stripped,
		manifestSha256: hashBytes(`${JSON.stringify(manifest)}\n`),
		globalMetadata,
		pathMetadata,
	};
}

export function findArchiveFile(index: ArchiveIndex, file: string): ArchiveFile {
	const normalized = safeArchivePath(file);
	const found = index.files.find((entry) => entry.path === normalized);
	if (!found) throw new Error(`Required archive file is absent: ${file}`);
	return found;
}

export function requireOfficialTreeInventory(
	index: ArchiveIndex,
	officialFilePaths: readonly string[],
): void {
	const official = officialFilePaths
		.map(safeArchivePath)
		.sort((left, right) => left.localeCompare(right));
	const archive = index.files.map((file) => file.path);
	if (JSON.stringify(official) !== JSON.stringify(archive))
		throw new Error('Archive and official tree file inventories disagree');
}

export function inventoryLicensing(index: ArchiveIndex): readonly ArchiveFile[] {
	return index.files.filter((file) => {
		const lower = file.path.toLowerCase();
		const base = path.basename(lower);
		return (
			base.startsWith('license') ||
			base.startsWith('licence') ||
			base.startsWith('copying') ||
			base.startsWith('notice') ||
			base.includes('attribution') ||
			lower.includes('/vendor/') ||
			lower.includes('/generated/')
		);
	});
}

export function requireRootMitLicense(index: ArchiveIndex, licensePath: string): ArchiveFile {
	if (licensePath.includes('/')) throw new Error('MIT license must be at the archive root');
	const license = findArchiveFile(index, licensePath);
	const text = license.bytes.toString('utf8');
	if (
		!text.includes('MIT License') ||
		!text.includes('Permission is hereby granted, free of charge') ||
		!text.includes('THE SOFTWARE IS PROVIDED "AS IS"')
	)
		throw new Error('Root license is not exact MIT license text');
	return license;
}

export function classifyAssets(index: ArchiveIndex): readonly AssetClassification[] {
	return index.files
		.filter((file) => assetExtensions.has(path.extname(file.path).toLowerCase()))
		.map((file) => {
			const lower = file.path.toLowerCase();
			const ambiguous =
				lower.includes('logo') ||
				lower.includes('favicon') ||
				lower.includes('brand') ||
				lower.includes('avatar');
			return {
				path: file.path,
				sha256: file.sha256,
				classification: ambiguous ? ('excluded' as const) : ('unknown' as const),
				reason: ambiguous
					? 'Potential logo, favicon, brand, avatar, trademark, or attribution material is excluded.'
					: 'Root MIT text alone does not establish separate asset rights.',
			};
		})
		.sort((left, right) => left.path.localeCompare(right.path));
}

export function requireCompleteAssetClassifications(
	index: ArchiveIndex,
	classifications: readonly AssetClassification[],
): void {
	const expected = classifyAssets(index);
	if (JSON.stringify(expected) !== JSON.stringify(classifications))
		throw new Error('Asset classification is omitted, changed, reordered, or strengthened');
}

export function requirePortableJson(value: unknown): void {
	const serialized = JSON.stringify(value);
	if (serialized === undefined) throw new Error('Portable evidence must be JSON-serializable');
	const portableValue = JSON.parse(serialized) as unknown;
	assertSyntheticEvidence(portableValue);
	const isWindowsAbsolutePath = (candidate: string): boolean => {
		if (candidate.length < 3) return false;
		const drive = candidate.charCodeAt(0);
		return (
			((drive >= 65 && drive <= 90) || (drive >= 97 && drive <= 122)) &&
			candidate[1] === ':' &&
			(candidate[2] === '/' || candidate[2] === '\\')
		);
	};
	const containsParentTraversal = (candidate: string): boolean =>
		candidate
			.replaceAll('\\', '/')
			.split('/')
			.some((segment) => segment === '..');
	const inspect = (candidate: unknown): boolean => {
		if (typeof candidate === 'string') {
			return (
				candidate.startsWith('/') ||
				candidate.startsWith('\\\\') ||
				isWindowsAbsolutePath(candidate) ||
				parseURL(candidate).protocol === 'file:' ||
				containsParentTraversal(candidate)
			);
		}
		if (Array.isArray(candidate)) return candidate.some(inspect);
		if (candidate && typeof candidate === 'object')
			return Object.values(candidate).some(inspect);
		return false;
	};
	if (inspect(portableValue))
		throw new Error('Portable evidence contains a host-specific or unsafe path');
}

export function materializationPath(root: string, relativeFile: string): string {
	const normalized = safeArchivePath(relativeFile);
	const resolvedRoot = path.resolve(root);
	const destination = path.resolve(resolvedRoot, normalized);
	if (destination !== resolvedRoot && !destination.startsWith(`${resolvedRoot}/`))
		throw new Error('Materialization escapes content-addressed root');
	return destination;
}
