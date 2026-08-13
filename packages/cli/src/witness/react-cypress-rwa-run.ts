import {
	REACT_CYPRESS_RWA_SOURCE,
	WITNESS_REACT_CYPRESS_RWA_ACTOR,
	WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY,
	WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
} from '../../../core/src/receipts/witness-react-cypress-rwa.ts';
import { buildLoopbackBackendInventory } from './live-backend.ts';
import type { AppSpec } from './real-app-run.ts';

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
		initialRoute: '/',
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
			seed: { snapshot: 'data/database-seed.json', store: 'data/database.json' },
			prepare: [{ from: 'scripts/mock-aws-exports.js', to: 'src/aws-exports.js' }],
			health: { path: '/checkAuth', okStatus: [401] },
			readyTimeoutMs: 30_000,
		},
		placeholders: WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
		journey: async (context, page, _transportEvidence, lifecycle) => {
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');

			// Auth — sign a fresh non-seed actor up, then sign in as it. No seed
			// identity is touched here; the credentials are corpus values.
			await context.expect.page.exists(page, '[data-test=signin-username]');
			await page.click('[data-test=signup]');
			await page.type('[data-test=signup-first-name]', actor.firstName);
			await page.type('[data-test=signup-last-name]', actor.lastName);
			await page.type('[data-test=signup-username]', actor.username);
			await page.type('[data-test=signup-password]', actor.password);
			await page.type('[data-test=signup-confirmPassword]', actor.password);
			await page.click('[data-test=signup-submit]');
			await context.expect.page.exists(page, '[data-test=signin-username]');
			await page.type('[data-test=signin-username]', actor.username);
			await page.type('[data-test=signin-password]', actor.password);
			await page.click('[data-test=signin-submit]');

			// Onboarding — the app's own first-bank-account dialog, then the actor
			// edits its settings so a mutating write is proven before any transfer.
			await page.click('[data-test=user-onboarding-next]');
			await page.type('[data-test=bankaccount-bankName-input]', 'Versionless Bank');
			await page.type('[data-test=bankaccount-routingNumber-input]', '987654321');
			await page.type('[data-test=bankaccount-accountNumber-input]', '123456789');
			await page.click('[data-test=bankaccount-submit]');
			await page.click('[data-test=user-onboarding-next]');
			await page.click('[data-test=sidenav-user-settings]');
			await page.type('[data-test=user-settings-firstName-input]', actor.firstName);
			await page.click('[data-test=user-settings-submit]');

			// Money movement — the substantive stateful step. Search a peer, pick the
			// first result (its handle is captured and normalized, never recorded),
			// and send a payment the backend mints an id for.
			await page.click('[data-test=nav-top-new-transaction]');
			await page.type('[data-test=user-list-search-input]', 'a');
			await context.expect.page.exists(page, '[data-test^=user-list-item-]');
			await page.click('[data-test^=user-list-item-]');
			await page.type('[data-test=transaction-create-amount-input]', '15');
			await page.type(
				'[data-test=transaction-create-description-input]',
				'versionless-proof-payment',
			);
			await page.click('[data-test=transaction-create-submit-payment]');

			// Feed / filter — browse the three feeds the app ships and narrow one.
			await page.click('[data-test=sidenav-home]');
			await page.click('[data-test=nav-public-tab]');
			await page.click('[data-test=nav-contacts-tab]');
			await page.click('[data-test=nav-personal-tab]');
			await page.click('[data-test=transaction-list-filter-amount-range-button]');

			// Notifications — read the app's own notification feed.
			await page.click('[data-test=sidenav-notifications]');

			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 12 },
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
					'public / contacts / personal feeds with a filter',
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
