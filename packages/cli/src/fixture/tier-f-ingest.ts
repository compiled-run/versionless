import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { decodePath, encodePath, getQuery, joinURL, parseURL, withQuery } from 'ufo';
import {
	BodyReadError,
	classifyAssets,
	findArchiveFile,
	indexTarGzip,
	inventoryLicensing,
	readCompleteBody,
	requireCompleteAssetClassifications,
	requireOfficialTreeInventory,
	requirePortableJson,
	requireRawArchiveMatch,
	requireRepeatedBodies,
	requireRootMitLicense,
	hashBytes,
	type ArchiveIndex,
	type CompleteBody,
} from '../../../core/src/corpus/tier-f-provenance.ts';

export const T092_CONSENT_ID = 'T092-official-source-react-angular-pair-global-pax-comment-ingest';
export const T094_CONSENT_ID = 'T094-official-source-react-dashboard-angular-fuxa-pair-ingest';
export const T104_CONSENT_ID = 'T104-official-source-codyogden-killedbygoogle-provenance-ingest';
export const T106_CONSENT_ID =
	'T106-official-source-codyogden-killedbygoogle-provenance-recovery-ingest';
export const T108_CONSENT_ID = 'T108-official-source-chatgptnextweb-nextchat-provenance-ingest';
export const T111_CONSENT_ID = 'T111-official-source-historical-nextjs-discovery-only';
export const T113_CONSENT_ID =
	'T113-official-source-codyogden-killedbygoogle-56809c31592e6ca1edce8af9bfe842fbcdf71f4d-historical-provenance-ingest';
export const T124_CONSENT_ID =
	'T124-official-source-codyogden-killedbygoogle-56809c31592e6ca1edce8af9bfe842fbcdf71f4d-historical-provenance-ingest';
export const T128_CONSENT_ID =
	'T128-official-source-codyogden-killedbygoogle-56809c31592e6ca1edce8af9bfe842fbcdf71f4d-historical-provenance-ingest';
export const T134_CONSENT_ID =
	'T134-official-source-next13-next14-ionic-angular-breadth-discovery-only';
export const T136_CONSENT_ID =
	'T136-official-source-timlrx-tailwind-nextjs-starter-blog-09ba0550caea03a8c38bc4878d05838d2a57f999-next13-provenance-ingest';
export const T138_CONSENT_ID =
	'T138-official-source-timlrx-tailwind-nextjs-starter-blog-09ba0550caea03a8c38bc4878d05838d2a57f999-next13-provenance-ingest';
export const T142_CONSENT_ID =
	'T142-official-source-timlrx-tailwind-nextjs-starter-blog-09ba0550caea03a8c38bc4878d05838d2a57f999-next13-provenance-ingest';
const consentExpiry = '2026-08-08T00:00:00Z';
const maximumRequests = 64;
const maximumResponseBytes = 32 * 1_024 * 1_024;
const maximumAggregateBytes = 256 * 1_024 * 1_024;
const allowedHosts = new Set([
	'api.github.com',
	'raw.githubusercontent.com',
	'codeload.github.com',
]);
export const T106_REQUIRED_PATHS = ['LICENSE', 'package.json', 'yarn.lock'] as const;
export const T108_ROOT_LICENSE_PATHS = ['LICENSE', 'LICENSE.md', 'LICENCE', 'LICENCE.md'] as const;
export const T124_REQUIRED_PATHS = [
	'.github/workflows/playwright.yml',
	'LICENSE',
	'components/Search/index.tsx',
	'next.config.js',
	'package.json',
	'pages/index.tsx',
	'yarn.lock',
] as const;
export const T136_REQUIRED_PATHS = [
	'.yarnrc.yml',
	'LICENSE',
	'app/api/newsletter2/route.ts',
	'app/blog/[...slug]/page.tsx',
	'app/layout.tsx',
	'next.config.js',
	'package.json',
	'yarn.lock',
] as const;
const root = path.resolve(import.meta.dirname, '../../../..');
export type FixtureId =
	| 'react-avataaars'
	| 'angular-contacts'
	| 'react-dashboard'
	| 'angular-fuxa'
	| 'next-killedbygoogle'
	| 'next-nextchat'
	| 'next-tailwind-starter-blog';
export type FixtureConfig = Readonly<{
	id: FixtureId;
	framework: 'react' | 'angular' | 'nextjs';
	owner: string;
	repository: string;
	commit: string;
	defaultBranch?: string;
	expectedTreeLead?: string;
	requiredPaths?: readonly string[];
	entryCandidates: readonly string[];
	configurationCandidates: readonly string[];
	journeyCandidates: readonly string[];
	nestedCompatibleLicensePath?: string;
	requireCommittedDistExclusion?: boolean;
	localityBoundaries?: readonly string[];
}>;

export type PairTaskDescriptor = Readonly<{
	taskId: 'T092' | 'T094';
	consentId: string;
	evidenceFileName: 't092-ingest.json' | 't094-ingest.json';
	stagingDirectory: 't092-pair' | 't094-pair';
	fixtureIds: readonly [FixtureId, FixtureId];
}>;

export type SingleTaskDescriptor =
	| Readonly<{
			taskId: 'T106';
			consentId: typeof T106_CONSENT_ID;
			evidenceFileName: 't106-ingest.json';
			stagingDirectory: 't106-next-killedbygoogle';
			fixtureIds: readonly ['next-killedbygoogle'];
			maximumRequests: 32;
			maximumAggregateBytes: number;
			maximumResponseBytes: number;
	  }>
	| Readonly<{
			taskId: 'T108';
			consentId: typeof T108_CONSENT_ID;
			evidenceFileName: 't108-ingest.json';
			stagingDirectory: 't108-next-nextchat';
			fixtureIds: readonly ['next-nextchat'];
			maximumRequests: 24;
			maximumAggregateBytes: number;
			maximumResponseBytes: number;
	  }>
	| Readonly<{
			taskId: 'T128';
			consentId: typeof T128_CONSENT_ID;
			evidenceFileName: 't128-ingest.json';
			stagingDirectory: 't128-next-killedbygoogle';
			fixtureIds: readonly ['next-killedbygoogle'];
			maximumRequests: 19;
			maximumAggregateBytes: number;
			maximumResponseBytes: number;
	  }>
	| Readonly<{
			taskId: 'T136';
			consentId: typeof T136_CONSENT_ID;
			evidenceFileName: 't136-ingest.json';
			stagingDirectory: 't136-next-tailwind-starter-blog';
			fixtureIds: readonly ['next-tailwind-starter-blog'];
			maximumRequests: 21;
			maximumAggregateBytes: number;
			maximumResponseBytes: number;
	  }>
	| Readonly<{
			taskId: 'T138';
			consentId: typeof T138_CONSENT_ID;
			evidenceFileName: 't138-ingest.json';
			stagingDirectory: 't138-next-tailwind-starter-blog';
			fixtureIds: readonly ['next-tailwind-starter-blog'];
			maximumRequests: 21;
			maximumAggregateBytes: number;
			maximumResponseBytes: number;
	  }>
	| Readonly<{
			taskId: 'T142';
			consentId: typeof T142_CONSENT_ID;
			evidenceFileName: 't142-ingest.json';
			stagingDirectory: 't142-next-tailwind-starter-blog';
			fixtureIds: readonly ['next-tailwind-starter-blog'];
			maximumRequests: 21;
			maximumAggregateBytes: number;
			maximumResponseBytes: number;
	  }>;

export type TaskDescriptor = PairTaskDescriptor | SingleTaskDescriptor;

export type CandidateDiscoveryConfig = Readonly<{
	phase: 'candidate-discovery';
	id: 'next-killedbygoogle' | 'next-nextchat';
	owner: 'codyogden' | 'ChatGPTNextWeb';
	repository: 'killedbygoogle' | 'NextChat';
	defaultBranch?: string;
}>;

type RequestFixture = FixtureConfig | CandidateDiscoveryConfig;

const fixtures: readonly FixtureConfig[] = [
	{
		id: 'react-avataaars',
		framework: 'react',
		owner: 'fangpenlin',
		repository: 'avataaars-generator',
		commit: 'c191c6c2d27f41245e803912d43c7213436a34d3',
		entryCandidates: ['src/index.tsx', 'src/index.ts', 'src/main.tsx', 'pages/index.tsx'],
		configurationCandidates: ['tsconfig.json', 'next.config.ts', 'next.config.js'],
		journeyCandidates: ['src/App.tsx', 'src/App.ts', 'pages/index.tsx'],
	},
	{
		id: 'angular-contacts',
		framework: 'angular',
		owner: 'avatsaev',
		repository: 'angular-contacts-app-example',
		commit: '875aa2df7f5f87b6731a1259b63e2b399fa5fb3f',
		entryCandidates: ['src/main.ts'],
		configurationCandidates: ['angular.json', '.angular-cli.json', 'tsconfig.json'],
		journeyCandidates: [
			'src/app/app.component.ts',
			'src/app/contacts/contacts.component.ts',
			'src/app/contact-list/contact-list.component.ts',
		],
	},
	{
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
		localityBoundaries: [
			'Server packages are outside the local browser-only usable closure.',
			'Optional remote widgets remain locality blockers until independently intercepted and tested.',
		],
	},
	{
		id: 'angular-fuxa',
		framework: 'angular',
		owner: 'frangoteam',
		repository: 'FUXA',
		commit: '8b323c177615c0d152a54e5ef0a6f98dae7b8ff0',
		expectedTreeLead: '6c9f146b3292a3795d5ae35c53c0f39f0fc0b490',
		requiredPaths: [
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
		],
		entryCandidates: ['client/src/main.ts'],
		configurationCandidates: ['client/angular.json'],
		journeyCandidates: [
			'client/src/app/app.routing.ts',
			'client/src/app/editor/editor.component.html',
			'client/src/app/editor/editor.component.ts',
		],
		nestedCompatibleLicensePath: 'server/runtime/jobs/fonts/LICENSE.txt',
		requireCommittedDistExclusion: true,
		localityBoundaries: [
			'The Node server, industrial protocols, devices, and network egress are outside the usable closure.',
			'Bundled fonts retain their independent Apache-2.0 notice boundary.',
		],
	},
	{
		id: 'next-killedbygoogle',
		framework: 'nextjs',
		owner: 'codyogden',
		repository: 'killedbygoogle',
		commit: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
		expectedTreeLead: 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763',
		requiredPaths: T124_REQUIRED_PATHS,
		entryCandidates: ['pages/index.tsx', 'pages/index.ts', 'pages/index.jsx', 'pages/index.js'],
		configurationCandidates: [
			'next.config.ts',
			'next.config.js',
			'next.config.mjs',
			'tsconfig.json',
		],
		journeyCandidates: [
			'pages/index.tsx',
			'pages/index.ts',
			'pages/index.jsx',
			'pages/index.js',
		],
		localityBoundaries: [
			'No candidate code, dependency, script, server, API route, browser journey, or outbound behavior was executed.',
			'Next.js runtime, compiler, bundler, routing, rendering, image, data, and server boundaries remain not-tested.',
		],
	},
	{
		id: 'next-nextchat',
		framework: 'nextjs',
		owner: 'ChatGPTNextWeb',
		repository: 'NextChat',
		commit: '',
		entryCandidates: [],
		configurationCandidates: [],
		journeyCandidates: [],
		localityBoundaries: [
			'No candidate code, dependency, script, server, API route, browser journey, or outbound behavior was executed.',
			'Next.js routing, rendering, server, API, model, data, image, compiler, bundler, Node, and locality boundaries remain not-tested.',
		],
	},
	{
		id: 'next-tailwind-starter-blog',
		framework: 'nextjs',
		owner: 'timlrx',
		repository: 'tailwind-nextjs-starter-blog',
		commit: '09ba0550caea03a8c38bc4878d05838d2a57f999',
		expectedTreeLead: '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf',
		requiredPaths: T136_REQUIRED_PATHS,
		entryCandidates: ['app/layout.tsx'],
		configurationCandidates: ['next.config.js'],
		journeyCandidates: ['app/blog/[...slug]/page.tsx'],
		localityBoundaries: [
			'No candidate code, dependency, script, server, API route, browser journey, or outbound behavior was executed.',
			'Newsletter, remote resources, server, authentication, payment, analytics, telemetry, and egress remain not-tested.',
		],
	},
] as const;

export const pairTaskDescriptors: readonly PairTaskDescriptor[] = [
	{
		taskId: 'T092',
		consentId: T092_CONSENT_ID,
		evidenceFileName: 't092-ingest.json',
		stagingDirectory: 't092-pair',
		fixtureIds: ['react-avataaars', 'angular-contacts'],
	},
	{
		taskId: 'T094',
		consentId: T094_CONSENT_ID,
		evidenceFileName: 't094-ingest.json',
		stagingDirectory: 't094-pair',
		fixtureIds: ['react-dashboard', 'angular-fuxa'],
	},
] as const;

export const t106TaskDescriptor: SingleTaskDescriptor = {
	taskId: 'T106',
	consentId: T106_CONSENT_ID,
	evidenceFileName: 't106-ingest.json',
	stagingDirectory: 't106-next-killedbygoogle',
	fixtureIds: ['next-killedbygoogle'],
	maximumRequests: 32,
	maximumAggregateBytes: 128 * 1_024 * 1_024,
	maximumResponseBytes,
};

export const t108TaskDescriptor: SingleTaskDescriptor = {
	taskId: 'T108',
	consentId: T108_CONSENT_ID,
	evidenceFileName: 't108-ingest.json',
	stagingDirectory: 't108-next-nextchat',
	fixtureIds: ['next-nextchat'],
	maximumRequests: 24,
	maximumAggregateBytes: 128 * 1_024 * 1_024,
	maximumResponseBytes,
};

export const t128TaskDescriptor: SingleTaskDescriptor = {
	taskId: 'T128',
	consentId: T128_CONSENT_ID,
	evidenceFileName: 't128-ingest.json',
	stagingDirectory: 't128-next-killedbygoogle',
	fixtureIds: ['next-killedbygoogle'],
	maximumRequests: 19,
	maximumAggregateBytes: 32 * 1_024 * 1_024,
	maximumResponseBytes: 8 * 1_024 * 1_024,
};

export const t136TaskDescriptor: SingleTaskDescriptor = {
	taskId: 'T136',
	consentId: T136_CONSENT_ID,
	evidenceFileName: 't136-ingest.json',
	stagingDirectory: 't136-next-tailwind-starter-blog',
	fixtureIds: ['next-tailwind-starter-blog'],
	maximumRequests: 21,
	maximumAggregateBytes: 32 * 1_024 * 1_024,
	maximumResponseBytes: 8 * 1_024 * 1_024,
};

export const t138TaskDescriptor: SingleTaskDescriptor = {
	taskId: 'T138',
	consentId: T138_CONSENT_ID,
	evidenceFileName: 't138-ingest.json',
	stagingDirectory: 't138-next-tailwind-starter-blog',
	fixtureIds: ['next-tailwind-starter-blog'],
	maximumRequests: 21,
	maximumAggregateBytes: 32 * 1_024 * 1_024,
	maximumResponseBytes: 8 * 1_024 * 1_024,
};

export const t142TaskDescriptor: SingleTaskDescriptor = {
	taskId: 'T142',
	consentId: T142_CONSENT_ID,
	evidenceFileName: 't142-ingest.json',
	stagingDirectory: 't142-next-tailwind-starter-blog',
	fixtureIds: ['next-tailwind-starter-blog'],
	maximumRequests: 21,
	maximumAggregateBytes: 32 * 1_024 * 1_024,
	maximumResponseBytes: 8 * 1_024 * 1_024,
};

export type LedgerRecord = Readonly<{
	sequence: number;
	fixture: FixtureId;
	name: string;
	host: string;
	url: string;
	method?: 'GET';
	result: 'pass' | 'fail';
	outcome:
		| 'success'
		| 'http-failure'
		| 'redirect-refusal'
		| 'content-length-mismatch'
		| 'stream-failure'
		| 'response-limit'
		| 'aggregate-limit'
		| 'transport-failure'
		| 'response-policy-refusal';
	httpStatus: number | null;
	receivedBytes: number;
	bodyComplete: boolean;
	timestamp?: string;
	contentEncoding?: string;
	disposition?: 'accepted-complete-body' | 'refused-terminal-body';
	byteLength?: number;
	sha256?: string;
}>;

