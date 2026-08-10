import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	access,
	lstat,
	mkdir,
	readFile,
	readdir,
	readlink,
	rename,
	writeFile,
} from 'node:fs/promises';
import { request } from 'node:https';
import { charIn, createRegExp, digit, maybe, oneOrMore } from 'magic-regexp';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { joinURL, parseURL, withQuery } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const KUBERNETES_DASHBOARD_CONSENT =
	'T678-kubernetes-retired-dashboard-production-acquisition' as const;
export const KUBERNETES_DASHBOARD_NAMESPACE = 't678' as const;

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const evidenceRoot = join(repositoryRoot, 'evidence/ingests/angular-kubernetes-dashboard/t678');
const attemptPath = join(evidenceRoot, 'attempt.json');
const terminalPath = join(evidenceRoot, 'terminal.json');
const receiptPath = join(evidenceRoot, 'receipt.json');
const stageRoot = join(
	repositoryRoot,
	'.versionless/cache/angular-kubernetes-dashboard-stage-t678',
);
const cacheRoot = join(
	repositoryRoot,
	'.versionless/cache/angular-kubernetes-dashboard-source-t678',
);
const lowerHex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const stableSemver = createRegExp(
	maybe('v'),
	oneOrMore(digit),
	'.',
	oneOrMore(digit),
	'.',
	oneOrMore(digit).at.lineEnd(),
);
const maximumAcceptedResponses = 7_500;
const maximumApiBytes = 16 * 1024 * 1024;
const maximumArtifactBytes = 64 * 1024 * 1024;
const maximumArchiveBytes = 256 * 1024 * 1024;
const maximumAggregateBytes = 4 * 1024 * 1024 * 1024;
const requestTimeoutMilliseconds = 60_000;

type RefRow = Readonly<{
	ref: string;
	object: Readonly<{ type: 'commit' | 'tag'; sha: string }>;
}>;
type TreeRow = Readonly<{
	path: string;
	mode: string;
	type: string;
	sha: string;
	size?: number;
}>;
type Candidate = Readonly<{
	ref: string;
	version: readonly [number, number, number];
	commit: string;
	tree: string;
	commitDate: string;
}>;
type LedgerRow = Readonly<{
	ordinal: number;
	url: string;
	status: 200;
	bytes: number;
	sha256: string;
	sha512: string;
	zeroResponseAttempts: number;
}>;
type NetworkState = {
	acceptedResponses: number;
	aggregateBytes: number;
	ledger: LedgerRow[];
	responseObservations: Array<{
		url: string;
		method: 'GET';
		attempt: number;
		status: number | null;
		headersObserved: boolean;
		bodyBytes: number;
		acceptedResponse: boolean;
	}>;
};

type FailureStage =
	| 'transport'
	| 'repository-identity'
	| 'ref-enumeration'
	| 'immutable-lineage'
	| 'archive-integrity'
	| 'historical-qualification'
	| 'publication';

class AcquisitionFailure extends Error {
	readonly stage: FailureStage;
	readonly property: string;

	constructor(stage: FailureStage, property: string, message: string) {
		super(message);
		this.stage = stage;
		this.property = property;
	}
}

const acquisitionFailure = (
	stage: FailureStage,
	property: string,
	message: string,
): AcquisitionFailure => new AcquisitionFailure(stage, property, message);

const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;
const exists = (file: string): Promise<boolean> =>
	access(file).then(
		() => true,
		() => false,
	);

