import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { access, cp, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import {
	TECHNICAL_EVALUATION_BOUNDARY,
	canonicalize,
	findArchiveFile,
	inspectNpmPackageTarball,
	indexTarGzip,
	parseNpmLockPlan,
	sha256,
	verifyNpmSri,
} from '../../../core/src/index.ts';
import {
	transformFuxaAngular14To15,
	transformFuxaAngular15To16,
} from '../../../frameworks/angular/src/index.ts';

export const FUXA_TARGET_CONSENT = 'T623-angular-fuxa-target-resolution-acquisition' as const;
export const FUXA_TARGET_REQUEST_LIMIT = 4_000;
export const FUXA_TARGET_RESPONSE_LIMIT = 128 * 1024 * 1024;
export const FUXA_TARGET_AGGREGATE_LIMIT = 3 * 1024 * 1024 * 1024;
export const FUXA_TARGET_LOCK_FLAGS = [
	'install',
	'--package-lock-only',
	'--offline',
	'--ignore-scripts',
	'--no-audit',
	'--no-fund',
	'--strict-peer-deps',
	'--lockfile-version=3',
] as const;
export const FUXA_TARGET_INSTALL_FLAGS = [
	'ci',
	'--offline',
	'--ignore-scripts',
	'--no-audit',
	'--no-fund',
	'--strict-peer-deps',
] as const;
const archiveSha256 = '4913aabfec74fc990664a5d60760d8f3438ee067b682f833f5869cd2c9c3c372';
const commit = '8b323c177615c0d152a54e5ef0a6f98dae7b8ff0';
const baselineDigest = '3b4394737cf44d7847a22a10282ebb0b9201d701f3d492dacf48f46d6d3e673d';
const root = path.resolve(import.meta.dirname, '../../../..');
const archivePath = path.join(
	root,
	`.versionless/cache/tier-f/angular-fuxa/${archiveSha256}/source.tar.gz`,
);
const baseline = path.join(root, `.versionless/cache/angular-fuxa-production/${baselineDigest}`);
const stage = path.join(root, '.versionless/cache/angular-fuxa-production/.stage-t623');
const evidenceRoot = path.join(root, 'evidence/dependencies/angular-fuxa/t623');
const receiptPath = path.join(evidenceRoot, 'target-receipt.json');
const failurePath = path.join(evidenceRoot, 'terminal-failure.json');
const node16 = path.join(root, '.versionless/cache/angular-phonecat/node16');
const require = createRequire(import.meta.url);
const semver = require(path.join(node16, 'lib/node_modules/npm/node_modules/semver')) as {
	maxSatisfying(versions: readonly string[], range: string): string | null;
};
const cacache = require(path.join(node16, 'lib/node_modules/npm/node_modules/cacache')) as {
	put(
		cache: string,
		key: string,
		bytes: Buffer,
		options: Record<string, unknown>,
	): Promise<unknown>;
};

type TargetManifests = Readonly<{ angular15: string; angular16: string }>;
type RequestRecord = Readonly<{
	ordinal: number;
	method: 'GET';
	url: string;
	status: number;
	byteLength: number;
	sha256: string;
	media: 'metadata' | 'tarball';
	responseCookieDiscarded: boolean;
}>;
type LockPair = ReturnType<typeof parseNpmLockPlan>['pairs'][number];
type TargetArtifact = Readonly<{
	url: string;
	integrity: string;
	sha256: string;
	byteLength: number;
	identities: LockPair['identities'];
	source: 't621-reuse' | 't623-acquired';
	metadata: ReturnType<typeof inspectNpmPackageTarball>;
}>;

function canonical(value: unknown): string {
	return `${canonicalize(value)}\n`;
}
function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}
function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`FUXA target ${label} must be an object`);
	return value as Record<string, unknown>;
}

export function assertFuxaTargetConsent(args: readonly string[]): void {
	if (
		args.length !== 2 ||
		args[0] !== '--consent' ||
		args[1] !== FUXA_TARGET_CONSENT ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== FUXA_TARGET_CONSENT
	)
		throw new Error('FUXA target ingest requires exact one-shot consent');
}

