import { describe, expect, it } from 'vitest';
import {
	createNext13ProvenanceClassificationReceipt,
	NEXT13_BOUNDARIES,
	NEXT13_EXECUTION_NOT_TESTED,
	NEXT13_PROVENANCE_CLASSIFICATION_SCHEMA,
	NEXT13_RELIED_PATHS,
	NEXT13_SCRIPTS,
	next13ProvenanceClassificationDigest,
	parseNext13ProvenanceClassificationReceipt,
	type Next13SourceFacts,
} from '../src/receipts/next13-provenance-classification.ts';
import { PROVENANCE_FRAMEWORK_CLASSIFICATION_SCHEMA } from '../src/receipts/provenance-framework-classification.ts';

const sourceFacts: Next13SourceFacts = {
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

function receipt() {
	return createNext13ProvenanceClassificationReceipt({
		closure: {
			fixtureId: 'next-tailwind-starter-blog',
			repository: 'timlrx/tailwind-nextjs-starter-blog',
			nonFork: true,
			commit: '09ba0550caea03a8c38bc4878d05838d2a57f999',
			tree: '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf',
			fixtureSha256: 'd24bf99d50e7f90ac53dcc7d99f04fcd9842379d94393548c7abbf486288b6c1',
			provenanceSha256: 'b0cb4e5b597bd619d8ea76912b09a6257bb1e3be4f4d259160334518a8b5bc29',
			evidenceSha256: '4562e7fe0ab786cede4a40ead07666d44d085a45699443fe65da4aabed9b61f0',
			archiveSha256: 'c227efa283b4a17d7ae76aa1b9ea259075f606128642d59f7b43ca63405ee1f7',
			cacheManifestSha256: '8079a31d105783e6e293402ea541c13c4fe2ff7038d010b414d322491b3dd202',
			archiveManifestSha256:
				'8cce8b04846e0382bf1a4b2812881a998fc3d2cf061b2f43362310139da801e3',
			offlineReplaySha256: '5b525cf6cfc447fbdd3ca0640115c7810b67de5dd1680e3d5ff624356e767a98',
			officialTreeRows: 138,
			archiveFiles: 110,
			reliedPaths: [...NEXT13_RELIED_PATHS],
			rootLicense: {
				path: 'LICENSE',
				sha256: '317b52bec9a462916d9219427552de01604be107efc60606a3046df2d2ee0ff2',
				classification: 'verified-compatible',
			},
			licenseInventoryEntries: 1,
			assets: { total: 25, excluded: 11, unknown: 14, compatible: 0 },
		},
		sourceFacts,
	});
}

describe('Next13 provenance classification receipt', () => {
	it('uses a separate exact schema and preserves all execution boundaries', () => {
		const value = receipt();
		expect(value.schemaVersion).toBe(NEXT13_PROVENANCE_CLASSIFICATION_SCHEMA);
		expect(value.schemaVersion).not.toBe(PROVENANCE_FRAMEWORK_CLASSIFICATION_SCHEMA);
		expect(value.execution).toEqual(NEXT13_EXECUTION_NOT_TESTED);
		expect(value.boundaries).toEqual(NEXT13_BOUNDARIES);
		expect(new Set(Object.values(value.execution))).toEqual(new Set(['not-tested']));
		expect(parseNext13ProvenanceClassificationReceipt(value)).toEqual(value);
	});

	it('rejects closure, source-fact, execution, claim, and digest drift', () => {
		const wrongHash = 'a'.repeat(64);
		const mutations: Array<(value: any) => void> = [
			(value) => (value.extra = true),
			(value) => (value.schemaVersion = PROVENANCE_FRAMEWORK_CLASSIFICATION_SCHEMA),
			(value) => (value.closure.repository = 'timlrx/other'),
			(value) => (value.closure.fixtureSha256 = wrongHash),
			(value) => (value.closure.provenanceSha256 = wrongHash),
			(value) => (value.closure.evidenceSha256 = wrongHash),
			(value) => (value.closure.cacheManifestSha256 = wrongHash),
			(value) => (value.closure.officialTreeRows = 137),
			(value) => (value.closure.archiveFiles = 109),
			(value) => value.closure.reliedPaths.reverse(),
			(value) => (value.closure.assets.unknown = 13),
			(value) => (value.classification.sourceFacts.next.declaration = '13.5.0'),
			(value) => (value.classification.sourceFacts.packageManager.pinnedRelease = '4.0.2'),
			(value) => (value.classification.sourceFacts.packageManager.resolutions = 1164),
			(value) => (value.classification.sourceFacts.routing.generateStaticParams = 'verified'),
			(value) => (value.classification.sourceFacts.apiRoute.state = 'verified'),
			(value) => (value.classification.sourceFacts.resources.font.buildEgressRisk = 'safe'),
			(value) => (value.classification.sourceFacts.nodeEngine = '>=18'),
			(value) => (value.classification.sourceFacts.scripts[0].command = 'next build'),
			(value) => (value.execution.build = 'verified'),
			(value) => (value.boundaries.dependencyClosure = 'present'),
			(value) => (value.locality.networkAttempts = 1),
			(value) => (value.claims.nextjsSupport = 'claimed'),
			(value) => (value.integrity.canonicalDigest = '0'.repeat(64)),
		];
		for (const mutate of mutations) {
			const value: any = structuredClone(receipt());
			mutate(value);
			if (value.integrity.canonicalDigest !== '0'.repeat(64))
				value.integrity.canonicalDigest = next13ProvenanceClassificationDigest(value);
			expect(() => parseNext13ProvenanceClassificationReceipt(value)).toThrow();
		}
	});
});
