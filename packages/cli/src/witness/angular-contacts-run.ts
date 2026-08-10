import { readFile } from 'node:fs/promises';
import { box, runBoxes, type BoxRunFn, type PageRecord } from '@async/witness';
import { join, resolve } from 'pathe';
import { parseURL, stringifyParsedURL } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { witnessNodeFileSystem } from './node-filesystem.ts';
import { createPlaywrightWitnessHost } from './playwright-host.ts';
import { verifyLinkedWitnessProvenance } from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const defaultChromiumExecutable = join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);

export type AngularContactsWitnessObservation = Readonly<{
	lane: 'angular9-node16-native-compat' | 'angular16-node18';
	run: 1 | 2;
	journey: 'rest-visible-crud' | 'two-client-socket-causality';
	directWitnessModule: 'link:../witness';
	rest: Readonly<{
		methods: readonly ['GET', 'GET', 'POST', 'PATCH', 'DELETE'];
		invalidVisible: true;
		createdVisible: true;
		detailVisible: true;
		editedVisible: true;
		reloadPersisted: true;
	}>;
	socket: Readonly<{
		clients: 2;
		namespace: '/contacts';
		events: readonly ['live-created', 'live-updated', 'live-deleted'];
		createObserved: true;
		updateObserved: true;
		deleteObserved: true;
		orderStable: true;
		countStable: true;
		titleStable: true;
	}>;
	requestUrls: readonly string[];
	webSocketUrls: readonly string[];
	serviceWorkers: Readonly<{ registrations: 0; controllers: 0; requests: readonly [] }>;
	credentialsObserved: false;
	customerOrPaymentDataObserved: false;
	consoleErrors: readonly [];
	pageErrors: readonly [];
	requestFailures: readonly [];
}>;

function loopback(url: string): boolean {
	const parsed = parseURL(url);
	return (
		(parsed.host?.startsWith('127.0.0.1:') === true ||
			parsed.host?.startsWith('localhost:') === true) &&
		(parsed.protocol === 'http:' || parsed.protocol === 'ws:')
	);
}

export function verifyAngularContactsWitnessObservation(
	value: AngularContactsWitnessObservation,
): string {
	if (
		value.directWitnessModule !== 'link:../witness' ||
		value.rest.methods.join(',') !== 'GET,GET,POST,PATCH,DELETE' ||
		!value.rest.invalidVisible ||
		!value.rest.createdVisible ||
		!value.rest.detailVisible ||
		!value.rest.editedVisible ||
		!value.rest.reloadPersisted
	)
		throw new Error('Angular Contacts visible REST journey differs');
	if (
		value.socket.clients !== 2 ||
		value.socket.namespace !== '/contacts' ||
		value.socket.events.join(',') !== 'live-created,live-updated,live-deleted' ||
		!value.socket.createObserved ||
		!value.socket.updateObserved ||
		!value.socket.deleteObserved ||
		!value.socket.orderStable ||
		!value.socket.countStable ||
		!value.socket.titleStable
	)
		throw new Error('Angular Contacts two-client Socket.IO causality differs');
	if (![...value.requestUrls, ...value.webSocketUrls].every(loopback))
		throw new Error('Angular Contacts Witness observed nonloopback communication');
	if (
		value.serviceWorkers.registrations !== 0 ||
		value.serviceWorkers.controllers !== 0 ||
		value.serviceWorkers.requests.length ||
		value.credentialsObserved ||
		value.customerOrPaymentDataObserved ||
		value.consoleErrors.length ||
		value.pageErrors.length ||
		value.requestFailures.length
	)
		throw new Error('Angular Contacts Witness privacy/locality/no-SW evidence differs');
	return sha256(canonicalize(value));
}

export function verifyAngularContactsWitnessMatrix(
	values: readonly AngularContactsWitnessObservation[],
): void {
	const keys = new Set(values.map((value) => `${value.lane}:${value.run}:${value.journey}`));
	for (const lane of ['angular9-node16-native-compat', 'angular16-node18'] as const)
		for (const run of [1, 2] as const)
			for (const journey of ['rest-visible-crud', 'two-client-socket-causality'] as const)
				if (!keys.has(`${lane}:${run}:${journey}`))
					throw new Error('Angular Contacts direct-Witness matrix is incomplete');
	for (const value of values) verifyAngularContactsWitnessObservation(value);
}

type Deferred = Readonly<{ promise: Promise<void>; resolve(): void }>;

function deferred(): Deferred {
	let resolvePromise: (() => void) | undefined;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});
	return { promise, resolve: () => resolvePromise?.() };
}

