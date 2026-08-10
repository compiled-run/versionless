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
import { charIn, createRegExp } from 'magic-regexp';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { joinURL, parseURL, withQuery } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const VERDACCIO_CONSENT = 'T682-verdaccio-4.12.2-production-acquisition' as const;
export const VERDACCIO_NAMESPACE = 't682' as const;

const root = resolve(import.meta.dirname, '../../../..');
const evidenceRoot = join(root, 'evidence/ingests/react-verdaccio/t682');
const attemptPath = join(evidenceRoot, 'attempt.json');
const terminalPath = join(evidenceRoot, 'terminal.json');
const receiptPath = join(evidenceRoot, 'receipt.json');
const stageRoot = join(root, '.versionless/cache/react-verdaccio-stage-t682');
const cacheRoot = join(root, '.versionless/cache/react-verdaccio-source-t682');
const hex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const apiCap = 16 * 1024 * 1024;
const archiveCap = 256 * 1024 * 1024;
const aggregateCap = 1024 * 1024 * 1024;

type RefRow = { ref: string; object: { type: 'commit' | 'tag'; sha: string } };
type Candidate = {
	ref: string;
	version: readonly [number, number, number];
	commit: string;
	tree: string;
	commitDate: string;
};
type Observation = {
	method: 'GET';
	url: string;
	attempt: number;
	status: number | null;
	headersObserved: boolean;
	bodyBytes: number;
	acceptedResponse: boolean;
};
type State = {
	acceptedResponses: number;
	aggregateBytes: number;
	observations: Observation[];
	ledger: Array<{
		ordinal: number;
		url: string;
		status: 200;
		bytes: number;
		sha256: string;
		sha512: string;
	}>;
};
type Stage =
	| 'transport'
	| 'repository-identity'
	| 'ref-enumeration'
	| 'immutable-lineage'
	| 'archive-integrity'
	| 'rights'
	| 'semantic-qualification'
	| 'publication';

class AdmissionFailure extends Error {
	readonly stage: Stage;
	readonly property: string;
	readonly expected: unknown;
	readonly observed: unknown;

	constructor(
		stage: Stage,
		property: string,
		expected: unknown,
		observed: unknown,
		message: string,
	) {
		super(message);
		this.stage = stage;
		this.property = property;
		this.expected = expected;
		this.observed = observed;
	}
}

const exists = (path: string): Promise<boolean> =>
	access(path).then(
		() => true,
		() => false,
	);
const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;
const fail = (
	stage: Stage,
	property: string,
	expected: unknown,
	observed: unknown,
	message: string,
): never => {
	throw new AdmissionFailure(stage, property, expected, observed, message);
};

export function parseVerdaccioLauncher(args: readonly string[]): 'acquire' | 'verify' {
	if (args.at(-2) !== '--namespace' || args.at(-1) !== VERDACCIO_NAMESPACE)
		throw new Error('Verdaccio namespace differs');
	const leading = args.slice(0, -2);
	if (
		leading.length === 2 &&
		leading[0] === '--consent-id' &&
		leading[1] === VERDACCIO_CONSENT &&
		process.env.VERSIONLESS_NETWORK_MODE === 'consented' &&
		process.env.VERSIONLESS_CONSENT_ID === VERDACCIO_CONSENT
	)
		return 'acquire';
	if (
		leading.length === 1 &&
		leading[0] === '--verify-offline' &&
		process.env.VERSIONLESS_NETWORK_MODE === 'offline' &&
		process.env.VERSIONLESS_CONSENT_ID === undefined
	)
		return 'verify';
	throw new Error('Verdaccio launcher boundary differs');
}

export function parseVerdaccioStableVersion(ref: string): readonly [number, number, number] | null {
	for (const prefix of ['refs/tags/v4.', 'refs/tags/4.']) {
		if (!ref.startsWith(prefix)) continue;
		const parts = ref.slice('refs/tags/'.length).replace('v', '').split('.');
		if (
			parts.length !== 3 ||
			parts.some(
				(part) =>
					!part ||
					part.length > 9 ||
					[...part].some((character) => character < '0' || character > '9'),
			)
		)
			return null;
		const version = parts.map(Number) as [number, number, number];
		return version[0] === 4 && version.every(Number.isSafeInteger) ? version : null;
	}
	return null;
}

