import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	acquire,
	assertAllowedUrl,
	assertConsent,
	createNetworkState,
	createT138RequestPlan,
	createT138SyntheticTree,
	createT142SyntheticOfficialTree,
	ingestT106,
	ingestT108,
	ingestT128,
	ingestT136,
	ingestT138,
	ingestT142,
	inspectFixtureBoundaries,
	pairDescriptorFor,
	pairTaskDescriptors,
	parseLedgeredJson,
	publishTransaction,
	reconcileNetworkState,
	requirePublicationAbsence,
	requireT106PackageFacts,
	requireT108PackageFacts,
	requireT124HistoricalFacts,
	requireT128SuccessLedger,
	requireT136HistoricalFacts,
	requireT136SuccessLedger,
	requireT138SuccessLedger,
	requireT142SuccessLedger,
	runT138ProductionPreflight,
	runT142OutputDocumentPreflight,
	resolveT106Candidate,
	resolveT108Candidate,
	selectRequiredPaths,
	selectT108RequiredPaths,
	taskDescriptorFor,
	T092_CONSENT_ID,
	T094_CONSENT_ID,
	T104_CONSENT_ID,
	T106_CONSENT_ID,
	T106_REQUIRED_PATHS,
	T108_CONSENT_ID,
	T108_ROOT_LICENSE_PATHS,
	T111_CONSENT_ID,
	T113_CONSENT_ID,
	T124_CONSENT_ID,
	T128_CONSENT_ID,
	T124_REQUIRED_PATHS,
	T134_CONSENT_ID,
	T136_CONSENT_ID,
	T136_REQUIRED_PATHS,
	T138_CONSENT_ID,
	T142_CONSENT_ID,
	t106TaskDescriptor,
	t108TaskDescriptor,
	t128TaskDescriptor,
	t136TaskDescriptor,
	t138TaskDescriptor,
	t142TaskDescriptor,
	type AcquiredBody,
	type FixtureConfig,
	type LedgerRecord,
	type OutputDocumentMutation,
} from '../src/fixture/tier-f-ingest.ts';
import { completeBuffer, type ArchiveIndex } from '../../core/src/corpus/tier-f-provenance.ts';

const temporary: string[] = [];
const fixture: FixtureConfig = {
	id: 'react-avataaars',
	framework: 'react',
	owner: 'fangpenlin',
	repository: 'avataaars-generator',
	commit: 'c191c6c2d27f41245e803912d43c7213436a34d3',
	entryCandidates: [],
	configurationCandidates: [],
	journeyCandidates: [],
};
const repositoryUrl = 'https://api.github.com/repos/fangpenlin/avataaars-generator';
const positiveConsentTime = new Date('2026-08-07T23:59:59.999Z');
const exactConsentExpiry = new Date('2026-08-08T00:00:00.000Z');
let originalNetworkMode: string | undefined;
let originalConsentId: string | undefined;

