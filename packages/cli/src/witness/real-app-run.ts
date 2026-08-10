import { spawn } from 'node:child_process';
import {
	access,
	cp,
	lstat,
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from 'pathe';
import { box, runBoxes, type BoxContext, type PageHandle, type PageRecord } from '@async/witness';
import { joinURL, parseURL, stringifyParsedURL } from 'ufo';
import {
	canonicalize,
	parseWitnessRealAppReceipt,
	sha256,
	WITNESS_REAL_APP_SCHEMA,
	witnessRealAppDigest,
	type WitnessMutationProof,
	type WitnessNextPrerenderPayloadEvidence,
	type WitnessOfflineEvidence,
	type WitnessRealAppReceipt,
	type WitnessRealAppRun,
	type WitnessServiceWorkerTelemetry,
} from '../../../core/src/index.ts';
import { transformNext12DerivedStateToMemo } from '../../../frameworks/nextjs/src/index.ts';
import { witnessNodeFileSystem } from './node-filesystem.ts';
import {
	createPlaywrightWitnessHost,
	type PlaywrightWitnessHost,
	type ServiceWorkerTelemetry,
	type WitnessDifferentialEvent,
	type WitnessTransportDecision,
	type WitnessTransportRequest,
} from './playwright-host.ts';
import { verifyLinkedWitnessProvenance } from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const stageRoot = join(root, '.versionless/stage/witness-real-app');
const chromiumExecutable = join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
const killedByGoogleArchive = join(
	root,
	'.versionless/cache/tier-f/next-killedbygoogle/c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d/source.tar.gz',
);
const killedByGoogleMirror = join(
	root,
	'.versionless/cache/next-killedbygoogle-dependencies/a676ee932cef5e54d469dc6d1e040e50f42f9cc88beb16ae5c72c13e26ebc48a/mirror',
);
const EXPECTED_KILLED_BY_GOOGLE_ARCHIVE =
	'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d';

type App = 'react-boilerplate' | 'angular-phonecat' | 'killedbygoogle' | 'angular-realworld';
type Lane = 'baseline' | 'migrated';
type JourneyEvidence = {
	assertions: string[];
	offlineEvidence: WitnessOfflineEvidence;
	timeoutTelemetry?: ServiceWorkerTelemetry;
	zeroServiceWorker?: {
		checkpoints: Array<{
			phase: 'before-interactions' | 'after-interactions' | 'after-online-reload';
			state: 'timeout';
			registrations: 0;
			controller: null;
			cacheNames: [];
			workerEvents: [];
		}>;
	};
};
type JourneyTransportEvidence = { apiUsernames: string[] };
type JourneyLifecycle = {
	serviceWorkerTelemetry(timeoutMs: number): Promise<ServiceWorkerTelemetry>;
	staticRequests(): string[];
	expectedServiceWorker: {
		cacheNames: string[];
		cacheEntries: Array<{ name: string; paths: string[] }>;
	} | null;
	phonecatOrdering: {
		names: string[];
		datasetSha256: string;
		orderSha256: string;
	} | null;
	phonecatImages: {
		detailSha256: string;
		defaultImage: string;
		nonDefaultImage: string;
	} | null;
};
type AppSpec = {
	app: App;
	framework: WitnessRealAppRun['framework'];
	canonicalReceipt: string;
	canonicalDigest: string;
	sources: Record<Lane, string>;
	initialRoute?: string;
	journey(
		context: BoxContext,
		page: PageHandle,
		transportEvidence: JourneyTransportEvidence,
		lifecycle: JourneyLifecycle,
	): Promise<JourneyEvidence>;
	transport?(
		request: WitnessTransportRequest,
		transportEvidence: JourneyTransportEvidence,
	): Promise<WitnessTransportDecision>;
};

export const ANGULAR_REALWORLD_TERMINAL_MARKER =
	'VERSIONLESS ANGULAR MIGRATION EVIDENCE COMPLETE' as const;
export const ANGULAR_REALWORLD_ARTICLE_BODY = `## Baseline identity

The baseline lane serves the pinned Angular 15 production-AOT output without rebuilding or rewriting application bytes. Its immutable archive, source revision, dependency closure, and generated static inventory remain bound to the canonical migration receipt.

The local article is evidence data supplied through the normal RealWorld API contract. It does not modify the application, inject markup, or substitute browser behavior.

## Adjacent-major migration

The migrated lane serves the independently prepared Angular 16 production-AOT output. The application source delta is limited to the recorded adjacent-major migration, while this qualification compares user-observable behavior across the two retained outputs.

Both lanes render the same feed record, open the same article slug, preserve the same title and author, and navigate through the same registration surface.

## Direct Witness interaction

Every click, type, key press, hover, and wheel action is issued through the directly linked Witness implementation. Playwright supplies the low-level browser host, but it does not replace or synthesize the selected user interactions.

The journey records route changes, tracked browser events, console messages, page errors, failed requests, and owned observer shutdown for each qualification pass.

## Production-static bytes

Each run inventories the complete static directory before serving it and again after the browser closes. The directory digest, application document digest, file count, and absence of development controls must remain exact.

The bounded loopback server rejects traversal, returns missing assets as missing, and uses the application document only for browser document navigation.

## Local API projection

One immutable article record is projected through exact list and detail envelopes. The comments route returns an exact empty comments envelope, while unknown article subpaths fail closed instead of inheriting a general response.

External styles and the RealWorld API are fulfilled locally. Successful non-loopback traffic remains zero, and the evidence does not claim operating-system-wide isolation.

## Behavioral parity

Two baseline passes and two migrated passes must produce one normalized behavioral digest. Production file hashes remain lane-specific and are verified separately rather than erased from the static-byte evidence.

The article title, registration heading, tracked events, navigation paths, and clean-page outcome are required in every pass.

## Mutation and restoration

A staged migrated copy receives one causal bootstrap-root mutation. Witness must report the intended semantic failure, after which the exact original bytes are restored and the complete journey must pass again.

The mutation never touches the immutable source worktree or retained production output. Restoration is accepted only when the application document hash is byte-identical.

## Assurance boundary

This fixture-specific evidence establishes reproducibility and hash integrity for one Angular 15-to-16 lineage. It does not establish generic Angular support, a designated pilot, certification, signer authenticity, compliance, an earned SLSA level, or operating-system-wide isolation.

${ANGULAR_REALWORLD_TERMINAL_MARKER}` as const;

export const ANGULAR_REALWORLD_ARTICLE = Object.freeze({
	slug: 'versionless-angular',
	title: 'Versionless Angular baseline',
	description: 'Synthetic local evidence for the immutable Angular baseline.',
	body: ANGULAR_REALWORLD_ARTICLE_BODY,
	tagList: Object.freeze(['migration']),
	createdAt: '2026-08-08T00:00:00.000Z',
	updatedAt: '2026-08-08T00:00:00.000Z',
	favorited: false,
	favoritesCount: 0,
	author: Object.freeze({
		username: 'versionless',
		bio: '',
		image: '',
		following: false,
	}),
});

function angularJson(value: unknown): WitnessTransportDecision {
	return {
		action: 'fulfill',
		status: 200,
		contentType: 'application/json',
		body: Buffer.from(JSON.stringify(value)),
	};
}

export async function angularRealworldTransport(
	request: WitnessTransportRequest,
): Promise<WitnessTransportDecision> {
	if (request.pathname === '/api/tags') return angularJson({ tags: ['migration', 'angular'] });
	if (request.pathname === '/api/articles/versionless-angular/comments')
		return angularJson({ comments: [] });
	if (request.pathname === '/api/articles/versionless-angular')
		return angularJson({ article: ANGULAR_REALWORLD_ARTICLE });
	if (request.pathname === '/api/articles')
		return angularJson({ articlesCount: 1, articles: [ANGULAR_REALWORLD_ARTICLE] });
	if (request.pathname.startsWith('/api/articles/'))
		throw new Error(`Angular RealWorld local API refuses unknown path: ${request.pathname}`);
	return {
		action: 'fulfill',
		status: 204,
		contentType: 'text/plain',
		body: Buffer.alloc(0),
	};
}

type StaticInventory = {
	files: number;
	digest: string;
	applicationSha256: string;
	serviceWorkers: Array<{ path: string; sha256: string }>;
};
type StaticResponseLedgerEntry = {
	method: string;
	pathname: string;
	query: string;
	destination: string;
	resolvedFile: string | null;
	status: number;
	mime: string;
	bytes: number;
	sha256: string;
};

type LegacyMainPrecacheResponse = {
	method: 'GET';
	pathname: string;
	query: '?__uncache=versionless-deterministic';
	destination: 'empty';
	resolvedFile: string;
	status: 200;
	mime: string;
	bytes: number;
	sha256: string;
	urlPath: string;
	source: 'production-static-origin';
};
type NextPrerenderPayloadInput = Omit<
	Extract<WitnessNextPrerenderPayloadEvidence, { state: 'exact-lane-bound-next-prerender' }>,
	'response'
>;

const CONTENT_TYPES: Record<string, string> = {
	'.css': 'text/css',
	'.gif': 'image/gif',
	'.html': 'text/html',
	'.ico': 'image/x-icon',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.js': 'text/javascript',
	'.json': 'application/json',
	'.map': 'application/json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
};

async function staticInventory(staticRoot: string): Promise<StaticInventory> {
	const entries: Array<{ path: string; sha256: string }> = [];
	const visit = async (directory: string): Promise<void> => {
		for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
			a.name.localeCompare(b.name),
		)) {
			const path = join(directory, entry.name);
			if (entry.isSymbolicLink())
				throw new Error('Witness production-static inventory rejects symbolic links');
			if (entry.isDirectory()) await visit(path);
			else if (entry.isFile())
				entries.push({
					path: relative(staticRoot, path),
					sha256: sha256(await readFile(path)),
				});
			else throw new Error('Witness production-static inventory contains a non-file entry');
		}
	};
	await visit(staticRoot);
	entries.sort((a, b) => a.path.localeCompare(b.path));
	const application = entries.find((entry) => entry.path === 'index.html');
	if (application === undefined) throw new Error('Witness production-static index is absent');
	return {
		files: entries.length,
		digest: sha256(canonicalize(entries)),
		applicationSha256: application.sha256,
		serviceWorkers: entries.filter((entry) => entry.path === 'sw.js'),
	};
}