export function selectVerdaccioCandidate(candidates: readonly Candidate[]): Candidate {
	const selected = [...candidates].sort(
		(left, right) =>
			right.version[0] - left.version[0] ||
			right.version[1] - left.version[1] ||
			right.version[2] - left.version[2] ||
			compareText(left.ref, right.ref),
	)[0];
	if (!selected)
		return fail(
			'immutable-lineage',
			'stable-2020-2021-candidate',
			'present',
			'absent',
			'Verdaccio stable historical candidate is absent',
		);
	return selected;
}

export type VerdaccioPackageCandidate = Readonly<{
	path: string;
	name: string | null;
	reactMajor: number | null;
	webpackMajor: number | null;
	ownedWebpackConfigs: number;
	browserEntry: boolean;
	search: boolean;
	detail: boolean;
	auth: boolean;
	registryApi: boolean;
}>;

export function discoverVerdaccioApplicationPackage(
	candidates: readonly VerdaccioPackageCandidate[],
): VerdaccioPackageCandidate {
	const scored = candidates
		.map((candidate) => ({
			candidate,
			score:
				(candidate.name?.toLowerCase().includes('verdaccio') ? 1 : 0) +
				(candidate.reactMajor === 16 || candidate.reactMajor === 17 ? 3 : 0) +
				(candidate.webpackMajor === 4 || candidate.webpackMajor === 5 ? 2 : 0) +
				(candidate.ownedWebpackConfigs > 0 ? 2 : 0) +
				(candidate.browserEntry ? 2 : 0) +
				(candidate.search ? 1 : 0) +
				(candidate.detail ? 1 : 0) +
				(candidate.auth ? 1 : 0) +
				(candidate.registryApi ? 1 : 0),
			eligible:
				(candidate.reactMajor === 16 || candidate.reactMajor === 17) &&
				(candidate.webpackMajor === 4 || candidate.webpackMajor === 5) &&
				candidate.ownedWebpackConfigs > 0 &&
				candidate.browserEntry &&
				candidate.search &&
				candidate.detail &&
				candidate.auth &&
				candidate.registryApi,
		}))
		.filter((row) => row.eligible)
		.sort(
			(left, right) =>
				right.score - left.score || compareText(left.candidate.path, right.candidate.path),
		);
	if (!scored[0]) throw new Error('Verdaccio authentic nested web UI package is absent');
	if (scored[1]?.score === scored[0].score)
		throw new Error('Verdaccio authentic nested web UI package is ambiguous');
	return scored[0].candidate;
}

const assertUrl = (url: string, kind: 'registry' | 'api' | 'archive'): void => {
	const parsed = parseURL(url);
	const expectedHost = kind === 'archive' ? 'codeload.github.com' : 'registry.npmjs.org';
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== expectedHost ||
		parsed.auth ||
		parsed.hash ||
		(kind === 'archive' && parsed.search)
	)
		fail(
			'transport',
			'literal-https-get-url',
			expectedHost,
			parsed.host,
			'Verdaccio request escaped literal consent',
		);
};

