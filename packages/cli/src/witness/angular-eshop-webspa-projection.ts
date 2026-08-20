import { parseQuery } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

/**
 * Frozen synthetic eShop WebSPA API projection.
 *
 * The retained eShopOnContainers WebSPA is a backend-coupled enterprise SPA: its
 * root component calls `GET ${document.baseURI}Home/Configuration` on boot (a
 * payload its ASP.NET host renders from `appsettings.json`), stores the returned
 * service origins, and only then does its catalog page issue the three requests
 * that make it render anything at all. Spawning the real .NET microservice stack
 * is off-charter, so this module is the deterministic state machine that answers
 * exactly the same-origin surface the pinned client reaches.
 *
 * Every endpoint below was measured, not invented. The configuration payload is
 * the application's own `IConfiguration` interface field-for-field; the catalog
 * paths are the exact strings `catalog.service.ts` concatenates onto
 * `serverSettings.purchaseUrl`, and the same strings appear verbatim in both
 * lanes' emitted `main.*.js`. Declaring `purchaseUrl` as the empty string is what
 * makes those concatenations resolve same-origin against the bounded loopback
 * document origin — the application's own URL construction is untouched.
 *
 * Four properties make it evidence rather than a mock:
 *
 * 1. It fails closed. A path the pinned client never calls is refused with a
 *    named refusal, and a path the client DOES call that this projection
 *    deliberately does not answer (basket, orders, campaigns) is refused with a
 *    DIFFERENT named refusal, so "unknown to the application" and "known and
 *    withheld" can never be confused in the ledger.
 * 2. Every transport decision is ledgered — method, path, query, endpoint id,
 *    decision, status, and digests of the request and response bytes.
 * 3. Its behavior is frozen by digest. {@link ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST}
 *    is taken over the replay of a fixed transcript, so a journey cannot drift
 *    the projection's answers without the digest test failing first.
 * 4. It is identical in both lanes. The same factory answers the era baseline
 *    build and the migrated build, so a behavioral difference between the two
 *    cannot come from the surface they were served.
 *
 * It holds no session and no mutable state: the anonymous catalog surface this
 * projection serves is read-only, so every request is answered from the frozen
 * seed and pass two cannot inherit anything from pass one.
 */
export const ESHOP_WEBSPA_PROJECTION_LABEL = 'synthetic-fixture-evidence-data' as const;

/** The pinned upstream commit whose `src/Web/WebSPA` this projection answers. */
export const ESHOP_WEBSPA_PINNED_COMMIT = 'a387f21029f0b2d49614d165d5384717d2398f8e' as const;

/** The application's own `IConfiguration` shape (`shared/models/configuration.model.ts`). */
export type EshopWebspaConfiguration = {
	identityUrl: string;
	marketingUrl: string;
	purchaseUrl: string;
	signalrHubUrl: string;
	activateCampaignDetailFunction: boolean;
};

/** `shared/models/catalogBrand.model.ts`. */
export type EshopWebspaCatalogBrand = { id: number; brand: string };
/** `shared/models/catalogType.model.ts`. */
export type EshopWebspaCatalogType = { id: number; type: string };
/** `shared/models/catalogItem.model.ts`. */
export type EshopWebspaCatalogItem = {
	id: string;
	name: string;
	description: string;
	price: number;
	pictureUri: string;
	catalogBrandId: number;
	catalogBrand: string;
	catalogTypeId: number;
	catalogType: string;
	units: number;
};
/** `shared/models/catalog.model.ts`. */
export type EshopWebspaCatalogPage = {
	pageIndex: number;
	pageSize: number;
	count: number;
	data: EshopWebspaCatalogItem[];
};

/**
 * The declared configuration payload.
 *
 * Every service origin is the empty string, and that is a claim rather than a
 * convenience: it says this run projects the same-origin loopback surface and
 * nothing else. `purchaseUrl` empty makes the catalog concatenations resolve
 * against the served document origin. `identityUrl` empty is the truthful
 * surface limitation — no identity provider is projected, so `Login` is out of
 * surface and the journey never touches it. `signalrHubUrl` is never read
 * anonymously (`SignalrService.init()` returns early unless authorized) and
 * `activateCampaignDetailFunction` false is the campaigns switch the anonymous
 * surface leaves off.
 */
export const ESHOP_WEBSPA_CONFIGURATION: EshopWebspaConfiguration = Object.freeze({
	identityUrl: '',
	marketingUrl: '',
	purchaseUrl: '',
	signalrHubUrl: '',
	activateCampaignDetailFunction: false,
});

/**
 * The picture every catalog item declares.
 *
 * `catalog.component.html` renders `<img src="{{item.pictureUri}}">`, so the
 * value is a URL the browser will fetch. It is declared as an asset the two
 * lanes both ship (`assets/images/brand.png` is present, byte-identical in name
 * and set, in both emitted outputs), which is what keeps the run at zero
 * non-loopback requests and zero failed requests without suppressing anything.
 */