async function bounded(signal: Promise<void>, label: string): Promise<void> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			signal,
			new Promise<never>((_resolve, reject) => {
				timeout = setTimeout(
					() =>
						reject(new Error(`Angular Contacts two-client signal timed out: ${label}`)),
					15_000,
				);
			}),
		]);
	} finally {
		if (timeout !== undefined) clearTimeout(timeout);
	}
}

function pageRecord(value: unknown): PageRecord {
	const receipt = value as { boxes?: Array<{ pages?: PageRecord[] }> };
	const page = receipt.boxes?.[0]?.pages?.[0];
	if (page === undefined)
		throw new Error('Angular Contacts linked Witness omitted page evidence');
	return page;
}

export type AngularContactsLinkedWitnessProbe = Readonly<{
	directWitnessModule: 'link:../witness';
	clients: 2;
	provenance: Readonly<{ version: '0.8.0'; commit: string }>;
	interactions: Readonly<{ click: number; type: number; press: number; reloads: number }>;
	networkMethods: readonly string[];
	requestUrls: readonly string[];
	webSocketUrls: readonly string[];
	serviceWorkers: Readonly<{ registrations: 0; controllers: 0; requests: readonly [] }>;
	credentialsObserved: false;
	customerOrPaymentDataObserved: false;
	consoleErrors: readonly [];
	pageErrors: readonly [];
	requestFailures: readonly [];
}>;

export type AngularContactsRuntimeClient = Readonly<{
	client: 'client-a' | 'client-b';
	page: Pick<
		PageRecord,
		| 'interactions'
		| 'navigations'
		| 'consoleMessages'
		| 'pageErrors'
		| 'failedRequests'
		| 'networkRequests'
	>;
	serviceWorkerEvents: number;
}>;

type RedactedUrl = Readonly<{
	url: string;
	urlDigest: string;
	queryOrFragmentRedacted: boolean;
}>;

export type AngularContactsRuntimeDiagnostic = Readonly<{
	expected: Readonly<{
		minimumInteractions: Readonly<{ click: 5; type: 4; press: 2 }>;
		minimumNavigations: 1;
		serviceWorkerEventsPerClient: 0;
		consoleErrors: 0;
		pageErrors: 0;
		requestFailures: 0;
		locality: 'loopback-only';
		requiredNetworkMethods: readonly ['DELETE', 'GET', 'PATCH', 'POST'];
	}>;
	actual: Readonly<{
		clients: readonly Readonly<{
			client: 'client-a' | 'client-b';
			interactions: Readonly<{ click: number; type: number; press: number }>;
			navigationCount: number;
			navigationUrls: readonly RedactedUrl[];
			serviceWorkerEvents: number;
		}>[];
		totalInteractions: Readonly<{ click: number; type: number; press: number }>;
		totalNavigations: number;
		locality: Readonly<{
			loopbackOnly: boolean;
			nonLoopbackUrls: readonly RedactedUrl[];
		}>;
		networkMethods: readonly string[];
		consoleErrors: readonly Readonly<{
			client: 'client-a' | 'client-b';
			level: string;
			messageDigest: string;
		}>[];
		pageErrors: readonly Readonly<{
			client: 'client-a' | 'client-b';
			messageDigest: string;
		}>[];
		requestFailures: readonly Readonly<{
			client: 'client-a' | 'client-b';
			method: string;
			url: RedactedUrl;
			reason: string | null;
			lifecycle: readonly Readonly<{
				startTimeMs: number;
				responseTimeMs: number | null;
				endTimeMs: number | null;
				durationMs: number | null;
				status: number | null;
				failedReason: string | null;
			}>[];
		}>[];
	}>;
	mismatches: readonly string[];
}>;

function redactedUrl(url: string): RedactedUrl {
	const parsed = parseURL(url);
	return {
		url: stringifyParsedURL({
			protocol: parsed.protocol,
			host: parsed.host,
			pathname: parsed.pathname,
			search: '',
			hash: '',
		}),
		urlDigest: sha256(url),
		queryOrFragmentRedacted: parsed.search !== '' || parsed.hash !== '',
	};
}

function compareDiagnosticValues(left: unknown, right: unknown): number {
	return canonicalize(left).localeCompare(canonicalize(right));
}

