export const TRUST_SCHEMA = 'versionless.trust.v1' as const;
export const TRUST_PURPOSE =
	'Generate the Versionless project trust package from OSV batch and CISA KEV inputs' as const;
export const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch' as const;
export const CISA_KEV_URL =
	'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json' as const;
export const MAX_VULNERABILITY_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type EvidenceState = 'verified' | 'unknown' | 'not-tested' | 'not-applicable' | 'stale';

export interface TrustSource {
	kind: 'osv-batch' | 'cisa-kev';
	url: string;
	method: 'GET' | 'POST';
	observedAt: string;
	requestSha256?: string;
	responsePath: string;
	sha256: string;
}

export interface TrustIngestRecord {
	schemaVersion: typeof TRUST_SCHEMA;
	purpose: typeof TRUST_PURPOSE;
	consent: { allowNetwork: true; mode: 'consented'; consentId: string };
	packages: PackageCoordinate[];
	sources: [TrustSource, TrustSource];
}

/**
 * A resolved package in the lockfile.
 *
 * Every entry is a registry coordinate and needs nothing but a name and a
 * version — the registry is what makes those two strings identify bytes. That
 * includes `@async/witness`, which used to be the one exception: it was
 * installed from a `pnpm pack` tarball committed under `vendor/`, and for that
 * one a name and a version identified nothing on their own, because no registry
 * would ever be asked to resolve them. `@async/witness@0.9.0` is published, the
 * manifest pins it exactly, and the vendored tarball is gone, so the inventory
 * carries it as the plain registry coordinate it now is.
 *
 * The non-registry shape below is kept rather than deleted, because the lockfile
 * decides which shape is used and nothing stops a future `file:` entry from
 * appearing; what it must not do is silently degrade to a name and a version.
 * So a non-registry coordinate carries what a registry would otherwise supply:
 * `kind: 'file'` says out loud that this is not a registry resolution,
 * `tarball` names the committed artifact as a repository-relative path, and
 * `sha256` digests it. The `file:` protocol prefix pnpm writes into the lockfile
 * is deliberately not carried: a protocol-prefixed specifier is a machine-local
 * instruction, and `assertPortableEvidence` refuses it in emitted evidence. The
 * path and the digest say the same thing without pretending to be a URL.
 */
export interface PackageCoordinate {
	name: string;
	version: string;
	/** Present only when the package is resolved from a committed tarball rather than a registry. */
	kind?: 'file';
	/** Repository-relative path to the committed tarball, with no protocol prefix. */
	tarball?: string;
	/** Digest of the committed tarball's bytes. */
	sha256?: string;
}

export function packageVersionWithoutPeerContext(version: string): string {
	const peerContext = version.indexOf('(');
	return peerContext === -1 ? version : version.slice(0, peerContext);
}

export interface ManifestArtifact {
	path: string;
	sha256: string;
}

export interface TrustManifest {
	schemaVersion: typeof TRUST_SCHEMA;
	canonicalDigest: string;
	integrity: {
		algorithm: 'sha256';
		authenticity: 'not-established';
		certification: 'not-claimed';
	};
	deterministicCore: { algorithm: 'sha256'; digest: string; artifacts: ManifestArtifact[] };
	receipts: Array<{ path: string; digest: string; artifacts: number; state: 'verified' }>;
	observation: {
		generatedAt: string;
		vulnerabilityFreshness: EvidenceState;
	};
	derivedReport: 'report.md';
}

