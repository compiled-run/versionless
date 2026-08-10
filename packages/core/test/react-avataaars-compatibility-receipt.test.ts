import { describe, expect, test } from 'vitest';
import { canonicalize, sha256 } from '../src/receipts/canonicalize.ts';
import {
	assertReactAvataaarsCompatibilityArtifacts,
	parseReactAvataaarsCompatibilityReceipt,
	REACT_AVATAAARS_COMPATIBILITY_SCHEMA,
} from '../src/receipts/react-avataaars-compatibility.ts';

function fixture() {
	const body = {
		schemaVersion: REACT_AVATAAARS_COMPATIBILITY_SCHEMA,
		runId: 'T608-react-avataaars-compatibility-to-vite8',
		fixture: 'react-avataaars-compatibility',
		result: 'pass',
		counted: false,
		source: {
			repository: 'fangpenlin/avataaars-generator',
			revision: 'c191c6c2d27f41245e803912d43c7213436a34d3',
			tree: '94a3d1a024682b3f21ad30b9de8d4e1541a376d3',
			archiveSha256: '4863a1304b659f1105f69d8ae0c715428c41d2d64b43edfd701148ddfca900da',
		},
		qualification: {
			compatibilityBuilds: 2,
			migratedBuilds: 2,
			compatibilityWitnessRuns: 4,
			migratedWitnessRuns: 4,
			mutationRestoration: 'pass',
			successfulNonLoopback: 0,
		},
		artifacts: [
			'provenance.json',
			'compatibility-baseline.json',
			'migrated-target.json',
			'witness.json',
			'mutation-restoration.json',
			'receipt.md',
		].map((name, index) => ({
			path: `evidence/runs/react-avataaars-compatibility-to-vite8/t608/artifacts/${name}`,
			sha256: String(index).repeat(64),
		})),
		limitations: ['source', 'compatibility', 'authenticity', 'locality'],
	};
	return {
		...body,
		integrity: {
			algorithm: 'sha256',
			canonicalDigest: sha256(canonicalize(body)),
			authenticity: 'not-established',
		},
	};
}

const digest = 'a'.repeat(64);

function witnessRun(
	lane: 'compatibility' | 'migrated',
	pass: number,
	journey: 'selection-history' | 'customization-renderer',
) {
	return {
		lane,
		pass,
		journey,
		result: 'pass',
		receiptSha256: digest,
		beforeSvgSha256: 'b'.repeat(64),
		...(journey === 'selection-history'
			? {
					afterSvgSha256: 'c'.repeat(64),
					generatedCodeSha256: digest,
					generatedCode: {
						avatarStyle: 'Transparent',
						topType: 'Eyepatch',
						visible: true,
					},
					renderedSvgChanged: true,
					historyBack: true,
					reloadPersistence: true,
				}
			: {
					rendererSvgSha256: 'd'.repeat(64),
					download: { filename: 'avataaars.svg', sha256: digest, byteLength: 1000 },
					customizationQuery: true,
					rendererMode: '__render__=1',
				}),
		accessibilityLabels: true,
		interactions:
			journey === 'selection-history'
				? [{ kind: 'click' }, { kind: 'press' }]
				: [{ kind: 'click' }],
		queryNavigation: ['?avatarStyle=Transparent&topType=Eyepatch'],
		consoleMessages: [],
		pageErrors: [],
		failedRequests: [],
		serviceWorkers: Array.from(
			{ length: journey === 'customization-renderer' ? 2 : 1 },
			() => ({ registrations: 0, controller: null, cacheNames: [] }),
		),
		legacyServiceWorkerRequest: false,
		successfulNonLoopback: 0,
	};
}

