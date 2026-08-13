/**
 * The cypress-realworld-app Witness calibration driver.
 *
 * The journey's selectors, routes and backend category were declared from the
 * application's own Cypress specs, never yet read off the live DOM+backend.
 * Pinning a stateful journey before the live surface has been measured is what
 * the TinyTranslator/Super-Productivity rounds spent passes undoing. This drives
 * ONE lane of the built production-static output against the application's REAL
 * Express-over-lowdb backend — booted through the SAME generic serving path the
 * proof uses (`startStaticServer` + `startLiveBackend`), so the origin/CORS
 * coordination this driver exercises is the product's, not a bespoke copy — and
 * prints every measurement: the ordered steps and their refusals, the recorded
 * navigations, every request outcome bucketed by origin, and the tracked-event
 * counts.
 *
 * It publishes nothing, asserts nothing of its own, and is not part of any
 * receipt. Its only output is stdout. The backend is booted in the application's
 * own era runtime cell (Node 14.16.1), reseeded from its frozen snapshot before
 * the pass, exactly as the live-backend serving path reseeds.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'pathe';
import { box, runBoxes } from '@async/witness';
import { createRegExp, charIn, exactly, oneOrMore } from 'magic-regexp';
import { joinURL, parseHost, parseURL, stringifyParsedURL } from 'ufo';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';
import {
	WITNESS_REACT_CYPRESS_RWA_ACTOR,
	WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY,
	WITNESS_REACT_CYPRESS_RWA_MOCKED_SEAMS,
	WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
	type WitnessReactCypressRwaMeasuredPass,
	type WitnessReactCypressRwaTwoLaneParity,
	summarizeWitnessReactCypressRwaTwoLaneParity,
	witnessReactCypressRwaMeasuredBehaviorDigest,
	witnessReactCypressRwaMeasuredSemanticDigest,
} from '../../../core/src/receipts/witness-react-cypress-rwa.ts';
import {
	type LiveBackendSpec,
	type WitnessCapturedMint,
	buildLoopbackBackendInventory,
	normalizeJourneyPlaceholders,
	startLiveBackend,
} from '../witness/live-backend.ts';
import { witnessNodeFileSystem } from '../witness/node-filesystem.ts';
import { createPlaywrightWitnessHost } from '../witness/playwright-host.ts';
import type { WitnessObservedRequestOutcome } from '../witness/playwright-host.ts';
import { startStaticServer } from '../witness/real-app-run.ts';
import { laneInventory } from './react-cypress-rwa-migration-run.ts';

const root = resolve(import.meta.dirname, '../../../..');
const workRoot = join(root, '.versionless/work/react-cypress-rwa');
const eraNodeBin = join(
	root,
	'.versionless/cache/react-cypress-rwa-runtime/node-v14.16.1-darwin-x64/bin',
);
const eraYarnBin = join(root, '.versionless/cache/react-cypress-rwa-baseline/npm-global/bin');
const chromiumExecutable = join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);

const laneStaticRoot = {
	baseline: join(workRoot, 'baseline/build-run1'),
	// The COMPLETE migrated Vite build (18 files, with index.html + hashed assets),
	// byte-identical across two builds. The `build-vite-run1` sibling is a partial
	// 6-file copy with no index.html and no assets, which serves a blank page —
	// pointing the migrated lane at it would measure nothing, not a migration break.
	migrated: join(workRoot, 'target/build-vite'),
} as const;

/** The application source lane the backend server is spawned from. */
const backendLaneRoot = join(workRoot, 'baseline');
const BACKEND_PORT = 3001;

const VIEWPORT = { width: 1280, height: 900 } as const;

/** A decodable placeholder answered in-context for the app's S3 avatar SVGs. */
const NON_LOOPBACK_PLACEHOLDER_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#dddddd"/></svg>';

/**
 * The application's own live-backend declaration, exactly as the AppSpec declares
 * it: the app's server command, the loopback host and port its built SPA
 * addresses, and the CORS-origin port variable the harness injects the served
 * port into. The era-runtime PATH is the one application-specific fact the
 * calibration adds — the proof's executeRun path inherits the runtime cell a
 * different way — so the serving/origin coordination measured here is the
 * generic one.
 */