export type NetworkState = {
	attempts: number;
	completedBytes: number;
	ledger: LedgerRecord[];
	emit: (record: LedgerRecord) => void;
	maximumRequests: number;
	maximumAggregateBytes: number;
};

export type AcquiredBody = CompleteBody & Readonly<{ ledgerSequence: number }>;

type TreeRow = Readonly<{ path: string; mode: string; type: string; sha: string }>;

function canonical(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

export function assertConsent(
	consentId: string | undefined,
	descriptor: TaskDescriptor = pairTaskDescriptors[0]!,
): void {
	if (
		consentId === T104_CONSENT_ID ||
		consentId === T106_CONSENT_ID ||
		consentId === T108_CONSENT_ID ||
		consentId === T111_CONSENT_ID ||
		consentId === T113_CONSENT_ID ||
		consentId === T124_CONSENT_ID ||
		consentId === T128_CONSENT_ID ||
		consentId === T134_CONSENT_ID ||
		consentId === T136_CONSENT_ID ||
		consentId === T138_CONSENT_ID ||
		consentId === T142_CONSENT_ID ||
		descriptor.taskId === 'T106' ||
		descriptor.taskId === 'T108' ||
		descriptor.taskId === 'T128' ||
		descriptor.taskId === 'T136' ||
		descriptor.taskId === 'T138' ||
		descriptor.taskId === 'T142'
	)
		throw new Error(
			'Consumed T104, T106, T108, T111, T113, T124, T128, T134, T136, T138, and T142 consents are permanently refused before GET',
		);
	if (
		consentId !== descriptor.consentId ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== descriptor.consentId
	)
		throw new Error('Fixture ingest requires literal task-and-scope consent equality');
	if (Date.now() >= Date.parse(consentExpiry)) throw new Error('Pair-ingest consent has expired');
}

export function assertAllowedUrl(url: string, fixture: RequestFixture): string {
	const parsed = parseURL(url);
	if (parsed.protocol !== 'https:' || !parsed.host || !allowedHosts.has(parsed.host))
		throw new Error('Request host is outside fixture-ingest consent');
	const pathname = parsed.pathname ?? '';
	const apiPrefix = `/repos/${fixture.owner}/${fixture.repository}`;
	const query = getQuery(url);
	const queryKeys = Object.keys(query);
	const noQuery = queryKeys.length === 0;
	if ('phase' in fixture) {
		const allowedDiscoveryPath =
			pathname === apiPrefix ||
			(fixture.defaultBranch !== undefined &&
				pathname === `${apiPrefix}/commits/${fixture.defaultBranch}`);
		if (parsed.host !== 'api.github.com' || !noQuery || !allowedDiscoveryPath)
			throw new Error('Request path is outside exact candidate-discovery path families');
		return parsed.host;
	}
	if (
		fixture.id === 'next-killedbygoogle' &&
		JSON.stringify(fixture.requiredPaths) !== JSON.stringify(T124_REQUIRED_PATHS)
	)
		throw new Error('T124 raw corroboration scope must be the exact seven sorted paths');
	if (
		fixture.id === 'next-tailwind-starter-blog' &&
		JSON.stringify(fixture.requiredPaths) !== JSON.stringify(T136_REQUIRED_PATHS)
	)
		throw new Error('T136 raw corroboration scope must be the exact eight sorted paths');
	if (fixture.id === 'next-nextchat' && parsed.host === 'raw.githubusercontent.com')
		requireT108RequiredPaths(fixture.requiredPaths);
	const rawPrefix = `/${fixture.owner}/${fixture.repository}/${fixture.commit}/`;
	const archivePath = `/${fixture.owner}/${fixture.repository}/tar.gz/${fixture.commit}`;
	const exactTreeQuery = queryKeys.length === 1 && query.recursive === '1';
	const treePrefix = `${apiPrefix}/git/trees/`;
	const treeIdentity = pathname.startsWith(treePrefix) ? pathname.slice(treePrefix.length) : '';
	const exactTreeIdentity =
		treeIdentity.length === 40 &&
		[...treeIdentity].every(
			(character) =>
				(character >= '0' && character <= '9') || (character >= 'a' && character <= 'f'),
		);
	const expectedTreeIdentity =
		exactTreeIdentity &&
		(fixture.expectedTreeLead === undefined || treeIdentity === fixture.expectedTreeLead);
	const decodedPathname = decodePath(pathname);
	const rawPath = decodedPathname.startsWith(rawPrefix)
		? decodedPathname.slice(rawPrefix.length)
		: '';
	const exactRawPath =
		decodedPathname.startsWith(rawPrefix) &&
		(fixture.requiredPaths === undefined || fixture.requiredPaths.includes(rawPath)) &&
		(fixture.id !== 'next-tailwind-starter-blog' ||
			pathname === `${rawPrefix}${encodePath(rawPath)}`);
	const allowed =
		(parsed.host === 'api.github.com' &&
			((noQuery &&
				(pathname === apiPrefix ||
					pathname === `${apiPrefix}/commits/${fixture.commit}`)) ||
				(expectedTreeIdentity && exactTreeQuery))) ||
		(parsed.host === 'raw.githubusercontent.com' && noQuery && exactRawPath) ||
		(parsed.host === 'codeload.github.com' && noQuery && pathname === archivePath);
	if (!allowed) throw new Error('Request path is outside immutable fixture-ingest path families');
	return parsed.host;
}

export function createNetworkState(
	emit?: (record: LedgerRecord) => void,
	limits: Readonly<{ maximumRequests: number; maximumAggregateBytes: number }> = {
		maximumRequests,
		maximumAggregateBytes,
	},
): NetworkState {
	return {
		attempts: 0,
		completedBytes: 0,
		ledger: [],
		maximumRequests: limits.maximumRequests,
		maximumAggregateBytes: limits.maximumAggregateBytes,
		emit:
			emit ??
			((record) => {
				process.stderr.write(`${JSON.stringify({ immutablePairRequestLedger: record })}\n`);
			}),
	};
}

function emitTerminal(state: NetworkState, record: LedgerRecord): void {
	const immutableRecord = Object.freeze(record);
	state.ledger.push(immutableRecord);
	state.emit(immutableRecord);
}

function contentLength(headers: Headers): number | undefined {
	const value = headers.get('content-length');
	if (value === null) return undefined;
	const normalized = value.trim();
	if (!normalized || ![...normalized].every((character) => character >= '0' && character <= '9'))
		throw new Error('Invalid Content-Length response header');
	const length = Number(normalized);
	if (!Number.isSafeInteger(length)) throw new Error('Invalid Content-Length response header');
	return length;
}

export async function acquire(
	state: NetworkState,
	fixture: RequestFixture,
	name: string,
	url: string,
	fetchImplementation: typeof fetch = fetch,
	limits: Readonly<{
		maximumResponseBytes: number;
		maximumAggregateBytes: number;
	}> = { maximumResponseBytes, maximumAggregateBytes: state.maximumAggregateBytes },
): Promise<AcquiredBody> {
	const host = assertAllowedUrl(url, fixture);
	if (state.attempts >= state.maximumRequests)
		throw new Error('Fixture-ingest request limit exhausted');
	const sequence = ++state.attempts;
	let terminal = false;
	let status: number | null = null;
	let receivedBytes = 0;
	let responseEncoding = 'unavailable';
	const fail = (
		outcome: Exclude<LedgerRecord['outcome'], 'success'>,
		message: string,
		bodyComplete = false,
	): Error => {
		if (terminal) return new Error(message);
		terminal = true;
		emitTerminal(state, {
			sequence,
			fixture: fixture.id,
			name,
			host,
			url,
			method: 'GET',
			result: 'fail',
			outcome,
			httpStatus: status,
			receivedBytes,
			bodyComplete,
			timestamp: new Date().toISOString(),
			contentEncoding: responseEncoding,
			disposition: 'refused-terminal-body',
		});
		return new Error(message);
	};
	try {
		const response = await fetchImplementation(url, {
			method: 'GET',
			redirect: 'manual',
			credentials: 'omit',
			headers: { Accept: 'application/vnd.github+json', 'Accept-Encoding': 'identity' },
		});
		status = response.status;
		if (response.status >= 300 && response.status < 400)
			throw fail('redirect-refusal', 'Redirect refused');
		if (response.status !== 200 || !response.body)
			throw fail('http-failure', `Official-source request failed with ${response.status}`);
		const encoding = response.headers.get('content-encoding');
		responseEncoding = encoding ?? 'identity';
		if (encoding && encoding !== 'identity')
			throw fail('response-policy-refusal', 'Response content decoding refused');
		let declaredLength: number | undefined;
		try {
			declaredLength = contentLength(response.headers);
		} catch (error) {
			throw fail('response-policy-refusal', (error as Error).message);
		}
		const reader = response.body.getReader();
		async function* responseChunks(): AsyncIterable<Uint8Array> {
			try {
				while (true) {
					const value = await reader.read();
					if (value.done) return;
					yield value.value;
				}
			} finally {
				reader.releaseLock();
			}
		}
		let body: CompleteBody;
		try {
			body = await readCompleteBody(
				responseChunks(),
				limits.maximumResponseBytes,
				(count) => {
					receivedBytes = count;
				},
			);
		} catch (error) {
			if (error instanceof BodyReadError) throw fail(error.kind, error.message);
			throw error;
		}
		receivedBytes = body.byteLength;
		if (declaredLength !== undefined && declaredLength !== body.byteLength)
			throw fail(
				'content-length-mismatch',
				'Content-Length does not match the complete response body',
				true,
			);
		if (state.completedBytes + body.byteLength > limits.maximumAggregateBytes)
			throw fail('aggregate-limit', 'Fixture-ingest aggregate transfer limit exceeded', true);
		state.completedBytes += body.byteLength;
		terminal = true;
		emitTerminal(state, {
			sequence,
			fixture: fixture.id,
			name,
			host,
			url,
			method: 'GET',
			result: 'pass',
			outcome: 'success',
			httpStatus: response.status,
			receivedBytes: body.byteLength,
			bodyComplete: true,
			timestamp: new Date().toISOString(),
			contentEncoding: responseEncoding,
			disposition: 'accepted-complete-body',
			byteLength: body.byteLength,
			sha256: body.sha256,
		});
		return { ...body, ledgerSequence: sequence };
	} catch (error) {
		if (terminal) throw error;
		throw fail('transport-failure', error instanceof Error ? error.message : String(error));
	}
}

export function reconcileNetworkState(state: NetworkState) {
	if (state.attempts !== state.ledger.length)
		throw new Error('Pair-ingest request-attempt and terminal-ledger counts differ');
	if (state.ledger.some((record, index) => record.sequence !== index + 1))
		throw new Error('Pair-ingest request ledger has a duplicate or missing sequence');
	for (const record of state.ledger) {
		if (
			(record.result === 'pass' &&
				(!record.bodyComplete ||
					record.byteLength === undefined ||
					record.sha256 === undefined ||
					record.receivedBytes !== record.byteLength)) ||
			(record.result === 'fail' &&
				(record.byteLength !== undefined || record.sha256 !== undefined))
		)
			throw new Error('Pair-ingest terminal ledger success/failure fields are inconsistent');
	}
	const successful = state.ledger.filter(
		(record): record is LedgerRecord & Required<Pick<LedgerRecord, 'byteLength' | 'sha256'>> =>
			record.result === 'pass' &&
			record.byteLength !== undefined &&
			record.sha256 !== undefined,
	);
	const completedBytes = successful.reduce((sum, record) => sum + record.byteLength, 0);
	if (state.completedBytes !== completedBytes)
		throw new Error('Pair-ingest completed-body byte reconciliation failed');
	const perHost = Object.fromEntries(
		[...allowedHosts]
			.sort((left, right) => left.localeCompare(right))
			.map((host) => {
				const records = successful.filter((record) => record.host === host);
				return [
					host,
					{
						attempts: state.ledger.filter((record) => record.host === host).length,
						completedBodies: records.length,
						bytes: records.reduce((sum, record) => sum + record.byteLength, 0),
					},
				];
			}),
	);
	return {
		attempts: state.attempts,
		completedBodies: successful.length,
		completedBytes,
		perHost,
	};
}

export function parseLedgeredJson(
	body: AcquiredBody,
	state: NetworkState,
	label: string,
): Record<string, unknown> {
	const record = state.ledger[body.ledgerSequence - 1];
	if (
		!record ||
		record.sequence !== body.ledgerSequence ||
		record.result !== 'pass' ||
		record.sha256 !== body.sha256
	)
		throw new Error(`${label} cannot be parsed before its successful terminal ledger record`);
	try {
		return JSON.parse(body.bytes.toString('utf8')) as Record<string, unknown>;
	} catch {
		throw new Error(`${label} is not complete JSON`);
	}
}

function requireT108RequiredPaths(paths: readonly string[] | undefined): readonly string[] {
	if (!paths || paths.length !== 2 || new Set(paths).size !== 2)
		throw new Error('T108 raw corroboration scope must contain exactly two unique root paths');
	const licensePaths = paths.filter((candidate) =>
		T108_ROOT_LICENSE_PATHS.includes(candidate as (typeof T108_ROOT_LICENSE_PATHS)[number]),
	);
	const expected = [...licensePaths, 'package.json'].sort((left, right) =>
		left.localeCompare(right),
	);
	if (licensePaths.length !== 1 || JSON.stringify(paths) !== JSON.stringify(expected))
		throw new Error(
			'T108 raw corroboration scope must be sorted root package.json plus exactly one allowlisted root MIT license',
		);
	return paths;
}

export function selectT108RequiredPaths(tree: readonly TreeRow[]): string[] {
	const blobPaths = tree.filter((row) => row.type === 'blob').map((row) => row.path);
	if (blobPaths.filter((candidate) => candidate === 'package.json').length !== 1)
		throw new Error('next-nextchat requires exactly one root package.json');
	const licenses = T108_ROOT_LICENSE_PATHS.filter(
		(candidate) => blobPaths.filter((pathValue) => pathValue === candidate).length === 1,
	);
	if (licenses.length !== 1)
		throw new Error('next-nextchat requires exactly one allowlisted root MIT license path');
	const selected = [licenses[0]!, 'package.json'].sort((left, right) =>
		left.localeCompare(right),
	);
	return [...requireT108RequiredPaths(selected)];
}

export function selectRequiredPaths(config: FixtureConfig, tree: readonly TreeRow[]): string[] {
	const paths = new Set(tree.filter((row) => row.type === 'blob').map((row) => row.path));
	if (
		config.id === 'next-killedbygoogle' &&
		JSON.stringify(config.requiredPaths) !== JSON.stringify(T124_REQUIRED_PATHS)
	)
		throw new Error('T124 relied paths must be exactly the seven approved sorted paths');
	if (config.id === 'next-killedbygoogle') {
		for (const requiredPath of T124_REQUIRED_PATHS)
			if (!paths.has(requiredPath))
				throw new Error(`${config.id} lacks required path ${requiredPath}`);
		return [...T124_REQUIRED_PATHS];
	}
	if (config.id === 'next-tailwind-starter-blog') {
		if (JSON.stringify(config.requiredPaths) !== JSON.stringify(T136_REQUIRED_PATHS))
			throw new Error('T136 relied paths must be exactly the eight approved ordered paths');
		for (const requiredPath of T136_REQUIRED_PATHS)
			if (!paths.has(requiredPath))
				throw new Error(`${config.id} lacks required path ${requiredPath}`);
		return [...T136_REQUIRED_PATHS];
	}
	if (config.id === 'next-nextchat') {
		const selected = selectT108RequiredPaths(tree);
		if (
			config.requiredPaths !== undefined &&
			JSON.stringify(config.requiredPaths) !== JSON.stringify(selected)
		)
			throw new Error('T108 relied paths differ from the exact dynamic root selection');
		return selected;
	}
	if (config.requiredPaths) {
		for (const requiredPath of config.requiredPaths)
			if (!paths.has(requiredPath))
				throw new Error(`${config.id} lacks required path ${requiredPath}`);
		return [...config.requiredPaths].sort((left, right) => left.localeCompare(right));
	}
	const choose = (candidates: readonly string[], label: string): string => {
		const selected = candidates.find((candidate) => paths.has(candidate));
		if (!selected) throw new Error(`${config.id} lacks required ${label}`);
		return selected;
	};
	const license = choose(['LICENSE', 'LICENSE.md', 'LICENCE', 'LICENCE.md'], 'root license');
	const manifest = choose(['package.json'], 'package manifest');
	const lock = choose(['yarn.lock', 'package-lock.json', 'pnpm-lock.yaml'], 'committed lock');
	const entry = choose(config.entryCandidates, 'entrypoint');
	const configuration = choose(config.configurationCandidates, 'framework configuration');
	let journey = config.journeyCandidates.find((candidate) => paths.has(candidate));
	if (!journey) {
		journey = [...paths]
			.filter(
				(candidate) =>
					candidate.startsWith('src/') &&
					(candidate.endsWith('.ts') || candidate.endsWith('.tsx')) &&
					candidate !== entry,
			)
			.sort((left, right) => left.localeCompare(right))[0];
	}
	if (!journey) throw new Error(`${config.id} lacks a journey/mutation source`);
	return [...new Set([license, manifest, lock, entry, configuration, journey])].sort((a, b) =>
		a.localeCompare(b),
	);
}

export type T138RequestPlanEntry = Readonly<{ name: string; url: string }>;

function requireT138Config(config: FixtureConfig): void {
	if (
		config.id !== 'next-tailwind-starter-blog' ||
		config.owner !== 'timlrx' ||
		config.repository !== 'tailwind-nextjs-starter-blog' ||
		config.commit !== '09ba0550caea03a8c38bc4878d05838d2a57f999' ||
		config.expectedTreeLead !== '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf' ||
		JSON.stringify(config.requiredPaths) !== JSON.stringify(T136_REQUIRED_PATHS)
	)
		throw new Error('T138 requires exactly the authorized immutable subject and path order');
}

export function createT138RequestPlan(
	config: FixtureConfig,
	reliedPaths: readonly string[],
): readonly T138RequestPlanEntry[] {
	requireT138Config(config);
	if (
		JSON.stringify(reliedPaths) !== JSON.stringify(T136_REQUIRED_PATHS) ||
		new Set(reliedPaths).size !== T136_REQUIRED_PATHS.length
	)
		throw new Error('T138 request plan requires the exact eight literal ordered paths');
	const apiBase = joinURL('https://api.github.com', 'repos', config.owner, config.repository);
	const archiveUrl = joinURL(
		'https://codeload.github.com',
		config.owner,
		config.repository,
		'tar.gz',
		config.commit,
	);
	const plan: T138RequestPlanEntry[] = [
		{ name: 'repository-metadata', url: apiBase },
		{ name: 'commit-metadata', url: joinURL(apiBase, 'commits', config.commit) },
		{
			name: 'tree-metadata',
			url: withQuery(
				joinURL(apiBase, 'git', 'trees', '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf'),
				{
					recursive: '1',
				},
			),
		},
		{ name: 'archive-copy-1', url: archiveUrl },
		{ name: 'archive-copy-2', url: archiveUrl },
		...reliedPaths.flatMap((reliedPath) => {
			const rawUrl = joinURL(
				'https://raw.githubusercontent.com',
				config.owner,
				config.repository,
				config.commit,
				encodePath(reliedPath),
			);
			return [
				{ name: `raw-copy-1:${reliedPath}`, url: rawUrl },
				{ name: `raw-copy-2:${reliedPath}`, url: rawUrl },
			];
		}),
	];
	if (plan.length !== 21) throw new Error('T138 request plan must contain exactly 21 GETs');
	for (const entry of plan) assertAllowedUrl(entry.url, config);
	const dynamicUrl = plan.find(
		(entry) => entry.name === 'raw-copy-1:app/blog/[...slug]/page.tsx',
	)?.url;
	if (
		!dynamicUrl?.includes('/app/blog/%5B...slug%5D/page.tsx') ||
		dynamicUrl.includes('[...slug]') ||
		dynamicUrl.includes('%5b') ||
		dynamicUrl.includes('%5d')
	)
		throw new Error('T138 dynamic route must use exact uppercase bracket encoding');
	return Object.freeze(plan.map((entry) => Object.freeze(entry)));
}

function isCommittedDistPath(file: string): boolean {
	return path.normalize(file).split('/').includes('dist');
}

export function inspectFixtureBoundaries(index: ArchiveIndex, config: FixtureConfig) {
	const compatibleNotice = config.nestedCompatibleLicensePath
		? findArchiveFile(index, config.nestedCompatibleLicensePath)
		: undefined;
	if (compatibleNotice) {
		const text = compatibleNotice.bytes.toString('utf8');
		if (
			!text.includes('Apache License') ||
			!text.includes('Version 2.0, January 2004') ||
			!text.includes('http://www.apache.org/licenses/')
		)
			throw new Error('Nested font notice is not the preserved Apache-2.0 license text');
	}
	const excludedCommittedDist = index.files
		.filter((file) => isCommittedDistPath(file.path))
		.map((file) => ({
			path: file.path,
			sha256: file.sha256,
			classification: 'excluded' as const,
		}));
	if (config.requireCommittedDistExclusion && excludedCommittedDist.length === 0)
		throw new Error('Required committed dist boundary is absent');
	return { compatibleNotice, excludedCommittedDist };
}

function licensingInventory(index: ArchiveIndex, config: FixtureConfig, rootLicensePath: string) {
	return inventoryLicensing(index).map((file) => ({
		path: file.path,
		sha256: file.sha256,
		classification:
			file.path === rootLicensePath
				? 'verified-compatible'
				: file.path === config.nestedCompatibleLicensePath
					? 'preserved-compatible-notice'
					: 'unknown',
		reason:
			file.path === rootLicensePath
				? 'Exact root MIT text, repeated raw/archive byte identity.'
				: file.path === config.nestedCompatibleLicensePath
					? 'Exact nested Apache-2.0 font notice is preserved independently from root MIT scope.'
					: 'Nested, attribution, vendor, or generated material remains independently unverified.',
	}));
}

function fileManifest(index: ArchiveIndex) {
	return index.files.map((file) => ({
		path: file.path,
		byteLength: file.byteLength,
		sha256: file.sha256,
	}));
}

function isLowercaseCommit(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length === 40 &&
		[...value].every(
			(character) =>
				(character >= '0' && character <= '9') || (character >= 'a' && character <= 'f'),
		)
	);
}