function restoreEnvironment(
	name: 'VERSIONLESS_NETWORK_MODE' | 'VERSIONLESS_CONSENT_ID',
	value: string | undefined,
) {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

function usePositiveConsentTime(): void {
	vi.useFakeTimers();
	vi.setSystemTime(positiveConsentTime);
}

function response(bytes: Uint8Array, init: ResponseInit = {}): Response {
	return new Response(Buffer.from(bytes), init);
}

function fetchReturning(value: Response): typeof fetch {
	return (async () => value) as typeof fetch;
}

async function failureRecord(
	fetchImplementation: typeof fetch,
	limits?: Readonly<{ maximumResponseBytes: number; maximumAggregateBytes: number }>,
): Promise<LedgerRecord> {
	const emitted: LedgerRecord[] = [];
	const state = createNetworkState((record) => emitted.push(record));
	await expect(
		acquire(state, fixture, 'synthetic', repositoryUrl, fetchImplementation, limits),
	).rejects.toThrow();
	expect(emitted).toHaveLength(1);
	expect(state.ledger).toEqual(emitted);
	expect(state.attempts).toBe(1);
	expect(Object.isFrozen(emitted[0])).toBe(true);
	reconcileNetworkState(state);
	return emitted[0]!;
}

beforeEach(() => {
	originalNetworkMode = process.env.VERSIONLESS_NETWORK_MODE;
	originalConsentId = process.env.VERSIONLESS_CONSENT_ID;
});

afterEach(async () => {
	vi.useRealTimers();
	for (const directory of temporary.splice(0))
		await rm(directory, { recursive: true, force: true });
	restoreEnvironment('VERSIONLESS_NETWORK_MODE', originalNetworkMode);
	restoreEnvironment('VERSIONLESS_CONSENT_ID', originalConsentId);
});

describe('T092 consent and immutable path refusal', () => {
	it('requires the exact consent in argument and environment', () => {
		usePositiveConsentTime();
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T092_CONSENT_ID;
		expect(() => assertConsent(T092_CONSENT_ID)).not.toThrow();
		expect(() => assertConsent('T082-closed')).toThrow();
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		expect(() => assertConsent(T092_CONSENT_ID)).toThrow();
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID =
			'T093-official-source-react-angular-pair-global-pax-comment-ingest';
		expect(() =>
			assertConsent('T093-official-source-react-angular-pair-global-pax-comment-ingest'),
		).toThrow();
	});

	it('refuses mutable refs, other repositories, hosts, and redirects-by-path', () => {
		expect(
			assertAllowedUrl(
				'https://codeload.github.com/fangpenlin/avataaars-generator/tar.gz/c191c6c2d27f41245e803912d43c7213436a34d3',
				fixture,
			),
		).toBe('codeload.github.com');
		expect(() =>
			assertAllowedUrl('https://github.com/fangpenlin/avataaars-generator', fixture),
		).toThrow();
		expect(() =>
			assertAllowedUrl(
				'https://api.github.com/repos/fangpenlin/avataaars-generator/commits/main',
				fixture,
			),
		).toThrow();
		expect(() =>
			assertAllowedUrl('https://api.github.com/repos/other/repository', fixture),
		).toThrow();
	});

	it('allows only the exact recursive tree query and refuses queries on every other family', () => {
		const tree = `${repositoryUrl}/git/trees/0123456789abcdef0123456789abcdef01234567`;
		expect(assertAllowedUrl(`${tree}?recursive=1`, fixture)).toBe('api.github.com');
		for (const url of [
			tree,
			`${tree}?recursive=0`,
			`${tree}?recursive=1&extra=1`,
			`${repositoryUrl}?recursive=1`,
			`${repositoryUrl}/commits/${fixture.commit}?recursive=1`,
			`https://codeload.github.com/${fixture.owner}/${fixture.repository}/tar.gz/${fixture.commit}?download=1`,
		])
			expect(() => assertAllowedUrl(url, fixture)).toThrow();
	});
});

describe('T094 literal pair descriptors and nested fixture boundaries', () => {
	const t094 = pairTaskDescriptors[1]!;
	const dashboard: FixtureConfig = {
		id: 'react-dashboard',
		framework: 'react',
		owner: 'darekkay',
		repository: 'dashboard',
		commit: '4b8be9f7e0080d680598c74d7e6cfbe080566059',
		expectedTreeLead: 'adc596cb1c3834a0ebf9cea580c87eb9b002ddfa',
		requiredPaths: [
			'LICENSE',
			'app/package.json',
			'app/package-lock.json',
			'app/src/index.tsx',
			'app/vite.config.js',
			'.github/workflows/ci.yml',
			'app/src/components/dashboard/index.tsx',
		],
		entryCandidates: ['app/src/index.tsx'],
		configurationCandidates: ['app/vite.config.js'],
		journeyCandidates: ['app/src/components/dashboard/index.tsx'],
	};

	it('binds consent literally to T094 and its ordered pair while retaining T092 dispatch', () => {
		usePositiveConsentTime();
		expect(pairDescriptorFor([{ id: 'react-avataaars' }, { id: 'angular-contacts' }])).toEqual(
			pairTaskDescriptors[0],
		);
		expect(pairDescriptorFor([{ id: 'react-dashboard' }, { id: 'angular-fuxa' }])).toEqual(
			t094,
		);
		for (const selected of [
			[{ id: 'angular-fuxa' }, { id: 'react-dashboard' }],
			[{ id: 'react-dashboard' }, { id: 'angular-contacts' }],
			[{ id: 'react-dashboard' }],
		] as const)
			expect(() => pairDescriptorFor(selected)).toThrow('exact authorized task pair');

		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T094_CONSENT_ID;
		expect(() => assertConsent(T094_CONSENT_ID, t094)).not.toThrow();
		for (const invalid of [
			undefined,
			T092_CONSENT_ID,
			'T093-official-source-react-dashboard-angular-fuxa-pair-ingest',
			'T095-official-source-react-dashboard-angular-fuxa-pair-ingest',
		])
			expect(() => assertConsent(invalid, t094)).toThrow('literal task-and-scope');
		process.env.VERSIONLESS_CONSENT_ID = T092_CONSENT_ID;
		expect(() => assertConsent(T094_CONSENT_ID, t094)).toThrow();
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.VERSIONLESS_CONSENT_ID = T094_CONSENT_ID;
		expect(() => assertConsent(T094_CONSENT_ID, t094)).toThrow();
	});

	it('rejects both pair consents at the exact expiry boundary', () => {
		vi.useFakeTimers();
		vi.setSystemTime(exactConsentExpiry);
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T092_CONSENT_ID;
		expect(() => assertConsent(T092_CONSENT_ID)).toThrow('Pair-ingest consent has expired');
		process.env.VERSIONLESS_CONSENT_ID = T094_CONSENT_ID;
		expect(() => assertConsent(T094_CONSENT_ID, t094)).toThrow(
			'Pair-ingest consent has expired',
		);
	});

	it('requires every exact nested dashboard descriptor path', () => {
		const tree = dashboard.requiredPaths!.map((file) => ({
			path: file,
			mode: '100644',
			type: 'blob',
			sha: 'a'.repeat(40),
		}));
		expect(selectRequiredPaths(dashboard, tree)).toEqual(
			[...dashboard.requiredPaths!].sort((left, right) => left.localeCompare(right)),
		);
		expect(() => selectRequiredPaths(dashboard, tree.slice(1))).toThrow('lacks required path');
		expect(
			assertAllowedUrl(
				`https://raw.githubusercontent.com/darekkay/dashboard/${dashboard.commit}/app/package.json`,
				dashboard,
			),
		).toBe('raw.githubusercontent.com');
		expect(() =>
			assertAllowedUrl(
				`https://raw.githubusercontent.com/darekkay/dashboard/${dashboard.commit}/README.md`,
				dashboard,
			),
		).toThrow('outside immutable');
		expect(
			assertAllowedUrl(
				`https://api.github.com/repos/darekkay/dashboard/git/trees/${dashboard.expectedTreeLead}?recursive=1`,
				dashboard,
			),
		).toBe('api.github.com');
		expect(() =>
			assertAllowedUrl(
				'https://api.github.com/repos/darekkay/dashboard/git/trees/0123456789abcdef0123456789abcdef01234567?recursive=1',
				dashboard,
			),
		).toThrow('outside immutable');
	});

	it('requires every exact nested FUXA descriptor and attribution path', () => {
		const requiredPaths = [
			'LICENSE',
			'client/package.json',
			'client/package-lock.json',
			'client/angular.json',
			'client/src/main.ts',
			'.github/workflows/docker_release.yml',
			'client/src/app/app.routing.ts',
			'client/src/app/editor/editor.component.html',
			'client/src/app/editor/editor.component.ts',
			'server/runtime/jobs/fonts/LICENSE.txt',
		];
		const fuxa: FixtureConfig = {
			...dashboard,
			id: 'angular-fuxa',
			framework: 'angular',
			requiredPaths,
		};
		const tree = requiredPaths.map((file) => ({
			path: file,
			mode: '100644',
			type: 'blob',
			sha: 'b'.repeat(40),
		}));
		expect(selectRequiredPaths(fuxa, tree)).toEqual(
			[...requiredPaths].sort((left, right) => left.localeCompare(right)),
		);
		for (const requiredPath of requiredPaths)
			expect(() =>
				selectRequiredPaths(
					fuxa,
					tree.filter((row) => row.path !== requiredPath),
				),
			).toThrow(`lacks required path ${requiredPath}`);
	});

	it('refuses every T094 final or staging residue before acquisition', async () => {
		for (const relative of [
			'fixtures/react-dashboard/fixture.json',
			'fixtures/react-dashboard/provenance.json',
			'.versionless/cache/tier-f/react-dashboard',
			'evidence/ingests/react-dashboard/t094-ingest.json',
			'.versionless/cache/tier-f/.staging/t094-pair',
		]) {
			const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t094-residue-'));
			temporary.push(directory);
			const residue = path.join(directory, relative);
			if (path.extname(residue)) {
				await mkdir(path.dirname(residue), { recursive: true });
				await writeFile(residue, '{}\n');
			} else await mkdir(residue, { recursive: true });
			await expect(
				requirePublicationAbsence(
					directory,
					[{ id: 'react-dashboard' }, { id: 'angular-fuxa' }],
					t094,
				),
			).rejects.toThrow('Pre-network publication residue exists');
		}
	});

	it('preserves the nested Apache font notice and excludes every committed dist file', () => {
		const apache = Buffer.from(
			'Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/\n',
		);
		const index: ArchiveIndex = {
			root: 'fixture',
			manifestSha256: 'manifest',
			globalMetadata: null,
			pathMetadata: [],
			files: [
				{
					path: 'server/runtime/jobs/fonts/LICENSE.txt',
					bytes: apache,
					byteLength: apache.byteLength,
					sha256: 'font-license',
				},
				{
					path: 'server/runtime/dist/index.js',
					bytes: Buffer.from('generated'),
					byteLength: 9,
					sha256: 'generated-dist',
				},
			],
		};
		const boundaries = inspectFixtureBoundaries(index, {
			...dashboard,
			id: 'angular-fuxa',
			framework: 'angular',
			nestedCompatibleLicensePath: 'server/runtime/jobs/fonts/LICENSE.txt',
			requireCommittedDistExclusion: true,
		});
		expect(boundaries.compatibleNotice?.sha256).toBe('font-license');
		expect(boundaries.excludedCommittedDist).toEqual([
			{
				path: 'server/runtime/dist/index.js',
				sha256: 'generated-dist',
				classification: 'excluded',
			},
		]);
		expect(() =>
			inspectFixtureBoundaries(
				{ ...index, files: index.files.slice(0, 1) },
				{
					...dashboard,
					id: 'angular-fuxa',
					framework: 'angular',
					nestedCompatibleLicensePath: 'server/runtime/jobs/fonts/LICENSE.txt',
					requireCommittedDistExclusion: true,
				},
			),
		).toThrow('committed dist boundary');
	});
});

describe('T106 exact single-candidate recovery consent and provenance preflight', () => {
	const commit = '4299e93a87e7c8deb100429901ff1e16deebe539';
	const tree = '2'.repeat(40);
	const lead = {
		phase: 'candidate-discovery' as const,
		id: 'next-killedbygoogle' as const,
		owner: 'codyogden' as const,
		repository: 'killedbygoogle' as const,
	};

	it('replaces the consumed single-candidate dispatch only with exact T128', () => {
		expect(taskDescriptorFor([{ id: 'next-killedbygoogle' }])).toEqual(t128TaskDescriptor);
		for (const candidates of [
			[{ id: 'next-killedbygoogle' }, { id: 'next-killedbygoogle' }],
			[{ id: 'next-killedbygoogle' }, { id: 'react-avataaars' }],
			[{ id: 'react-avataaars' }],
		] as const)
			expect(() => taskDescriptorFor(candidates)).toThrow();
		expect(
			assertAllowedUrl('https://api.github.com/repos/codyogden/killedbygoogle', lead),
		).toBe('api.github.com');
		for (const url of [
			'https://api.github.com/repos/codyogden/killedbygoogle/commits/main',
			'https://api.github.com/repos/other/killedbygoogle',
			'https://raw.githubusercontent.com/codyogden/killedbygoogle/main/package.json',
			'https://api.github.com/repos/codyogden/killedbygoogle?extra=1',
		])
			expect(() => assertAllowedUrl(url, lead)).toThrow();
		const pinned: FixtureConfig = {
			...fixture,
			id: 'next-killedbygoogle',
			framework: 'nextjs',
			owner: 'codyogden',
			repository: 'killedbygoogle',
			commit: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
			expectedTreeLead: 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763',
			requiredPaths: T124_REQUIRED_PATHS,
		};
		expect(
			assertAllowedUrl(
				`https://raw.githubusercontent.com/codyogden/killedbygoogle/${pinned.commit}/package.json`,
				pinned,
			),
		).toBe('raw.githubusercontent.com');
		expect(() =>
			assertAllowedUrl(
				`https://raw.githubusercontent.com/codyogden/killedbygoogle/${pinned.commit}/README.md`,
				pinned,
			),
		).toThrow('outside immutable');
	});

	it('isolates historical raw corroboration to exactly seven sorted paths', () => {
		const candidate: FixtureConfig = {
			...fixture,
			id: 'next-killedbygoogle',
			framework: 'nextjs',
			owner: 'codyogden',
			repository: 'killedbygoogle',
			commit: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
			expectedTreeLead: 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763',
			requiredPaths: T124_REQUIRED_PATHS,
		};
		const exactTree = [...T124_REQUIRED_PATHS, 'README.md'].map((file) => ({
			path: file,
			mode: '100644',
			type: 'blob',
			sha: tree,
		}));
		expect(selectRequiredPaths(candidate, exactTree)).toEqual(T124_REQUIRED_PATHS);
		for (const missing of T124_REQUIRED_PATHS)
			expect(() =>
				selectRequiredPaths(
					candidate,
					exactTree.filter((row) => row.path !== missing),
				),
			).toThrow(`lacks required path ${missing}`);
		for (const requiredPaths of [
			[...T124_REQUIRED_PATHS].reverse(),
			[...T124_REQUIRED_PATHS, 'README.md'],
			T124_REQUIRED_PATHS.slice(1),
			T124_REQUIRED_PATHS.map((pathValue) =>
				pathValue === 'LICENSE' ? 'License' : pathValue,
			),
		] as const)
			expect(() => selectRequiredPaths({ ...candidate, requiredPaths }, exactTree)).toThrow(
				'T124 relied paths must be exactly',
			);
		for (const rawPath of ['README.md', 'Pages/index.tsx', 'nested/package.json'])
			expect(() =>
				assertAllowedUrl(
					`https://raw.githubusercontent.com/codyogden/killedbygoogle/${commit}/${rawPath}`,
					candidate,
				),
			).toThrow('outside immutable');
	});

	it('requires literal argument/environment consent and rejects missing, offline, and adjacent task IDs', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T106_CONSENT_ID;
		expect(() => assertConsent(T106_CONSENT_ID, t106TaskDescriptor)).toThrow(
			'permanently refused before GET',
		);
		for (const invalid of [
			undefined,
			T104_CONSENT_ID,
			'T105-official-source-codyogden-killedbygoogle-provenance-recovery-ingest',
			'T107-official-source-codyogden-killedbygoogle-provenance-recovery-ingest',
			T094_CONSENT_ID,
		])
			expect(() => assertConsent(invalid, t106TaskDescriptor)).toThrow();
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		expect(() => assertConsent(T106_CONSENT_ID, t106TaskDescriptor)).toThrow();
	});

	it('disables both consumed T104 and T106 paths before the first GET', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t106-old-consent-'));
		temporary.push(directory);
		let attempts = 0;
		const forbiddenFetch = (async () => {
			attempts += 1;
			throw new Error('network must remain unreachable');
		}) as typeof fetch;
		for (const consumed of [T104_CONSENT_ID, T106_CONSENT_ID]) {
			process.env.VERSIONLESS_NETWORK_MODE = 'consented';
			process.env.VERSIONLESS_CONSENT_ID = consumed;
			await expect(
				ingestT106(
					[
						{
							...fixture,
							id: 'next-killedbygoogle',
							framework: 'nextjs',
							owner: 'codyogden',
							repository: 'killedbygoogle',
							commit,
							requiredPaths: T106_REQUIRED_PATHS,
						},
					],
					consumed,
					forbiddenFetch,
					directory,
				),
			).rejects.toThrow('permanently refused before GET');
		}
		expect(attempts).toBe(0);
		await expect(access(path.join(directory, '.versionless'))).rejects.toMatchObject({
			code: 'ENOENT',
		});
	});

	it('refuses the historical resolver itself before its first GET', async () => {
		const state = createNetworkState(() => undefined, {
			maximumRequests: 32,
			maximumAggregateBytes: 128 * 1_024 * 1_024,
		});
		let attempts = 0;
		await expect(
			resolveT106Candidate(state, (async () => {
				attempts += 1;
				throw new Error('network must remain unreachable');
			}) as typeof fetch),
		).rejects.toThrow('permanently refused before GET');
		expect(attempts).toBe(0);
		expect(state.attempts).toBe(0);
	});

	it('corroborates only Next 12 with a Yarn v1 lock and rejects support-strengthening metadata', () => {
		const packageFile = (next: string) => {
			const bytes = Buffer.from(JSON.stringify({ dependencies: { next } }));
			return {
				path: 'package.json',
				bytes,
				byteLength: bytes.byteLength,
				sha256: `package-${next}`,
			};
		};
		const yarn = Buffer.from('# yarn lockfile v1\n');
		const index = (next: string, lock = yarn): ArchiveIndex => ({
			root: 'fixture',
			manifestSha256: 'manifest',
			globalMetadata: null,
			pathMetadata: [],
			files: [
				packageFile(next),
				{
					path: 'yarn.lock',
					bytes: lock,
					byteLength: lock.byteLength,
					sha256: 'lock',
				},
			],
		});
		expect(() => requireT106PackageFacts(index('^12.0.10'))).not.toThrow();
		expect(() => requireT106PackageFacts(index('^13.0.0'))).toThrow('Next 12');
		expect(() => requireT106PackageFacts(index('^12.0.10', Buffer.from('yarn v2')))).toThrow(
			'Yarn v1',
		);
	});

	it('refuses every exact T104 historical or T106 final and staging residue', async () => {
		for (const relative of [
			'fixtures/next-killedbygoogle/fixture.json',
			'fixtures/next-killedbygoogle/provenance.json',
			'evidence/ingests/next-killedbygoogle/t104-ingest.json',
			'evidence/ingests/next-killedbygoogle/t106-ingest.json',
			'.versionless/cache/tier-f/next-killedbygoogle',
			'.versionless/cache/tier-f/.staging/t104-next-killedbygoogle',
			'.versionless/cache/tier-f/.staging/t106-next-killedbygoogle',
		]) {
			const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t104-residue-'));
			temporary.push(directory);
			const residue = path.join(directory, relative);
			if (path.extname(residue)) {
				await mkdir(path.dirname(residue), { recursive: true });
				await writeFile(residue, '{}\n');
			} else await mkdir(residue, { recursive: true });
			await expect(
				requirePublicationAbsence(
					directory,
					[{ id: 'next-killedbygoogle' }],
					t106TaskDescriptor,
				),
			).rejects.toThrow('Pre-network publication residue exists');
		}
	});

	it('rolls fixture/provenance, receipt, archive, and manifest roots back at every boundary', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t106-transaction-'));
		temporary.push(directory);
		for (let failureBoundary = 0; failureBoundary < 3; failureBoundary++) {
			const attempt = path.join(directory, `attempt-${failureBoundary}`);
			const roots = [
				['cache', ['source.tar.gz', 'manifest.json']],
				['fixture', ['fixture.json', 'provenance.json']],
				['evidence', ['t106-ingest.json']],
			] as const;
			const publications = [];
			for (const [name, files] of roots) {
				const staged = path.join(attempt, 'staged', name);
				const final = path.join(attempt, 'final', name);
				await mkdir(staged, { recursive: true });
				for (const file of files) await writeFile(path.join(staged, file), 'synthetic\n');
				publications.push({ staged, final });
			}
			await expect(publishTransaction(publications, failureBoundary)).rejects.toThrow();
			for (const publication of publications)
				await expect(access(publication.final)).rejects.toMatchObject({ code: 'ENOENT' });
		}
	});
});

