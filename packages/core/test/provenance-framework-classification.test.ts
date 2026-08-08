import { describe, expect, it } from 'vitest';
import {
	createProvenanceFrameworkClassificationReceipt,
	parseProvenanceFrameworkClassificationReceipt,
	PROVENANCE_BOUNDARIES_UNKNOWN,
	PROVENANCE_EXECUTION_NOT_TESTED,
	PROVENANCE_FRAMEWORK_CLASSIFICATION_SCHEMA,
	provenanceFrameworkClassificationDigest,
	type ProvenanceSourceFacts,
} from '../src/receipts/provenance-framework-classification.ts';
import {
	FRAMEWORK_CLASSIFICATION_SCHEMA,
	NOT_TESTED_EXECUTION,
} from '../src/receipts/framework-classification.ts';

const sourceFacts: ProvenanceSourceFacts = {
	next: { declaration: '^12.0.10', major: 12 },
	react: { declaration: '^17.0.2' },
	packageManager: { name: 'yarn', lockfile: 'yarn.lock', format: 'v1' },
	routing: { mode: 'pages', evidence: ['pages/index.tsx'] },
	staticGeneration: { kind: 'getStaticProps', evidence: ['pages/index.tsx'] },
	playwright: {
		configuration: 'playwright.config.ts',
		workflow: '.github/workflows/playwright.yml',
		state: 'present-not-executed',
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
	searchPath: 'components/Search/index.tsx',
	scripts: [
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
	],
};

function receipt() {
	return createProvenanceFrameworkClassificationReceipt({
		closure: {
			fixtureId: 'next-killedbygoogle',
			repository: 'codyogden/killedbygoogle',
			nonFork: true,
			commit: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
			tree: 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763',
			fixtureSha256: 'dd8725527ffa7f9b50826bd740cbda9bf5e2e08ee4c0fe8727505051c055d23a',
			provenanceSha256: '2d7b33af46e951f2e128b5dd4c440d611e0c27f593d3004b470190abc703164b',
			evidenceSha256: 'ee5498bb5b1187371b6c58c4dfb3e0cdd58fdab8e5eea1eb09eba839c6b66843',
			archiveSha256: 'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d',
			cacheManifestSha256: '04d5d4ca5f4133ecb5772c5aab9053af4f58cfcfdb2d837dcdd0f16da5eec9d8',
			archiveManifestSha256:
				'05c3677979d98740e8c76a599497e43fe2b623a43e56226edd01c53bf2bf572c',
			offlineReplaySha256: 'faf10cb59a9b63919346d3a98250afbd8f89527fd616576c337da3e1e70bd85a',
			officialTreeRows: 86,
			archiveFiles: 72,
			reliedPaths: [
				'.github/workflows/playwright.yml',
				'LICENSE',
				'components/Search/index.tsx',
				'next.config.js',
				'package.json',
				'pages/index.tsx',
				'yarn.lock',
			],
			rootLicense: {
				path: 'LICENSE',
				sha256: '10547fb81e311e470cdcda5a273bac2a76f50ded6b33ce4362bcb05e1176d5e0',
				classification: 'verified-compatible',
			},
			licenseInventoryEntries: 1,
			assetClassificationEntries: 22,
		},
		sourceFacts,
	});
}

describe('provenance-bound framework classification receipt', () => {
	it('uses a separate exact schema without changing synthetic schemas', () => {
		const value = receipt();
		expect(value.schemaVersion).toBe(PROVENANCE_FRAMEWORK_CLASSIFICATION_SCHEMA);
		expect(value.schemaVersion).not.toBe(FRAMEWORK_CLASSIFICATION_SCHEMA);
		expect(value.execution).toEqual(PROVENANCE_EXECUTION_NOT_TESTED);
		expect(value.boundaries).toEqual(PROVENANCE_BOUNDARIES_UNKNOWN);
		expect(NOT_TESTED_EXECUTION.provenance).toBe('not-tested');
		expect(parseProvenanceFrameworkClassificationReceipt(value)).toEqual(value);
	});

	it('binds provenance only while preserving every execution and claim nonclaim', () => {
		const value = receipt();
		expect(value.closure.provenance).toBe('verified');
		expect(value.closure.provenanceScope).toBe('exact-immutable-closure-only');
		expect(value.locality).toEqual({
			mode: 'offline',
			networkAttempts: 0,
			candidateExecution: 'not-requested',
		});
		expect(new Set(Object.values(value.execution))).toEqual(new Set(['not-tested']));
		expect(value.claims).toEqual({
			authenticity: 'not-established',
			certification: 'not-claimed',
			compliance: 'not-claimed',
			osWideIsolation: 'not-established',
			genericReactSupport: 'not-claimed',
			nextjsSupport: 'not-claimed',
			bundlerSupport: 'not-claimed',
		});
	});

	it('rejects extra keys, identity/hash/count/path drift, source strengthening, and tampering', () => {
		const wrongHash = 'a'.repeat(64);
		const mutations: Array<(value: any) => void> = [
			(value) => (value.extra = true),
			(value) => (value.closure.repository = 'other/repository'),
			(value) => (value.closure.fixtureSha256 = 'invalid'),
			(value) => (value.closure.fixtureSha256 = wrongHash),
			(value) => (value.closure.provenanceSha256 = wrongHash),
			(value) => (value.closure.evidenceSha256 = wrongHash),
			(value) => (value.closure.archiveSha256 = wrongHash),
			(value) => (value.closure.cacheManifestSha256 = wrongHash),
			(value) => (value.closure.archiveManifestSha256 = wrongHash),
			(value) => (value.closure.offlineReplaySha256 = wrongHash),
			(value) => (value.closure.officialTreeRows = 85),
			(value) => (value.closure.archiveFiles = 71),
			(value) => value.closure.reliedPaths.reverse(),
			(value) => (value.closure.rootLicense.sha256 = wrongHash),
			(value) => (value.closure.licenseInventoryEntries = 2),
			(value) => (value.closure.assetClassificationEntries = 21),
			(value) => (value.classification.sourceFacts.next.declaration = '^13.0.0'),
			(value) => (value.classification.sourceFacts.next.major = 13),
			(value) => (value.classification.sourceFacts.react.declaration = '^18.0.0'),
			(value) => (value.classification.sourceFacts.scripts[0].command = 'next build --debug'),
			(value) => (value.classification.sourceFacts.scripts[0].name = 'assemble'),
			(value) => (value.classification.sourceFacts.productionStack.viteReplacement = true),
			(value) => (value.classification.sourceFacts.extra = true),
			(value) => (value.execution.build = 'verified'),
			(value) => (value.boundaries.server = 'none-declared'),
			(value) => (value.locality.networkAttempts = 1),
			(value) => (value.claims.nextjsSupport = 'claimed'),
			(value) => (value.limitations[0] = 'Static classification establishes support.'),
			(value) => (value.integrity.canonicalDigest = '0'.repeat(64)),
		];
		for (const mutate of mutations) {
			const value: any = structuredClone(receipt());
			mutate(value);
			if (value.integrity.canonicalDigest !== '0'.repeat(64))
				value.integrity.canonicalDigest = provenanceFrameworkClassificationDigest(value);
			expect(() => parseProvenanceFrameworkClassificationReceipt(value)).toThrow();
		}
	});
});
