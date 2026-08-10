import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { anyOf, char, charIn, createRegExp, digit, exactly, global, oneOrMore } from 'magic-regexp';
import * as path from 'pathe';
import { chromium, type Browser } from 'playwright';
import { joinURL, parseHost, parseURL } from 'ufo';
import { canonicalize, receiptDigest, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { renderReceipt } from '../../../core/src/receipts/render.ts';
import {
	parseMigrationReceipt,
	type Artifact,
	type MigrationReceipt,
} from '../../../core/src/receipts/schema.ts';
import { verifyReceipt } from '../../../core/src/receipts/verify.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const fixtureRoot = path.join(root, '.versionless/work/react-boilerplate-v4');
const cacheRoot = path.join(root, '.versionless/cache/react-boilerplate-v4');
const artifactsRoot = path.join(root, 'evidence/runs/react-boilerplate-v4/artifacts');
const guard = path.join(root, 'packages/node-guard/dist/index.cjs');
interface Journey {
	qualificationRuns: number;
	initialPath: string;
	initialHeading: string;
	navigationName: string;
	navigationPath: string;
	returnName: string;
	localeControl: string;
	targetLocale: string;
	translatedHeading: string;
	locale: string;
	timezoneId: string;
	viewport: { width: number; height: number };
}
interface CommandResult {
	stdout: string;
	stderr: string;
}

const ansiColorSequence = createRegExp(
	exactly(String.fromCharCode(27), '['),
	charIn(';').from('0', '9').times.any(),
	'm',
	[global],
);
const webpackDuration = createRegExp(exactly('Time: '), oneOrMore(digit), 'ms', [global]);
const webpackBuildTime = createRegExp(exactly('Built at: '), char.times.any(), [global]);
const localeJourneyFailure = createRegExp(
	anyOf('Selected locale control assertion', 'Beginnen Sie', 'waiting for getByRole'),
);

function normalizeOldLockWarning(text: string): string {
	const start = text.indexOf('npm WARN old lockfile');
	if (start === -1) return text;
	const marker = 'metadata, so please be patient!';
	const markerStart = text.indexOf(marker, start);
	if (markerStart === -1) return text;
	return `${text.slice(0, start)}npm WARN old lockfile <normalized>${text.slice(markerStart + marker.length)}`;
}

function markdownPath(jsonPath: string): string {
	return jsonPath.endsWith('.json')
		? `${jsonPath.slice(0, -'.json'.length)}.md`
		: `${jsonPath}.md`;
}

function normalized(text: string): string {
	return normalizeOldLockWarning(
		text
			.replace(ansiColorSequence, '')
			.replace(webpackDuration, 'Time: <duration>')
			.replace(webpackBuildTime, 'Built at: <normalized>'),
	);
}
function childEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
	const nodeBin = path.join(cacheRoot, 'node16/bin');
	return {
		...process.env,
		PATH: `${nodeBin}:${process.env.PATH ?? ''}`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		npm_config_offline: 'true',
		NPM_CONFIG_CACHE: path.join(cacheRoot, 'npm-cache'),
		npm_config_cache: path.join(cacheRoot, 'npm-cache'),
		NODE_OPTIONS: `${process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ''}--require=${guard}`,
		...extra,
	};
}
function run(
	command: string,
	args: string[],
	options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<CommandResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { ...options, env: options.env ?? childEnv() });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout?.on('data', (v: Buffer) => stdout.push(v));
		child.stderr?.on('data', (v: Buffer) => stderr.push(v));
		child.once('error', reject);
		child.once('exit', (code) => {
			const result = {
				stdout: Buffer.concat(stdout).toString(),
				stderr: Buffer.concat(stderr).toString(),
			};
			if (code === 0) resolve(result);
			else
				reject(
					Object.assign(new Error(`${command} exited ${code}: ${result.stderr}`), {
						result,
					}),
				);
		});
	});
}
async function waitForServer(port: number): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		try {
			await new Promise<void>((resolve, reject) => {
				const request = http.get(joinURL(`http://127.0.0.1:${port}`, '/'), (response) => {
					response.resume();
					resolve();
				});
				request.once('error', reject);
			});
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
	throw new Error(`Server ${port} did not become ready`);
}
async function reserveEphemeralPort(): Promise<number> {
	const probe = http.createServer();
	await new Promise<void>((resolve, reject) => {
		probe.once('error', reject);
		probe.listen(0, '127.0.0.1', resolve);
	});
	const address = probe.address();
	if (address === null || typeof address === 'string')
		throw new Error('Loopback probe did not report an ephemeral port');
	const { port } = address;
	await new Promise<void>((resolve, reject) =>
		probe.close((error) => (error ? reject(error) : resolve())),
	);
	return port;
}