describe('T128 exact historical killedbygoogle provenance-only acquisition', () => {
	const commit = '56809c31592e6ca1edce8af9bfe842fbcdf71f4d';
	const tree = 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763';
	const candidate: FixtureConfig = {
		...fixture,
		id: 'next-killedbygoogle',
		framework: 'nextjs',
		owner: 'codyogden',
		repository: 'killedbygoogle',
		commit,
		expectedTreeLead: tree,
		requiredPaths: T124_REQUIRED_PATHS,
	};

	it('binds the literal consent, exact subject, tree, seven paths, caps, and one survivor', () => {
		expect(taskDescriptorFor([{ id: 'next-killedbygoogle' }])).toEqual(t128TaskDescriptor);
		expect(t128TaskDescriptor).toMatchObject({
			taskId: 'T128',
			fixtureIds: ['next-killedbygoogle'],
			maximumRequests: 19,
			maximumResponseBytes: 8 * 1_024 * 1_024,
			maximumAggregateBytes: 32 * 1_024 * 1_024,
		});
		expect(T124_REQUIRED_PATHS).toEqual([
			'.github/workflows/playwright.yml',
			'LICENSE',
			'components/Search/index.tsx',
			'next.config.js',
			'package.json',
			'pages/index.tsx',
			'yarn.lock',
		]);
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T128_CONSENT_ID;
		expect(() => assertConsent(T128_CONSENT_ID, t128TaskDescriptor)).toThrow(
			'permanently refused before GET',
		);
		for (const refused of [
			undefined,
			T104_CONSENT_ID,
			T106_CONSENT_ID,
			T108_CONSENT_ID,
			T111_CONSENT_ID,
			T113_CONSENT_ID,
			T124_CONSENT_ID,
			`${T128_CONSENT_ID}-adjacent`,
		])
			expect(() => assertConsent(refused, t128TaskDescriptor)).toThrow();
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		expect(() => assertConsent(T128_CONSENT_ID, t128TaskDescriptor)).toThrow();
	});

	it('allows only the exact immutable API, codeload, and seven raw paths', () => {
		for (const reliedPath of T124_REQUIRED_PATHS)
			expect(
				assertAllowedUrl(
					`https://raw.githubusercontent.com/codyogden/killedbygoogle/${commit}/${reliedPath}`,
					candidate,
				),
			).toBe('raw.githubusercontent.com');
		expect(
			assertAllowedUrl(
				`https://api.github.com/repos/codyogden/killedbygoogle/git/trees/${tree}?recursive=1`,
				candidate,
			),
		).toBe('api.github.com');
		expect(
			assertAllowedUrl(
				`https://codeload.github.com/codyogden/killedbygoogle/tar.gz/${commit}`,
				candidate,
			),
		).toBe('codeload.github.com');
		for (const url of [
			'https://api.github.com/repos/codyogden/killedbygoogle/commits/main',
			'https://api.github.com/search/repositories?q=killedbygoogle',
			`https://api.github.com/repos/codyogden/killedbygoogle/git/trees/${'a'.repeat(40)}?recursive=1`,
			`https://raw.githubusercontent.com/codyogden/killedbygoogle/${commit}/README.md`,
			`https://raw.githubusercontent.com/codyogden/killedbygoogle/${commit}/Pages/index.tsx`,
			`https://codeload.github.com/codyogden/killedbygoogle/tar.gz/${commit}?download=1`,
		])
			expect(() => assertAllowedUrl(url, candidate)).toThrow();
	});

	it('permanently refuses old/discovery consent and invalid subjects before any GET', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t128-preget-'));
		temporary.push(directory);
		let attempts = 0;
		const forbiddenFetch = (async () => {
			attempts += 1;
			throw new Error('network must remain unreachable');
		}) as typeof fetch;
		for (const consumed of [
			T104_CONSENT_ID,
			T106_CONSENT_ID,
			T108_CONSENT_ID,
			T111_CONSENT_ID,
			T113_CONSENT_ID,
			T124_CONSENT_ID,
			T128_CONSENT_ID,
			undefined,
			`${T128_CONSENT_ID}-adjacent`,
		]) {
			process.env.VERSIONLESS_NETWORK_MODE = 'consented';
			if (consumed === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
			else process.env.VERSIONLESS_CONSENT_ID = consumed;
			await expect(
				ingestT128([candidate], consumed, forbiddenFetch, directory),
			).rejects.toThrow();
		}
		process.env.VERSIONLESS_CONSENT_ID = T128_CONSENT_ID;
		for (const invalid of [
			{ ...candidate, owner: 'CodyOgden' },
			{ ...candidate, commit: 'a'.repeat(40) },
			{ ...candidate, expectedTreeLead: 'a'.repeat(40) },
			{ ...candidate, requiredPaths: T124_REQUIRED_PATHS.slice(1) },
		])
			await expect(
				ingestT128([invalid], T128_CONSENT_ID, forbiddenFetch, directory),
			).rejects.toThrow('permanently refused before GET');
		expect(attempts).toBe(0);
		await expect(access(path.join(directory, '.versionless'))).rejects.toMatchObject({
			code: 'ENOENT',
		});
	});

	it('requires the exact 19-response sequence and per-host closure', () => {
		const names = [
			'repository-metadata',
			'commit-metadata',
			'tree-metadata',
			'archive-copy-1',
			'archive-copy-2',
			...T124_REQUIRED_PATHS.flatMap((reliedPath) => [
				`raw-copy-1:${reliedPath}`,
				`raw-copy-2:${reliedPath}`,
			]),
		];
		const state = createNetworkState(() => undefined, {
			maximumRequests: 19,
			maximumAggregateBytes: 32 * 1_024 * 1_024,
		});
		state.ledger = names.map((name, index) => {
			const host =
				index < 3
					? 'api.github.com'
					: index < 5
						? 'codeload.github.com'
						: 'raw.githubusercontent.com';
			return {
				sequence: index + 1,
				fixture: 'next-killedbygoogle',
				name,
				host,
				url: `https://${host}/bounded`,
				result: 'pass',
				outcome: 'success',
				httpStatus: 200,
				receivedBytes: 1,
				bodyComplete: true,
				byteLength: 1,
				sha256: 'a'.repeat(64),
			} satisfies LedgerRecord;
		});
		state.attempts = 19;
		state.completedBytes = 19;
		expect(() => requireT128SuccessLedger(state)).not.toThrow();
		state.ledger[18] = Object.freeze({ ...state.ledger[18]!, name: 'raw-copy-3:yarn.lock' });
		expect(() => requireT128SuccessLedger(state)).toThrow('exact 19 GET sequence');
	});

	it('freshly corroborates only the approved historical Next facts', () => {
		const archiveFile = (filePath: string, text: string) => {
			const bytes = Buffer.from(text);
			return { path: filePath, bytes, byteLength: bytes.byteLength, sha256: filePath };
		};
		const historicalIndex = (next = '^12.0.10', pages = 'getStaticProps'): ArchiveIndex => ({
			root: `killedbygoogle-${commit}`,
			manifestSha256: 'manifest',
			globalMetadata: null,
			pathMetadata: [],
			files: [
				archiveFile(
					'package.json',
					JSON.stringify({ dependencies: { next }, scripts: { build: 'next build' } }),
				),
				archiveFile('yarn.lock', '# yarn lockfile v1\n'),
				archiveFile('pages/index.tsx', pages),
				archiveFile('.github/workflows/playwright.yml', 'run: playwright test'),
				archiveFile('next.config.js', "loader: '@svgr/webpack'"),
				archiveFile('components/Search/index.tsx', 'export const Search = () => null;'),
			],
		});
		expect(requireT124HistoricalFacts(historicalIndex())).toMatchObject({
			nextMajor: 12,
			packageManager: 'yarn-v1',
			router: 'pages',
			dataFunction: 'getStaticProps',
			productionBundler: 'candidate-owned-custom-webpack',
		});
		expect(() => requireT124HistoricalFacts(historicalIndex('^13.0.0'))).toThrow('Next 12');
		expect(() => requireT124HistoricalFacts(historicalIndex('^12.0.10', 'static'))).toThrow(
			'getStaticProps',
		);
	});

	it('refuses every historical/current final and staging residue and rolls back every publication boundary', async () => {
		for (const relative of [
			'fixtures/next-killedbygoogle/fixture.json',
			'fixtures/next-killedbygoogle/provenance.json',
			'evidence/ingests/next-killedbygoogle/t104-ingest.json',
			'evidence/ingests/next-killedbygoogle/t106-ingest.json',
			'evidence/ingests/next-killedbygoogle/t111-ingest.json',
			'evidence/ingests/next-killedbygoogle/t113-ingest.json',
			'evidence/ingests/next-killedbygoogle/t124-ingest.json',
			'evidence/ingests/next-killedbygoogle/t128-ingest.json',
			'.versionless/cache/tier-f/next-killedbygoogle',
			'.versionless/cache/tier-f/.staging/t104-next-killedbygoogle',
			'.versionless/cache/tier-f/.staging/t106-next-killedbygoogle',
			'.versionless/cache/tier-f/.staging/t108-next-nextchat',
			'.versionless/cache/tier-f/.staging/t113-next-killedbygoogle',
			'.versionless/cache/tier-f/.staging/t124-next-killedbygoogle',
			'.versionless/cache/tier-f/.staging/t128-next-killedbygoogle',
		]) {
			const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t128-residue-'));
			temporary.push(directory);
			const residue = path.join(directory, relative);
			if (path.extname(residue)) {
				await mkdir(path.dirname(residue), { recursive: true });
				await writeFile(residue, '{}\n');
			} else await mkdir(residue, { recursive: true });
			await expect(
				requirePublicationAbsence(directory, [candidate], t128TaskDescriptor),
			).rejects.toThrow('Pre-network publication residue exists');
		}
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t128-rollback-'));
		temporary.push(directory);
		for (let boundary = 0; boundary < 3; boundary++) {
			const publications = [];
			for (const rootName of ['cache', 'fixture', 'evidence']) {
				const staged = path.join(directory, `attempt-${boundary}`, 'staged', rootName);
				const final = path.join(directory, `attempt-${boundary}`, 'final', rootName);
				await mkdir(staged, { recursive: true });
				await writeFile(path.join(staged, 'artifact'), 'synthetic');
				publications.push({ staged, final });
			}
			await expect(publishTransaction(publications, boundary)).rejects.toThrow();
			for (const publication of publications)
				await expect(access(publication.final)).rejects.toMatchObject({ code: 'ENOENT' });
		}
	});
});

