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
import { charIn, createRegExp } from 'magic-regexp';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { qualifyPermissiveLicense } from '../../../core/src/rights/license.ts';
import {
	AcquisitionFailure,
	type AcquisitionState,
	type ExactRequestDescriptor,
} from '../../../core/src/acquisition/transaction.ts';
import {
	acquireExactResponse,
	verifyDurableResponses,
	type AcquisitionTransaction,
} from '../acquisition/https-transaction.ts';

export const KAFKA_UI_CONSENT = 'T690-kafka-ui-v0-3-3-production-acquisition' as const;
export const KAFKA_UI_NAMESPACE = 't690' as const;

const root = resolve(import.meta.dirname, '../../../..');
const evidenceRoot = join(root, 'evidence/ingests/react-kafka-ui-v0-3-3/t690');
const attemptPath = join(evidenceRoot, 'attempt.json');
const terminalPath = join(evidenceRoot, 'terminal.json');
const receiptPath = join(evidenceRoot, 'receipt.json');
const stageRoot = join(root, '.versionless/cache/react-kafka-ui-v0-3-3-stage-t690');
const cacheRoot = join(root, '.versionless/cache/react-kafka-ui-v0-3-3-source-t690');
const hex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const apiCap = 16 * 1024 * 1024;
const archiveCap = 256 * 1024 * 1024;
const aggregateCap = 1024 * 1024 * 1024;
const durableNetworkRoot = join(stageRoot, 'acquisition/network');

type Candidate = {
	ref: string;
	version: readonly [number, number, number];
	commit: string;
	tree: string;
	commitDate: string;
};
export type KafkaUiNetworkState = AcquisitionState;
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

export function parseKafkaUiLauncher(args: readonly string[]): 'acquire' | 'verify' | 'preflight' {
	if (args.at(-2) !== '--namespace' || args.at(-1) !== KAFKA_UI_NAMESPACE)
		throw new Error('KafkaUi namespace differs');
	const leading = args.slice(0, -2);
	if (
		leading.length === 1 &&
		leading[0] === '--preflight' &&
		process.env.VERSIONLESS_NETWORK_MODE === undefined &&
		process.env.VERSIONLESS_CONSENT_ID === undefined
	)
		return 'preflight';
	if (
		leading.length === 2 &&
		leading[0] === '--consent-id' &&
		leading[1] === KAFKA_UI_CONSENT &&
		process.env.VERSIONLESS_NETWORK_MODE === 'consented' &&
		process.env.VERSIONLESS_CONSENT_ID === KAFKA_UI_CONSENT
	)
		return 'acquire';
	if (
		leading.length === 1 &&
		leading[0] === '--verify-offline' &&
		process.env.VERSIONLESS_NETWORK_MODE === 'offline' &&
		process.env.VERSIONLESS_CONSENT_ID === undefined
	)
		return 'verify';
	throw new Error('KafkaUi launcher boundary differs');
}