export function parseKubernetesDashboardLauncher(args: readonly string[]): {
	mode: 'acquire' | 'verify';
	namespace: typeof KUBERNETES_DASHBOARD_NAMESPACE;
} {
	if (args.at(-2) !== '--namespace' || args.at(-1) !== KUBERNETES_DASHBOARD_NAMESPACE)
		throw new Error('Kubernetes Dashboard namespace differs');
	const leading = args.slice(0, -2);
	if (
		leading.length === 2 &&
		leading[0] === '--consent-id' &&
		leading[1] === KUBERNETES_DASHBOARD_CONSENT &&
		process.env.VERSIONLESS_NETWORK_MODE === 'consented' &&
		process.env.VERSIONLESS_CONSENT_ID === KUBERNETES_DASHBOARD_CONSENT
	)
		return { mode: 'acquire', namespace: KUBERNETES_DASHBOARD_NAMESPACE };
	if (
		leading.length === 1 &&
		leading[0] === '--verify-offline' &&
		process.env.VERSIONLESS_NETWORK_MODE === 'offline' &&
		process.env.VERSIONLESS_CONSENT_ID === undefined
	)
		return { mode: 'verify', namespace: KUBERNETES_DASHBOARD_NAMESPACE };
	throw new Error('Kubernetes Dashboard launcher boundary differs');
}

export function parseKubernetesDashboardStableVersion(
	ref: string,
): readonly [number, number, number] | null {
	const prefix = 'refs/tags/';
	if (!ref.startsWith(prefix)) return null;
	const name = ref.slice(prefix.length);
	if (!stableSemver.test(name)) return null;
	const numeric = name.startsWith('v') ? name.slice(1) : name;
	const parts = numeric.split('.');
	if (parts.length !== 3 || parts.some((part) => part.length > 9)) return null;
	const version = parts.map(Number) as [number, number, number];
	if (version[0] !== 2 || version.some((part) => !Number.isSafeInteger(part))) return null;
	return version;
}

export function selectKubernetesDashboardCandidate(candidates: readonly Candidate[]): Candidate {
	const selected = [...candidates].sort(
		(left, right) =>
			right.version[0] - left.version[0] ||
			right.version[1] - left.version[1] ||
			right.version[2] - left.version[2] ||
			compareText(left.ref, right.ref),
	)[0];
	if (!selected) throw new Error('Kubernetes Dashboard stable 2.x 2020-2021 revision is absent');
	return selected;
}

function assertRequestUrl(url: string, kind: 'api' | 'archive' | 'artifact'): void {
	const parsed = parseURL(url);
	const expectedHost =
		kind === 'api'
			? 'api.github.com'
			: kind === 'archive'
				? 'codeload.github.com'
				: 'registry.npmjs.org';
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== expectedHost ||
		parsed.auth ||
		parsed.hash ||
		(kind !== 'api' && parsed.search)
	)
		throw acquisitionFailure(
			'transport',
			'literal-https-get-url',
			'Kubernetes Dashboard request is outside literal consent',
		);
}

