import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import {
	assertVite8KernelEvidence,
	assertVite8Restoration,
	canonicalize,
	compareUtf16CodeUnits,
	sha256,
	type Vite8KernelEvidence,
	type Vite8OutputEntry,
} from '../../../core/src/index.ts';
import * as path from 'pathe';
import { joinURL, parseURL } from 'ufo';
import {
	verifyAngularPhonecatVite8,
	type AngularPhonecatVite8PortPlan,
} from './angular-phonecat-vite8-run.ts';
import {
	verifyReactBoilerplateVite8,
	type ReactVite8PortPlan,
} from './react-boilerplate-v4-vite8-run.ts';

const sourceDirectory = import.meta.dirname;
const root =
	path.basename(sourceDirectory) === 'dist'
		? path.resolve(sourceDirectory, '../../..')
		: path.resolve(sourceDirectory, '../../../..');
const defaultWork = path.join(root, '.versionless/work/vite8-shared-adapter-cohort');
const defaultOutput = path.join(root, 'evidence/runs/vite8-shared-adapter-cohort');
const reactAdapter = path.join(root, 'fixtures/react-boilerplate-v4-vite8/vite.shared-adapter.ts');
const phonecatAdapter = path.join(root, 'fixtures/angular-phonecat-vite8/vite.shared-adapter.ts');
const reactCanonical = path.join(root, 'evidence/runs/react-boilerplate-v4-vite8');
const phonecatCanonical = path.join(root, 'evidence/runs/angular-phonecat-vite8');
const reactProjectionSha256 = 'ae8e56f535f8fed4a061cfefce40837ecc20ce4787da2b448cedb7f2429ac609';
const phonecatJourneySha256 = '299308578fc043f3d09d3e189c1e14a9b1d12d4f42df37dfbf89bb9c4c2e1300';
const immutable = {
	react: {
		digest: '1caf9dfa24b14b83ac63ceab9ca90829346045aac690c7b95a952ae4d9e72849',
		receipt: 'cfe6181b172a73dc8ebcb3f1a286edec80fe17fd58ea7208c4181214878226f1',
		adapter: '2171a9f2681e138e1556b9e20e40ad1b9e5ed6154a6e67851c8075b53751e94c',
		tree: 'd4d4201a5245b737906c13459efed2da0707e2237541d36f44bba3d91a9f8606',
	},
	phonecat: {
		digest: '033fc40237975e28df36117cc309625632610a399b5c0f88735079ed21fcad0d',
		receipt: '0fba6288672e8e76c88780a1893b38686294197f1adc4c1eec65de9bce117248',
		adapter: '7ece5d380ffeecd818155c51aad6eba911986ff7e657bdc4cbe99146bfaf5b7c',
		tree: '52705af75ded5f3e1fe1f319576ef280ea7cf46150a1ac4aecf1a7251c348e2b',
	},
} as const;

type Options = Readonly<{ outputRoot?: string; workRoot?: string; publish?: boolean }>;
type Order = 'react-first' | 'phonecat-first';

export const VITE8_SHARED_ADAPTER_COHORT_PORT_PLAN: Readonly<
	Record<
		Order,
		{ react: Readonly<ReactVite8PortPlan>; phonecat: Readonly<AngularPhonecatVite8PortPlan> }
	>
> = {
	'react-first': {
		react: { qualification: 44200, mutation: 44201, restoration: 44202 },
		phonecat: {
			legacy: 44210,
			target: 44211,
			bindingMutation: 44212,
			bindingRestoration: 44213,
			templateMutation: 44214,
			templateRestoration: 44215,
		},
	},
	'phonecat-first': {
		react: { qualification: 44230, mutation: 44231, restoration: 44232 },
		phonecat: {
			legacy: 44220,
			target: 44221,
			bindingMutation: 44222,
			bindingRestoration: 44223,
			templateMutation: 44224,
			templateRestoration: 44225,
		},
	},
};