function requireExactTreeRows(
	tree: readonly TreeRow[],
	expectedRows: number,
	taskId: 'T124' | 'T136' | 'T138',
): void {
	if (tree.length !== expectedRows)
		throw new Error(`${taskId} recursive tree must contain exactly ${expectedRows} rows`);
	if (new Set(tree.map((row) => row.path)).size !== tree.length)
		throw new Error(`${taskId} recursive tree contains duplicate paths`);
	if (
		tree.some((row) => {
			const segments = typeof row.path === 'string' ? row.path.split('/') : [];
			return (
				!row.path ||
				path.isAbsolute(row.path) ||
				row.path.includes('\\') ||
				segments.some((segment) => !segment || segment === '.' || segment === '..') ||
				(row.type !== 'blob' && row.type !== 'tree') ||
				!isLowercaseCommit(row.sha) ||
				(row.type === 'tree'
					? row.mode !== '040000'
					: row.mode !== '100644' && row.mode !== '100755')
			);
		})
	)
		throw new Error(`${taskId} recursive tree contains malformed or unsupported rows`);
}

export function createT138SyntheticTree(): TreeRow[] {
	const reliedRows = T136_REQUIRED_PATHS.map((filePath, index) => ({
		path: filePath,
		mode: '100644',
		type: 'blob',
		sha: index.toString(16).padStart(40, 'a'),
	}));
	const fillerRows = Array.from({ length: 130 }, (_, index) => ({
		path: `synthetic/preflight-${String(index).padStart(3, '0')}.ts`,
		mode: '100644',
		type: 'blob',
		sha: (index + T136_REQUIRED_PATHS.length).toString(16).padStart(40, 'b'),
	}));
	return [...reliedRows, ...fillerRows];
}

export function runT138ProductionPreflight(
	config: FixtureConfig,
	tree: readonly TreeRow[] = createT138SyntheticTree(),
): readonly T138RequestPlanEntry[] {
	requireT138Config(config);
	requireExactTreeRows(tree, 138, 'T138');
	if (tree.some((row) => row.type !== 'blob'))
		throw new Error('T138 synthetic preflight requires exactly 138 blob rows');
	const selected = selectRequiredPaths(config, tree);
	if (JSON.stringify(selected) !== JSON.stringify(T136_REQUIRED_PATHS))
		throw new Error('T138 selector changed the literal eight-path order');
	return createT138RequestPlan(config, selected);
}

function requireDefaultBranch(value: unknown): string {
	if (
		typeof value !== 'string' ||
		!value ||
		![...value].every(
			(character) =>
				(character >= '0' && character <= '9') ||
				(character >= 'A' && character <= 'Z') ||
				(character >= 'a' && character <= 'z') ||
				character === '-' ||
				character === '_' ||
				character === '.',
		)
	)
		throw new Error('Default branch is absent or outside the exact portable branch model');
	return value;
}

function nextMajor(version: unknown): number | undefined {
	if (typeof version !== 'string') return undefined;
	const start = [...version].findIndex((character) => character >= '0' && character <= '9');
	if (start === -1) return undefined;
	let digits = '';
	for (const character of version.slice(start)) {
		if (character < '0' || character > '9') break;
		digits += character;
	}
	return digits ? Number(digits) : undefined;
}

const t108Lead: CandidateDiscoveryConfig = {
	phase: 'candidate-discovery',
	id: 'next-nextchat',
	owner: 'ChatGPTNextWeb',
	repository: 'NextChat',
};
const t108Template = fixtures.find((fixture) => fixture.id === 'next-nextchat')!;

export async function resolveT106Candidate(
	state: NetworkState,
	fetchImplementation: typeof fetch = fetch,
): Promise<FixtureConfig> {
	void state;
	void fetchImplementation;
	throw new Error('Consumed T104 and T106 consents are permanently refused before GET');
}

export async function resolveT108Candidate(
	state: NetworkState,
	fetchImplementation: typeof fetch = fetch,
): Promise<FixtureConfig> {
	const apiBase = joinURL('https://api.github.com', 'repos', t108Lead.owner, t108Lead.repository);
	const repositoryFirst = await acquire(
		state,
		t108Lead,
		'repository-metadata-copy-1',
		apiBase,
		fetchImplementation,
	);
	const repositorySecond = await acquire(
		state,
		t108Lead,
		'repository-metadata-copy-2',
		apiBase,
		fetchImplementation,
	);
	requireRepeatedBodies(repositoryFirst, repositorySecond);
	const repository = parseLedgeredJson(repositoryFirst, state, 'repository metadata');
	if (repository.full_name !== 'ChatGPTNextWeb/NextChat')
		throw new Error('T108 repository identity mismatch');
	const defaultBranch = requireDefaultBranch(repository.default_branch);
	const branchLead: CandidateDiscoveryConfig = { ...t108Lead, defaultBranch };
	const headUrl = joinURL(apiBase, 'commits', defaultBranch);
	const headFirst = await acquire(
		state,
		branchLead,
		'default-branch-head-copy-1',
		headUrl,
		fetchImplementation,
	);
	const headSecond = await acquire(
		state,
		branchLead,
		'default-branch-head-copy-2',
		headUrl,
		fetchImplementation,
	);
	requireRepeatedBodies(headFirst, headSecond);
	const head = parseLedgeredJson(headFirst, state, 'default-branch HEAD metadata');
	if (!isLowercaseCommit(head.sha))
		throw new Error('Repeated T108 default-branch HEAD is not one lowercase immutable commit');
	const preliminary: FixtureConfig = { ...t108Template, defaultBranch, commit: head.sha };
	const commitUrl = joinURL(apiBase, 'commits', preliminary.commit);
	const commitFirst = await acquire(
		state,
		preliminary,
		'immutable-commit-metadata-copy-1',
		commitUrl,
		fetchImplementation,
	);
	const commitSecond = await acquire(
		state,
		preliminary,
		'immutable-commit-metadata-copy-2',
		commitUrl,
		fetchImplementation,
	);
	requireRepeatedBodies(commitFirst, commitSecond);
	const commit = parseLedgeredJson(commitFirst, state, 'immutable commit metadata');
	if (commit.sha !== preliminary.commit)
		throw new Error('T108 immutable commit metadata rebinding refused');
	const commitValue = commit.commit as Record<string, unknown> | undefined;
	const treeValue = commitValue?.tree as Record<string, unknown> | undefined;
	const treeSha = treeValue?.sha;
	if (!isLowercaseCommit(treeSha)) throw new Error('T108 immutable commit tree identity missing');
	const treeUrl = withQuery(joinURL(apiBase, 'git', 'trees', treeSha), { recursive: '1' });
	const treeFirst = await acquire(
		state,
		preliminary,
		'tree-metadata-copy-1',
		treeUrl,
		fetchImplementation,
	);
	const treeSecond = await acquire(
		state,
		preliminary,
		'tree-metadata-copy-2',
		treeUrl,
		fetchImplementation,
	);
	requireRepeatedBodies(treeFirst, treeSecond);
	const tree = parseLedgeredJson(treeFirst, state, 'tree metadata');
	if (tree.sha !== treeSha || tree.truncated === true)
		throw new Error('Repeated T108 immutable tree metadata is rebound or truncated');
	if (!Array.isArray(tree.tree)) throw new Error('T108 tree rows missing');
	const requiredPaths = selectT108RequiredPaths(tree.tree as TreeRow[]);
	return { ...preliminary, requiredPaths };
}

export function requireT106PackageFacts(index: ArchiveIndex): void {
	const manifest = JSON.parse(findArchiveFile(index, 'package.json').bytes.toString('utf8')) as {
		dependencies?: Record<string, unknown>;
		devDependencies?: Record<string, unknown>;
	};
	const nextVersion = manifest.dependencies?.next ?? manifest.devDependencies?.next;
	if (nextMajor(nextVersion) !== 12)
		throw new Error('Pinned package metadata does not corroborate Next 12');
	const yarnLock = findArchiveFile(index, 'yarn.lock').bytes.toString('utf8');
	if (!yarnLock.includes('# yarn lockfile v1'))
		throw new Error('Pinned lock metadata does not corroborate Yarn v1');
}

export function requireT124HistoricalFacts(index: ArchiveIndex) {
	requireT106PackageFacts(index);
	const manifest = JSON.parse(findArchiveFile(index, 'package.json').bytes.toString('utf8')) as {
		scripts?: Record<string, unknown>;
	};
	const pagesIndex = findArchiveFile(index, 'pages/index.tsx').bytes.toString('utf8');
	if (!pagesIndex.includes('getStaticProps'))
		throw new Error('Historical Pages entry does not corroborate getStaticProps');
	const playwrightWorkflow = findArchiveFile(
		index,
		'.github/workflows/playwright.yml',
	).bytes.toString('utf8');
	if (!playwrightWorkflow.toLowerCase().includes('playwright'))
		throw new Error('Historical workflow does not corroborate Playwright');
	const nextConfiguration = findArchiveFile(index, 'next.config.js').bytes.toString('utf8');
	if (!nextConfiguration.includes('@svgr/webpack'))
		throw new Error('Historical Next configuration does not corroborate custom webpack');
	const search = findArchiveFile(index, 'components/Search/index.tsx');
	if (search.byteLength === 0) throw new Error('Historical Search journey path is empty');
	const scripts = Object.entries(manifest.scripts ?? {})
		.map(([name, command]) => ({
			name,
			command: typeof command === 'string' ? command : 'not-a-string',
		}))
		.sort((left, right) => left.name.localeCompare(right.name));
	return {
		nextMajor: 12,
		packageManager: 'yarn-v1',
		router: 'pages',
		dataFunction: 'getStaticProps',
		browserWorkflow: 'playwright-present-not-executed',
		productionBundler: 'candidate-owned-custom-webpack',
		journeyPath: 'components/Search/index.tsx',
		scripts,
		scope: 'provenance-only',
	};
}