async function getExact(
	url: string,
	kind: 'api' | 'archive' | 'artifact',
	state: NetworkState,
): Promise<Buffer> {
	assertRequestUrl(url, kind);
	const cap =
		kind === 'api'
			? maximumApiBytes
			: kind === 'archive'
				? maximumArchiveBytes
				: maximumArtifactBytes;
	if (state.acceptedResponses >= maximumAcceptedResponses)
		throw acquisitionFailure(
			'transport',
			'accepted-response-cap',
			'Kubernetes Dashboard accepted-response cap exceeded',
		);
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await new Promise<Buffer>((resolvePromise, reject) => {
				let responseObserved = false;
				const call = request(
					url,
					{
						method: 'GET',
						headers: {
							accept:
								kind === 'api'
									? 'application/vnd.github+json'
									: 'application/octet-stream',
							'accept-encoding': 'identity',
							'user-agent': 'versionless-t678',
							'x-github-api-version': kind === 'api' ? '2022-11-28' : '',
							'x-versionless-consent-id': KUBERNETES_DASHBOARD_CONSENT,
						},
					},
					(response) => {
						responseObserved = true;
						const observation = {
							url,
							method: 'GET' as const,
							attempt,
							status: response.statusCode ?? 0,
							headersObserved: true,
							bodyBytes: 0,
							acceptedResponse: false,
						};
						state.responseObservations.push(observation);
						if (response.statusCode !== 200) {
							response.destroy();
							reject(
								acquisitionFailure(
									'transport',
									response.statusCode &&
										response.statusCode >= 300 &&
										response.statusCode < 400
										? 'redirect-status'
										: 'non-200-status',
									`Kubernetes Dashboard response status differs: ${response.statusCode ?? 0}`,
								),
							);
							return;
						}
						if ((response.headers['content-encoding'] ?? 'identity') !== 'identity') {
							response.destroy();
							reject(
								acquisitionFailure(
									'transport',
									'content-encoding',
									'Kubernetes Dashboard response content encoding differs',
								),
							);
							return;
						}
						const chunks: Buffer[] = [];
						let bytes = 0;
						response.on('data', (chunk: Buffer) => {
							bytes += chunk.byteLength;
							observation.bodyBytes = bytes;
							if (bytes > cap || state.aggregateBytes + bytes > maximumAggregateBytes)
								response.destroy(
									acquisitionFailure(
										'transport',
										'body-or-aggregate-cap',
										'Kubernetes Dashboard acquisition byte cap exceeded',
									),
								);
							else chunks.push(Buffer.from(chunk));
						});
						response.once('error', reject);
						response.once('end', () => {
							const body = Buffer.concat(chunks, bytes);
							observation.bodyBytes = bytes;
							observation.acceptedResponse = true;
							state.acceptedResponses += 1;
							state.aggregateBytes += bytes;
							state.ledger.push({
								ordinal: state.acceptedResponses,
								url,
								status: 200,
								bytes,
								sha256: sha256(body),
								sha512: createHash('sha512').update(body).digest('hex'),
								zeroResponseAttempts: attempt - 1,
							});
							resolvePromise(body);
						});
					},
				);
				call.setTimeout(requestTimeoutMilliseconds, () =>
					call.destroy(new Error('Kubernetes Dashboard zero-response request timeout')),
				);
				call.once('error', (error) => {
					if (!responseObserved) {
						state.responseObservations.push({
							url,
							method: 'GET',
							attempt,
							status: null,
							headersObserved: false,
							bodyBytes: 0,
							acceptedResponse: false,
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
	throw new Error('Kubernetes Dashboard transport attempts exhausted');
}

async function execute(
	command: string,
	args: readonly string[],
	cwd = repositoryRoot,
): Promise<string> {
	return await new Promise<string>((resolvePromise, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			env: process.env,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolvePromise(Buffer.concat(stdout).toString('utf8'))
				: reject(
						new Error(
							`${basename(command)} exited ${code ?? -1}: ${Buffer.concat(stderr)}`,
						),
					),
		);
	});
}

function gitBlobSha(bytes: Buffer): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

async function sourceManifest(source: string): Promise<
	Array<{
		path: string;
		kind: 'file' | 'symlink';
		mode: string;
		bytes: number;
		sha256: string;
		gitSha: string;
	}>
> {
	const rows: Array<{
		path: string;
		kind: 'file' | 'symlink';
		mode: string;
		bytes: number;
		sha256: string;
		gitSha: string;
	}> = [];
	const visit = async (directory: string): Promise<void> => {
		for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
			(left, right) => compareText(left.name, right.name),
		)) {
			const absolute = join(directory, entry.name);
			const status = await lstat(absolute);
			if (status.isDirectory()) await visit(absolute);
			else if (status.isFile() || status.isSymbolicLink()) {
				const kind = status.isSymbolicLink() ? 'symlink' : 'file';
				const bytes =
					kind === 'symlink'
						? Buffer.from(await readlink(absolute), 'utf8')
						: await readFile(absolute);
				rows.push({
					path: relative(source, absolute),
					kind,
					mode: kind === 'symlink' ? '120000' : status.mode & 0o111 ? '100755' : '100644',
					bytes: bytes.byteLength,
					sha256: sha256(bytes),
					gitSha: gitBlobSha(bytes),
				});
			} else
				throw new Error('Kubernetes Dashboard archive contains a special filesystem entry');
		}
	};
	await visit(source);
	return rows.sort((left, right) => compareText(left.path, right.path));
}

function validateRefs(value: unknown): RefRow[] {
	if (!Array.isArray(value) || value.length > 256)
		throw new Error('Kubernetes Dashboard tag enumeration cardinality differs');
	return value.map((item) => {
		if (!item || typeof item !== 'object' || Array.isArray(item))
			throw new Error('Kubernetes Dashboard tag ref row differs');
		const row = item as { ref?: unknown; object?: { type?: unknown; sha?: unknown } };
		if (
			typeof row.ref !== 'string' ||
			(row.object?.type !== 'commit' && row.object?.type !== 'tag') ||
			typeof row.object.sha !== 'string' ||
			!lowerHex40.test(row.object.sha)
		)
			throw new Error('Kubernetes Dashboard tag ref identity differs');
		return { ref: row.ref, object: { type: row.object.type, sha: row.object.sha } };
	});
}

async function peelRef(ref: RefRow, apiRoot: string, state: NetworkState): Promise<string> {
	let type: 'commit' | 'tag' = ref.object.type;
	let sha = ref.object.sha;
	for (let depth = 0; type === 'tag' && depth < 4; depth += 1) {
		const bytes = await getExact(joinURL(apiRoot, 'git', 'tags', sha), 'api', state);
		const tag = JSON.parse(bytes.toString('utf8')) as {
			sha?: unknown;
			object?: { type?: unknown; sha?: unknown };
		};
		if (
			tag.sha !== sha ||
			(tag.object?.type !== 'tag' && tag.object?.type !== 'commit') ||
			typeof tag.object.sha !== 'string' ||
			!lowerHex40.test(tag.object.sha)
		)
			throw new Error('Kubernetes Dashboard annotated tag lineage differs');
		type = tag.object.type;
		sha = tag.object.sha;
	}
	if (type !== 'commit')
		throw new Error('Kubernetes Dashboard annotated tag peel depth exceeded');
	return sha;
}

async function writeTerminal(error: unknown, state: NetworkState): Promise<void> {
	if (await exists(terminalPath)) return;
	await mkdir(evidenceRoot, { recursive: true });
	const message = error instanceof Error ? error.message : String(error);
	const inferred = (() => {
		if (message.includes('tag enumeration') || message.includes('tag ref'))
			return { stage: 'ref-enumeration' as const, property: 'bounded-ref-shape' };
		if (message.includes('annotated tag'))
			return { stage: 'immutable-lineage' as const, property: 'annotated-tag-lineage' };
		if (message.includes('ref/commit/tree'))
			return { stage: 'immutable-lineage' as const, property: 'ref-commit-tree-lineage' };
		if (message.includes('recursive tree'))
			return { stage: 'immutable-lineage' as const, property: 'untruncated-recursive-tree' };
		if (message.includes('archive'))
			return { stage: 'archive-integrity' as const, property: 'archive-safety-or-parity' };
		if (message.includes('license'))
			return {
				stage: 'historical-qualification' as const,
				property: 'root-apache-2-license',
			};
		if (message.includes('product/toolchain/lock'))
			return {
				stage: 'historical-qualification' as const,
				property: 'angular-product-toolchain-lock',
			};
		if (message.includes('browser builder'))
			return {
				stage: 'historical-qualification' as const,
				property: 'angular-browser-builder',
			};
		if (message.includes('API source contract'))
			return {
				stage: 'historical-qualification' as const,
				property: 'loopback-api-contract',
			};
		if (message.includes('service-worker'))
			return {
				stage: 'historical-qualification' as const,
				property: 'source-service-worker',
			};
		return { stage: 'publication' as const, property: 'unexpected-error' };
	})();
	const unsigned = {
		schemaVersion: 'versionless.angular-kubernetes-dashboard-t678-terminal.v1',
		result: 'terminal-failure',
		consentId: KUBERNETES_DASHBOARD_CONSENT,
		namespace: KUBERNETES_DASHBOARD_NAMESPACE,
		promotion: 'none',
		failure: {
			stage: error instanceof AcquisitionFailure ? error.stage : inferred.stage,
			property: error instanceof AcquisitionFailure ? error.property : inferred.property,
			message,
		},
		access: state,
		claims: {
			feasibility: 'not-assessed',
			angularLineageScore: '1/4',
			angularPilot: '0/1',
		},
	};
	await writeFile(
		terminalPath,
		`${canonicalize({
			...unsigned,
			integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(unsigned)) },
		})}\n`,
		{ flag: 'wx' },
	);
}

export async function acquireKubernetesDashboard(): Promise<void> {
	for (const target of [cacheRoot, stageRoot, attemptPath, terminalPath, receiptPath])
		if (await exists(target)) throw new Error('Kubernetes Dashboard T678 output collision');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({
			schemaVersion: 'versionless.angular-kubernetes-dashboard-t678-attempt.v1',
			consentId: KUBERNETES_DASHBOARD_CONSENT,
			namespace: KUBERNETES_DASHBOARD_NAMESPACE,
			limits: {
				acceptedResponses: maximumAcceptedResponses,
				apiBytes: maximumApiBytes,
				artifactBytes: maximumArtifactBytes,
				archiveBytes: maximumArchiveBytes,
				aggregateBytes: maximumAggregateBytes,
			},
		})}\n`,
		{ flag: 'wx' },
	);
	const state: NetworkState = {
		acceptedResponses: 0,
		aggregateBytes: 0,
		ledger: [],
		responseObservations: [],
	};
	try {
		const acquisition = join(stageRoot, 'acquisition');
		const source = join(acquisition, 'source');
		await mkdir(source, { recursive: true });
		const apiRoot = joinURL(
			'https://api.github.com',
			'repos',
			'kubernetes-retired',
			'dashboard',
		);
		const repositoryBytes = await getExact(apiRoot, 'api', state);
		const repository = JSON.parse(repositoryBytes.toString('utf8')) as {
			full_name?: unknown;
			owner?: { login?: unknown; type?: unknown };
			license?: { spdx_id?: unknown };
			archived?: unknown;
			default_branch?: unknown;
		};
		if (
			typeof repository.full_name !== 'string' ||
			repository.full_name.toLowerCase() !== 'kubernetes-retired/dashboard'
		)
			throw acquisitionFailure(
				'repository-identity',
				'case-normalized-full-name',
				'Kubernetes Dashboard canonical repository identity differs',
			);
		const refGroups: RefRow[][] = [];
		for (const prefix of ['tags/v2.', 'tags/2.']) {
			refGroups.push(
				validateRefs(
					JSON.parse(
						(
							await getExact(
								joinURL(apiRoot, 'git', 'matching-refs', prefix),
								'api',
								state,
							)
						).toString('utf8'),
					),
				),
			);
		}
		const refs = refGroups.flat();
		if (refs.length === 0)
			throw acquisitionFailure(
				'ref-enumeration',
				'bounded-stable-ref-set',
				'Kubernetes Dashboard stable tag enumeration is empty',
			);
		const candidates: Candidate[] = [];
		const orderedRefs = refs
			.map((ref) => ({ ref, version: parseKubernetesDashboardStableVersion(ref.ref) }))
			.filter(
				(row): row is { ref: RefRow; version: readonly [number, number, number] } =>
					row.version !== null,
			)
			.sort(
				(left, right) =>
					right.version[0] - left.version[0] ||
					right.version[1] - left.version[1] ||
					right.version[2] - left.version[2] ||
					compareText(left.ref.ref, right.ref.ref),
			);
		for (const { ref, version } of orderedRefs) {
			const commitSha = await peelRef(ref, apiRoot, state);
			const commitBytes = await getExact(
				joinURL(apiRoot, 'git', 'commits', commitSha),
				'api',
				state,
			);
			const commit = JSON.parse(commitBytes.toString('utf8')) as {
				sha?: unknown;
				tree?: { sha?: unknown };
				committer?: { date?: unknown };
			};
			if (
				commit.sha !== commitSha ||
				typeof commit.tree?.sha !== 'string' ||
				!lowerHex40.test(commit.tree.sha) ||
				typeof commit.committer?.date !== 'string'
			)
				throw new Error('Kubernetes Dashboard ref/commit/tree lineage differs');
			if (
				commit.committer.date >= '2020-01-01T00:00:00Z' &&
				commit.committer.date <= '2021-12-31T23:59:59Z'
			) {
				candidates.push({
					ref: ref.ref,
					version,
					commit: commitSha,
					tree: commit.tree.sha,
					commitDate: commit.committer.date,
				});
				break;
			}
		}
		const selected = selectKubernetesDashboardCandidate(candidates);
		const treeBytes = await getExact(
			withQuery(joinURL(apiRoot, 'git', 'trees', selected.tree), { recursive: '1' }),
			'api',
			state,
		);
		const tree = JSON.parse(treeBytes.toString('utf8')) as {
			sha?: unknown;
			truncated?: unknown;
			tree?: TreeRow[];
		};
		if (tree.sha !== selected.tree || tree.truncated !== false || !Array.isArray(tree.tree))
			throw new Error('Kubernetes Dashboard recursive tree differs');
		const archiveUrl = joinURL(
			'https://codeload.github.com',
			'kubernetes-retired',
			'dashboard',
			'tar.gz',
			selected.commit,
		);
		const archiveOne = await getExact(archiveUrl, 'archive', state);
		const archiveTwo = await getExact(archiveUrl, 'archive', state);
		if (!archiveOne.equals(archiveTwo))
			throw new Error('Kubernetes Dashboard two commit archives differ');
		const archivePath = join(acquisition, 'source.tar.gz');
		await writeFile(archivePath, archiveOne, { flag: 'wx' });
		const listing = (await execute('/usr/bin/tar', ['-tzf', archivePath]))
			.split('\n')
			.filter(Boolean);
		let archiveRoot: string | undefined;
		for (const entry of listing) {
			const segments = entry.split('/');
			if (!entry || entry.startsWith('/') || entry.includes('\\') || segments.includes('..'))
				throw new Error('Kubernetes Dashboard archive path is unsafe');
			archiveRoot ??= segments[0];
			if (segments[0] !== archiveRoot)
				throw new Error('Kubernetes Dashboard archive root differs');
		}
		if (!archiveRoot || listing.length < 100)
			throw new Error('Kubernetes Dashboard archive inventory differs');
		await execute('/usr/bin/tar', [
			'-xzf',
			archivePath,
			'-C',
			source,
			'--strip-components',
			'1',
		]);
		const manifest = await sourceManifest(source);
		const blobs = new Map(
			tree.tree.filter((row) => row.type === 'blob').map((row) => [row.path, row]),
		);
		if (manifest.length !== blobs.size)
			throw new Error('Kubernetes Dashboard archive/tree cardinality differs');
		for (const row of manifest) {
			const expected = blobs.get(row.path);
			if (
				!expected ||
				expected.sha !== row.gitSha ||
				expected.size !== row.bytes ||
				expected.mode !== row.mode
			)
				throw new Error(`Kubernetes Dashboard archive/tree parity differs: ${row.path}`);
		}
		const licensePath = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].find((name) =>
			blobs.has(name),
		);
		if (!licensePath)
			throw new Error('Kubernetes Dashboard root Apache license source is absent');
		const license = await readFile(join(source, licensePath), 'utf8');
		if (
			!license.includes('Apache License') ||
			!license.includes('Version 2.0, January 2004') ||
			!license.includes('http://www.apache.org/licenses/')
		)
			throw new Error('Kubernetes Dashboard root Apache-2.0 license text differs');
		type PackageDocument = {
			name?: unknown;
			version?: unknown;
			dependencies?: Record<string, unknown>;
			devDependencies?: Record<string, unknown>;
			scripts?: Record<string, unknown>;
		};
		const angularPackages: Array<{
			path: string;
			root: string;
			document: PackageDocument;
			angularConfigurationPath: string;
			locks: string[];
		}> = [];
		for (const packagePath of [...blobs.keys()]
			.filter((path) => basename(path) === 'package.json')
			.sort(compareText)) {
			let document: PackageDocument;
			try {
				document = JSON.parse(
					await readFile(join(source, packagePath), 'utf8'),
				) as PackageDocument;
			} catch {
				continue;
			}
			if (
				typeof document.dependencies?.['@angular/core'] !== 'string' ||
				typeof document.devDependencies?.['@angular/cli'] !== 'string'
			)
				continue;
			const root = dirname(packagePath);
			const angularConfigurationPath = join(root, 'angular.json');
			const locks = ['package-lock.json', 'yarn.lock']
				.map((name) => join(root, name))
				.filter((name) => blobs.has(name));
			if (blobs.has(angularConfigurationPath))
				angularPackages.push({
					path: packagePath,
					root,
					document,
					angularConfigurationPath,
					locks,
				});
		}
		if (angularPackages.length !== 1)
			throw new Error(
				'Kubernetes Dashboard authentic Angular product/toolchain/lock gate differs',
			);
		const angularPackage = angularPackages[0];
		const packageDocument = angularPackage.document;
		const angularVersion = packageDocument.dependencies?.['@angular/core'];
		const cliVersion = packageDocument.devDependencies?.['@angular/cli'];
		if (
			typeof packageDocument.name !== 'string' ||
			!packageDocument.name.toLowerCase().includes('dashboard') ||
			typeof packageDocument.version !== 'string' ||
			typeof angularVersion !== 'string' ||
			typeof cliVersion !== 'string' ||
			typeof packageDocument.scripts?.build !== 'string' ||
			angularPackage.locks.length !== 1
		)
			throw new Error(
				'Kubernetes Dashboard authentic Angular product/toolchain/lock gate differs',
			);
		const angularConfiguration = JSON.parse(
			await readFile(join(source, angularPackage.angularConfigurationPath), 'utf8'),
		) as {
			projects?: Record<string, { architect?: { build?: { builder?: unknown } } }>;
		};
		const builders = Object.values(angularConfiguration.projects ?? {}).map(
			(project) => project.architect?.build?.builder,
		);
		if (!builders.some((builder) => builder === '@angular-devkit/build-angular:browser'))
			throw new Error(
				'Kubernetes Dashboard authentic historical Angular browser builder differs',
			);
		let namespaceContract = false;
		let deploymentContract = false;
		let sameOriginApi = false;
		const serviceWorkerPaths: string[] = [];
		for (const row of manifest) {
			if (!row.path.startsWith('src/') || !row.path.endsWith('.ts')) continue;
			const text = await readFile(join(source, row.path), 'utf8');
			if (text.includes('/api/v1/namespace')) namespaceContract = true;
			if (text.includes('/deployment') || text.includes('/deployments'))
				deploymentContract = true;
			if (
				text.includes("'/api/") ||
				text.includes('`/api/') ||
				text.includes('endpointManager')
			)
				sameOriginApi = true;
			if (
				text.includes('ServiceWorkerModule.register') ||
				text.includes('navigator.serviceWorker') ||
				text.includes('serviceWorker.register')
			)
				serviceWorkerPaths.push(row.path);
		}
		if (!namespaceContract || !deploymentContract || !sameOriginApi)
			throw new Error(
				'Kubernetes Dashboard loopback Kubernetes API source contract is absent',
			);
		if (serviceWorkerPaths.length)
			throw new Error(
				`Kubernetes Dashboard source service-worker registration exists: ${serviceWorkerPaths.join(',')}`,
			);
		const unsigned = {
			schemaVersion: 'versionless.angular-kubernetes-dashboard-ingest.v1',
			result: 'source-qualified',
			consentId: KUBERNETES_DASHBOARD_CONSENT,
			namespace: KUBERNETES_DASHBOARD_NAMESPACE,
			source: {
				...selected,
				archiveSha256: sha256(archiveOne),
				manifestDigest: sha256(canonicalize(manifest)),
				files: manifest.length,
			},
			product: {
				name: packageDocument.name,
				version: packageDocument.version,
				angular: angularVersion,
				cli: cliVersion,
				root: angularPackage.root,
				package: angularPackage.path,
				lock: angularPackage.locks[0],
				historicalBuilder: '@angular-devkit/build-angular:browser',
				namespaceContract: true,
				deploymentContract: true,
				sameOriginApi: true,
				serviceWorkerSourceMatches: 0,
			},
			repositoryAudit: {
				ownerLogin:
					typeof repository.owner?.login === 'string' ? repository.owner.login : null,
				ownerType:
					typeof repository.owner?.type === 'string' ? repository.owner.type : null,
				archived: typeof repository.archived === 'boolean' ? repository.archived : null,
				defaultBranch:
					typeof repository.default_branch === 'string'
						? repository.default_branch
						: null,
				apiLicense:
					typeof repository.license?.spdx_id === 'string'
						? repository.license.spdx_id
						: null,
				authority: 'audit-only',
			},
			license: {
				rootExpression: 'Apache-2.0',
				thirdPartyAssetState: 'unknown',
				legalReviewRequired: true,
				redistributionAuthorized: false,
			},
			access: { ...state, redirects: 0, credentials: false, cookies: false },
			privacy: { sensitiveData: false, hostPaths: false },
		};
		const receipt = {
			...unsigned,
			integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(unsigned)) },
		};
		await writeFile(join(acquisition, 'receipt.json'), `${canonicalize(receipt)}\n`, {
			flag: 'wx',
		});
		await rename(stageRoot, cacheRoot);
		await writeFile(receiptPath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
	} catch (error) {
		await writeTerminal(error, state);
		throw error;
	}
}

