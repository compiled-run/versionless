import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { basename, join, resolve } from 'pathe';
import { parseURL } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const SQLPAD_CONSENT = 'T664-sqlpad-production-closure' as const;
export const SQLPAD_REVISION = '5c259dd7d3e6bdc0eb098bd32262263fe0280c6b' as const;
export const SQLPAD_TREE = 'f46239e3bec8098268a5e5a24a916b35a3aae3d5' as const;
export const SQLPAD_TARGET_PACKAGES = Object.freeze([
	Object.freeze({
		name: 'react',
		version: '18.3.1',
		url: 'https://registry.npmjs.org/react/-/react-18.3.1.tgz',
		integrity:
			'sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ==',
	}),
	Object.freeze({
		name: 'react-dom',
		version: '18.3.1',
		url: 'https://registry.npmjs.org/react-dom/-/react-dom-18.3.1.tgz',
		integrity:
			'sha512-5m4nQKp+rZRb09LNH59GM4BxTh9251/ylbKIbpe7TpGxfJ+9kv6BLkLBXIjjspbgbnIBNqlI23tRnTWT0snUIw==',
	}),
	Object.freeze({
		name: 'scheduler',
		version: '0.23.2',
		url: 'https://registry.npmjs.org/scheduler/-/scheduler-0.23.2.tgz',
		integrity:
			'sha512-UOShsPwz7NrMUqhR6t0hWjFduvOzbtv7toDH1/hIrfRNIDBnnBWd0CwJTGvTpngVlmwGCdP9/Zl/tVrDqcuYzQ==',
	}),
]);

const root = resolve(import.meta.dirname, '../../../..');
const sourceRoot = join(root, '.versionless/cache/react-sqlpad-v5-5-0-source/verify/extracted');
const cacheRoot = join(root, '.versionless/cache/react-sqlpad-v5-5-0-closure');
const cacheStage = join(root, '.versionless/cache/react-sqlpad-v5-5-0-closure-stage-t664');
const evidenceRoot = join(root, 'evidence/ingests/react-sqlpad-v5-5-0/t664');
const receiptPath = join(evidenceRoot, 'closure.json');
const attemptPath = join(evidenceRoot, 'attempt.json');
const responseLimit = 4_200;
const responseByteLimit = 32 * 1024 * 1024;
const aggregateByteLimit = 2 * 1024 * 1024 * 1024;
const requestTimeoutMilliseconds = 30_000;

type LockNode = {
	version?: unknown;
	resolved?: unknown;
	integrity?: unknown;
	dependencies?: unknown;
	bundled?: unknown;
};
export type SqlpadBundledPackage = {
	scope: string;
	path: string;
	name: string;
	version: string;
	parent: {
		name: string;
		version: string;
		url: string;
		integrity: string;
		placement: string;
	};
};
export type SqlpadClosureArtifact = {
	name: string;
	version: string;
	url: string;
	integrity: string;
	placements: string[];
	bundled: SqlpadBundledPackage[];
	mirror: string;
	sha256?: string;
	bytes?: number;
};
export type SqlpadClosureReceipt = {
	schemaVersion: 'versionless.react-sqlpad-v5-5-0-closure.v1';
	consentId: typeof SQLPAD_CONSENT;
	source: { revision: typeof SQLPAD_REVISION; tree: typeof SQLPAD_TREE };
	artifacts: SqlpadClosureArtifact[];
	targetArtifacts: SqlpadClosureArtifact[];
	transaction: {
		acceptedResponses: number;
		aggregateBytes: number;
		transportAttempts: Array<{
			url: string;
			attempt: number;
			outcome: 'accepted' | 'zero-response';
		}>;
		ledger: Array<{
			url: string;
			status: 200;
			bytes: number;
			sha256: string;
			integrity: string;
		}>;
	};
	constraints: {
		installScriptsExecuted: false;
		localTechnicalEvaluationOnly: true;
		legalReviewRequired: true;
		redistributionAuthorized: false;
	};
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;
const exists = (path: string): Promise<boolean> =>
	access(path).then(
		() => true,
		() => false,
	);

function integrityMatches(bytes: Uint8Array, integrity: string): boolean {
	const separator = integrity.indexOf('-');
	if (separator < 1 || integrity.indexOf(' ', separator) >= 0) return false;
	const algorithm = integrity.slice(0, separator);
	if (algorithm !== 'sha1' && algorithm !== 'sha512') return false;
	return createHash(algorithm).update(bytes).digest('base64') === integrity.slice(separator + 1);
}

export function assertSqlpadRegistryUrl(url: string): void {
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== 'registry.npmjs.org' ||
		parsed.auth ||
		parsed.search ||
		parsed.hash
	)
		throw new Error('SQLPad closure URL is outside literal consent');
}

