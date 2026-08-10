import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { access, cp, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import {
	canonicalize,
	indexTarGzip,
	inspectNpmPackageTarball,
	parseNpmLockPlan,
	sha256,
	verifyNpmSri,
	type NpmLockPair,
} from '../../../core/src/index.ts';
import { ANGULAR_CONTACTS_TECHNICAL_BOUNDARY } from '../../../core/src/receipts/angular-contacts-angular9-to16.ts';
import {
	applyAngularContactsCompatibilityOverlay,
	migrateAngularContactsMajor,
	type AngularContactsMajor,
} from '../../../frameworks/angular/src/angular-contacts-9-to-16.ts';

export const ANGULAR_CONTACTS_CONSENT =
	'T625-angular-contacts-native-compat-production-acquisition' as const;
export const ANGULAR_CONTACTS_REQUEST_LIMIT = 6_500;
export const ANGULAR_CONTACTS_ATTEMPT_LIMIT = 9_000;
export const ANGULAR_CONTACTS_RESPONSE_LIMIT = 32 * 1024 * 1024;
export const ANGULAR_CONTACTS_AGGREGATE_LIMIT = 4 * 1024 * 1024 * 1024;
export const ANGULAR_CONTACTS_LOCK_FLAGS = [
	'install',
	'--package-lock-only',
	'--offline',
	'--ignore-scripts',
	'--no-audit',
	'--no-fund',
	'--strict-peer-deps',
	'--lockfile-version=3',
] as const;
const archiveSha256 = '93b2add6bbda402b86769b39a50cc4cae9050c363619ce3b5f20e8f7cd2f42f0';
const commit = '875aa2df7f5f87b6731a1259b63e2b399fa5fb3f';
const lockSha256 = 'd23b1a49b210c9b397194747f1a2a7d0032438e7277d710400fdabb6d8a2bb74';
const root = path.resolve(import.meta.dirname, '../../../..');
const archivePath = path.join(
	root,
	`.versionless/cache/tier-f/angular-contacts/${archiveSha256}/source.tar.gz`,
);
const stage = path.join(root, '.versionless/cache/angular-contacts-production/.stage-t625');
const publicationRoot = path.join(root, '.versionless/cache/angular-contacts-production/closures');
const evidenceRoot = path.join(root, 'evidence/dependencies/angular-contacts/t625');
const receiptPath = path.join(evidenceRoot, 'receipt.json');
const terminalPath = path.join(evidenceRoot, 'terminal.json');
const node16 = path.join(root, '.versionless/cache/angular-phonecat/node16');
const node18Closure = path.join(
	root,
	'.versionless/cache/angular-realworld-v15/closures/d3576ef3443079903aa0fa2c2337fbf8fcab88fdfeea3ff5b8de03e99587b8f9',
);
const require = createRequire(import.meta.url);
const cacache = require(path.join(node16, 'lib/node_modules/npm/node_modules/cacache')) as {
	get(cache: string, key: string): Promise<{ data: Buffer }>;
	put(
		cache: string,
		key: string,
		bytes: Buffer,
		options: Record<string, unknown>,
	): Promise<unknown>;
};
const semver = require(path.join(node16, 'lib/node_modules/npm/node_modules/semver')) as {
	maxSatisfying(versions: readonly string[], range: string): string | null;
};

type Ledger = Readonly<{
	ordinal: number;
	attempt: number;
	method: 'GET';
	url: string;
	status: 200;
	byteLength: number;
	sha256: string;
	media: 'metadata' | 'tarball';
	responseCookieDiscarded: boolean;
}>;
type Lane = Readonly<{ major: AngularContactsMajor; files: Readonly<Record<string, string>> }>;
type State = { attempts: number; aggregate: number; ledger: Ledger[] };

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
		throw new Error(`Angular Contacts ${label} must be an object`);
	return value as Record<string, unknown>;
}

export function assertAngularContactsConsent(args: readonly string[]): void {
	if (
		args.length !== 2 ||
		args[0] !== '--consent-id' ||
		args[1] !== ANGULAR_CONTACTS_CONSENT ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== ANGULAR_CONTACTS_CONSENT
	)
		throw new Error('Angular Contacts ingest requires exact one-shot consent');
}

function validSegment(value: string): boolean {
	return (
		Boolean(value) &&
		[...value].every(
			(character) =>
				(character >= 'a' && character <= 'z') ||
				(character >= '0' && character <= '9') ||
				character === '-' ||
				character === '_' ||
				character === '.',
		)
	);
}