export function requireT136HistoricalFacts(index: ArchiveIndex) {
	const manifest = JSON.parse(findArchiveFile(index, 'package.json').bytes.toString('utf8')) as {
		scripts?: Record<string, unknown>;
		dependencies?: Record<string, unknown>;
		devDependencies?: Record<string, unknown>;
		engines?: Record<string, unknown>;
	};
	if (manifest.dependencies?.next !== '13.4.8')
		throw new Error('Pinned package metadata does not corroborate exact Next 13.4.8');
	if (manifest.dependencies?.react !== '18.2.0')
		throw new Error('Pinned package metadata does not corroborate exact React 18.2.0');
	if (manifest.engines && Object.hasOwn(manifest.engines, 'node'))
		throw new Error('Historical package metadata unexpectedly declares a Node engine');
	const yarnConfiguration = findArchiveFile(index, '.yarnrc.yml').bytes.toString('utf8');
	if (!yarnConfiguration.includes('nodeLinker: node-modules'))
		throw new Error('Pinned Yarn configuration does not corroborate node-modules linking');
	const yarnLock = findArchiveFile(index, 'yarn.lock').bytes.toString('utf8');
	if (!yarnLock.includes('__metadata:') || !yarnLock.includes('version: 6'))
		throw new Error('Pinned lock metadata does not corroborate Yarn metadata version 6');
	if (findArchiveFile(index, 'app/layout.tsx').byteLength === 0)
		throw new Error('Historical App layout is empty');
	const blogPage = findArchiveFile(index, 'app/blog/[...slug]/page.tsx').bytes.toString('utf8');
	if (!blogPage.includes('generateStaticParams'))
		throw new Error('Historical dynamic App route does not corroborate generateStaticParams');
	const newsletterRoute = findArchiveFile(index, 'app/api/newsletter2/route.ts').bytes.toString(
		'utf8',
	);
	if (!newsletterRoute.includes('POST'))
		throw new Error('Historical newsletter2 route does not corroborate an API POST handler');
	const nextConfiguration = findArchiveFile(index, 'next.config.js').bytes.toString('utf8');
	if (!nextConfiguration.includes('webpack'))
		throw new Error('Historical Next configuration does not corroborate custom webpack');
	const scripts = Object.entries(manifest.scripts ?? {})
		.map(([name, command]) => ({
			name,
			command: typeof command === 'string' ? command : 'not-a-string',
		}))
		.sort((left, right) => left.name.localeCompare(right.name));
	return {
		next: '13.4.8',
		react: '18.2.0',
		packageManager: 'yarn-metadata-v6-node-modules',
		router: 'app',
		layoutPath: 'app/layout.tsx',
		dynamicRoutePath: 'app/blog/[...slug]/page.tsx',
		dataFunction: 'generateStaticParams',
		apiRoutePath: 'app/api/newsletter2/route.ts',
		productionBundler: 'candidate-owned-custom-webpack',
		nodeEngine: 'absent',
		scripts,
		scope: 'provenance-only',
	};
}

export function requireT108PackageFacts(index: ArchiveIndex): void {
	const manifest = JSON.parse(findArchiveFile(index, 'package.json').bytes.toString('utf8')) as {
		dependencies?: Record<string, unknown>;
		devDependencies?: Record<string, unknown>;
	};
	const nextVersion = manifest.dependencies?.next ?? manifest.devDependencies?.next;
	if (nextMajor(nextVersion) !== 13)
		throw new Error('Pinned package metadata does not corroborate only Next major 13');
}

async function acquireFixture(
	config: FixtureConfig,
	state: NetworkState,
	fetchImplementation: typeof fetch = fetch,
	responseByteLimit = maximumResponseBytes,
	requestPlan?: readonly T138RequestPlanEntry[],
) {
	let requestPlanIndex = 0;
	const plannedUrl = (name: string, fallback: () => string): string => {
		if (!requestPlan) return fallback();
		const entry = requestPlan[requestPlanIndex++];
		if (!entry || entry.name !== name)
			throw new Error(`T138 live request diverged from the production plan at ${name}`);
		return entry.url;
	};
	const limits = {
		maximumResponseBytes: responseByteLimit,
		maximumAggregateBytes: state.maximumAggregateBytes,
	};
	const apiBase = joinURL('https://api.github.com', 'repos', config.owner, config.repository);
	const repositoryBody = await acquire(
		state,
		config,
		'repository-metadata',
		plannedUrl('repository-metadata', () => apiBase),
		fetchImplementation,
		limits,
	);
	const repository = parseLedgeredJson(repositoryBody, state, 'repository metadata');
	if (
		repository.full_name !== `${config.owner}/${config.repository}` ||
		repository.fork !== false
	)
		throw new Error('Repository identity mismatch');
	const commitBody = await acquire(
		state,
		config,
		'commit-metadata',
		plannedUrl('commit-metadata', () => joinURL(apiBase, 'commits', config.commit)),
		fetchImplementation,
		limits,
	);
	const commit = parseLedgeredJson(commitBody, state, 'commit metadata');
	if (commit.sha !== config.commit) throw new Error('Commit metadata rebinding refused');
	const commitValue = commit.commit as Record<string, unknown> | undefined;
	const treeValue = commitValue?.tree as Record<string, unknown> | undefined;
	const treeSha = treeValue?.sha;
	if (typeof treeSha !== 'string' || treeSha.length !== 40)
		throw new Error('Commit tree identity missing');
	if (config.expectedTreeLead && treeSha !== config.expectedTreeLead)
		throw new Error('Fresh commit tree differs from the approved immutable tree lead');
	const treeBody = await acquire(
		state,
		config,
		'tree-metadata',
		plannedUrl('tree-metadata', () =>
			withQuery(joinURL(apiBase, 'git', 'trees', treeSha), { recursive: '1' }),
		),
		fetchImplementation,
		limits,
	);
	const treeMetadata = parseLedgeredJson(treeBody, state, 'tree metadata');
	if (treeMetadata.sha !== treeSha || treeMetadata.truncated !== false)
		throw new Error('Tree metadata is rebound or truncated');
	const tree = treeMetadata.tree as TreeRow[] | undefined;
	if (!Array.isArray(tree)) throw new Error('Tree rows missing');
	if (config.id === 'next-killedbygoogle') requireExactTreeRows(tree, 86, 'T124');
	if (config.id === 'next-tailwind-starter-blog') requireExactTreeRows(tree, 138, 'T138');
	if (tree.some((row) => row.type === 'commit' || row.mode === '160000'))
		throw new Error('Submodules are refused');
	const archiveFirst = await acquire(
		state,
		config,
		'archive-copy-1',
		plannedUrl('archive-copy-1', () =>
			joinURL(
				'https://codeload.github.com',
				config.owner,
				config.repository,
				'tar.gz',
				config.commit,
			),
		),
		fetchImplementation,
		limits,
	);
	const archiveSecond = await acquire(
		state,
		config,
		'archive-copy-2',
		plannedUrl('archive-copy-2', () =>
			joinURL(
				'https://codeload.github.com',
				config.owner,
				config.repository,
				'tar.gz',
				config.commit,
			),
		),
		fetchImplementation,
		limits,
	);
	requireRepeatedBodies(archiveFirst, archiveSecond);
	const firstIndex = indexTarGzip(archiveFirst, config.commit);
	const secondIndex = indexTarGzip(archiveSecond, config.commit);
	if (
		firstIndex.root !== secondIndex.root ||
		firstIndex.manifestSha256 !== secondIndex.manifestSha256 ||
		!firstIndex.root.endsWith(`-${config.commit}`)
	)
		throw new Error('Archive commit binding mismatch');
	const treeFiles = tree
		.filter((row) => row.type === 'blob')
		.map((row) => row.path)
		.sort((left, right) => left.localeCompare(right));
	requireOfficialTreeInventory(firstIndex, treeFiles);
	const reliedPaths = selectRequiredPaths(config, tree);
	const scopedConfig: FixtureConfig = { ...config, requiredPaths: reliedPaths };
	for (const reliedPath of reliedPaths) {
		const first = await acquire(
			state,
			scopedConfig,
			`raw-copy-1:${reliedPath}`,
			plannedUrl(`raw-copy-1:${reliedPath}`, () =>
				joinURL(
					'https://raw.githubusercontent.com',
					config.owner,
					config.repository,
					config.commit,
					config.id === 'next-tailwind-starter-blog'
						? encodePath(reliedPath)
						: reliedPath,
				),
			),
			fetchImplementation,
			limits,
		);
		const second = await acquire(
			state,
			scopedConfig,
			`raw-copy-2:${reliedPath}`,
			plannedUrl(`raw-copy-2:${reliedPath}`, () =>
				joinURL(
					'https://raw.githubusercontent.com',
					config.owner,
					config.repository,
					config.commit,
					config.id === 'next-tailwind-starter-blog'
						? encodePath(reliedPath)
						: reliedPath,
				),
			),
			fetchImplementation,
			limits,
		);
		requireRepeatedBodies(first, second);
		requireRawArchiveMatch(first, findArchiveFile(firstIndex, reliedPath));
		requireRawArchiveMatch(first, findArchiveFile(secondIndex, reliedPath));
	}
	const licensePath = reliedPaths.find(
		(file) =>
			!file.includes('/') &&
			(T108_ROOT_LICENSE_PATHS.includes(file as (typeof T108_ROOT_LICENSE_PATHS)[number]) ||
				path.basename(file).toLowerCase().startsWith('license')),
	);
	if (!licensePath) throw new Error('Root MIT license path was not selected');
	const rootLicense = requireRootMitLicense(firstIndex, licensePath);
	const boundaries = inspectFixtureBoundaries(firstIndex, config);
	const licensing = licensingInventory(firstIndex, config, licensePath);
	if (!licensing.some((row) => row.path === licensePath))
		throw new Error('Root license inventory omitted');
	const assets = classifyAssets(firstIndex);
	requireCompleteAssetClassifications(firstIndex, assets);
	if (config.id === 'next-killedbygoogle') requireT124HistoricalFacts(firstIndex);
	if (config.id === 'next-nextchat') requireT108PackageFacts(firstIndex);
	if (config.id === 'next-tailwind-starter-blog') requireT136HistoricalFacts(firstIndex);
	if (requestPlan && requestPlanIndex !== requestPlan.length)
		throw new Error(
			'T138 live acquisition did not consume the complete production request plan',
		);
	return {
		config: scopedConfig,
		repositoryBody,
		commitBody,
		treeBody,
		tree,
		treeSha,
		archive: archiveFirst,
		index: firstIndex,
		reliedPaths,
		rootLicense,
		licensing,
		assets,
		boundaries,
	};
}

export type OutputDocumentMutation = (documents: {
	fixture: Record<string, unknown>;
	provenance: Record<string, unknown>;
	evidence: Record<string, unknown>;
}) => void;