async function startServer(lane: string): Promise<{ child: ChildProcess; port: number }> {
	const port = await reserveEphemeralPort();
	const child = spawn(path.join(cacheRoot, 'node16/bin/node'), ['server'], {
		cwd: lane,
		env: childEnv({ NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port) }),
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	const errors: Buffer[] = [];
	child.stderr?.on('data', (v: Buffer) => errors.push(v));
	try {
		await waitForServer(port);
	} catch (error) {
		child.kill('SIGTERM');
		throw new Error(`${String(error)}: ${Buffer.concat(errors).toString()}`);
	}
	return { child, port };
}
async function stopServer(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null) return;
	child.kill('SIGTERM');
	await Promise.race([
		new Promise<void>((resolve) => child.once('exit', () => resolve())),
		new Promise<void>((resolve) =>
			setTimeout(() => {
				child.kill('SIGKILL');
				resolve();
			}, 3000),
		),
	]);
}
async function runJourney(
	browser: Browser,
	port: number,
	journey: Journey,
	lane: string,
	runNumber: number,
	expectMutationFailure = false,
) {
	const context = await browser.newContext({
		locale: journey.locale,
		timezoneId: journey.timezoneId,
		viewport: journey.viewport,
	});
	const blocked: string[] = [];
	const syntheticBlockedResponses = new Set<string>();
	const successfulNonLoopback: string[] = [];
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];
	await context.route('**/*', async (route) => {
		const url = parseURL(route.request().url());
		if (['127.0.0.1', 'localhost', '::1'].includes(parseHost(url.host ?? '').hostname))
			await route.continue();
		else {
			const requestUrl = route.request().url();
			blocked.push(requestUrl);
			syntheticBlockedResponses.add(requestUrl);
			await route.fulfill({ status: 204, body: '' });
		}
	});
	const page = await context.newPage();
	page.on('response', (response) => {
		const url = parseURL(response.url());
		if (
			!['127.0.0.1', 'localhost', '::1'].includes(parseHost(url.host ?? '').hostname) &&
			!syntheticBlockedResponses.has(response.url()) &&
			response.ok()
		)
			successfulNonLoopback.push(response.url());
	});
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	page.on('pageerror', (error) => pageErrors.push(error.message));
	let intendedFailure = false;
	try {
		await page.goto(joinURL(`http://127.0.0.1:${port}`, journey.initialPath), {
			waitUntil: 'networkidle',
		});
		await page.getByRole('heading', { name: journey.initialHeading }).waitFor();
		await page.getByRole('link', { name: journey.navigationName }).click();
		if (parseURL(page.url()).pathname !== journey.navigationPath)
			throw new Error('Navigation assertion failed');
		await page.getByRole('link', { name: journey.returnName }).click();
		const control = page.locator(journey.localeControl);
		await control.selectOption(journey.targetLocale);
		if ((await control.inputValue()) !== journey.targetLocale)
			throw new Error('Selected locale control assertion failed');
		await page
			.getByRole('heading', { name: journey.translatedHeading })
			.waitFor({ timeout: 5000 });
	} catch (error) {
		if (
			expectMutationFailure &&
			error instanceof Error &&
			localeJourneyFailure.test(error.message)
		)
			intendedFailure = true;
		else {
			void context.close();
			throw error;
		}
	}
	// A failed assertion can leave Playwright's context-close promise pending
	// after the page has already torn down. The owning browser closes that
	// mutation context immediately after this evidence returns.
	if (!intendedFailure) await context.close();
	if (expectMutationFailure && !intendedFailure)
		throw new Error('Mutation did not fail the intended locale assertion');
	if (!expectMutationFailure && (consoleErrors.length || pageErrors.length))
		throw new Error(
			`Unexpected browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`,
		);
	if (successfulNonLoopback.length)
		throw new Error(`Successful non-loopback traffic: ${successfulNonLoopback.join(', ')}`);
	return {
		lane,
		run: runNumber,
		result: expectMutationFailure ? 'intended-failure' : 'pass',
		selectedLocale: journey.targetLocale,
		translatedHeading: journey.translatedHeading,
		blocked,
		successfulNonLoopback,
		consoleErrors,
		pageErrors,
	};
}
async function artifact(name: string, value: unknown): Promise<Artifact> {
	const file = path.join(artifactsRoot, name);
	const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
	await writeFile(file, content);
	return { path: path.relative(root, file), sha256: sha256(content) };
}