function safeStaticPath(staticRoot: string, requestUrl: string): string | null {
	let pathname: string;
	try {
		pathname = decodeURIComponent(parseURL(requestUrl).pathname || '/');
	} catch {
		return null;
	}
	if (
		pathname.includes('\\') ||
		pathname.includes('\0') ||
		pathname.split('/').some((part) => part === '..')
	)
		return null;
	let relativePath = normalize(pathname);
	while (relativePath.startsWith('/')) relativePath = relativePath.slice(1);
	const file = resolve(staticRoot, relativePath === '' ? 'index.html' : relativePath);
	const fromRoot = relative(staticRoot, file);
	if (fromRoot === '..' || fromRoot.startsWith('../') || isAbsolute(fromRoot)) return null;
	return file;
}

async function readStaticFile(file: string): Promise<{ file: string; body: Buffer } | null> {
	const details = await lstat(file).catch(() => null);
	if (details === null || details.isSymbolicLink()) return null;
	const resolved = details.isDirectory() ? join(file, 'index.html') : file;
	const resolvedDetails = await lstat(resolved).catch(() => null);
	if (resolvedDetails === null || !resolvedDetails.isFile() || resolvedDetails.isSymbolicLink())
		return null;
	return { file: resolved, body: await readFile(resolved) };
}

export type StaticServerApiResponse = {
	status: number;
	contentType: string;
	body: Buffer;
};
export type StaticServerApiRequest = {
	method: string;
	pathname: string;
	search: string;
};

export async function startStaticServer(
	staticRoot: string,
	options: {
		profile?: 'current-witness' | 'canonical-t060';
		diagnosticEvent?: (
			event: Omit<WitnessDifferentialEvent, 'sequence' | 'timestampMs'>,
		) => void;
		api?: (request: StaticServerApiRequest) => Promise<StaticServerApiResponse | null>;
		upgrade?: (
			request: IncomingMessage,
			socket: Duplex,
			head: Buffer,
		) => void | Promise<void>;
	} = {},
): Promise<{
	origin: string;
	close(): Promise<void>;
	assertClean(): void;
	requests(): string[];
	ledger(): StaticResponseLedgerEntry[];
}> {
	const failures: string[] = [];
	const requests: string[] = [];
	const ledger: StaticResponseLedgerEntry[] = [];
	const server: Server = createServer((request, response) => {
		void (async () => {
			const parsedRequest = parseURL(request.url ?? '/');
			const pathname = parsedRequest.pathname || '/';
			const urlPath = `${pathname}${parsedRequest.search ?? ''}`;
			options.diagnosticEvent?.({
				source: 'static-server',
				phase: 'start',
				urlPath,
				detail: {},
			});
			request.once('aborted', () =>
				options.diagnosticEvent?.({
					source: 'static-server',
					phase: 'abort',
					urlPath,
					detail: {},
				}),
			);
			requests.push(pathname);
			const complete = (
				status: number,
				mime: string,
				body: Buffer,
				resolvedFile: string | null,
			): void => {
				response.once('finish', () => {
					ledger.push({
						method: request.method ?? 'GET',
						pathname,
						query: parsedRequest.search ?? '',
						destination:
							typeof request.headers['sec-fetch-dest'] === 'string'
								? request.headers['sec-fetch-dest']
								: '',
						resolvedFile,
						status,
						mime,
						bytes: body.length,
						sha256: sha256(body),
					});
					options.diagnosticEvent?.({
						source: 'static-server',
						phase: 'finish',
						urlPath,
						detail: { status, bytes: body.length, sha256: sha256(body), mime },
					});
				});
				response.writeHead(status, {
					...(options.profile === 'canonical-t060'
						? {}
						: { 'cache-control': 'no-store' }),
					'content-type':
						options.profile === 'canonical-t060' &&
						(mime === 'text/html' || mime === 'text/javascript')
							? `${mime}; charset=utf-8`
							: mime,
				});
				response.end(body);
			};
			if (options.api !== undefined) {
				const fulfilled = await options.api({
					method: request.method ?? 'GET',
					pathname,
					search: parsedRequest.search ?? '',
				});
				if (fulfilled !== null) {
					complete(fulfilled.status, fulfilled.contentType, fulfilled.body, null);
					return;
				}
			}
			const requestedFile = safeStaticPath(staticRoot, request.url ?? '/');
			if (requestedFile === null) {
				complete(400, 'text/plain', Buffer.from('invalid path'), null);
				return;
			}
			let result = await readStaticFile(requestedFile);
			if (result === null && request.headers['sec-fetch-dest'] === 'document')
				result = await readStaticFile(join(staticRoot, 'index.html'));
			if (result === null) {
				complete(404, 'text/plain', Buffer.from('not found'), null);
				return;
			}
			complete(
				200,
				CONTENT_TYPES[extname(result.file)] ?? 'application/octet-stream',
				result.body,
				relative(staticRoot, result.file),
			);
		})().catch((error: unknown) => {
			failures.push(error instanceof Error ? error.message : String(error));
			if (!response.headersSent) response.writeHead(500, { 'content-type': 'text/plain' });
			response.end('static server failure');
		});
	});
	server.requestTimeout = 15_000;
	server.headersTimeout = 10_000;
	if (options.upgrade !== undefined) {
		const upgrade = options.upgrade;
		server.on('upgrade', (request, socket, head) => {
			void (async () => {
				await upgrade(request, socket, head);
			})().catch((error: unknown) => {
				failures.push(error instanceof Error ? error.message : String(error));
				socket.destroy();
			});
		});
	}
	await new Promise<void>((resolveListen, rejectListen) => {
		server.once('error', rejectListen);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', rejectListen);
			resolveListen();
		});
	});
	const address = server.address();
	if (address === null || typeof address === 'string') throw new Error('static origin is absent');
	const origin = stringifyParsedURL({
		protocol: 'http:',
		host: `127.0.0.1:${(address as AddressInfo).port}`,
	});
	return {
		origin,
		close: async () =>
			void (await new Promise<void>((resolveClose, rejectClose) => {
				server.close((error) =>
					error === undefined ? resolveClose() : rejectClose(error),
				);
			})),
		assertClean: () => {
			if (failures.length > 0)
				throw new Error(`Witness production-static server failed: ${failures.join('; ')}`);
		},
		requests: () => [...requests],
		ledger: () => structuredClone(ledger),
	};
}

const BASELINE_REACT_CACHE_NAME = 'webpack-offline:versionless-deterministic';
const BASELINE_REACT_CACHE_BUST_QUERY = '?__uncache=versionless-deterministic';
const BASELINE_REACT_MAIN_ASSETS = [
	{ pathname: '/favicon.ico', resolvedFile: 'favicon.ico', mime: 'image/x-icon' },
	{
		pathname: '/2f1a976c9c35ffed9b7e23cf2cbf8f19.jpg',
		resolvedFile: '2f1a976c9c35ffed9b7e23cf2cbf8f19.jpg',
		mime: 'image/jpeg',
	},
	{
		pathname: '/runtime.bfb7866e5bd316b6a048.js',
		resolvedFile: 'runtime.bfb7866e5bd316b6a048.js',
		mime: 'text/javascript',
	},
	{ pathname: '/', resolvedFile: 'index.html', mime: 'text/html' },
] as const;
const BASELINE_REACT_CACHE_PATHS = [
	'/',
	'/14.2ef2b4a3d26bb1eb81fe.chunk.js',
	'/15.63e7c613fb32f7f731ca.chunk.js',
	'/16.87cd011ed2f020d4e6d4.chunk.js',
	'/17.d6848cc7cc19eb7fbec4.chunk.js',
	'/2f1a976c9c35ffed9b7e23cf2cbf8f19.jpg',
	'/3.a9fb20e5f448e036b4ad.chunk.js',
	'/__offline_webpack__data',
	'/favicon.ico',
	'/main.7bb4cda122f2e2a46418.chunk.js',
	'/npm.babel.a75018fd1b7c886eec7f.chunk.js',
	'/npm.connected-react-router.8fd4eda0f65262f02a5e.chunk.js',
	'/npm.intl-messageformat.7f32d245bfcb5c0501de.chunk.js',
	'/npm.intl-relativeformat.0c1d32cae8b23b70584f.chunk.js',
	'/npm.intl.1601d791a7de6967584b.chunk.js',
	'/npm.lodash.df83a9ce6a6ba2f8ebcb.chunk.js',
	'/npm.react-app-polyfill.02ee820043fb75ec004c.chunk.js',
	'/npm.react-intl.590480c86bf89f4d91b3.chunk.js',
	'/npm.react-redux.cba95f2d297d6dbfe0c6.chunk.js',
	'/npm.redux-saga.e4c67e286e17aab928d8.chunk.js',
	'/npm.webpack.59e68e65a7ea323c5295.chunk.js',
	'/runtime.bfb7866e5bd316b6a048.js',
].sort();