export async function verifyKubernetesDashboardIngest(): Promise<{
	valid: true;
	digest: string;
	files: number;
}> {
	const published = JSON.parse(await readFile(receiptPath, 'utf8')) as {
		source: { manifestDigest: string; files: number };
		integrity: { canonicalDigest: string };
		[key: string]: unknown;
	};
	const cached = JSON.parse(
		await readFile(join(cacheRoot, 'acquisition/receipt.json'), 'utf8'),
	) as typeof published;
	if (canonicalize(published) !== canonicalize(cached))
		throw new Error('Kubernetes Dashboard receipt publication differs');
	const { integrity, ...unsigned } = published;
	if (integrity.canonicalDigest !== sha256(canonicalize(unsigned)))
		throw new Error('Kubernetes Dashboard receipt integrity differs');
	const manifest = await sourceManifest(join(cacheRoot, 'acquisition/source'));
	if (
		manifest.length !== published.source.files ||
		sha256(canonicalize(manifest)) !== published.source.manifestDigest
	)
		throw new Error('Kubernetes Dashboard source offline replay differs');
	return { valid: true, digest: integrity.canonicalDigest, files: manifest.length };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const launcher = parseKubernetesDashboardLauncher(args);
	if (launcher.mode === 'acquire') await acquireKubernetesDashboard();
	process.stdout.write(`${canonicalize(await verifyKubernetesDashboardIngest())}\n`);
}

if (basename(process.argv[1] ?? '') === 'angular-kubernetes-dashboard-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
