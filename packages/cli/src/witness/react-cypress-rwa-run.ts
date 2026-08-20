import {
	REACT_CYPRESS_RWA_SOURCE,
	WITNESS_REACT_CYPRESS_RWA_ACTOR,
	WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY,
	WITNESS_REACT_CYPRESS_RWA_MOCKED_SEAMS,
	WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
} from '../../../core/src/receipts/witness-react-cypress-rwa.ts';
import { buildLoopbackBackendInventory } from './live-backend.ts';
import type { AppSpec } from './real-app-run.ts';

/** A decodable placeholder the harness answers in-context for the app's S3 avatar SVGs. */
const CYPRESS_RWA_PLACEHOLDER_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#dddddd"/></svg>';

/**
 * The cypress-realworld-app live-backend Witness spec — the corpus's first
 * stateful vertical.
 *
 * The journey is wired straight from the application's own Cypress specs under
 * `cypress/tests/ui`, which are the intended exercisable surface: `auth.spec`
 * (sign up / sign in), `new-transaction.spec` (send money), `transaction-feeds`
 * (public / contacts / personal filters), `notifications` and `user-settings`.
 * Every gesture is addressed by the application's own `data-test` attribute, so
 * the selectors are the app's, not the harness's. The backend declaration spawns
 * the application's REAL Express-over-lowdb server on a second bounded loopback
 * origin and re-seeds it from its frozen snapshot before each pass.
 *
 * Redaction is structural: the journey signs up a fresh, NON-SEED corpus actor
 * and acts as it; the one place a seed identity is touched — the recipient of
 * the payment — is captured from search and never written literally, it is
 * declared as `{recipient-handle}` and normalized away. No seed username,
 * password or hash is hard-coded here, and the redaction test enforces it.
 *
 * This spec is exported for the runner unit to execute; no evidence is published
 * from the unit that authored it.
 */