async function exactLegacyMainPrecacheResponses(
	laneRoot: string,
	ledger: StaticResponseLedgerEntry[],
): Promise<LegacyMainPrecacheResponse[]> {
	const responses: LegacyMainPrecacheResponse[] = [];
	for (const expected of BASELINE_REACT_MAIN_ASSETS) {
		const matches = ledger.filter(
			(entry) =>
				entry.pathname === expected.pathname &&
				entry.query === BASELINE_REACT_CACHE_BUST_QUERY,
		);
		if (matches.length !== 1)
			throw new Error(
				`React legacy main precache response cardinality differs: ${expected.pathname}${BASELINE_REACT_CACHE_BUST_QUERY}`,
			);
		const [entry] = matches;
		const body = await readFile(join(laneRoot, expected.resolvedFile));
		if (
			entry === undefined ||
			entry.method !== 'GET' ||
			entry.destination !== 'empty' ||
			entry.resolvedFile !== expected.resolvedFile ||
			entry.status !== 200 ||
			entry.mime !== expected.mime ||
			entry.bytes !== body.length ||
			entry.sha256 !== sha256(body)
		)
			throw new Error(
				`React legacy main precache response differs: ${expected.pathname}${BASELINE_REACT_CACHE_BUST_QUERY}`,
			);
		responses.push({
			method: 'GET',
			pathname: entry.pathname,
			query: BASELINE_REACT_CACHE_BUST_QUERY,
			destination: 'empty',
			resolvedFile: expected.resolvedFile,
			status: 200,
			mime: entry.mime,
			bytes: entry.bytes,
			sha256: entry.sha256,
			urlPath: `${entry.pathname}${entry.query}`,
			source: 'production-static-origin',
		});
	}
	return responses;
}

function exactNextPrerenderPayloadEvidence(
	laneRoot: string,
	ledger: StaticResponseLedgerEntry[],
	input: NextPrerenderPayloadInput,
): Extract<WitnessNextPrerenderPayloadEvidence, { state: 'exact-lane-bound-next-prerender' }> {
	const failed = ledger.filter((entry) => entry.status !== 200);
	if (failed.length !== 0)
		throw new Error(
			`KilledByGoogle local production-static response failed: ${canonicalize(failed)}`,
		);
	const matches = ledger.filter(
		(entry) => entry.pathname === input.dataRoute && entry.query === '',
	);
	if (matches.length !== 1)
		throw new Error(
			`KilledByGoogle prerender response cardinality differs: ${input.dataRoute}`,
		);
	const [entry] = matches;
	const stagedFile = join(laneRoot, input.stagedPath);
	if (
		entry === undefined ||
		entry.method !== 'GET' ||
		entry.destination !== 'empty' ||
		entry.resolvedFile !== input.stagedPath ||
		entry.status !== 200 ||
		entry.mime !== 'application/json' ||
		entry.bytes !== input.payload.bytes ||
		entry.sha256 !== input.payload.sha256
	)
		throw new Error(`KilledByGoogle prerender response differs: ${input.dataRoute}`);
	return {
		...input,
		response: {
			method: 'GET',
			pathname: entry.pathname,
			query: '',
			destination: 'empty',
			resolvedFile: relative(laneRoot, stagedFile),
			status: 200,
			mime: 'application/json',
			bytes: entry.bytes,
			sha256: entry.sha256,
		},
	};
}

async function expectedReactTelemetry(
	laneRoot: string,
	lane: Lane,
): Promise<{ cacheNames: string[]; cacheEntries: Array<{ name: string; paths: string[] }> }> {
	if (lane === 'baseline')
		return {
			cacheNames: [BASELINE_REACT_CACHE_NAME],
			cacheEntries: [{ name: BASELINE_REACT_CACHE_NAME, paths: BASELINE_REACT_CACHE_PATHS }],
		};
	const manifest = JSON.parse(
		await readFile(join(laneRoot, 'precache-manifest.json'), 'utf8'),
	) as {
		schemaVersion?: string;
		scope?: string;
		entries?: Array<{ url?: string }>;
	};
	if (
		manifest.schemaVersion !== 'versionless.react-vite8-precache.v1' ||
		manifest.scope !== '/' ||
		!Array.isArray(manifest.entries) ||
		manifest.entries.some((entry) => typeof entry.url !== 'string')
	)
		throw new Error('React migrated precache manifest differs');
	const cacheName = `versionless-react-vite8-${sha256(
		await readFile(join(laneRoot, 'precache-manifest.json')),
	)}`;
	return {
		cacheNames: [cacheName],
		cacheEntries: [
			{ name: cacheName, paths: manifest.entries.map((entry) => entry.url!).sort() },
		],
	};
}

async function expectedPhonecatOrdering(laneRoot: string): Promise<{
	names: string[];
	datasetSha256: string;
	orderSha256: string;
}> {
	const dataset = await readFile(join(laneRoot, 'phones/phones.json'));
	const phones = JSON.parse(dataset.toString('utf8')) as Array<{ name?: unknown }>;
	if (
		phones.length !== 20 ||
		phones.some((phone) => typeof phone.name !== 'string' || phone.name.length === 0)
	)
		throw new Error('PhoneCat immutable phone-name dataset differs');
	const names = phones
		.map((phone, sourceIndex) => ({ name: phone.name as string, sourceIndex }))
		.sort((left, right) => {
			const leftName = left.name.toLowerCase();
			const rightName = right.name.toLowerCase();
			if (leftName < rightName) return -1;
			if (leftName > rightName) return 1;
			return left.sourceIndex - right.sourceIndex;
		})
		.map((phone) => phone.name);
	return {
		names,
		datasetSha256: sha256(dataset),
		orderSha256: sha256(canonicalize(names)),
	};
}

async function expectedPhonecatImages(laneRoot: string): Promise<{
	detailSha256: string;
	defaultImage: string;
	nonDefaultImage: string;
}> {
	const detail = await readFile(join(laneRoot, 'phones/nexus-s.json'));
	const phone = JSON.parse(detail.toString('utf8')) as { images?: unknown };
	if (
		!Array.isArray(phone.images) ||
		phone.images.length < 2 ||
		phone.images.some((image) => typeof image !== 'string' || image.length === 0)
	)
		throw new Error('PhoneCat immutable Nexus S image dataset differs');
	const defaultImage = phone.images[0] as string;
	const nonDefaultImage = phone.images.find((image) => image !== defaultImage) as
		| string
		| undefined;
	if (nonDefaultImage === undefined)
		throw new Error('PhoneCat immutable Nexus S non-default image is absent');
	return { detailSha256: sha256(detail), defaultImage, nonDefaultImage };
}

const clean = async (context: BoxContext, page: PageHandle, navigations: number): Promise<void> => {
	await context.expect.page.outcome(page, {
		navigations,
		consoleErrors: 0,
		failedRequests: 0,
	});
};