export function fuxaMetadataUrl(name: string): string {
	const validSegment = (value: string): boolean =>
		Boolean(value) &&
		[...value].every(
			(character) =>
				(character >= 'a' && character <= 'z') ||
				(character >= '0' && character <= '9') ||
				character === '-' ||
				character === '_' ||
				character === '.',
		);
	const segments = name.startsWith('@') ? name.slice(1).split('/') : [name];
	if (
		!name ||
		segments.length !== (name.startsWith('@') ? 2 : 1) ||
		!segments.every(validSegment)
	)
		throw new Error('FUXA target metadata name is invalid');
	const encoded = encodeURIComponent(name).replace('%40', '@');
	const url = `https://registry.npmjs.org/${encoded}`;
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== 'registry.npmjs.org' ||
		parsed.auth ||
		parsed.search ||
		parsed.hash ||
		parsed.pathname.split('/').filter(Boolean).length !== 1
	)
		throw new Error('FUXA target metadata URL is outside exact registry scope');
	return url;
}

async function sourceFiles(): Promise<Record<string, string>> {
	const bytes = await readFile(archivePath);
	if (sha256(bytes) !== archiveSha256) throw new Error('FUXA target immutable archive differs');
	const archive = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: archiveSha256 },
		commit,
	);
	const read = (file: string): string =>
		findArchiveFile(archive, `client/${file}`).bytes.toString('utf8');
	return {
		'package.json': read('package.json'),
		'angular.json': read('angular.json'),
		'src/app/editor/editor.component.ts': read('src/app/editor/editor.component.ts'),
		'src/app/editor/editor.component.html': read('src/app/editor/editor.component.html'),
	};
}

export function assertFuxaTargetAnchors(manifestText: string, lane: 15 | 16): void {
	const manifest = object(JSON.parse(manifestText), 'manifest');
	const dependencies = object(manifest.dependencies, 'dependencies');
	const development = object(manifest.devDependencies, 'devDependencies');
	const expected =
		lane === 15
			? {
					core: '15.2.3',
					cli: '15.2.6',
					eslint: '15.2.1',
					typescript: '4.8.4',
					zone: '0.12.0',
					typesNode: '18.15.11',
				}
			: {
					core: '16.2.11',
					cli: '16.2.8',
					eslint: '16.3.1',
					typescript: '5.1.6',
					zone: '0.13.3',
					typesNode: '18.15.11',
				};
	for (const name of ['@angular/core', '@angular/compiler', '@angular/material'])
		if (dependencies[name] !== expected.core)
			throw new Error(`FUXA Angular${lane} core/compiler/material anchor differs`);
	if (
		development['@angular/cli'] !== expected.cli ||
		development['@angular-devkit/build-angular'] !== expected.cli ||
		development['@angular-eslint/builder'] !== expected.eslint ||
		development.typescript !== expected.typescript ||
		dependencies['zone.js'] !== expected.zone ||
		development['@types/node'] !== expected.typesNode
	)
		throw new Error(`FUXA Angular${lane} CLI/ESLint/TypeScript/zone/types anchor differs`);
}

export async function frozenFuxaTargetManifests(): Promise<TargetManifests> {
	const files = await sourceFiles();
	const angular15 = transformFuxaAngular14To15(files);
	const angular16 = transformFuxaAngular15To16(angular15.files);
	assertFuxaTargetAnchors(angular15.files['package.json']!, 15);
	assertFuxaTargetAnchors(angular16.files['package.json']!, 16);
	return {
		angular15: angular15.files['package.json']!,
		angular16: angular16.files['package.json']!,
	};
}

function rootRequirements(manifestText: string): Array<{ name: string; range: string }> {
	const manifest = object(JSON.parse(manifestText), 'manifest');
	return ['dependencies', 'devDependencies'].flatMap((field) =>
		Object.entries(object(manifest[field], field)).map(([name, range]) => {
			if (typeof range !== 'string' || !range)
				throw new Error('FUXA target root dependency range differs');
			return { name, range };
		}),
	);
}

export function resolveMetadataVersion(
	metadata: unknown,
	name: string,
	range: string,
): Readonly<{ version: string; requirements: Array<{ name: string; range: string }> }> {
	const packument = object(metadata, `metadata ${name}`);
	if (packument.name !== name) throw new Error('FUXA target metadata package identity differs');
	const versions = object(packument.versions, `metadata versions ${name}`);
	const selected = semver.maxSatisfying(Object.keys(versions), range);
	if (!selected)
		throw new Error(`FUXA target metadata has no strict version for ${name}@${range}`);
	const manifest = object(versions[selected], `metadata manifest ${name}@${selected}`);
	if (manifest.name !== name || manifest.version !== selected)
		throw new Error('FUXA target selected metadata identity differs');
	const requirements: Array<{ name: string; range: string }> = [];
	for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
		if (manifest[field] === undefined) continue;
		for (const [dependency, dependencyRange] of Object.entries(
			object(manifest[field], field),
		)) {
			if (typeof dependencyRange !== 'string' || !dependencyRange)
				throw new Error('FUXA target transitive metadata range differs');
			requirements.push({ name: dependency, range: dependencyRange });
		}
	}
	return { version: selected, requirements };
}