export function parseKafkaUiJsonc(text: string, path: string): unknown {
	if (Buffer.byteLength(text) > 4 * 1024 * 1024)
		throw new Error(`${path}:1:1:manifest-too-large`);
	const input = text.startsWith('\uFEFF') ? ` ${text.slice(1)}` : text;
	const characters = [...input];
	let inString = false;
	let escaped = false;
	for (let index = 0; index < characters.length; index += 1) {
		const current = characters[index];
		if (inString) {
			if (escaped) escaped = false;
			else if (current === '\\') escaped = true;
			else if (current === '"') inString = false;
			continue;
		}
		if (current === '"') {
			inString = true;
			continue;
		}
		if (current === '/' && characters[index + 1] === '/') {
			characters[index] = ' ';
			characters[index + 1] = ' ';
			index += 2;
			while (index < characters.length && characters[index] !== '\n') {
				characters[index] = ' ';
				index += 1;
			}
			index -= 1;
		} else if (current === '/' && characters[index + 1] === '*') {
			characters[index] = ' ';
			characters[index + 1] = ' ';
			index += 2;
			let closed = false;
			while (index < characters.length) {
				if (characters[index] === '*' && characters[index + 1] === '/') {
					characters[index] = ' ';
					characters[index + 1] = ' ';
					closed = true;
					index += 1;
					break;
				}
				if (characters[index] !== '\n') characters[index] = ' ';
				index += 1;
			}
			if (!closed) throw new Error(`${path}:1:1:unterminated-block-comment`);
		}
	}
	for (let index = 0; index < characters.length; index += 1) {
		if (characters[index] !== ',') continue;
		let next = index + 1;
		while (next < characters.length && characters[next]?.trim() === '') next += 1;
		if (characters[next] === '}' || characters[next] === ']') characters[index] = ' ';
	}
	const sanitized = characters.join('');
	const objectKeys: Array<Set<string>> = [];
	for (let index = 0; index < characters.length; index += 1) {
		if (characters[index] === '{') {
			objectKeys.push(new Set());
			continue;
		}
		if (characters[index] === '}') {
			objectKeys.pop();
			continue;
		}
		if (characters[index] !== '"' || objectKeys.length === 0) continue;
		const start = index;
		index += 1;
		let localEscaped = false;
		while (index < characters.length) {
			if (localEscaped) localEscaped = false;
			else if (characters[index] === '\\') localEscaped = true;
			else if (characters[index] === '"') break;
			index += 1;
		}
		let next = index + 1;
		while (next < characters.length && characters[next]?.trim() === '') next += 1;
		if (characters[next] !== ':') continue;
		const key = JSON.parse(sanitized.slice(start, index + 1)) as string;
		const keys = objectKeys.at(-1) as Set<string>;
		if (keys.has(key)) throw new Error(`${path}:1:${start + 1}:duplicate-key`);
		keys.add(key);
	}
	try {
		return JSON.parse(sanitized) as unknown;
	} catch (error) {
		throw new Error(
			`${path}:1:1:invalid-jsonc:${error instanceof SyntaxError ? 'syntax' : 'unknown'}`,
		);
	}
}

export type KafkaUiPackageCandidate = Readonly<{
	path: string;
	name: string | null;
	reactMajor: number | null;
	webpackMajor: number | null;
	umiMajor?: number | null;
	craMajor?: number | null;
	ownedWebpackConfigs: number;
	browserEntry: boolean;
	search: boolean;
	detail: boolean;
	auth: boolean;
	registryApi: boolean;
}>;