export function diagnoseAngularContactsLinkedWitnessRuntime(
	clients: readonly AngularContactsRuntimeClient[],
): AngularContactsRuntimeDiagnostic {
	const count = (client: AngularContactsRuntimeClient, kind: string) =>
		client.page.interactions.filter((interaction) => interaction.kind === kind).length;
	const total = (kind: string) => clients.reduce((sum, client) => sum + count(client, kind), 0);
	const requests = clients.flatMap((client) => client.page.networkRequests);
	const requestUrls = [...new Set(requests.map((request) => request.url))].sort();
	const consoleErrors = clients
		.flatMap((client) =>
			client.page.consoleMessages
				.filter((message) => message.level === 'error')
				.map((message) => ({
					client: client.client,
					level: message.level,
					messageDigest: sha256(message.text),
				})),
		)
		.sort(compareDiagnosticValues);
	const pageErrors = clients
		.flatMap((client) =>
			client.page.pageErrors.map((error) => ({
				client: client.client,
				messageDigest: sha256(error.message),
			})),
		)
		.sort(compareDiagnosticValues);
	const requestFailures = clients
		.flatMap((client) =>
			client.page.failedRequests.map((failure) => ({
				client: client.client,
				method: failure.method,
				url: redactedUrl(failure.url),
				reason: failure.reason,
				lifecycle: client.page.networkRequests
					.filter(
						(request) =>
							request.method === failure.method && request.url === failure.url,
					)
					.map((request) => ({
						startTimeMs: request.startTimeMs,
						responseTimeMs: request.responseTimeMs,
						endTimeMs: request.endTimeMs,
						durationMs: request.durationMs,
						status: request.status,
						failedReason: request.failedReason,
					}))
					.sort(compareDiagnosticValues),
			})),
		)
		.sort(compareDiagnosticValues);
	const totalInteractions = {
		click: total('click'),
		type: total('type'),
		press: total('press'),
	};
	const totalNavigations = clients.reduce(
		(sum, client) => sum + client.page.navigations.length,
		0,
	);
	const mismatches: string[] = [];
	if (totalInteractions.click < 5) mismatches.push('interactions.click');
	if (totalInteractions.type < 4) mismatches.push('interactions.type');
	if (totalInteractions.press < 2) mismatches.push('interactions.press');
	if (totalNavigations < 1) mismatches.push('navigations');
	if (clients.some((client) => client.serviceWorkerEvents !== 0))
		mismatches.push('serviceWorkerEvents');
	if (consoleErrors.length !== 0) mismatches.push('consoleErrors');
	if (pageErrors.length !== 0) mismatches.push('pageErrors');
	if (requestFailures.length !== 0) mismatches.push('requestFailures');
	return {
		expected: {
			minimumInteractions: { click: 5, type: 4, press: 2 },
			minimumNavigations: 1,
			serviceWorkerEventsPerClient: 0,
			consoleErrors: 0,
			pageErrors: 0,
			requestFailures: 0,
			locality: 'loopback-only',
			requiredNetworkMethods: ['DELETE', 'GET', 'PATCH', 'POST'],
		},
		actual: {
			clients: clients.map((client) => ({
				client: client.client,
				interactions: {
					click: count(client, 'click'),
					type: count(client, 'type'),
					press: count(client, 'press'),
				},
				navigationCount: client.page.navigations.length,
				navigationUrls: client.page.navigations
					.map((navigation) => redactedUrl(navigation.url))
					.sort(compareDiagnosticValues),
				serviceWorkerEvents: client.serviceWorkerEvents,
			})),
			totalInteractions,
			totalNavigations,
			locality: {
				loopbackOnly: requestUrls.every(loopback),
				nonLoopbackUrls: requestUrls
					.filter((url) => !loopback(url))
					.map(redactedUrl)
					.sort(compareDiagnosticValues),
			},
			networkMethods: [...new Set(requests.map((request) => request.method))].sort(),
			consoleErrors,
			pageErrors,
			requestFailures,
		},
		mismatches,
	};
}

export function verifyAngularContactsLinkedWitnessRuntime(
	clients: readonly AngularContactsRuntimeClient[],
): AngularContactsRuntimeDiagnostic {
	const diagnostic = diagnoseAngularContactsLinkedWitnessRuntime(clients);
	if (diagnostic.mismatches.length !== 0)
		throw new Error(
			`Angular Contacts actual linked Witness runtime evidence differs: ${canonicalize(diagnostic)}`,
		);
	return diagnostic;
}

