import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	auditNpmContentCaches,
	canonicalize,
	canonicalNpmPreflightDigest,
	DASHBOARD_CONTACTS_ROW_SET_SHA256,
	findArchiveFile,
	indexTarGzip,
	NPM_LOCK_ACQUISITION_PREFLIGHT_SCHEMA,
	npmLockRowSetDigest,
	parseNpmLockPlan,
	sha256,
	type CachedNpmArtifact,
	type MissingNpmArtifact,
	type NpmLockPair,
} from '../../../core/src/index.ts';

const sourceDirectory = import.meta.dirname;
const root =
	path.basename(sourceDirectory) === 'dist'
		? path.resolve(sourceDirectory, '../../..')
		: path.resolve(sourceDirectory, '../../../..');
const defaultOutput = path.join(
	root,
	'evidence/dependencies/dashboard-contacts/t190-preflight.json',
);

const inputs = [
	{
		fixture: 'react-dashboard',
		commit: '4b8be9f7e0080d680598c74d7e6cfbe080566059',
		archiveSha256: '84a3a8a5e3e39803a25cc7d35e862f99f22aa3fd4e0c39e413a7a2d0e68901e0',
		lockSha256: '75c9591e3d4aa2d3f383b8ca41fd5599c018862b6ebc175759fb6b9d381afccc',
		lockfileVersion: 3 as const,
		pairs: 1_108,
		archive:
			'.versionless/cache/tier-f/react-dashboard/84a3a8a5e3e39803a25cc7d35e862f99f22aa3fd4e0c39e413a7a2d0e68901e0/source.tar.gz',
		lockPath: 'app/package-lock.json',
	},
	{
		fixture: 'angular-contacts',
		commit: '875aa2df7f5f87b6731a1259b63e2b399fa5fb3f',
		archiveSha256: '93b2add6bbda402b86769b39a50cc4cae9050c363619ce3b5f20e8f7cd2f42f0',
		lockSha256: 'd23b1a49b210c9b397194747f1a2a7d0032438e7277d710400fdabb6d8a2bb74',
		lockfileVersion: 1 as const,
		pairs: 1_175,
		archive:
			'.versionless/cache/tier-f/angular-contacts/93b2add6bbda402b86769b39a50cc4cae9050c363619ce3b5f20e8f7cd2f42f0/source.tar.gz',
		lockPath: 'package-lock.json',
	},
] as const;

const caches = [
	{
		label: 'react-boilerplate-v4-node24',
		path: path.join(root, '.versionless/cache/react-boilerplate-v4-node24/npm-cache'),
	},
	{
		label: 'angular-phonecat',
		path: path.join(root, '.versionless/cache/angular-phonecat/npm-cache'),
	},
	{
		label: 'react-boilerplate-v4',
		path: path.join(root, '.versionless/cache/react-boilerplate-v4/npm-cache'),
	},
] as const;

type InputReceipt = Readonly<{
	fixture: string;
	commit: string;
	archive: string;
	archiveSha256: string;
	lockPath: string;
	lockSha256: string;
	lockfileVersion: 1 | 3;
	pairs: number;
}>;