function addLockNode(
	scope: string,
	name: string,
	value: unknown,
	placement: string,
	byUrl: Map<string, SqlpadClosureArtifact>,
	boundParent?: {
		artifact: SqlpadClosureArtifact;
		placement: string;
	},
): void {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`SQLPad lock node differs: ${scope}:${placement}`);
	const row = value as LockNode;
	if (row.bundled === true) {
		if (
			!boundParent ||
			typeof row.version !== 'string' ||
			row.version.length === 0 ||
			row.resolved !== undefined ||
			row.integrity !== undefined
		)
			throw new Error(`SQLPad bundled lock identity differs: ${scope}:${placement}`);
		boundParent.artifact.bundled.push({
			scope,
			path: placement,
			name,
			version: row.version,
			parent: {
				name: boundParent.artifact.name,
				version: boundParent.artifact.version,
				url: boundParent.artifact.url,
				integrity: boundParent.artifact.integrity,
				placement: boundParent.placement,
			},
		});
		if (row.dependencies !== undefined) {
			if (
				!row.dependencies ||
				typeof row.dependencies !== 'object' ||
				Array.isArray(row.dependencies)
			)
				throw new Error(`SQLPad bundled dependencies differ: ${scope}:${placement}`);
			for (const [childName, child] of Object.entries(
				row.dependencies as Record<string, unknown>,
			))
				addLockNode(
					scope,
					childName,
					child,
					`${placement}>${childName}`,
					byUrl,
					boundParent,
				);
		}
		return;
	}
	if (
		typeof row.version !== 'string' ||
		typeof row.resolved !== 'string' ||
		typeof row.integrity !== 'string' ||
		(!row.integrity.startsWith('sha1-') && !row.integrity.startsWith('sha512-'))
	)
		throw new Error(`SQLPad lock identity differs: ${scope}:${placement}`);
	assertSqlpadRegistryUrl(row.resolved);
	const scopedPlacement = `${scope}:${placement}`;
	const prior = byUrl.get(row.resolved);
	if (prior) {
		if (
			prior.name !== name ||
			prior.version !== row.version ||
			prior.integrity !== row.integrity
		)
			throw new Error('SQLPad duplicate lock identity conflicts');
		prior.placements.push(scopedPlacement);
	} else {
		byUrl.set(row.resolved, {
			name,
			version: row.version,
			url: row.resolved,
			integrity: row.integrity,
			placements: [scopedPlacement],
			bundled: [],
			mirror: `${sha256(row.resolved)}.tgz`,
		});
	}
	const current = byUrl.get(row.resolved);
	if (!current) throw new Error('SQLPad lock parent identity is absent');
	if (row.dependencies !== undefined) {
		if (
			!row.dependencies ||
			typeof row.dependencies !== 'object' ||
			Array.isArray(row.dependencies)
		)
			throw new Error(`SQLPad nested lock dependencies differ: ${scope}:${placement}`);
		for (const [childName, child] of Object.entries(
			row.dependencies as Record<string, unknown>,
		))
			addLockNode(scope, childName, child, `${placement}>${childName}`, byUrl, {
				artifact: current,
				placement: scopedPlacement,
			});
	}
}

export function analyzeSqlpadLocks(locks: Array<{ scope: string; value: unknown }>): {
	artifacts: SqlpadClosureArtifact[];
	placements: number;
	digest: string;
} {
	const byUrl = new Map<string, SqlpadClosureArtifact>();
	for (const { scope, value } of locks) {
		if (!value || typeof value !== 'object' || Array.isArray(value))
			throw new Error(`SQLPad ${scope} lock must be an object`);
		const lock = value as { lockfileVersion?: unknown; dependencies?: unknown };
		if (
			lock.lockfileVersion !== 1 ||
			!lock.dependencies ||
			typeof lock.dependencies !== 'object' ||
			Array.isArray(lock.dependencies)
		)
			throw new Error(`SQLPad ${scope} requires committed npm lock v1`);
		for (const [name, row] of Object.entries(lock.dependencies as Record<string, unknown>))
			addLockNode(scope, name, row, name, byUrl);
	}
	const artifacts = [...byUrl.values()]
		.map((artifact) => ({
			...artifact,
			placements: artifact.placements.sort(compareText),
			bundled: artifact.bundled.sort((left, right) => compareText(left.path, right.path)),
		}))
		.sort((left, right) => compareText(left.url, right.url));
	const placements = artifacts.reduce((total, artifact) => total + artifact.placements.length, 0);
	if (artifacts.length < 1_000 || artifacts.length > responseLimit - 3 || placements < 2_500)
		throw new Error('SQLPad lock closure cardinality differs');
	return { artifacts, placements, digest: sha256(canonicalize(artifacts)) };
}