function exists(target: string): Promise<boolean> {
	return access(target).then(
		() => true,
		() => false,
	);
}
function canonical(value: unknown): string {
	return `${canonicalize(value)}\n`;
}
async function filesBelow(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesBelow(item)));
		else if (entry.isFile()) files.push(item);
	}
	return files.sort(compareUtf16CodeUnits);
}
async function evidenceTreeDigest(directory: string): Promise<string> {
	const lines = await Promise.all(
		(await filesBelow(directory)).map(
			async (file) =>
				`${sha256(await readFile(file))}  ${path.relative(root, file).split(path.sep).join('/')}\n`,
		),
	);
	return sha256(lines.join(''));
}
async function verifyImmutable(): Promise<void> {
	const reactReceipt = JSON.parse(
		await readFile(path.join(reactCanonical, 't028-run.json'), 'utf8'),
	) as { integrity: { canonicalDigest: string } };
	const phonecatReceipt = JSON.parse(
		await readFile(path.join(phonecatCanonical, 't069-run.json'), 'utf8'),
	) as { integrity: { canonicalDigest: string } };
	if (
		reactReceipt.integrity.canonicalDigest !== immutable.react.digest ||
		phonecatReceipt.integrity.canonicalDigest !== immutable.phonecat.digest ||
		sha256(await readFile(path.join(reactCanonical, 't028-run.json'))) !==
			immutable.react.receipt ||
		sha256(await readFile(path.join(phonecatCanonical, 't069-run.json'))) !==
			immutable.phonecat.receipt ||
		sha256(
			await readFile(path.join(root, 'fixtures/react-boilerplate-v4-vite8/vite.adapter.ts')),
		) !== immutable.react.adapter ||
		sha256(
			await readFile(path.join(root, 'fixtures/angular-phonecat-vite8/vite.adapter.ts')),
		) !== immutable.phonecat.adapter ||
		(await evidenceTreeDigest(reactCanonical)) !== immutable.react.tree ||
		(await evidenceTreeDigest(phonecatCanonical)) !== immutable.phonecat.tree
	)
		throw new Error('Canonical T028/T069 evidence differs');
}

type InventoryDuplicate = Readonly<{ path: string; indices: number[] }>;
type InventorySchemaViolation = Readonly<{
	index: number;
	path: string | null;
	violations: string[];
}>;
type InventoryValidation = Readonly<{
	ordered: boolean;
	duplicates: InventoryDuplicate[];
	schemaViolations: InventorySchemaViolation[];
}>;

export type Vite8InventoryDelta = Readonly<{
	schemaVersion: 'versionless.vite8-inventory-delta.v2';
	reason: 'inventory-validation' | 'entry-mismatch';
	expectedCount: number;
	actualCount: number;
	expectedDigest: string;
	actualDigest: string;
	expectedValidation: InventoryValidation;
	actualValidation: InventoryValidation;
	missing: Vite8OutputEntry[];
	unexpected: Vite8OutputEntry[];
	changes: Array<
		Readonly<{
			path: string;
			expected: Readonly<{ url: string; sha256: string }>;
			actual: Readonly<{ url: string; sha256: string }>;
			urlChanged: boolean;
			sha256Changed: boolean;
		}>
	>;
	orderRelocations: Array<Readonly<{ path: string; expectedIndex: number; actualIndex: number }>>;
}>;

function inventoryValidation(inventory: readonly Vite8OutputEntry[]): InventoryValidation {
	const indices = new Map<string, number[]>();
	const schemaViolations: InventorySchemaViolation[] = [];
	for (const [index, entry] of inventory.entries()) {
		const candidate = entry as Partial<Vite8OutputEntry>;
		const entryPath = typeof candidate.path === 'string' ? candidate.path : null;
		const violations: string[] = [];
		if (!entryPath) violations.push('path-invalid');
		if (entryPath) indices.set(entryPath, [...(indices.get(entryPath) ?? []), index]);
		if (typeof candidate.url !== 'string') violations.push('url-invalid');
		else {
			if (!entryPath || candidate.url !== joinURL('/', entryPath))
				violations.push('url-not-canonical');
			if (Boolean(parseURL(candidate.url).host)) violations.push('url-remote');
		}
		if (typeof candidate.sha256 !== 'string' || candidate.sha256.length !== 64)
			violations.push('sha256-invalid');
		if (violations.length > 0) schemaViolations.push({ index, path: entryPath, violations });
	}
	const paths = inventory.map((entry) => (typeof entry.path === 'string' ? entry.path : ''));
	return {
		ordered:
			paths.every((entryPath) => entryPath.length > 0) &&
			canonical(paths) === canonical([...paths].sort(compareUtf16CodeUnits)),
		duplicates: [...indices.entries()]
			.filter(([, duplicateIndices]) => duplicateIndices.length > 1)
			.map(([entryPath, duplicateIndices]) => ({
				path: entryPath,
				indices: duplicateIndices,
			}))
			.sort((left, right) => compareUtf16CodeUnits(left.path, right.path)),
		schemaViolations,
	};
}