const backendSpec: LiveBackendSpec = {
	command: 'yarn',
	args: ['start:api'],
	cwd: '.',
	port: BACKEND_PORT,
	host: 'localhost',
	corsOriginPortEnv: ['REACT_APP_PORT'],
	env: {
		PATH: `${eraNodeBin}:${eraYarnBin}:${process.env.PATH ?? ''}`,
		SKIP_YARN_COREPACK_CHECK: '1',
	},
	seed: { snapshot: 'data/database-seed.json', store: 'data/database.json' },
	prepare: [{ from: 'scripts/mock-aws-exports.js', to: 'src/aws-exports.js' }],
	health: { path: '/checkAuth', okStatus: [401] },
	readyTimeoutMs: 45_000,
};

const firstLine = (error: unknown): string =>
	(error instanceof Error ? error.message : String(error)).split('\n')[0]!.trim();

/** Swap the host of a `http://<host>:<port>` origin, keeping the bound port. */
function withHost(origin: string, host: string): string {
	const port = parseHost(parseURL(origin).host ?? '').port ?? '';
	return stringifyParsedURL({ protocol: 'http:', host: `${host}:${port}` });
}

function bucketRequests(
	outcomes: readonly WitnessObservedRequestOutcome[],
	staticOrigin: string,
	backendOrigin: string,
): unknown {
	const backend = new Map<string, { count: number; statuses: number[] }>();
	const other: Array<{ method: string; url: string; status: number | null }> = [];
	let staticCount = 0;
	for (const outcome of outcomes) {
		if (outcome.url.startsWith(staticOrigin)) {
			staticCount += 1;
			continue;
		}
		if (outcome.url.startsWith(backendOrigin)) {
			const parsed = parseURL(outcome.url.slice(backendOrigin.length));
			const path = parsed.pathname || '/';
			const key = `${outcome.method} ${path}`;
			const existing = backend.get(key);
			if (existing === undefined) backend.set(key, { count: 1, statuses: [outcome.status ?? 0] });
			else {
				existing.count += 1;
				if (!existing.statuses.includes(outcome.status ?? 0))
					existing.statuses.push(outcome.status ?? 0);
			}
			continue;
		}
		other.push({ method: outcome.method, url: outcome.url, status: outcome.status });
	}
	return {
		staticCount,
		backend: [...backend.entries()]
			.map(([key, value]) => ({ endpoint: key, ...value }))
			.sort((left, right) => left.endpoint.localeCompare(right.endpoint)),
		other,
	};
}

type PageSummary = {
	navigations: string[];
	trackedEvents: Record<string, number>;
	consoleErrors: number;
	pageErrors: number;
	failedRequests: number;
};

function pageSummary(receiptPath: string): PageSummary | null {
	const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as {
		boxes?: Array<{ pages?: Array<Record<string, unknown>> }>;
	};
	const page = receipt.boxes?.[0]?.pages?.[0];
	if (page === undefined) return null;
	return {
		navigations: (page.navigations as Array<{ url: string }> | undefined ?? []).map(
			(navigation) => {
				const parsed = parseURL(navigation.url);
				return `${parsed.pathname}${parsed.hash}`;
			},
		),
		trackedEvents: Object.fromEntries(
			Object.entries((page.trackedEvents as Record<string, unknown[]>) ?? {}).map(
				([name, events]) => [name, events.length],
			),
		),
		consoleErrors: (page.consoleMessages as Array<{ level: string }> | undefined)?.filter(
			(message) => message.level === 'error',
		).length ?? 0,
		pageErrors: (page.pageErrors as unknown[] | undefined)?.length ?? 0,
		failedRequests: (page.failedRequests as unknown[] | undefined)?.length ?? 0,
	};
}

/**
 * The one server-minted identifier that reaches the measured evidence: the
 * created user's id, which the settings write addresses as `PATCH
 * /users/<id>`. It is captured off the live request ledger and normalized to the
 * `{created-user-id}` token so two passes that minted different ids carry
 * identical behavior. Every other minted value (the account and transaction ids,
 * the recipient handle) is either kept off the wire in a form the category
 * records or dropped with the query string, so this is the only capture.
 */