function outputDocuments(
	result: Awaited<ReturnType<typeof acquireFixture>>,
	state: NetworkState,
	descriptor: TaskDescriptor,
	mutateBeforeScan?: OutputDocumentMutation,
) {
	const {
		config,
		repositoryBody,
		archive,
		index,
		tree,
		treeSha,
		reliedPaths,
		rootLicense,
		licensing,
		assets,
		boundaries,
	} = result;
	const repository = `${config.owner}/${config.repository}`;
	const repositoryMetadata = parseLedgeredJson(repositoryBody, state, 'repository metadata');
	const repositoryUrl = joinURL('https://github.com', config.owner, config.repository);
	const archiveUrl = joinURL(
		'https://codeload.github.com',
		config.owner,
		config.repository,
		'tar.gz',
		config.commit,
	);
	const corroboratedLeadFacts =
		config.id === 'next-killedbygoogle'
			? requireT124HistoricalFacts(index)
			: config.id === 'next-nextchat'
				? {
						nextMajor: 13,
						evidencePaths: ['package.json'],
						scope: 'provenance-only',
					}
				: config.id === 'next-tailwind-starter-blog'
					? requireT136HistoricalFacts(index)
					: undefined;
	const historicalBlockers =
		config.id === 'next-killedbygoogle' || config.id === 'next-tailwind-starter-blog'
			? [
					'Package scripts and any npx or registry behavior were recorded but not executed or resolved.',
					'Newsletter integrations, external product links, remote images, fonts, assets, analytics, telemetry, and browser egress remain not-tested.',
					'Server, API, data, authentication, and payment behavior remain not-tested and outside the usable closure.',
				]
			: undefined;
	const fixture = {
		schemaVersion: 'versionless.immutable-fixture.v1',
		id: config.id,
		framework: config.framework,
		repository,
		repositoryUrl,
		commit: config.commit,
		...(config.defaultBranch === undefined ? {} : { defaultBranch: config.defaultBranch }),
		tree: treeSha,
		archive: { url: archiveUrl, sha256: archive.sha256, byteLength: archive.byteLength },
		archiveManifestSha256: index.manifestSha256,
		...(config.id === 'next-killedbygoogle' || config.id === 'next-tailwind-starter-blog'
			? { repositoryIdentity: { fullName: repository, fork: false } }
			: {}),
		reliedPaths,
		...(corroboratedLeadFacts === undefined ? {} : { corroboratedLeadFacts }),
		...(historicalBlockers === undefined ? {} : { evidenceBlockers: historicalBlockers }),
		usableClosure: {
			assets: 'Only paths classified verified-compatible are usable; excluded and unknown paths remain outside the usable closure.',
			nestedLicensing:
				config.nestedCompatibleLicensePath === undefined
					? 'Only the exact root MIT file is verified-compatible.'
					: 'Root MIT scope is separate from the preserved nested Apache-2.0 font notice.',
			committedDist:
				boundaries.excludedCommittedDist.length === 0
					? 'No committed dist boundary was required.'
					: 'Committed dist is excluded; any future use requires a fresh source rebuild that was not performed here.',
		},
		localityBoundaries: config.localityBoundaries ?? [],
		nonclaims:
			config.id === 'next-killedbygoogle' || config.id === 'next-tailwind-starter-blog'
				? [
						'No migration, install, build, server, browser, or Playwright execution or parity is established.',
						'No Node, Yarn, Next, webpack, SWC, Turbopack, runtime, bundler, routing, rendering, SSR, SSG, ISR, RSC, API, middleware, image, data, authentication, payment, analytics, telemetry, egress, or locality support is established.',
						'No Tier F, Tier P, pilot, generic React support, Next.js support, Ionic, Nx, Analog, NativeScript, native parity, enterprise support, compliance, certification, PCI applicability, authenticity, signer identity, SLSA level, or OS-wide isolation is established.',
					]
				: config.id === 'next-nextchat'
					? [
							'This provenance-only Next.js candidate identity establishes no classification of routing, rendering, server, API, data, image, compiler, bundler, Node, locality, migration, build, browser parity, Tier, pilot, or support behavior.',
							'No generic React uplift, enterprise support, compliance, certification, PCI applicability, authenticity, signer identity, SLSA level, or OS-wide isolation is established.',
						]
					: [
							'Migration, build, browser parity, Node, package-manager, or bundler runtime support, Tier F, Tier P, designated pilot status, generic React, Next.js, Ionic, Nx, Analog, NativeScript, native parity, enterprise support, compliance, certification, PCI applicability, authenticity, signer identity, SLSA level, and OS-wide isolation are not established.',
						],
	};
	const provenance = {
		schemaVersion: 'versionless.cross-source-provenance.v1',
		fixture: config.id,
		repository,
		...(config.id === 'next-killedbygoogle' || config.id === 'next-tailwind-starter-blog'
			? {
					repositoryIdentity: {
						fullName: repositoryMetadata.full_name,
						fork: repositoryMetadata.fork,
					},
				}
			: {}),
		commit: config.commit,
		tree: treeSha,
		archive: { url: archiveUrl, sha256: archive.sha256, byteLength: archive.byteLength },
		fileCount: index.files.length,
		...(config.id === 'next-killedbygoogle' || config.id === 'next-tailwind-starter-blog'
			? {
					officialTreeRowCount: tree.length,
					officialTree: tree.map((row) => ({
						path: row.path,
						mode: row.mode,
						type: row.type,
						sha: row.sha,
					})),
				}
			: {}),
		fileManifestSha256: index.manifestSha256,
		acceptedGlobalMetadata: index.globalMetadata,
		acceptedPathMetadata: index.pathMetadata,
		files: fileManifest(index),
		rootLicense: {
			path: rootLicense.path,
			sha256: rootLicense.sha256,
			classification: 'verified-compatible',
		},
		licensing,
		assets,
		...(corroboratedLeadFacts === undefined ? {} : { corroboratedLeadFacts }),
		...(historicalBlockers === undefined ? {} : { evidenceBlockers: historicalBlockers }),
		nestedCompatibleLicense: boundaries.compatibleNotice
			? {
					path: boundaries.compatibleNotice.path,
					sha256: boundaries.compatibleNotice.sha256,
					classification: 'preserved-compatible-notice',
				}
			: null,
		excludedCommittedDist: boundaries.excludedCommittedDist,
	};
	const fixtureLedger = state.ledger.filter((row) => row.fixture === config.id);
	const perHost = Object.fromEntries(
		[...allowedHosts]
			.sort((left, right) => left.localeCompare(right))
			.map((host) => {
				const records = fixtureLedger.filter((row) => row.host === host);
				return [
					host,
					{
						attempts: records.length,
						completedBodies: records.filter((row) => row.result === 'pass').length,
						bytes: records.reduce((sum, row) => sum + (row.byteLength ?? 0), 0),
					},
				];
			}),
	);
	const evidence = {
		schemaVersion:
			descriptor.taskId === 'T106' ||
			descriptor.taskId === 'T108' ||
			descriptor.taskId === 'T128' ||
			descriptor.taskId === 'T136' ||
			descriptor.taskId === 'T138' ||
			descriptor.taskId === 'T142'
				? 'versionless.immutable-single-ingest.v1'
				: 'versionless.immutable-pair-ingest.v1',
		fixture: config.id,
		consent: {
			id: state.ledger.length ? descriptor.consentId : undefined,
			task: descriptor.taskId,
			authorization:
				descriptor.taskId === 'T128'
					? 'PM recorded the owner standing approval as applied on 2026-08-06 to the exact T128 historical provenance-only contract.'
					: descriptor.taskId === 'T136'
						? 'PM recorded the owner standing approval as applied on 2026-08-06 to the exact T136 historical provenance-only contract.'
						: descriptor.taskId === 'T138'
							? 'PM recorded the owner standing approval as applied on 2026-08-06 to the exact T138 historical provenance-only contract.'
							: descriptor.taskId === 'T142'
								? 'PM recorded the owner standing approval as applied on 2026-08-06 to the exact T142 historical provenance-only contract.'
								: descriptor.taskId === 'T106' || descriptor.taskId === 'T108'
									? `PM recorded the owner standing approval for the exact ${descriptor.taskId} provenance-only contract.`
									: 'Owner directly requested real MIT React and Angular fixture ingestion.',
			purpose:
				descriptor.taskId === 'T128'
					? 'Fresh immutable historical codyogden/killedbygoogle provenance, license inventory, and asset classification only.'
					: descriptor.taskId === 'T136'
						? 'Fresh immutable historical timlrx/tailwind-nextjs-starter-blog provenance, license inventory, and asset classification only.'
						: descriptor.taskId === 'T138'
							? 'Fresh immutable historical timlrx/tailwind-nextjs-starter-blog provenance, license inventory, and asset classification only.'
							: descriptor.taskId === 'T142'
								? 'Fresh immutable historical timlrx/tailwind-nextjs-starter-blog provenance, license inventory, and asset classification only.'
								: descriptor.taskId === 'T106'
									? 'Immutable codyogden/killedbygoogle provenance, license inventory, and asset classification only.'
									: descriptor.taskId === 'T108'
										? 'Immutable ChatGPTNextWeb/NextChat provenance, license inventory, and asset classification only.'
										: 'Immutable cross-source acquisition, portable provenance, license inventory, and asset classification.',
			methods: ['GET'],
			redirects: 'disabled',
			acceptEncoding: 'identity',
			hosts: [...allowedHosts].sort((left, right) => left.localeCompare(right)),
			expires: consentExpiry,
			status: 'closed',
		},
		...(descriptor.taskId === 'T128' ||
		descriptor.taskId === 'T136' ||
		descriptor.taskId === 'T138' ||
		descriptor.taskId === 'T142'
			? {
					freshAcquisitionSeparation:
						descriptor.taskId === 'T128'
							? 'T128 uses only its fresh 19 response bodies; T104, T106, T108, T111, T113, and T124 bodies and digests are neither imported nor compared.'
							: descriptor.taskId === 'T136'
								? 'T136 uses only its fresh 21 response bodies; T134 bodies and response digests are neither imported, compared, nor used as acquisition provenance.'
								: descriptor.taskId === 'T138'
									? 'T138 uses only its fresh 21 response bodies; T136 and T134 bodies and response digests are neither imported, compared, deduplicated, nor used as acquisition provenance.'
									: 'T142 uses only its fresh 21 response bodies; T138, T136, and T134 bodies and response digests are neither read, reconstructed, imported, compared, deduplicated, nor reused.',
				}
			: {}),
		ledger: state.ledger,
		reconciliation: reconcileNetworkState(state),
		...(descriptor.taskId === 'T106' ||
		descriptor.taskId === 'T108' ||
		descriptor.taskId === 'T128' ||
		descriptor.taskId === 'T136' ||
		descriptor.taskId === 'T138' ||
		descriptor.taskId === 'T142'
			? {
					limits: {
						requests: descriptor.maximumRequests,
						responseBytes: descriptor.maximumResponseBytes,
						aggregateBytes: descriptor.maximumAggregateBytes,
						survivors: 1,
					},
				}
			: {}),
		fixtureReconciliation: {
			attempts: fixtureLedger.length,
			completedBodies: fixtureLedger.filter((row) => row.result === 'pass').length,
			bytes: fixtureLedger.reduce((sum, row) => sum + (row.byteLength ?? 0), 0),
			perHost,
		},
		publication:
			descriptor.taskId === 'T106' ||
			descriptor.taskId === 'T108' ||
			descriptor.taskId === 'T128' ||
			descriptor.taskId === 'T136' ||
			descriptor.taskId === 'T138' ||
			descriptor.taskId === 'T142'
				? 'transactional-single-candidate'
				: 'transactional-pair',
		offlineVerification: 'required-twice-after-publication',
		nonclaims: fixture.nonclaims,
	};
	const documents = { fixture, provenance, evidence } as unknown as {
		fixture: Record<string, unknown>;
		provenance: Record<string, unknown>;
		evidence: Record<string, unknown>;
	};
	mutateBeforeScan?.(documents);
	for (const document of Object.values(documents)) requirePortableJson(document);
	return documents;
}

export function createT142SyntheticOfficialTree(): TreeRow[] {
	const paths = [
		...T136_REQUIRED_PATHS,
		...Array.from(
			{ length: 130 },
			(_, index) => `synthetic/output-preflight-${String(index).padStart(3, '0')}.ts`,
		),
	];
	return paths.map((filePath, index) => {
		const digits = index % 2 === 0 ? '1234567890123' : '1234567890123456789';
		return {
			path: filePath,
			mode: index === 8 ? '040000' : index % 19 === 0 ? '100755' : '100644',
			type: index === 8 ? 'tree' : 'blob',
			sha: `a${digits}${index.toString(16).padStart(39 - digits.length, 'e')}`,
		};
	});
}

export function runT142OutputDocumentPreflight(
	config: FixtureConfig,
	mutateBeforeScan?: OutputDocumentMutation,
	tree: readonly TreeRow[] = createT142SyntheticOfficialTree(),
): ReturnType<typeof outputDocuments> {
	requireT138Config(config);
	requireExactTreeRows(tree, 138, 'T138');
	const selected = selectRequiredPaths(config, tree);
	if (JSON.stringify(selected) !== JSON.stringify(T136_REQUIRED_PATHS))
		throw new Error('T142 output preflight selector changed the literal relied-path order');
	const plan = createT138RequestPlan(config, selected);
	const repositoryBytes = Buffer.from(
		JSON.stringify({ full_name: 'timlrx/tailwind-nextjs-starter-blog', fork: false }),
	);
	const repositorySha = hashBytes(repositoryBytes);
	const ledger: LedgerRecord[] = plan.map((entry, index) => {
		const bytes = index === 0 ? repositoryBytes.byteLength : 1;
		return {
			sequence: index + 1,
			fixture: 'next-tailwind-starter-blog',
			name: entry.name,
			host: parseURL(entry.url).host ?? '',
			url: entry.url,
			method: 'GET',
			result: 'pass',
			outcome: 'success',
			httpStatus: 200,
			receivedBytes: bytes,
			bodyComplete: true,
			timestamp: '2026-08-06T00:00:00.000Z',
			contentEncoding: 'identity',
			disposition: 'accepted-complete-body',
			byteLength: bytes,
			sha256: index === 0 ? repositorySha : hashBytes(Buffer.from(entry.name)),
		};
	});
	const state: NetworkState = {
		attempts: ledger.length,
		completedBytes: ledger.reduce((sum, record) => sum + (record.byteLength ?? 0), 0),
		ledger,
		emit: () => undefined,
		maximumRequests: t142TaskDescriptor.maximumRequests,
		maximumAggregateBytes: t142TaskDescriptor.maximumAggregateBytes,
	};
	const fileText = (filePath: string): string => {
		if (filePath === '.yarnrc.yml') return 'nodeLinker: node-modules\n';
		if (filePath === 'LICENSE')
			return 'MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy.\n';
		if (filePath === 'app/api/newsletter2/route.ts') return 'export async function POST() {}\n';
		if (filePath === 'app/blog/[...slug]/page.tsx')
			return 'export function generateStaticParams() { return []; }\n';
		if (filePath === 'app/layout.tsx')
			return 'export default function Layout() { return null; }\n';
		if (filePath === 'next.config.js')
			return 'module.exports = { webpack(config) { return config } };\n';
		if (filePath === 'package.json')
			return JSON.stringify({
				dependencies: { next: '13.4.8', react: '18.2.0' },
				scripts: { build: 'next build', dev: 'next dev' },
			});
		if (filePath === 'yarn.lock') return '__metadata:\n  version: 6\n';
		return `export const syntheticOutputPreflight${filePath.length} = true;\n`;
	};
	const files = tree
		.filter((row) => row.type === 'blob')
		.map((row) => {
			const bytes = Buffer.from(fileText(row.path));
			return {
				path: row.path,
				bytes,
				byteLength: bytes.byteLength,
				sha256: hashBytes(bytes),
			};
		});
	const index: ArchiveIndex = {
		root: `tailwind-nextjs-starter-blog-${config.commit}`,
		manifestSha256: hashBytes(Buffer.from('synthetic T142 independent manifest')),
		globalMetadata: null,
		pathMetadata: [],
		files,
	};
	const repositoryBody: AcquiredBody = {
		bytes: repositoryBytes,
		byteLength: repositoryBytes.byteLength,
		sha256: repositorySha,
		ledgerSequence: 1,
	};
	const archiveBytes = Buffer.from('synthetic T142 independent archive');
	const archive: AcquiredBody = {
		bytes: archiveBytes,
		byteLength: archiveBytes.byteLength,
		sha256: hashBytes(archiveBytes),
		ledgerSequence: 4,
	};
	const rootLicense = files.find((file) => file.path === 'LICENSE');
	if (!rootLicense) throw new Error('T142 synthetic root license is absent');
	return outputDocuments(
		{
			config: { ...config, requiredPaths: selected },
			repositoryBody,
			commitBody: repositoryBody,
			treeBody: repositoryBody,
			tree: [...tree],
			treeSha: config.expectedTreeLead!,
			archive,
			index,
			reliedPaths: selected,
			rootLicense,
			licensing: [
				{
					path: 'LICENSE',
					sha256: rootLicense.sha256,
					classification: 'verified-compatible',
					reason: 'Exact synthetic root MIT preflight text.',
				},
			],
			assets: [],
			boundaries: { compatibleNotice: undefined, excludedCommittedDist: [] },
		} as Awaited<ReturnType<typeof acquireFixture>>,
		state,
		t142TaskDescriptor,
		mutateBeforeScan,
	);
}

type Publication = Readonly<{ staged: string; final: string }>;

export async function publishTransaction(
	publications: readonly Publication[],
	injectFailureAfter = -1,
): Promise<void> {
	const published: string[] = [];
	try {
		for (const [index, publication] of publications.entries()) {
			if (index === injectFailureAfter)
				throw new Error('Injected second-fixture publication failure');
			await mkdir(path.dirname(publication.final), { recursive: true });
			await rename(publication.staged, publication.final);
			published.push(publication.final);
		}
	} catch (error) {
		for (const final of published.reverse()) await rm(final, { recursive: true, force: true });
		throw error;
	}
}

async function stageOutput(
	stagingRoot: string,
	relative: string,
	bytes: Buffer | string,
): Promise<void> {
	const staged = path.join(stagingRoot, 'publication', relative);
	await mkdir(path.dirname(staged), { recursive: true });
	await writeFile(staged, bytes);
}

