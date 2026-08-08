import { charIn, createRegExp } from 'magic-regexp';
import { canonicalize, sha256 } from './canonicalize.ts';

export const NEXT13_PROVENANCE_CLASSIFICATION_SCHEMA =
	'versionless.next13-provenance-classification.v1' as const;

export const NEXT13_EXECUTION_NOT_TESTED = {
	dependencyResolution: 'not-tested',
	install: 'not-tested',
	compiler: 'not-tested',
	build: 'not-tested',
	server: 'not-tested',
	browser: 'not-tested',
	runtime: 'not-tested',
	routing: 'not-tested',
	rendering: 'not-tested',
	api: 'not-tested',
	locality: 'not-tested',
	migration: 'not-tested',
	tier: 'not-tested',
	pilot: 'not-tested',
	support: 'not-tested',
} as const;

export const NEXT13_BOUNDARIES = {
	dependencyClosure: 'absent',
	pinnedYarnRelease: 'absent',
	nodeEngine: 'absent',
	fontBuildEgress: 'present-not-executed',
	assets: '11-excluded-14-unknown-0-compatible',
	authentication: 'unknown',
	payment: 'unknown',
	analytics: 'unknown',
	telemetry: 'unknown',
	remoteResources: 'unknown',
	egress: 'unknown',
} as const;

export const NEXT13_LIMITATIONS = [
	'Static classification is bound only to the accepted immutable T142 provenance closure.',
	'No dependency was resolved or acquired, and no install, script, compiler, build, server, browser, API, or external resource was executed.',
	'Next.js, webpack, Contentlayer, next/font, next/image, and routing observations are source facts only; compatibility and behavior remain not-tested.',
	'Provenance integrity and static classification establish neither migration, parity, locality, Tier, pilot, support, compliance, certification, authenticity, signer identity, SLSA level, nor OS-wide isolation.',
] as const;