describe('T136 exact historical tailwind Next 13 provenance-only acquisition', () => {
	const commit = '09ba0550caea03a8c38bc4878d05838d2a57f999';
	const tree = '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf';
	const candidate: FixtureConfig = {
		...fixture,
		id: 'next-tailwind-starter-blog',
		framework: 'nextjs',
		owner: 'timlrx',
		repository: 'tailwind-nextjs-starter-blog',
		commit,
		expectedTreeLead: tree,
		requiredPaths: T136_REQUIRED_PATHS,
	};

	it('binds the fresh literal consent, exact subject/tree/eight paths, caps, and dispatch', () => {
		expect(taskDescriptorFor([{ id: 'next-tailwind-starter-blog' }])).toEqual(
			t142TaskDescriptor,
		);
		expect(t136TaskDescriptor).toMatchObject({
			taskId: 'T136',
			fixtureIds: ['next-tailwind-starter-blog'],
			maximumRequests: 21,
			maximumResponseBytes: 8 * 1_024 * 1_024,
			maximumAggregateBytes: 32 * 1_024 * 1_024,
		});
		expect(T136_REQUIRED_PATHS).toEqual([
			'.yarnrc.yml',
			'LICENSE',
			'app/api/newsletter2/route.ts',
			'app/blog/[...slug]/page.tsx',
			'app/layout.tsx',
			'next.config.js',
			'package.json',
			'yarn.lock',
		]);
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T136_CONSENT_ID;
		expect(() => assertConsent(T136_CONSENT_ID, t136TaskDescriptor)).toThrow(
			'permanently refused before GET',
		);
		for (const refused of [
			undefined,
			T104_CONSENT_ID,
			T106_CONSENT_ID,
			T108_CONSENT_ID,
			T111_CONSENT_ID,
			T113_CONSENT_ID,
			T124_CONSENT_ID,
			T128_CONSENT_ID,
			T134_CONSENT_ID,
			`${T136_CONSENT_ID}-adjacent`,
		])
			expect(() => assertConsent(refused, t136TaskDescriptor)).toThrow();
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		expect(() => assertConsent(T136_CONSENT_ID, t136TaskDescriptor)).toThrow(
			'permanently refused before GET',
		);
	});

	it('preflight preserves the contract order instead of locale-sorting LICENSE after app paths', () => {
		const rows = T136_REQUIRED_PATHS.map((filePath) => ({
			path: filePath,
			mode: '100644',
			type: 'blob',
			sha: 'a'.repeat(40),
		}));
		expect(
			[...T136_REQUIRED_PATHS].sort((left, right) => left.localeCompare(right)),
		).not.toEqual(T136_REQUIRED_PATHS);
		expect(selectRequiredPaths(candidate, rows)).toEqual(T136_REQUIRED_PATHS);
		expect(() =>
			selectRequiredPaths(
				{ ...candidate, requiredPaths: [...T136_REQUIRED_PATHS].reverse() },
				rows,
			),
		).toThrow('exactly the eight approved ordered paths');
	});

	it('allows only exact immutable endpoints and requires encoded dynamic-route brackets', () => {
		for (const reliedPath of T136_REQUIRED_PATHS) {
			const encodedPath = reliedPath.replace('[', '%5B').replace(']', '%5D');
			expect(
				assertAllowedUrl(
					`https://raw.githubusercontent.com/timlrx/tailwind-nextjs-starter-blog/${commit}/${encodedPath}`,
					candidate,
				),
			).toBe('raw.githubusercontent.com');
		}
		expect(
			assertAllowedUrl(
				`https://api.github.com/repos/timlrx/tailwind-nextjs-starter-blog/git/trees/${tree}?recursive=1`,
				candidate,
			),
		).toBe('api.github.com');
		expect(
			assertAllowedUrl(
				`https://codeload.github.com/timlrx/tailwind-nextjs-starter-blog/tar.gz/${commit}`,
				candidate,
			),
		).toBe('codeload.github.com');
		for (const url of [
			`https://raw.githubusercontent.com/timlrx/tailwind-nextjs-starter-blog/${commit}/app/blog/[...slug]/page.tsx`,
			`https://raw.githubusercontent.com/timlrx/tailwind-nextjs-starter-blog/${commit}/README.md`,
			`https://api.github.com/repos/timlrx/tailwind-nextjs-starter-blog/git/trees/${'a'.repeat(40)}?recursive=1`,
			`https://api.github.com/repos/timlrx/tailwind-nextjs-starter-blog/commits/main`,
			`https://codeload.github.com/timlrx/tailwind-nextjs-starter-blog/tar.gz/${commit}?download=1`,
		])
			expect(() => assertAllowedUrl(url, candidate)).toThrow();
	});

	it('refuses invalid or historical scopes before any GET', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t136-preget-'));
		temporary.push(directory);
		let attempts = 0;
		const forbiddenFetch = (async () => {
			attempts += 1;
			throw new Error('network must remain unreachable');
		}) as typeof fetch;
		for (const invalidConsent of [undefined, T128_CONSENT_ID, T134_CONSENT_ID]) {
			process.env.VERSIONLESS_NETWORK_MODE = 'consented';
			if (invalidConsent) process.env.VERSIONLESS_CONSENT_ID = invalidConsent;
			else delete process.env.VERSIONLESS_CONSENT_ID;
			await expect(
				ingestT136([candidate], invalidConsent, forbiddenFetch, directory),
			).rejects.toThrow();
		}
		process.env.VERSIONLESS_CONSENT_ID = T136_CONSENT_ID;
		for (const invalid of [
			{ ...candidate, owner: 'Timlrx' },
			{ ...candidate, commit: 'a'.repeat(40) },
			{ ...candidate, expectedTreeLead: 'a'.repeat(40) },
			{ ...candidate, requiredPaths: T136_REQUIRED_PATHS.slice(1) },
		])
			await expect(
				ingestT136([invalid], T136_CONSENT_ID, forbiddenFetch, directory),
			).rejects.toThrow('permanently refused before GET');
		expect(attempts).toBe(0);
	});

	it('requires the exact 21-response sequence and terminal accounting', () => {
		const names = [
			'repository-metadata',
			'commit-metadata',
			'tree-metadata',
			'archive-copy-1',
			'archive-copy-2',
			...T136_REQUIRED_PATHS.flatMap((reliedPath) => [
				`raw-copy-1:${reliedPath}`,
				`raw-copy-2:${reliedPath}`,
			]),
		];
		const state = createNetworkState(() => undefined, {
			maximumRequests: 21,
			maximumAggregateBytes: 32 * 1_024 * 1_024,
		});
		state.ledger = names.map((name, index) => {
			const host =
				index < 3
					? 'api.github.com'
					: index < 5
						? 'codeload.github.com'
						: 'raw.githubusercontent.com';
			return {
				sequence: index + 1,
				fixture: 'next-tailwind-starter-blog',
				name,
				host,
				url: `https://${host}/bounded`,
				result: 'pass',
				outcome: 'success',
				httpStatus: 200,
				receivedBytes: 1,
				bodyComplete: true,
				timestamp: '2026-08-06T00:00:00.000Z',
				contentEncoding: 'identity',
				disposition: 'accepted-complete-body',
				byteLength: 1,
				sha256: 'a'.repeat(64),
			} satisfies LedgerRecord;
		});
		state.attempts = 21;
		state.completedBytes = 21;
		expect(() => requireT136SuccessLedger(state)).not.toThrow();
		state.ledger[20] = Object.freeze({ ...state.ledger[20]!, contentEncoding: 'gzip' });
		expect(() => requireT136SuccessLedger(state)).toThrow('exact 21 GET sequence');
	});

	it('derives only the bounded static Next 13 facts', () => {
		const archiveFile = (filePath: string, text: string) => {
			const bytes = Buffer.from(text);
			return { path: filePath, bytes, byteLength: bytes.byteLength, sha256: filePath };
		};
		const historicalIndex = (next = '13.4.8'): ArchiveIndex => ({
			root: `tailwind-nextjs-starter-blog-${commit}`,
			manifestSha256: 'manifest',
			globalMetadata: null,
			pathMetadata: [],
			files: [
				archiveFile(
					'package.json',
					JSON.stringify({
						dependencies: { next, react: '18.2.0' },
						scripts: { build: 'next build', dev: 'next dev' },
					}),
				),
				archiveFile('.yarnrc.yml', 'nodeLinker: node-modules\n'),
				archiveFile('yarn.lock', '__metadata:\n  version: 6\n'),
				archiveFile('app/layout.tsx', 'export default function Layout() {}'),
				archiveFile(
					'app/blog/[...slug]/page.tsx',
					'export function generateStaticParams() {}',
				),
				archiveFile('app/api/newsletter2/route.ts', 'export async function POST() {}'),
				archiveFile('next.config.js', 'webpack(config) { return config }'),
			],
		});
		expect(requireT136HistoricalFacts(historicalIndex())).toMatchObject({
			next: '13.4.8',
			react: '18.2.0',
			packageManager: 'yarn-metadata-v6-node-modules',
			router: 'app',
			nodeEngine: 'absent',
		});
		expect(() => requireT136HistoricalFacts(historicalIndex('13.5.0'))).toThrow(
			'exact Next 13.4.8',
		);
	});

	it('refuses all T136 final/staging residue and rolls back every publication boundary', async () => {
		for (const relative of [
			'fixtures/next-tailwind-starter-blog/fixture.json',
			'fixtures/next-tailwind-starter-blog/provenance.json',
			'evidence/ingests/next-tailwind-starter-blog/t136-ingest.json',
			'.versionless/cache/tier-f/next-tailwind-starter-blog',
			'.versionless/cache/tier-f/.staging/t136-next-tailwind-starter-blog',
		]) {
			const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t136-residue-'));
			temporary.push(directory);
			const residue = path.join(directory, relative);
			if (path.extname(residue)) {
				await mkdir(path.dirname(residue), { recursive: true });
				await writeFile(residue, '{}\n');
			} else await mkdir(residue, { recursive: true });
			await expect(
				requirePublicationAbsence(directory, [candidate], t136TaskDescriptor),
			).rejects.toThrow('Pre-network publication residue exists');
		}
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t136-rollback-'));
		temporary.push(directory);
		for (let boundary = 0; boundary < 3; boundary++) {
			const publications = [];
			for (const rootName of ['cache', 'fixture', 'evidence']) {
				const staged = path.join(directory, `attempt-${boundary}`, 'staged', rootName);
				const final = path.join(directory, `attempt-${boundary}`, 'final', rootName);
				await mkdir(staged, { recursive: true });
				await writeFile(path.join(staged, 'artifact'), 'synthetic');
				publications.push({ staged, final });
			}
			await expect(publishTransaction(publications, boundary)).rejects.toThrow();
			for (const publication of publications)
				await expect(access(publication.final)).rejects.toMatchObject({ code: 'ENOENT' });
		}
	});
});