type PreflightPayload = Readonly<{
	schemaVersion: typeof NPM_LOCK_ACQUISITION_PREFLIGHT_SCHEMA;
	result: 'not-ready';
	inputs: readonly InputReceipt[];
	closure: Readonly<{
		pairs: 2_213;
		urls: 2_165;
		sha512OnlyUrls: 1_815;
		legacySha1OnlyUrls: 302;
		dualSriUrls: 48;
		cachedUrls: 667;
		missingUrls: 1_498;
		missingLegacySha1OnlyUrls: 55;
		rowSetSha256: typeof DASHBOARD_CONTACTS_ROW_SET_SHA256;
	}>;
	cacheAudit: Readonly<{
		indexTrusted: false;
		contentHashRequired: true;
		roots: readonly string[];
		cached: readonly CachedNpmArtifact[];
		missing: readonly MissingNpmArtifact[];
	}>;
	metadataSummary: Readonly<{
		cachedTarballs: 667;
		licenseEmpty: 7;
		licenseEmptyIdentities: readonly string[];
		policyUnreviewedDeclarations: readonly Readonly<{
			identity: string;
			layout: 'package' | 'legacy-single-root';
			declarations: readonly string[];
		}>[];
		licenseAmbiguous: number;
		legacySingleRoot: number;
		lifecycleDeclared: number;
		lifecycleAmbiguous: number;
		nativeIndicatorPackages: number;
		enginesDeclared: number;
		enginesAmbiguous: number;
		osDeclared: number;
		osAmbiguous: number;
		cpuDeclared: number;
		cpuAmbiguous: number;
		optionalDependenciesDeclared: number;
		optionalDependenciesAmbiguous: number;
		uncachedMetadata: 'unknown';
	}>;
	proposedAcquisition: Readonly<{
		state: 'blocked-not-ready';
		consent: Readonly<{
			id: 'T190-dashboard-contacts-npm-lock-acquisition';
			status: 'proposed-unconsumed';
			consumed: false;
		}>;
		network: Readonly<{
			enabled: false;
			method: 'GET-only-if-future-judge-approved';
			exactMembership: 'cacheAudit.missing';
			requests: 1_498;
			redirects: 'forbidden';
			credentials: 'forbidden';
			cookies: 'forbidden';
			queryOrFragment: 'forbidden';
			compression: 'identity-only';
			retries: 0;
			maximumResponseBytes: null;
			maximumAggregateBytes: null;
			byteBounds: 'not-approved-blocking';
		}>;
		transaction: Readonly<{
			state: 'not-created';
			stagingPath: null;
			publicationPath: null;
			atomicAllOrNeither: 'required-before-any-future-transfer';
		}>;
	}>;
	blockers: readonly string[];
	nonclaims: readonly string[];
}>;

export type DashboardContactsPreflightReceipt = PreflightPayload &
	Readonly<{
		replay: Readonly<{
			runs: 2;
			networkAttempts: 0;
			firstDigest: string;
			secondDigest: string;
			identical: true;
			residue: 'none';
		}>;
		integrity: Readonly<{ algorithm: 'sha256'; canonicalDigest: string }>;
	}>;

function combinePairs(plans: readonly (readonly NpmLockPair[])[]): NpmLockPair[] {
	const grouped = new Map<string, NpmLockPair[]>();
	for (const pair of plans.flat()) {
		const key = `${pair.url}\0${pair.integrity}`;
		grouped.set(key, [...(grouped.get(key) ?? []), pair]);
	}
	return [...grouped.entries()]
		.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
		.map(([, values]) => ({
			url: values[0]!.url,
			integrity: values[0]!.integrity,
			identities: [
				...new Map(
					values
						.flatMap((value) => value.identities)
						.map((identity) => [`${identity.name}\0${identity.version}`, identity]),
				).values(),
			].sort(
				(left, right) =>
					(left.name < right.name ? -1 : left.name > right.name ? 1 : 0) ||
					(left.version < right.version ? -1 : left.version > right.version ? 1 : 0),
			),
		}));
}

function algorithmState(integrities: readonly string[]): 'sha512' | 'sha1' | 'dual' {
	const sha512 = integrities.some((integrity) => integrity.startsWith('sha512-'));
	const sha1 = integrities.some((integrity) => integrity.startsWith('sha1-'));
	return sha512 ? (sha1 ? 'dual' : 'sha512') : 'sha1';
}