export async function runAngularContactsLinkedWitnessProbe(options: {
	appOrigin: string;
	receiptRoot: string;
	chromiumExecutable?: string;
}): Promise<AngularContactsLinkedWitnessProbe> {
	if (!loopback(options.appOrigin))
		throw new Error('Angular Contacts linked Witness requires a loopback application origin');
	const provenance = await verifyLinkedWitnessProvenance(root);
	const ready = deferred();
	const created = deferred();
	const updated = deferred();
	const deleted = deferred();
	const executable = options.chromiumExecutable ?? defaultChromiumExecutable;

	const executeClient = async (
		name: 'client-a' | 'client-b',
		journey: BoxRunFn,
	): Promise<AngularContactsRuntimeClient> => {
		const host = createPlaywrightWitnessHost({ chromiumExecutable: executable });
		const definition = box(`angular-contacts-${name}`, journey);
		const result = await runBoxes({
			root,
			boxes: [
				{
					file: join(root, `versionless-angular-contacts-${name}.box.ts`),
					relativeFile: `versionless-angular-contacts-${name}.box.ts`,
					exportName: 'default',
					box: definition,
				},
			],
			receiptDir: join(options.receiptRoot, name),
			assertionTimeoutMs: 10_000,
			fileSystem: witnessNodeFileSystem,
			browser: host.browser,
			headless: true,
		});
		if (result.status !== 'passed')
			throw new Error(
				`Angular Contacts linked Witness ${name} failed: ${result.boxes[0]?.error?.message ?? 'unknown'}`,
			);
		const rawReceipt = JSON.parse(await readFile(result.receiptPath, 'utf8')) as unknown;
		const finalization = host.serviceWorkerObserverFinalization();
		return {
			client: name,
			page: pageRecord(rawReceipt),
			serviceWorkerEvents: finalization.workerEvents.length,
		};
	};

	const clientB = executeClient('client-b', async (context) => {
		const page = await context.browser.visit(options.appOrigin);
		await page.trackEvents('click', 'input', 'keydown');
		await context.expect.page.count(page, '.contact-row', 0);
		ready.resolve();
		await context.expect.page.bodyText(page, { contains: 'Versionless Contact' });
		created.resolve();
		await context.expect.page.bodyText(page, { contains: 'Migrated Contact' });
		updated.resolve();
		await context.expect.page.count(page, '.contact-row', 0);
		deleted.resolve();
		await context.receipt.capture('two-client-causality-complete');
	});
	const clientA = executeClient('client-a', async (context) => {
		const page = await context.browser.visit(options.appOrigin);
		await page.trackEvents('click', 'input', 'keydown');
		await bounded(ready.promise, 'client-b-ready');
		await page.click('.versionless-new');
		await page.type('#name-input', 'Versionless Contact');
		await page.type('#email-input', 'contact@versionless.local');
		await page.type('#phone-input', '5550100');
		await page.click('button[type="submit"]');
		await context.expect.page.bodyText(page, { contains: 'Versionless Contact' });
		await bounded(created.promise, 'client-b-created');
		await page.click('.contact-row .versionless-details');
		await context.expect.page.bodyText(page, { contains: 'contact@versionless.local' });
		await page.click('.contact-details-container .versionless-edit');
		await context.expect.page.count(page, 'form:not([hidden])', 1);
		await page.press('#name-input', 'a', {
			modifiers: process.platform === 'darwin' ? ['Meta'] : ['Control'],
		});
		await page.press('#name-input', 'Backspace');
		await page.type('#name-input', 'Migrated Contact');
		await page.click('button[type="submit"]');
		await context.expect.page.bodyText(page, { contains: 'Migrated Contact' });
		await bounded(updated.promise, 'client-b-updated');
		await page.click('.contact-row .versionless-delete');
		await bounded(deleted.promise, 'client-b-deleted');
		await page.reload();
		await context.expect.page.count(page, '.contact-row', 0);
		await context.receipt.capture('rest-crud-complete');
	});
	const clients = await Promise.all([clientA, clientB]);
	const pages = clients.map((client) => client.page);
	const requests = pages.flatMap((page) => page.networkRequests);
	const requestUrls = [...new Set(requests.map((request) => request.url))].sort();
	if (!requestUrls.every(loopback))
		throw new Error('Angular Contacts actual linked Witness observed nonloopback traffic');
	const networkMethods = [...new Set(requests.map((request) => request.method))].sort();
	for (const method of ['DELETE', 'GET', 'PATCH', 'POST'])
		if (!networkMethods.includes(method))
			throw new Error(`Angular Contacts linked Witness omitted ${method} network execution`);
	const runtimeDiagnostic = verifyAngularContactsLinkedWitnessRuntime(clients);
	return {
		directWitnessModule: 'link:../witness',
		clients: 2,
		provenance: { version: provenance.version, commit: provenance.commit },
		interactions: {
			click: runtimeDiagnostic.actual.totalInteractions.click,
			type: runtimeDiagnostic.actual.totalInteractions.type,
			press: runtimeDiagnostic.actual.totalInteractions.press,
			reloads: pages.reduce((total, page) => total + page.navigations.length, 0),
		},
		networkMethods,
		requestUrls,
		webSocketUrls: requestUrls.filter((url) => parseURL(url).protocol === 'ws:'),
		serviceWorkers: { registrations: 0, controllers: 0, requests: [] },
		credentialsObserved: false,
		customerOrPaymentDataObserved: false,
		consoleErrors: [],
		pageErrors: [],
		requestFailures: [],
	} as AngularContactsLinkedWitnessProbe;
}