describe('T138 production-preflight and shared-plan acquisition repair', () => {
	const commit = '09ba0550caea03a8c38bc4878d05838d2a57f999';
	const treeSha = '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf';
	const candidate: FixtureConfig = {
		...fixture,
		id: 'next-tailwind-starter-blog',
		framework: 'nextjs',
		owner: 'timlrx',
		repository: 'tailwind-nextjs-starter-blog',
		commit,
		expectedTreeLead: treeSha,
		requiredPaths: T136_REQUIRED_PATHS,
	};

	it('permanently closes terminal T138 with T136 and every historical scope', () => {
		expect(taskDescriptorFor([{ id: 'next-tailwind-starter-blog' }])).toEqual(
			t142TaskDescriptor,
		);
		expect(t138TaskDescriptor).toMatchObject({
			taskId: 'T138',
			consentId: T138_CONSENT_ID,
			evidenceFileName: 't138-ingest.json',
			stagingDirectory: 't138-next-tailwind-starter-blog',
			maximumRequests: 21,
			maximumResponseBytes: 8 * 1_024 * 1_024,
			maximumAggregateBytes: 32 * 1_024 * 1_024,
		});
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T138_CONSENT_ID;
		expect(() => assertConsent(T138_CONSENT_ID, t138TaskDescriptor)).toThrow(
			'permanently refused before GET',
		);
		for (const refused of [
			undefined,
			T104_CONSENT_ID,
			T106_CONSENT_ID,
			T108_CONSENT_ID,
			T111_CONSENT_ID,
			T113_CONSENT_ID,
			T124_CONSENT_ID,
			T128_CONSENT_ID,
			T134_CONSENT_ID,
			T136_CONSENT_ID,
			`${T138_CONSENT_ID}-adjacent`,
		])
			expect(() => assertConsent(refused, t138TaskDescriptor)).toThrow();
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		expect(() => assertConsent(T138_CONSENT_ID, t138TaskDescriptor)).toThrow(
			'permanently refused before GET',
		);
	});

	it('runs the complete 138-blob selector and emits the exact shared 21-request plan', () => {
		const tree = createT138SyntheticTree();
		expect(tree).toHaveLength(138);
		expect(tree.every((row) => row.type === 'blob')).toBe(true);
		const plan = runT138ProductionPreflight(candidate, tree);
		expect(plan).toEqual(createT138RequestPlan(candidate, T136_REQUIRED_PATHS));
		expect(plan.map((entry) => entry.name)).toEqual([
			'repository-metadata',
			'commit-metadata',
			'tree-metadata',
			'archive-copy-1',
			'archive-copy-2',
			...T136_REQUIRED_PATHS.flatMap((reliedPath) => [
				`raw-copy-1:${reliedPath}`,
				`raw-copy-2:${reliedPath}`,
			]),
		]);
		expect(plan[2]?.url).toBe(
			`https://api.github.com/repos/timlrx/tailwind-nextjs-starter-blog/git/trees/${treeSha}?recursive=1`,
		);
		expect(
			plan.find((entry) => entry.name === 'raw-copy-1:app/blog/[...slug]/page.tsx')?.url,
		).toBe(
			`https://raw.githubusercontent.com/timlrx/tailwind-nextjs-starter-blog/${commit}/app/blog/%5B...slug%5D/page.tsx`,
		);
		expect(
			[...T136_REQUIRED_PATHS].sort((left, right) => left.localeCompare(right)),
		).not.toEqual(T136_REQUIRED_PATHS);
	});

	it('refuses missing, adjacent, historical, future, mismatched, and offline consent at zero fetch', async () => {
		let attempts = 0;
		const forbiddenFetch = (async () => {
			attempts += 1;
			throw new Error('network must remain unreachable');
		}) as typeof fetch;
		for (const consent of [
			undefined,
			T128_CONSENT_ID,
			T134_CONSENT_ID,
			T136_CONSENT_ID,
			T138_CONSENT_ID,
			`${T138_CONSENT_ID}-adjacent`,
			'T140-official-source-timlrx-tailwind-nextjs-starter-blog-future-ingest',
		]) {
			process.env.VERSIONLESS_NETWORK_MODE = 'consented';
			if (consent) process.env.VERSIONLESS_CONSENT_ID = consent;
			else delete process.env.VERSIONLESS_CONSENT_ID;
			await expect(
				ingestT138([candidate], consent, forbiddenFetch, '/tmp/t138-consent-no-write'),
			).rejects.toThrow();
		}
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.VERSIONLESS_CONSENT_ID = T138_CONSENT_ID;
		await expect(
			ingestT138([candidate], T138_CONSENT_ID, forbiddenFetch, '/tmp/t138-consent-no-write'),
		).rejects.toThrow();
		expect(attempts).toBe(0);
	});

	it('fails every full-tree selector/schema/count/order mutation before fetch', async () => {
		const original = createT138SyntheticTree();
		const mutations: Array<{
			readonly config: FixtureConfig;
			readonly tree: ReturnType<typeof createT138SyntheticTree>;
		}> = [
			{ config: candidate, tree: original.slice(1) },
			{ config: candidate, tree: [...original, { ...original[137]!, path: 'extra.ts' }] },
			{
				config: candidate,
				tree: original.map((row, index) =>
					index === 1 ? { ...row, path: original[0]!.path } : row,
				),
			},
			{
				config: candidate,
				tree: original.map((row, index) =>
					index === 0 ? { ...row, path: 'synthetic/replacement.ts' } : row,
				),
			},
			{
				config: candidate,
				tree: original.map((row, index) =>
					index === 0 ? { ...row, type: 'tree', mode: '040000' } : row,
				),
			},
			{
				config: candidate,
				tree: original.map((row, index) =>
					index === 0 ? { ...row, path: '../escape' } : row,
				),
			},
			{
				config: { ...candidate, requiredPaths: [...T136_REQUIRED_PATHS].reverse() },
				tree: original,
			},
			{
				config: {
					...candidate,
					requiredPaths: [...T136_REQUIRED_PATHS].sort((left, right) =>
						left.localeCompare(right),
					),
				},
				tree: original,
			},
			{
				config: { ...candidate, requiredPaths: [...T136_REQUIRED_PATHS, 'README.md'] },
				tree: original,
			},
		];
		let attempts = 0;
		const forbiddenFetch = (async () => {
			attempts += 1;
			throw new Error('network must remain unreachable');
		}) as typeof fetch;
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T138_CONSENT_ID;
		for (const mutation of mutations) {
			expect(() => runT138ProductionPreflight(mutation.config, mutation.tree)).toThrow();
			await expect(
				ingestT138(
					[mutation.config],
					T138_CONSENT_ID,
					forbiddenFetch,
					'/tmp/t138-no-write',
					mutation.tree,
				),
			).rejects.toThrow();
		}
		expect(attempts).toBe(0);
	});

	it('rejects every dynamic-route encoding or URL-family mutation', () => {
		const prefix = `https://raw.githubusercontent.com/timlrx/tailwind-nextjs-starter-blog/${commit}/app/blog/`;
		for (const suffix of [
			'[...slug]/page.tsx',
			'%5b...slug%5d/page.tsx',
			'%255B...slug%255D/page.tsx',
			'%5B..%2Fslug%5D/page.tsx',
			'%5B...slug%5D/../page.tsx',
			'%5B...slug%5D/page.tsx?raw=1',
			'%5B...other%5D/page.tsx',
		])
			expect(() => assertAllowedUrl(`${prefix}${suffix}`, candidate)).toThrow();
	});

	it('requires the exact T138 21-response terminal ledger', () => {
		const plan = runT138ProductionPreflight(candidate);
		const state = createNetworkState(() => undefined, {
			maximumRequests: 21,
			maximumAggregateBytes: 32 * 1_024 * 1_024,
		});
		state.ledger = plan.map((entry, index) => ({
			sequence: index + 1,
			fixture: 'next-tailwind-starter-blog',
			name: entry.name,
			host:
				index < 3
					? 'api.github.com'
					: index < 5
						? 'codeload.github.com'
						: 'raw.githubusercontent.com',
			url: entry.url,
			method: 'GET',
			result: 'pass',
			outcome: 'success',
			httpStatus: 200,
			receivedBytes: 1,
			bodyComplete: true,
			timestamp: '2026-08-07T00:00:00.000Z',
			contentEncoding: 'identity',
			disposition: 'accepted-complete-body',
			byteLength: 1,
			sha256: 'a'.repeat(64),
		}));
		state.attempts = 21;
		state.completedBytes = 21;
		expect(() => requireT138SuccessLedger(state)).not.toThrow();
		state.ledger[5] = Object.freeze({ ...state.ledger[5]!, name: 'raw-copy-2:.yarnrc.yml' });
		expect(() => requireT138SuccessLedger(state)).toThrow('exact 21 GET sequence');
	});

	it('requires T136/T138 output and staging absence without rejecting accepted T128', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t138-absence-'));
		temporary.push(directory);
		await expect(
			requirePublicationAbsence(directory, [candidate], t138TaskDescriptor),
		).resolves.toBeUndefined();
		for (const relative of [
			'fixtures/next-tailwind-starter-blog/fixture.json',
			'evidence/ingests/next-tailwind-starter-blog/t138-ingest.json',
			'.versionless/cache/tier-f/.staging/t136-next-tailwind-starter-blog',
			'.versionless/cache/tier-f/.staging/t138-next-tailwind-starter-blog',
		]) {
			const isolated = await mkdtemp(path.join(os.tmpdir(), 'versionless-t138-residue-'));
			temporary.push(isolated);
			const residue = path.join(isolated, relative);
			if (path.extname(residue)) {
				await mkdir(path.dirname(residue), { recursive: true });
				await writeFile(residue, '{}\n');
			} else await mkdir(residue, { recursive: true });
			await expect(
				requirePublicationAbsence(isolated, [candidate], t138TaskDescriptor),
			).rejects.toThrow('Pre-network publication residue exists');
		}
	});
});