export async function requirePublicationAbsence(
	baseRoot: string,
	selected: readonly Pick<FixtureConfig, 'id'>[],
	descriptor: TaskDescriptor = pairTaskDescriptors[0]!,
): Promise<void> {
	const sharedFinalTargets = selected.flatMap((fixture) => [
		path.join(baseRoot, `fixtures/${fixture.id}/fixture.json`),
		path.join(baseRoot, `fixtures/${fixture.id}/provenance.json`),
		path.join(baseRoot, `.versionless/cache/tier-f/${fixture.id}`),
	]);
	const historicalEvidenceTargets = selected.flatMap((fixture) =>
		(
			[
				't084',
				't090',
				't092',
				't104',
				't106',
				't108',
				't111',
				't136',
				't138',
				descriptor.taskId.toLowerCase(),
			] as const
		).map((task) => path.join(baseRoot, `evidence/ingests/${fixture.id}/${task}-ingest.json`)),
	);
	const stagingTargets = [
		...(['t084', 't090', 't092'] as const).map((task) =>
			path.join(baseRoot, `.versionless/cache/tier-f/.staging/${task}-pair`),
		),
		path.join(baseRoot, '.versionless/cache/tier-f/.staging/t104-next-killedbygoogle'),
		path.join(baseRoot, '.versionless/cache/tier-f/.staging/t106-next-killedbygoogle'),
		path.join(baseRoot, '.versionless/cache/tier-f/.staging/t108-next-nextchat'),
		path.join(baseRoot, '.versionless/cache/tier-f/.staging/t111-next-killedbygoogle'),
		path.join(baseRoot, '.versionless/cache/tier-f/.staging/t113-next-killedbygoogle'),
		path.join(baseRoot, '.versionless/cache/tier-f/.staging/t124-next-killedbygoogle'),
		path.join(baseRoot, '.versionless/cache/tier-f/.staging/t128-next-killedbygoogle'),
		path.join(baseRoot, '.versionless/cache/tier-f/.staging/t134-discovery'),
		path.join(baseRoot, '.versionless/cache/tier-f/.staging/t136-next-tailwind-starter-blog'),
		path.join(baseRoot, '.versionless/cache/tier-f/.staging/t138-next-tailwind-starter-blog'),
		path.join(baseRoot, '.versionless/cache/tier-f/.staging', descriptor.stagingDirectory),
	];
	const consumedFinalTargets =
		descriptor.taskId === 'T136' || descriptor.taskId === 'T138' || descriptor.taskId === 'T142'
			? []
			: [
					path.join(baseRoot, 'fixtures/next-killedbygoogle/fixture.json'),
					path.join(baseRoot, 'fixtures/next-killedbygoogle/provenance.json'),
					path.join(baseRoot, 'evidence/ingests/next-killedbygoogle/t104-ingest.json'),
					path.join(baseRoot, 'evidence/ingests/next-killedbygoogle/t106-ingest.json'),
					path.join(baseRoot, 'evidence/ingests/next-killedbygoogle/t113-ingest.json'),
					path.join(baseRoot, 'evidence/ingests/next-killedbygoogle/t124-ingest.json'),
					path.join(baseRoot, '.versionless/cache/tier-f/next-killedbygoogle'),
					path.join(baseRoot, 'fixtures/next-nextchat/fixture.json'),
					path.join(baseRoot, 'fixtures/next-nextchat/provenance.json'),
					path.join(baseRoot, 'evidence/ingests/next-nextchat/t108-ingest.json'),
					path.join(baseRoot, '.versionless/cache/tier-f/next-nextchat'),
				];
	for (const target of [
		...sharedFinalTargets,
		...historicalEvidenceTargets,
		...stagingTargets,
		...consumedFinalTargets,
	]) {
		try {
			await access(target);
			throw new Error(`Pre-network publication residue exists: ${path.basename(target)}`);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
	const globalStaging = path.join(baseRoot, '.versionless/cache/tier-f/.staging');
	try {
		if ((await readdir(globalStaging)).length !== 0)
			throw new Error('Pre-network global tier-f staging is not empty');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
}

async function ingest(
	selected: readonly FixtureConfig[],
	consentId: string | undefined,
	descriptor: PairTaskDescriptor,
): Promise<void> {
	assertConsent(consentId, descriptor);
	if (selected.length !== 2 || new Set(selected.map((fixture) => fixture.id)).size !== 2)
		throw new Error('Live pair ingest requires exactly the authorized fixture pair');
	await requirePublicationAbsence(root, selected, descriptor);
	const stagingRoot = path.join(
		root,
		'.versionless/cache/tier-f/.staging',
		descriptor.stagingDirectory,
	);
	const state = createNetworkState();
	try {
		const results = [];
		for (const fixture of selected) results.push(await acquireFixture(fixture, state));
		reconcileNetworkState(state);
		const publications: Publication[] = [];
		for (const result of results) {
			const documents = outputDocuments(result, state, descriptor);
			const digest = result.archive.sha256;
			await Promise.all([
				stageOutput(
					stagingRoot,
					`.versionless/cache/tier-f/${result.config.id}/${digest}/source.tar.gz`,
					result.archive.bytes,
				),
				stageOutput(
					stagingRoot,
					`.versionless/cache/tier-f/${result.config.id}/${digest}/manifest.json`,
					canonical({
						schemaVersion: 'versionless.archive-file-manifest.v1',
						archiveSha256: digest,
						manifestSha256: result.index.manifestSha256,
						files: fileManifest(result.index),
					}),
				),
				stageOutput(
					stagingRoot,
					`fixtures/${result.config.id}/fixture.json`,
					canonical(documents.fixture),
				),
				stageOutput(
					stagingRoot,
					`fixtures/${result.config.id}/provenance.json`,
					canonical(documents.provenance),
				),
				stageOutput(
					stagingRoot,
					`evidence/ingests/${result.config.id}/${descriptor.evidenceFileName}`,
					canonical(documents.evidence),
				),
			]);
			for (const relative of [
				`.versionless/cache/tier-f/${result.config.id}`,
				`fixtures/${result.config.id}`,
				`evidence/ingests/${result.config.id}`,
			])
				publications.push({
					staged: path.join(stagingRoot, 'publication', relative),
					final: path.join(root, relative),
				});
		}
		await publishTransaction(publications);
	} finally {
		await rm(stagingRoot, { recursive: true, force: true });
	}
}

export async function ingestT106(
	selected: readonly FixtureConfig[],
	consentId: string | undefined,
	fetchImplementation: typeof fetch = fetch,
	baseRoot = root,
): Promise<void> {
	void selected;
	void consentId;
	void fetchImplementation;
	void baseRoot;
	throw new Error('Consumed T104 and T106 consents are permanently refused before GET');
}

function requireT108SuccessLedger(state: NetworkState): void {
	const reconciliation = reconcileNetworkState(state);
	if (
		reconciliation.attempts !== 17 ||
		reconciliation.completedBodies !== 17 ||
		reconciliation.perHost['api.github.com']?.attempts !== 11 ||
		reconciliation.perHost['api.github.com']?.completedBodies !== 11 ||
		reconciliation.perHost['raw.githubusercontent.com']?.attempts !== 4 ||
		reconciliation.perHost['raw.githubusercontent.com']?.completedBodies !== 4 ||
		reconciliation.perHost['codeload.github.com']?.attempts !== 2 ||
		reconciliation.perHost['codeload.github.com']?.completedBodies !== 2
	)
		throw new Error('T108 success must reconcile exactly 17 GETs: 11 API, 4 raw, 2 codeload');
}

export function requireT128SuccessLedger(state: NetworkState): void {
	const reconciliation = reconcileNetworkState(state);
	const expectedNames = [
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
	if (
		reconciliation.attempts !== 19 ||
		reconciliation.completedBodies !== 19 ||
		reconciliation.completedBytes > t128TaskDescriptor.maximumAggregateBytes ||
		reconciliation.perHost['api.github.com']?.attempts !== 3 ||
		reconciliation.perHost['api.github.com']?.completedBodies !== 3 ||
		reconciliation.perHost['raw.githubusercontent.com']?.attempts !== 14 ||
		reconciliation.perHost['raw.githubusercontent.com']?.completedBodies !== 14 ||
		reconciliation.perHost['codeload.github.com']?.attempts !== 2 ||
		reconciliation.perHost['codeload.github.com']?.completedBodies !== 2 ||
		JSON.stringify(state.ledger.map((record) => record.name)) !==
			JSON.stringify(expectedNames) ||
		state.ledger.some(
			(record) =>
				record.result !== 'pass' ||
				(record.byteLength ?? t128TaskDescriptor.maximumResponseBytes + 1) >
					t128TaskDescriptor.maximumResponseBytes,
		)
	)
		throw new Error(
			'T128 success must reconcile the exact 19 GET sequence: 3 API, 2 codeload, 14 raw',
		);
}

export function requireT136SuccessLedger(state: NetworkState): void {
	const reconciliation = reconcileNetworkState(state);
	const expectedNames = [
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
	if (
		reconciliation.attempts !== 21 ||
		reconciliation.completedBodies !== 21 ||
		reconciliation.completedBytes > t136TaskDescriptor.maximumAggregateBytes ||
		reconciliation.perHost['api.github.com']?.attempts !== 3 ||
		reconciliation.perHost['api.github.com']?.completedBodies !== 3 ||
		reconciliation.perHost['raw.githubusercontent.com']?.attempts !== 16 ||
		reconciliation.perHost['raw.githubusercontent.com']?.completedBodies !== 16 ||
		reconciliation.perHost['codeload.github.com']?.attempts !== 2 ||
		reconciliation.perHost['codeload.github.com']?.completedBodies !== 2 ||
		JSON.stringify(state.ledger.map((record) => record.name)) !==
			JSON.stringify(expectedNames) ||
		state.ledger.some(
			(record) =>
				record.result !== 'pass' ||
				!record.bodyComplete ||
				record.httpStatus !== 200 ||
				record.contentEncoding !== 'identity' ||
				record.disposition !== 'accepted-complete-body' ||
				(record.byteLength ?? t136TaskDescriptor.maximumResponseBytes + 1) >
					t136TaskDescriptor.maximumResponseBytes,
		)
	)
		throw new Error(
			'T136 success must reconcile the exact 21 GET sequence: 3 API, 2 codeload, 16 raw',
		);
}

export function requireT138SuccessLedger(state: NetworkState): void {
	const reconciliation = reconcileNetworkState(state);
	const expectedNames = [
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
	if (
		reconciliation.attempts !== 21 ||
		reconciliation.completedBodies !== 21 ||
		reconciliation.completedBytes > t138TaskDescriptor.maximumAggregateBytes ||
		reconciliation.perHost['api.github.com']?.attempts !== 3 ||
		reconciliation.perHost['api.github.com']?.completedBodies !== 3 ||
		reconciliation.perHost['raw.githubusercontent.com']?.attempts !== 16 ||
		reconciliation.perHost['raw.githubusercontent.com']?.completedBodies !== 16 ||
		reconciliation.perHost['codeload.github.com']?.attempts !== 2 ||
		reconciliation.perHost['codeload.github.com']?.completedBodies !== 2 ||
		JSON.stringify(state.ledger.map((record) => record.name)) !==
			JSON.stringify(expectedNames) ||
		state.ledger.some(
			(record) =>
				record.result !== 'pass' ||
				!record.bodyComplete ||
				record.httpStatus !== 200 ||
				record.method !== 'GET' ||
				record.contentEncoding !== 'identity' ||
				record.disposition !== 'accepted-complete-body' ||
				(record.byteLength ?? t138TaskDescriptor.maximumResponseBytes + 1) >
					t138TaskDescriptor.maximumResponseBytes,
		)
	)
		throw new Error(
			'T138 success must reconcile the exact 21 GET sequence: 3 API, 2 codeload, 16 raw',
		);
}

export function requireT142SuccessLedger(state: NetworkState): void {
	const reconciliation = reconcileNetworkState(state);
	const expectedNames = createT138RequestPlan(
		fixtures.find((fixture) => fixture.id === 'next-tailwind-starter-blog')!,
		T136_REQUIRED_PATHS,
	).map((entry) => entry.name);
	if (
		reconciliation.attempts !== 21 ||
		reconciliation.completedBodies !== 21 ||
		reconciliation.completedBytes > t142TaskDescriptor.maximumAggregateBytes ||
		reconciliation.perHost['api.github.com']?.attempts !== 3 ||
		reconciliation.perHost['api.github.com']?.completedBodies !== 3 ||
		reconciliation.perHost['raw.githubusercontent.com']?.attempts !== 16 ||
		reconciliation.perHost['raw.githubusercontent.com']?.completedBodies !== 16 ||
		reconciliation.perHost['codeload.github.com']?.attempts !== 2 ||
		reconciliation.perHost['codeload.github.com']?.completedBodies !== 2 ||
		JSON.stringify(state.ledger.map((record) => record.name)) !==
			JSON.stringify(expectedNames) ||
		state.ledger.some(
			(record) =>
				record.result !== 'pass' ||
				!record.bodyComplete ||
				record.httpStatus !== 200 ||
				record.method !== 'GET' ||
				record.contentEncoding !== 'identity' ||
				record.disposition !== 'accepted-complete-body' ||
				(record.byteLength ?? t142TaskDescriptor.maximumResponseBytes + 1) >
					t142TaskDescriptor.maximumResponseBytes,
		)
	)
		throw new Error(
			'T142 success must reconcile the exact 21 GET sequence: 3 API, 2 codeload, 16 raw',
		);
}

function requireT128Selection(selected: readonly FixtureConfig[]): FixtureConfig {
	const candidate = selected[0];
	if (
		selected.length !== 1 ||
		candidate?.id !== 'next-killedbygoogle' ||
		candidate.owner !== 'codyogden' ||
		candidate.repository !== 'killedbygoogle' ||
		candidate.commit !== '56809c31592e6ca1edce8af9bfe842fbcdf71f4d' ||
		candidate.expectedTreeLead !== 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763' ||
		JSON.stringify(candidate.requiredPaths) !== JSON.stringify(T124_REQUIRED_PATHS)
	)
		throw new Error(
			'Live T128 ingest requires exactly the authorized historical single repository',
		);
	return candidate;
}

export async function ingestT128(
	selected: readonly FixtureConfig[],
	consentId: string | undefined,
	fetchImplementation: typeof fetch = fetch,
	baseRoot = root,
): Promise<void> {
	assertConsent(consentId, t128TaskDescriptor);
	const candidate = requireT128Selection(selected);
	await requirePublicationAbsence(baseRoot, selected, t128TaskDescriptor);
	const stagingRoot = path.join(
		baseRoot,
		'.versionless/cache/tier-f/.staging',
		t128TaskDescriptor.stagingDirectory,
	);
	const state = createNetworkState(undefined, {
		maximumRequests: t128TaskDescriptor.maximumRequests,
		maximumAggregateBytes: t128TaskDescriptor.maximumAggregateBytes,
	});
	try {
		const result = await acquireFixture(
			candidate,
			state,
			fetchImplementation,
			t128TaskDescriptor.maximumResponseBytes,
		);
		if (
			result.config.id !== 'next-killedbygoogle' ||
			result.config.commit !== candidate.commit ||
			result.treeSha !== candidate.expectedTreeLead
		)
			throw new Error('T128 acquisition survivor identity changed');
		requireT128SuccessLedger(state);
		const documents = outputDocuments(result, state, t128TaskDescriptor);
		const digest = result.archive.sha256;
		await Promise.all([
			stageOutput(
				stagingRoot,
				`.versionless/cache/tier-f/${result.config.id}/${digest}/source.tar.gz`,
				result.archive.bytes,
			),
			stageOutput(
				stagingRoot,
				`.versionless/cache/tier-f/${result.config.id}/${digest}/manifest.json`,
				canonical({
					schemaVersion: 'versionless.archive-file-manifest.v1',
					archiveSha256: digest,
					manifestSha256: result.index.manifestSha256,
					files: fileManifest(result.index),
				}),
			),
			stageOutput(
				stagingRoot,
				`fixtures/${result.config.id}/fixture.json`,
				canonical(documents.fixture),
			),
			stageOutput(
				stagingRoot,
				`fixtures/${result.config.id}/provenance.json`,
				canonical(documents.provenance),
			),
			stageOutput(
				stagingRoot,
				`evidence/ingests/${result.config.id}/${t128TaskDescriptor.evidenceFileName}`,
				canonical(documents.evidence),
			),
		]);
		const publications = [
			`.versionless/cache/tier-f/${result.config.id}`,
			`fixtures/${result.config.id}`,
			`evidence/ingests/${result.config.id}`,
		].map((relative) => ({
			staged: path.join(stagingRoot, 'publication', relative),
			final: path.join(baseRoot, relative),
		}));
		await publishTransaction(publications);
	} finally {
		await rm(stagingRoot, { recursive: true, force: true });
	}
}

function requireT136Selection(selected: readonly FixtureConfig[]): FixtureConfig {
	const candidate = selected[0];
	if (
		selected.length !== 1 ||
		candidate?.id !== 'next-tailwind-starter-blog' ||
		candidate.owner !== 'timlrx' ||
		candidate.repository !== 'tailwind-nextjs-starter-blog' ||
		candidate.commit !== '09ba0550caea03a8c38bc4878d05838d2a57f999' ||
		candidate.expectedTreeLead !== '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf' ||
		JSON.stringify(candidate.requiredPaths) !== JSON.stringify(T136_REQUIRED_PATHS)
	)
		throw new Error(
			'Live T136 ingest requires exactly the authorized historical single repository',
		);
	return candidate;
}

export async function ingestT136(
	selected: readonly FixtureConfig[],
	consentId: string | undefined,
	fetchImplementation: typeof fetch = fetch,
	baseRoot = root,
): Promise<void> {
	assertConsent(consentId, t136TaskDescriptor);
	const candidate = requireT136Selection(selected);
	await requirePublicationAbsence(baseRoot, selected, t136TaskDescriptor);
	const stagingRoot = path.join(
		baseRoot,
		'.versionless/cache/tier-f/.staging',
		t136TaskDescriptor.stagingDirectory,
	);
	const state = createNetworkState(undefined, {
		maximumRequests: t136TaskDescriptor.maximumRequests,
		maximumAggregateBytes: t136TaskDescriptor.maximumAggregateBytes,
	});
	try {
		const result = await acquireFixture(
			candidate,
			state,
			fetchImplementation,
			t136TaskDescriptor.maximumResponseBytes,
		);
		if (
			result.config.id !== 'next-tailwind-starter-blog' ||
			result.config.commit !== candidate.commit ||
			result.treeSha !== candidate.expectedTreeLead
		)
			throw new Error('T136 acquisition survivor identity changed');
		requireT136SuccessLedger(state);
		const documents = outputDocuments(result, state, t136TaskDescriptor);
		const digest = result.archive.sha256;
		await Promise.all([
			stageOutput(
				stagingRoot,
				`.versionless/cache/tier-f/${result.config.id}/${digest}/source.tar.gz`,
				result.archive.bytes,
			),
			stageOutput(
				stagingRoot,
				`.versionless/cache/tier-f/${result.config.id}/${digest}/manifest.json`,
				canonical({
					schemaVersion: 'versionless.archive-file-manifest.v1',
					archiveSha256: digest,
					manifestSha256: result.index.manifestSha256,
					files: fileManifest(result.index),
				}),
			),
			stageOutput(
				stagingRoot,
				`fixtures/${result.config.id}/fixture.json`,
				canonical(documents.fixture),
			),
			stageOutput(
				stagingRoot,
				`fixtures/${result.config.id}/provenance.json`,
				canonical(documents.provenance),
			),
			stageOutput(
				stagingRoot,
				`evidence/ingests/${result.config.id}/${t136TaskDescriptor.evidenceFileName}`,
				canonical(documents.evidence),
			),
		]);
		const publications = [
			`.versionless/cache/tier-f/${result.config.id}`,
			`fixtures/${result.config.id}`,
			`evidence/ingests/${result.config.id}`,
		].map((relative) => ({
			staged: path.join(stagingRoot, 'publication', relative),
			final: path.join(baseRoot, relative),
		}));
		await publishTransaction(publications);
	} finally {
		await rm(stagingRoot, { recursive: true, force: true });
	}
}

function requireT138Selection(selected: readonly FixtureConfig[]): FixtureConfig {
	const candidate = selected[0];
	if (selected.length !== 1 || !candidate)
		throw new Error('Live T138 ingest requires exactly one authorized historical repository');
	requireT138Config(candidate);
	return candidate;
}

export async function ingestT138(
	selected: readonly FixtureConfig[],
	consentId: string | undefined,
	fetchImplementation: typeof fetch = fetch,
	baseRoot = root,
	preflightTree: readonly TreeRow[] = createT138SyntheticTree(),
): Promise<void> {
	assertConsent(consentId, t138TaskDescriptor);
	const candidate = requireT138Selection(selected);
	const requestPlan = runT138ProductionPreflight(candidate, preflightTree);
	await requirePublicationAbsence(baseRoot, selected, t138TaskDescriptor);
	const stagingRoot = path.join(
		baseRoot,
		'.versionless/cache/tier-f/.staging',
		t138TaskDescriptor.stagingDirectory,
	);
	const state = createNetworkState(undefined, {
		maximumRequests: t138TaskDescriptor.maximumRequests,
		maximumAggregateBytes: t138TaskDescriptor.maximumAggregateBytes,
	});
	try {
		const result = await acquireFixture(
			candidate,
			state,
			fetchImplementation,
			t138TaskDescriptor.maximumResponseBytes,
			requestPlan,
		);
		if (
			result.config.id !== 'next-tailwind-starter-blog' ||
			result.config.commit !== candidate.commit ||
			result.treeSha !== candidate.expectedTreeLead
		)
			throw new Error('T138 acquisition survivor identity changed');
		requireT138SuccessLedger(state);
		const documents = outputDocuments(result, state, t138TaskDescriptor);
		const digest = result.archive.sha256;
		await Promise.all([
			stageOutput(
				stagingRoot,
				`.versionless/cache/tier-f/${result.config.id}/${digest}/source.tar.gz`,
				result.archive.bytes,
			),
			stageOutput(
				stagingRoot,
				`.versionless/cache/tier-f/${result.config.id}/${digest}/manifest.json`,
				canonical({
					schemaVersion: 'versionless.archive-file-manifest.v1',
					archiveSha256: digest,
					manifestSha256: result.index.manifestSha256,
					files: fileManifest(result.index),
				}),
			),
			stageOutput(
				stagingRoot,
				`fixtures/${result.config.id}/fixture.json`,
				canonical(documents.fixture),
			),
			stageOutput(
				stagingRoot,
				`fixtures/${result.config.id}/provenance.json`,
				canonical(documents.provenance),
			),
			stageOutput(
				stagingRoot,
				`evidence/ingests/${result.config.id}/${t138TaskDescriptor.evidenceFileName}`,
				canonical(documents.evidence),
			),
		]);
		const publications = [
			`.versionless/cache/tier-f/${result.config.id}`,
			`fixtures/${result.config.id}`,
			`evidence/ingests/${result.config.id}`,
		].map((relative) => ({
			staged: path.join(stagingRoot, 'publication', relative),
			final: path.join(baseRoot, relative),
		}));
		await publishTransaction(publications);
	} finally {
		await rm(stagingRoot, { recursive: true, force: true });
	}
}

export type T142PreflightOptions = Readonly<{
	selectorTree?: readonly TreeRow[];
	outputTree?: readonly TreeRow[];
	mutateDocuments?: OutputDocumentMutation;
}>;

export async function ingestT142(
	selected: readonly FixtureConfig[],
	consentId: string | undefined,
	fetchImplementation: typeof fetch = fetch,
	baseRoot = root,
	preflight: T142PreflightOptions = {},
): Promise<void> {
	assertConsent(consentId, t142TaskDescriptor);
	const candidate = requireT138Selection(selected);
	const requestPlan = runT138ProductionPreflight(
		candidate,
		preflight.selectorTree ?? createT138SyntheticTree(),
	);
	runT142OutputDocumentPreflight(
		candidate,
		preflight.mutateDocuments,
		preflight.outputTree ?? createT142SyntheticOfficialTree(),
	);
	await requirePublicationAbsence(baseRoot, selected, t142TaskDescriptor);
	const stagingRoot = path.join(
		baseRoot,
		'.versionless/cache/tier-f/.staging',
		t142TaskDescriptor.stagingDirectory,
	);
	const state = createNetworkState(undefined, {
		maximumRequests: t142TaskDescriptor.maximumRequests,
		maximumAggregateBytes: t142TaskDescriptor.maximumAggregateBytes,
	});
	try {
		const result = await acquireFixture(
			candidate,
			state,
			fetchImplementation,
			t142TaskDescriptor.maximumResponseBytes,
			requestPlan,
		);
		if (
			result.config.id !== 'next-tailwind-starter-blog' ||
			result.config.commit !== candidate.commit ||
			result.treeSha !== candidate.expectedTreeLead
		)
			throw new Error('T142 acquisition survivor identity changed');
		requireT142SuccessLedger(state);
		const documents = outputDocuments(result, state, t142TaskDescriptor);
		const digest = result.archive.sha256;
		await Promise.all([
			stageOutput(
				stagingRoot,
				`.versionless/cache/tier-f/${result.config.id}/${digest}/source.tar.gz`,
				result.archive.bytes,
			),
			stageOutput(
				stagingRoot,
				`.versionless/cache/tier-f/${result.config.id}/${digest}/manifest.json`,
				canonical({
					schemaVersion: 'versionless.archive-file-manifest.v1',
					archiveSha256: digest,
					manifestSha256: result.index.manifestSha256,
					files: fileManifest(result.index),
				}),
			),
			stageOutput(
				stagingRoot,
				`fixtures/${result.config.id}/fixture.json`,
				canonical(documents.fixture),
			),
			stageOutput(
				stagingRoot,
				`fixtures/${result.config.id}/provenance.json`,
				canonical(documents.provenance),
			),
			stageOutput(
				stagingRoot,
				`evidence/ingests/${result.config.id}/${t142TaskDescriptor.evidenceFileName}`,
				canonical(documents.evidence),
			),
		]);
		const publications = [
			`.versionless/cache/tier-f/${result.config.id}`,
			`fixtures/${result.config.id}`,
			`evidence/ingests/${result.config.id}`,
		].map((relative) => ({
			staged: path.join(stagingRoot, 'publication', relative),
			final: path.join(baseRoot, relative),
		}));
		await publishTransaction(publications);
	} finally {
		await rm(stagingRoot, { recursive: true, force: true });
	}
}

export async function ingestT108(
	selected: readonly FixtureConfig[],
	consentId: string | undefined,
	fetchImplementation: typeof fetch = fetch,
	baseRoot = root,
): Promise<void> {
	assertConsent(consentId, t108TaskDescriptor);
	if (
		selected.length !== 1 ||
		selected[0]?.id !== 'next-nextchat' ||
		selected[0].owner !== 'ChatGPTNextWeb' ||
		selected[0].repository !== 'NextChat'
	)
		throw new Error('Live T108 ingest requires exactly the authorized single repository');
	await requirePublicationAbsence(baseRoot, selected, t108TaskDescriptor);
	const stagingRoot = path.join(
		baseRoot,
		'.versionless/cache/tier-f/.staging',
		t108TaskDescriptor.stagingDirectory,
	);
	const state = createNetworkState(undefined, {
		maximumRequests: t108TaskDescriptor.maximumRequests,
		maximumAggregateBytes: t108TaskDescriptor.maximumAggregateBytes,
	});
	try {
		const resolved = await resolveT108Candidate(state, fetchImplementation);
		const result = await acquireFixture(resolved, state, fetchImplementation);
		if (result.config.id !== 'next-nextchat' || result.config.commit !== resolved.commit)
			throw new Error('T108 acquisition survivor identity changed');
		requireT108SuccessLedger(state);
		const documents = outputDocuments(result, state, t108TaskDescriptor);
		const digest = result.archive.sha256;
		await Promise.all([
			stageOutput(
				stagingRoot,
				`.versionless/cache/tier-f/${result.config.id}/${digest}/source.tar.gz`,
				result.archive.bytes,
			),
			stageOutput(
				stagingRoot,
				`.versionless/cache/tier-f/${result.config.id}/${digest}/manifest.json`,
				canonical({
					schemaVersion: 'versionless.archive-file-manifest.v1',
					archiveSha256: digest,
					manifestSha256: result.index.manifestSha256,
					files: fileManifest(result.index),
				}),
			),
			stageOutput(
				stagingRoot,
				`fixtures/${result.config.id}/fixture.json`,
				canonical(documents.fixture),
			),
			stageOutput(
				stagingRoot,
				`fixtures/${result.config.id}/provenance.json`,
				canonical(documents.provenance),
			),
			stageOutput(
				stagingRoot,
				`evidence/ingests/${result.config.id}/${t108TaskDescriptor.evidenceFileName}`,
				canonical(documents.evidence),
			),
		]);
		const publications = [
			`.versionless/cache/tier-f/${result.config.id}`,
			`fixtures/${result.config.id}`,
			`evidence/ingests/${result.config.id}`,
		].map((relative) => ({
			staged: path.join(stagingRoot, 'publication', relative),
			final: path.join(baseRoot, relative),
		}));
		await publishTransaction(publications);
	} finally {
		await rm(stagingRoot, { recursive: true, force: true });
	}
}

async function verifyFixture(config: FixtureConfig, descriptor: TaskDescriptor): Promise<string> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Verification requires explicit offline mode');
	const fixtureFile = path.join(root, `fixtures/${config.id}/fixture.json`);
	const provenanceFile = path.join(root, `fixtures/${config.id}/provenance.json`);
	const evidenceFile = path.join(
		root,
		`evidence/ingests/${config.id}/${descriptor.evidenceFileName}`,
	);
	const fixtureBytes = await readFile(fixtureFile);
	const provenanceBytes = await readFile(provenanceFile);
	const evidenceBytes = await readFile(evidenceFile);
	const fixture = JSON.parse(fixtureBytes.toString('utf8')) as Record<string, any>;
	const provenance = JSON.parse(provenanceBytes.toString('utf8')) as Record<string, any>;
	const evidence = JSON.parse(evidenceBytes.toString('utf8')) as Record<string, any>;
	for (const document of [fixture, provenance, evidence]) requirePortableJson(document);
	if (
		(config.id === 'next-killedbygoogle' ||
			config.id === 'next-nextchat' ||
			config.id === 'next-tailwind-starter-blog') &&
		(!Array.isArray(fixture.reliedPaths) ||
			fixture.reliedPaths.some((entry: unknown) => typeof entry !== 'string'))
	)
		throw new Error('Offline T106 relied-path scope is absent');
	const verifiedConfig: FixtureConfig =
		config.id === 'next-killedbygoogle' || config.id === 'next-tailwind-starter-blog'
			? {
					...config,
					commit: isLowercaseCommit(fixture.commit) ? fixture.commit : '',
					requiredPaths: fixture.reliedPaths as string[],
				}
			: config.id === 'next-nextchat'
				? {
						...config,
						commit: isLowercaseCommit(fixture.commit) ? fixture.commit : '',
						defaultBranch: requireDefaultBranch(fixture.defaultBranch),
						requiredPaths: fixture.reliedPaths as string[],
					}
				: config;
	if (verifiedConfig.id === 'next-nextchat')
		requireT108RequiredPaths(verifiedConfig.requiredPaths);
	const expectedReliedPaths =
		config.id === 'next-killedbygoogle'
			? [...T124_REQUIRED_PATHS]
			: config.id === 'next-tailwind-starter-blog'
				? [...T136_REQUIRED_PATHS]
				: config.requiredPaths === undefined
					? undefined
					: [...config.requiredPaths].sort((left, right) => left.localeCompare(right));
	if (
		fixture.id !== config.id ||
		(config.id !== 'next-nextchat' && fixture.commit !== config.commit) ||
		((config.id === 'next-killedbygoogle' ||
			config.id === 'next-nextchat' ||
			config.id === 'next-tailwind-starter-blog') &&
			!isLowercaseCommit(fixture.commit)) ||
		provenance.tree !== fixture.tree ||
		(config.expectedTreeLead !== undefined && fixture.tree !== config.expectedTreeLead) ||
		(config.requiredPaths !== undefined &&
			JSON.stringify(fixture.reliedPaths) !== JSON.stringify(expectedReliedPaths))
	)
		throw new Error('Offline fixture commit/tree rebinding refused');
	if (
		(config.id === 'next-killedbygoogle' || config.id === 'next-tailwind-starter-blog') &&
		(JSON.stringify(fixture.repositoryIdentity) !==
			JSON.stringify({ fullName: `${config.owner}/${config.repository}`, fork: false }) ||
			JSON.stringify(provenance.repositoryIdentity) !==
				JSON.stringify({ fullName: `${config.owner}/${config.repository}`, fork: false }))
	)
		throw new Error('Offline T128 canonical non-fork repository identity mismatch');
	if (
		evidence.consent?.id !== descriptor.consentId ||
		((descriptor.taskId === 'T094' ||
			descriptor.taskId === 'T106' ||
			descriptor.taskId === 'T108' ||
			descriptor.taskId === 'T128' ||
			descriptor.taskId === 'T136' ||
			descriptor.taskId === 'T138' ||
			descriptor.taskId === 'T142') &&
			evidence.consent?.task !== descriptor.taskId) ||
		(descriptor.taskId === 'T092' &&
			evidence.consent?.task !== undefined &&
			evidence.consent?.task !== descriptor.taskId) ||
		evidence.consent?.status !== 'closed'
	)
		throw new Error('Offline consent receipt mismatch');
	if (
		descriptor.taskId === 'T128' &&
		(evidence.consent?.authorization !==
			'PM recorded the owner standing approval as applied on 2026-08-06 to the exact T128 historical provenance-only contract.' ||
			evidence.freshAcquisitionSeparation !==
				'T128 uses only its fresh 19 response bodies; T104, T106, T108, T111, T113, and T124 bodies and digests are neither imported nor compared.')
	)
		throw new Error(
			'Offline T128 consent authorization or fresh-acquisition separation mismatch',
		);
	if (
		descriptor.taskId === 'T136' &&
		(evidence.consent?.authorization !==
			'PM recorded the owner standing approval as applied on 2026-08-06 to the exact T136 historical provenance-only contract.' ||
			evidence.freshAcquisitionSeparation !==
				'T136 uses only its fresh 21 response bodies; T134 bodies and response digests are neither imported, compared, nor used as acquisition provenance.')
	)
		throw new Error(
			'Offline T136 consent authorization or fresh-acquisition separation mismatch',
		);
	if (
		descriptor.taskId === 'T138' &&
		(evidence.consent?.authorization !==
			'PM recorded the owner standing approval as applied on 2026-08-06 to the exact T138 historical provenance-only contract.' ||
			evidence.freshAcquisitionSeparation !==
				'T138 uses only its fresh 21 response bodies; T136 and T134 bodies and response digests are neither imported, compared, deduplicated, nor used as acquisition provenance.')
	)
		throw new Error(
			'Offline T138 consent authorization or fresh-acquisition separation mismatch',
		);
	if (
		descriptor.taskId === 'T142' &&
		(evidence.consent?.authorization !==
			'PM recorded the owner standing approval as applied on 2026-08-06 to the exact T142 historical provenance-only contract.' ||
			evidence.freshAcquisitionSeparation !==
				'T142 uses only its fresh 21 response bodies; T138, T136, and T134 bodies and response digests are neither read, reconstructed, imported, compared, deduplicated, nor reused.')
	)
		throw new Error(
			'Offline T142 consent authorization or fresh-acquisition separation mismatch',
		);
	if (
		(descriptor.taskId === 'T106' ||
			descriptor.taskId === 'T108' ||
			descriptor.taskId === 'T128' ||
			descriptor.taskId === 'T136' ||
			descriptor.taskId === 'T138' ||
			descriptor.taskId === 'T142') &&
		JSON.stringify(evidence.limits) !==
			JSON.stringify({
				requests: descriptor.maximumRequests,
				responseBytes: descriptor.maximumResponseBytes,
				aggregateBytes: descriptor.maximumAggregateBytes,
				survivors: 1,
			})
	)
		throw new Error('Offline single-candidate cap receipt mismatch');
	if (
		descriptor.taskId === 'T106' &&
		(JSON.stringify(fixture.corroboratedLeadFacts) !==
			JSON.stringify({
				nextMajor: 12,
				packageManager: 'yarn-v1',
				evidencePaths: ['package.json', 'yarn.lock'],
				scope: 'provenance-only',
			}) ||
			JSON.stringify(provenance.corroboratedLeadFacts) !==
				JSON.stringify(fixture.corroboratedLeadFacts))
	)
		throw new Error('Offline T106 lead-fact corroboration receipt mismatch');
	if (
		descriptor.taskId === 'T108' &&
		(JSON.stringify(fixture.corroboratedLeadFacts) !==
			JSON.stringify({
				nextMajor: 13,
				evidencePaths: ['package.json'],
				scope: 'provenance-only',
			}) ||
			JSON.stringify(provenance.corroboratedLeadFacts) !==
				JSON.stringify(fixture.corroboratedLeadFacts))
	)
		throw new Error('Offline T108 lead-fact corroboration receipt mismatch');
	if (!Array.isArray(evidence.ledger)) throw new Error('Offline request ledger is absent');
	const ledger = evidence.ledger as LedgerRecord[];
	for (const record of ledger) {
		let ledgerFixture: RequestFixture | undefined = fixtures.find(
			(candidate) => candidate.id === record.fixture,
		);
		if (record.fixture === 'next-killedbygoogle') {
			ledgerFixture = verifiedConfig;
		}
		if (record.fixture === 'next-tailwind-starter-blog') ledgerFixture = verifiedConfig;
		if (record.fixture === 'next-nextchat') {
			if (record.name.startsWith('repository-metadata-copy-')) ledgerFixture = t108Lead;
			else if (record.name.startsWith('default-branch-head-copy-'))
				ledgerFixture = { ...t108Lead, defaultBranch: verifiedConfig.defaultBranch };
			else ledgerFixture = verifiedConfig;
		}
		if (!ledgerFixture) throw new Error('Offline request ledger fixture is unknown');
		assertAllowedUrl(record.url, ledgerFixture);
	}
	if (descriptor.taskId === 'T138' || descriptor.taskId === 'T142') {
		const expectedPlan = createT138RequestPlan(
			verifiedConfig,
			verifiedConfig.requiredPaths ?? [],
		);
		if (
			JSON.stringify(ledger.map(({ name, url }) => ({ name, url }))) !==
			JSON.stringify(expectedPlan)
		)
			throw new Error('Offline T138 ledger differs from the shared production request plan');
	}
	const replayState: NetworkState = {
		attempts: ledger.length,
		completedBytes: ledger.reduce(
			(sum, record) => sum + (record.result === 'pass' ? (record.byteLength ?? 0) : 0),
			0,
		),
		ledger,
		emit: () => undefined,
		maximumRequests:
			descriptor.taskId === 'T106' ||
			descriptor.taskId === 'T108' ||
			descriptor.taskId === 'T128' ||
			descriptor.taskId === 'T136' ||
			descriptor.taskId === 'T138' ||
			descriptor.taskId === 'T142'
				? descriptor.maximumRequests
				: maximumRequests,
		maximumAggregateBytes:
			descriptor.taskId === 'T106' ||
			descriptor.taskId === 'T108' ||
			descriptor.taskId === 'T128' ||
			descriptor.taskId === 'T136' ||
			descriptor.taskId === 'T138' ||
			descriptor.taskId === 'T142'
				? descriptor.maximumAggregateBytes
				: maximumAggregateBytes,
	};
	if (
		JSON.stringify(reconcileNetworkState(replayState)) !==
		JSON.stringify(evidence.reconciliation)
	)
		throw new Error('Offline request ledger reconciliation mismatch');
	if (descriptor.taskId === 'T108') requireT108SuccessLedger(replayState);
	if (descriptor.taskId === 'T128') requireT128SuccessLedger(replayState);
	if (descriptor.taskId === 'T136') requireT136SuccessLedger(replayState);
	if (descriptor.taskId === 'T138') requireT138SuccessLedger(replayState);
	if (descriptor.taskId === 'T142') requireT142SuccessLedger(replayState);
	const archiveSha = fixture.archive?.sha256 as string;
	const archiveBytes = await readFile(
		path.join(root, `.versionless/cache/tier-f/${config.id}/${archiveSha}/source.tar.gz`),
	);
	const cachedManifest = JSON.parse(
		await readFile(
			path.join(root, `.versionless/cache/tier-f/${config.id}/${archiveSha}/manifest.json`),
			'utf8',
		),
	) as Record<string, unknown>;
	requirePortableJson(cachedManifest);
	if (hashBytes(archiveBytes) !== archiveSha) throw new Error('Offline archive tamper detected');
	const index = indexTarGzip(
		{
			bytes: archiveBytes,
			byteLength: archiveBytes.byteLength,
			sha256: archiveSha,
		},
		verifiedConfig.commit,
	);
	if (verifiedConfig.id === 'next-killedbygoogle') {
		if (
			provenance.officialTreeRowCount !== 86 ||
			!Array.isArray(provenance.officialTree) ||
			provenance.officialTree.length !== 86
		)
			throw new Error('Offline T124 exact 86-row tree proof is absent');
		const officialTree = provenance.officialTree as TreeRow[];
		if (
			officialTree.some((row) => {
				const segments = typeof row.path === 'string' ? row.path.split('/') : [];
				return (
					!row.path ||
					path.isAbsolute(row.path) ||
					row.path.includes('\\') ||
					segments.some((segment) => !segment || segment === '.' || segment === '..') ||
					(row.type !== 'blob' && row.type !== 'tree') ||
					!isLowercaseCommit(row.sha) ||
					(row.type === 'tree'
						? row.mode !== '040000'
						: row.mode !== '100644' && row.mode !== '100755')
				);
			})
		)
			throw new Error('Offline T124 tree rows are malformed or contain submodules');
		const officialBlobPaths = officialTree
			.filter((row) => row.type === 'blob')
			.map((row) => row.path)
			.sort((left, right) => left.localeCompare(right));
		requireOfficialTreeInventory(index, officialBlobPaths);
		const archiveRecords = ledger.filter((record) => record.name.startsWith('archive-copy-'));
		if (
			archiveRecords.length !== 2 ||
			archiveRecords.some((record) => record.sha256 !== archiveSha)
		)
			throw new Error('Offline T124 repeated archive identity mismatch');
		for (const reliedPath of T124_REQUIRED_PATHS) {
			const expectedHash = findArchiveFile(index, reliedPath).sha256;
			const rawRecords = ledger.filter((record) => record.name.endsWith(`:${reliedPath}`));
			if (
				rawRecords.length !== 2 ||
				rawRecords.some((record) => record.sha256 !== expectedHash)
			)
				throw new Error(
					`Offline T124 repeated raw/archive identity mismatch for ${reliedPath}`,
				);
		}
		const facts = requireT124HistoricalFacts(index);
		if (
			JSON.stringify(facts) !== JSON.stringify(fixture.corroboratedLeadFacts) ||
			JSON.stringify(facts) !== JSON.stringify(provenance.corroboratedLeadFacts)
		)
			throw new Error('Offline T124 historical fact corroboration mismatch');
	}
	if (verifiedConfig.id === 'next-tailwind-starter-blog') {
		if (provenance.officialTreeRowCount !== 138 || !Array.isArray(provenance.officialTree))
			throw new Error('Offline T136 exact 138-row tree proof is absent');
		const officialTree = provenance.officialTree as TreeRow[];
		requireExactTreeRows(officialTree, 138, 'T138');
		const officialBlobPaths = officialTree
			.filter((row) => row.type === 'blob')
			.map((row) => row.path)
			.sort((left, right) => left.localeCompare(right));
		requireOfficialTreeInventory(index, officialBlobPaths);
		const archiveRecords = ledger.filter((record) => record.name.startsWith('archive-copy-'));
		if (
			archiveRecords.length !== 2 ||
			archiveRecords.some((record) => record.sha256 !== archiveSha)
		)
			throw new Error('Offline T136 repeated archive identity mismatch');
		for (const reliedPath of T136_REQUIRED_PATHS) {
			const expectedHash = findArchiveFile(index, reliedPath).sha256;
			const rawRecords = ledger.filter((record) => record.name.endsWith(`:${reliedPath}`));
			if (
				rawRecords.length !== 2 ||
				rawRecords.some((record) => record.sha256 !== expectedHash)
			)
				throw new Error(
					`Offline T136 repeated raw/archive identity mismatch for ${reliedPath}`,
				);
		}
		const facts = requireT136HistoricalFacts(index);
		if (
			JSON.stringify(facts) !== JSON.stringify(fixture.corroboratedLeadFacts) ||
			JSON.stringify(facts) !== JSON.stringify(provenance.corroboratedLeadFacts)
		)
			throw new Error('Offline T136 historical fact corroboration mismatch');
	}
	if (verifiedConfig.id === 'next-nextchat') requireT108PackageFacts(index);
	if (
		index.manifestSha256 !== provenance.fileManifestSha256 ||
		index.files.length !== provenance.fileCount ||
		JSON.stringify(index.globalMetadata) !==
			JSON.stringify(provenance.acceptedGlobalMetadata) ||
		JSON.stringify(index.pathMetadata) !== JSON.stringify(provenance.acceptedPathMetadata)
	)
		throw new Error('Offline archive manifest recomputation failed');
	if (
		cachedManifest.schemaVersion !== 'versionless.archive-file-manifest.v1' ||
		cachedManifest.archiveSha256 !== archiveSha ||
		cachedManifest.manifestSha256 !== index.manifestSha256 ||
		JSON.stringify(cachedManifest.files) !== JSON.stringify(fileManifest(index))
	)
		throw new Error('Offline cached manifest recomputation failed');
	const licensePath = provenance.rootLicense?.path as string;
	if (requireRootMitLicense(index, licensePath).sha256 !== provenance.rootLicense?.sha256)
		throw new Error('Offline license tamper detected');
	if (
		JSON.stringify(licensingInventory(index, verifiedConfig, licensePath)) !==
		JSON.stringify(provenance.licensing)
	)
		throw new Error('Offline licensing inventory recomputation failed');
	requireCompleteAssetClassifications(index, provenance.assets);
	const boundaries = inspectFixtureBoundaries(index, verifiedConfig);
	if (
		JSON.stringify(boundaries.excludedCommittedDist) !==
			JSON.stringify(provenance.excludedCommittedDist ?? []) ||
		(boundaries.compatibleNotice?.sha256 ?? null) !==
			(provenance.nestedCompatibleLicense?.sha256 ?? null)
	)
		throw new Error('Offline license or committed-dist boundary recomputation failed');
	const expectedFileManifest = fileManifest(index);
	if (JSON.stringify(expectedFileManifest) !== JSON.stringify(provenance.files))
		throw new Error('Offline file receipt recomputation failed');
	return hashBytes(Buffer.concat([fixtureBytes, provenanceBytes, evidenceBytes]));
}

function selectedFixtures(args: readonly string[]): FixtureConfig[] {
	const ids: string[] = [];
	for (let index = 0; index < args.length; index++)
		if (args[index] === '--fixture' && args[index + 1]) ids.push(args[index + 1]!);
	return ids.map((id) => {
		const fixture = fixtures.find((candidate) => candidate.id === id);
		if (!fixture) throw new Error(`Unknown pair-ingest fixture: ${id}`);
		return fixture;
	});
}

export function pairDescriptorFor(
	selected: readonly Pick<FixtureConfig, 'id'>[],
): PairTaskDescriptor {
	const ids = selected.map((fixture) => fixture.id);
	const descriptor = pairTaskDescriptors.find(
		(candidate) => JSON.stringify(candidate.fixtureIds) === JSON.stringify(ids),
	);
	if (!descriptor) throw new Error('Selected fixtures are not an exact authorized task pair');
	return descriptor;
}

export function taskDescriptorFor(selected: readonly Pick<FixtureConfig, 'id'>[]): TaskDescriptor {
	if (selected.length === 1 && selected[0]?.id === t138TaskDescriptor.fixtureIds[0])
		return t142TaskDescriptor;
	if (selected.length === 1 && selected[0]?.id === t106TaskDescriptor.fixtureIds[0])
		return t128TaskDescriptor;
	if (selected.length === 1 && selected[0]?.id === t108TaskDescriptor.fixtureIds[0])
		throw new Error('Consumed T108 fixture dispatch is permanently refused before GET');
	return pairDescriptorFor(selected);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const selected = selectedFixtures(args);
	if (!selected.length)
		throw new Error('At least one exact fixture-ingest candidate is required');
	const descriptor = taskDescriptorFor(selected);
	if (args.includes('--verify-only')) {
		const digests = [];
		for (const fixture of selected)
			digests.push({
				fixture: fixture.id,
				canonicalOutputSha256: await verifyFixture(fixture, descriptor),
			});
		process.stdout.write(canonical({ networkAttempts: 0, fixtures: digests }));
		return;
	}
	const consentIndex = args.indexOf('--consent-id');
	const consentId = consentIndex === -1 ? undefined : args[consentIndex + 1];
	if (descriptor.taskId === 'T128') await ingestT128(selected, consentId);
	else if (descriptor.taskId === 'T136') await ingestT136(selected, consentId);
	else if (descriptor.taskId === 'T138') await ingestT138(selected, consentId);
	else if (descriptor.taskId === 'T142') await ingestT142(selected, consentId);
	else if (descriptor.taskId === 'T106') await ingestT106(selected, consentId);
	else if (descriptor.taskId === 'T108') await ingestT108(selected, consentId);
	else await ingest(selected, consentId, descriptor);
}

if (process.argv[1]?.endsWith('tier-f-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