async function run(command: string, args: readonly string[], cwd: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			env: {
				PATH: `${path.join(node16, 'bin')}:${process.env.PATH ?? ''}`,
				VERSIONLESS_NETWORK_MODE: 'offline',
				npm_config_offline: 'true',
				npm_config_ignore_scripts: 'true',
				npm_config_audit: 'false',
				npm_config_fund: 'false',
				npm_config_update_notifier: 'false',
			},
			stdio: ['ignore', 'ignore', 'pipe'],
		});
		const error: Buffer[] = [];
		child.stderr.on('data', (chunk: Buffer) => error.push(chunk));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolve()
				: reject(new Error(`strict-offline-npm-failed-${sha256(Buffer.concat(error))}`)),
		);
	});
}

async function boundedResponse(response: Response, aggregate: number): Promise<Buffer> {
	const declared = Number(response.headers.get('content-length'));
	if (
		Number.isFinite(declared) &&
		(declared < 0 ||
			declared > FUXA_TARGET_RESPONSE_LIMIT ||
			aggregate + declared > FUXA_TARGET_AGGREGATE_LIMIT)
	)
		throw new Error('target-byte-boundary-failed');
	if (!response.body) throw new Error('target-response-body-absent');
	const reader = response.body.getReader();
	const chunks: Buffer[] = [];
	let length = 0;
	while (true) {
		const item = await reader.read();
		if (item.done) break;
		length += item.value.byteLength;
		if (
			length > FUXA_TARGET_RESPONSE_LIMIT ||
			aggregate + length > FUXA_TARGET_AGGREGATE_LIMIT
		) {
			await reader.cancel();
			throw new Error('target-byte-boundary-failed');
		}
		chunks.push(Buffer.from(item.value));
	}
	return Buffer.concat(chunks, length);
}

async function getExact(
	url: string,
	media: 'metadata' | 'tarball',
	fetchImplementation: typeof fetch,
	ledger: RequestRecord[],
): Promise<Buffer> {
	if (ledger.length >= FUXA_TARGET_REQUEST_LIMIT) throw new Error('target-request-limit-failed');
	const response = await fetchImplementation(url, {
		method: 'GET',
		redirect: 'manual',
		credentials: 'omit',
		cache: 'no-store',
		headers: {
			accept: media === 'metadata' ? 'application/json' : 'application/octet-stream',
			'accept-encoding': 'identity',
			'user-agent': 'versionless-t623',
		},
	});
	if (response.status !== 200 || response.headers.has('location'))
		throw new Error('target-response-boundary-failed');
	const aggregate = ledger.reduce((sum, row) => sum + row.byteLength, 0);
	const bytes = await boundedResponse(response, aggregate);
	ledger.push({
		ordinal: ledger.length + 1,
		method: 'GET',
		url,
		status: 200,
		byteLength: bytes.byteLength,
		sha256: sha256(bytes),
		media,
		responseCookieDiscarded: response.headers.has('set-cookie'),
	});
	return bytes;
}

async function seedMetadata(
	manifests: TargetManifests,
	fetchImplementation: typeof fetch,
	ledger: RequestRecord[],
): Promise<void> {
	const queue = [
		...rootRequirements(manifests.angular15),
		...rootRequirements(manifests.angular16),
	];
	const metadata = new Map<string, unknown>();
	const traversed = new Set<string>();
	let aggregate = 0;
	while (queue.length) {
		const requirement = queue.shift()!;
		let value = metadata.get(requirement.name);
		if (!value) {
			if (ledger.length >= FUXA_TARGET_REQUEST_LIMIT)
				throw new Error('target-request-limit-failed');
			const url = fuxaMetadataUrl(requirement.name);
			const bytes = await getExact(url, 'metadata', fetchImplementation, ledger);
			aggregate += bytes.byteLength;
			value = JSON.parse(bytes.toString('utf8'));
			metadata.set(requirement.name, value);
			await cacache.put(
				path.join(stage, 'npm-cache/_cacache'),
				`make-fetch-happen:request-cache:${url}`,
				bytes,
				{
					metadata: {
						time: 0,
						url,
						reqHeaders: {},
						resHeaders: {
							'content-type': 'application/json',
							'content-length': String(bytes.byteLength),
						},
						options: { compress: false },
					},
				},
			);
		}
		const selected = resolveMetadataVersion(value, requirement.name, requirement.range);
		const key = `${requirement.name}\0${selected.version}`;
		if (traversed.has(key)) continue;
		traversed.add(key);
		queue.push(...selected.requirements);
	}
}

