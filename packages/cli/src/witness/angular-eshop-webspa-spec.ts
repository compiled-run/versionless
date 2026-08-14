import {
	WITNESS_ANGULAR_ESHOP_WEBSPA_APP,
	WITNESS_ANGULAR_ESHOP_WEBSPA_SELECTORS,
	WITNESS_ANGULAR_ESHOP_WEBSPA_STAGES,
	WITNESS_ANGULAR_ESHOP_WEBSPA_SURFACE_LIMITS,
	WITNESS_ANGULAR_ESHOP_WEBSPA_VIEWPORT,
} from '../../../core/src/receipts/witness-angular-eshop-webspa.ts';
import {
	createEshopWebspaProjection,
	type EshopWebspaProjectionLedgerRecord,
} from './angular-eshop-webspa-projection.ts';
import type { AppSpec } from './real-app-run.ts';

/**
 * The eShop WebSPA holdout Witness specification.
 *
 * The journey is the anonymous catalog surface and nothing else, because that is
 * the whole surface the application genuinely offers a visitor who has not
 * signed in. Every gesture is issued against the application's own class names,
 * and every anchor is a settled reaction — a rendered item count, the pager's
 * own interpolated line, the option the keyboard selected — never a wait.
 *
 * The API surface behind it is the declared same-origin projection, and it is
 * the SAME projection factory for both lanes, so the two normalized behavior
 * digests are comparable.
 */
const S = WITNESS_ANGULAR_ESHOP_WEBSPA_SELECTORS;
const STAGE = WITNESS_ANGULAR_ESHOP_WEBSPA_STAGES;

let latestLedger: EshopWebspaProjectionLedgerRecord[] = [];

/** The ordered ledger the most recent run's projection wrote. */
export function angularEshopWebspaProjectionLedger(): EshopWebspaProjectionLedgerRecord[] {
	return latestLedger.map((entry) => ({ ...entry }));
}