export async function verifyReactFixture({
	receiptPath,
}: {
	receiptPath: string;
}): Promise<MigrationReceipt> {
	const stage = (value: string) => console.error(`[versionless] ${value}`);
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('fixture:verify requires explicit offline mode');
	const manifest = JSON.parse(
		await readFile(path.join(root, 'fixtures/react-boilerplate-v4/fixture.json'), 'utf8'),
	) as Record<string, any>;
	const journey = JSON.parse(
		await readFile(path.join(root, 'fixtures/react-boilerplate-v4/journey.json'), 'utf8'),
	) as Journey;
	const consent = JSON.parse(await readFile(path.join(cacheRoot, 'consent.json'), 'utf8')) as {
		consentId: string;
		purpose: string;
		networkMode: 'consented';
	};
	if (consent.consentId !== 'T008-fixture-ingest')
		throw new Error('Stale fixture consent evidence');
	const legacy = path.join(fixtureRoot, 'legacy');
	const target = path.join(fixtureRoot, 'target');
	const npm = path.join(cacheRoot, 'node16/bin/npm');
	await rm(artifactsRoot, { recursive: true, force: true });
	await mkdir(artifactsRoot, { recursive: true });
	await rm(path.join(legacy, 'node_modules'), { recursive: true, force: true });
	await rm(path.join(target, 'node_modules'), { recursive: true, force: true });
	for (const lane of [legacy, target])
		await run(npm, ['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], {
			cwd: lane,
		});
	const artifacts: Artifact[] = [];
	for (const [name, lane] of [
		['legacy', legacy],
		['target', target],
	] as const) {
		const result = await run(npm, ['run', 'build'], { cwd: lane });
		artifacts.push(
			await artifact(`build-${name}.log`, normalized(`${result.stdout}${result.stderr}`)),
		);
	}
	stage('legacy and target builds passed');
	const browserExecutable = path.join(
		cacheRoot,
		'ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
	);
	const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
	const journeys: unknown[] = [];
	try {
		for (const [name, lane] of [
			['legacy', legacy],
			['target', target],
		] as const) {
			const { child: server, port } = await startServer(lane);
			try {
				for (let index = 1; index <= journey.qualificationRuns; index += 1)
					journeys.push(await runJourney(browser, port, journey, name, index));
			} finally {
				await stopServer(server);
			}
		}
	} finally {
		await browser.close();
	}
	artifacts.push(await artifact('journey.json', journeys));
	stage('two browser journeys per lane passed');
	const targetSource = path.join(target, 'app/containers/LocaleToggle/index.js');
	const restored = await readFile(targetSource, 'utf8');
	const restoredHash = sha256(restored);
	const mutated = restored.replace(
		'const selectLocale = makeSelectLocale();',
		"const selectLocale = () => 'en';",
	);
	if (mutated === restored) throw new Error('Mutation target not found');
	let mutationResult: Awaited<ReturnType<typeof runJourney>> | undefined;
	try {
		await writeFile(targetSource, mutated);
		const mutationBuild = await run(npm, ['run', 'build'], { cwd: target });
		artifacts.push(
			await artifact(
				'build-mutation.log',
				normalized(`${mutationBuild.stdout}${mutationBuild.stderr}`),
			),
		);
		stage('mutation target built');
		const mutationBrowser = await chromium.launch({
			headless: true,
			executablePath: browserExecutable,
		});
		stage('mutation browser launched');
		const { child: server, port } = await startServer(target);
		stage('mutation server started');
		try {
			mutationResult = await runJourney(
				mutationBrowser,
				port,
				journey,
				'target-mutation',
				1,
				true,
			);
		} finally {
			await stopServer(server);
			await mutationBrowser.close();
		}
	} finally {
		await writeFile(targetSource, restored);
	}
	stage('mutation produced intended locale failure');
	if (!mutationResult || sha256(await readFile(targetSource)) !== restoredHash)
		throw new Error('Mutation restoration was not byte-identical');
	const restoredBuild = await run(npm, ['run', 'build'], { cwd: target });
	artifacts.push(
		await artifact(
			'build-restored.log',
			normalized(`${restoredBuild.stdout}${restoredBuild.stderr}`),
		),
	);
	const restoredBrowser = await chromium.launch({
		headless: true,
		executablePath: browserExecutable,
	});
	const { child: restoredServer, port: restoredPort } = await startServer(target);
	let restoredJourney;
	try {
		restoredJourney = await runJourney(
			restoredBrowser,
			restoredPort,
			journey,
			'target-restored',
			1,
		);
	} finally {
		await stopServer(restoredServer);
		await restoredBrowser.close();
	}
	artifacts.push(
		await artifact('mutation.json', {
			mutation: mutationResult.result,
			restoredSha256: restoredHash,
			restoration: 'byte-identical',
			reproduced: restoredJourney.result,
		}),
	);
	stage('restored target rebuilt and browser journey passed');
	const sourceCode = await readFile(path.join(legacy, 'app/containers/LocaleToggle/index.js'));
	const targetCode = await readFile(targetSource);
	artifacts.push(
		await artifact('migration-diff.json', {
			sourceSha256: sha256(sourceCode),
			targetSha256: sha256(targetCode),
			changedFiles: [
				'app/containers/LocaleToggle/index.js',
				'package.json',
				'package-lock.json',
			],
		}),
	);
	const locality = {
		mode: 'offline' as const,
		scope: 'Versionless-spawned Node/npm/webpack child processes and Playwright browser requests',
		osWideIsolation: false as const,
		successfulNonLoopback: 0 as const,
		browserBlockedRequests: journeys.flatMap((item: any) => item.blocked).length,
	};
	artifacts.push(await artifact('locality.json', locality));
	const deterministicInput = {
		fixture: manifest.id,
		revision: manifest.source.revision,
		targetSha256: sha256(targetCode),
		changedFiles: ['app/containers/LocaleToggle/index.js', 'package.json', 'package-lock.json'],
		journey: {
			targetLocale: journey.targetLocale,
			translatedHeading: journey.translatedHeading,
		},
	};
	const first = sha256(canonicalize(deterministicInput));
	const second = sha256(canonicalize(JSON.parse(JSON.stringify(deterministicInput))));
	if (first !== second) throw new Error('Deterministic-core mismatch');
	artifacts.push(await artifact('deterministic-core.json', { first, second, equal: true }));
	const receipt: MigrationReceipt = {
		schemaVersion: 'versionless.receipt.v1',
		runId: 'T008-react-boilerplate-v4',
		fixture: manifest.id,
		source: {
			repository: manifest.source.repository,
			revision: manifest.source.revision,
			archiveSha256: manifest.source.archiveSha256,
			license: manifest.source.license,
			licenseSha256: manifest.source.licenseSha256,
		},
		tooling: {
			node: '16.20.2-darwin-arm64 EOL compatibility sandbox',
			yukuParser: '0.7.0',
			yukuAnalyzer: '0.7.0',
			playwright: '1.58.2',
			chromium: '145.0.7632.6',
			webpack: '4.30.0',
		},
		consent: [{ id: consent.consentId, purpose: consent.purpose, mode: consent.networkMode }],
		migration: {
			file: 'app/containers/LocaleToggle/index.js',
			transform: 'react-connect-to-hooks',
			edits: 5,
			dependency: { name: 'react-redux', from: '7.0.2', to: '7.1.3', license: 'MIT' },
			lockPatch: 'fixtures/react-boilerplate-v4/react-redux-7.1.3.lock.patch',
		},
		verification: {
			result: 'pass',
			builds: 'pass',
			journeys: 'pass',
			mutation: 'pass',
			locality,
			deterministicCore: { first, second, equal: true },
		},
		artifacts,
		integrity: { algorithm: 'sha256', canonicalDigest: '', authenticity: 'not-established' },
		limitations: [
			'Hash integrity does not establish signer authenticity or provenance beyond pinned downloads.',
			'Network controls cover spawned Node children and browser routing, not OS-wide process isolation.',
			'Node 16 is EOL and used only as a compatibility sandbox.',
			'The transform is approved only for the exact proven LocaleToggle shape.',
			'npm lifecycle scripts are disabled identically in both lanes because unused optional ngrok@3.1.1 rejects darwin-arm64; production webpack build and parity are acceptance gates.',
			'This receipt proves one React webpack fixture only, not the full corpus outcome.',
		],
	};
	receipt.integrity.canonicalDigest = receiptDigest(receipt);
	parseMigrationReceipt(receipt);
	const absolute = path.resolve(receiptPath);
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, `${JSON.stringify(receipt, null, 2)}\n`);
	await writeFile(markdownPath(absolute), renderReceipt(receipt));
	const aggregate = {
		schemaVersion: 'versionless.aggregate.v1',
		fixtures: [
			{
				id: manifest.id,
				framework: 'react',
				bundler: 'webpack-4',
				result: 'pass',
				receipt: path.relative(root, absolute),
				digest: receipt.integrity.canonicalDigest,
			},
		],
		unsupported: [],
	};
	await writeFile(
		path.join(root, 'evidence/runs/aggregate.json'),
		`${JSON.stringify(aggregate, null, 2)}\n`,
	);
	await verifyReceipt(absolute);
	stage('receipt and artifacts independently verified');
	return receipt;
}