export function angularContactsMetadataUrl(name: string): string {
	const segments = name.startsWith('@') ? name.slice(1).split('/') : [name];
	if (
		!name ||
		segments.length !== (name.startsWith('@') ? 2 : 1) ||
		!segments.every(validSegment)
	)
		throw new Error('Angular Contacts metadata package name is invalid');
	const url = `https://registry.npmjs.org/${encodeURIComponent(name).replace('%40', '@')}`;
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== 'registry.npmjs.org' ||
		parsed.auth ||
		parsed.search ||
		parsed.hash ||
		parsed.pathname.split('/').filter(Boolean).length !== 1
	)
		throw new Error('Angular Contacts metadata URL is outside registry scope');
	return url;
}

export function normalizeAngularContactsRequirement(
	name: string,
	range: string,
): { name: string; range: string } | null {
	if (!range.startsWith('npm:')) return { name, range };
	const alias = range.slice(4);
	const separator = alias.lastIndexOf('@');
	if (separator < 1) return null;
	return { name: alias.slice(0, separator), range: alias.slice(separator + 1) };
}

export function angularContactsRequestInit(media: 'metadata' | 'tarball'): RequestInit {
	return {
		method: 'GET',
		redirect: 'manual',
		credentials: 'omit',
		cache: 'no-store',
		headers: {
			accept: media === 'metadata' ? 'application/json' : 'application/octet-stream',
			'accept-encoding': 'identity',
			'user-agent': 'versionless-t625',
		},
	};
}

export async function readAngularContactsBoundedResponse(
	response: Response,
	aggregate: number,
): Promise<Buffer> {
	if (!response.body) throw new Error('contacts-response-body-absent');
	const declared = Number(response.headers.get('content-length'));
	if (
		Number.isFinite(declared) &&
		(declared < 0 ||
			declared > ANGULAR_CONTACTS_RESPONSE_LIMIT ||
			aggregate + declared > ANGULAR_CONTACTS_AGGREGATE_LIMIT)
	)
		throw new Error('contacts-byte-boundary-failed');
	const reader = response.body.getReader();
	const chunks: Buffer[] = [];
	let length = 0;
	while (true) {
		const item = await reader.read();
		if (item.done) break;
		length += item.value.byteLength;
		if (
			length > ANGULAR_CONTACTS_RESPONSE_LIMIT ||
			aggregate + length > ANGULAR_CONTACTS_AGGREGATE_LIMIT
		) {
			await reader.cancel();
			throw new Error('contacts-byte-boundary-failed');
		}
		chunks.push(Buffer.from(item.value));
	}
	if (Number.isFinite(declared) && declared !== length)
		throw new Error('contacts-response-truncated');
	return Buffer.concat(chunks, length);
}

async function getExact(
	url: string,
	media: 'metadata' | 'tarball',
	state: State,
	fetchImplementation: typeof fetch,
): Promise<Buffer> {
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== 'registry.npmjs.org' ||
		parsed.auth ||
		parsed.search ||
		parsed.hash ||
		(media === 'tarball' && !parsed.pathname.endsWith('.tgz'))
	)
		throw new Error('contacts-request-scope-failed');
	let last: unknown;
	for (let retry = 0; retry < 2; retry += 1) {
		if (
			state.attempts >= ANGULAR_CONTACTS_ATTEMPT_LIMIT ||
			state.ledger.length >= ANGULAR_CONTACTS_REQUEST_LIMIT
		)
			throw new Error('contacts-request-boundary-failed');
		state.attempts += 1;
		let response: Response;
		try {
			response = await fetchImplementation(url, angularContactsRequestInit(media));
		} catch (error) {
			last = error;
			continue;
		}
		if (
			response.status !== 200 ||
			response.headers.has('location') ||
			(response.headers.get('content-encoding') ?? 'identity') !== 'identity'
		)
			throw new Error('contacts-response-boundary-failed');
		const bytes = await readAngularContactsBoundedResponse(response, state.aggregate);
		state.aggregate += bytes.byteLength;
		state.ledger.push({
			ordinal: state.ledger.length + 1,
			attempt: state.attempts,
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
	throw new Error(`contacts-zero-response-retry-exhausted-${sha256(String(last))}`);
}

export async function probeAngularContactsTransport(
	url: string,
	media: 'metadata' | 'tarball',
	fetchImplementation: typeof fetch,
): Promise<Record<string, unknown>> {
	const state: State = { attempts: 0, aggregate: 0, ledger: [] };
	const bytes = await getExact(url, media, state, fetchImplementation);
	return {
		attempts: state.attempts,
		accepted: state.ledger.length,
		responseBytes: state.aggregate,
		sha256: sha256(bytes),
	};
}

async function immutableFiles(): Promise<{ files: Record<string, string>; lock: Buffer }> {
	const bytes = await readFile(archivePath);
	if (sha256(bytes) !== archiveSha256 || bytes.byteLength !== 168_794)
		throw new Error('Angular Contacts immutable archive differs');
	const archive = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: archiveSha256 },
		commit,
	);
	if (
		archive.manifestSha256 !==
			'e2cfaa622619c38005cc087a40c9103c8b962e7290f945f7797b9ae7860a8167' ||
		archive.files.length !== 108
	)
		throw new Error('Angular Contacts immutable manifest differs');
	const lock = archive.files.find((file) => file.path === 'package-lock.json')?.bytes;
	if (!lock || sha256(lock) !== lockSha256)
		throw new Error('Angular Contacts immutable lock differs');
	return {
		files: Object.fromEntries(
			archive.files.map((file) => [file.path, file.bytes.toString('utf8')]),
		),
		lock,
	};
}