function pairKey(pair: Pick<LockPair, 'url' | 'integrity'>): string {
	return `${pair.url}\0${pair.integrity}`;
}

export function mergeFuxaTargetPairs(
	plans: readonly ReturnType<typeof parseNpmLockPlan>[],
): readonly LockPair[] {
	return [
		...new Map(
			plans.flatMap((plan) => plan.pairs).map((pair) => [pairKey(pair), pair]),
		).values(),
	].sort((left, right) => pairKey(left).localeCompare(pairKey(right)));
}

async function cacheTarball(pair: LockPair, bytes: Buffer): Promise<void> {
	await cacache.put(
		path.join(stage, 'npm-cache/_cacache'),
		`make-fetch-happen:request-cache:${pair.url}`,
		bytes,
		{
			integrity: pair.integrity,
			metadata: {
				time: 0,
				url: pair.url,
				reqHeaders: {},
				resHeaders: {
					'content-type': 'application/octet-stream',
					'content-length': String(bytes.byteLength),
				},
				options: { compress: false },
			},
		},
	);
}

async function acquireTargetArtifacts(
	pairs: readonly LockPair[],
	fetchImplementation: typeof fetch,
	ledger: RequestRecord[],
): Promise<TargetArtifact[]> {
	const closure = object(
		JSON.parse(await readFile(path.join(baseline, 'closure.json'), 'utf8')),
		'T621 closure',
	);
	if (!Array.isArray(closure.artifacts)) throw new Error('FUXA T621 artifact ledger differs');
	const reusable = new Map<string, Record<string, unknown>>(
		closure.artifacts.map((raw) => {
			const artifact = object(raw, 'T621 artifact');
			if (
				typeof artifact.url !== 'string' ||
				typeof artifact.integrity !== 'string' ||
				typeof artifact.sha256 !== 'string'
			)
				throw new Error('FUXA T621 reuse identity differs');
			return [`${artifact.url}\0${artifact.integrity}`, artifact] as const;
		}),
	);
	const artifacts: TargetArtifact[] = [];
	await mkdir(path.join(stage, 'tarballs'), { recursive: true });
	for (const pair of pairs) {
		const prior = reusable.get(pairKey(pair));
		let bytes: Buffer;
		let source: TargetArtifact['source'];
		if (prior) {
			bytes = await readFile(path.join(baseline, `tarballs/${String(prior.sha256)}.tgz`));
			if (sha256(bytes) !== prior.sha256) throw new Error('target-reuse-sha-identity-failed');
			verifyNpmSri(bytes, pair.integrity);
			source = 't621-reuse';
		} else {
			bytes = await getExact(pair.url, 'tarball', fetchImplementation, ledger);
			verifyNpmSri(bytes, pair.integrity);
			await writeFile(path.join(stage, `tarballs/${sha256(bytes)}.tgz`), bytes, {
				flag: 'wx',
			});
			await cacheTarball(pair, bytes);
			source = 't623-acquired';
		}
		const metadata = inspectNpmPackageTarball(bytes, pair.identities);
		artifacts.push({
			url: pair.url,
			integrity: pair.integrity,
			sha256: sha256(bytes),
			byteLength: bytes.byteLength,
			identities: pair.identities,
			source,
			metadata,
		});
	}
	return artifacts;
}

async function verifyOfflineClosure(directory: string, expectedLockSha256: string): Promise<void> {
	await run(
		path.join(node16, 'bin/npm'),
		[...FUXA_TARGET_INSTALL_FLAGS, '--cache', path.join(stage, 'npm-cache')],
		directory,
	);
	if (sha256(await readFile(path.join(directory, 'package-lock.json'))) !== expectedLockSha256)
		throw new Error('target-offline-install-mutated-lock');
	await rm(path.join(directory, 'node_modules'), { recursive: true, force: true });
}