export const ESHOP_WEBSPA_PICTURE_URI = 'assets/images/brand.png' as const;

const BRAND_NAMES = [
	'Contoso Cloud',
	'Northwind Labs',
	'Fabrikam Works',
	'Adventure Supply',
	'Tailspin Gear',
] as const;
const TYPE_NAMES = ['Mug', 'Tee', 'Poster', 'Sticker Pack'] as const;

const brands: EshopWebspaCatalogBrand[] = BRAND_NAMES.map((brand, index) => ({
	id: index + 1,
	brand,
}));
const types: EshopWebspaCatalogType[] = TYPE_NAMES.map((type, index) => ({
	id: index + 1,
	type,
}));
const items: EshopWebspaCatalogItem[] = brands.flatMap((brand) =>
	types.map((type) => {
		const ordinal = (brand.id - 1) * types.length + type.id;
		return {
			id: String(ordinal),
			name: `${brand.brand} ${type.type}`,
			description: `Synthetic evidence catalogue entry ${String(ordinal)}.`,
			price: ordinal + 0.5,
			pictureUri: ESHOP_WEBSPA_PICTURE_URI,
			catalogBrandId: brand.id,
			catalogBrand: brand.brand,
			catalogTypeId: type.id,
			catalogType: type.type,
			units: 0,
		};
	}),
);

export type EshopWebspaSeed = {
	configuration: EshopWebspaConfiguration;
	brands: EshopWebspaCatalogBrand[];
	types: EshopWebspaCatalogType[];
	items: EshopWebspaCatalogItem[];
};

/**
 * The projection's synthetic seed, committed alongside the fixture as
 * `fixtures/angular-eshop-webspa/witness-projection-seed.json`.
 *
 * None of it is captured production data. The upstream catalogue's real brands
 * and types are deliberately NOT reproduced: nothing here should be readable as
 * evidence about the real eShopOnContainers catalog service.
 */
export const ESHOP_WEBSPA_SEED: EshopWebspaSeed = Object.freeze({
	configuration: ESHOP_WEBSPA_CONFIGURATION,
	brands: Object.freeze(brands) as EshopWebspaCatalogBrand[],
	types: Object.freeze(types) as EshopWebspaCatalogType[],
	items: Object.freeze(items) as EshopWebspaCatalogItem[],
});

export const eshopWebspaSeedDigest = (): string => sha256(canonicalize(ESHOP_WEBSPA_SEED));

/** The same-origin endpoints this projection answers, measured off the pinned client. */
export const ESHOP_WEBSPA_PROJECTED_ENDPOINTS = Object.freeze([
	'home.configuration',
	'catalog.brands',
	'catalog.types',
	'catalog.items',
	'catalog.items.filtered',
] as const);

/**
 * Endpoints the pinned client enumerates and this projection deliberately
 * withholds. Every one of them sits behind the identity gate the anonymous
 * surface never opens, so withholding them is what keeps the surface honest
 * rather than what limits it.
 */
export const ESHOP_WEBSPA_UNPROJECTED_ENDPOINTS = Object.freeze([
	{
		endpoint: 'basket.get',
		method: 'GET',
		path: '/api/v1/b/basket/{buyerId}',
		reason: 'the basket is reachable only for an authenticated buyer',
	},
	{
		endpoint: 'basket.update',
		method: 'POST',
		path: '/api/v1/basket/',
		reason: 'add-to-cart is disabled on the anonymous catalog surface',
	},
	{
		endpoint: 'basket.checkout',
		method: 'POST',
		path: '/api/v1/b/basket/checkout',
		reason: 'checkout is reachable only for an authenticated buyer',
	},
	{
		endpoint: 'orders.list',
		method: 'GET',
		path: '/api/v1/o/orders',
		reason: 'orders are reachable only for an authenticated buyer',
	},
	{
		endpoint: 'orders.detail',
		method: 'GET',
		path: '/api/v1/o/orders/{id}',
		reason: 'orders are reachable only for an authenticated buyer',
	},
	{
		endpoint: 'campaigns.list',
		method: 'GET',
		path: '/api/v1/m/campaigns/user',
		reason: 'campaigns are gated behind both identity and the configuration switch',
	},
	{
		endpoint: 'campaigns.detail',
		method: 'GET',
		path: '/api/v1/m/campaigns/{id}',
		reason: 'campaigns are gated behind both identity and the configuration switch',
	},
] as const);

export type EshopWebspaProjectionDecision =
	| 'served'
	| 'refused-unknown'
	| 'refused-unprojected'
	| 'declined-non-api';