async function buildPayload(): Promise<PreflightPayload> {
	const plans: NpmLockPair[][] = [];
	const receiptInputs: InputReceipt[] = [];
	for (const input of inputs) {
		const archiveBytes = await readFile(path.join(root, input.archive));
		if (sha256(archiveBytes) !== input.archiveSha256)
			throw new Error(`${input.fixture} immutable archive SHA-256 differs`);
		const archive = indexTarGzip(
			{
				bytes: archiveBytes,
				byteLength: archiveBytes.byteLength,
				sha256: input.archiveSha256,
			},
			input.commit,
		);
		const lock = findArchiveFile(archive, input.lockPath).bytes;
		if (sha256(lock) !== input.lockSha256)
			throw new Error(`${input.fixture} immutable lock SHA-256 differs`);
		const plan = parseNpmLockPlan(lock);
		if (plan.lockfileVersion !== input.lockfileVersion || plan.pairs.length !== input.pairs)
			throw new Error(`${input.fixture} lock closure count differs`);
		plans.push([...plan.pairs]);
		receiptInputs.push({
			fixture: input.fixture,
			commit: input.commit,
			archive: input.archive,
			archiveSha256: input.archiveSha256,
			lockPath: input.lockPath,
			lockSha256: input.lockSha256,
			lockfileVersion: input.lockfileVersion,
			pairs: input.pairs,
		});
	}
	const pairs = combinePairs(plans);
	if (pairs.length !== 2_213 || npmLockRowSetDigest(pairs) !== DASHBOARD_CONTACTS_ROW_SET_SHA256)
		throw new Error('Dashboard/Contacts URL/SRI row set differs');
	const audit = await auditNpmContentCaches(pairs, caches);
	const urlIntegrities = new Map<string, string[]>();
	for (const pair of pairs)
		urlIntegrities.set(pair.url, [...(urlIntegrities.get(pair.url) ?? []), pair.integrity]);
	const states = [...urlIntegrities.values()].map((integrities) => algorithmState(integrities));
	const missingSha1Only = audit.missing.filter(
		(item) => item.integrityState === 'legacy-sha1-only',
	).length;
	const licenseEmpty = audit.cached.filter(
		(item) => item.metadata.license.state === 'empty',
	).length;
	if (
		urlIntegrities.size !== 2_165 ||
		states.filter((state) => state === 'sha512').length !== 1_815 ||
		states.filter((state) => state === 'sha1').length !== 302 ||
		states.filter((state) => state === 'dual').length !== 48 ||
		audit.cached.length !== 667 ||
		audit.missing.length !== 1_498 ||
		missingSha1Only !== 55 ||
		licenseEmpty !== 7
	)
		throw new Error(
			`Dashboard/Contacts cache, SRI, or license counts differ: ${canonicalize({
				urls: urlIntegrities.size,
				sha512Only: states.filter((state) => state === 'sha512').length,
				sha1Only: states.filter((state) => state === 'sha1').length,
				dual: states.filter((state) => state === 'dual').length,
				cached: audit.cached.length,
				missing: audit.missing.length,
				missingSha1Only,
				licenseEmpty,
			})}`,
		);
	const licenseEmptyIdentities = audit.cached
		.filter((item) => item.metadata.license.state === 'empty')
		.map((item) => `${item.metadata.name}@${item.metadata.version}`)
		.sort();
	const expectedLicenseEmpty = [
		'better-assert@1.0.2',
		'callsite@1.0.0',
		'component-bind@1.0.0',
		'component-inherit@0.0.3',
		'indexof@0.0.1',
		'object-component@0.0.3',
		'saucelabs@1.5.0',
	];
	if (canonicalize(licenseEmptyIdentities) !== canonicalize(expectedLicenseEmpty))
		throw new Error('Dashboard/Contacts exact license-empty identities differ');
	const jsonSchema = audit.cached.find(
		(item) => item.metadata.name === 'json-schema' && item.metadata.version === '0.2.3',
	);
	const typesQ = audit.cached.find(
		(item) => item.metadata.name === '@types/q' && item.metadata.version === '0.0.32',
	);
	if (
		!jsonSchema ||
		canonicalize(jsonSchema.metadata.license.declarations) !==
			canonicalize(['AFLv2.1', 'BSD']) ||
		jsonSchema.metadata.license.state !== 'declared' ||
		!typesQ ||
		typesQ.metadata.layout !== 'legacy-single-root' ||
		canonicalize(typesQ.metadata.license.declarations) !== canonicalize(['MIT']) ||
		typesQ.metadata.license.state !== 'declared'
	)
		throw new Error('Dashboard/Contacts reconciled legacy license evidence differs');
	return {
		schemaVersion: NPM_LOCK_ACQUISITION_PREFLIGHT_SCHEMA,
		result: 'not-ready',
		inputs: receiptInputs,
		closure: {
			pairs: 2_213,
			urls: 2_165,
			sha512OnlyUrls: 1_815,
			legacySha1OnlyUrls: 302,
			dualSriUrls: 48,
			cachedUrls: 667,
			missingUrls: 1_498,
			missingLegacySha1OnlyUrls: 55,
			rowSetSha256: DASHBOARD_CONTACTS_ROW_SET_SHA256,
		},
		cacheAudit: {
			indexTrusted: false,
			contentHashRequired: true,
			roots: caches.map((cache) => cache.label),
			cached: audit.cached,
			missing: audit.missing,
		},
		metadataSummary: {
			cachedTarballs: 667,
			licenseEmpty,
			licenseEmptyIdentities,
			policyUnreviewedDeclarations: [
				{
					identity: 'json-schema@0.2.3',
					layout: jsonSchema.metadata.layout,
					declarations: jsonSchema.metadata.license.declarations,
				},
				{
					identity: '@types/q@0.0.32',
					layout: typesQ.metadata.layout,
					declarations: typesQ.metadata.license.declarations,
				},
			],
			licenseAmbiguous: audit.cached.filter(
				(item) => item.metadata.license.state === 'ambiguous',
			).length,
			legacySingleRoot: audit.cached.filter(
				(item) => item.metadata.layout === 'legacy-single-root',
			).length,
			lifecycleDeclared: audit.cached.filter((item) =>
				item.metadata.lifecycleScripts.some((script) => script.state === 'declared'),
			).length,
			lifecycleAmbiguous: audit.cached.filter((item) =>
				item.metadata.lifecycleScripts.some((script) => script.state === 'ambiguous'),
			).length,
			nativeIndicatorPackages: audit.cached.filter((item) => {
				const native = item.metadata.nativeIndicators;
				return (
					native.bindingGyp ||
					native.gypfile === 'true' ||
					native.gypfile === 'ambiguous' ||
					native.nodeGypDependency ||
					native.lifecycleMentionsNodeGyp
				);
			}).length,
			enginesDeclared: audit.cached.filter(
				(item) => item.metadata.engines.state === 'declared',
			).length,
			enginesAmbiguous: audit.cached.filter(
				(item) => item.metadata.engines.state === 'ambiguous',
			).length,
			osDeclared: audit.cached.filter((item) => item.metadata.os.state === 'declared').length,
			osAmbiguous: audit.cached.filter((item) => item.metadata.os.state === 'ambiguous')
				.length,
			cpuDeclared: audit.cached.filter((item) => item.metadata.cpu.state === 'declared')
				.length,
			cpuAmbiguous: audit.cached.filter((item) => item.metadata.cpu.state === 'ambiguous')
				.length,
			optionalDependenciesDeclared: audit.cached.filter(
				(item) => item.metadata.optionalDependencies.state === 'declared',
			).length,
			optionalDependenciesAmbiguous: audit.cached.filter(
				(item) => item.metadata.optionalDependencies.state === 'ambiguous',
			).length,
			uncachedMetadata: 'unknown',
		},
		proposedAcquisition: {
			state: 'blocked-not-ready',
			consent: {
				id: 'T190-dashboard-contacts-npm-lock-acquisition',
				status: 'proposed-unconsumed',
				consumed: false,
			},
			network: {
				enabled: false,
				method: 'GET-only-if-future-judge-approved',
				exactMembership: 'cacheAudit.missing',
				requests: 1_498,
				redirects: 'forbidden',
				credentials: 'forbidden',
				cookies: 'forbidden',
				queryOrFragment: 'forbidden',
				compression: 'identity-only',
				retries: 0,
				maximumResponseBytes: null,
				maximumAggregateBytes: null,
				byteBounds: 'not-approved-blocking',
			},
			transaction: {
				state: 'not-created',
				stagingPath: null,
				publicationPath: null,
				atomicAllOrNeither: 'required-before-any-future-transfer',
			},
		},
		blockers: [
			'1,498 exact lock URLs are absent from the verified local caches.',
			'55 missing URLs have only legacy SHA-1 lock evidence and require an explicit Judge decision.',
			'Seven cached tarballs have neither a license declaration nor a named license/NOTICE file.',
			'json-schema@0.2.3 legacy AFLv2.1/BSD declarations and @types/q@0.0.32 MIT declaration are retained as exact evidence but remain policy-unreviewed.',
			'Lifecycle, native, engine, OS, CPU, optional-dependency, and uncached metadata require policy review before acquisition or execution.',
			'Per-response and aggregate byte ceilings have not been approved; network remains unreachable.',
		],
		nonclaims: [
			'SHA-1 is retained only as legacy lock evidence and is not strong integrity.',
			'Cache presence does not establish installability, license compatibility, runtime compatibility, locality, migration readiness, pilot status, support, compliance, certification, authenticity, or signer identity.',
			'No consent was consumed and no network, install, lifecycle script, candidate, build, browser, dependency publication, or trust operation occurred.',
		],
	};
}