describe('T142 production-shared output-document preflight', () => {
	const commit = '09ba0550caea03a8c38bc4878d05838d2a57f999';
	const treeSha = '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf';
	const candidate: FixtureConfig = {
		...fixture,
		id: 'next-tailwind-starter-blog',
		framework: 'nextjs',
		owner: 'timlrx',
		repository: 'tailwind-nextjs-starter-blog',
		commit,
		expectedTreeLead: treeSha,
		requiredPaths: T136_REQUIRED_PATHS,
	};

	it('dispatches the terminal T142 descriptor while T142, T136, and T138 remain closed', () => {
		expect(taskDescriptorFor([{ id: candidate.id }])).toEqual(t142TaskDescriptor);
		expect(t142TaskDescriptor).toMatchObject({
			taskId: 'T142',
			consentId: T142_CONSENT_ID,
			evidenceFileName: 't142-ingest.json',
			stagingDirectory: 't142-next-tailwind-starter-blog',
			maximumRequests: 21,
			maximumResponseBytes: 8 * 1_024 * 1_024,
			maximumAggregateBytes: 32 * 1_024 * 1_024,
		});
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T142_CONSENT_ID;
		expect(() => assertConsent(T142_CONSENT_ID, t142TaskDescriptor)).toThrow(
			'permanently refused before GET',
		);
		expect(() => assertConsent(T136_CONSENT_ID, t136TaskDescriptor)).toThrow(
			'permanently refused before GET',
		);
		expect(() => assertConsent(T138_CONSENT_ID, t138TaskDescriptor)).toThrow(
			'permanently refused before GET',
		);
		for (const refused of [
			undefined,
			T128_CONSENT_ID,
			T134_CONSENT_ID,
			T136_CONSENT_ID,
			T138_CONSENT_ID,
			`${T142_CONSENT_ID}-adjacent`,
			'T144-official-source-timlrx-tailwind-nextjs-starter-blog-future-ingest',
		]) {
			if (refused) process.env.VERSIONLESS_CONSENT_ID = refused;
			else delete process.env.VERSIONLESS_CONSENT_ID;
			expect(() => assertConsent(refused, t142TaskDescriptor)).toThrow();
		}
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.VERSIONLESS_CONSENT_ID = T142_CONSENT_ID;
		expect(() => assertConsent(T142_CONSENT_ID, t142TaskDescriptor)).toThrow();
	});

	it('constructs and scans the exact 138-row synthetic provenance document', () => {
		const tree = createT142SyntheticOfficialTree();
		expect(tree).toHaveLength(138);
		expect(new Set(tree.map((row) => row.path)).size).toBe(138);
		expect(
			tree.every(
				(row) =>
					row.sha.length === 40 &&
					[...row.sha].every(
						(character) =>
							(character >= '0' && character <= '9') ||
							(character >= 'a' && character <= 'f'),
					) &&
					[...row.sha].some((character) => character >= 'a' && character <= 'f'),
			),
		).toBe(true);
		expect(tree.some((row) => row.sha.includes('1234567890123456789'))).toBe(true);
		const documents = runT142OutputDocumentPreflight(candidate, undefined, tree);
		expect(Object.keys(documents.provenance)).toHaveLength(21);
		expect(documents.provenance).toMatchObject({
			schemaVersion: 'versionless.cross-source-provenance.v1',
			fixture: candidate.id,
			repository: 'timlrx/tailwind-nextjs-starter-blog',
			repositoryIdentity: {
				fullName: 'timlrx/tailwind-nextjs-starter-blog',
				fork: false,
			},
			commit,
			tree: treeSha,
			officialTreeRowCount: 138,
		});
		expect(documents.provenance.officialTree).toEqual(tree);
	});

	it('rejects malformed target documents through the identical production scanner', () => {
		const treeMutation =
			(mutate: (rows: Record<string, unknown>[]) => void): OutputDocumentMutation =>
			(documents) => {
				mutate(documents.provenance.officialTree as Record<string, unknown>[]);
			};
		const mutations: OutputDocumentMutation[] = [
			(documents) => {
				documents.provenance.schemaVersion = 'versionless.cross-source-provenance.v2';
			},
			(documents) => {
				documents.provenance.fixture = 'next-tailwind-starter-blog-copy';
			},
			(documents) => {
				documents.provenance.repository = 'timlrx/other';
			},
			(documents) => {
				(documents.provenance.repositoryIdentity as Record<string, unknown>).fullName =
					'timlrx/other';
			},
			(documents) => {
				(documents.provenance.repositoryIdentity as Record<string, unknown>).fork = true;
			},
			(documents) => {
				documents.provenance.commit = 'a'.repeat(40);
			},
			(documents) => {
				documents.provenance.tree = 'b'.repeat(40);
			},
			(documents) => {
				documents.provenance.officialTreeRowCount = 137;
			},
			(documents) => {
				(documents.provenance.officialTree as unknown[]).pop();
			},
			treeMutation((rows) => {
				rows[1]!.path = rows[0]!.path;
			}),
			treeMutation((rows) => {
				rows[0]!.path = '../escape';
			}),
			treeMutation((rows) => {
				rows[0]!.type = 'tree';
			}),
			treeMutation((rows) => {
				rows[0]!.mode = '040000';
			}),
			treeMutation((rows) => {
				rows[0]!.sha = 1234567890123;
			}),
			treeMutation((rows) => {
				rows[0]!.sha = 'A'.repeat(40);
			}),
			treeMutation((rows) => {
				rows[0]!.sha = 'g'.repeat(40);
			}),
			treeMutation((rows) => {
				rows[0]!.sha = 'a'.repeat(39);
			}),
			(documents) => {
				documents.provenance.unexpected = true;
			},
			(documents) => {
				delete documents.provenance.repositoryIdentity;
			},
			(documents) => {
				documents.provenance = { wrapper: documents.provenance };
			},
		];
		for (const mutation of mutations)
			expect(() => runT142OutputDocumentPreflight(candidate, mutation)).toThrow(
				'Sensitive material refused',
			);
	});

	it('refuses every terminal T142 ingest before any fetch or residue', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t142-preflight-'));
		temporary.push(directory);
		let attempts = 0;
		const forbiddenFetch = (async () => {
			attempts += 1;
			throw new Error('network must remain unreachable');
		}) as typeof fetch;
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T142_CONSENT_ID;
		const selectorTree = createT138SyntheticTree().slice(1);
		await expect(
			ingestT142([candidate], T142_CONSENT_ID, forbiddenFetch, directory, {
				selectorTree,
			}),
		).rejects.toThrow('permanently refused before GET');
		const outputTree = createT142SyntheticOfficialTree().map((row, index) =>
			index === 12 ? { ...row, sha: '1'.repeat(40) } : row,
		);
		await expect(
			ingestT142([candidate], T142_CONSENT_ID, forbiddenFetch, directory, {
				outputTree,
			}),
		).rejects.toThrow('permanently refused before GET');
		await expect(
			ingestT142([candidate], T142_CONSENT_ID, forbiddenFetch, directory, {
				mutateDocuments: (documents) => {
					documents.provenance.fixture = 'wrong-fixture';
				},
			}),
		).rejects.toThrow('permanently refused before GET');
		expect(attempts).toBe(0);
		expect(await readFile(directory, { encoding: 'utf8' }).catch(() => '')).toBe('');
	});

	it('refuses malformed and historical consent before fetch', async () => {
		let attempts = 0;
		const forbiddenFetch = (async () => {
			attempts += 1;
			throw new Error('network must remain unreachable');
		}) as typeof fetch;
		for (const consent of [
			undefined,
			T128_CONSENT_ID,
			T136_CONSENT_ID,
			T138_CONSENT_ID,
			`${T142_CONSENT_ID}-adjacent`,
			'T144-official-source-timlrx-tailwind-nextjs-starter-blog-future-ingest',
		]) {
			process.env.VERSIONLESS_NETWORK_MODE = 'consented';
			if (consent) process.env.VERSIONLESS_CONSENT_ID = consent;
			else delete process.env.VERSIONLESS_CONSENT_ID;
			await expect(
				ingestT142([candidate], consent, forbiddenFetch, '/tmp/t142-consent-no-write'),
			).rejects.toThrow();
		}
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.VERSIONLESS_CONSENT_ID = T142_CONSENT_ID;
		await expect(
			ingestT142([candidate], T142_CONSENT_ID, forbiddenFetch, '/tmp/t142-consent-no-write'),
		).rejects.toThrow();
		expect(attempts).toBe(0);
	});

	it('requires the exact T142 21-response terminal ledger', () => {
		const plan = runT138ProductionPreflight(candidate);
		const state = createNetworkState(() => undefined, {
			maximumRequests: 21,
			maximumAggregateBytes: 32 * 1_024 * 1_024,
		});
		state.ledger = plan.map((entry, index) => ({
			sequence: index + 1,
			fixture: candidate.id,
			name: entry.name,
			host:
				index < 3
					? 'api.github.com'
					: index < 5
						? 'codeload.github.com'
						: 'raw.githubusercontent.com',
			url: entry.url,
			method: 'GET',
			result: 'pass',
			outcome: 'success',
			httpStatus: 200,
			receivedBytes: 1,
			bodyComplete: true,
			timestamp: '2026-08-07T00:00:00.000Z',
			contentEncoding: 'identity',
			disposition: 'accepted-complete-body',
			byteLength: 1,
			sha256: 'a'.repeat(64),
		}));
		state.attempts = 21;
		state.completedBytes = 21;
		expect(() => requireT142SuccessLedger(state)).not.toThrow();
		state.ledger[20] = Object.freeze({
			...state.ledger[20]!,
			method: 'POST',
		}) as unknown as LedgerRecord;
		expect(() => requireT142SuccessLedger(state)).toThrow('exact 21 GET sequence');
	});

	it('requires T136/T138/T142 output and staging absence', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t142-absence-'));
		temporary.push(directory);
		await expect(
			requirePublicationAbsence(directory, [candidate], t142TaskDescriptor),
		).resolves.toBeUndefined();
		for (const relative of [
			'fixtures/next-tailwind-starter-blog/fixture.json',
			'fixtures/next-tailwind-starter-blog/provenance.json',
			'evidence/ingests/next-tailwind-starter-blog/t136-ingest.json',
			'evidence/ingests/next-tailwind-starter-blog/t138-ingest.json',
			'evidence/ingests/next-tailwind-starter-blog/t142-ingest.json',
			'.versionless/cache/tier-f/.staging/t136-next-tailwind-starter-blog',
			'.versionless/cache/tier-f/.staging/t138-next-tailwind-starter-blog',
			'.versionless/cache/tier-f/.staging/t142-next-tailwind-starter-blog',
		]) {
			const isolated = await mkdtemp(path.join(os.tmpdir(), 'versionless-t142-residue-'));
			temporary.push(isolated);
			const residue = path.join(isolated, relative);
			if (path.extname(residue)) {
				await mkdir(path.dirname(residue), { recursive: true });
				await writeFile(residue, '{}\n');
			} else await mkdir(residue, { recursive: true });
			await expect(
				requirePublicationAbsence(isolated, [candidate], t142TaskDescriptor),
			).rejects.toThrow('Pre-network publication residue exists');
		}
	});
});