async function getExact(
	url: string,
	kind: 'registry' | 'api' | 'archive',
	state: State,
): Promise<Buffer> {
	assertUrl(url, kind);
	const cap = kind === 'archive' ? archiveCap : apiCap;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await new Promise<Buffer>((resolvePromise, reject) => {
				let observed = false;
				const call = request(
					url,
					{
						method: 'GET',
						headers: {
							accept:
								kind === 'registry'
									? 'application/json'
									: 'application/octet-stream',
							'accept-encoding': 'identity',
							'user-agent': 'versionless-t682',
							'x-versionless-consent-id': VERDACCIO_CONSENT,
						},
					},
					(response) => {
						observed = true;
						const observation: Observation = {
							method: 'GET',
							url,
							attempt,
							status: response.statusCode ?? 0,
							headersObserved: true,
							bodyBytes: 0,
							acceptedResponse: false,
						};
						state.observations.push(observation);
						if (response.statusCode !== 200) {
							response.destroy();
							reject(
								new AdmissionFailure(
									'transport',
									response.statusCode &&
										response.statusCode >= 300 &&
										response.statusCode < 400
										? 'redirect-status'
										: 'non-200-status',
									200,
									response.statusCode ?? 0,
									'Verdaccio response status differs',
								),
							);
							return;
						}
						const encoding = response.headers['content-encoding'] ?? 'identity';
						if (encoding !== 'identity') {
							response.destroy();
							reject(
								new AdmissionFailure(
									'transport',
									'content-encoding',
									'identity',
									'non-identity',
									'Verdaccio content encoding differs',
								),
							);
							return;
						}
						let bytes = 0;
						const chunks: Buffer[] = [];
						response.on('data', (chunk: Buffer) => {
							bytes += chunk.byteLength;
							observation.bodyBytes = bytes;
							if (bytes > cap || state.aggregateBytes + bytes > aggregateCap)
								response.destroy(
									new AdmissionFailure(
										'transport',
										'body-cap',
										`<=${cap}`,
										'exceeded',
										'Verdaccio response cap exceeded',
									),
								);
							else chunks.push(Buffer.from(chunk));
						});
						response.once('error', reject);
						response.once('end', () => {
							const body = Buffer.concat(chunks, bytes);
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
							});
							resolvePromise(body);
						});
					},
				);
				call.setTimeout(60_000, () =>
					call.destroy(new Error('Verdaccio zero-observation timeout')),
				);
				call.once('error', (error) => {
					if (!observed) {
						state.observations.push({
							method: 'GET',
							url,
							attempt,
							status: null,
							headersObserved: false,
							bodyBytes: 0,
							acceptedResponse: false,
						});
						Object.assign(error, { zeroObservation: true });
					}
					reject(error);
				});
				call.end();
			});
		} catch (error) {
			if (!(error instanceof Error) || !('zeroObservation' in error) || attempt === 3)
				throw error;
		}
	}
	throw new Error('Verdaccio transport exhausted');
}

async function execute(command: string, args: readonly string[], cwd = root): Promise<string> {
	return await new Promise((resolvePromise, reject) => {
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

const gitBlob = (bytes: Buffer): string =>
	createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
async function manifest(
	source: string,
): Promise<Array<{ path: string; mode: string; bytes: number; sha256: string; gitSha: string }>> {
	const rows: Array<{
		path: string;
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
				const bytes = status.isSymbolicLink()
					? Buffer.from(await readlink(absolute))
					: await readFile(absolute);
				rows.push({
					path: relative(source, absolute),
					mode: status.isSymbolicLink()
						? '120000'
						: status.mode & 0o111
							? '100755'
							: '100644',
					bytes: bytes.byteLength,
					sha256: sha256(bytes),
					gitSha: gitBlob(bytes),
				});
			} else
				fail(
					'archive-integrity',
					'filesystem-entry-kind',
					'file/symlink',
					'special',
					'Verdaccio archive special entry',
				);
		}
	};
	await visit(source);
	return rows.sort((left, right) => compareText(left.path, right.path));
}

const major = (range: unknown): number | null => {
	if (typeof range !== 'string') return null;
	let digits = '';
	for (const character of range) {
		if (character >= '0' && character <= '9') digits += character;
		else if (digits) break;
	}
	return digits ? Number(digits) : null;
};

async function writeTerminal(error: unknown, state: State): Promise<void> {
	if (await exists(terminalPath)) return;
	const failure =
		error instanceof AdmissionFailure
			? error
			: new AdmissionFailure(
					'publication',
					'unexpected-error',
					'successful publication',
					error instanceof Error ? error.message : String(error),
					'Verdaccio unexpected acquisition failure',
				);
	const unsigned = {
		schemaVersion: 'versionless.react-verdaccio-t682-terminal.v1',
		result: 'terminal-failure',
		consentId: VERDACCIO_CONSENT,
		namespace: VERDACCIO_NAMESPACE,
		promotion: 'none',
		failure: {
			stage: failure.stage,
			property: failure.property,
			expected: failure.expected,
			observed: failure.observed,
			message: failure.message,
		},
		access: state,
		claims: { feasibility: 'not-assessed', reactScore: '1/4', reactPilot: '0/1' },
	};
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		terminalPath,
		`${canonicalize({ ...unsigned, integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(unsigned)) } })}\n`,
		{ flag: 'wx' },
	);
}

