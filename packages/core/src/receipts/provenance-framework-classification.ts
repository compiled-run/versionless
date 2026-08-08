import { charIn, createRegExp } from 'magic-regexp';
import { canonicalize, sha256 } from './canonicalize.ts';

export const PROVENANCE_FRAMEWORK_CLASSIFICATION_SCHEMA =
	'versionless.provenance-framework-classification.v1' as const;

export const PROVENANCE_EXECUTION_NOT_TESTED = {
	install: 'not-tested',
	compiler: 'not-tested',
	build: 'not-tested',
	browser: 'not-tested',
	locality: 'not-tested',
	migration: 'not-tested',
	tier: 'not-tested',
	pilot: 'not-tested',
	support: 'not-tested',
} as const;

export const PROVENANCE_BOUNDARIES_UNKNOWN = {
	server: 'unknown',
	api: 'unknown',
	authentication: 'unknown',
	payment: 'unknown',
	analytics: 'unknown',
	telemetry: 'unknown',
	remoteResources: 'unknown',
	egress: 'unknown',
	nodeCompatibility: 'not-tested',
} as const;

export const PROVENANCE_CLASSIFICATION_LIMITATIONS = [
	'Static classification is bound only to the accepted immutable provenance closure.',
	'No candidate dependency, script, compiler, build, server, browser, or external resource was executed.',
	'Next.js and webpack remain the candidate-owned production stack; no Vite or unplugin replacement is proposed.',
	'Provenance integrity does not establish authenticity, compliance, certification, runtime compatibility, migration, parity, locality, Tier, pilot, or support.',
] as const;

export interface ProvenanceSourceFacts {
	next: { declaration: string; major: 12 };
	react: { declaration: string };
	packageManager: { name: 'yarn'; lockfile: 'yarn.lock'; format: 'v1' };
	routing: { mode: 'pages'; evidence: ['pages/index.tsx'] };
	staticGeneration: { kind: 'getStaticProps'; evidence: ['pages/index.tsx'] };
	playwright: {
		configuration: 'playwright.config.ts';
		workflow: '.github/workflows/playwright.yml';
		state: 'present-not-executed';
	};
	productionStack: {
		owner: 'candidate';
		framework: 'nextjs';
		bundler: 'webpack';
		customLoader: '@svgr/webpack';
		configuration: 'next.config.js';
		preserved: true;
		viteReplacement: false;
		unpluginReplacement: false;
		compatibility: 'not-tested';
	};
	searchPath: 'components/Search/index.tsx';
	scripts: Array<{ name: string; command: string }>;
}

export interface ProvenanceFrameworkClassificationReceipt {
	schemaVersion: typeof PROVENANCE_FRAMEWORK_CLASSIFICATION_SCHEMA;
	closure: {
		fixtureId: 'next-killedbygoogle';
		repository: 'codyogden/killedbygoogle';
		nonFork: true;
		commit: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d';
		tree: 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763';
		fixtureSha256: string;
		provenanceSha256: string;
		evidenceSha256: string;
		archiveSha256: string;
		cacheManifestSha256: string;
		archiveManifestSha256: string;
		offlineReplaySha256: string;
		officialTreeRows: 86;
		archiveFiles: 72;
		reliedPaths: string[];
		rootLicense: { path: 'LICENSE'; sha256: string; classification: 'verified-compatible' };
		licenseInventoryEntries: number;
		assetClassificationEntries: number;
		provenance: 'verified';
		provenanceScope: 'exact-immutable-closure-only';
	};
	classification: {
		framework: 'nextjs';
		adapter: 'nextjs-provenance-static';
		sourceFacts: ProvenanceSourceFacts;
	};
	execution: typeof PROVENANCE_EXECUTION_NOT_TESTED;
	boundaries: typeof PROVENANCE_BOUNDARIES_UNKNOWN;
	locality: {
		mode: 'offline';
		networkAttempts: 0;
		candidateExecution: 'not-requested';
	};
	claims: {
		authenticity: 'not-established';
		certification: 'not-claimed';
		compliance: 'not-claimed';
		osWideIsolation: 'not-established';
		genericReactSupport: 'not-claimed';
		nextjsSupport: 'not-claimed';
		bundlerSupport: 'not-claimed';
	};
	limitations: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
}

const sha256Pattern = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);