function finalize(
	payload: PreflightPayload,
	firstDigest: string,
	secondDigest: string,
): DashboardContactsPreflightReceipt {
	const receipt = {
		...payload,
		replay: {
			runs: 2 as const,
			networkAttempts: 0 as const,
			firstDigest,
			secondDigest,
			identical: true as const,
			residue: 'none' as const,
		},
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return {
		...receipt,
		integrity: {
			algorithm: 'sha256' as const,
			canonicalDigest: canonicalNpmPreflightDigest(copy),
		},
	} satisfies DashboardContactsPreflightReceipt;
}

export async function createDashboardContactsPreflightReceipt(): Promise<DashboardContactsPreflightReceipt> {
	const first = await buildPayload();
	const second = await buildPayload();
	const firstText = canonicalize(first);
	const secondText = canonicalize(second);
	if (firstText !== secondText)
		throw new Error('Dashboard/Contacts offline preflight replays differ');
	const firstDigest = canonicalNpmPreflightDigest(first);
	const secondDigest = canonicalNpmPreflightDigest(second);
	return finalize(first, firstDigest, secondDigest);
}

export async function publishDashboardContactsPreflight(
	output = defaultOutput,
): Promise<DashboardContactsPreflightReceipt> {
	const staging = `${output}.staging`;
	await access(output).then(
		() => {
			throw new Error('Dashboard/Contacts preflight receipt already exists');
		},
		() => undefined,
	);
	await access(staging).then(
		() => {
			throw new Error('Dashboard/Contacts preflight staging path already exists');
		},
		() => undefined,
	);
	const receipt = await createDashboardContactsPreflightReceipt();
	const body = `${canonicalize(receipt)}\n`;
	await mkdir(path.dirname(output), { recursive: true });
	let stagingCreated = false;
	try {
		await writeFile(staging, body, { flag: 'wx' });
		stagingCreated = true;
		await rename(staging, output);
	} catch (error) {
		if (stagingCreated) await rm(staging, { force: true });
		throw error;
	}
	return receipt;
}

export async function verifyDashboardContactsPreflight(
	output = defaultOutput,
): Promise<DashboardContactsPreflightReceipt> {
	const expected = await readFile(output, 'utf8');
	const actual = await createDashboardContactsPreflightReceipt();
	if (expected !== `${canonicalize(actual)}\n`)
		throw new Error('Dashboard/Contacts preflight receipt differs');
	return actual;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (
		!args.includes('--offline') ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Dashboard/Contacts preflight requires explicit dual offline controls');
	const receipt = args.includes('--verify-only')
		? await verifyDashboardContactsPreflight()
		: await publishDashboardContactsPreflight();
	process.stdout.write(
		`${canonicalize({
			result: receipt.result,
			digest: receipt.integrity.canonicalDigest,
			networkAttempts: receipt.replay.networkAttempts,
			consentConsumed: receipt.proposedAcquisition.consent.consumed,
			residue: receipt.replay.residue,
		})}\n`,
	);
}

if (process.argv[1]?.endsWith('dashboard-contacts-dependency-preflight.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
