import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import { join } from 'pathe';
import { parseURL } from 'ufo';
import { describe, expect, test } from 'vitest';
import {
	diagnoseAngularContactsLinkedWitnessRuntime,
	runAngularContactsLinkedWitnessProbe,
	verifyAngularContactsLinkedWitnessRuntime,
	verifyAngularContactsWitnessMatrix,
	verifyAngularContactsWitnessObservation,
	type AngularContactsRuntimeClient,
	type AngularContactsWitnessObservation,
} from '../src/witness/angular-contacts-run.ts';
import type { PageRecord } from '@async/witness';

const probeDocument = `<!doctype html>
<html><body>
<h1>Contact list</h1>
<button class="versionless-new">New</button>
<form hidden>
<label>Name:<input id="name-input" required></label>
<label>Email:<input id="email-input" type="email" required></label>
<label>Phone:<input id="phone-input" required></label>
<button type="submit">Submit</button>
</form>
<table><tbody id="contacts"></tbody></table>
<div id="details"></div>
<script>
let editing = null;
const form = document.querySelector('form');
const nameInput = document.querySelector('#name-input');
const emailInput = document.querySelector('#email-input');
const phoneInput = document.querySelector('#phone-input');
const list = document.querySelector('#contacts');
const details = document.querySelector('#details');
async function load() {
  const contacts = await fetch('/api/contacts').then((response) => response.json());
  list.innerHTML = contacts.map((contact) => '<tr class="contact-row"><td>' + contact.name + '</td><td>' + contact.email + '</td><td><button class="versionless-details" data-id="' + contact.id + '">DETAILS</button><button class="versionless-edit" data-id="' + contact.id + '">EDIT</button><button class="versionless-delete" data-id="' + contact.id + '">DELETE</button></td></tr>').join('');
}
document.querySelector('.versionless-new').addEventListener('click', () => {
  editing = null;
  form.hidden = false;
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const contact = { name: nameInput.value, email: emailInput.value, phone: phoneInput.value };
	const method = editing === null ? 'POST' : 'PATCH';
  const response = await fetch(editing === null ? '/api/contacts' : '/api/contacts/' + editing, {
		method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(contact)
  });
	const expectedStatus = method === 'POST' ? 201 : 200;
	if (!response.ok || response.status !== expectedStatus) throw new Error(method + ' response failed');
	const persisted = await response.json();
	if (persisted.name !== contact.name || persisted.email !== contact.email || persisted.phone !== contact.phone) throw new Error(method + ' response body differs');
  editing = null;
  form.hidden = true;
  details.innerHTML = '';
  await load();
});
document.addEventListener('click', async (event) => {
  const target = event.target;
  const id = target.dataset.id;
  if (target.classList.contains('versionless-details')) {
    const contact = await fetch('/api/contacts/' + id).then((response) => response.json());
    details.innerHTML = '<div class="contact-details-container">' + contact.name + ' ' + contact.email + '<button class="versionless-edit" data-id="' + contact.id + '">EDIT</button></div>';
  }
  if (target.classList.contains('versionless-edit')) {
    const contact = await fetch('/api/contacts/' + id).then((response) => response.json());
    editing = contact.id;
    nameInput.value = contact.name;
    emailInput.value = contact.email;
    phoneInput.value = contact.phone;
    form.hidden = false;
  }
  if (target.classList.contains('versionless-delete')) {
		const response = await fetch('/api/contacts/' + id, { method: 'DELETE' });
		if (!response.ok || response.status !== 200) throw new Error('DELETE response failed');
		const deleted = await response.json();
		if (String(deleted.id) !== id) throw new Error('DELETE response body differs');
    await load();
  }
});
async function poll() {
  await load();
  setTimeout(() => void poll(), 50);
}
void poll();
</script>
</body></html>`;

async function startProbeServer(): Promise<{ origin: string; close(): Promise<void> }> {
	let contacts: Array<{ id: number; name: string; email: string; phone: string }> = [];
	const server = createServer(async (request, response) => {
		const pathname = parseURL(request.url ?? '/').pathname;
		const parts = pathname.split('/').filter(Boolean);
		const send = (status: number, contentType: string, body: string) => {
			response.writeHead(status, {
				'content-type': contentType,
				'cache-control': 'no-store',
			});
			response.end(body);
		};
		const json = (status: number, value: unknown) =>
			send(status, 'application/json', JSON.stringify(value));
		const body = async () => {
			const chunks: Buffer[] = [];
			for await (const chunk of request) chunks.push(Buffer.from(chunk));
			return JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
				name: string;
				email: string;
				phone: string;
			};
		};
		if (pathname === '/') return send(200, 'text/html', probeDocument);
		if (pathname === '/api/contacts' && request.method === 'GET') return json(200, contacts);
		if (pathname === '/api/contacts' && request.method === 'POST') {
			const contact = { id: 1, ...(await body()) };
			contacts = [contact];
			return json(201, contact);
		}
		if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'contacts') {
			const contact = contacts.find((candidate) => candidate.id === Number(parts[2]));
			if (contact === undefined) return json(404, { error: 'not-found' });
			if (request.method === 'GET') return json(200, contact);
			if (request.method === 'PATCH') {
				const updated = { ...contact, ...(await body()) };
				contacts = [updated];
				return json(200, updated);
			}
			if (request.method === 'DELETE') {
				contacts = [];
				return json(200, contact);
			}
		}
		return json(404, { error: 'unknown-route' });
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve());
	});
	const address = server.address() as AddressInfo;
	return {
		origin: `http://127.0.0.1:${address.port}/`,
		close: async () =>
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error === undefined ? resolve() : reject(error))),
			),
	};
}