export function parseSqlpadIngestLauncher(args: string[]): 'acquire' | 'verify' | 'launcher-smoke' {
	if (
		args.length !== 3 ||
		args[1] !== '--consent-id' ||
		args[2] !== SQLPAD_CONSENT ||
		!['--acquire', '--verify', '--launcher-smoke'].includes(args[0] ?? '')
	)
		throw new Error('SQLPad ingest launcher arguments differ');
	if (args[0] === '--acquire') {
		if (
			process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
			process.env.VERSIONLESS_CONSENT_ID !== SQLPAD_CONSENT
		)
			throw new Error('SQLPad acquisition requires exact purpose-bound consent');
		return 'acquire';
	}
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.VERSIONLESS_CONSENT_ID !== undefined
	)
		throw new Error('SQLPad verification requires strict offline controls');
	return args[0] === '--verify' ? 'verify' : 'launcher-smoke';
}

async function lockedClosure(): Promise<ReturnType<typeof analyzeSqlpadLocks>> {
	return analyzeSqlpadLocks(
		await Promise.all(
			[
				['root', 'package-lock.json'],
				['client', 'client/package-lock.json'],
				['server', 'server/package-lock.json'],
			].map(async ([scope, path]) => ({
				scope: scope!,
				value: JSON.parse(await readFile(join(sourceRoot, path!), 'utf8')) as unknown,
			})),
		),
	);
}

type NetworkState = SqlpadClosureReceipt['transaction'];

async function getExact(
	artifact: Pick<SqlpadClosureArtifact, 'url' | 'integrity'>,
	state: NetworkState,
): Promise<Buffer> {
	assertSqlpadRegistryUrl(artifact.url);
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await new Promise((resolvePromise, reject) => {
				let observedResponse = false;
				const call = request(
					artifact.url,
					{
						method: 'GET',
						headers: {
							accept: 'application/octet-stream',
							'accept-encoding': 'identity',
							'user-agent': 'versionless-t661',
						},
					},
					(response) => {
						observedResponse = true;
						state.transportAttempts.push({
							url: artifact.url,
							attempt,
							outcome: 'accepted',
						});
						if (
							response.statusCode !== 200 ||
							response.headers.location !== undefined ||
							(response.headers['content-encoding'] ?? 'identity') !== 'identity'
						) {
							response.destroy();
							reject(
								new Error(
									`SQLPad accepted response boundary differs: ${artifact.url}`,
								),
							);
							return;
						}
						const chunks: Buffer[] = [];
						let bytes = 0;
						response.on('data', (chunk: Buffer) => {
							bytes += chunk.byteLength;
							if (
								bytes > responseByteLimit ||
								state.aggregateBytes + bytes > aggregateByteLimit
							)
								response.destroy(new Error('SQLPad acquisition byte cap exceeded'));
							else chunks.push(Buffer.from(chunk));
						});
						response.once('error', reject);
						response.once('end', () => {
							const body = Buffer.concat(chunks, bytes);
							if (!integrityMatches(body, artifact.integrity)) {
								reject(
									new Error(`SQLPad tarball integrity differs: ${artifact.url}`),
								);
								return;
							}
							state.acceptedResponses += 1;
							state.aggregateBytes += bytes;
							state.ledger.push({
								url: artifact.url,
								status: 200,
								bytes,
								sha256: sha256(body),
								integrity: artifact.integrity,
							});
							resolvePromise(body);
						});
					},
				);
				call.setTimeout(requestTimeoutMilliseconds, () =>
					call.destroy(new Error('SQLPad zero-response request timeout')),
				);
				call.once('error', (error) => {
					if (!observedResponse) {
						state.transportAttempts.push({
							url: artifact.url,
							attempt,
							outcome: 'zero-response',
						});
						const wrapped = new Error(error.message);
						Object.assign(wrapped, { zeroResponse: true });
						reject(wrapped);
					} else reject(error);
				});
				call.end();
			});
		} catch (error) {
			if (!(error instanceof Error) || !('zeroResponse' in error) || attempt === 3)
				throw error;
		}
	}
	throw new Error('SQLPad transport attempts exhausted');
}

function targetArtifacts(): SqlpadClosureArtifact[] {
	return SQLPAD_TARGET_PACKAGES.map((artifact) => ({
		name: artifact.name,
		version: artifact.version,
		url: artifact.url,
		integrity: artifact.integrity,
		placements: [`client:${artifact.name}`],
		bundled: [],
		mirror: `${sha256(artifact.url)}.tgz`,
	}));
}

