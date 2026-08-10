import { afterEach, describe, expect, test } from 'vitest';
import type { ActualBudgetReceipt } from '../../core/src/receipts/react-actual-budget-v22-12-9.ts';
import {
	assertActualBudgetJourneyParity,
	assertActualBudgetLocality,
	assertActualBudgetTargetHasNoServiceWorker,
	parseActualBudgetRunLauncher,
} from '../src/fixture/react-actual-budget-v22-12-9-run.ts';
import { createActualBudgetViteConfig } from '../src/fixture/react-actual-budget-v22-12-9-vite.config.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalOffline = process.env.NPM_CONFIG_OFFLINE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;

afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalOffline === undefined) delete process.env.NPM_CONFIG_OFFLINE;
	else process.env.NPM_CONFIG_OFFLINE = originalOffline;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

function journey(
	lane: 'baseline' | 'target',
	pass: 1 | 2,
): ActualBudgetReceipt['journeys'][number] {
	return {
		lane,
		pass,
		result: 'pass',
		journey1: {
			budget: 'Versionless Synthetic Budget',
			account: 'Synthetic Checking',
			category: 'Synthetic Groceries',
			payee: 'Synthetic Market',
			initialBalanceCents: 100_000,
			firstExpenseCents: 1_234,
			firstBalanceCents: 98_766,
			editedExpenseCents: 2_345,
			editedBalanceCents: 97_655,
			undo: true,
			redo: true,
			persistedAfterReload: true,
		},
		journey2: {
			category: 'Synthetic Groceries',
			allocatedCents: 20_000,
			transferredCents: 5_000,
			budgetedCents: 25_000,
			expenseCents: 7_500,
			remainingCents: 17_500,
			search: true,
			navigation: true,
			persistedAfterReload: true,
			drag: 'unavailable',
		},
		locality: {
			allAttemptedUrlsLoopback: true,
			requestFailures: 0,
			externalOriginAttempts: 0,
			cookies: 0,
			authorizationHeaders: 0,
			pageErrors: 0,
			consoleErrors: 0,
			serviceWorkerRegistrations: 0,
			serviceWorkerControllers: 0,
			serviceWorkerCaches: 0,
		},
		witness: {
			package: '@async/witness',
			version: '0.7.0',
			link: 'link:../witness',
			gitCommit: 'synthetic',
			workingTree: 'clean',
			index: 'clean',
			executableSha256: 'a'.repeat(64),
			chromiumSha256: 'b'.repeat(64),
		},
	};
}

describe('Actual Budget v22.12.9 browser production runner', () => {
	test('requires strict offline execution for run and independent verify', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.NPM_CONFIG_OFFLINE = 'true';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(parseActualBudgetRunLauncher(['--run'])).toBe('run');
		expect(parseActualBudgetRunLauncher(['--verify'])).toBe('verify');
		process.env.VERSIONLESS_CONSENT_ID = 'unexpected';
		expect(() => parseActualBudgetRunLauncher(['--run'])).toThrow('strict offline');
	});

	test('requires loopback 2xx page, worker, WASM and asset traffic', () => {
		const result = assertActualBudgetLocality([
			{
				kind: 'navigation',
				url: 'http://127.0.0.1:4101/index.html',
				status: 200,
				failed: false,
				hasCookie: false,
				hasAuthorization: false,
			},
			{
				kind: 'page',
				url: 'http://127.0.0.1:4101/assets/app.js',
				status: 200,
				failed: false,
				hasCookie: false,
				hasAuthorization: false,
			},
			{
				kind: 'worker',
				url: 'http://127.0.0.1:4101/assets/worker.js',
				status: 200,
				failed: false,
				hasCookie: false,
				hasAuthorization: false,
			},
			{
				kind: 'fetch',
				url: 'http://127.0.0.1:4101/assets/sql-wasm.wasm',
				status: 200,
				failed: false,
				hasCookie: false,
				hasAuthorization: false,
			},
			{
				kind: 'page',
				url: 'http://127.0.0.1:4101/assets/app.css',
				status: 200,
				failed: false,
				hasCookie: false,
				hasAuthorization: false,
			},
		]);
		expect(result.requests).toBe(5);
		expect(result.essentialPaths).toContain('/assets/sql-wasm.wasm');
	});

	test('rejects external attempts, route aborts, cookies and authorization', () => {
		const base = {
			kind: 'fetch' as const,
			url: 'https://sync.actualbudget.org/data',
			status: null,
			failed: true,
			hasCookie: false,
			hasAuthorization: false,
		};
		expect(() => assertActualBudgetLocality(Array.from({ length: 5 }, () => base))).toThrow(
			'locality boundary differs',
		);
	});

	test('requires exact finance totals in all direct-Witness passes', () => {
		const journeys = [
			journey('baseline', 1),
			journey('baseline', 2),
			journey('target', 1),
			journey('target', 2),
		];
		expect(() => assertActualBudgetJourneyParity(journeys)).not.toThrow();
		const changed = structuredClone(journeys) as Array<{
			journey2: { remainingCents: number };
		}>;
		changed[3]!.journey2.remainingCents = 17_499;
		expect(() =>
			assertActualBudgetJourneyParity(changed as unknown as ActualBudgetReceipt['journeys']),
		).toThrow('finance journey parity differs');
	});

	test('configures Vite 8 page/worker output without any service-worker output', () => {
		const config = createActualBudgetViteConfig({
			sourceRoot: '/synthetic/source',
			webRoot: '/synthetic/source/packages/desktop-client',
			outDir: '/synthetic/output',
		});
		expect(config.worker).toEqual({ format: 'es' });
		expect(config.build).toMatchObject({ target: 'es2022', assetsInlineLimit: 0 });
		expect(() =>
			assertActualBudgetTargetHasNoServiceWorker([
				'index.html',
				'assets/app.js',
				'assets/worker.js',
			]),
		).not.toThrow();
		expect(() =>
			assertActualBudgetTargetHasNoServiceWorker(['assets/workbox-runtime.js']),
		).toThrow('service-worker artifact');
	});
});