export function discoverKafkaUiApplicationPackage(
	candidates: readonly KafkaUiPackageCandidate[],
): KafkaUiPackageCandidate {
	const scored = candidates
		.map((candidate) => ({
			candidate,
			score:
				(candidate.name?.toLowerCase().includes('kafka-ui') ? 1 : 0) +
				(candidate.reactMajor === 16 || candidate.reactMajor === 17 ? 3 : 0) +
				(candidate.webpackMajor === 4 ||
				candidate.webpackMajor === 5 ||
				candidate.craMajor === 4 ||
				candidate.craMajor === 5
					? 2
					: 0) +
				(candidate.ownedWebpackConfigs > 0 ? 2 : 0) +
				(candidate.browserEntry ? 2 : 0) +
				(candidate.search ? 1 : 0) +
				(candidate.detail ? 1 : 0) +
				(candidate.registryApi ? 1 : 0),
			eligible:
				(candidate.reactMajor === 16 || candidate.reactMajor === 17) &&
				(candidate.webpackMajor === 4 ||
					candidate.webpackMajor === 5 ||
					candidate.craMajor === 4 ||
					candidate.craMajor === 5) &&
				candidate.ownedWebpackConfigs > 0 &&
				candidate.browserEntry &&
				candidate.search &&
				candidate.detail &&
				candidate.registryApi,
		}))
		.filter((row) => row.eligible)
		.sort(
			(left, right) =>
				right.score - left.score || compareText(left.candidate.path, right.candidate.path),
		);
	if (!scored[0]) throw new Error('KafkaUi authentic nested web UI package is absent');
	if (scored[1]?.score === scored[0].score)
		throw new Error('KafkaUi authentic nested web UI package is ambiguous');
	return scored[0].candidate;
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
					'KafkaUi archive special entry',
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

async function writeTerminal(error: unknown, state: KafkaUiNetworkState): Promise<void> {
	if (await exists(terminalPath)) return;
	const failure =
		error instanceof AdmissionFailure || error instanceof AcquisitionFailure
			? error
			: new AdmissionFailure(
					'publication',
					'unexpected-error',
					'successful publication',
					error instanceof Error ? error.message : String(error),
					'KafkaUi unexpected acquisition failure',
				);
	const unsigned = {
		schemaVersion: 'versionless.react-kafka-ui-v0-3-3-t690-terminal.v1',
		result: 'terminal-failure',
		consentId: KAFKA_UI_CONSENT,
		namespace: KAFKA_UI_NAMESPACE,
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

export async function acquireKafkaUi(): Promise<void> {
	for (const target of [attemptPath, terminalPath, receiptPath, stageRoot, cacheRoot])
		if (await exists(target)) throw new Error('KafkaUi T690 output collision');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-kafka-ui-v0-3-3-t690-attempt.v1', consentId: KAFKA_UI_CONSENT, namespace: KAFKA_UI_NAMESPACE, limits: { apiBytes: apiCap, archiveBytes: archiveCap, aggregateBytes: aggregateCap } })}\n`,
		{ flag: 'wx' },
	);
	const state: KafkaUiNetworkState = {
		acceptedResponses: 0,
		aggregateBytes: 0,
		observations: [],
		ledger: [],
	};
	const transaction: AcquisitionTransaction = {
		consentId: KAFKA_UI_CONSENT,
		durableRoot: durableNetworkRoot,
		metadataCap: apiCap,
		archiveCap,
		aggregateCap,
	};
	const exact = (descriptor: ExactRequestDescriptor): Promise<Buffer> =>
		acquireExactResponse(transaction, descriptor, state);
	try {
		const acquisition = join(stageRoot, 'acquisition');
		const source = join(acquisition, 'source');
		await mkdir(source, { recursive: true });
		const repository = JSON.parse(
			(
				await exact({
					host: 'api.github.com',
					path: ['repos', 'provectus', 'kafka-ui'],
					purpose: 'official repository identity',
					responseKind: 'json',
				})
			).toString('utf8'),
		) as { full_name?: unknown };
		if (
			typeof repository.full_name !== 'string' ||
			repository.full_name.toLowerCase() !== 'provectus/kafka-ui'
		)
			fail(
				'repository-identity',
				'canonical-full-name',
				'provectus/kafka-ui',
				repository.full_name ?? null,
				'KafkaUi repository identity differs',
			);
		const ref = JSON.parse(
			(
				await exact({
					host: 'api.github.com',
					path: ['repos', 'provectus', 'kafka-ui', 'git', 'ref', 'tags', 'v0.3.3'],
					purpose: 'exact v0.3.3 release ref',
					responseKind: 'json',
				})
			).toString('utf8'),
		) as { ref?: unknown; object?: { type?: unknown; sha?: unknown } };
		if (
			ref.ref !== 'refs/tags/v0.3.3' ||
			(ref.object?.type !== 'commit' && ref.object?.type !== 'tag') ||
			typeof ref.object.sha !== 'string' ||
			!hex40.test(ref.object.sha)
		)
			fail(
				'immutable-lineage',
				'exact-v0.3.3-ref',
				'refs/tags/v0.3.3',
				ref.ref ?? null,
				'KafkaUi exact tag differs',
			);
		let objectType = ref.object?.type as 'commit' | 'tag';
		let commitSha = ref.object?.sha as string;
		for (let depth = 0; objectType === 'tag' && depth < 4; depth += 1) {
			const tag = JSON.parse(
				(
					await exact({
						host: 'api.github.com',
						path: ['repos', 'provectus', 'kafka-ui', 'git', 'tags', commitSha],
						purpose: `dereference annotated tag depth ${depth + 1}`,
						responseKind: 'json',
					})
				).toString('utf8'),
			) as { sha?: unknown; object?: { type?: unknown; sha?: unknown } };
			if (
				tag.sha !== commitSha ||
				(tag.object?.type !== 'commit' && tag.object?.type !== 'tag') ||
				typeof tag.object.sha !== 'string' ||
				!hex40.test(tag.object.sha)
			)
				fail(
					'immutable-lineage',
					'annotated-tag-peel',
					commitSha,
					tag.sha ?? null,
					'KafkaUi tag lineage differs',
				);
			objectType = tag.object?.type as 'commit' | 'tag';
			commitSha = tag.object?.sha as string;
		}
		if (objectType !== 'commit')
			fail(
				'immutable-lineage',
				'annotated-tag-depth',
				'<=4',
				'>4',
				'KafkaUi tag peel exceeded',
			);
		const commit = JSON.parse(
			(
				await exact({
					host: 'api.github.com',
					path: ['repos', 'provectus', 'kafka-ui', 'git', 'commits', commitSha],
					purpose: 'exact dereferenced commit',
					responseKind: 'json',
				})
			).toString('utf8'),
		) as { sha?: unknown; tree?: { sha?: unknown }; committer?: { date?: unknown } };
		if (
			commit.sha !== commitSha ||
			typeof commit.tree?.sha !== 'string' ||
			!hex40.test(commit.tree.sha) ||
			typeof commit.committer?.date !== 'string' ||
			commit.committer.date > '2021-12-31T23:59:59Z'
		)
			fail(
				'immutable-lineage',
				'commit-tree-date',
				'exact commit/tree dated <=2021-12-31',
				{ sha: commit.sha ?? null, date: commit.committer?.date ?? null },
				'KafkaUi commit lineage differs',
			);
		const treeSha = commit.tree?.sha as string;
		const commitDate = commit.committer?.date as string;
		const tree = JSON.parse(
			(
				await exact({
					host: 'api.github.com',
					path: ['repos', 'provectus', 'kafka-ui', 'git', 'trees', treeSha],
					query: { recursive: '1' },
					purpose: 'exact recursive commit tree',
					responseKind: 'json',
				})
			).toString('utf8'),
		) as {
			sha?: unknown;
			truncated?: unknown;
			tree?: Array<{ path?: unknown; mode?: unknown; type?: unknown; sha?: unknown }>;
		};
		if (tree.sha !== treeSha || tree.truncated !== false)
			fail(
				'immutable-lineage',
				'untruncated-tree',
				treeSha,
				tree.sha ?? null,
				'KafkaUi tree differs',
			);
		const selected: Candidate = {
			ref: 'release:v0.3.3',
			version: [0, 3, 3],
			commit: commitSha,
			tree: treeSha,
			commitDate,
		};
		const archiveOne = await exact({
			host: 'codeload.github.com',
			path: ['provectus', 'kafka-ui', 'tar.gz', selected.commit],
			purpose: 'exact commit archive duplicate 1',
			responseKind: 'archive',
			intentionalDuplicateIndex: 1,
		});
		const archiveTwo = await exact({
			host: 'codeload.github.com',
			path: ['provectus', 'kafka-ui', 'tar.gz', selected.commit],
			purpose: 'exact commit archive duplicate 2',
			responseKind: 'archive',
			intentionalDuplicateIndex: 2,
		});
		if (!archiveOne.equals(archiveTwo))
			fail(
				'archive-integrity',
				'duplicate-archive-digest',
				sha256(archiveOne),
				sha256(archiveTwo),
				'KafkaUi archives differ',
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
					'KafkaUi archive path unsafe',
				);
			archiveRoot ??= segments[0];
			if (segments[0] !== archiveRoot)
				fail(
					'archive-integrity',
					'single-root',
					archiveRoot,
					segments[0],
					'KafkaUi archive root differs',
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
		const treeFiles = (tree.tree ?? [])
			.filter((entry) => entry.type === 'blob')
			.map((entry) => ({
				path: typeof entry.path === 'string' ? entry.path : '',
				mode: typeof entry.mode === 'string' ? entry.mode : '',
				gitSha: typeof entry.sha === 'string' ? entry.sha : '',
			}))
			.sort((left, right) => compareText(left.path, right.path));
		const manifestTreeRows = rows.map(({ path, mode, gitSha }) => ({ path, mode, gitSha }));
		if (canonicalize(treeFiles) !== canonicalize(manifestTreeRows))
			fail(
				'archive-integrity',
				'git-tree-archive-parity',
				{ files: treeFiles.length, digest: sha256(canonicalize(treeFiles)) },
				{ files: manifestTreeRows.length, digest: sha256(canonicalize(manifestTreeRows)) },
				'KafkaUi archive differs from the exact untruncated Git tree',
			);
		const blobs = new Map(rows.map((row) => [row.path, row]));
		const licenseName = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].find((name) =>
			blobs.has(name),
		);
		if (!licenseName)
			fail(
				'rights',
				'root-license',
				'canonical MIT or Apache-2.0 root license',
				'absent',
				'KafkaUi root license absent',
			);
		const license = await readFile(join(source, licenseName as string), 'utf8');
		const licenseQualification = qualifyPermissiveLicense(license);
		if (!licenseQualification)
			fail(
				'rights',
				'root-permissive-license-content',
				'canonical MIT or Apache-2.0 content',
				'different or ambiguous text',
				'KafkaUi license differs',
			);
		const qualifiedLicense = licenseQualification as NonNullable<typeof licenseQualification>;
		if (qualifiedLicense.family !== 'Apache-2.0')
			fail(
				'rights',
				'root-license-family',
				'Apache-2.0',
				qualifiedLicense.family,
				'KafkaUi license family differs',
			);
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
		if (packagePaths.length === 0 || packagePaths.length > 512)
			fail(
				'semantic-qualification',
				'bounded-recursive-packages',
				'1..512',
				packagePaths.length,
				'KafkaUi recursive package inventory differs',
			);
		const documents = new Map<string, PackageDocument>();
		const packageCandidates: KafkaUiPackageCandidate[] = [];
		const productCapabilityTexts: string[] = [];
		for (const row of rows)
			if (['.js', '.jsx', '.ts', '.tsx'].some((extension) => row.path.endsWith(extension)))
				productCapabilityTexts.push(
					(await readFile(join(source, row.path), 'utf8')).toLowerCase(),
				);
		const productCapabilityCorpus = productCapabilityTexts.join('\n');
		for (const packagePath of packagePaths) {
			const document = parseKafkaUiJsonc(
				await readFile(join(source, packagePath), 'utf8'),
				packagePath,
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
					(basename(row.path).toLowerCase().includes('webpack') ||
						row.path.includes('.umirc') ||
						row.path.includes('/config/')) &&
					['.js', '.ts'].some((extension) => row.path.endsWith(extension)),
			).length;
			packageCandidates.push({
				path: packagePath,
				name: typeof document.name === 'string' ? document.name : null,
				reactMajor: major(document.dependencies?.react ?? document.devDependencies?.react),
				webpackMajor: major(
					document.devDependencies?.webpack ?? document.dependencies?.webpack,
				),
				umiMajor: major(document.dependencies?.umi ?? document.devDependencies?.umi),
				craMajor: major(
					document.dependencies?.['react-scripts'] ??
						document.devDependencies?.['react-scripts'],
				),
				ownedWebpackConfigs,
				browserEntry:
					typeof document.browser === 'string' ||
					typeof document.browser === 'object' ||
					typeof document.main === 'string' ||
					typeof document.source === 'string' ||
					scopedRows.some((row) => row.path.includes('/src/index.')),
				search:
					productCapabilityCorpus.includes('cluster') &&
					productCapabilityCorpus.includes('topic') &&
					productCapabilityCorpus.includes('search'),
				detail:
					productCapabilityCorpus.includes('topic') &&
					(productCapabilityCorpus.includes('record') ||
						productCapabilityCorpus.includes('message')),
				auth: corpus.includes('login') || corpus.includes('auth'),
				registryApi:
					(corpus.includes('request') || corpus.includes('api')) &&
					corpus.includes('topic') &&
					(corpus.includes('create') || corpus.includes('produce')),
			});
		}
		const selectedPackage = (() => {
			try {
				return discoverKafkaUiApplicationPackage(packageCandidates);
			} catch (error) {
				return fail(
					'semantic-qualification',
					'unique-recursive-application-package',
					'one eligible package',
					packageCandidates,
					error instanceof Error ? error.message : 'KafkaUi package discovery failed',
				);
			}
		})();
		const packageDocument = documents.get(selectedPackage.path) as PackageDocument;
		const reactMajor = selectedPackage.reactMajor;
		const webpackMajor = selectedPackage.webpackMajor;
		const umiMajor = selectedPackage.umiMajor ?? null;
		const craMajor = selectedPackage.craMajor ?? null;
		const selectedRoot = dirname(selectedPackage.path);
		const selectedPrefix = selectedRoot === '.' ? '' : `${selectedRoot}/`;
		const locks = [...blobs.keys()].filter((path) => {
			const name = basename(path);
			return (
				['yarn.lock', 'package-lock.json', 'pnpm-lock.yaml'].includes(name) &&
				(dirname(path) === '.' || dirname(path) === selectedRoot)
			);
		});
		const ownedWebpackConfigs = [...blobs.keys()].filter(
			(path) =>
				(!selectedPrefix || path.startsWith(selectedPrefix)) &&
				(basename(path).toLowerCase().includes('webpack') ||
					path.includes('.umirc') ||
					path.includes('/config/') ||
					path.toLowerCase().includes('craco')) &&
				['.js', '.ts'].some((extension) => path.endsWith(extension)),
		);
		const sourceTexts: string[] = [];
		for (const row of rows)
			if (
				(!selectedPrefix || row.path.startsWith(selectedPrefix)) &&
				['.js', '.jsx', '.ts', '.tsx'].some((extension) => row.path.endsWith(extension))
			)
				sourceTexts.push((await readFile(join(source, row.path), 'utf8')).toLowerCase());
		const corpus = `${sourceTexts.join('\n')}\n${productCapabilityCorpus}`;
		const emittedWorkerSources = rows
			.map((row) => row.path.toLowerCase())
			.filter(
				(path) =>
					(path.includes('/public/') || path.startsWith('public/')) &&
					(basename(path) === 'service-worker.js' || basename(path) === 'sw.js'),
			);
		const serviceWorkerRegistration =
			corpus.includes('navigator.serviceworker.register') ||
			corpus.includes('serviceworker.register') ||
			corpus.includes('serviceworkerregistration.register');
		const pwaBuildPlugin =
			corpus.includes('workboxwebpackplugin') ||
			corpus.includes('generatesw(') ||
			corpus.includes('injectmanifest(');
		const properties = [
			{
				property: 'application-identity',
				expected: 'KafkaUi application',
				observed: packageDocument.name,
				pass:
					typeof packageDocument.name === 'string' &&
					packageDocument.name.toLowerCase().includes('kafka-ui') &&
					typeof packageDocument.scripts?.build === 'string',
			},
			{
				property: 'react-major-family',
				expected: '16 or 17',
				observed: reactMajor,
				pass: reactMajor === 16 || reactMajor === 17,
			},
			{
				property: 'cra-or-webpack-family',
				expected: 'CRA 4/5 or webpack 4/5 with owned build config',
				observed: { craMajor, webpackMajor, configs: ownedWebpackConfigs.length },
				pass:
					(craMajor === 4 ||
						craMajor === 5 ||
						webpackMajor === 4 ||
						webpackMajor === 5) &&
					ownedWebpackConfigs.length > 0,
			},
			{
				property: 'authoritative-lock',
				expected: 'exactly one committed lock',
				observed: locks,
				pass: locks.length === 1,
			},
			{
				property: 'cluster-topic-capability',
				expected: 'cluster/topic capability',
				observed: corpus.includes('cluster') && corpus.includes('topic'),
				pass: corpus.includes('cluster') && corpus.includes('topic'),
			},
			{
				property: 'topic-search-create-record-capability',
				expected: 'search/create topic and produce/inspect record capability',
				observed:
					corpus.includes('search') &&
					corpus.includes('create') &&
					corpus.includes('topic') &&
					(corpus.includes('record') || corpus.includes('message')),
				pass:
					corpus.includes('search') &&
					corpus.includes('create') &&
					corpus.includes('topic') &&
					(corpus.includes('record') || corpus.includes('message')),
			},
			{
				property: 'topic-record-api-capability',
				expected: 'topic create and record produce/inspect API capability',
				observed:
					corpus.includes('topic') &&
					(corpus.includes('produce') || corpus.includes('message')) &&
					(corpus.includes('request') || corpus.includes('api')),
				pass:
					corpus.includes('topic') &&
					(corpus.includes('produce') || corpus.includes('message')) &&
					(corpus.includes('request') || corpus.includes('api')),
			},
			{
				property: 'configurable-same-origin-api',
				expected: 'configurable or relative API base',
				observed:
					corpus.includes('apiprefix') ||
					corpus.includes('api_prefix') ||
					corpus.includes('baseurl') ||
					corpus.includes('basepath') ||
					corpus.includes("'/api") ||
					corpus.includes('"/api'),
				pass:
					corpus.includes('apiprefix') ||
					corpus.includes('api_prefix') ||
					corpus.includes('baseurl') ||
					corpus.includes('basepath') ||
					corpus.includes("'/api") ||
					corpus.includes('"/api'),
			},
			{
				property: 'source-service-worker',
				expected: 'absent',
				observed: {
					registration: serviceWorkerRegistration,
					pwaBuildPlugin,
					emittedWorkerSources,
				},
				pass:
					!serviceWorkerRegistration &&
					!pwaBuildPlugin &&
					emittedWorkerSources.length === 0,
			},
		] as const;
		for (const property of properties)
			if (!property.pass)
				fail(
					'semantic-qualification',
					property.property,
					property.expected,
					property.observed,
					`KafkaUi semantic property failed: ${property.property}`,
				);
		const unsigned = {
			schemaVersion: 'versionless.react-kafka-ui-v0-3-3-ingest.v1',
			result: 'source-qualified',
			consentId: KAFKA_UI_CONSENT,
			namespace: KAFKA_UI_NAMESPACE,
			source: {
				...selected,
				archiveSha256: sha256(archiveOne),
				manifestDigest: sha256(canonicalize(rows)),
				files: rows.length,
				gitTreeParity: 'verified-by-untruncated-api-tree-and-archive-manifest',
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
			repositoryProvenance: {
				name: 'provectus/kafka-ui',
				version: '0.3.3',
				commit: selected.commit,
				ref: 'refs/tags/v0.3.3',
				durableJournal: 'acquisition/network/journal.ndjson',
			},
			license: {
				rootExpression: qualifiedLicense.family,
				qualification: qualifiedLicense,
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

export async function verifyKafkaUiIngest(): Promise<{
	valid: true;
	digest: string;
	files: number;
}> {
	const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as {
		source: { manifestDigest: string; files: number };
		access: AcquisitionState;
		integrity: { canonicalDigest: string };
		[key: string]: unknown;
	};
	const cached = JSON.parse(
		await readFile(join(cacheRoot, 'acquisition/receipt.json'), 'utf8'),
	) as typeof receipt;
	if (canonicalize(receipt) !== canonicalize(cached))
		throw new Error('KafkaUi receipt publication differs');
	const { integrity, ...unsigned } = receipt;
	if (integrity.canonicalDigest !== sha256(canonicalize(unsigned)))
		throw new Error('KafkaUi receipt integrity differs');
	await verifyDurableResponses(
		{
			consentId: KAFKA_UI_CONSENT,
			durableRoot: join(cacheRoot, 'acquisition/network'),
			metadataCap: apiCap,
			archiveCap,
			aggregateCap,
		},
		receipt.access.ledger,
	);
	const rows = await manifest(join(cacheRoot, 'acquisition/source'));
	if (
		rows.length !== receipt.source.files ||
		sha256(canonicalize(rows)) !== receipt.source.manifestDigest
	)
		throw new Error('KafkaUi offline source replay differs');
	return { valid: true, digest: integrity.canonicalDigest, files: rows.length };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const mode = parseKafkaUiLauncher(args);
	if (mode === 'preflight') {
		process.stdout.write('{"preflight":"pass"}\n');
		return;
	}
	if (mode === 'acquire') await acquireKafkaUi();
	process.stdout.write(`${canonicalize(await verifyKafkaUiIngest())}\n`);
}
if (basename(process.argv[1] ?? '') === 'react-kafka-ui-v0-3-3-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