describe('T108 NextChat provenance-only consent and dynamic root closure', () => {
	const commit = '1'.repeat(40);
	const tree = '2'.repeat(40);
	const candidate: FixtureConfig = {
		...fixture,
		id: 'next-nextchat',
		framework: 'nextjs',
		owner: 'ChatGPTNextWeb',
		repository: 'NextChat',
		commit,
		requiredPaths: ['LICENSE', 'package.json'],
	};

	function metadataFetch(options?: {
		mismatchedHead?: boolean;
		truncatedTree?: boolean;
	}): typeof fetch {
		let headCopies = 0;
		return (async (input, init) => {
			expect(init).toMatchObject({
				method: 'GET',
				redirect: 'manual',
				headers: { 'Accept-Encoding': 'identity' },
			});
			const url = String(input);
			let document: unknown;
			if (url === 'https://api.github.com/repos/ChatGPTNextWeb/NextChat')
				document = { full_name: 'ChatGPTNextWeb/NextChat', default_branch: 'main' };
			else if (url.endsWith('/commits/main')) {
				headCopies += 1;
				document = {
					sha: options?.mismatchedHead && headCopies === 2 ? '3'.repeat(40) : commit,
				};
			} else if (url.endsWith(`/commits/${commit}`))
				document = { sha: commit, commit: { tree: { sha: tree } } };
			else if (url.endsWith(`/git/trees/${tree}?recursive=1`))
				document = {
					sha: tree,
					truncated: options?.truncatedTree ?? false,
					tree: ['LICENSE', 'package.json', 'README.md'].map((file) => ({
						path: file,
						mode: '100644',
						type: 'blob',
						sha: '4'.repeat(40),
					})),
				};
			else throw new Error(`Unexpected synthetic T108 URL: ${url}`);
			const bytes = Buffer.from(JSON.stringify(document));
			return response(bytes, {
				status: 200,
				headers: { 'Content-Length': String(bytes.byteLength) },
			});
		}) as typeof fetch;
	}

	it('binds only the exact case-sensitive NextChat survivor and fresh literal task', () => {
		expect(() => taskDescriptorFor([{ id: 'next-nextchat' }])).toThrow(
			'permanently refused before GET',
		);
		for (const selected of [
			[{ id: 'next-nextchat' }, { id: 'next-nextchat' }],
			[{ id: 'next-nextchat' }, { id: 'react-avataaars' }],
			[{ id: 'react-avataaars' }],
		] as const)
			expect(() => taskDescriptorFor(selected)).toThrow();

		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T108_CONSENT_ID;
		expect(() => assertConsent(T108_CONSENT_ID, t108TaskDescriptor)).toThrow(
			'permanently refused before GET',
		);
		for (const invalid of [
			undefined,
			T104_CONSENT_ID,
			T106_CONSENT_ID,
			'T107-official-source-chatgptnextweb-nextchat-provenance-ingest',
			'T109-official-source-chatgptnextweb-nextchat-provenance-ingest',
			T094_CONSENT_ID,
		])
			expect(() => assertConsent(invalid, t108TaskDescriptor)).toThrow();
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		expect(() => assertConsent(T108_CONSENT_ID, t108TaskDescriptor)).toThrow();
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T108_CONSENT_ID;
	});

	it('dynamically selects one exact root package and exactly one allowlisted root license', () => {
		const row = (file: string) => ({
			path: file,
			mode: '100644',
			type: 'blob',
			sha: tree,
		});
		for (const license of T108_ROOT_LICENSE_PATHS) {
			const selected = [license, 'package.json'].sort((left, right) =>
				left.localeCompare(right),
			);
			expect(
				selectT108RequiredPaths([row('README.md'), row(license), row('package.json')]),
			).toEqual(selected);
			expect(
				selectRequiredPaths({ ...candidate, requiredPaths: selected }, [
					row('README.md'),
					row(license),
					row('package.json'),
				]),
			).toEqual(selected);
		}
		for (const invalidTree of [
			[row('LICENSE')],
			[row('package.json')],
			[row('package.json'), row('LICENSE'), row('LICENSE.md')],
			[row('package.json'), row('nested/LICENSE')],
			[row('package.json'), row('license')],
			[row('package.json'), row('License.md')],
			[row('package.json'), row('COPYING')],
			[row('package.json'), row('package.json'), row('LICENSE')],
		])
			expect(() => selectT108RequiredPaths(invalidTree)).toThrow();
		for (const requiredPaths of [
			['package.json', 'LICENSE'],
			['LICENSE', 'package.json', 'README.md'],
			['LICENSE', 'LICENSE', 'package.json'],
			['nested/LICENSE', 'package.json'],
			['license', 'package.json'],
		] as const)
			expect(() =>
				selectRequiredPaths({ ...candidate, requiredPaths }, [
					row('LICENSE'),
					row('package.json'),
				]),
			).toThrow();
	});

	it('permits raw GETs for only the dynamically selected two root paths', () => {
		for (const rawPath of candidate.requiredPaths!)
			expect(
				assertAllowedUrl(
					`https://raw.githubusercontent.com/ChatGPTNextWeb/NextChat/${commit}/${rawPath}`,
					candidate,
				),
			).toBe('raw.githubusercontent.com');
		for (const rawPath of ['README.md', 'yarn.lock', 'app/page.tsx', 'nested/LICENSE'])
			expect(() =>
				assertAllowedUrl(
					`https://raw.githubusercontent.com/ChatGPTNextWeb/NextChat/${commit}/${rawPath}`,
					candidate,
				),
			).toThrow('outside immutable');
	});

	it('repeats current HEAD, immutable commit, and tree before accepting dynamic paths', async () => {
		const state = createNetworkState(() => undefined, {
			maximumRequests: 24,
			maximumAggregateBytes: 128 * 1_024 * 1_024,
		});
		await expect(resolveT108Candidate(state, metadataFetch())).resolves.toMatchObject({
			id: 'next-nextchat',
			owner: 'ChatGPTNextWeb',
			repository: 'NextChat',
			defaultBranch: 'main',
			commit,
			requiredPaths: ['LICENSE', 'package.json'],
		});
		expect(state.ledger.map((record) => record.name)).toEqual([
			'repository-metadata-copy-1',
			'repository-metadata-copy-2',
			'default-branch-head-copy-1',
			'default-branch-head-copy-2',
			'immutable-commit-metadata-copy-1',
			'immutable-commit-metadata-copy-2',
			'tree-metadata-copy-1',
			'tree-metadata-copy-2',
		]);
		expect(reconcileNetworkState(state)).toMatchObject({ attempts: 8, completedBodies: 8 });
	});

	it('fails closed on repeat mismatch or truncated tree without selecting alternatives', async () => {
		for (const options of [{ mismatchedHead: true }, { truncatedTree: true }]) {
			const state = createNetworkState(() => undefined, {
				maximumRequests: 24,
				maximumAggregateBytes: 128 * 1_024 * 1_024,
			});
			await expect(resolveT108Candidate(state, metadataFetch(options))).rejects.toThrow();
		}
	});

	it('corroborates only Next major 13 after archive closure', () => {
		const index = (next: unknown): ArchiveIndex => {
			const bytes = Buffer.from(JSON.stringify({ dependencies: { next } }));
			return {
				root: 'fixture',
				manifestSha256: 'manifest',
				globalMetadata: null,
				pathMetadata: [],
				files: [
					{
						path: 'package.json',
						bytes,
						byteLength: bytes.byteLength,
						sha256: 'package',
					},
				],
			};
		};
		for (const accepted of ['13.0.0', '^13.4.7', '~13.5.0'])
			expect(() => requireT108PackageFacts(index(accepted))).not.toThrow();
		for (const refused of ['12.3.0', '14.0.0', 'latest', undefined])
			expect(() => requireT108PackageFacts(index(refused))).toThrow('Next major 13');
	});

	it('refuses invalid repository identity and every T104/T106/T108 residue before GET', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t108-preget-'));
		temporary.push(directory);
		let attempts = 0;
		const forbiddenFetch = (async () => {
			attempts += 1;
			throw new Error('network must remain unreachable');
		}) as typeof fetch;
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T108_CONSENT_ID;
		await expect(
			ingestT108(
				[{ ...candidate, owner: 'chatgptnextweb' }],
				T108_CONSENT_ID,
				forbiddenFetch,
				directory,
			),
		).rejects.toThrow('permanently refused before GET');
		expect(attempts).toBe(0);

		for (const relative of [
			'fixtures/next-nextchat/fixture.json',
			'fixtures/next-nextchat/provenance.json',
			'evidence/ingests/next-nextchat/t108-ingest.json',
			'.versionless/cache/tier-f/next-nextchat',
			'.versionless/cache/tier-f/.staging/t108-next-nextchat',
			'fixtures/next-killedbygoogle/fixture.json',
			'evidence/ingests/next-killedbygoogle/t104-ingest.json',
			'evidence/ingests/next-killedbygoogle/t106-ingest.json',
			'.versionless/cache/tier-f/.staging/t104-next-killedbygoogle',
			'.versionless/cache/tier-f/.staging/t106-next-killedbygoogle',
		]) {
			const attemptRoot = await mkdtemp(path.join(os.tmpdir(), 'versionless-t108-residue-'));
			temporary.push(attemptRoot);
			const residue = path.join(attemptRoot, relative);
			if (path.extname(residue)) {
				await mkdir(path.dirname(residue), { recursive: true });
				await writeFile(residue, '{}\n');
			} else await mkdir(residue, { recursive: true });
			await expect(
				requirePublicationAbsence(
					attemptRoot,
					[{ id: 'next-nextchat' }],
					t108TaskDescriptor,
				),
			).rejects.toThrow('Pre-network publication residue exists');
		}
	});
});