export async function frozenAngularContactsLanes(): Promise<readonly Lane[]> {
	const source = await immutableFiles();
	let files = applyAngularContactsCompatibilityOverlay(source.files).files;
	const lanes: Lane[] = [{ major: 9, files }];
	for (let major = 10; major <= 16; major += 1) {
		files = migrateAngularContactsMajor(
			files,
			(major - 1) as AngularContactsMajor,
			major as AngularContactsMajor,
		).files;
		lanes.push({ major: major as AngularContactsMajor, files });
	}
	return lanes;
}

function requirements(manifestText: string): Array<{ name: string; range: string }> {
	const manifest = object(JSON.parse(manifestText), 'manifest');
	return ['dependencies', 'devDependencies'].flatMap((field) =>
		Object.entries(object(manifest[field], field)).map(([name, range]) => ({
			name,
			range: String(range),
		})),
	);
}

export function resolveAngularContactsMetadata(
	metadata: unknown,
	name: string,
	range: string,
): { version: string; requirements: Array<{ name: string; range: string }> } {
	const packument = object(metadata, `metadata ${name}`);
	if (packument.name !== name) throw new Error('Angular Contacts metadata identity differs');
	const versions = object(packument.versions, 'metadata versions');
	const tags =
		packument['dist-tags'] === undefined ? {} : object(packument['dist-tags'], 'dist tags');
	const selected =
		typeof tags[range] === 'string'
			? String(tags[range])
			: semver.maxSatisfying(Object.keys(versions), range);
	if (!selected) throw new Error(`contacts-target-resolution-failed-${name}`);
	const manifest = object(versions[selected], 'metadata manifest');
	if (manifest.name !== name || manifest.version !== selected)
		throw new Error('Angular Contacts selected metadata identity differs');
	const nested: Array<{ name: string; range: string }> = [];
	for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
		if (manifest[field] === undefined) continue;
		for (const [dependency, dependencyRange] of Object.entries(
			object(manifest[field], field),
		)) {
			const normalized = normalizeAngularContactsRequirement(
				dependency,
				String(dependencyRange),
			);
			if (normalized) nested.push(normalized);
		}
	}
	return { version: selected, requirements: nested };
}

async function cachePut(url: string, bytes: Buffer, integrity?: string): Promise<void> {
	await cacache.put(
		path.join(stage, 'npm-cache/_cacache'),
		`make-fetch-happen:request-cache:${url}`,
		bytes,
		{
			...(integrity ? { integrity } : {}),
			metadata: {
				time: 0,
				url,
				reqHeaders: {},
				resHeaders: {
					'content-type': integrity ? 'application/octet-stream' : 'application/json',
					'content-length': String(bytes.byteLength),
				},
				options: { compress: false },
			},
		},
	);
}