export function asRecord(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Invalid ${label}`);
	return value as Record<string, unknown>;
}

export function asString(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0 || value.trim() !== value)
		throw new Error(`Invalid ${label}`);
	return value;
}

const absolutePosixPath = createRegExp(exactly('/').at.lineStart());
const absoluteWindowsPath = createRegExp(
	charIn('').from('A', 'Z').from('a', 'z').at.lineStart().and(':', charIn('/\\')),
);
const uncPath = createRegExp(exactly('\\\\').at.lineStart());
const fileUrl = createRegExp(exactly('file:').at.lineStart(), [caseInsensitive]);

function containsParentTraversal(value: string): boolean {
	return value.replaceAll('\\', '/').split('/').includes('..');
}

export function assertPortableEvidence(value: unknown, evidencePath = '$'): void {
	if (Array.isArray(value)) {
		value.forEach((item, index) => assertPortableEvidence(item, `${evidencePath}[${index}]`));
		return;
	}
	if (value !== null && typeof value === 'object') {
		for (const [key, child] of Object.entries(value)) {
			assertPortableEvidence(key, `${evidencePath}.<key>`);
			assertPortableEvidence(child, `${evidencePath}.${key}`);
		}
		return;
	}
	if (
		typeof value === 'string' &&
		(absolutePosixPath.test(value) ||
			absoluteWindowsPath.test(value) ||
			uncPath.test(value) ||
			fileUrl.test(value) ||
			containsParentTraversal(value))
	)
		throw new Error(`Non-portable evidence refused at ${evidencePath}`);
}

const packageNameStart = charIn('0123456789').from('a', 'z');
const packageNameRest = charIn('0123456789._~-').from('a', 'z').times.any();
const unscopedPackageName = createRegExp(
	packageNameStart.at.lineStart().and(packageNameRest).at.lineEnd(),
);
const scopedPackageName = createRegExp(
	exactly('@')
		.at.lineStart()
		.and(packageNameStart, packageNameRest, '/', packageNameStart, packageNameRest)
		.at.lineEnd(),
);
const packageVersion = createRegExp(
	digit.at
		.lineStart()
		.and(charIn('.+_-').from('0', '9').from('A', 'Z').from('a', 'z').times.any())
		.and(
			exactly('(')
				.and(oneOrMore(charNotIn('() \t\r\n')), ')')
				.times.any(),
		)
		.at.lineEnd(),
);
const sha256Hex = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);
/**
 * A committed tarball is named as `vendor/<file>.tgz` and nothing else: one
 * directory, one file name drawn from characters that cannot spell a protocol,
 * a parent traversal or an absolute path.
 */
const vendoredTarballPath = createRegExp(
	exactly('vendor/')
		.at.lineStart()
		.and(oneOrMore(charIn('0123456789._-').from('a', 'z').from('A', 'Z')), '.tgz')
		.at.lineEnd(),
);

export function validatePackageCoordinate(value: unknown, label: string): PackageCoordinate {
	const coordinate = asRecord(value, label);
	const name = asString(coordinate.name, `${label}.name`);
	const version = asString(coordinate.version, `${label}.version`);
	if (!(unscopedPackageName.test(name) || scopedPackageName.test(name)))
		throw new Error(`Invalid ${label}.name`);
	if (!packageVersion.test(version)) throw new Error(`Invalid ${label}.version`);
	if (coordinate.kind === undefined) {
		if (coordinate.tarball !== undefined || coordinate.sha256 !== undefined)
			throw new Error(`Invalid ${label}: a registry coordinate carries no tarball`);
		return { name, version };
	}
	if (coordinate.kind !== 'file')
		throw new Error(`Invalid ${label}.kind: only 'file' is a non-registry coordinate`);
	const tarball = asString(coordinate.tarball, `${label}.tarball`);
	const sha256 = asString(coordinate.sha256, `${label}.sha256`);
	if (!vendoredTarballPath.test(tarball)) throw new Error(`Invalid ${label}.tarball`);
	if (!sha256Hex.test(sha256)) throw new Error(`Invalid ${label}.sha256`);
	return { name, version, kind: 'file', tarball, sha256 };
}

export function validatePackageCoordinates(value: unknown, label: string): PackageCoordinate[] {
	if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
	const seen = new Set<string>();
	const coordinates = value.map((item, index) => {
		const coordinate = validatePackageCoordinate(item, `${label}[${index}]`);
		const key = `${coordinate.name}@${coordinate.version}`;
		if (seen.has(key)) throw new Error(`Duplicate ${label} coordinate: ${key}`);
		seen.add(key);
		return coordinate;
	});
	const sorted = [...coordinates].sort((a, b) =>
		`${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
	);
	if (JSON.stringify(coordinates) !== JSON.stringify(sorted))
		throw new Error(`${label} must be deterministically sorted`);
	return coordinates;
}

function isoTimestamp(value: unknown, label: string): string {
	const timestamp = asString(value, label);
	if (!Number.isFinite(Date.parse(timestamp)) || new Date(timestamp).toISOString() !== timestamp)
		throw new Error(`Invalid ${label}`);
	return timestamp;
}

function source(
	value: unknown,
	label: string,
	expected: {
		kind: TrustSource['kind'];
		url: string;
		method: TrustSource['method'];
		responsePath: string;
		requiresRequest: boolean;
	},
): TrustSource {
	const item = asRecord(value, label);
	if (
		item.kind !== expected.kind ||
		item.url !== expected.url ||
		item.method !== expected.method ||
		item.responsePath !== expected.responsePath ||
		!sha256Hex.test(String(item.sha256)) ||
		(expected.requiresRequest
			? !sha256Hex.test(String(item.requestSha256))
			: item.requestSha256 !== undefined)
	)
		throw new Error(`Invalid ${label} binding`);
	isoTimestamp(item.observedAt, `${label}.observedAt`);
	return value as TrustSource;
}

export function parseIngestRecord(value: unknown): TrustIngestRecord {
	const root = asRecord(value, 'trust ingest record');
	if (root.schemaVersion !== TRUST_SCHEMA || root.purpose !== TRUST_PURPOSE)
		throw new Error('Trust cache is not purpose-bound to this package');
	const consent = asRecord(root.consent, 'trust consent');
	if (
		consent.allowNetwork !== true ||
		consent.mode !== 'consented' ||
		typeof consent.consentId !== 'string' ||
		consent.consentId.trim() === '' ||
		consent.consentId.trim() !== consent.consentId
	)
		throw new Error('Trust cache lacks durable consent evidence');
	validatePackageCoordinates(root.packages, 'trust cache packages');
	if (!Array.isArray(root.sources) || root.sources.length !== 2)
		throw new Error('Trust cache is incomplete');
	source(root.sources[0], 'OSV source', {
		kind: 'osv-batch',
		url: OSV_BATCH_URL,
		method: 'POST',
		responsePath: 'osv.json',
		requiresRequest: true,
	});
	source(root.sources[1], 'CISA KEV source', {
		kind: 'cisa-kev',
		url: CISA_KEV_URL,
		method: 'GET',
		responsePath: 'cisa-kev.json',
		requiresRequest: false,
	});
	return value as TrustIngestRecord;
}
import {
	caseInsensitive,
	charIn,
	charNotIn,
	createRegExp,
	digit,
	exactly,
	oneOrMore,
} from 'magic-regexp';