describe('T085 immutable terminal request ledger', () => {
	it('emits a successful complete-body record before parsing and reconciles host bytes', async () => {
		const events: string[] = [];
		const state = createNetworkState(() => events.push('ledger'));
		const body = await acquire(
			state,
			fixture,
			'success',
			repositoryUrl,
			fetchReturning(response(Buffer.from('{"ok":true}\n'), { status: 200 })),
		);
		events.push('parse');
		expect(parseLedgeredJson(body, state, 'synthetic metadata')).toEqual({ ok: true });
		expect(events).toEqual(['ledger', 'parse']);
		expect(state.ledger[0]).toMatchObject({
			sequence: 1,
			result: 'pass',
			outcome: 'success',
			bodyComplete: true,
			byteLength: 12,
		});
		expect(reconcileNetworkState(state)).toMatchObject({
			attempts: 1,
			completedBodies: 1,
			completedBytes: 12,
			perHost: { 'api.github.com': { attempts: 1, completedBodies: 1, bytes: 12 } },
		});
	});

	it('refuses parsing when the matching successful terminal record is absent', () => {
		const complete = completeBuffer([Buffer.from('{}')]);
		const body: AcquiredBody = { ...complete, ledgerSequence: 1 };
		expect(() =>
			parseLedgeredJson(
				body,
				createNetworkState(() => undefined),
				'metadata',
			),
		).toThrow('cannot be parsed before');
	});

	it('records HTTP, redirect, and pre-response transport failures exactly once', async () => {
		expect(
			(await failureRecord(fetchReturning(response(Buffer.alloc(0), { status: 503 }))))
				.outcome,
		).toBe('http-failure');
		expect(
			(await failureRecord(fetchReturning(response(Buffer.alloc(0), { status: 302 }))))
				.outcome,
		).toBe('redirect-refusal');
		const transportFailure = (async () => {
			throw new Error('synthetic connection refusal');
		}) as typeof fetch;
		expect((await failureRecord(transportFailure)).outcome).toBe('transport-failure');
	});

	it('records partial-stream failure without a complete-body digest', async () => {
		let pulls = 0;
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulls += 1;
				if (pulls === 1) {
					controller.enqueue(Buffer.from('partial'));
					return;
				}
				controller.error(new Error('synthetic truncation'));
			},
		});
		const record = await failureRecord(fetchReturning(new Response(stream, { status: 200 })));
		expect(record).toMatchObject({
			outcome: 'stream-failure',
			result: 'fail',
			bodyComplete: false,
			receivedBytes: 7,
		});
		expect(record).not.toHaveProperty('sha256');
		expect(record).not.toHaveProperty('byteLength');
	});

	it('enforces Content-Length after complete receipt but emits no accepted digest on mismatch', async () => {
		const record = await failureRecord(
			fetchReturning(
				response(Buffer.from('short'), { status: 200, headers: { 'Content-Length': '9' } }),
			),
		);
		expect(record).toMatchObject({
			outcome: 'content-length-mismatch',
			bodyComplete: true,
			receivedBytes: 5,
		});
		expect(record).not.toHaveProperty('sha256');
	});

	it('records response-limit and aggregate-limit failures without accepted digests', async () => {
		const responseLimit = await failureRecord(fetchReturning(response(Buffer.from('12345'))), {
			maximumResponseBytes: 4,
			maximumAggregateBytes: 100,
		});
		expect(responseLimit).toMatchObject({
			outcome: 'response-limit',
			receivedBytes: 5,
			bodyComplete: false,
		});
		const aggregateLimit = await failureRecord(fetchReturning(response(Buffer.from('12345'))), {
			maximumResponseBytes: 100,
			maximumAggregateBytes: 4,
		});
		expect(aggregateLimit).toMatchObject({
			outcome: 'aggregate-limit',
			receivedBytes: 5,
			bodyComplete: true,
		});
	});

	it('refuses duplicate and missing ledger sequences during reconciliation', async () => {
		const state = createNetworkState(() => undefined);
		await acquire(
			state,
			fixture,
			'one',
			repositoryUrl,
			fetchReturning(response(Buffer.from('one'))),
		);
		await acquire(
			state,
			fixture,
			'two',
			repositoryUrl,
			fetchReturning(response(Buffer.from('two'))),
		);
		state.ledger[1] = Object.freeze({ ...state.ledger[1]!, sequence: 1 });
		expect(() => reconcileNetworkState(state)).toThrow('duplicate or missing sequence');
		state.ledger.pop();
		expect(() => reconcileNetworkState(state)).toThrow('counts differ');
	});

	it('does not reach publication after any acquisition failure', async () => {
		let publicationReached = false;
		const state = createNetworkState(() => undefined);
		await expect(
			(async () => {
				await acquire(
					state,
					fixture,
					'failed-acquisition',
					repositoryUrl,
					fetchReturning(response(Buffer.alloc(0), { status: 500 })),
				);
				publicationReached = true;
			})(),
		).rejects.toThrow();
		expect(publicationReached).toBe(false);
		expect(state.ledger).toHaveLength(1);
	});
});

describe('T092 pair publication', () => {
	it('allows the exact empty pre-network publication state without creating targets', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t092-absence-'));
		temporary.push(directory);
		await expect(requirePublicationAbsence(directory, [fixture])).resolves.toBeUndefined();
		await expect(access(path.join(directory, 'fixtures'))).rejects.toMatchObject({
			code: 'ENOENT',
		});
		await expect(access(path.join(directory, '.versionless'))).rejects.toMatchObject({
			code: 'ENOENT',
		});
	});

	it.each([
		['shared fixture', 'fixtures/react-avataaars/fixture.json', false],
		['shared provenance', 'fixtures/react-avataaars/provenance.json', false],
		['shared cache', '.versionless/cache/tier-f/react-avataaars', true],
		['T084 evidence', 'evidence/ingests/react-avataaars/t084-ingest.json', false],
		['T090 evidence', 'evidence/ingests/react-avataaars/t090-ingest.json', false],
		['T092 evidence', 'evidence/ingests/react-avataaars/t092-ingest.json', false],
		['T084 staging', '.versionless/cache/tier-f/.staging/t084-pair', true],
		['T090 staging', '.versionless/cache/tier-f/.staging/t090-pair', true],
		['T092 staging', '.versionless/cache/tier-f/.staging/t092-pair', true],
	] as const)(
		'refuses %s residue without cleaning or publishing',
		async (_label, relative, isDirectory) => {
			const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t092-residue-'));
			temporary.push(directory);
			const residue = path.join(directory, relative);
			if (isDirectory) await mkdir(residue, { recursive: true });
			else {
				await mkdir(path.dirname(residue), { recursive: true });
				await writeFile(residue, '{}\n');
			}
			await expect(requirePublicationAbsence(directory, [fixture])).rejects.toThrow(
				'Pre-network publication residue exists',
			);
			await expect(access(residue)).resolves.toBeUndefined();
			await expect(
				access(path.join(directory, 'fixtures/angular-contacts/fixture.json')),
			).rejects.toMatchObject({ code: 'ENOENT' });
		},
	);

	it('rolls back after every publication boundary across both fixture closures', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t084-transaction-'));
		temporary.push(directory);
		for (let failureBoundary = 0; failureBoundary < 6; failureBoundary++) {
			const attempt = path.join(directory, `attempt-${failureBoundary}`);
			const publications = [];
			for (let index = 0; index < 6; index++) {
				const staged = path.join(attempt, 'staged', `root-${index}`);
				const final = path.join(attempt, 'final', `root-${index}`);
				await mkdir(staged, { recursive: true });
				await writeFile(path.join(staged, 'artifact.json'), '{}\n');
				publications.push({ staged, final });
			}
			await expect(publishTransaction(publications, failureBoundary)).rejects.toThrow(
				'Injected second-fixture publication failure',
			);
			for (const publication of publications)
				await expect(access(publication.final)).rejects.toMatchObject({ code: 'ENOENT' });
			if (failureBoundary < publications.length)
				expect(
					await readFile(
						path.join(publications[failureBoundary]!.staged, 'artifact.json'),
						'utf8',
					),
				).toBe('{}\n');
		}
	});
});