async function generateLock(
	directory: string,
	manifest: string,
	priorLock: string,
): Promise<Buffer> {
	await mkdir(directory, { recursive: true });
	await writeFile(path.join(directory, 'package.json'), manifest, { flag: 'wx' });
	await cp(priorLock, path.join(directory, 'package-lock.json'));
	await run(
		path.join(node16, 'bin/npm'),
		[...FUXA_TARGET_LOCK_FLAGS, '--cache', path.join(stage, 'npm-cache')],
		directory,
	);
	return await readFile(path.join(directory, 'package-lock.json'));
}

export function fuxaTargetFailureCode(error: unknown): string {
	if (!(error instanceof Error)) return 'target-failed';
	if (error.message.startsWith('strict-offline-npm-failed-')) return 'strict-offline-npm-failed';
	const allowed = new Set([
		'target-request-limit-failed',
		'target-response-boundary-failed',
		'target-response-body-absent',
		'target-byte-boundary-failed',
		'target-reuse-sha-identity-failed',
		'target-offline-install-mutated-lock',
	]);
	return allowed.has(error.message) ||
		error.message.startsWith('target-anchor-completeness-failed-')
		? error.message
		: 'target-validation-failed';
}

export async function smokeFuxaTargetIngest(): Promise<Readonly<Record<string, unknown>>> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.VERSIONLESS_CONSENT_ID !== undefined
	)
		throw new Error('FUXA target smoke requires dual offline controls');
	const manifests = await frozenFuxaTargetManifests();
	if (
		sha256(await readFile(path.join(baseline, 'closure.json'))) !==
		'c04c00f0893774d441269d36df03dfbce57f83e3dfa07684bd2501aecbd50552'
	)
		throw new Error('FUXA T621 baseline closure differs');
	return {
		schemaVersion: 'versionless.angular-fuxa-t623-smoke.v1',
		result: 'ready',
		networkAttempts: 0,
		manifests: {
			angular15Sha256: sha256(manifests.angular15),
			angular16Sha256: sha256(manifests.angular16),
		},
		boundary: TECHNICAL_EVALUATION_BOUNDARY,
	};
}

