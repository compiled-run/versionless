import { describe, expect, test } from 'vitest';
import { assertSyntheticEvidence, findSensitiveSignals } from '../src/policy/payment-signals.ts';

describe('synthetic evidence policy', () => {
	const phonecatDigest = '6726979ebc735e402281131c67f3f22f8451c700f8f689438309086194466c66';
	const nextManifestDigest = '0494c112f125563371503840912e3663fd92341f819aae1d9d5ccad843abd15a';
	const truncatedNextManifestDigest = nextManifestDigest.slice(0, -1);
	const runtimeObservation = (journeyProjection: unknown) => ({
		schemaVersion: 'versionless.runtime-script-observation.v1',
		summary: {},
		boundaries: {},
		inputs: {},
		verticals: [{ lanes: [{ runs: [{ journeyProjection }] }] }],
		detectorMutation: {},
	});
	const syntheticObjectId = (index: number) => {
		const digits = index % 2 === 0 ? '1234567890123' : '1234567890123456789';
		return `a${digits}${index.toString(16).padStart(39 - digits.length, 'b')}`;
	};
	const syntheticOfficialTree = () =>
		Array.from({ length: 86 }, (_, index) => ({
			path: `synthetic/row-${index}.ts`,
			mode: '100644',
			type: 'blob',
			sha: syntheticObjectId(index),
		}));
	const syntheticT124Provenance = () => ({
		schemaVersion: 'versionless.cross-source-provenance.v1',
		fixture: 'next-killedbygoogle',
		repository: 'codyogden/killedbygoogle',
		repositoryIdentity: { fullName: 'codyogden/killedbygoogle', fork: false },
		commit: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
		tree: 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763',
		archive: {},
		fileCount: 86,
		officialTreeRowCount: 86,
		officialTree: syntheticOfficialTree(),
		fileManifestSha256: 'synthetic-manifest',
		acceptedGlobalMetadata: null as unknown,
		acceptedPathMetadata: [],
		files: [],
		rootLicense: {},
		licensing: [],
		assets: [],
		corroboratedLeadFacts: { scope: 'provenance-only' },
		evidenceBlockers: ['not-tested'],
		nestedCompatibleLicense: null,
		excludedCommittedDist: [],
	});
	const syntheticT138OfficialTree = () =>
		Array.from({ length: 138 }, (_, index) => ({
			path: `synthetic/t138-row-${index}.ts`,
			mode: index === 0 ? '040000' : index % 17 === 0 ? '100755' : '100644',
			type: index === 0 ? 'tree' : 'blob',
			sha: syntheticObjectId(index),
		}));
	const syntheticT138Provenance = () => ({
		schemaVersion: 'versionless.cross-source-provenance.v1',
		fixture: 'next-tailwind-starter-blog',
		repository: 'timlrx/tailwind-nextjs-starter-blog',
		repositoryIdentity: { fullName: 'timlrx/tailwind-nextjs-starter-blog', fork: false },
		commit: '09ba0550caea03a8c38bc4878d05838d2a57f999',
		tree: '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf',
		archive: {},
		fileCount: 120,
		officialTreeRowCount: 138,
		officialTree: syntheticT138OfficialTree(),
		fileManifestSha256: 'synthetic-manifest',
		acceptedGlobalMetadata: null as unknown,
		acceptedPathMetadata: [],
		files: [],
		rootLicense: {},
		licensing: [],
		assets: [],
		corroboratedLeadFacts: { scope: 'provenance-only' },
		evidenceBlockers: ['not-tested'],
		nestedCompatibleLicense: null,
		excludedCommittedDist: [],
	});
	const syntheticT138ImmutableFixture = () => ({
		schemaVersion: 'versionless.immutable-fixture.v1',
		id: 'next-tailwind-starter-blog',
		framework: 'nextjs',
		repository: 'timlrx/tailwind-nextjs-starter-blog',
		repositoryUrl: 'https://github.com/timlrx/tailwind-nextjs-starter-blog',
		commit: '09ba0550caea03a8c38bc4878d05838d2a57f999',
		tree: '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf',
		archive: { url: 'https://example.test/archive', sha256: 'a'.repeat(64), byteLength: 1 },
		archiveManifestSha256: 'b'.repeat(64),
		repositoryIdentity: {
			fullName: 'timlrx/tailwind-nextjs-starter-blog',
			fork: false,
		},
		reliedPaths: [
			'.yarnrc.yml',
			'LICENSE',
			'app/api/newsletter2/route.ts',
			'app/blog/[...slug]/page.tsx',
			'app/layout.tsx',
			'next.config.js',
			'package.json',
			'yarn.lock',
		],
		corroboratedLeadFacts: { scope: 'provenance-only' },
		evidenceBlockers: ['not-tested'],
		usableClosure: {
			assets: 'not-tested',
			nestedLicensing: 'not-tested',
			committedDist: 'not-tested',
		},
		localityBoundaries: ['not-tested'],
		nonclaims: ['No payment or authentication support is established.'],
	});
	test('allows nonnumeric field/category markers', () =>
		expect(() =>
			assertSyntheticEvidence({
				categories: ['payment-field', 'verification-field'],
				marker: 'VERSIONLESS_SYNTHETIC',
			}),
		).not.toThrow());
	test('rejects secret categories and numeric payment-like material', () => {
		expect(
			findSensitiveSignals({ credential_token: 'VERSIONLESS_SYNTHETIC' }).length,
		).toBeGreaterThan(0);
		expect(
			findSensitiveSignals({
				value: 'NINE NINE NINE NINE NINE NINE NINE NINE NINE NINE NINE NINE NINE',
			}),
		).toHaveLength(0);
		expect(() => assertSyntheticEvidence({ value: 'sk_test_VERSIONLESS_SYNTHETIC' })).toThrow(
			'Sensitive material refused',
		);
	});
	test('allows exact SHA-256 values only at exact digest paths', () => {
		expect(() =>
			assertSyntheticEvidence({
				verification: {
					deterministicCore: { first: phonecatDigest, second: phonecatDigest },
				},
			}),
		).not.toThrow();
		expect(() => assertSyntheticEvidence({ artifactSha256: phonecatDigest })).not.toThrow();
		expect(() => assertSyntheticEvidence({ canonicalDigest: phonecatDigest })).not.toThrow();
		expect(() => assertSyntheticEvidence({ ordinary: phonecatDigest })).toThrow(
			'Sensitive material refused',
		);
		expect(() =>
			assertSyntheticEvidence({
				verification: { deterministicCore: { third: phonecatDigest } },
			}),
		).toThrow('Sensitive material refused');
	});

	test('rejects payment-like non-digests even under digest paths', () => {
		const wrongLength = '1234567890123456';
		const nonHex = `${'a'.repeat(48)}1234567890123456z`;
		for (const value of [wrongLength, nonHex]) {
			expect(() => assertSyntheticEvidence({ artifactSha256: value })).toThrow(
				'Sensitive material refused',
			);
			expect(() =>
				assertSyntheticEvidence({
					verification: { deterministicCore: { first: value } },
				}),
			).toThrow('Sensitive material refused');
		}
	});

	test('allows the unchanged Next manifest digest only as canonical CycloneDX SHA-256 content', () => {
		expect(() =>
			assertSyntheticEvidence({
				bomFormat: 'CycloneDX',
				specVersion: '1.7',
				version: 1,
				components: [
					{
						type: 'application',
						name: '@versionless/nextjs',
						version: '0.0.1',
						'bom-ref': 'workspace:packages/frameworks/nextjs',
						hashes: [{ alg: 'SHA-256', content: nextManifestDigest }],
					},
				],
			}),
		).not.toThrow();
		expect(truncatedNextManifestDigest).toHaveLength(63);
		expect(() =>
			assertSyntheticEvidence({
				bomFormat: 'CycloneDX',
				specVersion: '1.7',
				version: 1,
				components: [
					{ hashes: [{ alg: 'SHA-256', content: truncatedNextManifestDigest }] },
				],
			}),
		).toThrow('Sensitive material refused');
	});

	test('rejects CycloneDX digest lookalikes and malformed hash entries', () => {
		const document = (hash: Record<string, unknown>, overrides = {}) => ({
			bomFormat: 'CycloneDX',
			specVersion: '1.7',
			version: 1,
			components: [{ hashes: [hash] }],
			...overrides,
		});
		for (const value of [
			{ ordinary: nextManifestDigest },
			{ content: nextManifestDigest },
			document({ alg: 'SHA-256', value: nextManifestDigest }),
			document({ content: nextManifestDigest }),
			document({ alg: 'SHA-512', content: nextManifestDigest }),
			document({ alg: 'sha-256', content: nextManifestDigest }),
			document({ alg: 'SHA-256', content: nextManifestDigest }, { specVersion: '1.6' }),
			{
				bomFormat: 'CycloneDX',
				specVersion: '1.7',
				version: 1,
				components: [
					{ nested: { hashes: [{ alg: 'SHA-256', content: nextManifestDigest }] } },
				],
			},
		])
			expect(() => assertSyntheticEvidence(value)).toThrow('Sensitive material refused');
		for (const content of ['1234567890123456', `${'a'.repeat(48)}1234567890123456z`])
			expect(() => assertSyntheticEvidence(document({ alg: 'SHA-256', content }))).toThrow(
				'Sensitive material refused',
			);
	});

	test('keeps forbidden keys and secret values active inside canonical hash entries', () => {
		for (const hash of [
			{ alg: 'SHA-256', content: nextManifestDigest, authToken: 'VERSIONLESS_SYNTHETIC' },
			{ alg: 'SHA-256', content: nextManifestDigest, note: 'sk_test_VERSIONLESS_SYNTHETIC' },
			{ alg: 'SHA-256', content: nextManifestDigest, egressToken: 'VERSIONLESS_SYNTHETIC' },
		])
			expect(() =>
				assertSyntheticEvidence({
					bomFormat: 'CycloneDX',
					specVersion: '1.7',
					version: 1,
					components: [{ hashes: [hash] }],
				}),
			).toThrow('Sensitive material refused');
	});

	test('accepts safe payment, customer, and authentication blocker vocabulary structurally', () => {
		expect(() =>
			assertSyntheticEvidence({
				payment: 'not-tested',
				customer: 'support is not established',
				authentication: 'nonclaim: behavior was not tested',
				blockers: [
					'Server, API, data, authentication, and payment behavior remain not-tested.',
				],
				nonclaims: ['No payment, customer, or authentication support is established.'],
			}),
		).not.toThrow();
		for (const unsafe of [
			{ payment: 'supported' },
			{ customer: 'verified' },
			{ authentication: 'enabled' },
			{ claim: 'payment support is established' },
		])
			expect(() => assertSyntheticEvidence(unsafe)).toThrow('Sensitive material refused');
	});

	test('rejects realistic PAN, customer PII, credentials, and secrets', () => {
		for (const unsafe of [
			{ value: '4111 1111 1111 1111' },
			{ value: '378282246310005' },
			{ customerEmail: 'alex.customer@example.com' },
			{ customerName: 'Alex Customer' },
			{ username: 'workstation-owner' },
			{ note: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature' },
			{ note: 'api_key=live-secret-value' },
			{ note: 'authorization: Basic Zm9vOmJhcg==' },
			{ note: 'cookie: sessionid=sensitive-value' },
			{ note: '-----BEGIN RSA PRIVATE KEY-----' },
		])
			expect(() => assertSyntheticEvidence(unsafe)).toThrow('Sensitive material refused');
	});

	test('allows only canonical octocat in the exact runtime observation projection context', () => {
		expect(() =>
			assertSyntheticEvidence(runtimeObservation({ username: 'octocat' })),
		).not.toThrow();
		for (const unsafe of [
			runtimeObservation({ username: 'workstation-owner' }),
			runtimeObservation({ username: 'Octocat' }),
			{
				...runtimeObservation({}),
				verticals: [
					{ lanes: [{ runs: [{ username: 'octocat', journeyProjection: {} }] }] },
				],
			},
			runtimeObservation({ nested: { username: 'octocat' } }),
			runtimeObservation([{ username: 'octocat' }]),
			{
				...runtimeObservation({ username: 'octocat' }),
				schemaVersion: 'runtime-script-observation.v1',
			},
			{
				...runtimeObservation({ username: 'octocat' }),
				verticals: { lanes: [{ runs: [{ journeyProjection: { username: 'octocat' } }] }] },
			},
			{ ...runtimeObservation({ username: 'octocat' }), extra: true },
			{
				schemaVersion: 'versionless.runtime-script-observation.v1',
				verticals: [
					{ lanes: [{ runs: [{ journeyProjection: { username: 'octocat' } }] }] },
				],
			},
			{ wrapper: runtimeObservation({ username: 'octocat' }) },
			{ username: 'octocat' },
		])
			expect(() => assertSyntheticEvidence(unsafe)).toThrow('Sensitive material refused');
	});

	test('allows only synthetic Git object IDs in the exact validated T124 official tree', () => {
		const accepted = syntheticT124Provenance();
		expect(accepted.officialTree).toHaveLength(86);
		expect(accepted.officialTree[0]?.sha).toContain('1234567890123');
		expect(accepted.officialTree[1]?.sha).toContain('1234567890123456789');
		expect(() => assertSyntheticEvidence(accepted)).not.toThrow();

		const mutation = (
			change: (document: ReturnType<typeof syntheticT124Provenance>) => void,
		) => {
			const document = syntheticT124Provenance();
			change(document);
			return document;
		};
		const invalidObjectIds = [
			'1234567890123456789012345678901234567890',
			'a1234567890123bbbbbbbbbbbbbbbbbbbbbbbbb',
			'A1234567890123bbbbbbbbbbbbbbbbbbbbbbbbb',
			'g1234567890123bbbbbbbbbbbbbbbbbbbbbbbbb',
		];
		for (const sha of invalidObjectIds)
			expect(() =>
				assertSyntheticEvidence(
					mutation((document) => {
						document.officialTree[0]!.sha = sha;
					}),
				),
			).toThrow('Sensitive material refused');

		for (const unsafe of [
			{ sha: syntheticObjectId(0) },
			{ wrapper: syntheticT124Provenance() },
			{ officialTree: syntheticOfficialTree() },
			mutation((document) => {
				document.officialTreeRowCount = 85;
			}),
			mutation((document) => {
				document.officialTree.pop();
			}),
			mutation((document) => {
				document.schemaVersion = 'versionless.cross-source-provenance.v2';
			}),
			mutation((document) => {
				document.fixture = 'next-killedbygoogle-wrapped';
			}),
			mutation((document) => {
				document.repository = 'synthetic/killedbygoogle';
			}),
			mutation((document) => {
				document.repositoryIdentity.fork = true;
			}),
			mutation((document) => {
				(document.repositoryIdentity as Record<string, unknown>).extra = false;
			}),
			mutation((document) => {
				document.commit = 'a1234567890123bbbbbbbbbbbbbbbbbbbbbbbbbb';
			}),
			mutation((document) => {
				document.tree = 'a1234567890123bbbbbbbbbbbbbbbbbbbbbbbbbb';
			}),
			mutation((document) => {
				(document as Record<string, unknown>).extra = 'not-tested';
			}),
			mutation((document) => {
				delete (document as Partial<Record<string, unknown>>).archive;
			}),
			mutation((document) => {
				(document.officialTree[0] as Record<string, unknown>).extra = 'not-tested';
			}),
			mutation((document) => {
				delete (document.officialTree[0] as Partial<Record<string, unknown>>).mode;
			}),
			mutation((document) => {
				document.officialTree[0]!.path = '../synthetic/escape.ts';
			}),
			mutation((document) => {
				document.officialTree[0]!.type = 'commit';
			}),
			mutation((document) => {
				document.officialTree[0]!.mode = '120000';
			}),
			mutation((document) => {
				(document.officialTree[0] as Record<string, unknown>).nested = {
					sha: syntheticObjectId(1),
				};
			}),
			mutation((document) => {
				document.acceptedGlobalMetadata = { sha: syntheticObjectId(2) };
			}),
			mutation((document) => {
				document.acceptedGlobalMetadata = { value: '4111 1111 1111 1111' };
			}),
			mutation((document) => {
				document.acceptedGlobalMetadata = { customerEmail: 'synthetic@example.test' };
			}),
			mutation((document) => {
				document.acceptedGlobalMetadata = { note: 'sk_test_VERSIONLESS_SYNTHETIC' };
			}),
			mutation((document) => {
				document.acceptedGlobalMetadata = { claim: 'payment support is established' };
			}),
			mutation((document) => {
				document.acceptedGlobalMetadata = { username: 'workstation-owner' };
			}),
			mutation((document) => {
				document.acceptedGlobalMetadata = runtimeObservation({ username: 'octocat' });
			}),
		])
			expect(() => assertSyntheticEvidence(unsafe)).toThrow('Sensitive material refused');
	});

	test('allows only direct Git object IDs in the exact T138 provenance context', () => {
		const accepted = syntheticT138Provenance();
		expect(accepted.officialTree).toHaveLength(138);
		expect(new Set(accepted.officialTree.map((row) => row.path))).toHaveProperty('size', 138);
		expect(() => assertSyntheticEvidence(accepted)).not.toThrow();

		const mutation = (
			change: (document: ReturnType<typeof syntheticT138Provenance>) => void,
		) => {
			const document = syntheticT138Provenance();
			change(document);
			return document;
		};
		for (const sha of [
			'1234567890123456789012345678901234567890',
			'a1234567890123bbbbbbbbbbbbbbbbbbbbbbbbb',
			'A1234567890123bbbbbbbbbbbbbbbbbbbbbbbbb',
			'g1234567890123bbbbbbbbbbbbbbbbbbbbbbbbb',
		])
			expect(() =>
				assertSyntheticEvidence(
					mutation((document) => {
						document.officialTree[0]!.sha = sha;
					}),
				),
			).toThrow('Sensitive material refused');

		for (const unsafe of [
			{ sha: syntheticObjectId(0) },
			{ digest: syntheticObjectId(0) },
			{ wrapper: syntheticT138Provenance() },
			{ officialTree: syntheticT138OfficialTree() },
			mutation((document) => {
				document.schemaVersion = 'versionless.cross-source-provenance.v2';
			}),
			mutation((document) => {
				document.fixture = 'next-tailwind-starter-blog-wrapper';
			}),
			mutation((document) => {
				document.repository = 'other/tailwind-nextjs-starter-blog';
			}),
			mutation((document) => {
				document.repositoryIdentity.fullName = 'other/tailwind-nextjs-starter-blog';
			}),
			mutation((document) => {
				document.repositoryIdentity.fork = true;
			}),
			mutation((document) => {
				(document.repositoryIdentity as Record<string, unknown>).extra = false;
			}),
			mutation((document) => {
				document.commit = 'a1234567890123bbbbbbbbbbbbbbbbbbbbbbbbbb';
			}),
			mutation((document) => {
				document.tree = 'a1234567890123bbbbbbbbbbbbbbbbbbbbbbbbbb';
			}),
			mutation((document) => {
				document.officialTreeRowCount = 137;
			}),
			mutation((document) => {
				document.officialTree.pop();
			}),
			mutation((document) => {
				document.officialTree.push({
					path: 'synthetic/extra.ts',
					mode: '100644',
					type: 'blob',
					sha: syntheticObjectId(138),
				});
			}),
			mutation((document) => {
				document.officialTree[137]!.path = document.officialTree[0]!.path;
			}),
			mutation((document) => {
				document.officialTree[0]!.path = '../synthetic/escape.ts';
			}),
			mutation((document) => {
				document.officialTree[0]!.type = 'commit';
			}),
			mutation((document) => {
				document.officialTree[0]!.mode = '120000';
			}),
			mutation((document) => {
				(document.officialTree[0] as Record<string, unknown>).shaSibling =
					syntheticObjectId(1);
			}),
			mutation((document) => {
				(document.officialTree[0] as Record<string, unknown>).nested = {
					sha: syntheticObjectId(1),
				};
			}),
			mutation((document) => {
				delete (document.officialTree[0] as Partial<Record<string, unknown>>).sha;
			}),
			mutation((document) => {
				(document as Record<string, unknown>).extra = 'not-tested';
			}),
			mutation((document) => {
				delete (document as Partial<Record<string, unknown>>).archive;
			}),
			mutation((document) => {
				document.acceptedGlobalMetadata = { sha: syntheticObjectId(2) };
			}),
			mutation((document) => {
				document.acceptedGlobalMetadata = { value: '4111 1111 1111 1111' };
			}),
			mutation((document) => {
				document.acceptedGlobalMetadata = { customerEmail: 'synthetic@example.test' };
			}),
			mutation((document) => {
				document.acceptedGlobalMetadata = { note: 'sk_test_VERSIONLESS_SYNTHETIC' };
			}),
			mutation((document) => {
				document.acceptedGlobalMetadata = { claim: 'payment support is established' };
			}),
		])
			expect(() => assertSyntheticEvidence(unsafe)).toThrow('Sensitive material refused');
	});

	test('recognizes only the exact T138 immutable fixture kind and scans its fields ordinarily', () => {
		const accepted = syntheticT138ImmutableFixture();
		expect(() => assertSyntheticEvidence(accepted)).not.toThrow();
		const mutation = (
			change: (document: ReturnType<typeof syntheticT138ImmutableFixture>) => void,
		) => {
			const document = syntheticT138ImmutableFixture();
			change(document);
			return document;
		};
		for (const unsafe of [
			mutation((document) => {
				document.schemaVersion = 'versionless.cross-source-provenance.v1';
			}),
			mutation((document) => {
				document.id = 'next-tailwind-starter-blog-copy';
			}),
			mutation((document) => {
				document.framework = 'react';
			}),
			mutation((document) => {
				document.repository = 'timlrx/other';
			}),
			mutation((document) => {
				document.repositoryIdentity.fullName = 'timlrx/other';
			}),
			mutation((document) => {
				document.repositoryIdentity.fork = true;
			}),
			mutation((document) => {
				document.commit = 'a'.repeat(40);
			}),
			mutation((document) => {
				document.tree = 'b'.repeat(40);
			}),
			mutation((document) => {
				document.reliedPaths = document.reliedPaths.slice(1);
			}),
			mutation((document) => {
				(document as Record<string, unknown>).officialTree = [];
			}),
			mutation((document) => {
				(document as Record<string, unknown>).extra = 'not-tested';
			}),
			mutation((document) => {
				delete (document as Partial<Record<string, unknown>>).usableClosure;
			}),
		])
			expect(() => assertSyntheticEvidence(unsafe)).toThrow('Sensitive material refused');

		const ordinaryCases: Array<{
			readonly path: string;
			readonly kind: string;
			readonly value: Record<string, unknown>;
		}> = [
			{
				path: '$.usableClosure.assets',
				kind: 'pan-like-value',
				value: { assets: '4111 1111 1111 1111' },
			},
			{
				path: '$.usableClosure.paymentToken',
				kind: 'forbidden-key',
				value: { paymentToken: 'synthetic' },
			},
			{
				path: '$.usableClosure.authentication',
				kind: 'support-claim-like-value',
				value: { authentication: 'authentication support is enabled' },
			},
			{
				path: '$.usableClosure.credential',
				kind: 'secret-like-value',
				value: { credential: 'authorization: synthetic' },
			},
			{
				path: '$.usableClosure.contact',
				kind: 'pii-like-value',
				value: { contact: 'synthetic@example.test' },
			},
			{
				path: '$.usableClosure.note',
				kind: 'secret-like-value',
				value: { note: 'sk_test_VERSIONLESS_SYNTHETIC' },
			},
			{
				path: '$.usableClosure.digestCopy',
				kind: 'pan-like-value',
				value: { digestCopy: syntheticObjectId(0) },
			},
		];
		for (const ordinary of ordinaryCases) {
			const document = syntheticT138ImmutableFixture();
			document.usableClosure = ordinary.value as typeof document.usableClosure;
			expect(findSensitiveSignals(document)).toContainEqual({
				path: ordinary.path,
				kind: ordinary.kind,
			});
		}
	});

	/**
	 * HospitalRun's immutable revision opens with a thirteen-digit run, which is
	 * exactly what the primary-account-number detector looks for. Derived corpus
	 * provenance has to publish the revision verbatim, so the admission is
	 * pinned here from both sides: the exact published object id is accepted in
	 * its exact published position, and every neighbouring shape still trips.
	 */
	describe('derived corpus provenance revision object IDs', () => {
		const hospitalrunRevision = '8156955145551d0366df10faa28e724f3377dea1';
		const hospitalrunDigitRun = '8156955145551';
		const conformance = (source: Record<string, unknown>) => ({
			schemaVersion: 'versionless.corpus-conformance.v1',
			summary: { verticals: 13, sourceApplications: 6, designatedPilotsVerified: 0 },
			verticals: [{ id: 'react-hospitalrun', designatedPilot: false }],
			applications: [{ id: 'react-hospitalrun', source, verticals: ['react-hospitalrun'] }],
			frameworkLanes: [],
			coverage: { authenticity: 'not-established' },
			integrity: { algorithm: 'sha256', canonicalDigest: 'a'.repeat(64) },
		});

		test('admits the exact published revision under each revision-context key', () => {
			expect(hospitalrunRevision.startsWith(hospitalrunDigitRun)).toBe(true);
			expect(hospitalrunDigitRun).toHaveLength(13);
			for (const key of ['revision', 'parentRevision', 'targetRevision'])
				expect(() =>
					assertSyntheticEvidence(conformance({ [key]: hospitalrunRevision })),
				).not.toThrow();
		});

		test('keeps refusing every value that is not an exact lowercase object ID', () => {
			for (const value of [
				hospitalrunDigitRun,
				`${hospitalrunDigitRun} `,
				'4111111111111111',
				hospitalrunRevision.toUpperCase(),
				`8156955145551D0366df10faa28e724f3377dea1`,
				hospitalrunRevision.slice(0, 39),
				`${hospitalrunRevision}a`,
				'8'.repeat(40),
				`8156955145551g0366df10faa28e724f3377dea1`,
			])
				expect(findSensitiveSignals(conformance({ revision: value }))).toContainEqual({
					path: '$.applications[0].source.revision',
					kind: 'pan-like-value',
				});
		});

		test('keeps refusing the object ID outside a revision-context key', () => {
			for (const key of ['commit', 'tree', 'sha', 'archiveSha256', 'revisionCopy'])
				expect(
					findSensitiveSignals(conformance({ [key]: hospitalrunRevision })),
				).toContainEqual({
					path: `$.applications[0].source.${key}`,
					kind: 'pan-like-value',
				});
		});

		test('keeps refusing the object ID outside a source application source record', () => {
			const onApplication = conformance({});
			(onApplication.applications[0] as Record<string, unknown>).revision =
				hospitalrunRevision;
			expect(findSensitiveSignals(onApplication)).toContainEqual({
				path: '$.applications[0].revision',
				kind: 'pan-like-value',
			});
			const onVertical = conformance({ revision: hospitalrunRevision });
			(onVertical.verticals[0] as Record<string, unknown>).revision = hospitalrunRevision;
			expect(findSensitiveSignals(onVertical)).toEqual([
				{ path: '$.verticals[0].revision', kind: 'pan-like-value' },
			]);
			const nested = conformance({ nested: { revision: hospitalrunRevision } });
			expect(findSensitiveSignals(nested)).toEqual([
				{ path: '$.applications[0].source.nested.revision', kind: 'pan-like-value' },
			]);
		});

		test('keeps refusing the object ID outside the exact corpus conformance document', () => {
			for (const unsafe of [
				{ revision: hospitalrunRevision },
				{ applications: [{ source: { revision: hospitalrunRevision } }] },
				{ wrapper: conformance({ revision: hospitalrunRevision }) },
				{ ...conformance({ revision: hospitalrunRevision }), extra: 'not-tested' },
				{
					...conformance({ revision: hospitalrunRevision }),
					schemaVersion: 'versionless.corpus-conformance.v2',
				},
				(() => {
					const document: Record<string, unknown> = conformance({
						revision: hospitalrunRevision,
					});
					delete document.coverage;
					return document;
				})(),
			])
				expect(() => assertSyntheticEvidence(unsafe)).toThrow('Sensitive material refused');
		});
	});

	/**
	 * The adapter-freeze record names the real commit at which the frozen adapter
	 * surface was established, and that commit's forty hex characters can open with
	 * a long digit run — cce3417's re-freeze SHA carries a fourteen-digit run — that
	 * the primary-account-number detector cannot tell from a card number. The
	 * commit must be published verbatim (substituting a different commit would
	 * falsify which commit the freeze was computed at), so the admission is pinned
	 * from both sides: the exact object id is accepted under the freeze record's
	 * commit key, and every neighbouring shape still trips.
	 */
	describe('adapter freeze commit object IDs', () => {
		const freezeCommit = 'cce34175340273919c0b70341dfada5533f0307c';
		const freezeDigitRun = '34175340273919';
		const supersedesCommit = '57b308a573dd582c844ce401fb1161cd70e9bc66';
		const freezeDoc = (freeze: Record<string, unknown>) => ({
			schemaVersion: 'versionless.trust.v1',
			freeze: {
				commit: freezeCommit,
				algorithm: 'sha256',
				composite: 'a'.repeat(64),
				preimage:
					'newline-terminated `<path> <tree-oid>` lines in the listed subtree order',
				subtrees: [{ path: 'packages/frameworks/react', treeOid: 'b'.repeat(40) }],
				state: 'frozen',
				claim: 'The migration engine adapter surface is byte-stable at this commit.',
				...freeze,
			},
			holdoutPublishing: { state: 'outside-freeze' },
			capabilities: {},
			angularHoldout: { state: 'deferred' },
		});

		test('admits the freeze commit object ID under the freeze and supersedes commit keys', () => {
			expect(freezeCommit).toHaveLength(40);
			expect(freezeCommit.includes(freezeDigitRun)).toBe(true);
			expect(freezeDigitRun).toHaveLength(14);
			expect(() => assertSyntheticEvidence(freezeDoc({}))).not.toThrow();
			expect(() =>
				assertSyntheticEvidence(
					freezeDoc({
						supersedes: {
							commit: freezeCommit,
							composite: 'c'.repeat(64),
							state: 'superseded',
						},
					}),
				),
			).not.toThrow();
		});

		test('keeps refusing every value under the commit key that is not an exact lowercase object ID', () => {
			for (const value of [
				freezeDigitRun,
				`${freezeDigitRun} `,
				'4111111111111111',
				freezeCommit.toUpperCase(),
				freezeCommit.slice(0, 39),
				`${freezeCommit}a`,
				'3'.repeat(40),
				`${freezeCommit.slice(0, 39)}g`,
			])
				expect(findSensitiveSignals(freezeDoc({ commit: value }))).toContainEqual({
					path: '$.freeze.commit',
					kind: 'pan-like-value',
				});
		});

		test('keeps refusing the object ID under any non-commit key of the freeze record', () => {
			for (const key of ['composite', 'preimage', 'commitCopy', 'parentCommit'])
				expect(findSensitiveSignals(freezeDoc({ [key]: freezeCommit }))).toContainEqual({
					path: `$.freeze.${key}`,
					kind: 'pan-like-value',
				});
			expect(
				findSensitiveSignals(
					freezeDoc({
						supersedes: {
							commit: supersedesCommit,
							composite: freezeCommit,
							state: 'superseded',
						},
					}),
				),
			).toContainEqual({ path: '$.freeze.supersedes.composite', kind: 'pan-like-value' });
		});

		test('keeps refusing the object ID outside a freeze record commit key', () => {
			const onRoot = freezeDoc({}) as Record<string, unknown>;
			onRoot.commit = freezeCommit;
			expect(findSensitiveSignals(onRoot)).toContainEqual({
				path: '$.commit',
				kind: 'pan-like-value',
			});
		});

		test('keeps refusing the freeze commit object ID outside the adapter-freeze document', () => {
			for (const unsafe of [
				{ freeze: { commit: freezeCommit } },
				{ wrapper: freezeDoc({}) },
				{ ...freezeDoc({}), schemaVersion: 'versionless.trust.v2' },
				(() => {
					const document = freezeDoc({});
					(document.freeze as Record<string, unknown>).state = 'thawed';
					return document;
				})(),
				(() => {
					const document = freezeDoc({});
					(document.freeze as Record<string, unknown>).algorithm = 'sha512';
					return document;
				})(),
			])
				expect(() => assertSyntheticEvidence(unsafe)).toThrow('Sensitive material refused');
		});
	});
});