const apps: AppSpec[] = [
	{
		app: 'react-boilerplate',
		framework: 'react',
		canonicalReceipt: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
		canonicalDigest: '52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21',
		sources: {
			baseline: '.versionless/work/react-boilerplate-v4-composed/legacy/build',
			migrated: '.versionless/work/react-boilerplate-v4-composed/target/build-vite',
		},
		transport: async (request, transportEvidence) => {
			const payload = await readFile(
				join(root, 'fixtures/react-boilerplate-v4-data-flow/repos.json'),
			);
			if (request.host === 'api.github.com') {
				const parts = request.pathname.split('/').filter(Boolean);
				if (parts.length === 3 && parts[0] === 'users' && parts[2] === 'repos')
					transportEvidence.apiUsernames.push(decodeURIComponent(parts[1]!));
				return {
					action: 'fulfill',
					status: 200,
					contentType: 'application/json',
					body: payload,
				};
			}
			if (request.host === 'fonts.googleapis.com')
				return {
					action: 'fulfill',
					status: 200,
					contentType: 'text/css',
					body: Buffer.from(
						'@font-face { font-family: "Open Sans"; src: local("Arial"); font-style: normal; font-weight: 400 700; }',
					),
				};
			return {
				action: 'fulfill',
				status: 204,
				contentType: 'text/plain',
				body: Buffer.alloc(0),
			};
		},
		journey: async (context, page, transportEvidence, lifecycle) => {
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');
			await page.click('a[href="/features"]');
			await context.expect.page.bodyText(page, { contains: 'Features' });
			await page.click('a[href="/"]');
			await page.click('select');
			await page.press('select', 'd');
			await context.expect.page.bodyText(page, {
				contains: 'Beginnen Sie Ihr nächstes React Projekt in Sekunden',
			});
			await page.hover('#username');
			await page.type('#username', 'octocat');
			await page.press('#username', 'Enter');
			await context.expect.page.bodyText(page, { contains: 'owned-repo' });
			await context.expect.page.bodyText(page, { contains: 'fork-owner/forked-repo' });
			await page.scroll(null, { y: 500 });
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 3 },
					input: { atLeast: 1 },
					change: { atLeast: 1 },
					keydown: { atLeast: 1 },
					mouseover: { atLeast: 1 },
				},
			});
			if (lifecycle.expectedServiceWorker === null)
				throw new Error('React service-worker expectation is absent');
			const readyTelemetry = await lifecycle.serviceWorkerTelemetry(10_000);
			if (readyTelemetry.state === 'timeout')
				return {
					assertions: ['service-worker readiness diagnostic'],
					offlineEvidence: { state: 'not-applicable' },
					timeoutTelemetry: readyTelemetry,
				};
			if (
				readyTelemetry.registration.scriptPath !== '/sw.js' ||
				readyTelemetry.registration.scope !== '/' ||
				readyTelemetry.registration.active !== 'activated' ||
				canonicalize({
					cacheNames: readyTelemetry.cacheNames,
					cacheEntries: readyTelemetry.cacheEntries,
				}) !== canonicalize(lifecycle.expectedServiceWorker)
			)
				throw new Error('React ready service-worker cache inventory differs');
			const readyLifecycle = readyTelemetry as WitnessServiceWorkerTelemetry;
			await page.reload();
			const controlledTelemetry = await lifecycle.serviceWorkerTelemetry(10_000);
			if (controlledTelemetry.state === 'timeout')
				return {
					assertions: ['service-worker controller diagnostic'],
					offlineEvidence: { state: 'not-applicable' },
					timeoutTelemetry: controlledTelemetry,
				};
			if (
				controlledTelemetry.registration.scriptPath !== '/sw.js' ||
				controlledTelemetry.registration.scope !== '/' ||
				controlledTelemetry.registration.active !== 'activated' ||
				controlledTelemetry.controller !== 'activated' ||
				canonicalize({
					cacheNames: controlledTelemetry.cacheNames,
					cacheEntries: controlledTelemetry.cacheEntries,
				}) !== canonicalize(lifecycle.expectedServiceWorker)
			)
				throw new Error(
					'React service worker did not control the exact cached application',
				);
			const controlledLifecycle = controlledTelemetry as WitnessServiceWorkerTelemetry & {
				controller: 'activated';
			};
			const onlineRequests = [...new Set(lifecycle.staticRequests())].sort();
			const precachePaths = lifecycle.expectedServiceWorker.cacheEntries[0]!.paths.filter(
				(path) => path !== '/__offline_webpack__data',
			);
			if (
				!onlineRequests.includes('/sw.js') ||
				precachePaths.some((path) => !onlineRequests.includes(path))
			)
				throw new Error(
					'React online service-worker or precache request inventory differs',
				);
			const requestsBeforeOffline = lifecycle.staticRequests().length;
			await page.emulateNetwork({
				offline: true,
				latencyMs: 0,
				downloadThroughputBytesPerSecond: -1,
				uploadThroughputBytesPerSecond: -1,
			});
			await page.reload();
			await context.expect.page.bodyText(page, {
				contains: 'Start your next react project in seconds',
				notContains: 'owned-repo',
			});
			await context.expect.page.bodyText(page, { notContains: 'fork-owner/forked-repo' });
			const offlineServerRequests = lifecycle.staticRequests().length - requestsBeforeOffline;
			if (offlineServerRequests !== 0)
				throw new Error('React offline reload reached the production-static server');
			await page.clearNetworkEmulation();
			await page.type('#username', 'reset-proof');
			await page.press('#username', 'Enter');
			await context.expect.page.bodyText(page, { contains: 'owned-repo' });
			if (transportEvidence.apiUsernames.join(',') !== 'octocat,reset-proof')
				throw new Error('React username state did not reset after offline reload');
			await clean(context, page, 4);
			return {
				assertions: [
					'feature route',
					'keyboard locale selection',
					'canonical repository payload',
					'offline shell render and state reset',
					'clean page',
				],
				offlineEvidence: {
					state: 'react-shell-rendered-state-reset',
					shellRendered: true,
					usernameReset: true,
					repositoriesReset: true,
					apiResponseCaching: 'not-claimed',
					reduxPersistence: 'not-implemented',
					priorResultPersistence: 'not-implemented',
					harnessFulfillment: 'synthetic-github-route-online-only',
					serviceWorkerEvidence: {
						source: 'canonical-t060',
						receiptPath: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
						canonicalDigest:
							'52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21',
						newProof: false,
					},
					lifecycle: {
						state: 'ready-online-reload-controlled-offline-reset',
						ready: readyLifecycle,
						controlled: controlledLifecycle,
						onlineStaticPaths: onlineRequests,
						offlineServerRequests: 0,
					},
				},
			};
		},
	},
	{
		app: 'angular-phonecat',
		framework: 'angularjs',
		canonicalReceipt: 'evidence/runs/angular-phonecat-composed/t048-run.json',
		canonicalDigest: 'a7e8a9dc864085d77338f1615e3434a8a842fa5f4156a13bd2f5560bd2f8dc12',
		sources: {
			baseline: '.versionless/work/angular-phonecat-composed/legacy/app',
			migrated: '.versionless/work/angular-phonecat-composed/target/app',
		},
		initialRoute: '/#!/phones',
		journey: async (context, page, _transportEvidence, lifecycle) => {
			const query = 'input[ng-model="$ctrl.query"]';
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');
			await page.type(query, 'nexus');
			await context.expect.page.count(page, 'ul.phones > li', 1);
			for (let index = 0; index < 5; index += 1) await page.press(query, 'Backspace');
			await context.expect.page.count(page, 'ul.phones > li', 20);
			await page.click('select');
			await page.press('select', 'a');
			await context.expect.page.exists(page, 'select option[value="name"]:checked');
			await context.expect.page.outcome(page, { events: { change: { atLeast: 1 } } });
			if (lifecycle.phonecatOrdering === null)
				throw new Error('PhoneCat data-derived ordering expectation is absent');
			for (const [index, name] of lifecycle.phonecatOrdering.names.entries())
				await context.expect.page.text(
					page,
					`ul.phones > li:nth-child(${index + 1}) a:not(.thumb)`,
					name,
				);
			await page.type(query, 'nexus');
			await page.click('ul.phones a:not(.thumb)');
			await context.expect.page.text(page, 'h1', 'Nexus S');
			if (lifecycle.phonecatImages === null)
				throw new Error('PhoneCat data-derived image expectation is absent');
			await context.expect.page.attribute(
				page,
				'img.phone.selected',
				'src',
				lifecycle.phonecatImages.defaultImage,
			);
			const nonDefaultThumbnail = `ul.phone-thumbs img[ng-src=${JSON.stringify(
				lifecycle.phonecatImages.nonDefaultImage,
			)}]`;
			await page.hover(nonDefaultThumbnail);
			await context.expect.page.outcome(page, { events: { mouseover: { atLeast: 1 } } });
			await page.click(nonDefaultThumbnail);
			await context.expect.page.attribute(
				page,
				'img.phone.selected',
				'src',
				lifecycle.phonecatImages.nonDefaultImage,
			);
			await page.hover('img.phone.selected');
			await page.scroll(null, { y: 500 });
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 3 },
					input: { atLeast: 2 },
					change: { atLeast: 1 },
					keydown: { atLeast: 2 },
					mouseover: { atLeast: 1 },
				},
			});
			await page.reload();
			await context.expect.page.text(page, 'h1', 'Nexus S');
			await clean(context, page, 2);
			return {
				assertions: [
					'filter',
					'keyboard selection change and alphabetical ordering',
					'detail route',
					'thumbnail swap',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
			};
		},
	},
	{
		app: 'killedbygoogle',
		framework: 'next',
		canonicalReceipt: 'evidence/runs/next-killedbygoogle-derived-state-to-memo/receipt.json',
		canonicalDigest: 'a018c6490cd559fab74ea402ff93660f053503dbed1a52ba9b68ed7fdc086b7c',
		sources: {
			baseline: '.versionless/stage/witness-real-app/killedbygoogle-retained/baseline',
			migrated: '.versionless/stage/witness-real-app/killedbygoogle-retained/migrated',
		},
		journey: async (context, page) => {
			const filter = '#react-select-filter-select-input';
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');
			await context.expect.page.count(page, 'ul > li h2', 263);
			await page.type('#searchBox', 'Google+');
			await context.expect.page.bodyText(page, { contains: 'Google+' });
			await context.expect.page.count(page, 'ul > li h2', 1);
			await page.press('#searchBox', 'a', {
				modifiers: process.platform === 'darwin' ? ['Meta'] : ['Control'],
			});
			await page.press('#searchBox', 'Backspace');
			await page.click(filter);
			await page.type(filter, 'Apps');
			await page.press(filter, 'Enter');
			await context.expect.page.bodyText(page, { contains: 'Apps (50)' });
			await context.expect.page.count(page, 'ul > li h2', 50);
			await page.hover('ul > li h2');
			await page.scroll(null, { y: 500 });
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 1 },
					input: { atLeast: 2 },
					keydown: { atLeast: 2 },
					mouseover: { atLeast: 1 },
				},
			});
			await clean(context, page, 0);
			return {
				assertions: ['search', 'keyboard filter', 'filtered inventory', 'clean page'],
				offlineEvidence: { state: 'not-applicable' },
			};
		},
	},
	{
		app: 'angular-realworld',
		framework: 'angular',
		canonicalReceipt: 'evidence/runs/angular-realworld-v15-to-v16/receipt.json',
		canonicalDigest: 'bba54bc67cf5686445b207c530e04c5f9d56cf87f495250e97329e1eed8c6ad1',
		sources: {
			baseline: '.versionless/work/angular-realworld-v15-to-v16/dist/legacy',
			migrated: '.versionless/work/angular-realworld-v15-to-v16/dist/target',
		},
		transport: angularRealworldTransport,
		journey: async (context, page) => {
			await page.trackEvents('click', 'input', 'keydown', 'mouseover');
			await context.expect.page.bodyText(page, { contains: 'Global Feed' });
			await page.click('a.tag-pill');
			await page.click('a.preview-link');
			await context.expect.page.text(page, 'h1', 'Versionless Angular baseline');
			await page.hover('h1');
			await context.expect.page.bodyText(page, {
				contains: ANGULAR_REALWORLD_TERMINAL_MARKER,
			});
			await page.scroll(null, { y: 500 });
			await page.click('a[routerlink="/register"]');
			await context.expect.page.text(page, 'h1', 'Sign up');
			await page.type('input[placeholder="Username"]', 'versionless-user');
			await page.press('input[placeholder="Username"]', 'a', {
				modifiers: ['Control'],
			});
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 3 },
					input: { atLeast: 1 },
					keydown: { atLeast: 1 },
					mouseover: { atLeast: 1 },
				},
			});
			await page.reload();
			await context.expect.page.text(page, 'h1', 'Sign up');
			await clean(context, page, 5);
			return {
				assertions: [
					'feed',
					'tag interaction',
					'article route',
					'terminal article section rendered before observed scroll',
					'keyboard-backed registration input',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
			};
		},
	},
];