export function createVite8InventoryDelta(
	expected: readonly Vite8OutputEntry[],
	actual: readonly Vite8OutputEntry[],
): Vite8InventoryDelta {
	const expectedValidation = inventoryValidation(expected);
	const actualValidation = inventoryValidation(actual);
	const expectedByPath = new Map(
		expected
			.map((entry, index) => ({ entry, index }))
			.filter(({ entry }) => typeof entry.path === 'string')
			.map(({ entry, index }) => [entry.path, { entry, index }] as const),
	);
	const actualByPath = new Map(
		actual
			.map((entry, index) => ({ entry, index }))
			.filter(({ entry }) => typeof entry.path === 'string')
			.map(({ entry, index }) => [entry.path, { entry, index }] as const),
	);
	const sharedPaths = [...expectedByPath.keys()]
		.filter((entryPath) => actualByPath.has(entryPath))
		.sort(compareUtf16CodeUnits);
	return {
		schemaVersion: 'versionless.vite8-inventory-delta.v2',
		reason:
			expectedValidation.ordered &&
			expectedValidation.duplicates.length === 0 &&
			expectedValidation.schemaViolations.length === 0 &&
			actualValidation.ordered &&
			actualValidation.duplicates.length === 0 &&
			actualValidation.schemaViolations.length === 0
				? 'entry-mismatch'
				: 'inventory-validation',
		expectedCount: expected.length,
		actualCount: actual.length,
		expectedDigest: sha256(canonicalize(expected)),
		actualDigest: sha256(canonicalize(actual)),
		expectedValidation,
		actualValidation,
		missing: [...expected.filter((entry) => !actualByPath.has(entry.path))].sort(
			(left, right) => compareUtf16CodeUnits(left.path, right.path),
		),
		unexpected: [...actual.filter((entry) => !expectedByPath.has(entry.path))].sort(
			(left, right) => compareUtf16CodeUnits(left.path, right.path),
		),
		changes: sharedPaths
			.map((entryPath) => {
				const expectedEntry = expectedByPath.get(entryPath)!.entry;
				const actualEntry = actualByPath.get(entryPath)!.entry;
				return {
					path: entryPath,
					expected: { url: expectedEntry.url, sha256: expectedEntry.sha256 },
					actual: { url: actualEntry.url, sha256: actualEntry.sha256 },
					urlChanged: expectedEntry.url !== actualEntry.url,
					sha256Changed: expectedEntry.sha256 !== actualEntry.sha256,
				};
			})
			.filter((change) => change.urlChanged || change.sha256Changed),
		orderRelocations: sharedPaths
			.map((entryPath) => ({
				path: entryPath,
				expectedIndex: expectedByPath.get(entryPath)!.index,
				actualIndex: actualByPath.get(entryPath)!.index,
			}))
			.filter((relocation) => relocation.expectedIndex !== relocation.actualIndex),
	};
}

function inventoryDelta(delta: Vite8InventoryDelta): Error {
	return new Error(`Vite 8 complete inventory differs: ${canonical(delta)}`);
}

export function assertCompleteVite8Inventory(
	expected: readonly Vite8OutputEntry[],
	actual: readonly Vite8OutputEntry[],
): void {
	const delta = createVite8InventoryDelta(expected, actual);
	if (delta.reason === 'inventory-validation' || delta.expectedDigest !== delta.actualDigest)
		throw inventoryDelta(delta);
}
async function canonicalReactInventory() {
	const value = JSON.parse(
		await readFile(path.join(reactCanonical, 'artifacts/service-worker.json'), 'utf8'),
	) as {
		entries: Array<{ url: string; sha256: string }>;
		worker: { path: string; sha256: string };
		manifest: { path: string; sha256: string };
	};
	return [
		...value.entries.map((entry) => ({
			path: path
				.relative('/', parseURL(entry.url).pathname || '/')
				.split(path.sep)
				.join('/'),
			url: entry.url,
			sha256: entry.sha256,
		})),
		{ ...value.manifest, url: joinURL('/', value.manifest.path) },
		{ ...value.worker, url: joinURL('/', value.worker.path) },
	].sort((left, right) => compareUtf16CodeUnits(left.path, right.path));
}
export async function canonicalPhonecatInventory() {
	const value = JSON.parse(
		await readFile(path.join(phonecatCanonical, 'artifacts/vite-build.json'), 'utf8'),
	) as { first: { entries: Vite8OutputEntry[]; inventorySha256: string } };
	return [
		...value.first.entries,
		{
			path: 'runtime-inventory.json',
			url: '/runtime-inventory.json',
			sha256: value.first.inventorySha256,
		},
	].sort((left, right) => compareUtf16CodeUnits(left.path, right.path));
}

