import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { joinURL } from 'ufo';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startStaticServer } from '../src/witness/real-app-run.ts';

const decisions: string[] = [];
let staticRoot = '';
let server: Awaited<ReturnType<typeof startStaticServer>> | null = null;
let upgrades: string[] = [];

beforeAll(async () => {
	staticRoot = await mkdtemp(path.join(os.tmpdir(), 'versionless-static-api-'));
	await writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>static</title>');
	upgrades = [];
	server = await startStaticServer(staticRoot, {
		api: async (request) => {
			decisions.push(`${request.method} ${request.pathname}${request.search}`);
			if (!request.pathname.startsWith('/api/')) return null;
			return {
				status: 200,
				contentType: 'application/json',
				body: Buffer.from(
					JSON.stringify({
						pathname: request.pathname,
						search: request.search,
						body: request.body.toString('utf8'),
					}),
				),
			};
		},
		upgrade: (request, socket) => {
			upgrades.push(request.url ?? '');
			socket.destroy();
		},
	});
});

afterAll(async () => {
	await server?.close();
	if (staticRoot.length > 0) await rm(staticRoot, { recursive: true, force: true });
});

describe('loopback production-static server local API projection', () => {
	it('lets the local API answer same-origin application paths with its exact query', async () => {
		const origin = server!.origin;
		const response = await fetch(
			joinURL(origin, '/api/conversations?status=closed&priority=priority'),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/json');
		expect(await response.json()).toEqual({
			pathname: '/api/conversations',
			search: '?status=closed&priority=priority',
			body: '',
		});
		expect(decisions).toContain('GET /api/conversations?status=closed&priority=priority');
	});

	it('hands the exact request body to the local API for mutating routes', async () => {
		const response = await fetch(joinURL(server!.origin, '/api/session'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ user: { email: 'agent@example.test' } }),
		});
		expect(await response.json()).toEqual({
			pathname: '/api/session',
			search: '',
			body: '{"user":{"email":"agent@example.test"}}',
		});
		expect(decisions).toContain('POST /api/session');
	});

	it('serves production-static bytes when the local API declines the path', async () => {
		const response = await fetch(joinURL(server!.origin, '/index.html'));
		expect(response.status).toBe(200);
		expect(await response.text()).toBe('<!doctype html><title>static</title>');
		const ledger = server!.ledger();
		const entry = ledger.find((item) => item.pathname === '/index.html');
		expect(entry?.resolvedFile).toBe('index.html');
		const projected = ledger.find((item) => item.pathname === '/api/conversations');
		expect(projected?.resolvedFile).toBeNull();
		expect(projected?.mime).toBe('application/json');
		server!.assertClean();
	});

	it('keeps every projected and static response inside the recorded loopback ledger', async () => {
		await fetch(joinURL(server!.origin, '/api/me'));
		const ledger = server!.ledger();
		expect(ledger.every((entry) => entry.status === 200)).toBe(true);
		expect(server!.requests()).toContain('/api/me');
	});
});
