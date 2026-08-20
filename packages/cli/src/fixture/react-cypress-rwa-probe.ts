/**
 * Direct-Playwright diagnostic for the cypress-realworld-app live-backend journey.
 *
 * Unlike the witness-host calibration driver, this drives a raw Playwright page so
 * it can read the live DOM (`page.evaluate`), the current URL and the real network
 * ledger at each leg. It publishes nothing and asserts nothing; its only output is
 * a JSON dump on stdout used to calibrate the journey/schema pins to measured
 * reality. It boots the application's own Express-over-lowdb backend in its era
 * runtime cell, reseeded from the frozen snapshot, exactly as the serving path does.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { copyFile } from 'node:fs/promises';
import { get } from 'node:http';
import { basename, join, resolve } from 'pathe';
import { chromium } from 'playwright';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';
import { WITNESS_REACT_CYPRESS_RWA_ACTOR } from '../../../core/src/receipts/witness-react-cypress-rwa.ts';
import { startStaticServer } from '../witness/real-app-run.ts';

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

const laneStaticRoot: Record<string, string> = {
	baseline: join(workRoot, 'baseline/build-run1'),
	migrated: join(workRoot, 'target/build-vite'),
};
const backendLaneRoot = join(workRoot, 'baseline');
const BACKEND_PORT = 3001;

async function probeHealth(url: string): Promise<number | null> {
	return await new Promise<number | null>((settle) => {
		const request = get(url, (response) => {
			settle(response.statusCode ?? null);
			response.resume();
		});
		request.setTimeout(500, () => request.destroy());
		request.on('error', () => settle(null));
	});
}

const delay = (ms: number): Promise<void> =>
	new Promise<void>((settle) => void setTimeout(settle, ms));

async function bootBackend(frontendPort: number): Promise<{ close(): Promise<void> }> {
	await copyFile(
		join(backendLaneRoot, 'data/database-seed.json'),
		join(backendLaneRoot, 'data/database.json'),
	);
	const child: ChildProcess = spawn('yarn', ['start:api'], {
		cwd: backendLaneRoot,
		env: {
			...process.env,
			PATH: `${eraNodeBin}:${eraYarnBin}:${process.env.PATH ?? ''}`,
			PORT: String(BACKEND_PORT),
			// The CORS allow-origin the backend builds is `http://localhost:${REACT_APP_PORT}`,
			// so it must equal the static origin the browser is actually served from.
			REACT_APP_PORT: String(frontendPort),
			SKIP_YARN_COREPACK_CHECK: '1',
		},
		stdio: 'ignore',
	});
	const deadline = Date.now() + 45_000;
	while (Date.now() < deadline) {
		if ((await probeHealth(`http://127.0.0.1:${BACKEND_PORT}/checkAuth`)) === 401) break;
		await delay(250);
	}
	return {
		close: async () =>
			await new Promise<void>((settle) => {
				child.once('exit', () => settle());
				child.kill('SIGTERM');
				setTimeout(() => {
					if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
				}, 2_000);
			}),
	};
}

export async function probeCypressRwaLane(lane: string): Promise<void> {
	const actor = WITNESS_REACT_CYPRESS_RWA_ACTOR;
	const staticRoot = laneStaticRoot[lane]!;
	const staticServer = await startStaticServer(staticRoot, { profile: 'current-witness' });
	// The static server binds 127.0.0.1; addressing it through `localhost` yields a
	// `http://localhost:<port>` document origin that the backend CORS allow-list can match.
	const staticPort = Number(new URL(staticServer.origin).port);
	const appOrigin = `http://localhost:${staticPort}`;
	const backend = await bootBackend(staticPort);
	const browser = await chromium.launch({ executablePath: chromiumExecutable, headless: true });
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	const page = await context.newPage();
	const network: Array<{ method: string; url: string; status: number | null }> = [];
	const backendOrigin = `http://localhost:${BACKEND_PORT}`;
	const normalize = (raw: string): string => {
		if (raw.startsWith(backendOrigin)) return `{backend}${raw.slice(backendOrigin.length)}`;
		return raw;
	};
	page.on('response', (response) => {
		const url = response.url();
		if (url.startsWith(appOrigin)) return;
		network.push({
			method: response.request().method(),
			url: normalize(url),
			status: response.status(),
		});
	});
	page.on('requestfailed', (request) => {
		const url = request.url();
		if (url.startsWith(appOrigin)) return;
		network.push({
			method: request.method(),
			url: normalize(url),
			status: null,
		});
	});
	const consoleErrors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
	});
	page.on('pageerror', (error) => consoleErrors.push(`PAGEERROR ${error.message.slice(0, 200)}`));

	const dataTests = async (): Promise<string[]> =>
		await page.evaluate(() =>
			[...document.querySelectorAll('[data-test]')]
				.map((element) => (element as HTMLElement).dataset.test ?? '')
				.filter((value, index, all) => all.indexOf(value) === index)
				.sort(),
		);

	const legs: Array<Record<string, unknown>> = [];
	let netCursor = 0;
	const snapshot = async (label: string): Promise<void> => {
		legs.push({ label, url: new URL(page.url()).pathname, dataTests: await dataTests() });
	};

	const clickIfPresent = async (selector: string, label: string): Promise<void> => {
		try {
			await page.locator(selector).first().click({ timeout: 4_000 });
			legs.push({ action: label, selector, outcome: 'clicked' });
		} catch (error: unknown) {
			legs.push({
				action: label,
				selector,
				outcome: `FAIL: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`,
			});
		}
		await delay(1_000);
	};
	const typeIfPresent = async (selector: string, value: string, label: string): Promise<void> => {
		try {
			await page.locator(selector).first().fill(value, { timeout: 4_000 });
			legs.push({ action: label, selector, outcome: 'filled' });
		} catch (error: unknown) {
			legs.push({
				action: label,
				selector,
				outcome: `FAIL: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`,
			});
		}
	};

	const waitFor = async (selector: string, label: string, ms = 10_000): Promise<boolean> => {
		try {
			await page.locator(selector).first().waitFor({ state: 'visible', timeout: ms });
			legs.push({ waitFor: selector, label, outcome: 'visible' });
			return true;
		} catch {
			legs.push({
				waitFor: selector,
				label,
				outcome: 'ABSENT',
				url: new URL(page.url()).pathname,
			});
			return false;
		}
	};

	try {
		await page.goto(`${appOrigin}/`, { waitUntil: 'domcontentloaded' });
		await waitFor('[data-test=signin-username]', 'boot-signin');
		await snapshot('initial');
		// Signup — click the link; if it does not SPA-navigate, hard-load /signup.
		await clickIfPresent('[data-test=signup]', 'click-signup');
		if (!(await waitFor('[data-test=signup-first-name]', 'signup-after-link-click', 6_000))) {
			await page.goto(`${appOrigin}/signup`, { waitUntil: 'domcontentloaded' });
			await waitFor('[data-test=signup-first-name]', 'signup-after-hard-goto');
		}
		await typeIfPresent('[data-test=signup-first-name] input', actor.firstName, 'fill-first');
		await typeIfPresent('[data-test=signup-last-name] input', actor.lastName, 'fill-last');
		await typeIfPresent('[data-test=signup-username] input', actor.username, 'fill-username');
		await typeIfPresent('[data-test=signup-password] input', actor.password, 'fill-password');
		await typeIfPresent(
			'[data-test=signup-confirmPassword] input',
			actor.password,
			'fill-confirm',
		);
		await clickIfPresent('[data-test=signup-submit]', 'click-signup-submit');
		await waitFor('[data-test=signin-username]', 'back-to-signin-after-signup');
		await snapshot('after-signup');
		// Signin
		await typeIfPresent(
			'[data-test=signin-username] input',
			actor.username,
			'fill-signin-username',
		);
		await typeIfPresent(
			'[data-test=signin-password] input',
			actor.password,
			'fill-signin-password',
		);
		await clickIfPresent('[data-test=signin-submit]', 'click-signin-submit');
		await delay(2_500);
		await snapshot('after-signin');
		// Onboarding
		if (await waitFor('[data-test=user-onboarding-next]', 'onboarding-dialog', 8_000)) {
			await clickIfPresent('[data-test=user-onboarding-next]', 'onboarding-next-1');
			await typeIfPresent(
				'[data-test=bankaccount-bankName-input] input',
				'Versionless Bank',
				'bank-name',
			);
			await typeIfPresent(
				'[data-test=bankaccount-routingNumber-input] input',
				'987654321',
				'routing',
			);
			await typeIfPresent(
				'[data-test=bankaccount-accountNumber-input] input',
				'123456789',
				'account',
			);
			await clickIfPresent('[data-test=bankaccount-submit]', 'bank-submit');
			await delay(1_500);
			await snapshot('after-bank');
			await clickIfPresent('[data-test=user-onboarding-next]', 'onboarding-next-2');
			await delay(1_000);
		}
		await snapshot('home');
		const flushNet = (label: string): void => {
			legs.push({ netSince: label, entries: network.slice(netCursor) });
			netCursor = network.length;
		};
		flushNet('after-onboarding');
		// Settings — fill first name and SUBMIT, measure the write endpoint.
		await clickIfPresent('[data-test=sidenav-user-settings]', 'nav-settings');
		await waitFor('[data-test=user-settings-firstName-input]', 'settings-form', 8_000);
		await snapshot('settings');
		await typeIfPresent(
			'[data-test=user-settings-firstName-input]',
			'VersionlessEdited',
			'settings-first',
		);
		await typeIfPresent(
			'[data-test=user-settings-lastName-input]',
			'ProverEdited',
			'settings-last',
		);
		await typeIfPresent(
			'[data-test=user-settings-email-input]',
			'prover@versionless.test',
			'settings-email',
		);
		await typeIfPresent(
			'[data-test=user-settings-phoneNumber-input]',
			'6155551234',
			'settings-phone',
		);
		await clickIfPresent('[data-test=user-settings-submit]', 'settings-submit');
		await delay(1_500);
		flushNet('settings-submit');
		// Money movement
		await clickIfPresent('[data-test=nav-top-new-transaction]', 'new-transaction');
		await waitFor('[data-test=user-list-search-input]', 'transaction-search', 8_000);
		const searchDom = await page
			.locator('[data-test=user-list-search-input]')
			.first()
			.evaluate((element) => element.outerHTML.slice(0, 400))
			.catch(() => 'ABSENT');
		legs.push({ debug: 'user-list-search-input outerHTML', html: searchDom });
		await delay(1_500);
		await waitFor('[data-test^=user-list-item-]', 'peer-results', 6_000);
		await snapshot('peer-search');
		flushNet('peer-search');
		await clickIfPresent('[data-test^=user-list-item-]', 'pick-peer');
		await waitFor('[data-test=transaction-create-amount-input]', 'amount-form', 8_000);
		await snapshot('amount-form');
		await typeIfPresent('[data-test=transaction-create-amount-input] input', '15', 'amount');
		await typeIfPresent(
			'[data-test=transaction-create-description-input] input',
			'versionless-proof-payment',
			'description',
		);
		await clickIfPresent('[data-test=transaction-create-submit-payment]', 'submit-payment');
		await delay(2_500);
		legs.push({ label: 'after-payment', url: new URL(page.url()).pathname });
		flushNet('payment-submit');
		await snapshot('after-payment');
		// Feed / filter — home then each tab, measuring the feed endpoints.
		await clickIfPresent('[data-test=sidenav-home]', 'nav-home');
		await delay(1_200);
		await clickIfPresent('[data-test=nav-public-tab]', 'public-tab');
		await delay(1_200);
		await clickIfPresent('[data-test=nav-contacts-tab]', 'contacts-tab');
		await delay(1_200);
		await clickIfPresent('[data-test=nav-personal-tab]', 'personal-tab');
		await delay(1_200);
		flushNet('feed-tabs');
		await snapshot('feed');
		// Notifications
		await clickIfPresent('[data-test=sidenav-notifications]', 'nav-notifications');
		await delay(1_500);
		flushNet('notifications');
		await snapshot('notifications');
	} finally {
		process.stdout.write(
			`${canonicalize({ lane, staticOrigin: staticServer.origin, legs, consoleErrors, network })}\n`,
		);
		await context.close();
		await browser.close();
		await staticServer.close();
		await backend.close();
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	await probeCypressRwaLane(args[0] ?? 'baseline');
}

if (basename(process.argv[1] ?? '') === 'react-cypress-rwa-probe.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