const patchUserPath = createRegExp(
	exactly('/users/').and(oneOrMore(charIn('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-')).as('id')),
);

export function captureMintedUserId(
	outcomes: readonly WitnessObservedRequestOutcome[],
	backendOrigin: string,
): string | null {
	for (const outcome of outcomes) {
		if (outcome.method !== 'PATCH' || !outcome.url.startsWith(backendOrigin)) continue;
		const path = parseURL(outcome.url.slice(backendOrigin.length)).pathname ?? '';
		const match = patchUserPath.exec(path);
		if (match?.groups?.id !== undefined) return match.groups.id;
	}
	return null;
}

/** One measured pass, together with the raw per-origin request buckets kept for
 *  the human-readable evidence record (never fed into a digest). */
export type CypressRwaPassMeasurement = {
	measured: WitnessReactCypressRwaMeasuredPass;
	semanticDigest: string;
	behaviorDigest: string;
	raw: {
		staticOrigin: string;
		backendOrigin: string;
		status: string;
		failure: string;
		steps: Array<{ name: string; outcome: string }>;
		requests: unknown;
	};
};

export async function calibrateCypressRwaLane(
	lane: 'baseline' | 'migrated',
	pass: 1 | 2 = 1,
): Promise<CypressRwaPassMeasurement> {
	const actor = WITNESS_REACT_CYPRESS_RWA_ACTOR;
	const staticRoot = laneStaticRoot[lane];
	const receiptDir = join(root, '.versionless/stage/witness-react-cypress-rwa-calibrate', lane);
	// The generic serving path: bind the static server first, then boot the backend
	// with the ephemeral served SPA port injected, and address the browser at the
	// declared host so the document origin is the one the backend's CORS allow-list
	// admits.
	const staticServer = await startStaticServer(staticRoot, { profile: 'current-witness' });
	const servedOrigin = withHost(staticServer.origin, backendSpec.host ?? '127.0.0.1');
	const servedPort = Number(parseHost(parseURL(servedOrigin).host ?? '').port ?? '');
	const backend = await startLiveBackend(backendLaneRoot, backendSpec, { spaPort: servedPort });
	const host = createPlaywrightWitnessHost({
		chromiumExecutable,
		contextProfile: 'current-witness',
		viewport: VIEWPORT,
		// Every non-loopback request is answered in-context so nothing leaves the
		// machine: the application's S3 avatar SVGs get a decodable placeholder image
		// (so the page renders clean), anything else an empty 204. The host counts
		// all of these as mockedNonLoopback and keeps successfulNonLoopback at 0.
		transport: async (request) => {
			if (request.pathname.endsWith('.svg'))
				return {
					action: 'fulfill',
					status: 200,
					contentType: 'image/svg+xml',
					body: Buffer.from(NON_LOOPBACK_PLACEHOLDER_SVG),
				};
			return { action: 'fulfill', status: 204, contentType: 'text/plain', body: Buffer.alloc(0) };
		},
	});
	const steps: Array<{ name: string; outcome: string }> = [];
	let status = 'unknown';
	let failure = '';
	let receiptPath = '';
	const definition = box(`cypress-rwa-calibrate-${lane}`, async (context) => {
		// Signup is reached by a real load to `/signup`: clicking the signin page's
		// signup link does not SPA-navigate under automation (measured), so the
		// journey navigates there directly and the SPA index fallback renders the
		// SignUpForm. Every anchor below is a settled-reaction wait, never a sleep.
		const page = await context.browser.visit(joinURL(servedOrigin, '/signup'));
		await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');
		const expectPage = context.expect.page;
		const record = async (name: string, fn: () => Promise<void>): Promise<void> => {
			try {
				await fn();
				steps.push({ name, outcome: 'ok' });
			} catch (error: unknown) {
				steps.push({ name, outcome: `FAIL: ${firstLine(error)}` });
				throw error;
			}
		};
		// Settled-reaction anchor: waits (bounded, event-driven) until the selector
		// is in the DOM. A comma selector admits either of two settled shapes — a
		// populated list or the app's own empty-list marker — for a feed whose
		// content depends on the actor's relationships.
		const anchor = (name: string, selector: string): Promise<void> =>
			record(`anchor ${name}`, () => expectPage.exists(page, selector));
		const type = (name: string, selector: string, text: string): Promise<void> =>
			record(`type ${name}`, () => page.type(selector, text, { redact: false }));
		const click = (name: string, selector: string): Promise<void> =>
			record(`click ${name}`, () => page.click(selector, { timeoutMs: 8_000 }));

		// The MUI `data-test` on signup/signin/bankaccount/transaction-create sits on
		// the TextField ROOT, so the real <input> is `[data-test=…] input`; the
		// settings and peer-search fields carry `data-test` on the <input> itself
		// (inputProps), so they are addressed without the ` input` descendant. Both
		// facts are measured against the live DOM.

		// Sign up as a fresh NON-seed actor.
		await anchor('signup-form', '[data-test=signup-first-name] input');
		await type('signup-first', '[data-test=signup-first-name] input', actor.firstName);
		await type('signup-last', '[data-test=signup-last-name] input', actor.lastName);
		await type('signup-username', '[data-test=signup-username] input', actor.username);
		await type('signup-password', '[data-test=signup-password] input', actor.password);
		await type('signup-confirm', '[data-test=signup-confirmPassword] input', actor.password);
		await click('signup-submit', '[data-test=signup-submit]');

		// Sign in as it.
		await anchor('back-to-signin', '[data-test=signin-username] input');
		await type('signin-username', '[data-test=signin-username] input', actor.username);
		await type('signin-password', '[data-test=signin-password] input', actor.password);
		await click('signin-submit', '[data-test=signin-submit]');

		// Onboarding — the app's first-bank-account dialog (POST /graphql).
		await anchor('onboarding-dialog', '[data-test=user-onboarding-next]');
		await click('onboarding-next-1', '[data-test=user-onboarding-next]');
		await anchor('bank-form', '[data-test=bankaccount-bankName-input] input');
		await type('bank-name', '[data-test=bankaccount-bankName-input] input', 'Versionless Bank');
		await type('bank-routing', '[data-test=bankaccount-routingNumber-input] input', '987654321');
		await type('bank-account', '[data-test=bankaccount-accountNumber-input] input', '123456789');
		await click('bank-submit', '[data-test=bankaccount-submit]');
		await anchor('onboarding-done', '[data-test=user-onboarding-next]');
		await click('onboarding-next-2', '[data-test=user-onboarding-next]');

		// Settings write — a fresh actor has no email/phone, so the form is invalid
		// and Save stays disabled until both are filled; filling them and saving is
		// the mutating PATCH /users/{created-user-id} the journey proves.
		await anchor('home', '[data-test=sidenav-user-settings]');
		await click('nav-settings', '[data-test=sidenav-user-settings]');
		await anchor('settings-form', '[data-test=user-settings-email-input]');
		await type('settings-email', '[data-test=user-settings-email-input]', 'prover@versionless.test');
		await type('settings-phone', '[data-test=user-settings-phoneNumber-input]', '6155551234');
		await click('settings-submit', '[data-test=user-settings-submit]');

		// Money movement — search a peer (its handle is captured and normalized, never
		// recorded), send a payment the backend mints an id for (POST /transactions).
		await anchor('after-settings', '[data-test=nav-top-new-transaction]');
		await click('new-transaction', '[data-test=nav-top-new-transaction]');
		await anchor('peer-search', '[data-test=user-list-search-input]');
		await type('search-peer', '[data-test=user-list-search-input]', 'a');
		await anchor('peer-results', '[data-test^=user-list-item-]');
		await click('pick-peer', '[data-test^=user-list-item-]');
		await anchor('amount-form', '[data-test=transaction-create-amount-input] input');
		await type('amount', '[data-test=transaction-create-amount-input] input', '15');
		await type(
			'description',
			'[data-test=transaction-create-description-input] input',
			'versionless-proof-payment',
		);
		await click('submit-payment', '[data-test=transaction-create-submit-payment]');

		// The minted transaction round-trips lowdb into the actor's personal feed, and
		// the balance settles — the substantive stateful assertion of the journey.
		await anchor('payment-settled', '[data-test=sidenav-home]');
		await click('home', '[data-test=sidenav-home]');
		await click('personal-tab', '[data-test=nav-personal-tab]');
		await anchor('personal-feed', '[data-test=transaction-list]');
		await record('minted-tx-in-feed', () =>
			expectPage.bodyText(page, { contains: 'versionless-proof-payment' }),
		);
		await record('balance-settled', () =>
			expectPage.visible(page, '[data-test=sidenav-user-balance]'),
		);

		// Feed filter — the three feeds the app ships. Contacts is empty for a fresh
		// actor, so its settled shape is the app's own empty-list marker.
		await click('public-tab', '[data-test=nav-public-tab]');
		await anchor('public-feed', '[data-test=transaction-list]');
		await click('contacts-tab', '[data-test=nav-contacts-tab]');
		await anchor('contacts-feed', '[data-test=transaction-list], [data-test=empty-list-header]');
		await click('personal-tab-2', '[data-test=nav-personal-tab]');
		await anchor('personal-feed-2', '[data-test=transaction-list]');

		// Notifications — read the app's own notification feed (GET /notifications).
		await click('nav-notifications', '[data-test=sidenav-notifications]');
		await anchor(
			'notifications-settled',
			'[data-test=notifications-list], [data-test=empty-list-header]',
		);

		await record('tracked-events', () =>
			expectPage.outcome(page, {
				events: {
					click: { atLeast: 10 },
					input: { atLeast: 8 },
					keydown: { atLeast: 8 },
				},
			}),
		);

		await context.receipt.capture('calibration-complete');
	});
	try {
		const result = await runBoxes({
			root: staticRoot,
			boxes: [
				{
					file: join(staticRoot, 'versionless-runtime.box.ts'),
					relativeFile: 'versionless-runtime.box.ts',
					exportName: 'default',
					box: definition,
				},
			],
			receiptDir,
			assertionTimeoutMs: 8_000,
			fileSystem: witnessNodeFileSystem,
			browser: host.browser,
			headless: true,
		});
		status = result.status;
		failure = result.boxes[0]?.error?.message ?? '';
		receiptPath = result.receiptPath;
	} finally {
		await staticServer.close();
		await backend.close();
	}
	const outcomes = host.requestOutcomes();
	const page = receiptPath === '' ? null : pageSummary(receiptPath);
	const locality = host.locality();
	if (status !== 'passed' || page === null)
		throw new Error(`cypress-rwa calibration lane ${lane} did not pass: ${failure || status}`);

	// Normalize the one server-minted id that reaches the wire (the created user's
	// id in the settings PATCH) to its declared placeholder token, so two passes
	// that minted different ids carry byte-identical behavior. The backend
	// inventory is then built off the normalized ledger and admitted against the
	// declared category.
	const mintedUserId = captureMintedUserId(outcomes, backend.origin);
	const mints: WitnessCapturedMint[] = mintedUserId
		? [{ ...WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS[0]!, value: mintedUserId }]
		: [];
	// The loopback-backend inventory is built only over the two bounded loopback
	// origins. The application's one non-loopback seam — the S3 avatar SVGs — is a
	// separately declared category (answered in-context, counted in
	// mockedNonLoopback, successfulNonLoopback fixed at 0), so those requests are
	// held out here rather than admitted to the backend category. Every held-out
	// request must be to the declared seam host, or the locality claim fails.
	const seamHost = parseHost(
		parseURL(WITNESS_REACT_CYPRESS_RWA_MOCKED_SEAMS[0]!.path).host ?? '',
	).hostname;
	const loopbackOutcomes: WitnessObservedRequestOutcome[] = [];
	for (const outcome of outcomes) {
		if (outcome.url.startsWith(servedOrigin) || outcome.url.startsWith(backend.origin)) {
			loopbackOutcomes.push(outcome);
			continue;
		}
		const host = parseHost(parseURL(outcome.url).host ?? '').hostname;
		if (host !== seamHost)
			throw new Error(
				`cypress-rwa calibration lane ${lane} reached an undeclared non-loopback origin: ${outcome.url}`,
			);
	}
	const normalizedOutcomes = normalizeJourneyPlaceholders(
		loopbackOutcomes.map((outcome) => ({ ...outcome })),
		mints,
	);
	const inventory = buildLoopbackBackendInventory(
		normalizedOutcomes,
		servedOrigin,
		backend.origin,
		WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY,
	);
	const laneStatic = await laneInventory(staticRoot);

	const measured: WitnessReactCypressRwaMeasuredPass = {
		lane,
		pass,
		status: 'passed',
		behavior: {
			legs: { ok: steps.filter((step) => step.outcome === 'ok').length, total: steps.length },
			navigations: page.navigations,
			trackedEventCounts: page.trackedEvents,
			consoleErrors: page.consoleErrors,
			pageErrors: page.pageErrors,
			failedRequests: page.failedRequests,
			successfulNonLoopback: 0,
			mockedNonLoopback: locality.mockedNonLoopback,
			backend: inventory.observed.map((observation) => ({
				method: observation.method,
				path: observation.path,
				requests: observation.requests,
				statuses: [...observation.statuses],
			})),
		},
		presentation: {
			laneStaticFiles: laneStatic.files.length,
			laneStaticDigest: laneStatic.digest,
		},
		placeholders: WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
	};
	if (locality.successfulNonLoopback !== 0)
		throw new Error(
			`cypress-rwa calibration lane ${lane} reached ${locality.successfulNonLoopback} non-loopback origins`,
		);
	return {
		measured,
		semanticDigest: witnessReactCypressRwaMeasuredSemanticDigest(measured),
		behaviorDigest: witnessReactCypressRwaMeasuredBehaviorDigest(measured),
		raw: {
			staticOrigin: servedOrigin,
			backendOrigin: backend.origin,
			status,
			failure,
			steps,
			requests: bucketRequests(outcomes, servedOrigin, backend.origin),
		},
	};
}