async function seedMetadata(
	lanes: readonly Lane[],
	state: State,
	fetchImplementation: typeof fetch,
): Promise<void> {
	const queue = lanes.flatMap((lane) => requirements(lane.files['package.json']!));
	const metadata = new Map<string, unknown>();
	const traversed = new Set<string>();
	while (queue.length) {
		const requirement = normalizeAngularContactsRequirement(
			queue[0]!.name,
			queue.shift()!.range,
		);
		if (!requirement) continue;
		let value = metadata.get(requirement.name);
		if (!value) {
			const url = angularContactsMetadataUrl(requirement.name);
			const bytes = await getExact(url, 'metadata', state, fetchImplementation);
			value = JSON.parse(bytes.toString('utf8'));
			metadata.set(requirement.name, value);
			await cachePut(url, bytes);
		}
		const selected = resolveAngularContactsMetadata(value, requirement.name, requirement.range);
		const key = `${requirement.name}\0${selected.version}`;
		if (!traversed.has(key)) {
			traversed.add(key);
			queue.push(...selected.requirements);
		}
	}
}

async function run(
	command: string,
	args: readonly string[],
	cwd: string,
	runtime = node16,
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			env: {
				PATH: `${path.join(runtime, 'bin')}:${process.env.PATH ?? ''}`,
				VERSIONLESS_NETWORK_MODE: 'offline',
				npm_config_offline: 'true',
				npm_config_ignore_scripts: 'true',
				npm_config_audit: 'false',
				npm_config_fund: 'false',
			},
			stdio: ['ignore', 'ignore', 'pipe'],
		});
		const errors: Buffer[] = [];
		child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolve()
				: reject(
						new Error(
							`contacts-strict-offline-npm-failed-${sha256(Buffer.concat(errors))}`,
						),
					),
		);
	});
}

async function generateLocks(
	lanes: readonly Lane[],
	baselineLock: Buffer,
): Promise<Map<AngularContactsMajor, Buffer>> {
	const locks = new Map<AngularContactsMajor, Buffer>([[9, baselineLock]]);
	let prior = path.join(stage, 'baseline-package-lock.json');
	await writeFile(prior, baselineLock, { flag: 'wx' });
	for (const lane of lanes.slice(1)) {
		const directory = path.join(stage, `lanes/angular${lane.major}`);
		await mkdir(directory, { recursive: true });
		await writeFile(path.join(directory, 'package.json'), lane.files['package.json']!, {
			flag: 'wx',
		});
		await cp(prior, path.join(directory, 'package-lock.json'));
		await run(
			path.join(node16, 'bin/npm'),
			[...ANGULAR_CONTACTS_LOCK_FLAGS, '--cache', path.join(stage, 'npm-cache')],
			directory,
		);
		const lock = await readFile(path.join(directory, 'package-lock.json'));
		const plan = parseNpmLockPlan(lock);
		const manifest = JSON.parse(lane.files['package.json']!) as {
			dependencies: Record<string, string>;
			devDependencies: Record<string, string>;
		};
		for (const [name, version] of [
			['@angular/core', manifest.dependencies['@angular/core']],
			['@angular/cli', manifest.devDependencies['@angular/cli']],
			[
				'@angular-devkit/build-angular',
				manifest.devDependencies['@angular-devkit/build-angular'],
			],
		] as const)
			if (
				!plan.pairs.some((pair) =>
					pair.identities.some(
						(identity) => identity.name === name && identity.version === version,
					),
				)
			)
				throw new Error(`contacts-target-anchor-failed-angular${lane.major}`);
		locks.set(lane.major, lock);
		prior = path.join(directory, 'package-lock.json');
	}
	return locks;
}

const reuseCaches = [
	path.join(root, '.versionless/cache/angular-phonecat/npm-cache'),
	path.join(
		root,
		'.versionless/cache/angular-fuxa-production/3b4394737cf44d7847a22a10282ebb0b9201d701f3d492dacf48f46d6d3e673d/npm-cache',
	),
	path.join(node18Closure, 'npm-cache'),
] as const;

async function reusable(pair: NpmLockPair): Promise<Buffer | undefined> {
	for (const cache of reuseCaches) {
		try {
			const bytes = (
				await cacache.get(
					path.join(cache, '_cacache'),
					`make-fetch-happen:request-cache:${pair.url}`,
				)
			).data;
			verifyNpmSri(bytes, pair.integrity);
			inspectNpmPackageTarball(bytes, pair.identities);
			return bytes;
		} catch {
			/* exact miss or mismatch is not reusable */
		}
	}
	return undefined;
}