async function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

async function execute(
	command: string,
	args: string[],
	cwd: string,
	environment: NodeJS.ProcessEnv,
): Promise<void> {
	await new Promise<void>((resolvePromise, reject) => {
		const child = spawn(command, args, { cwd, env: environment, stdio: 'inherit' });
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0 ? resolvePromise() : reject(new Error(`${command} exited ${code}`)),
		);
	});
}

async function fileCount(directory: string): Promise<number> {
	let count = 0;
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) count += await fileCount(join(directory, entry.name));
		else if (entry.isFile()) count += 1;
	}
	return count;
}

async function reconstructKilledByGoogle(): Promise<
	WitnessRealAppReceipt['killedByGoogleInventory']
> {
	const archiveSha256 = sha256(await readFile(killedByGoogleArchive));
	if (archiveSha256 !== EXPECTED_KILLED_BY_GOOGLE_ARCHIVE)
		throw new Error('KilledByGoogle immutable archive identity differs');
	const mirrorFiles = await fileCount(killedByGoogleMirror);
	if (mirrorFiles === 0) throw new Error('KilledByGoogle offline mirror is empty');
	const retained = join(stageRoot, 'killedbygoogle-retained');
	const node16 = join(root, '.versionless/cache/angular-phonecat/node16/bin/node');
	const yarn = join(process.env.HOME ?? '', '.cache/node/corepack/v1/yarn/1.22.22/bin/yarn.js');
	await rm(retained, { recursive: true, force: true });
	const sourceFiles = { baseline: 0, migrated: 0 };
	const buildFiles = { baseline: 0, migrated: 0 };
	for (const lane of ['baseline', 'migrated'] as const) {
		const source = join(retained, `${lane}-source`);
		await mkdir(source, { recursive: true });
		await execute(
			'/usr/bin/tar',
			['-xzf', killedByGoogleArchive, '-C', source, '--strip-components', '1'],
			root,
			process.env,
		);
		await writeFile(
			join(source, '.yarnrc'),
			`yarn-offline-mirror "${killedByGoogleMirror}"\nyarn-offline-mirror-pruning false\n`,
		);
		const environment = {
			PATH: `${dirname(node16)}:/usr/bin:/bin`,
			VERSIONLESS_NETWORK_MODE: 'offline',
			NPM_CONFIG_OFFLINE: 'true',
			YARN_ENABLE_NETWORK: '0',
			SKIP_YARN_COREPACK_CHECK: '1',
			NEXT_TELEMETRY_DISABLED: '1',
			CI: '1',
		};
		await execute(
			node16,
			[
				yarn,
				'install',
				'--frozen-lockfile',
				'--offline',
				'--ignore-scripts',
				'--non-interactive',
				'--cache-folder',
				join(source, '.yarn-cache'),
			],
			source,
			environment,
		);
		if (lane === 'migrated') {
			const appFile = join(source, 'components/App.tsx');
			const before = await readFile(appFile, 'utf8');
			const transformed = transformNext12DerivedStateToMemo(before);
			if (!transformed.changed || transformed.edits.length !== 3)
				throw new Error('KilledByGoogle retained target transform differs');
			await writeFile(appFile, transformed.code);
		}
		sourceFiles[lane] = await fileCount(source);
		await execute(
			node16,
			[join(source, 'node_modules/next/dist/bin/next'), 'build'],
			source,
			environment,
		);
		const output = join(retained, lane);
		await mkdir(join(output, '_next'), { recursive: true });
		await cp(join(source, '.next/server/pages/index.html'), join(output, 'index.html'));
		await cp(join(source, '.next/static'), join(output, '_next/static'), { recursive: true });
		await cp(join(source, 'public'), output, { recursive: true });
		buildFiles[lane] = await fileCount(output);
		if (buildFiles[lane] === 0)
			throw new Error(`KilledByGoogle ${lane} build inventory is empty`);
	}
	return { archiveSha256, mirrorFiles, sourceFiles, buildFiles, transformEdits: 3 };
}

async function bindCanonicalReceipts(): Promise<WitnessRealAppReceipt['canonicalReceipts']> {
	return await Promise.all(
		apps.map(async (app) => {
			const bytes = await readFile(join(root, app.canonicalReceipt));
			const value = JSON.parse(bytes.toString('utf8')) as {
				integrity?: { canonicalDigest?: string };
			};
			if (value.integrity?.canonicalDigest !== app.canonicalDigest)
				throw new Error(`${app.app} canonical receipt silently rebound`);
			return {
				app: app.app,
				path: app.canonicalReceipt,
				sha256: sha256(bytes),
				canonicalDigest: app.canonicalDigest,
			};
		}),
	);
}

async function stageInputs(): Promise<WitnessRealAppReceipt['killedByGoogleInventory']> {
	const inventory = await reconstructKilledByGoogle();
	await rm(join(stageRoot, 'lanes'), { recursive: true, force: true });
	for (const app of apps) {
		for (const lane of ['baseline', 'migrated'] as const) {
			const source = join(root, app.sources[lane]);
			if (!(await exists(source)))
				throw new Error(`${app.app} ${lane} retained browser output missing`);
			const destination = join(stageRoot, 'lanes', app.app, lane);
			await mkdir(destination, { recursive: true });
			await cp(source, destination, { recursive: true, force: false });
		}
	}
	return inventory;
}

function pageRecordFromReceipt(value: unknown): PageRecord {
	const receipt = value as { boxes?: Array<{ pages?: PageRecord[] }> };
	const page = receipt.boxes?.[0]?.pages?.[0];
	if (page === undefined)
		throw new Error('linked Witness receipt omitted the observed page record');
	return page;
}

function assertHmrFree(page: PageRecord): void {
	for (const url of [
		page.url,
		...page.navigations.map((navigation) => navigation.url),
		...page.networkRequests.map((request) => request.url),
	]) {
		const parsed = parseURL(url);
		const pathname = parsed.pathname || '';
		if (
			parsed.protocol === 'ws:' ||
			parsed.protocol === 'wss:' ||
			pathname === '/@vite/client' ||
			pathname.startsWith('/@id/') ||
			pathname.startsWith('/@fs/')
		)
			throw new Error(`Witness production-static journey imported HMR control: ${pathname}`);
	}
}