function observation(
	lane: AngularContactsWitnessObservation['lane'],
	run: 1 | 2,
	journey: AngularContactsWitnessObservation['journey'],
): AngularContactsWitnessObservation {
	return {
		lane,
		run,
		journey,
		directWitnessModule: 'link:../witness',
		rest: {
			methods: ['GET', 'GET', 'POST', 'PATCH', 'DELETE'],
			invalidVisible: true,
			createdVisible: true,
			detailVisible: true,
			editedVisible: true,
			reloadPersisted: true,
		},
		socket: {
			clients: 2,
			namespace: '/contacts',
			events: ['live-created', 'live-updated', 'live-deleted'],
			createObserved: true,
			updateObserved: true,
			deleteObserved: true,
			orderStable: true,
			countStable: true,
			titleStable: true,
		},
		requestUrls: ['http://127.0.0.1:4200/contacts', 'http://127.0.0.1:3000/contacts'],
		webSocketUrls: ['ws://127.0.0.1:3000/socket.io/'],
		serviceWorkers: { registrations: 0, controllers: 0, requests: [] },
		credentialsObserved: false,
		customerOrPaymentDataObserved: false,
		consoleErrors: [],
		pageErrors: [],
		requestFailures: [],
	};
}

function runtimeClient(
	client: 'client-a' | 'client-b',
	overrides: Partial<
		Pick<
			PageRecord,
			| 'interactions'
			| 'navigations'
			| 'consoleMessages'
			| 'pageErrors'
			| 'failedRequests'
			| 'networkRequests'
		>
	> = {},
	serviceWorkerEvents = 0,
): AngularContactsRuntimeClient {
	return {
		client,
		serviceWorkerEvents,
		page: {
			interactions: [],
			navigations: [],
			consoleMessages: [],
			pageErrors: [],
			failedRequests: [],
			networkRequests: [],
			...overrides,
		},
	};
}

const interaction: Readonly<
	Record<'click' | 'type' | 'press', PageRecord['interactions'][number]>
> = {
	click: { kind: 'click', selector: '#target', at: '2026-01-01T00:00:00.000Z' },
	type: {
		kind: 'type',
		selector: '#target',
		at: '2026-01-01T00:00:00.000Z',
		textLength: 1,
		redacted: true,
	},
	press: {
		kind: 'press',
		selector: '#target',
		key: 'Enter',
		modifiers: [],
		at: '2026-01-01T00:00:00.000Z',
	},
};

function passingRuntimeClients() {
	return [
		runtimeClient('client-a', {
			interactions: [
				...Array.from({ length: 5 }, () => interaction.click),
				...Array.from({ length: 4 }, () => interaction.type),
				...Array.from({ length: 2 }, () => interaction.press),
			],
			navigations: [
				{ url: 'http://127.0.0.1:4200/contacts', at: '2026-01-01T00:00:00.000Z' },
			],
			networkRequests: [
				{
					url: 'http://127.0.0.1:4200/api/contacts',
					method: 'GET',
					resourceType: 'fetch',
					startTimeMs: 1,
					responseTimeMs: 2,
					endTimeMs: 3,
					durationMs: 2,
					status: 200,
					mimeType: 'application/json',
					encodedDataLength: 2,
					failedReason: null,
					initiatorType: 'script',
				},
			],
		}),
		runtimeClient('client-b'),
	] as const;
}