export function reactCypressRwaWitnessSpec(): AppSpec {
	const actor = WITNESS_REACT_CYPRESS_RWA_ACTOR;
	return {
		app: 'cypress-realworld-app',
		framework: 'react',
		canonicalReceipt: 'evidence/runs/react-cypress-rwa/rerun-2026-08-12/build-profile.json',
		canonicalDigest: '981fbff5b2c8a4e257544bf6ba6abb25334c686fd56605edd6e0a89f4795d1ae',
		canonicalBinding: 'file-sha256',
		sources: {
			baseline: '.versionless/stage/witness-real-app/lanes/cypress-realworld-app/baseline',
			migrated: '.versionless/stage/witness-real-app/lanes/cypress-realworld-app/migrated',
		},
		// A real load to `/signup`: the signin page's signup link does not
		// SPA-navigate under automation (measured), so the journey starts at the
		// signup route directly and the SPA index fallback renders the SignUpForm.
		initialRoute: '/signup',
		/**
		 * The application's own server. Command and port are the app's declared
		 * ones; the harness copies the frozen seed over the mutable lowdb store and
		 * runs the app's own prerequisite mock-config copy before boot, then waits
		 * for the auth-gated `/checkAuth` route to answer — a 401 before any session
		 * exists is a server that is up.
		 */
		backend: {
			command: 'yarn',
			args: ['start:api'],
			cwd: '.',
			port: 3001,
			// The built SPA calls its backend absolutely at `http://localhost:3001`
			// and the server's own CORS allow-origin is `http://localhost:<port>`, so
			// the document has to be served under `localhost` too or every
			// credentialed request is cross-origin. Both are the application's own
			// facts, declared here rather than branched on in the runner.
			host: 'localhost',
			// The server reads `REACT_APP_PORT` to build that CORS allow-origin; the
			// harness injects the actual served SPA port into it so the allow-list
			// resolves to the exact origin the browser is served from.
			corsOriginPortEnv: ['REACT_APP_PORT'],
			seed: { snapshot: 'data/database-seed.json', store: 'data/database.json' },
			prepare: [{ from: 'scripts/mock-aws-exports.js', to: 'src/aws-exports.js' }],
			health: { path: '/checkAuth', okStatus: [401] },
			readyTimeoutMs: 30_000,
		},
		placeholders: WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
		// The application renders every user's avatar from an `<img src>` at its own
		// S3 SVG bucket; declaring the full seed-avatar set is what makes an
		// undeclared seam fail the run. The harness answers every one in-context, so
		// none leaves the machine.
		mockedNonLoopbackSeams: {
			baseline: WITNESS_REACT_CYPRESS_RWA_MOCKED_SEAMS,
			migrated: WITNESS_REACT_CYPRESS_RWA_MOCKED_SEAMS,
		},
		// Non-loopback requests are answered in-context: the avatar SVGs get a
		// decodable placeholder image so the page renders clean; anything else an
		// empty 204. The host counts these as mockedNonLoopback and keeps
		// successfulNonLoopback at zero.
		transport: async (request) => {
			if (request.pathname.endsWith('.svg'))
				return {
					action: 'fulfill',
					status: 200,
					contentType: 'image/svg+xml',
					body: Buffer.from(CYPRESS_RWA_PLACEHOLDER_SVG),
				};
			return {
				action: 'fulfill',
				status: 204,
				contentType: 'text/plain',
				body: Buffer.alloc(0),
			};
		},
		journey: async (context, page, _transportEvidence, lifecycle) => {
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');
			const expectPage = context.expect.page;
			// The MUI `data-test` on signup/signin/bankaccount/transaction-create is on
			// the TextField ROOT, so the real <input> is `[data-test=…] input`; the
			// settings and peer-search fields carry `data-test` on the <input> itself,
			// so they are addressed without ` input`. Both are measured off the live DOM.

			// Auth — the initial load is a real navigation to `/signup`; sign a fresh
			// non-seed actor up, then sign in as it. No seed identity is touched.
			await expectPage.exists(page, '[data-test=signup-first-name] input');
			await page.type('[data-test=signup-first-name] input', actor.firstName);
			await page.type('[data-test=signup-last-name] input', actor.lastName);
			await page.type('[data-test=signup-username] input', actor.username);
			await page.type('[data-test=signup-password] input', actor.password);
			await page.type('[data-test=signup-confirmPassword] input', actor.password);
			await page.click('[data-test=signup-submit]');
			await expectPage.exists(page, '[data-test=signin-username] input');
			await page.type('[data-test=signin-username] input', actor.username);
			await page.type('[data-test=signin-password] input', actor.password);
			await page.click('[data-test=signin-submit]');

			// Onboarding — the app's first-bank-account dialog (a POST /graphql
			// mutation), then the actor completes its required settings so a mutating
			// PATCH /users/{created-user-id} is proven before any transfer. A fresh
			// actor has no email or phone, so Save stays disabled until both are set.
			await expectPage.exists(page, '[data-test=user-onboarding-next]');
			await page.click('[data-test=user-onboarding-next]');
			await expectPage.exists(page, '[data-test=bankaccount-bankName-input] input');
			await page.type('[data-test=bankaccount-bankName-input] input', 'Versionless Bank');
			await page.type('[data-test=bankaccount-routingNumber-input] input', '987654321');
			await page.type('[data-test=bankaccount-accountNumber-input] input', '123456789');
			await page.click('[data-test=bankaccount-submit]');
			await expectPage.exists(page, '[data-test=user-onboarding-next]');
			await page.click('[data-test=user-onboarding-next]');
			await expectPage.exists(page, '[data-test=sidenav-user-settings]');
			await page.click('[data-test=sidenav-user-settings]');
			await expectPage.exists(page, '[data-test=user-settings-email-input]');
			await page.type('[data-test=user-settings-email-input]', 'prover@versionless.test');
			await page.type('[data-test=user-settings-phoneNumber-input]', '6155551234');
			await page.click('[data-test=user-settings-submit]');

			// Money movement — the substantive stateful step. Search a peer, pick the
			// first result (its handle is captured and normalized, never recorded),
			// and send a payment the backend mints an id for (POST /transactions).
			await expectPage.exists(page, '[data-test=nav-top-new-transaction]');
			await page.click('[data-test=nav-top-new-transaction]');
			await expectPage.exists(page, '[data-test=user-list-search-input]');
			await page.type('[data-test=user-list-search-input]', 'a');
			await expectPage.exists(page, '[data-test^=user-list-item-]');
			await page.click('[data-test^=user-list-item-]');
			await expectPage.exists(page, '[data-test=transaction-create-amount-input] input');
			await page.type('[data-test=transaction-create-amount-input] input', '15');
			await page.type(
				'[data-test=transaction-create-description-input] input',
				'versionless-proof-payment',
			);
			await page.click('[data-test=transaction-create-submit-payment]');

			// The minted transaction round-trips lowdb into the actor's personal feed,
			// and the balance settles — the substantive stateful assertion.
			await expectPage.exists(page, '[data-test=sidenav-home]');
			await page.click('[data-test=sidenav-home]');
			await page.click('[data-test=nav-personal-tab]');
			await expectPage.exists(page, '[data-test=transaction-list]');
			await expectPage.bodyText(page, { contains: 'versionless-proof-payment' });
			await expectPage.visible(page, '[data-test=sidenav-user-balance]');

			// Feed / filter — the three feeds the app ships. Contacts is empty for a
			// fresh actor, so its settled shape is the app's own empty-list marker.
			await page.click('[data-test=nav-public-tab]');
			await expectPage.exists(page, '[data-test=transaction-list]');
			await page.click('[data-test=nav-contacts-tab]');
			await expectPage.exists(
				page,
				'[data-test=transaction-list], [data-test=empty-list-header]',
			);
			await page.click('[data-test=nav-personal-tab]');
			await expectPage.exists(page, '[data-test=transaction-list]');

			// Notifications — read the app's own notification feed (GET /notifications).
			await page.click('[data-test=sidenav-notifications]');
			await expectPage.exists(
				page,
				'[data-test=notifications-list], [data-test=empty-list-header]',
			);

			await expectPage.outcome(page, {
				events: {
					click: { atLeast: 10 },
					input: { atLeast: 8 },
					keydown: { atLeast: 8 },
				},
			});

			// The loopback-backend inventory, built generically from the run's own
			// request ledger against the two bounded loopback origins.
			const loopbackBackend =
				lifecycle.requestOutcomes === undefined ||
				lifecycle.backendOrigin === undefined ||
				lifecycle.staticOrigin === undefined
					? undefined
					: buildLoopbackBackendInventory(
							lifecycle.requestOutcomes(),
							lifecycle.staticOrigin,
							lifecycle.backendOrigin,
							WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY,
						);

			return {
				assertions: [
					'sign up and sign in as a fresh non-seed actor',
					'onboarding first bank account and settings write',
					'money movement to a placeholdered peer',
					'minted transaction appears in the actor personal feed',
					'public / contacts / personal feeds',
					'notifications feed',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
				...(loopbackBackend === undefined
					? {}
					: {
							applicationJourney: {
								state: 'live-loopback-backend-journey',
								source: REACT_CYPRESS_RWA_SOURCE.revision,
								loopbackBackend,
							},
						}),
			};
		},
	};
}