async function acquirePairs(
	pairs: readonly NpmLockPair[],
	state: State,
	fetchImplementation: typeof fetch,
): Promise<Array<Record<string, unknown>>> {
	await mkdir(path.join(stage, 'tarballs'), { recursive: true });
	const artifacts: Array<Record<string, unknown>> = [];
	for (const pair of pairs) {
		let bytes = await reusable(pair);
		const source = bytes ? 'validated-local-reuse' : 't625-acquired';
		bytes ??= await getExact(pair.url, 'tarball', state, fetchImplementation);
		verifyNpmSri(bytes, pair.integrity);
		const metadata = inspectNpmPackageTarball(bytes, pair.identities);
		await cachePut(pair.url, bytes, pair.integrity);
		const digest = sha256(bytes);
		if (!(await exists(path.join(stage, `tarballs/${digest}.tgz`))))
			await writeFile(path.join(stage, `tarballs/${digest}.tgz`), bytes, { flag: 'wx' });
		artifacts.push({
			url: pair.url,
			integrity: pair.integrity,
			identities: pair.identities,
			sha256: digest,
			byteLength: bytes.byteLength,
			source,
			metadata,
		});
	}
	return artifacts;
}

function mergePairs(locks: ReadonlyMap<AngularContactsMajor, Buffer>): NpmLockPair[] {
	return [
		...new Map(
			[...locks.values()]
				.flatMap((lock) => parseNpmLockPlan(lock).pairs)
				.map((pair) => [`${pair.url}\0${pair.integrity}`, pair]),
		).values(),
	].sort(
		(left, right) =>
			left.url.localeCompare(right.url) || left.integrity.localeCompare(right.integrity),
	);
}

async function verifyInstalls(
	lanes: readonly Lane[],
	locks: ReadonlyMap<AngularContactsMajor, Buffer>,
): Promise<void> {
	for (const lane of lanes) {
		const directory = path.join(stage, `verify/angular${lane.major}`);
		await mkdir(directory, { recursive: true });
		await writeFile(path.join(directory, 'package.json'), lane.files['package.json']!, {
			flag: 'wx',
		});
		await writeFile(path.join(directory, 'package-lock.json'), locks.get(lane.major)!, {
			flag: 'wx',
		});
		const before = sha256(locks.get(lane.major)!);
		await run(
			path.join(node16, 'bin/npm'),
			[
				'ci',
				'--offline',
				'--ignore-scripts',
				'--no-audit',
				'--no-fund',
				'--strict-peer-deps',
				'--omit=optional',
				'--cache',
				path.join(stage, 'npm-cache'),
			],
			directory,
		);
		if (sha256(await readFile(path.join(directory, 'package-lock.json'))) !== before)
			throw new Error('contacts-offline-install-mutated-lock');
		await rm(path.join(directory, 'node_modules'), { recursive: true, force: true });
	}
}

export async function smokeAngularContactsIngest(): Promise<Record<string, unknown>> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.VERSIONLESS_CONSENT_ID !== undefined
	)
		throw new Error('Angular Contacts smoke requires dual offline controls');
	const lanes = await frozenAngularContactsLanes();
	const source = await immutableFiles();
	if (parseNpmLockPlan(source.lock).pairs.length !== 1_175)
		throw new Error('Angular Contacts baseline closure differs');
	return {
		schemaVersion: 'versionless.angular-contacts-t625-smoke.v1',
		result: 'ready',
		networkAttempts: 0,
		lanes: lanes.map((lane) => ({
			major: lane.major,
			manifestSha256: sha256(lane.files['package.json']!),
		})),
		baseline: {
			node: '16.20.2',
			architecture: 'darwin-arm64',
			label: ANGULAR_CONTACTS_TECHNICAL_BOUNDARY.compatibilityBaseline,
		},
		boundary: ANGULAR_CONTACTS_TECHNICAL_BOUNDARY,
	};
}