export function angularEshopWebspaWitnessSpec(): AppSpec {
	return {
		app: WITNESS_ANGULAR_ESHOP_WEBSPA_APP,
		framework: 'angular',
		// This unit publishes no canonical Witness receipt; the holdout ledger
		// receipt that binds these lanes is the next unit's. The binding recorded
		// here is the holdout receipt the lanes were produced under.
		canonicalReceipt: 'evidence/runs/holdout-angular-eshop-webspa/receipt.json',
		canonicalDigest: 'a1c43326cb9b0f756e269d0e8339abe64df85a4ce9b709d7c612d37f8e7f0712',
		sources: {
			baseline: '.versionless/stage/witness-angular-eshop-webspa/lanes/baseline',
			migrated: '.versionless/stage/witness-angular-eshop-webspa/lanes/migrated',
		},
		viewport: WITNESS_ANGULAR_ESHOP_WEBSPA_VIEWPORT,
		loopback: () => {
			const projection = createEshopWebspaProjection();
			latestLedger = [];
			return {
				api: async (request) => {
					const answered = await projection.api(request);
					latestLedger = projection.ledger();
					return answered;
				},
			};
		},
		journey: async (context, page, _transportEvidence, lifecycle) => {
			const expectPage = context.expect.page;
			await page.trackEvents('click', 'change', 'keydown');

			// (a) The catalog the application renders once its own configuration
			// call has settled and its three catalog calls have answered. Nothing
			// here is waited for: the item count IS the settled reaction.
			await expectPage.count(page, S.catalogItem, STAGE.catalogPageSize);
			await expectPage.bodyText(page, { contains: STAGE.firstPageText });
			await expectPage.bodyText(page, { contains: STAGE.firstItemName });
			await expectPage.text(page, S.identityName, STAGE.anonymousIdentity);
			// The anonymous visitor gets no basket control at all, which is the
			// application's own gate rather than something the harness suppressed.
			await expectPage.count(page, S.basketStatus, 0);
			await expectPage.count(page, S.catalogThumbnail, STAGE.catalogPageSize);

			// (b) A genuine wheel scroll on a document that really does overflow
			// the measured viewport.
			const before = await lifecycle.viewportScroll();
			if (before.scrollHeight <= before.clientHeight)
				throw new Error(
					`eShop catalog does not overflow the viewport the journey scrolls: ${JSON.stringify(before)}`,
				);
			await page.scroll(null, { y: 400 });
			const after = await lifecycle.viewportScroll();
			if (after.scrollY <= 0) throw new Error('eShop catalog did not scroll');

			// (c) Server-paged navigation through the application's own pager. The
			// anchor is the pager's own interpolated line, which only changes once
			// the next page has come back and rendered.
			await page.click(S.pagerNext);
			await expectPage.bodyText(page, { contains: STAGE.secondPageText });
			await expectPage.bodyText(page, { contains: STAGE.secondPageFirstItemName });
			await expectPage.count(page, S.catalogItem, STAGE.catalogPageSize);
			await page.click(S.pagerPrevious);
			await expectPage.bodyText(page, { contains: STAGE.firstPageText });

			// (d) The type filter. The select is driven by the browser's own
			// type-ahead — a real key press that moves the selection and fires the
			// application's `change` handler. Arrow keys were measured NOT to move
			// a closed select under this browser, so the gesture is the one that
			// genuinely works rather than the one that looks conventional.
			await page.press(S.typeSelect, STAGE.typeFilterKey);
			await page.click(S.applyFilter);
			await expectPage.count(page, S.catalogItem, STAGE.typeFilteredItems);
			await expectPage.bodyText(page, { contains: STAGE.typeFilteredText });

			// (e) The brand filter applied on top of it — the application narrows
			// by both facets at once, and one item survives.
			await page.press(S.brandSelect, STAGE.brandFilterKey);
			await page.click(S.applyFilter);
			await expectPage.count(page, S.catalogItem, STAGE.brandFilteredItems);
			await expectPage.bodyText(page, { contains: STAGE.brandFilteredText });
			await expectPage.text(page, S.catalogName, STAGE.brandFilteredItemName);

			await expectPage.outcome(page, {
				events: { click: { atLeast: 4 }, change: { atLeast: 2 }, keydown: { atLeast: 2 } },
			});

			return {
				assertions: [
					'catalog renders the configured first page',
					'anonymous identity offers only Login and no basket',
					'genuine viewport scroll on an overflowing catalog',
					'server-paged navigation forward and back',
					'type filter narrows by keyboard selection',
					'brand filter narrows on top of the type filter',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
				scrollSurface: {
					state: 'measured-genuine-viewport-scroll',
					route: '/',
					viewport: WITNESS_ANGULAR_ESHOP_WEBSPA_VIEWPORT,
					scrollHeight: before.scrollHeight,
					clientHeight: before.clientHeight,
					wheelDeltaY: 400,
					scrolledFromTop: true,
					scrolled: true,
				},
				applicationJourney: {
					state: 'anonymous-catalog-journey',
					catalog: {
						state: 'measured-rendered-catalog',
						items: STAGE.catalogPageSize,
						total: STAGE.catalogTotal,
						pagerLine: STAGE.firstPageText,
						firstItemName: STAGE.firstItemName,
					},
					pager: {
						state: 'measured-server-paged-navigation',
						forwardLine: STAGE.secondPageText,
						backLine: STAGE.firstPageText,
						requests: 2,
					},
					filters: {
						state: 'measured-keyboard-selected-filters',
						typeValue: STAGE.typeFilterValue,
						typeItems: STAGE.typeFilteredItems,
						typeLine: STAGE.typeFilteredText,
						brandValue: STAGE.brandFilterValue,
						brandItems: STAGE.brandFilteredItems,
						brandLine: STAGE.brandFilteredText,
						narrowedItemName: STAGE.brandFilteredItemName,
					},
					scroll: {
						state: 'measured-genuine-viewport-scroll',
						scrollHeight: before.scrollHeight,
						clientHeight: before.clientHeight,
						scrolled: true,
					},
					surfaceLimits: WITNESS_ANGULAR_ESHOP_WEBSPA_SURFACE_LIMITS,
				},
			};
		},
	};
}