export async function acquireSqlpadClosure(): Promise<void> {
	if ((await exists(cacheRoot)) || (await exists(cacheStage)) || (await exists(receiptPath)))
		throw new Error('SQLPad closure transaction target already exists');
	const closure = await lockedClosure();
	const targets = targetArtifacts();
	if (closure.artifacts.length + targets.length > responseLimit)
		throw new Error('SQLPad response cap would be exceeded');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${JSON.stringify(
			{
				schemaVersion: 'versionless.react-sqlpad-v5-5-0-closure-attempt.v1',
				consentId: SQLPAD_CONSENT,
				result: 'started',
				artifacts: closure.artifacts.length,
				placements: closure.placements,
				caps: { responseLimit, responseByteLimit, aggregateByteLimit },
			},
			null,
			2,
		)}\n`,
	);
	await mkdir(join(cacheStage, 'mirror'), { recursive: true });
	const transaction: NetworkState = {
		acceptedResponses: 0,
		aggregateBytes: 0,
		transportAttempts: [],
		ledger: [],
	};
	try {
		for (const artifact of [...closure.artifacts, ...targets]) {
			const bytes = await getExact(artifact, transaction);
			artifact.sha256 = sha256(bytes);
			artifact.bytes = bytes.byteLength;
			await writeFile(join(cacheStage, 'mirror', artifact.mirror), bytes);
		}
		const unsigned = {
			schemaVersion: 'versionless.react-sqlpad-v5-5-0-closure.v1' as const,
			consentId: SQLPAD_CONSENT,
			source: { revision: SQLPAD_REVISION, tree: SQLPAD_TREE },
			artifacts: closure.artifacts,
			targetArtifacts: targets,
			transaction,
			constraints: {
				installScriptsExecuted: false as const,
				localTechnicalEvaluationOnly: true as const,
				legalReviewRequired: true as const,
				redistributionAuthorized: false as const,
			},
		};
		const receipt: SqlpadClosureReceipt = {
			...unsigned,
			integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(unsigned)) },
		};
		await writeFile(join(cacheStage, 'closure.json'), `${canonicalize(receipt)}\n`);
		await rename(cacheStage, cacheRoot);
		await writeFile(receiptPath, `${canonicalize(receipt)}\n`);
	} catch (error) {
		await writeFile(
			join(evidenceRoot, 'consumed-failed.json'),
			`${canonicalize({
				schemaVersion: 'versionless.react-sqlpad-v5-5-0-closure-failure.v1',
				consentId: SQLPAD_CONSENT,
				result: 'terminal-failure',
				transaction,
				error: error instanceof Error ? error.message : String(error),
			})}\n`,
		);
		throw error;
	}
}

export async function verifySqlpadClosure(): Promise<{
	valid: true;
	artifacts: number;
	digest: string;
}> {
	const published = JSON.parse(await readFile(receiptPath, 'utf8')) as SqlpadClosureReceipt;
	const cached = JSON.parse(
		await readFile(join(cacheRoot, 'closure.json'), 'utf8'),
	) as SqlpadClosureReceipt;
	if (canonicalize(published) !== canonicalize(cached))
		throw new Error('SQLPad closure publication differs');
	const { integrity, ...unsigned } = published;
	if (
		published.schemaVersion !== 'versionless.react-sqlpad-v5-5-0-closure.v1' ||
		published.consentId !== SQLPAD_CONSENT ||
		published.source.revision !== SQLPAD_REVISION ||
		published.source.tree !== SQLPAD_TREE ||
		published.transaction.acceptedResponses !==
			published.artifacts.length + published.targetArtifacts.length ||
		integrity.canonicalDigest !== sha256(canonicalize(unsigned))
	)
		throw new Error('SQLPad closure receipt differs');
	for (const artifact of [...published.artifacts, ...published.targetArtifacts]) {
		const bytes = await readFile(join(cacheRoot, 'mirror', artifact.mirror));
		if (
			bytes.byteLength !== artifact.bytes ||
			sha256(bytes) !== artifact.sha256 ||
			!integrityMatches(bytes, artifact.integrity)
		)
			throw new Error(
				`SQLPad offline artifact differs: ${artifact.name}@${artifact.version}`,
			);
	}
	const mirrorEntries = (await readdir(join(cacheRoot, 'mirror'))).sort(compareText);
	if (mirrorEntries.length !== published.artifacts.length + published.targetArtifacts.length)
		throw new Error('SQLPad closure mirror cardinality differs');
	return {
		valid: true,
		artifacts: published.artifacts.length + published.targetArtifacts.length,
		digest: integrity.canonicalDigest,
	};
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const mode = parseSqlpadIngestLauncher(args);
	if (mode === 'acquire') await acquireSqlpadClosure();
	if (mode !== 'launcher-smoke')
		process.stdout.write(`${canonicalize(await verifySqlpadClosure())}\n`);
}

if (basename(process.argv[1] ?? '') === 'react-sqlpad-v5-5-0-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