export interface Next13SourceFacts {
	next: { declaration: '13.4.8'; major: 13 };
	react: { declaration: '18.2.0' };
	packageManager: {
		name: 'yarn';
		lockfile: 'yarn.lock';
		metadataVersion: 6;
		nodeLinker: 'node-modules';
		pinnedRelease: 'absent';
		resolutions: 1165;
		checksums: 1110;
	};
	routing: {
		mode: 'app';
		layout: 'app/layout.tsx';
		page: 'app/blog/[...slug]/page.tsx';
		dynamicRoute: 'catch-all';
		generateStaticParams: 'present-not-executed';
	};
	apiRoute: {
		path: 'app/api/newsletter2/route.ts';
		method: 'POST';
		state: 'present-not-executed';
	};
	resources: {
		font: {
			module: 'next/font/google';
			evidence: 'app/layout.tsx';
			buildEgressRisk: 'present-not-executed';
		};
		contentlayer: { declaration: '0.3.4'; configuration: 'contentlayer.config.ts' };
		image: { module: 'next/image'; evidence: 'components/Image.tsx' };
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
	nodeEngine: 'absent';
	scripts: Array<{ name: string; command: string }>;
}

export interface Next13ProvenanceClassificationReceipt {
	schemaVersion: typeof NEXT13_PROVENANCE_CLASSIFICATION_SCHEMA;
	closure: {
		fixtureId: 'next-tailwind-starter-blog';
		repository: 'timlrx/tailwind-nextjs-starter-blog';
		nonFork: true;
		commit: '09ba0550caea03a8c38bc4878d05838d2a57f999';
		tree: '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf';
		fixtureSha256: string;
		provenanceSha256: string;
		evidenceSha256: string;
		archiveSha256: string;
		cacheManifestSha256: string;
		archiveManifestSha256: string;
		offlineReplaySha256: string;
		officialTreeRows: 138;
		archiveFiles: 110;
		reliedPaths: string[];
		rootLicense: { path: 'LICENSE'; sha256: string; classification: 'verified-compatible' };
		licenseInventoryEntries: 1;
		assets: { total: 25; excluded: 11; unknown: 14; compatible: 0 };
		provenance: 'verified';
		provenanceScope: 'exact-immutable-closure-only';
	};
	classification: {
		framework: 'nextjs';
		adapter: 'next13-provenance-static';
		sourceFacts: Next13SourceFacts;
	};
	execution: typeof NEXT13_EXECUTION_NOT_TESTED;
	boundaries: typeof NEXT13_BOUNDARIES;
	locality: { mode: 'offline'; networkAttempts: 0; candidateExecution: 'not-requested' };
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
const closureHashes = {
	fixtureSha256: 'd24bf99d50e7f90ac53dcc7d99f04fcd9842379d94393548c7abbf486288b6c1',
	provenanceSha256: 'b0cb4e5b597bd619d8ea76912b09a6257bb1e3be4f4d259160334518a8b5bc29',
	evidenceSha256: '4562e7fe0ab786cede4a40ead07666d44d085a45699443fe65da4aabed9b61f0',
	archiveSha256: 'c227efa283b4a17d7ae76aa1b9ea259075f606128642d59f7b43ca63405ee1f7',
	cacheManifestSha256: '8079a31d105783e6e293402ea541c13c4fe2ff7038d010b414d322491b3dd202',
	archiveManifestSha256: '8cce8b04846e0382bf1a4b2812881a998fc3d2cf061b2f43362310139da801e3',
	offlineReplaySha256: '5b525cf6cfc447fbdd3ca0640115c7810b67de5dd1680e3d5ff624356e767a98',
} as const;
export const NEXT13_RELIED_PATHS = [
	'.yarnrc.yml',
	'LICENSE',
	'app/api/newsletter2/route.ts',
	'app/blog/[...slug]/page.tsx',
	'app/layout.tsx',
	'next.config.js',
	'package.json',
	'yarn.lock',
] as const;
export const NEXT13_SCRIPTS = [
	{ name: 'analyze', command: 'cross-env ANALYZE=true next build' },
	{
		name: 'build',
		command:
			"cross-env INIT_CWD=$PWD next build && cross-env NODE_OPTIONS='--experimental-json-modules' node -r esbuild-register ./scripts/postbuild.mjs",
	},
	{ name: 'dev', command: 'cross-env INIT_CWD=$PWD next dev' },
	{
		name: 'lint',
		command:
			'next lint --fix --dir pages --dir components --dir lib --dir layouts --dir scripts',
	},
	{ name: 'serve', command: 'next start' },
	{ name: 'start', command: 'next dev' },
] as const;

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Next13 classification ${label} must be an object`);
	return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
	if (canonicalize(Object.keys(value).sort()) !== canonicalize([...keys].sort()))
		throw new Error(`Next13 classification ${label} fields are invalid`);
}

export function next13ProvenanceClassificationDigest(
	receipt: Next13ProvenanceClassificationReceipt,
): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

export function createNext13ProvenanceClassificationReceipt(input: {
	closure: Omit<
		Next13ProvenanceClassificationReceipt['closure'],
		'provenance' | 'provenanceScope'
	>;
	sourceFacts: Next13SourceFacts;
}): Next13ProvenanceClassificationReceipt {
	const receipt: Next13ProvenanceClassificationReceipt = {
		schemaVersion: NEXT13_PROVENANCE_CLASSIFICATION_SCHEMA,
		closure: {
			...input.closure,
			provenance: 'verified',
			provenanceScope: 'exact-immutable-closure-only',
		},
		classification: {
			framework: 'nextjs',
			adapter: 'next13-provenance-static',
			sourceFacts: input.sourceFacts,
		},
		execution: { ...NEXT13_EXECUTION_NOT_TESTED },
		boundaries: { ...NEXT13_BOUNDARIES },
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
		limitations: [...NEXT13_LIMITATIONS],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = next13ProvenanceClassificationDigest(receipt);
	return parseNext13ProvenanceClassificationReceipt(receipt);
}

export function parseNext13ProvenanceClassificationReceipt(
	value: unknown,
): Next13ProvenanceClassificationReceipt {
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
	if (root.schemaVersion !== NEXT13_PROVENANCE_CLASSIFICATION_SCHEMA)
		throw new Error('Unsupported Next13 provenance classification schema');
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
			'assets',
			'provenance',
			'provenanceScope',
		],
		'closure',
	);
	for (const key of Object.keys(closureHashes) as Array<keyof typeof closureHashes>)
		if (
			typeof closure[key] !== 'string' ||
			!sha256Pattern.test(closure[key]) ||
			closure[key] !== closureHashes[key]
		)
			throw new Error(`Next13 classification closure.${key} is invalid`);
	if (
		closure.fixtureId !== 'next-tailwind-starter-blog' ||
		closure.repository !== 'timlrx/tailwind-nextjs-starter-blog' ||
		closure.nonFork !== true ||
		closure.commit !== '09ba0550caea03a8c38bc4878d05838d2a57f999' ||
		closure.tree !== '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf' ||
		closure.officialTreeRows !== 138 ||
		closure.archiveFiles !== 110 ||
		canonicalize(closure.reliedPaths) !== canonicalize(NEXT13_RELIED_PATHS) ||
		closure.licenseInventoryEntries !== 1 ||
		closure.provenance !== 'verified' ||
		closure.provenanceScope !== 'exact-immutable-closure-only'
	)
		throw new Error('Next13 classification closure identity is invalid');
	if (
		canonicalize(closure.rootLicense) !==
		canonicalize({
			path: 'LICENSE',
			sha256: '317b52bec9a462916d9219427552de01604be107efc60606a3046df2d2ee0ff2',
			classification: 'verified-compatible',
		})
	)
		throw new Error('Next13 classification root license is invalid');
	if (
		canonicalize(closure.assets) !==
		canonicalize({ total: 25, excluded: 11, unknown: 14, compatible: 0 })
	)
		throw new Error('Next13 classification asset boundary is invalid');
	const classification = record(root.classification, 'classification');
	exactKeys(classification, ['framework', 'adapter', 'sourceFacts'], 'classification');
	if (
		classification.framework !== 'nextjs' ||
		classification.adapter !== 'next13-provenance-static'
	)
		throw new Error('Next13 classification adapter mismatch');
	const expectedFacts: Next13SourceFacts = {
		next: { declaration: '13.4.8', major: 13 },
		react: { declaration: '18.2.0' },
		packageManager: {
			name: 'yarn',
			lockfile: 'yarn.lock',
			metadataVersion: 6,
			nodeLinker: 'node-modules',
			pinnedRelease: 'absent',
			resolutions: 1165,
			checksums: 1110,
		},
		routing: {
			mode: 'app',
			layout: 'app/layout.tsx',
			page: 'app/blog/[...slug]/page.tsx',
			dynamicRoute: 'catch-all',
			generateStaticParams: 'present-not-executed',
		},
		apiRoute: {
			path: 'app/api/newsletter2/route.ts',
			method: 'POST',
			state: 'present-not-executed',
		},
		resources: {
			font: {
				module: 'next/font/google',
				evidence: 'app/layout.tsx',
				buildEgressRisk: 'present-not-executed',
			},
			contentlayer: { declaration: '0.3.4', configuration: 'contentlayer.config.ts' },
			image: { module: 'next/image', evidence: 'components/Image.tsx' },
		},
		productionStack: {
			owner: 'candidate',
			framework: 'nextjs',
			bundler: 'webpack',
			customLoader: '@svgr/webpack',
			configuration: 'next.config.js',
			preserved: true,
			viteReplacement: false,
			unpluginReplacement: false,
			compatibility: 'not-tested',
		},
		nodeEngine: 'absent',
		scripts: [...NEXT13_SCRIPTS],
	};
	if (canonicalize(classification.sourceFacts) !== canonicalize(expectedFacts))
		throw new Error('Next13 classification static source facts are invalid');
	for (const [key, expected] of [
		['execution', NEXT13_EXECUTION_NOT_TESTED],
		['boundaries', NEXT13_BOUNDARIES],
	] as const) {
		const section = record(root[key], key);
		exactKeys(section, Object.keys(expected), key);
		if (canonicalize(section) !== canonicalize(expected))
			throw new Error(`Next13 classification ${key} is strengthened`);
	}
	if (
		canonicalize(root.locality) !==
		canonicalize({ mode: 'offline', networkAttempts: 0, candidateExecution: 'not-requested' })
	)
		throw new Error('Next13 classification locality is invalid');
	if (
		canonicalize(root.claims) !==
		canonicalize({
			authenticity: 'not-established',
			certification: 'not-claimed',
			compliance: 'not-claimed',
			osWideIsolation: 'not-established',
			genericReactSupport: 'not-claimed',
			nextjsSupport: 'not-claimed',
			bundlerSupport: 'not-claimed',
		})
	)
		throw new Error('Next13 classification claims are strengthened');
	if (canonicalize(root.limitations) !== canonicalize(NEXT13_LIMITATIONS))
		throw new Error('Next13 classification limitations are invalid');
	const integrity = record(root.integrity, 'integrity');
	exactKeys(integrity, ['algorithm', 'canonicalDigest'], 'integrity');
	const receipt = root as unknown as Next13ProvenanceClassificationReceipt;
	if (
		integrity.algorithm !== 'sha256' ||
		typeof integrity.canonicalDigest !== 'string' ||
		!sha256Pattern.test(integrity.canonicalDigest) ||
		next13ProvenanceClassificationDigest(receipt) !== integrity.canonicalDigest
	)
		throw new Error('Next13 classification canonical digest mismatch');
	return receipt;
}