function proveKernelMutation(evidence: Vite8KernelEvidence): Record<string, unknown> {
	const original = canonical(evidence);
	const mutation = structuredClone(evidence) as unknown as {
		runs: Array<{ lifecycle: string[] }>;
	};
	mutation.runs[0]!.lifecycle[1] = 'close-bundle';
	let refused = false;
	try {
		assertVite8KernelEvidence(mutation as unknown as Vite8KernelEvidence);
	} catch (error) {
		refused = error instanceof Error && error.message.includes('lifecycle order');
	}
	if (!refused) throw new Error('Shared Vite 8 lifecycle mutation did not fail');
	if (canonical(evidence) !== original)
		throw new Error('Shared Vite 8 lifecycle restoration differs');
	return {
		seam: 'shared-lifecycle-order',
		refused: true,
		restoration: 'byte-identical',
		sha256: sha256(original),
	};
}

async function runProfile(order: Order, profile: 'react' | 'phonecat', directory: string) {
	if (profile === 'react') {
		const target = path.join(directory, 'react-target');
		const artifacts = path.join(directory, 'react-artifacts');
		const receiptPath = path.join(directory, 'react-receipt.json');
		const receipt = await verifyReactBoilerplateVite8({
			receiptPath,
			targetPath: target,
			artifactsPath: artifacts,
			adapterConfigPath: reactAdapter,
			publishAggregate: false,
			portPlan: VITE8_SHARED_ADAPTER_COHORT_PORT_PLAN[order].react,
		});
		const kernel = JSON.parse(
			await readFile(path.join(target, '.versionless-vite8-kernel.json'), 'utf8'),
		) as Vite8KernelEvidence;
		assertVite8KernelEvidence(kernel);
		assertVite8Restoration(kernel.runs[0]!.output, kernel.runs[1]!.output);
		assertVite8Restoration(kernel.runs[0]!.output, kernel.runs.at(-1)!.output);
		assertCompleteVite8Inventory(await canonicalReactInventory(), kernel.runs[0]!.output);
		const journeySha256 = sha256(await readFile(path.join(artifacts, 'journey.json')));
		return {
			order,
			profile,
			builds: kernel.runs.length,
			outputSha256: kernel.runs[0]!.outputSha256,
			journeySha256,
			observableProjectionSha256: reactProjectionSha256,
			locality: receipt.verification.locality,
			applicationMutation: JSON.parse(
				await readFile(path.join(artifacts, 'mutation.json'), 'utf8'),
			),
			kernelMutation: proveKernelMutation(kernel),
		};
	}
	const work = path.join(directory, 'phonecat-work');
	const artifacts = path.join(directory, 'phonecat-artifacts');
	const receiptPath = path.join(directory, 'phonecat-receipt.json');
	const receipt = await verifyAngularPhonecatVite8({
		receiptPath,
		workPath: work,
		artifactsPath: artifacts,
		adapterConfigPath: phonecatAdapter,
		publishAggregate: false,
		portPlan: VITE8_SHARED_ADAPTER_COHORT_PORT_PLAN[order].phonecat,
		internalReceiptIdentity: order,
	});
	const kernel = JSON.parse(
		await readFile(path.join(work, 'target/.versionless-vite8-kernel.json'), 'utf8'),
	) as Vite8KernelEvidence;
	assertVite8KernelEvidence(kernel);
	assertVite8Restoration(kernel.runs[0]!.output, kernel.runs[1]!.output);
	assertVite8Restoration(kernel.runs[0]!.output, kernel.runs.at(-1)!.output);
	assertCompleteVite8Inventory(await canonicalPhonecatInventory(), kernel.runs[0]!.output);
	const journeySha256 = sha256(await readFile(path.join(artifacts, 'journey.json')));
	if (journeySha256 !== phonecatJourneySha256) throw new Error('PhoneCat shared journey differs');
	return {
		order,
		profile,
		builds: kernel.runs.length,
		outputSha256: kernel.runs[0]!.outputSha256,
		journeySha256,
		locality: receipt.verification.locality,
		applicationMutation: JSON.parse(
			await readFile(path.join(artifacts, 'mutation.json'), 'utf8'),
		),
		kernelMutation: proveKernelMutation(kernel),
	};
}