export async function ingestAngularContacts(
	fetchImplementation: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
	if ((await exists(stage)) || (await exists(receiptPath)) || (await exists(terminalPath)))
		throw new Error('Angular Contacts T625 positive or terminal root already exists');
	await mkdir(path.join(stage, 'npm-cache'), { recursive: true });
	await mkdir(evidenceRoot, { recursive: true });
	const state: State = { attempts: 0, aggregate: 0, ledger: [] };
	let publication: string | undefined;
	try {
		const source = await immutableFiles();
		const lanes = await frozenAngularContactsLanes();
		await seedMetadata(lanes.slice(1), state, fetchImplementation);
		const locks = await generateLocks(lanes, source.lock);
		const pairs = mergePairs(locks);
		const artifacts = await acquirePairs(pairs, state, fetchImplementation);
		await verifyInstalls(lanes, locks);
		for (const lane of lanes) {
			const directory = path.join(stage, `sources/angular${lane.major}`);
			for (const [relative, text] of Object.entries(lane.files)) {
				const file = path.join(directory, relative);
				await mkdir(path.dirname(file), { recursive: true });
				await writeFile(file, text, { flag: 'wx' });
			}
			await mkdir(path.join(stage, `lanes/angular${lane.major}`), { recursive: true });
			await writeFile(
				path.join(stage, `lanes/angular${lane.major}/package-lock.json`),
				locks.get(lane.major)!,
				{ flag: lane.major === 9 ? 'wx' : 'w' },
			);
		}
		await cp(node16, path.join(stage, 'runtimes/node16'), { recursive: true });
		await cp(
			path.join(node18Closure, 'node-runtime.tar.gz'),
			path.join(stage, 'runtimes/node18.tar.gz'),
		);
		const receipt = {
			schemaVersion: 'versionless.angular-contacts-t625-closure.v1',
			result: 'accepted',
			consent: {
				id: ANGULAR_CONTACTS_CONSENT,
				status: 'closed',
				methods: ['GET'],
				requests: state.ledger.length,
				attempts: state.attempts,
				responseBytes: state.aggregate,
			},
			source: { commit, archiveSha256, lockSha256 },
			baseline: {
				node: '16.20.2',
				architecture: 'darwin-arm64',
				compatibilityLabel: ANGULAR_CONTACTS_TECHNICAL_BOUNDARY.compatibilityBaseline,
			},
			lanes: lanes.map((lane) => ({
				major: lane.major,
				manifestSha256: sha256(lane.files['package.json']!),
				lockSha256: sha256(locks.get(lane.major)!),
			})),
			closure: {
				uniquePairs: pairs.length,
				reused: artifacts.filter((item) => item.source === 'validated-local-reuse').length,
				acquired: artifacts.filter((item) => item.source === 't625-acquired').length,
				artifacts,
			},
			requests: state.ledger,
			scriptsDisabled: true,
			strictPeerDependencies: true,
			optionalDependenciesOmitted: true,
			boundary: ANGULAR_CONTACTS_TECHNICAL_BOUNDARY,
			nonclaims: [
				'Technical evaluation of an example application; not original Node12 reproduction, enterprise adoption, compliance, certification, legal approval, or redistribution authorization.',
			],
		};
		await writeFile(path.join(stage, 'closure.json'), canonical(receipt), { flag: 'wx' });
		const digest = sha256(canonical(receipt));
		publication = path.join(publicationRoot, digest);
		await mkdir(path.dirname(publication), { recursive: true });
		await rename(stage, publication);
		const handle = await open(receiptPath, 'wx');
		try {
			await handle.writeFile(
				canonical({
					...receipt,
					publication: {
						digest,
						relativePath: `.versionless/cache/angular-contacts-production/closures/${digest}`,
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
		const code =
			error instanceof Error && error.message.startsWith('contacts-')
				? error.message.slice(0, 160)
				: 'contacts-validation-failed';
		const terminal = {
			schemaVersion: 'versionless.angular-contacts-t625-terminal.v1',
			result: 'excluded',
			consentId: ANGULAR_CONTACTS_CONSENT,
			code,
			requests: state.ledger.length,
			attempts: state.attempts,
			responseBytes: state.aggregate,
			retryAllowed: false,
			rollback: {
				stageRemoved: true,
				publicationRemoved: true,
				aggregateAndTrustUnchanged: true,
			},
			boundary: ANGULAR_CONTACTS_TECHNICAL_BOUNDARY,
		};
		const handle = await open(terminalPath, 'wx');
		try {
			await handle.writeFile(canonical(terminal));
		} finally {
			await handle.close();
		}
		throw error;
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length === 1 && args[0] === '--launcher-smoke')
		process.stdout.write(canonical(await smokeAngularContactsIngest()));
	else {
		assertAngularContactsConsent(args);
		process.stdout.write(canonical(await ingestAngularContacts()));
	}
}

if (process.argv[1]?.endsWith('angular-contacts-production-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