function canonicalDiagnosticError(
	clients: Parameters<typeof verifyAngularContactsLinkedWitnessRuntime>[0],
): string {
	try {
		verifyAngularContactsLinkedWitnessRuntime(clients);
		return '';
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

describe('Angular Contacts direct Witness', () => {
	test('preserves every aggregate rejection and emits redaction-safe failure lifecycle detail', () => {
		const passing = passingRuntimeClients();
		expect(verifyAngularContactsLinkedWitnessRuntime(passing).mismatches).toEqual([]);
		const cases = [
			{
				name: 'interactions.click',
				clients: [
					runtimeClient('client-a', {
						...passing[0].page,
						interactions: passing[0].page.interactions.filter(
							(interaction) => interaction.kind !== 'click',
						),
					}),
					passing[1],
				],
			},
			{
				name: 'interactions.type',
				clients: [
					runtimeClient('client-a', {
						...passing[0].page,
						interactions: passing[0].page.interactions.filter(
							(interaction) => interaction.kind !== 'type',
						),
					}),
					passing[1],
				],
			},
			{
				name: 'interactions.press',
				clients: [
					runtimeClient('client-a', {
						...passing[0].page,
						interactions: passing[0].page.interactions.filter(
							(interaction) => interaction.kind !== 'press',
						),
					}),
					passing[1],
				],
			},
			{
				name: 'navigations',
				clients: [
					runtimeClient('client-a', { ...passing[0].page, navigations: [] }),
					passing[1],
				],
			},
			{
				name: 'serviceWorkerEvents',
				clients: [runtimeClient('client-a', passing[0].page, 1), passing[1]],
			},
			{
				name: 'consoleErrors',
				clients: [
					runtimeClient('client-a', {
						...passing[0].page,
						consoleMessages: [{ level: 'error', text: 'secret console detail' }],
					}),
					passing[1],
				],
			},
			{
				name: 'pageErrors',
				clients: [
					runtimeClient('client-a', {
						...passing[0].page,
						pageErrors: [{ message: 'secret page detail' }],
					}),
					passing[1],
				],
			},
		] as const;
		for (const candidate of cases) {
			const diagnostic = diagnoseAngularContactsLinkedWitnessRuntime(candidate.clients);
			expect(diagnostic.mismatches).toContain(candidate.name);
			expect(() => verifyAngularContactsLinkedWitnessRuntime(candidate.clients)).toThrow(
				candidate.name,
			);
		}

		const failedUrl = 'http://127.0.0.1:4200/api/contacts?token=private#secret';
		const failure = runtimeClient('client-b', {
			consoleMessages: [{ level: 'error', text: 'secret console detail' }],
			pageErrors: [{ message: 'secret page detail' }],
			failedRequests: [{ url: failedUrl, method: 'POST', reason: 'net::ERR_ABORTED' }],
			networkRequests: [
				{
					...passing[0].page.networkRequests[0],
					url: failedUrl,
					method: 'POST',
					status: 409,
					failedReason: 'net::ERR_ABORTED',
				},
			],
		});
		const diagnostic = diagnoseAngularContactsLinkedWitnessRuntime([passing[0], failure]);
		expect(diagnostic.mismatches).toContain('requestFailures');
		expect(diagnostic.actual.requestFailures).toMatchObject([
			{
				client: 'client-b',
				method: 'POST',
				reason: 'net::ERR_ABORTED',
				url: {
					url: 'http://127.0.0.1:4200/api/contacts',
					queryOrFragmentRedacted: true,
				},
				lifecycle: [{ status: 409, failedReason: 'net::ERR_ABORTED' }],
			},
		]);
		const emitted = canonicalDiagnosticError([passing[0], failure]);
		expect(emitted).not.toContain('token=private');
		expect(emitted).not.toContain('#secret');
		expect(emitted).not.toContain('secret console detail');
		expect(emitted).not.toContain('secret page detail');
	});
	test('launches two real linked-Witness browser clients through CRUD and network causality', async () => {
		const server = await startProbeServer();
		const receiptRoot = await mkdtemp(
			join(os.tmpdir(), 'versionless-angular-contacts-witness-'),
		);
		try {
			const probe = await runAngularContactsLinkedWitnessProbe({
				appOrigin: server.origin,
				receiptRoot,
			});
			expect(probe.directWitnessModule).toBe('link:../witness');
			expect(probe.clients).toBe(2);
			expect(probe.networkMethods).toEqual(['DELETE', 'GET', 'PATCH', 'POST']);
			expect(probe.interactions).toMatchObject({ click: 6, type: 4, press: 2 });
			expect(
				probe.requestUrls.every((url) => parseURL(url).host?.startsWith('127.0.0.1:')),
			).toBe(true);
			expect(probe.serviceWorkers).toEqual({
				registrations: 0,
				controllers: 0,
				requests: [],
			});
		} finally {
			await server.close();
			await rm(receiptRoot, { recursive: true, force: true });
		}
	}, 30_000);
	test('requires the complete eight-observation matrix', () => {
		const values = (['angular9-node16-native-compat', 'angular16-node18'] as const).flatMap(
			(lane) =>
				([1, 2] as const).flatMap((run) =>
					(['rest-visible-crud', 'two-client-socket-causality'] as const).map((journey) =>
						observation(lane, run, journey),
					),
				),
		);
		expect(() => verifyAngularContactsWitnessMatrix(values)).not.toThrow();
		expect(() => verifyAngularContactsWitnessMatrix(values.slice(1))).toThrow('incomplete');
	});
	test('rejects nonloopback, service-worker, and causality failures', () => {
		const value = observation('angular16-node18', 1, 'two-client-socket-causality');
		expect(verifyAngularContactsWitnessObservation(value)).toHaveLength(64);
		expect(() =>
			verifyAngularContactsWitnessObservation({
				...value,
				requestUrls: ['https://example.test'],
			}),
		).toThrow('nonloopback');
		expect(() =>
			verifyAngularContactsWitnessObservation({
				...value,
				serviceWorkers: { registrations: 1 as 0, controllers: 0, requests: [] },
			}),
		).toThrow('privacy/locality');
	});
});