function normalizedRecord(page: PageRecord): WitnessRealAppRun['witnessRecord'] {
	return {
		interactions: page.interactions.map((interaction) => ({
			kind: interaction.kind as WitnessRealAppRun['interactions'][number]['kind'],
			selector:
				'selector' in interaction && typeof interaction.selector === 'string'
					? interaction.selector
					: 'viewport',
		})),
		navigationPaths: page.navigations.map((navigation) => {
			const parsed = parseURL(navigation.url);
			return `${parsed.pathname}${parsed.hash}`;
		}),
		trackedEventCounts: Object.fromEntries(
			Object.entries(page.trackedEvents).map(([name, events]) => [name, events.length]),
		),
		consoleErrors: page.consoleMessages.filter((message) => message.level === 'error').length,
		pageErrors: page.pageErrors.length,
		failedRequests: page.failedRequests.length,
	};
}

async function executeRun(
	app: AppSpec,
	lane: Lane,
	pass: 1 | 2,
	options: {
		laneRoot?: string;
		receiptRoot?: string;
		nextPrerenderPayload?: NextPrerenderPayloadInput;
		serviceWorkerPolicy?: 'canonical' | 'zero';
	} = {},
): Promise<WitnessRealAppRun> {
	const laneRoot = options.laneRoot ?? join(stageRoot, 'lanes', app.app, lane);
	const receiptDir = join(
		options.receiptRoot ?? join(stageRoot, 'witness-receipts'),
		app.app,
		lane,
		`pass-${pass}`,
	);
	await rm(receiptDir, { recursive: true, force: true });
	const beforeInventory = await staticInventory(laneRoot);
	const contextProfile =
		app.app === 'react-boilerplate' &&
		lane === 'baseline' &&
		options.serviceWorkerPolicy !== 'zero'
			? ('canonical-t060' as const)
			: ('current-witness' as const);
	const staticServer = await startStaticServer(laneRoot, { profile: contextProfile });
	const productionUrl = joinURL(staticServer.origin, app.initialRoute ?? '/');
	const transportEvidence: JourneyTransportEvidence = { apiUsernames: [] };
	const expectedServiceWorker =
		app.app === 'react-boilerplate' && options.serviceWorkerPolicy !== 'zero'
			? await expectedReactTelemetry(laneRoot, lane)
			: null;
	const phonecatOrdering =
		app.app === 'angular-phonecat' ? await expectedPhonecatOrdering(laneRoot) : null;
	const phonecatImages =
		app.app === 'angular-phonecat' ? await expectedPhonecatImages(laneRoot) : null;
	const differentialEvents: WitnessDifferentialEvent[] = [];
	const host = createPlaywrightWitnessHost({
		chromiumExecutable,
		contextProfile,
		transport:
			app.transport === undefined
				? undefined
				: async (request) => await app.transport!(request, transportEvidence),
		diagnosticEvent:
			options.serviceWorkerPolicy === 'zero'
				? (event) => differentialEvents.push(event)
				: undefined,
	});
	let journeyEvidence: JourneyEvidence | undefined;
	const definition = box(`${app.app}-${lane}-${pass}`, async (context) => {
		const page = await context.browser.visit(productionUrl);
		journeyEvidence = await app.journey(context, page, transportEvidence, {
			serviceWorkerTelemetry: host.serviceWorkerTelemetry,
			staticRequests: staticServer.requests,
			expectedServiceWorker,
			phonecatOrdering,
			phonecatImages,
		});
		await context.receipt.capture('journey-complete');
	});
	let result: Awaited<ReturnType<typeof runBoxes>>;
	try {
		result = await runBoxes({
			root: laneRoot,
			boxes: [
				{
					file: join(laneRoot, 'versionless-runtime.box.ts'),
					relativeFile: 'versionless-runtime.box.ts',
					exportName: 'default',
					box: definition,
				},
			],
			receiptDir,
			assertionTimeoutMs: 10_000,
			fileSystem: witnessNodeFileSystem,
			browser: host.browser,
			headless: true,
		});
	} finally {
		await staticServer.close();
	}
	staticServer.assertClean();
	const afterInventory = await staticInventory(laneRoot);
	if (canonicalize(beforeInventory) !== canonicalize(afterInventory))
		throw new Error(`${app.app} ${lane} served bytes changed during the journey`);
	const rawReceipt = JSON.parse(await readFile(result.receiptPath, 'utf8')) as unknown;
	const completedJourney = journeyEvidence as JourneyEvidence | undefined;
	const observerFinalization = host.serviceWorkerObserverFinalization();
	if (completedJourney?.timeoutTelemetry !== undefined) {
		const diagnostic = {
			schemaVersion: 'versionless.witness-real-app-sw-diagnostic.v1',
			result: 'timeout',
			app: app.app,
			lane,
			pass,
			telemetry: completedJourney.timeoutTelemetry,
			observerFinalization,
			staticLedger: staticServer.ledger(),
		};
		const diagnosticDirectory = join(stageRoot, 'diagnostics');
		await mkdir(diagnosticDirectory, { recursive: true });
		await writeFile(
			join(diagnosticDirectory, `${app.app}-${lane}-service-worker.json`),
			`${canonicalize(diagnostic)}\n`,
		);
		throw new Error(
			`linked Witness service-worker diagnostic timed out: ${canonicalize({ telemetry: diagnostic.telemetry, failedResponses: diagnostic.staticLedger.filter((entry) => entry.status !== 200) })}`,
		);
	}
	if (result.status !== 'passed' || completedJourney === undefined)
		throw new Error(
			`linked Witness runtime journey failed: ${result.boxes[0]?.error?.message ?? 'unknown failure'}; static paths: ${canonicalize(staticServer.requests())}`,
		);
	const pageRecord = pageRecordFromReceipt(rawReceipt);
	const legacyMainPrecache =
		app.app === 'react-boilerplate' &&
		lane === 'baseline' &&
		options.serviceWorkerPolicy !== 'zero'
			? {
					state: 'exact-completed' as const,
					responses: await exactLegacyMainPrecacheResponses(
						laneRoot,
						staticServer.ledger(),
					),
				}
			: { state: 'not-applicable' as const };
	const nextPrerenderPayload =
		options.nextPrerenderPayload === undefined
			? ({ state: 'not-applicable' } as const)
			: exactNextPrerenderPayloadEvidence(
					laneRoot,
					staticServer.ledger(),
					options.nextPrerenderPayload,
				);
	assertHmrFree(pageRecord);
	const witnessRecord = normalizedRecord(pageRecord);
	const interactions = witnessRecord.interactions;
	const trackedEvents = Object.entries(witnessRecord.trackedEventCounts)
		.filter(([, count]) => count > 0)
		.map(([name]) => name)
		.sort();
	const runWithoutDigest = {
		app: app.app,
		framework: app.framework,
		lane,
		interactions,
		assertions: completedJourney.assertions,
		routes: witnessRecord.navigationPaths,
		trackedEvents,
		witnessRecord,
		cleanPage: true as const,
		offlineEvidence: completedJourney.offlineEvidence,
		servedStatic: {
			transport: 'isolated-bounded-loopback-production-static' as const,
			documentFallback: 'index-only' as const,
			missingAssets: '404' as const,
			traversal: 'rejected' as const,
			inventory: {
				files: beforeInventory.files,
				beforeSha256: beforeInventory.digest,
				afterSha256: afterInventory.digest,
			},
			application: {
				path: 'index.html' as const,
				beforeSha256: beforeInventory.applicationSha256,
				afterSha256: afterInventory.applicationSha256,
			},
			serviceWorkers: beforeInventory.serviceWorkers.map((serviceWorker, index) => ({
				path: serviceWorker.path,
				beforeSha256: serviceWorker.sha256,
				afterSha256: afterInventory.serviceWorkers[index]!.sha256,
			})),
			byteIdentical: true as const,
			hmrControls: false as const,
			legacyMainPrecache,
			phonecatOrdering:
				phonecatOrdering === null
					? { state: 'not-applicable' as const }
					: {
							state: 'data-derived-full-order' as const,
							datasetSha256: phonecatOrdering.datasetSha256,
							orderSha256: phonecatOrdering.orderSha256,
							rows: 20 as const,
							comparator: 'stable-lowercase-utf16-source-order-ties' as const,
						},
			phonecatImageTransition:
				phonecatImages === null
					? { state: 'not-applicable' as const }
					: {
							state: 'data-derived-visible-transition' as const,
							detailSha256: phonecatImages.detailSha256,
							defaultImage: phonecatImages.defaultImage,
							nonDefaultImage: phonecatImages.nonDefaultImage,
							hover: 'genuine-thumbnail-mouseover' as const,
							transition: 'genuine-ng-click' as const,
							heroVisibility: 'genuine-hover' as const,
						},
			nextPrerenderPayload,
		},
		observerFinalization,
		...(completedJourney.zeroServiceWorker === undefined
			? {}
			: {
					zeroServiceWorker: {
						...completedJourney.zeroServiceWorker,
						outputFiles: beforeInventory.serviceWorkers,
						requests: differentialEvents.filter(
							(event) =>
								event.detail.serviceWorker === true ||
								event.urlPath === '/sw.js' ||
								event.urlPath === '/service-worker.js',
						),
						workerEvents: observerFinalization.workerEvents,
					},
				}),
		successfulNonLoopback: host.locality().successfulNonLoopback,
	};
	if ('zeroServiceWorker' in runWithoutDigest) {
		const zero = runWithoutDigest.zeroServiceWorker;
		if (
			zero === undefined ||
			zero.outputFiles.length !== 0 ||
			zero.requests.length !== 0 ||
			zero.workerEvents.length !== 0 ||
			zero.checkpoints.length !== 3 ||
			zero.checkpoints.some(
				(checkpoint) =>
					checkpoint.state !== 'timeout' ||
					checkpoint.registrations !== 0 ||
					checkpoint.controller !== null ||
					checkpoint.cacheNames.length !== 0 ||
					checkpoint.workerEvents.length !== 0,
			)
		)
			throw new Error('zero-service-worker policy assertion failed');
	}
	return {
		...runWithoutDigest,
		pass,
		result: 'pass',
		semanticDigest: sha256(canonicalize(runWithoutDigest)),
	};
}

