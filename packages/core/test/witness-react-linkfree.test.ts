import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	parseWitnessReactLinkfreeReceipt,
	REACT_LINKFREE_CANONICAL_DIGEST,
	REACT_LINKFREE_RECEIPT_PATH,
	renderWitnessReactLinkfreeReceipt,
	verifyWitnessReactLinkfreeEvidence,
	WITNESS_REACT_LINKFREE_CONSOLE_ERRORS,
	WITNESS_REACT_LINKFREE_CORPUS_RULING,
	WITNESS_REACT_LINKFREE_FAILED_REQUESTS,
	WITNESS_REACT_LINKFREE_MOCKED_SEAMS,
	WITNESS_REACT_LINKFREE_RECEIPT_PATH,
	WITNESS_REACT_LINKFREE_REDACTED_ROUTE,
	WITNESS_REACT_LINKFREE_ROUTES,
	WITNESS_REACT_LINKFREE_STYLE_PROBES,
	witnessReactLinkfreeAggregateMember,
	witnessReactLinkfreeBehaviorDigest,
	witnessReactLinkfreeDigest,
	witnessReactLinkfreeRawDigest,
	type WitnessReactLinkfreeReceipt,
} from '../src/receipts/witness-react-linkfree.ts';
import { WITNESS_REAL_APP_NAMES } from '../src/receipts/witness-real-app.ts';

const root = path.resolve(import.meta.dirname, '../../..');

async function published(): Promise<WitnessReactLinkfreeReceipt> {
	return parseWitnessReactLinkfreeReceipt(
		JSON.parse(
			await readFile(path.join(root, WITNESS_REACT_LINKFREE_RECEIPT_PATH), 'utf8'),
		) as unknown,
	);
}

function resealed(receipt: WitnessReactLinkfreeReceipt): WitnessReactLinkfreeReceipt {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = witnessReactLinkfreeDigest(copy);
	return copy;
}

/**
 * Reseals a tampered receipt as thoroughly as a forger could: every per-run
 * digest is recomputed over the edited content before the receipt digest is
 * sealed, so no test below can be passed by a hash that happened to stop the
 * edit first. Each one has to be caught by the evidence check it targets.
 */
function resealedDeep(receipt: WitnessReactLinkfreeReceipt): WitnessReactLinkfreeReceipt {
	const copy = structuredClone(receipt);
	for (const run of copy.runs) {
		run.semanticDigest = witnessReactLinkfreeRawDigest(run);
		run.behaviorDigest = witnessReactLinkfreeBehaviorDigest(run);
	}
	copy.integrity.canonicalDigest = witnessReactLinkfreeDigest(copy);
	return copy;
}