async function runOrder(order: Order, workRoot: string) {
	const directory = path.join(workRoot, order);
	await mkdir(directory, { recursive: true });
	const profiles =
		order === 'react-first'
			? (['react', 'phonecat'] as const)
			: (['phonecat', 'react'] as const);
	const results = [];
	for (const profile of profiles) results.push(await runProfile(order, profile, directory));
	return {
		order,
		trace: [...profiles],
		profiles: results.sort((left, right) => compareUtf16CodeUnits(left.profile, right.profile)),
	};
}

export async function createVite8SharedAdapterCohortEvidence(
	options: Options = {},
): Promise<Record<string, string>> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Shared Vite 8 adapter cohort requires explicit offline mode');
	const workRoot = options.workRoot ?? defaultWork;
	const outputRoot = options.outputRoot ?? defaultOutput;
	if (await exists(workRoot)) throw new Error('Shared Vite 8 work residue exists');
	if (options.publish !== false && (await exists(outputRoot)))
		throw new Error('Shared Vite 8 evidence already exists');
	await verifyImmutable();
	let reactFirst: Awaited<ReturnType<typeof runOrder>>;
	let phonecatFirst: Awaited<ReturnType<typeof runOrder>>;
	try {
		reactFirst = await runOrder('react-first', workRoot);
		phonecatFirst = await runOrder('phonecat-first', workRoot);
		if (
			canonical(reactFirst.profiles.map((item) => ({ ...item, order: undefined }))) !==
			canonical(phonecatFirst.profiles.map((item) => ({ ...item, order: undefined })))
		)
			throw new Error('Shared Vite 8 profile orders diverge');
	} finally {
		await rm(workRoot, { recursive: true, force: true });
	}
	await verifyImmutable();
	const firstText = canonical(reactFirst);
	const secondText = canonical(phonecatFirst);
	const graphText = canonical({
		kernel: '@versionless/core/vite8-adapter',
		profiles: ['react-boilerplate-v4', 'angular-phonecat'],
		relations: ['lifecycle', 'normalized-output-inventory', 'restoration'],
	});
	const receipt = canonical({
		schemaVersion: 'versionless.vite8-shared-adapter-cohort.v1',
		result: 'pass',
		vite: '8.0.16',
		orders: ['react-first', 'phonecat-first'],
		orderConvergent: true,
		profiles: 2,
		canonical: immutable,
		projections: { react: reactProjectionSha256, phonecatJourney: phonecatJourneySha256 },
		artifacts: {
			reactFirst: sha256(firstText),
			phonecatFirst: sha256(secondText),
			graph: sha256(graphText),
		},
		locality: {
			mode: 'offline',
			scope: 'process-scoped',
			successfulNonLoopback: 0,
			osWideIsolation: false,
		},
		nonclaims: [
			'Two exact Vite 8.0.16 profiles only; no generic adapter, unplugin, old-Vite, webpack fallback, framework-general support, designated pilot, full equivalence, certification, authenticity, or OS-wide locality claim.',
		],
	});
	const artifacts = {
		'receipt.json': receipt,
		'graph.json': graphText,
		'react-first.json': firstText,
		'phonecat-first.json': secondText,
	};
	if (options.publish !== false) {
		const staging = `${outputRoot}.staging`;
		await mkdir(staging, { recursive: true });
		try {
			for (const [file, contents] of Object.entries(artifacts))
				await writeFile(path.join(staging, file), contents, { flag: 'wx' });
			await rename(staging, outputRoot);
		} catch (error) {
			await rm(staging, { recursive: true, force: true });
			throw error;
		}
	}
	return artifacts;
}

export async function verifyVite8SharedAdapterCohort(
	options: Omit<Options, 'publish'> = {},
): Promise<string> {
	const outputRoot = options.outputRoot ?? defaultOutput;
	const expected = Object.fromEntries(
		await Promise.all(
			(await readdir(outputRoot))
				.sort(compareUtf16CodeUnits)
				.map(
					async (file) =>
						[file, await readFile(path.join(outputRoot, file), 'utf8')] as const,
				),
		),
	);
	const actual = await createVite8SharedAdapterCohortEvidence({ ...options, publish: false });
	if (canonical(expected) !== canonical(actual))
		throw new Error('Shared Vite 8 cohort evidence differs');
	return sha256(actual['receipt.json']!);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (!args.includes('--offline'))
		throw new Error('Shared Vite 8 cohort command requires --offline');
	const digest = args.includes('--verify-only')
		? await verifyVite8SharedAdapterCohort()
		: sha256((await createVite8SharedAdapterCohortEvidence())['receipt.json']!);
	process.stdout.write(
		canonical({ result: 'pass', digest, networkAttempts: 0, residue: 'none' }),
	);
}