export async function acquireVerdaccio(): Promise<void> {
	for (const target of [attemptPath, terminalPath, receiptPath, stageRoot, cacheRoot])
		if (await exists(target)) throw new Error('Verdaccio T682 output collision');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-verdaccio-t682-attempt.v1', consentId: VERDACCIO_CONSENT, namespace: VERDACCIO_NAMESPACE, limits: { refsPerPrefix: 256, apiBytes: apiCap, archiveBytes: archiveCap, aggregateBytes: aggregateCap } })}\n`,
		{ flag: 'wx' },
	);
	const state: State = { acceptedResponses: 0, aggregateBytes: 0, observations: [], ledger: [] };
	try {
		const acquisition = join(stageRoot, 'acquisition');
		const source = join(acquisition, 'source');
		await mkdir(source, { recursive: true });
		const metadataUrl = joinURL('https://registry.npmjs.org', 'verdaccio', '4.12.2');
		const metadata = JSON.parse(
			(await getExact(metadataUrl, 'registry', state)).toString('utf8'),
		) as {
			name?: unknown;
			version?: unknown;
			gitHead?: unknown;
			license?: unknown;
			repository?: string | { url?: unknown };
			dist?: { tarball?: unknown; integrity?: unknown };
		};
		const repositoryUrl =
			typeof metadata.repository === 'string'
				? metadata.repository
				: metadata.repository?.url;
		if (
			metadata.name !== 'verdaccio' ||
			metadata.version !== '4.12.2' ||
			metadata.license !== 'MIT' ||
			typeof metadata.gitHead !== 'string' ||
			!hex40.test(metadata.gitHead.toLowerCase()) ||
			typeof repositoryUrl !== 'string' ||
			!repositoryUrl.toLowerCase().includes('verdaccio/verdaccio') ||
			typeof metadata.dist?.tarball !== 'string' ||
			typeof metadata.dist.integrity !== 'string'
		)
			fail(
				'repository-identity',
				'registry-release-metadata',
				'verdaccio@4.12.2 MIT verdaccio/verdaccio gitHead dist',
				{
					name: metadata.name,
					version: metadata.version,
					license: metadata.license,
					repository: repositoryUrl ?? null,
				},
				'Verdaccio registry metadata differs',
			);
		const gitHead = metadata.gitHead as string;
		const distTarball = metadata.dist?.tarball as string;
		const distIntegrity = metadata.dist?.integrity as string;
		const published = await getExact(distTarball, 'registry', state);
		const integrityParts = distIntegrity.split('-');
		const observedSRI =
			integrityParts[0] === 'sha512'
				? createHash('sha512').update(published).digest('base64')
				: null;
		if (integrityParts.length !== 2 || observedSRI !== integrityParts[1])
			fail(
				'archive-integrity',
				'published-dist-sri',
				distIntegrity,
				observedSRI,
				'Verdaccio published dist integrity differs',
			);
		await writeFile(join(acquisition, 'published.tgz'), published, { flag: 'wx' });
		const selected: Candidate = {
			ref: 'registry:verdaccio@4.12.2',
			version: [4, 12, 2],
			commit: gitHead.toLowerCase(),
			tree: 'not-tested',
			commitDate: '2021-06-23',
		};
		const archiveUrl = joinURL(
			'https://codeload.github.com',
			'verdaccio',
			'verdaccio',
			'tar.gz',
			selected.commit,
		);
		const archiveOne = await getExact(archiveUrl, 'archive', state);
		const archiveTwo = await getExact(archiveUrl, 'archive', state);
		if (!archiveOne.equals(archiveTwo))
			fail(
				'archive-integrity',
				'duplicate-archive-digest',
				sha256(archiveOne),
				sha256(archiveTwo),
				'Verdaccio archives differ',
			);
		const archivePath = join(acquisition, 'source.tar.gz');
		await writeFile(archivePath, archiveOne, { flag: 'wx' });
		const listing = (await execute('/usr/bin/tar', ['-tzf', archivePath]))
			.split('\n')
			.filter(Boolean);
		let archiveRoot: string | undefined;
		for (const entry of listing) {
			const segments = entry.split('/');
			if (entry.startsWith('/') || entry.includes('\\') || segments.includes('..'))
				fail(
					'archive-integrity',
					'safe-path',
					'relative normalized',
					entry,
					'Verdaccio archive path unsafe',
				);
			archiveRoot ??= segments[0];
			if (segments[0] !== archiveRoot)
				fail(
					'archive-integrity',
					'single-root',
					archiveRoot,
					segments[0],
					'Verdaccio archive root differs',
				);
		}
		await execute('/usr/bin/tar', [
			'-xzf',
			archivePath,
			'-C',
			source,
			'--strip-components',
			'1',
		]);
		const rows = await manifest(source);
		const blobs = new Map(rows.map((row) => [row.path, row]));
		const licenseName = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].find((name) =>
			blobs.has(name),
		);
		if (!licenseName)
			fail(
				'rights',
				'root-license',
				'MIT root license',
				'absent',
				'Verdaccio root license absent',
			);
		const license = await readFile(join(source, licenseName as string), 'utf8');
		if (!license.includes('MIT License') || !license.includes('Permission is hereby granted'))
			fail('rights', 'root-mit-text', 'MIT', 'different text', 'Verdaccio license differs');
		type PackageDocument = {
			name?: unknown;
			version?: unknown;
			browser?: unknown;
			main?: unknown;
			source?: unknown;
			dependencies?: Record<string, unknown>;
			devDependencies?: Record<string, unknown>;
			scripts?: Record<string, unknown>;
		};
		const packagePaths = [...blobs.keys()]
			.filter((path) => basename(path) === 'package.json')
			.sort(compareText);
		if (packagePaths.length === 0 || packagePaths.length > 128)
			fail(
				'semantic-qualification',
				'bounded-recursive-packages',
				'1..128',
				packagePaths.length,
				'Verdaccio recursive package inventory differs',
			);
		const documents = new Map<string, PackageDocument>();
		const packageCandidates: VerdaccioPackageCandidate[] = [];
		for (const packagePath of packagePaths) {
			const document = JSON.parse(
				await readFile(join(source, packagePath), 'utf8'),
			) as PackageDocument;
			documents.set(packagePath, document);
			const packageRoot = dirname(packagePath);
			const prefix = packageRoot === '.' ? '' : `${packageRoot}/`;
			const scopedRows = rows.filter((row) => !prefix || row.path.startsWith(prefix));
			const texts: string[] = [];
			for (const row of scopedRows)
				if (
					['.js', '.jsx', '.ts', '.tsx'].some((extension) => row.path.endsWith(extension))
				)
					texts.push((await readFile(join(source, row.path), 'utf8')).toLowerCase());
			const corpus = texts.join('\n');
			const ownedWebpackConfigs = scopedRows.filter(
				(row) =>
					basename(row.path).toLowerCase().includes('webpack') &&
					['.js', '.ts'].some((extension) => row.path.endsWith(extension)),
			).length;
			packageCandidates.push({
				path: packagePath,
				name: typeof document.name === 'string' ? document.name : null,
				reactMajor: major(document.dependencies?.react ?? document.devDependencies?.react),
				webpackMajor: major(
					document.devDependencies?.webpack ?? document.dependencies?.webpack,
				),
				ownedWebpackConfigs,
				browserEntry:
					typeof document.browser === 'string' ||
					typeof document.browser === 'object' ||
					typeof document.main === 'string' ||
					typeof document.source === 'string' ||
					scopedRows.some((row) => row.path.includes('/src/index.')),
				search: corpus.includes('search'),
				detail:
					corpus.includes('detail') ||
					corpus.includes('readme') ||
					corpus.includes('package'),
				auth: corpus.includes('login') || corpus.includes('auth'),
				registryApi:
					corpus.includes('registry') ||
					corpus.includes('/-/') ||
					corpus.includes('package'),
			});
		}
		const selectedPackage = (() => {
			try {
				return discoverVerdaccioApplicationPackage(packageCandidates);
			} catch (error) {
				return fail(
					'semantic-qualification',
					'unique-recursive-application-package',
					'one eligible package',
					packageCandidates,
					error instanceof Error ? error.message : 'Verdaccio package discovery failed',
				);
			}
		})();
		const packageDocument = documents.get(selectedPackage.path) as PackageDocument;
		const reactMajor = selectedPackage.reactMajor;
		const webpackMajor = selectedPackage.webpackMajor;
		const locks = ['yarn.lock', 'package-lock.json', 'pnpm-lock.yaml'].filter((name) =>
			blobs.has(name),
		);
		const selectedRoot = dirname(selectedPackage.path);
		const selectedPrefix = selectedRoot === '.' ? '' : `${selectedRoot}/`;
		const ownedWebpackConfigs = [...blobs.keys()].filter(
			(path) =>
				(!selectedPrefix || path.startsWith(selectedPrefix)) &&
				basename(path).toLowerCase().includes('webpack') &&
				['.js', '.ts'].some((extension) => path.endsWith(extension)),
		);
		const sourceTexts: string[] = [];
		for (const row of rows)
			if (
				(!selectedPrefix || row.path.startsWith(selectedPrefix)) &&
				['.js', '.jsx', '.ts', '.tsx'].some((extension) => row.path.endsWith(extension))
			)
				sourceTexts.push((await readFile(join(source, row.path), 'utf8')).toLowerCase());
		const corpus = sourceTexts.join('\n');
		const properties = [
			{
				property: 'application-identity',
				expected: 'Verdaccio application',
				observed: packageDocument.name,
				pass:
					typeof packageDocument.name === 'string' &&
					packageDocument.name.toLowerCase().includes('verdaccio') &&
					typeof packageDocument.scripts?.build === 'string',
			},
			{
				property: 'react-major-family',
				expected: '16 or 17',
				observed: reactMajor,
				pass: reactMajor === 16 || reactMajor === 17,
			},
			{
				property: 'webpack-major-family',
				expected: '4 or 5 with owned config',
				observed: { major: webpackMajor, configs: ownedWebpackConfigs.length },
				pass: (webpackMajor === 4 || webpackMajor === 5) && ownedWebpackConfigs.length > 0,
			},
			{
				property: 'authoritative-lock',
				expected: 'exactly one committed lock',
				observed: locks,
				pass: locks.length === 1,
			},
			{
				property: 'search-route-concept',
				expected: 'search route/state',
				observed: corpus.includes('search'),
				pass:
					corpus.includes('search') &&
					(corpus.includes('route') || corpus.includes('path')),
			},
			{
				property: 'package-detail-capability',
				expected: 'package detail/readme capability',
				observed: corpus.includes('detail') || corpus.includes('readme'),
				pass: corpus.includes('detail') || corpus.includes('readme'),
			},
			{
				property: 'authentication-capability',
				expected: 'login/auth capability',
				observed: corpus.includes('login') || corpus.includes('auth'),
				pass: corpus.includes('login') || corpus.includes('auth'),
			},
			{
				property: 'registry-capability',
				expected: 'registry/package API capability',
				observed: corpus.includes('registry') || corpus.includes('/-/'),
				pass: corpus.includes('registry') || corpus.includes('/-/'),
			},
			{
				property: 'configurable-same-origin-api',
				expected: 'configurable or relative API base',
				observed:
					corpus.includes('apiprefix') ||
					corpus.includes('api_prefix') ||
					corpus.includes('baseurl') ||
					corpus.includes("'/api"),
				pass:
					corpus.includes('apiprefix') ||
					corpus.includes('api_prefix') ||
					corpus.includes('baseurl') ||
					corpus.includes("'/api"),
			},
			{
				property: 'source-service-worker',
				expected: 'absent',
				observed:
					corpus.includes('serviceworker.register') ||
					corpus.includes('serviceworkermodule.register'),
				pass:
					!corpus.includes('serviceworker.register') &&
					!corpus.includes('serviceworkermodule.register'),
			},
		] as const;
		for (const property of properties)
			if (!property.pass)
				fail(
					'semantic-qualification',
					property.property,
					property.expected,
					property.observed,
					`Verdaccio semantic property failed: ${property.property}`,
				);
		const unsigned = {
			schemaVersion: 'versionless.react-verdaccio-ingest.v1',
			result: 'source-qualified',
			consentId: VERDACCIO_CONSENT,
			namespace: VERDACCIO_NAMESPACE,
			source: {
				...selected,
				archiveSha256: sha256(archiveOne),
				manifestDigest: sha256(canonicalize(rows)),
				files: rows.length,
				gitTreeParity: 'not-tested',
				publishedDistSha256: sha256(published),
				publishedDistSha512: createHash('sha512').update(published).digest('hex'),
				publishedDistSRI: distIntegrity,
			},
			product: {
				packagePath: selectedPackage.path,
				candidates: packageCandidates,
				name: packageDocument.name,
				version: packageDocument.version,
				reactMajor,
				webpackMajor,
				webpackConfigs: ownedWebpackConfigs,
				lock: locks[0],
				semanticProperties: properties.map(({ property, expected, observed, pass }) => ({
					property,
					expected,
					observed,
					pass,
				})),
			},
			registryProvenance: {
				name: metadata.name,
				version: metadata.version,
				repository: repositoryUrl,
				license: metadata.license,
				gitHead,
				metadataUrl,
				distTarball,
			},
			license: {
				rootExpression: 'MIT',
				redistributionAuthorized: false,
				legalReviewRequired: true,
			},
			access: state,
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

export async function verifyVerdaccioIngest(): Promise<{
	valid: true;
	digest: string;
	files: number;
}> {
	const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as {
		source: { manifestDigest: string; files: number };
		integrity: { canonicalDigest: string };
		[key: string]: unknown;
	};
	const cached = JSON.parse(
		await readFile(join(cacheRoot, 'acquisition/receipt.json'), 'utf8'),
	) as typeof receipt;
	if (canonicalize(receipt) !== canonicalize(cached))
		throw new Error('Verdaccio receipt publication differs');
	const { integrity, ...unsigned } = receipt;
	if (integrity.canonicalDigest !== sha256(canonicalize(unsigned)))
		throw new Error('Verdaccio receipt integrity differs');
	const rows = await manifest(join(cacheRoot, 'acquisition/source'));
	if (
		rows.length !== receipt.source.files ||
		sha256(canonicalize(rows)) !== receipt.source.manifestDigest
	)
		throw new Error('Verdaccio offline source replay differs');
	return { valid: true, digest: integrity.canonicalDigest, files: rows.length };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const mode = parseVerdaccioLauncher(args);
	if (mode === 'acquire') await acquireVerdaccio();
	process.stdout.write(`${canonicalize(await verifyVerdaccioIngest())}\n`);
}
if (basename(process.argv[1] ?? '') === 'react-verdaccio-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