describe('LinkFree direct Witness receipt', () => {
	it('verifies the published browser proof and its rendered companion', async () => {
		const verified = await verifyWitnessReactLinkfreeEvidence(root);
		expect(verified.valid).toBe(true);
		expect(verified.receipt.result).toBe('pass');
		expect(verified.receipt.runs).toHaveLength(4);
		expect(verified.receipt.canonicalReceipt.path).toBe(REACT_LINKFREE_RECEIPT_PATH);
		expect(verified.receipt.canonicalReceipt.canonicalDigest).toBe(
			REACT_LINKFREE_CANONICAL_DIGEST,
		);
		expect(
			await readFile(
				path.join(root, path.dirname(WITNESS_REACT_LINKFREE_RECEIPT_PATH), 'receipt.md'),
				'utf8',
			),
		).toBe(renderWitnessReactLinkfreeReceipt(verified.receipt));
		expect(witnessReactLinkfreeAggregateMember(verified.digest).receipt).toBe(
			WITNESS_REACT_LINKFREE_RECEIPT_PATH,
		);
	});

	it('names the application in the closed real-app list', () => {
		expect(WITNESS_REAL_APP_NAMES).toContain('react-linkfree');
	});

	it('proves one behavior across both lanes and both passes', async () => {
		const receipt = await published();
		const digests = new Set(receipt.runs.map((run) => run.behaviorDigest));
		expect(digests.size).toBe(1);
		expect([...digests]).toEqual([receipt.mutation.restoredBehaviorDigest]);
		expect(receipt.runs.map((run) => `${run.lane}:${String(run.pass)}`).sort()).toEqual([
			'baseline:1',
			'baseline:2',
			'migrated:1',
			'migrated:2',
		]);
	});

	it('renders no real profile data anywhere in the published evidence', async () => {
		const receipt = await published();
		// Positive enforcement over the WHOLE published document, not a blocklist:
		// every string in it that has the shape of a profile route must be one the
		// synthetic corpus declares, so a real contributor's username cannot reach
		// the evidence by being one nobody thought to exclude.
		const routeShaped = /^\/[\da-z-]+$/;
		const walk = (value: unknown): string[] => {
			if (typeof value === 'string') return routeShaped.test(value) ? [value] : [];
			if (Array.isArray(value)) return value.flatMap((item) => walk(item));
			if (value !== null && typeof value === 'object')
				return Object.values(value).flatMap((item) => walk(item));
			return [];
		};
		const routes = new Set(walk(receipt));
		expect(routes.size).toBeGreaterThan(0);
		for (const route of routes)
			expect(route === '/search' || route.startsWith('/synthetic-')).toBe(true);
		for (const run of receipt.runs) {
			expect(run.routes).toEqual([...WITNESS_REACT_LINKFREE_ROUTES]);
			for (const route of run.routes)
				expect(
					route === '/' ||
						route === '/search' ||
						route === WITNESS_REACT_LINKFREE_REDACTED_ROUTE ||
						route.startsWith('/synthetic-'),
				).toBe(true);
			expect(run.applicationJourney.corpus.realProfileDataRendered).toBe(false);
			expect(run.applicationJourney.profile.username).toMatch(/^synthetic-/);
		}
		expect(receipt.corpusRuling).toEqual(WITNESS_REACT_LINKFREE_CORPUS_RULING);
		expect(receipt.nonclaims.join('\n')).toContain('The dataset is SYNTHETIC.');
	});

	it('refuses a receipt whose route recorded a profile the synthetic corpus never declared', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		for (const run of tampered.runs)
			run.routes = run.routes.map((route) =>
				route === WITNESS_REACT_LINKFREE_REDACTED_ROUTE ? '/a-real-contributor' : route,
			);
		expect(() => parseWitnessReactLinkfreeReceipt(resealedDeep(tampered))).toThrow(
			'React LinkFree',
		);
	});

	it('drives the whole route sequence rather than a page load', async () => {
		const receipt = await published();
		expect(receipt.router.library).toBe('react-router-dom-5');
		expect(receipt.router.dynamicSegment).toBe('/:username');
		expect(receipt.router.navigations).toBe(WITNESS_REACT_LINKFREE_ROUTES.length);
		for (const run of receipt.runs) {
			const kinds = run.interactions.map((interaction) => interaction.kind);
			expect(kinds).toContain('type');
			expect(kinds).toContain('hover');
			expect(kinds).toContain('scroll');
			expect(kinds).toContain('press');
			expect(kinds.filter((kind) => kind === 'click').length).toBeGreaterThanOrEqual(5);
		}
	});

	it('records the search narrowing and the full clear as measurements', async () => {
		const receipt = await published();
		for (const run of receipt.runs) {
			const search = run.applicationJourney.search;
			expect(search.beforeFilter).toBe(run.applicationJourney.corpus.profiles);
			expect(search.afterClear).toBe(search.beforeFilter);
			expect(search.narrowed).toBeLessThan(search.beforeFilter);
			expect(search.wideningGesture).toBe('select-all-then-backspace');
		}
	});

	it('answers both avatar hosts in context and contacts neither', async () => {
		const receipt = await published();
		expect(receipt.mockedSeams).toEqual(WITNESS_REACT_LINKFREE_MOCKED_SEAMS);
		for (const run of receipt.runs) {
			expect(run.mockedNonLoopbackSeams.outsideInventory).toEqual([]);
			expect(run.mockedNonLoopbackSeams.absent).toEqual([]);
			expect(run.mockedNonLoopbackSeams.successfulNonLoopback).toBe(0);
			expect(run.successfulNonLoopback).toBe(0);
			const cascade = run.applicationJourney.avatarCascade;
			expect(cascade.declaredAnswer).toBe(404);
			expect(cascade.cascadedAnswer).toBe(200);
			expect(cascade.renderedSource).toBe(cascade.cascadedEndpoint);
			expect(cascade.leftTheMachine).toBe(false);
		}
		for (const lane of ['baseline', 'migrated'] as const)
			for (const seam of receipt.mockedSeams[lane]) {
				expect(seam.path).not.toContain('?');
				expect(seam.path.startsWith('/')).toBe(false);
			}
	});

	it('accounts for every console error exactly instead of allowing them', async () => {
		const receipt = await published();
		expect(receipt.consoleErrors).toEqual(WITNESS_REACT_LINKFREE_CONSOLE_ERRORS);
		expect(receipt.failedRequests).toEqual(WITNESS_REACT_LINKFREE_FAILED_REQUESTS);
		for (const run of receipt.runs) {
			expect(run.consoleErrorInventory.outsideInventory).toEqual([]);
			expect(run.consoleErrorInventory.observed).toEqual(run.consoleErrorInventory.expected);
			expect(run.witnessRecord.consoleErrors).toBe(run.consoleErrorInventory.total);
			expect(run.witnessRecord.failedRequests).toBe(0);
			expect(run.witnessRecord.pageErrors).toBe(0);
		}
		const tampered = structuredClone(receipt);
		tampered.runs[0]!.consoleErrorInventory.observed = [];
		expect(() => parseWitnessReactLinkfreeReceipt(resealedDeep(tampered))).toThrow(
			'console-error inventory differs',
		);
	});

	it('measures resolved appearance across the purged and unpurged stylesheets', async () => {
		const receipt = await published();
		expect(receipt.renderedStyleParity.probes).toBe(WITNESS_REACT_LINKFREE_STYLE_PROBES.length);
		expect(receipt.renderedStyleParity.lanesAgree).toBe(true);
		const measurements = new Set(receipt.runs.map((run) => JSON.stringify(run.renderedStyles)));
		expect(measurements.size).toBe(1);
		for (const run of receipt.runs) {
			expect(run.renderedStyles.state).toBe('measured-resolved-styles');
			for (const probe of run.renderedStyles.probes) {
				expect(probe.width).toBeGreaterThan(0);
				expect(probe.height).toBeGreaterThan(0);
			}
		}
		const tampered = structuredClone(receipt);
		const probe = tampered.runs[0]!.renderedStyles.probes[0]!;
		probe.properties = { ...probe.properties, 'background-color': 'rgb(1, 2, 3)' };
		expect(() => parseWitnessReactLinkfreeReceipt(resealedDeep(tampered))).toThrow(
			'React LinkFree',
		);
	});

	it('claims scroll only where the document genuinely overflows and the gesture happened', async () => {
		const receipt = await published();
		expect(receipt.scrollSurface.state).toBe('measured-genuine-viewport-scroll');
		expect(receipt.scrollSurface.route).toMatch(/^\/synthetic-/);
		expect(receipt.scrollSurface.viewport).toEqual({ width: 1280, height: 720 });
		expect(receipt.scrollSurface.scrollHeight).toBeGreaterThan(
			receipt.scrollSurface.clientHeight,
		);
		const control = receipt.runs[0]!.applicationJourney.scrollToTop;
		expect(control.hiddenBeforeScroll).toBe(true);
		expect(control.scrolledTo).toBeGreaterThan(300);
		expect(control.restoredToTop).toBe(true);
		expect(receipt.nonclaims.join('\n')).toContain('Scroll is claimed only for');
	});

	it('binds the retained build receipt by digest and by exact bytes', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.canonicalReceipt.sha256 = `${'0'.repeat(64)}`;
		expect(() => parseWitnessReactLinkfreeReceipt(resealed(tampered))).toThrow(
			'Witness binding differs',
		);
	});

	it('refuses a receipt whose staging claims untouched bundler bytes it does not have', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.stagedCorpus.bundlerAuthoredPaths = 0;
		expect(() => parseWitnessReactLinkfreeReceipt(resealed(tampered))).toThrow(
			'Witness binding differs',
		);
	});

	it('refuses a receipt whose mutation did not restore byte identically', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.mutation.afterRestoreSha256 = tampered.mutation.mutatedSha256;
		expect(() => parseWitnessReactLinkfreeReceipt(resealed(tampered))).toThrow(
			'Witness integrity differs',
		);
	});

	it('is not counted before Judge audit', async () => {
		const receipt = await published();
		expect(receipt.readiness.reactLineage.counted).toBe(false);
		expect(receipt.readiness.reactLineage).toEqual({ ready: 1, total: 4, counted: false });
	});
});