/**
 * Drive the FULL journey on both lanes twice each (baseline×2, migrated×2), each
 * pass reseeded from the frozen snapshot by the live-backend serving path, and
 * prove — measured, not asserted — two-lane behavior parity and pass-twice
 * determinism. The verdict is computed by the shared core gate
 * {@link summarizeWitnessReactCypressRwaTwoLaneParity}, which throws on any
 * divergence, so a real break surfaces as a thrown finding rather than a papered
 * digest. The measured passes and the verdict are written into the holdout run
 * evidence directory; nothing here is a published or canonical witness receipt.
 */
export async function calibrateCypressRwaParity(): Promise<{
	parity: WitnessReactCypressRwaTwoLaneParity;
	passes: CypressRwaPassMeasurement[];
}> {
	const passes: CypressRwaPassMeasurement[] = [];
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) passes.push(await calibrateCypressRwaLane(lane, pass));
	const parity = summarizeWitnessReactCypressRwaTwoLaneParity(passes.map((entry) => entry.measured));
	const evidenceDir = join(root, 'evidence/runs/react-cypress-rwa');
	await mkdir(evidenceDir, { recursive: true });
	await writeFile(
		join(evidenceDir, 'two-lane-parity.json'),
		`${JSON.stringify(
			{
				measuredAt: new Date().toISOString().slice(0, 10),
				parity,
				passes: passes.map((entry) => ({
					lane: entry.measured.lane,
					pass: entry.measured.pass,
					semanticDigest: entry.semanticDigest,
					behaviorDigest: entry.behaviorDigest,
					measured: entry.measured,
					raw: entry.raw,
				})),
			},
			null,
			'\t',
		)}\n`,
	);
	return { parity, passes };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const command = args[0];
	if (command === 'parity') {
		const { parity } = await calibrateCypressRwaParity();
		process.stdout.write(`${canonicalize(parity)}\n`);
		return;
	}
	if (command !== 'baseline' && command !== 'migrated')
		throw new Error('cypress-rwa calibration requires: baseline | migrated | parity');
	const measurement = await calibrateCypressRwaLane(command);
	process.stdout.write(
		`${canonicalize({
			lane: measurement.measured.lane,
			semanticDigest: measurement.semanticDigest,
			behaviorDigest: measurement.behaviorDigest,
			measured: measurement.measured,
			raw: measurement.raw,
		})}\n`,
	);
}

if (basename(process.argv[1] ?? '') === 'react-cypress-rwa-calibrate-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