export async function ingestFuxaTarget(
	fetchImplementation: typeof fetch = fetch,
): Promise<Readonly<Record<string, unknown>>> {
	if ((await exists(stage)) || (await exists(receiptPath)) || (await exists(failurePath)))
		throw new Error('FUXA T623 target or terminal already exists');
	const manifests = await frozenFuxaTargetManifests();
	await mkdir(path.join(stage, 'npm-cache'), { recursive: true });
	await mkdir(evidenceRoot, { recursive: true });
	const ledger: RequestRecord[] = [];
	let publication: string | undefined;
	try {
		await cp(path.join(baseline, 'npm-cache'), path.join(stage, 'npm-cache'), {
			recursive: true,
			force: false,
		});
		await seedMetadata(manifests, fetchImplementation, ledger);
		const archiveBytes = await readFile(archivePath);
		const source = indexTarGzip(
			{ bytes: archiveBytes, byteLength: archiveBytes.byteLength, sha256: archiveSha256 },
			commit,
		);
		const baselineLockPath = path.join(stage, 'baseline-lock.json');
		await writeFile(
			baselineLockPath,
			findArchiveFile(source, 'client/package-lock.json').bytes,
			{ flag: 'wx' },
		);
		const lock15 = await generateLock(
			path.join(stage, 'angular15'),
			manifests.angular15,
			baselineLockPath,
		);
		const lock16 = await generateLock(
			path.join(stage, 'angular16'),
			manifests.angular16,
			path.join(stage, 'angular15/package-lock.json'),
		);
		const plan15 = parseNpmLockPlan(lock15);
		const plan16 = parseNpmLockPlan(lock16);
		for (const [plan, lane] of [
			[plan15, 15],
			[plan16, 16],
		] as const) {
			if (
				plan.lockfileVersion !== 3 ||
				!plan.pairs.some((pair) =>
					pair.identities.some(
						(identity) =>
							identity.name === '@angular/core' &&
							identity.version === (lane === 15 ? '15.2.3' : '16.2.11'),
					),
				) ||
				!plan.pairs.some((pair) =>
					pair.identities.some(
						(identity) =>
							identity.name === '@angular/cli' &&
							identity.version === (lane === 15 ? '15.2.6' : '16.2.8'),
					),
				) ||
				!plan.pairs.some((pair) =>
					pair.identities.some(
						(identity) =>
							identity.name === '@angular-devkit/build-angular' &&
							identity.version === (lane === 15 ? '15.2.6' : '16.2.8'),
					),
				)
			)
				throw new Error(`target-anchor-completeness-failed-angular${lane}`);
		}
		const artifacts = await acquireTargetArtifacts(
			mergeFuxaTargetPairs([plan15, plan16]),
			fetchImplementation,
			ledger,
		);
		await verifyOfflineClosure(path.join(stage, 'angular15'), sha256(lock15));
		await verifyOfflineClosure(path.join(stage, 'angular16'), sha256(lock16));
		const receipt = {
			schemaVersion: 'versionless.angular-fuxa-t623-target-closure.v1',
			result: 'accepted',
			boundary: TECHNICAL_EVALUATION_BOUNDARY,
			consent: {
				id: FUXA_TARGET_CONSENT,
				status: 'closed',
				methods: ['GET'],
				requests: ledger.length,
				responseBytes: ledger.reduce((sum, row) => sum + row.byteLength, 0),
				maxRequests: FUXA_TARGET_REQUEST_LIMIT,
				maxResponseBytes: FUXA_TARGET_RESPONSE_LIMIT,
				maxAggregateBytes: FUXA_TARGET_AGGREGATE_LIMIT,
			},
			manifests: {
				angular15Sha256: sha256(manifests.angular15),
				angular16Sha256: sha256(manifests.angular16),
			},
			locks: {
				angular15Sha256: sha256(lock15),
				angular16Sha256: sha256(lock16),
				generator: {
					node: '16.20.2',
					npm: '8.19.4',
					offline: true,
					strictPeerDependencies: true,
					packageLockOnly: true,
				},
			},
			closure: {
				uniquePairs: artifacts.length,
				reused: artifacts.filter((item) => item.source === 't621-reuse').length,
				acquired: artifacts.filter((item) => item.source === 't623-acquired').length,
				artifacts,
			},
			requests: ledger,
			installVerification: {
				lanes: ['angular15', 'angular16'],
				networkAttempts: 0,
				ignoreScripts: true,
				lockUnchanged: true,
			},
			nonclaims: [
				'Local technical evaluation only; unresolved dependency and asset licenses remain unknown and require legal review. No redistribution, compliance, certification, enterprise adoption, authenticity, or OS-wide isolation claim.',
			],
		};
		await writeFile(path.join(stage, 'target-receipt.json'), canonical(receipt), {
			flag: 'wx',
		});
		const digest = sha256(canonical(receipt));
		publication = path.join(root, `.versionless/cache/angular-fuxa-production/t623/${digest}`);
		await mkdir(path.dirname(publication), { recursive: true });
		await rename(stage, publication);
		const handle = await open(receiptPath, 'wx');
		try {
			await handle.writeFile(
				canonical({
					...receipt,
					publication: {
						digest,
						relativePath: `.versionless/cache/angular-fuxa-production/t623/${digest}`,
					},
				}),
			);
		} finally {
			await handle.close();
		}
		return receipt;
	} catch (error) {
		await rm(stage, { recursive: true, force: true });
		if (publication) await rm(publication, { recursive: true, force: true });
		const receipt = {
			schemaVersion: 'versionless.angular-fuxa-t623-terminal-failure.v1',
			result: 'excluded',
			boundary: TECHNICAL_EVALUATION_BOUNDARY,
			consentId: FUXA_TARGET_CONSENT,
			requests: ledger.length,
			code: fuxaTargetFailureCode(error),
			retryAllowed: false,
			nonclaims: [
				'Technical evaluation only; unresolved licenses remain unknown and require legal review. No redistribution, compliance, certification, enterprise adoption, authenticity, or OS-wide isolation claim.',
			],
		};
		const handle = await open(failurePath, 'wx');
		try {
			await handle.writeFile(canonical(receipt));
		} finally {
			await handle.close();
		}
		throw error;
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length === 1 && args[0] === '--launcher-smoke')
		process.stdout.write(canonical(await smokeFuxaTargetIngest()));
	else {
		assertFuxaTargetConsent(args);
		process.stdout.write(canonical(await ingestFuxaTarget()));
	}
}

if (process.argv[1]?.endsWith('angular-fuxa-target-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
