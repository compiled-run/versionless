import { readFileSync } from 'node:fs';
import { join, resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../core/src/receipts/canonicalize.ts';
import {
	WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST,
	WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_SEED_FIXTURE,
	WITNESS_ANGULAR_ESHOP_WEBSPA_SELECTORS,
} from '../../core/src/receipts/witness-angular-eshop-webspa.ts';
import {
	createEshopWebspaProjection,
	eshopWebspaSeedDigest,
	ESHOP_WEBSPA_CONFIGURATION,
	ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST,
	ESHOP_WEBSPA_SEED,
	ESHOP_WEBSPA_UNPROJECTED_ENDPOINTS,
	replayEshopWebspaProjectionBehavior,
} from '../src/witness/angular-eshop-webspa-projection.ts';
import { angularEshopWebspaWitnessSpec } from '../src/witness/angular-eshop-webspa-spec.ts';

const root = resolve(import.meta.dirname, '../../..');
const get = async (pathname: string, search = ''): Promise<{ status: number; body: unknown }> => {
	const projection = createEshopWebspaProjection();
	const response = await projection.api({
		method: 'GET',
		pathname,
		search,
		body: Buffer.alloc(0),
	});
	if (response === null) return { status: 0, body: null };
	return {
		status: response.status,
		body:
			response.contentType === 'application/json'
				? (JSON.parse(response.body.toString('utf8')) as unknown)
				: response.body.toString('utf8'),
	};
};

describe('eShop WebSPA declared loopback projection', () => {
	it('is frozen by its replayed behavior digest', async () => {
		const replay = await replayEshopWebspaProjectionBehavior();
		expect(replay.digest).toBe(ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST);
		expect(replay.digest).toBe(WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST);
	});

	it('matches the committed seed fixture byte for byte', () => {
		const committed = JSON.parse(
			readFileSync(join(root, WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_SEED_FIXTURE), 'utf8'),
		) as Record<string, unknown>;
		const { sha256: digest, ...seed } = committed;
		expect(canonicalize(seed)).toBe(canonicalize(ESHOP_WEBSPA_SEED));
		expect(digest).toBe(eshopWebspaSeedDigest());
	});

	it('answers the same origin the application concatenates against', async () => {
		// `purchaseUrl` empty is what makes catalog.service.ts resolve same-origin.
		expect(ESHOP_WEBSPA_CONFIGURATION.purchaseUrl).toBe('');
		expect(ESHOP_WEBSPA_CONFIGURATION.identityUrl).toBe('');
		expect(ESHOP_WEBSPA_CONFIGURATION.activateCampaignDetailFunction).toBe(false);
		const configuration = await get('/Home/Configuration');
		expect(configuration.status).toBe(200);
		expect(configuration.body).toEqual(ESHOP_WEBSPA_CONFIGURATION);
	});

	it('pages and filters exactly the way the application asks it to', async () => {
		const first = (await get('/api/v1/c/catalog/items', '?pageIndex=0&pageSize=10')).body as {
			data: unknown[];
			count: number;
			pageIndex: number;
		};
		expect(first.count).toBe(20);
		expect(first.data).toHaveLength(10);
		expect(first.pageIndex).toBe(0);
		const second = (await get('/api/v1/c/catalog/items', '?pageIndex=1&pageSize=10')).body as {
			data: unknown[];
		};
		expect(second.data).toHaveLength(10);
		const byType = (
			await get('/api/v1/c/catalog/items/type/1/brand/', '?pageIndex=0&pageSize=10')
		).body as { count: number };
		expect(byType.count).toBe(5);
		const byBoth = (
			await get('/api/v1/c/catalog/items/type/1/brand/2', '?pageIndex=0&pageSize=10')
		).body as { count: number };
		expect(byBoth.count).toBe(1);
		// The application's own "All" option binds a null id, which the DOM
		// stringifies to "null"; the projection treats that as the whole facet
		// rather than as an unknown id.
		const allBrands = (
			await get('/api/v1/c/catalog/items/type/1/brand/null', '?pageIndex=0&pageSize=10')
		).body as { count: number };
		expect(allBrands.count).toBe(5);
	});

	it('fails closed, and distinguishes unknown from deliberately withheld', async () => {
		expect((await get('/api/v1/c/catalog/nope')).status).toBe(404);
		for (const entry of ESHOP_WEBSPA_UNPROJECTED_ENDPOINTS) {
			const stem = entry.path.includes('{')
				? entry.path.slice(0, entry.path.indexOf('{'))
				: entry.path;
			expect((await get(stem)).status).toBe(501);
		}
		// Static bytes are declined rather than answered, so the served output is
		// never shadowed by the projection.
		expect((await get('/index.html')).status).toBe(0);
		expect((await get('/assets/images/brand.png')).status).toBe(0);
	});

	it('starts every run from the frozen seed with an empty ledger', async () => {
		const first = createEshopWebspaProjection();
		await first.api({
			method: 'GET',
			pathname: '/Home/Configuration',
			search: '',
			body: Buffer.alloc(0),
		});
		expect(first.ledger()).toHaveLength(1);
		expect(createEshopWebspaProjection().ledger()).toHaveLength(0);
	});
});

describe('eShop WebSPA Witness specification', () => {
	it('declares one projection used identically by both lanes', () => {
		const spec = angularEshopWebspaWitnessSpec();
		expect(spec.app).toBe('angular-eshop-webspa');
		expect(spec.framework).toBe('angular');
		expect(spec.loopback).toBeDefined();
		// No live backend, no mocked non-loopback seams, and no transport
		// interception: everything this application reaches is same-origin.
		expect(spec.backend).toBeUndefined();
		expect(spec.transport).toBeUndefined();
		expect(spec.mockedNonLoopbackSeams).toBeUndefined();
		expect(Object.keys(spec.sources).sort()).toEqual(['baseline', 'migrated']);
	});

	it('addresses the application by its own class names', () => {
		for (const selector of Object.values(WITNESS_ANGULAR_ESHOP_WEBSPA_SELECTORS))
			expect(selector.includes('data-testid') || selector.includes('versionless')).toBe(
				false,
			);
	});
});