export async function executeAngularRealworldWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	const app = apps.find((candidate) => candidate.app === 'angular-realworld');
	if (app === undefined) throw new Error('Angular RealWorld Witness specification is absent');
	return await executeRun(app, options.lane, options.pass, options);
}

export async function executeReactBoilerplateWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	const app = apps.find((candidate) => candidate.app === 'react-boilerplate');
	if (app === undefined) throw new Error('React Boilerplate Witness specification is absent');
	return await executeRun(app, options.lane, options.pass, options);
}

async function zeroServiceWorkerCheckpoint(
	lifecycle: JourneyLifecycle,
	phase: 'before-interactions' | 'after-interactions' | 'after-online-reload',
): Promise<{
	phase: typeof phase;
	state: 'timeout';
	registrations: 0;
	controller: null;
	cacheNames: [];
	workerEvents: [];
}> {
	const telemetry = await lifecycle.serviceWorkerTelemetry(250);
	if (
		telemetry.state !== 'timeout' ||
		telemetry.registration.scriptPath !== null ||
		telemetry.registration.scope !== null ||
		telemetry.registration.installing !== null ||
		telemetry.registration.waiting !== null ||
		telemetry.registration.active !== null ||
		telemetry.controller !== null ||
		telemetry.cacheNames.length !== 0 ||
		telemetry.cacheEntries.length !== 0 ||
		telemetry.workerEvents.length !== 0
	)
		throw new Error('zero-service-worker policy assertion failed');
	return {
		phase,
		state: 'timeout',
		registrations: 0,
		controller: null,
		cacheNames: [],
		workerEvents: [],
	};
}

function reactBoilerplateZeroSwSpec(): AppSpec {
	const canonical = apps.find((candidate) => candidate.app === 'react-boilerplate');
	if (canonical === undefined)
		throw new Error('React Boilerplate canonical Witness specification is absent');
	return {
		...canonical,
		journey: async (context, page, transportEvidence, lifecycle) => {
			if (lifecycle.expectedServiceWorker !== null)
				throw new Error('Zero-SW journey received a service-worker expectation');
			const checkpoints = [
				await zeroServiceWorkerCheckpoint(lifecycle, 'before-interactions'),
			];
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');
			await page.click('a[href="/features"]');
			await context.expect.page.bodyText(page, { contains: 'Features' });
			await page.click('a[href="/"]');
			await page.click('select');
			await page.press('select', 'd');
			await context.expect.page.bodyText(page, {
				contains: 'Beginnen Sie Ihr nächstes React Projekt in Sekunden',
			});
			await page.hover('#username');
			await page.type('#username', 'octocat');
			await page.press('#username', 'Enter');
			await context.expect.page.bodyText(page, { contains: 'owned-repo' });
			await context.expect.page.bodyText(page, { contains: 'fork-owner/forked-repo' });
			await page.scroll(null, { y: 500 });
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 3 },
					input: { atLeast: 1 },
					change: { atLeast: 1 },
					keydown: { atLeast: 1 },
					mouseover: { atLeast: 1 },
				},
			});
			checkpoints.push(await zeroServiceWorkerCheckpoint(lifecycle, 'after-interactions'));
			await page.reload();
			await context.expect.page.bodyText(page, {
				contains: 'Start your next react project in seconds',
				notContains: 'owned-repo',
			});
			checkpoints.push(await zeroServiceWorkerCheckpoint(lifecycle, 'after-online-reload'));
			await page.type('#username', 'reset-proof');
			await page.press('#username', 'Enter');
			await context.expect.page.bodyText(page, { contains: 'owned-repo' });
			if (transportEvidence.apiUsernames.join(',') !== 'octocat,reset-proof')
				throw new Error('React zero-SW username state did not reset after online reload');
			await clean(context, page, 3);
			return {
				assertions: [
					'feature route',
					'keyboard locale selection',
					'canonical repository payload',
					'online reload and state reset',
					'zero service-worker lifecycle and CacheStorage',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
				zeroServiceWorker: { checkpoints },
			};
		},
	};
}

export async function executeReactBoilerplateZeroSwWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	return await executeRun(reactBoilerplateZeroSwSpec(), options.lane, options.pass, {
		...options,
		serviceWorkerPolicy: 'zero',
	});
}

export async function executeNextKilledByGoogleWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
	nextPrerenderPayload: NextPrerenderPayloadInput;
}): Promise<WitnessRealAppRun> {
	const app = apps.find((candidate) => candidate.app === 'killedbygoogle');
	if (app === undefined) throw new Error('KilledByGoogle Witness specification is absent');
	return await executeRun(app, options.lane, options.pass, options);
}

async function mutationProof(
	app: 'react-boilerplate' | 'angular-realworld',
): Promise<WitnessMutationProof> {
	const file = join(stageRoot, 'lanes', app, 'migrated/index.html');
	const before = await readFile(file);
	const expectedTitle = app === 'react-boilerplate' ? 'React Boilerplate' : 'Conduit';
	const mutatedTitle =
		app === 'react-boilerplate' ? 'Mutated React Subject' : 'Mutated Angular Subject';
	const mutatedText = before
		.toString('utf8')
		.replace(`<title>${expectedTitle}</title>`, `<title>${mutatedTitle}</title>`);
	if (mutatedText === before.toString('utf8'))
		throw new Error(`${app} exact mutation span is absent`);
	let intendedFailure = false;
	try {
		await writeFile(file, mutatedText);
		const staticServer = await startStaticServer(dirname(file));
		const host = createPlaywrightWitnessHost({ chromiumExecutable });
		const definition = box(`${app}-mutation-red`, async (context) => {
			const page = await context.browser.visit(joinURL(staticServer.origin, '/'));
			await context.expect.page.text(page, 'title', expectedTitle);
		});
		let result: Awaited<ReturnType<typeof runBoxes>>;
		try {
			result = await runBoxes({
				root: dirname(file),
				boxes: [
					{
						file: join(dirname(file), 'versionless-mutation.box.ts'),
						relativeFile: 'versionless-mutation.box.ts',
						exportName: 'default',
						box: definition,
					},
				],
				receiptDir: join(stageRoot, 'witness-receipts', app, 'mutation-red'),
				assertionTimeoutMs: 1_000,
				fileSystem: witnessNodeFileSystem,
				browser: host.browser,
			});
		} finally {
			await staticServer.close();
		}
		staticServer.assertClean();
		intendedFailure =
			result.status === 'failed' &&
			(result.boxes[0]?.error?.message.includes(`expected 'title' to have text`) ?? false);
	} finally {
		await writeFile(file, before);
	}
	if (!intendedFailure || sha256(await readFile(file)) !== sha256(before))
		throw new Error(`${app} mutation did not fail semantically and restore byte-identically`);
	return {
		app,
		failure: 'witness-semantic-assertion',
		intendedFailure: true,
		restoredByteIdentically: true,
	};
}

async function executeRuns(): Promise<WitnessRealAppRun[]> {
	const runs: WitnessRealAppRun[] = [];
	for (const app of apps)
		for (const lane of ['baseline', 'migrated'] as const)
			for (const pass of [1, 2] as const) runs.push(await executeRun(app, lane, pass));
	return runs;
}

type ReactBaselineDifferentialProfile = {
	profile: 'current-witness' | 'canonical-t060';
	telemetry: ServiceWorkerTelemetry;
	events: WitnessDifferentialEvent[];
	staticLedger: StaticResponseLedgerEntry[];
	observerFinalization: ReturnType<PlaywrightWitnessHost['serviceWorkerObserverFinalization']>;
};