export type EshopWebspaProjectionLedgerRecord = {
	sequence: number;
	method: string;
	pathname: string;
	search: string;
	endpoint: string | null;
	decision: EshopWebspaProjectionDecision;
	status: number | null;
	requestSha256: string;
	responseSha256: string | null;
};

export type EshopWebspaApiRequest = {
	method: string;
	pathname: string;
	search: string;
	body: Buffer;
};
export type EshopWebspaApiResponse = { status: number; contentType: string; body: Buffer };

export type EshopWebspaProjection = {
	api(request: EshopWebspaApiRequest): Promise<EshopWebspaApiResponse | null>;
	ledger(): EshopWebspaProjectionLedgerRecord[];
};

const CONFIGURATION_PATH = '/Home/Configuration';
const CATALOG_PREFIX = '/api/v1/c/catalog';
const BRANDS_PATH = `${CATALOG_PREFIX}/catalogbrands`;
const TYPES_PATH = `${CATALOG_PREFIX}/catalogtypes`;
const ITEMS_PATH = `${CATALOG_PREFIX}/items`;

/** Page size floor and ceiling, so a hand-typed query cannot ask for an unbounded page. */
const MAX_PAGE_SIZE = 100;

const numberFrom = (value: unknown, fallback: number): number => {
	if (typeof value !== 'string' || value.length === 0) return fallback;
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

/**
 * `catalog.service.ts` builds `/items/type/<type>/brand/<brand>`, where either
 * segment may be the literal `all`, a numeric id, or (for brand) empty. The
 * segments are read positionally rather than by pattern, so the shape the
 * application builds is matched exactly and nothing wider.
 */
const filterSegments = (pathname: string): { type: string; brand: string } | null => {
	if (!pathname.startsWith(`${ITEMS_PATH}/`)) return null;
	const segments = pathname.slice(ITEMS_PATH.length + 1).split('/');
	if (segments.length !== 4) return null;
	const [typeKeyword, type, brandKeyword, brand] = segments;
	if (typeKeyword !== 'type' || brandKeyword !== 'brand') return null;
	if (type === undefined || brand === undefined) return null;
	return { type, brand };
};

const matchesFacet = (selector: string, id: number): boolean => {
	if (selector.length === 0 || selector === 'all' || selector === 'null') return true;
	return selector === String(id);
};

const pageOf = (
	source: readonly EshopWebspaCatalogItem[],
	pageIndex: number,
	pageSize: number,
): EshopWebspaCatalogPage => {
	const start = pageIndex * pageSize;
	return {
		pageIndex,
		pageSize,
		count: source.length,
		data: source.slice(start, start + pageSize).map((item) => ({ ...item })),
	};
};

const unprojected = (pathname: string): string | null => {
	for (const entry of ESHOP_WEBSPA_UNPROJECTED_ENDPOINTS) {
		const stem = entry.path.includes('{')
			? entry.path.slice(0, entry.path.indexOf('{'))
			: entry.path;
		if (pathname === stem || pathname.startsWith(stem)) return entry.endpoint;
	}
	return null;
};

/**
 * One projection instance per run. The factory is invoked once per (lane, pass)
 * by the generic runner, so each pass starts from the frozen seed with an empty
 * ledger.
 */
export function createEshopWebspaProjection(): EshopWebspaProjection {
	const records: EshopWebspaProjectionLedgerRecord[] = [];

	const record = (
		request: EshopWebspaApiRequest,
		endpoint: string | null,
		decision: EshopWebspaProjectionDecision,
		response: EshopWebspaApiResponse | null,
	): EshopWebspaApiResponse | null => {
		records.push({
			sequence: records.length,
			method: request.method,
			pathname: request.pathname,
			search: request.search,
			endpoint,
			decision,
			status: response === null ? null : response.status,
			requestSha256: sha256(request.body),
			responseSha256: response === null ? null : sha256(response.body),
		});
		return response;
	};

	const json = (status: number, value: unknown): EshopWebspaApiResponse => ({
		status,
		contentType: 'application/json',
		body: Buffer.from(`${canonicalize(value)}`),
	});

	return {
		api: async (request) => {
			const { pathname } = request;
			if (pathname !== CONFIGURATION_PATH && !pathname.startsWith('/api/'))
				return record(request, null, 'declined-non-api', null);

			if (pathname === CONFIGURATION_PATH && request.method === 'GET')
				return record(
					request,
					'home.configuration',
					'served',
					json(200, ESHOP_WEBSPA_CONFIGURATION),
				);
			if (pathname === BRANDS_PATH && request.method === 'GET')
				return record(
					request,
					'catalog.brands',
					'served',
					json(200, ESHOP_WEBSPA_SEED.brands),
				);
			if (pathname === TYPES_PATH && request.method === 'GET')
				return record(
					request,
					'catalog.types',
					'served',
					json(200, ESHOP_WEBSPA_SEED.types),
				);

			const query = parseQuery(request.search);
			const pageIndex = numberFrom(query['pageIndex'], 0);
			const pageSize = Math.min(numberFrom(query['pageSize'], 10), MAX_PAGE_SIZE);

			if (pathname === ITEMS_PATH && request.method === 'GET')
				return record(
					request,
					'catalog.items',
					'served',
					json(200, pageOf(ESHOP_WEBSPA_SEED.items, pageIndex, pageSize)),
				);

			const facets = filterSegments(pathname);
			if (facets !== null && request.method === 'GET') {
				const filtered = ESHOP_WEBSPA_SEED.items.filter(
					(item) =>
						matchesFacet(facets.type, item.catalogTypeId) &&
						matchesFacet(facets.brand, item.catalogBrandId),
				);
				return record(
					request,
					'catalog.items.filtered',
					'served',
					json(200, pageOf(filtered, pageIndex, pageSize)),
				);
			}

			const withheld = unprojected(pathname);
			if (withheld !== null)
				return record(request, withheld, 'refused-unprojected', {
					status: 501,
					contentType: 'text/plain',
					body: Buffer.from('unprojected-endpoint'),
				});

			return record(request, null, 'refused-unknown', {
				status: 404,
				contentType: 'text/plain',
				body: Buffer.from('unknown-endpoint'),
			});
		},
		ledger: () => records.map((entry) => ({ ...entry })),
	};
}

export type EshopWebspaTranscriptStep = { method: string; pathname: string; search: string };

/**
 * The frozen transcript the behavior digest is taken over. It covers every
 * projected endpoint, both refusal kinds, and the decline that lets static bytes
 * through, so no answer of this projection can drift unobserved.
 */
export const ESHOP_WEBSPA_PROJECTION_BEHAVIOR_TRANSCRIPT: readonly EshopWebspaTranscriptStep[] =
	Object.freeze([
		{ method: 'GET', pathname: '/index.html', search: '' },
		{ method: 'GET', pathname: CONFIGURATION_PATH, search: '' },
		{ method: 'GET', pathname: BRANDS_PATH, search: '' },
		{ method: 'GET', pathname: TYPES_PATH, search: '' },
		{ method: 'GET', pathname: ITEMS_PATH, search: '?pageIndex=0&pageSize=10' },
		{ method: 'GET', pathname: ITEMS_PATH, search: '?pageIndex=1&pageSize=10' },
		{
			method: 'GET',
			pathname: `${ITEMS_PATH}/type/1/brand/`,
			search: '?pageIndex=0&pageSize=10',
		},
		{
			method: 'GET',
			pathname: `${ITEMS_PATH}/type/1/brand/2`,
			search: '?pageIndex=0&pageSize=10',
		},
		{
			method: 'GET',
			pathname: `${ITEMS_PATH}/type/all/brand/3`,
			search: '?pageIndex=0&pageSize=10',
		},
		{ method: 'GET', pathname: '/api/v1/o/orders', search: '' },
		{ method: 'POST', pathname: '/api/v1/basket/', search: '' },
		{ method: 'GET', pathname: '/api/v1/c/catalog/unknown', search: '' },
	]);

export type EshopWebspaBehaviorReplayStep = {
	step: EshopWebspaTranscriptStep;
	status: number | null;
	body: unknown;
};
export type EshopWebspaBehaviorReplay = {
	steps: EshopWebspaBehaviorReplayStep[];
	ledger: EshopWebspaProjectionLedgerRecord[];
	digest: string;
};

/** Replay the frozen transcript through a fresh projection and digest the result. */
export async function replayEshopWebspaProjectionBehavior(): Promise<EshopWebspaBehaviorReplay> {
	const projection = createEshopWebspaProjection();
	const steps: EshopWebspaBehaviorReplayStep[] = [];
	for (const step of ESHOP_WEBSPA_PROJECTION_BEHAVIOR_TRANSCRIPT) {
		const response = await projection.api({ ...step, body: Buffer.alloc(0) });
		steps.push({
			step,
			status: response === null ? null : response.status,
			body:
				response === null
					? null
					: response.contentType === 'application/json'
						? (JSON.parse(response.body.toString('utf8')) as unknown)
						: response.body.toString('utf8'),
		});
	}
	const ledger = projection.ledger();
	return { steps, ledger, digest: sha256(canonicalize({ steps, ledger })) };
}

/**
 * The frozen behavior digest. It is asserted by the node gate and re-asserted by
 * the runner before a browser is launched, so the projection cannot drift.
 */
export const ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST =
	'747dc5258b30703c9b29f3c0087e1728e93fc160f1cbf3c53f9589ee09aad849' as const;