const acceptedClosure = {
	fixtureSha256: 'dd8725527ffa7f9b50826bd740cbda9bf5e2e08ee4c0fe8727505051c055d23a',
	provenanceSha256: '2d7b33af46e951f2e128b5dd4c440d611e0c27f593d3004b470190abc703164b',
	evidenceSha256: 'ee5498bb5b1187371b6c58c4dfb3e0cdd58fdab8e5eea1eb09eba839c6b66843',
	archiveSha256: 'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d',
	cacheManifestSha256: '04d5d4ca5f4133ecb5772c5aab9053af4f58cfcfdb2d837dcdd0f16da5eec9d8',
	archiveManifestSha256: '05c3677979d98740e8c76a599497e43fe2b623a43e56226edd01c53bf2bf572c',
	offlineReplaySha256: 'faf10cb59a9b63919346d3a98250afbd8f89527fd616576c337da3e1e70bd85a',
} as const;

const acceptedScripts = [
	{ name: 'build', command: 'next build' },
	{ name: 'dev', command: 'next dev' },
	{ name: 'kill', command: 'bin/kill' },
	{ name: 'lint', command: 'next lint' },
	{
		name: 'preview',
		command: 'bin/graveyard && yarn build && next export && npx http-server out/ -p 3000',
	},
	{ name: 'start', command: 'next start' },
	{ name: 'test', command: 'jest graveyard.test.ts' },
	{ name: 'test:e2e', command: 'playwright test' },
] as const;

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Provenance classification ${label} must be an object`);
	return value as Record<string, unknown>;
}

function exactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
	label: string,
): void {
	if (canonicalize(Object.keys(value).sort()) !== canonicalize([...expected].sort()))
		throw new Error(`Provenance classification ${label} fields are invalid`);
}

function requireSha256(value: unknown, label: string): string {
	if (typeof value !== 'string' || !sha256Pattern.test(value))
		throw new Error(`Provenance classification ${label} must be SHA-256`);
	return value;
}

function requireProvenanceSourceFacts(value: unknown): void {
	const facts = record(value, 'classification.sourceFacts');
	exactKeys(
		facts,
		[
			'next',
			'react',
			'packageManager',
			'routing',
			'staticGeneration',
			'playwright',
			'productionStack',
			'searchPath',
			'scripts',
		],
		'classification.sourceFacts',
	);
	const next = record(facts.next, 'classification.sourceFacts.next');
	exactKeys(next, ['declaration', 'major'], 'classification.sourceFacts.next');
	const react = record(facts.react, 'classification.sourceFacts.react');
	exactKeys(react, ['declaration'], 'classification.sourceFacts.react');
	const packageManager = record(
		facts.packageManager,
		'classification.sourceFacts.packageManager',
	);
	exactKeys(
		packageManager,
		['name', 'lockfile', 'format'],
		'classification.sourceFacts.packageManager',
	);
	const routing = record(facts.routing, 'classification.sourceFacts.routing');
	exactKeys(routing, ['mode', 'evidence'], 'classification.sourceFacts.routing');
	const staticGeneration = record(
		facts.staticGeneration,
		'classification.sourceFacts.staticGeneration',
	);
	exactKeys(
		staticGeneration,
		['kind', 'evidence'],
		'classification.sourceFacts.staticGeneration',
	);
	const playwright = record(facts.playwright, 'classification.sourceFacts.playwright');
	exactKeys(
		playwright,
		['configuration', 'workflow', 'state'],
		'classification.sourceFacts.playwright',
	);
	const productionStack = record(
		facts.productionStack,
		'classification.sourceFacts.productionStack',
	);
	exactKeys(
		productionStack,
		[
			'owner',
			'framework',
			'bundler',
			'customLoader',
			'configuration',
			'preserved',
			'viteReplacement',
			'unpluginReplacement',
			'compatibility',
		],
		'classification.sourceFacts.productionStack',
	);
	if (
		next.declaration !== '^12.0.10' ||
		next.major !== 12 ||
		react.declaration !== '^17.0.2' ||
		canonicalize(packageManager) !==
			canonicalize({ name: 'yarn', lockfile: 'yarn.lock', format: 'v1' }) ||
		canonicalize(routing) !== canonicalize({ mode: 'pages', evidence: ['pages/index.tsx'] }) ||
		canonicalize(staticGeneration) !==
			canonicalize({ kind: 'getStaticProps', evidence: ['pages/index.tsx'] }) ||
		canonicalize(playwright) !==
			canonicalize({
				configuration: 'playwright.config.ts',
				workflow: '.github/workflows/playwright.yml',
				state: 'present-not-executed',
			}) ||
		canonicalize(productionStack) !==
			canonicalize({
				owner: 'candidate',
				framework: 'nextjs',
				bundler: 'webpack',
				customLoader: '@svgr/webpack',
				configuration: 'next.config.js',
				preserved: true,
				viteReplacement: false,
				unpluginReplacement: false,
				compatibility: 'not-tested',
			}) ||
		facts.searchPath !== 'components/Search/index.tsx'
	)
		throw new Error('Provenance classification static source facts are invalid');
	if (!Array.isArray(facts.scripts) || facts.scripts.length === 0)
		throw new Error('Provenance classification package scripts are absent');
	let previous = '';
	for (const [index, value] of facts.scripts.entries()) {
		const script = record(value, `classification.sourceFacts.scripts[${index}]`);
		exactKeys(script, ['name', 'command'], `classification.sourceFacts.scripts[${index}]`);
		if (
			typeof script.name !== 'string' ||
			!script.name ||
			typeof script.command !== 'string' ||
			!script.command ||
			(previous && previous.localeCompare(script.name) >= 0)
		)
			throw new Error('Provenance classification package scripts are invalid or reordered');
		previous = script.name;
	}
	if (canonicalize(facts.scripts) !== canonicalize(acceptedScripts))
		throw new Error('Provenance classification package scripts differ from accepted source');
}

export function provenanceFrameworkClassificationDigest(
	receipt: ProvenanceFrameworkClassificationReceipt,
): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

export function createProvenanceFrameworkClassificationReceipt(input: {
	closure: Omit<
		ProvenanceFrameworkClassificationReceipt['closure'],
		'provenance' | 'provenanceScope'
	>;
	sourceFacts: ProvenanceSourceFacts;
}): ProvenanceFrameworkClassificationReceipt {
	const receipt: ProvenanceFrameworkClassificationReceipt = {
		schemaVersion: PROVENANCE_FRAMEWORK_CLASSIFICATION_SCHEMA,
		closure: {
			...input.closure,
			provenance: 'verified',
			provenanceScope: 'exact-immutable-closure-only',
		},
		classification: {
			framework: 'nextjs',
			adapter: 'nextjs-provenance-static',
			sourceFacts: input.sourceFacts,
		},
		execution: { ...PROVENANCE_EXECUTION_NOT_TESTED },
		boundaries: { ...PROVENANCE_BOUNDARIES_UNKNOWN },
		locality: { mode: 'offline', networkAttempts: 0, candidateExecution: 'not-requested' },
		claims: {
			authenticity: 'not-established',
			certification: 'not-claimed',
			compliance: 'not-claimed',
			osWideIsolation: 'not-established',
			genericReactSupport: 'not-claimed',
			nextjsSupport: 'not-claimed',
			bundlerSupport: 'not-claimed',
		},
		limitations: [...PROVENANCE_CLASSIFICATION_LIMITATIONS],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = provenanceFrameworkClassificationDigest(receipt);
	return parseProvenanceFrameworkClassificationReceipt(receipt);
}

export function parseProvenanceFrameworkClassificationReceipt(
	value: unknown,
): ProvenanceFrameworkClassificationReceipt {
	const root = record(value, 'root');
	exactKeys(
		root,
		[
			'schemaVersion',
			'closure',
			'classification',
			'execution',
			'boundaries',
			'locality',
			'claims',
			'limitations',
			'integrity',
		],
		'root',
	);
	if (root.schemaVersion !== PROVENANCE_FRAMEWORK_CLASSIFICATION_SCHEMA)
		throw new Error('Unsupported provenance classification schema');
	const closure = record(root.closure, 'closure');
	exactKeys(
		closure,
		[
			'fixtureId',
			'repository',
			'nonFork',
			'commit',
			'tree',
			'fixtureSha256',
			'provenanceSha256',
			'evidenceSha256',
			'archiveSha256',
			'cacheManifestSha256',
			'archiveManifestSha256',
			'offlineReplaySha256',
			'officialTreeRows',
			'archiveFiles',
			'reliedPaths',
			'rootLicense',
			'licenseInventoryEntries',
			'assetClassificationEntries',
			'provenance',
			'provenanceScope',
		],
		'closure',
	);
	for (const key of [
		'fixtureSha256',
		'provenanceSha256',
		'evidenceSha256',
		'archiveSha256',
		'cacheManifestSha256',
		'archiveManifestSha256',
		'offlineReplaySha256',
	] as const)
		requireSha256(closure[key], `closure.${key}`);
	if (
		closure.fixtureId !== 'next-killedbygoogle' ||
		closure.repository !== 'codyogden/killedbygoogle' ||
		closure.nonFork !== true ||
		closure.commit !== '56809c31592e6ca1edce8af9bfe842fbcdf71f4d' ||
		closure.tree !== 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763' ||
		closure.officialTreeRows !== 86 ||
		closure.archiveFiles !== 72 ||
		closure.provenance !== 'verified' ||
		closure.provenanceScope !== 'exact-immutable-closure-only' ||
		Object.entries(acceptedClosure).some(([key, value]) => closure[key] !== value) ||
		!Number.isSafeInteger(closure.licenseInventoryEntries) ||
		closure.licenseInventoryEntries !== 1 ||
		!Number.isSafeInteger(closure.assetClassificationEntries) ||
		closure.assetClassificationEntries !== 22
	)
		throw new Error('Provenance classification closure identity is invalid');
	if (
		canonicalize(closure.reliedPaths) !==
		canonicalize([
			'.github/workflows/playwright.yml',
			'LICENSE',
			'components/Search/index.tsx',
			'next.config.js',
			'package.json',
			'pages/index.tsx',
			'yarn.lock',
		])
	)
		throw new Error('Provenance classification relied paths are invalid');
	const rootLicense = record(closure.rootLicense, 'closure.rootLicense');
	exactKeys(rootLicense, ['path', 'sha256', 'classification'], 'closure.rootLicense');
	if (
		rootLicense.path !== 'LICENSE' ||
		rootLicense.classification !== 'verified-compatible' ||
		rootLicense.sha256 !== '10547fb81e311e470cdcda5a273bac2a76f50ded6b33ce4362bcb05e1176d5e0'
	)
		throw new Error('Provenance classification root license is invalid');
	const classification = record(root.classification, 'classification');
	exactKeys(classification, ['framework', 'adapter', 'sourceFacts'], 'classification');
	if (
		classification.framework !== 'nextjs' ||
		classification.adapter !== 'nextjs-provenance-static'
	)
		throw new Error('Provenance classification adapter mismatch');
	requireProvenanceSourceFacts(classification.sourceFacts);
	const execution = record(root.execution, 'execution');
	exactKeys(execution, Object.keys(PROVENANCE_EXECUTION_NOT_TESTED), 'execution');
	if (canonicalize(execution) !== canonicalize(PROVENANCE_EXECUTION_NOT_TESTED))
		throw new Error('Provenance classification execution outcomes must remain not-tested');
	const boundaries = record(root.boundaries, 'boundaries');
	exactKeys(boundaries, Object.keys(PROVENANCE_BOUNDARIES_UNKNOWN), 'boundaries');
	if (canonicalize(boundaries) !== canonicalize(PROVENANCE_BOUNDARIES_UNKNOWN))
		throw new Error('Provenance classification boundaries are strengthened');
	const locality = record(root.locality, 'locality');
	exactKeys(locality, ['mode', 'networkAttempts', 'candidateExecution'], 'locality');
	if (
		locality.mode !== 'offline' ||
		locality.networkAttempts !== 0 ||
		locality.candidateExecution !== 'not-requested'
	)
		throw new Error('Provenance classification locality is not offline and unexecuted');
	const claims = record(root.claims, 'claims');
	exactKeys(
		claims,
		[
			'authenticity',
			'certification',
			'compliance',
			'osWideIsolation',
			'genericReactSupport',
			'nextjsSupport',
			'bundlerSupport',
		],
		'claims',
	);
	if (
		claims.authenticity !== 'not-established' ||
		claims.certification !== 'not-claimed' ||
		claims.compliance !== 'not-claimed' ||
		claims.osWideIsolation !== 'not-established' ||
		claims.genericReactSupport !== 'not-claimed' ||
		claims.nextjsSupport !== 'not-claimed' ||
		claims.bundlerSupport !== 'not-claimed'
	)
		throw new Error('Provenance classification claims are strengthened');
	if (canonicalize(root.limitations) !== canonicalize(PROVENANCE_CLASSIFICATION_LIMITATIONS))
		throw new Error('Provenance classification limitations are invalid');
	const integrity = record(root.integrity, 'integrity');
	exactKeys(integrity, ['algorithm', 'canonicalDigest'], 'integrity');
	const receipt = root as unknown as ProvenanceFrameworkClassificationReceipt;
	if (
		integrity.algorithm !== 'sha256' ||
		typeof integrity.canonicalDigest !== 'string' ||
		!sha256Pattern.test(integrity.canonicalDigest) ||
		provenanceFrameworkClassificationDigest(receipt) !== integrity.canonicalDigest
	)
		throw new Error('Provenance classification canonical digest mismatch');
	return receipt;
}