function artifacts() {
	const restored = [
		witnessRun('migrated', 4, 'selection-history'),
		witnessRun('migrated', 4, 'customization-renderer'),
	];
	return {
		provenance: {
			targetClosure: {
				digest,
				receiptSha256: digest,
				artifacts: [{}, {}, {}],
				consent: {
					id: 'T608-react-avataaars-react1831-target-closure-production',
					method: 'GET',
					host: 'registry.npmjs.org',
					responses: 6,
				},
				nonclaims: ['one', 'two'],
			},
			authorship: 'unknown',
			certification: false,
			signerAuthenticity: false,
		},
		compatibility: {
			classification: 'unsupported-source-commit',
			sourceCommitExecution: 'not-executed',
			compatibilityExecution: 'generated-config-plus-local-only-overlay',
			deltas: [1, 2].map(() => ({
				missingSourcePath: 'tsconfig.prod.json',
				generatedPath: 'tsconfig.prod.json',
				templateSha256: digest,
				toolTarballSha256: digest,
				changedFiles: [
					'public/favicon.png',
					'public/index.html',
					'public/manifest.json',
					'src/components/AvatarForm.tsx',
					'src/components/ComponentImg.tsx',
					'src/index.tsx',
					'tsconfig.prod.json',
				].sort(),
				removedFiles: ['public/favicon.png', 'public/manifest.json'],
				serviceWorkerRegistration: 'removed',
				remoteRuntimeSurfaces: 'removed-or-localized',
			})),
			runtime: '16.20.2',
			bundler: 'react-scripts-ts-3.1.0-webpack',
			digests: [digest, digest],
			toolOverlays: [1, 2].map(() => ({
				beforeSha256: 'b'.repeat(64),
				afterSha256: 'c'.repeat(64),
			})),
			deterministic: true,
			legacyServiceWorkerCall: 'removed-by-local-only-overlay',
			serviceWorkerOutput: 'absent',
		},
		migrated: {
			runtime: '24.15.0',
			bundler: 'vite-8.0.16',
			dependencies: { react: '18.3.1', 'react-dom': '18.3.1', scheduler: '0.23.2' },
			digests: [digest, digest],
			deterministic: true,
			transforms: [{}, {}],
			delta: [
				'index.html',
				'package.json',
				'src/components/AvatarForm.tsx',
				'src/components/ComponentImg.tsx',
				'src/components/App.tsx',
				'src/index.tsx',
				'yarn.lock',
			],
			serviceWorkerRemoval: 'exact-import-and-call-removal',
		},
		witness: {
			runs: [
				witnessRun('compatibility', 1, 'selection-history'),
				witnessRun('compatibility', 1, 'customization-renderer'),
				witnessRun('compatibility', 2, 'selection-history'),
				witnessRun('compatibility', 2, 'customization-renderer'),
				witnessRun('migrated', 1, 'selection-history'),
				witnessRun('migrated', 1, 'customization-renderer'),
				witnessRun('migrated', 2, 'selection-history'),
				witnessRun('migrated', 2, 'customization-renderer'),
			],
			restored,
			contexts: 8,
			directLinkedWitness: true,
			serviceWorkers: 'blocked-and-absent',
			registrations: 0,
			controllers: 0,
			caches: 0,
			successfulNonLoopback: 0,
		},
		mutation: {
			mutation: 'history/query listener replaced by no-op',
			red: true,
			failure: 'witness-query-persistence-red',
			originalSourceSha256: digest,
			restoredSourceSha256: digest,
			originalBuildDigest: digest,
			restoredBuildDigest: digest,
			restoredWitness: restored,
			green: true,
		},
		human: 'unsupported and not executed as-authored; not certification; not OS-wide isolation',
	};
}

describe('React Avataaars compatibility receipt', () => {
	test('accepts exact count-false 2+2 production evidence', () => {
		expect(parseReactAvataaarsCompatibilityReceipt(fixture())).toMatchObject({
			result: 'pass',
			counted: false,
		});
	});

	test('rejects count, behavior, artifact, and digest strengthening', () => {
		for (const mutate of [
			(value: ReturnType<typeof fixture>) => (value.counted = true as false),
			(value: ReturnType<typeof fixture>) => (value.qualification.migratedWitnessRuns = 1),
			(value: ReturnType<typeof fixture>) => (value.artifacts[0]!.path = '/host/path'),
			(value: ReturnType<typeof fixture>) =>
				(value.integrity.canonicalDigest = '0'.repeat(64)),
		]) {
			const value = fixture();
			mutate(value);
			expect(() => parseReactAvataaarsCompatibilityReceipt(value)).toThrow();
		}
	});

	test('independently verifies support-artifact semantics', () => {
		expect(() => assertReactAvataaarsCompatibilityArtifacts(artifacts())).not.toThrow();
		const changed = artifacts();
		changed.mutation.failure = 'raw host-specific failure';
		expect(() => assertReactAvataaarsCompatibilityArtifacts(changed)).toThrow();
	});
});