async function runReactBaselineDifferentialProfile(
	profile: ReactBaselineDifferentialProfile['profile'],
): Promise<ReactBaselineDifferentialProfile> {
	const app = apps[0]!;
	const laneRoot = join(stageRoot, 'lanes', 'react-boilerplate', 'baseline');
	const events: WitnessDifferentialEvent[] = [];
	const recordEvent = (
		event:
			| WitnessDifferentialEvent
			| Omit<WitnessDifferentialEvent, 'sequence' | 'timestampMs'>,
	): void => {
		events.push({
			...event,
			sequence: events.length,
			timestampMs: 'timestampMs' in event ? event.timestampMs : Date.now(),
		});
	};
	for (const asset of BASELINE_REACT_MAIN_ASSETS)
		recordEvent({
			source: 'manifest',
			phase: 'constructed',
			urlPath: `${asset.pathname}${BASELINE_REACT_CACHE_BUST_QUERY}`,
			detail: { cacheMode: 'default', credentials: 'same-origin', mode: 'cors' },
		});
	const staticServer = await startStaticServer(laneRoot, {
		profile,
		diagnosticEvent: recordEvent,
	});
	const productionUrl = joinURL(staticServer.origin, '/');
	const transportEvidence: JourneyTransportEvidence = { apiUsernames: [] };
	const expectedServiceWorker = await expectedReactTelemetry(laneRoot, 'baseline');
	const host = createPlaywrightWitnessHost({
		chromiumExecutable,
		contextProfile: profile,
		diagnosticEvent: recordEvent,
		transport: async (request) => await app.transport!(request, transportEvidence),
	});
	let telemetry: ServiceWorkerTelemetry | undefined;
	const definition = box(`react-baseline-differential-${profile}`, async (context) => {
		const page = await context.browser.visit(productionUrl);
		if (profile === 'current-witness') {
			const journey = await app.journey(context, page, transportEvidence, {
				serviceWorkerTelemetry: host.serviceWorkerTelemetry,
				staticRequests: staticServer.requests,
				expectedServiceWorker,
				phonecatOrdering: null,
				phonecatImages: null,
			});
			telemetry =
				journey.timeoutTelemetry ??
				(journey.offlineEvidence.state === 'react-shell-rendered-state-reset'
					? (journey.offlineEvidence.lifecycle.controlled as ServiceWorkerTelemetry)
					: undefined);
		} else {
			telemetry = await host.serviceWorkerTelemetry(10_000);
			if (telemetry.state === 'ready') {
				await page.reload();
				telemetry = await host.serviceWorkerTelemetry(10_000);
			}
		}
		await context.receipt.capture('differential-complete');
	});
	try {
		const receiptDir = join(stageRoot, 'diagnostic-receipts', profile);
		await rm(receiptDir, { recursive: true, force: true });
		const result = await runBoxes({
			root: laneRoot,
			boxes: [
				{
					file: join(laneRoot, 'versionless-runtime.box.ts'),
					relativeFile: 'versionless-runtime.box.ts',
					exportName: 'default',
					box: definition,
				},
			],
			receiptDir,
			assertionTimeoutMs: 10_000,
			fileSystem: witnessNodeFileSystem,
			browser: host.browser,
			headless: true,
		});
		if (result.status !== 'passed' || telemetry === undefined)
			throw new Error(`React baseline differential ${profile} did not complete`);
	} finally {
		await staticServer.close();
	}
	staticServer.assertClean();
	return {
		profile,
		telemetry,
		events,
		staticLedger: staticServer.ledger(),
		observerFinalization: host.serviceWorkerObserverFinalization(),
	};
}

function firstMissingRootTransition(
	current: ReactBaselineDifferentialProfile,
	canonical: ReactBaselineDifferentialProfile,
): string | null {
	const root = `/${BASELINE_REACT_CACHE_BUST_QUERY}`;
	const transitions = [
		['browser', 'request'],
		['context-route', 'start'],
		['context-route', 'continue'],
		['static-server', 'start'],
		['static-server', 'finish'],
		['browser', 'response'],
	] as const;
	for (const [source, phase] of transitions) {
		const canonicalHas = canonical.events.some(
			(event) => event.source === source && event.phase === phase && event.urlPath === root,
		);
		const currentHas = current.events.some(
			(event) => event.source === source && event.phase === phase && event.urlPath === root,
		);
		if (canonicalHas && !currentHas) return `${source}:${phase}`;
	}
	return null;
}

export async function diagnoseReactBaselineServiceWorker(): Promise<void> {
	if (process.env.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('React baseline differential requires VERSIONLESS_NETWORK_MODE=offline');
	const provenance = await verifyLinkedWitnessProvenance(root);
	await stageInputs();
	const diagnosticDirectory = join(stageRoot, 'diagnostics');
	await rm(diagnosticDirectory, { recursive: true, force: true });
	await mkdir(diagnosticDirectory, { recursive: true });
	const canonical = await runReactBaselineDifferentialProfile('canonical-t060');
	const current = await runReactBaselineDifferentialProfile('current-witness');
	const firstMissingTransition = firstMissingRootTransition(current, canonical);
	const canonicalReceipt = JSON.parse(
		await readFile(
			join(root, 'evidence/runs/react-boilerplate-v4-composed/t060-run.json'),
			'utf8',
		),
	) as { environment?: { browser?: { chromium?: string; playwright?: string } } };
	const diagnostic = {
		schemaVersion: 'versionless.witness-react-baseline-differential.v1',
		result: firstMissingTransition === null ? 'unsupported-unidentified' : 'identified',
		firstMissingTransition,
		manifestMainUrls: BASELINE_REACT_MAIN_ASSETS.map(
			(asset) => `${asset.pathname}${BASELINE_REACT_CACHE_BUST_QUERY}`,
		),
		environment: {
			chromium: canonicalReceipt.environment?.browser?.chromium ?? 'unknown',
			playwright: canonicalReceipt.environment?.browser?.playwright ?? 'unknown',
			linkedWitnessCommit: provenance.commit,
			workerSha256: sha256(
				await readFile(join(stageRoot, 'lanes/react-boilerplate/baseline/sw.js')),
			),
		},
		canonical,
		current,
	};
	await writeFile(
		join(diagnosticDirectory, 'react-boilerplate-baseline-differential.json'),
		`${canonicalize(diagnostic)}\n`,
	);
	process.stdout.write(
		`${canonicalize({ result: diagnostic.result, firstMissingTransition })}\n`,
	);
}

export async function runWitnessRealApps(output: string): Promise<WitnessRealAppReceipt> {
	if (process.env.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('real-app Witness run requires VERSIONLESS_NETWORK_MODE=offline');
	const provenance = await verifyLinkedWitnessProvenance(root);
	const canonicalReceipts = await bindCanonicalReceipts();
	const killedByGoogleInventory = await stageInputs();
	await rm(join(stageRoot, 'diagnostics'), { recursive: true, force: true });
	const runs = await executeRuns();
	const mutations = await Promise.all([
		mutationProof('react-boilerplate'),
		mutationProof('angular-realworld'),
	]);
	const receipt: WitnessRealAppReceipt = {
		schemaVersion: WITNESS_REAL_APP_SCHEMA,
		result: 'pass',
		provenance,
		canonicalReceipts,
		runs,
		mutations,
		killedByGoogleInventory,
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: [
			'Direct sibling link is local-only and layout-dependent; portable publication is not claimed.',
			'Drag is not-tested; no genuine selected surface exists and no synthetic drag was used.',
			'Non-loopback requests were policy-mocked locally and are not live egress.',
			'React API fulfillment is synthetic and online-only; API caching, Redux persistence and prior-result persistence are not claimed.',
			'React offline evidence proves shell rendering and state reset only; canonical T060 remains the bound service-worker proof and no new service-worker proof is claimed.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance or OS-wide isolation.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessRealAppDigest(receipt);
	parseWitnessRealAppReceipt(receipt);
	const stagedOutput = join(stageRoot, 'publication');
	await rm(stagedOutput, { recursive: true, force: true });
	await mkdir(stagedOutput, { recursive: true });
	await writeFile(join(stagedOutput, 'receipt.json'), `${canonicalize(receipt)}\n`);
	await rm(output, { recursive: true, force: true });
	await mkdir(resolve(output, '..'), { recursive: true });
	await rename(stagedOutput, output);
	return receipt;
}

export async function verifyWitnessRealApps(output: string): Promise<WitnessRealAppReceipt> {
	await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessRealAppReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	const current = await bindCanonicalReceipts();
	if (canonicalize(current) !== canonicalize(receipt.canonicalReceipts))
		throw new Error('canonical receipt binding drifted');
	if (
		JSON.stringify(receipt).includes(root) ||
		JSON.stringify(receipt).includes(process.env.USER ?? '')
	)
		throw new Error('Witness real-app receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length === 1 && args[0] === '--diagnose-react-baseline-service-worker') {
		await diagnoseReactBaselineServiceWorker();
		return;
	}
	if (args.length === 1 && args[0] === '--verify-provenance-only') {
		process.stdout.write(`${canonicalize(await verifyLinkedWitnessProvenance(root))}\n`);
		return;
	}
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const receipt = await runWitnessRealApps(resolve(root, args[publishIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessRealApps(resolve(root, args[verifyIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error(
		'Witness real-app runner requires --verify-provenance-only, --run-twice --publish <dir>, or --verify <dir>',
	);
}

if (process.argv[1]?.endsWith('real-app-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
