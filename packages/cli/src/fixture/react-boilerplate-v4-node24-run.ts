import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import {
	anyOf,
	caseInsensitive,
	char,
	charIn,
	createRegExp,
	digit,
	exactly,
	global,
	oneOrMore,
} from 'magic-regexp';
import * as path from 'pathe';
import { chromium, type Browser } from 'playwright';
import { joinURL, parseHost, parseURL, stringifyParsedURL } from 'ufo';
import { canonicalize, receiptDigest, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { renderReceipt } from '../../../core/src/receipts/render.ts';
import {
	parseMigrationReceipt,
	type Artifact,
	type MigrationReceipt,
} from '../../../core/src/receipts/schema.ts';
import { verifyReceipt } from '../../../core/src/receipts/verify.ts';
import {
	REACT_NODE24_CONSENT,
	REACT_NODE24_PURPOSE,
} from './react-boilerplate-v4-node24-ingest.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const cache = path.join(root, '.versionless/cache/react-boilerplate-v4-node24');
const target = path.join(root, '.versionless/work/react-boilerplate-v4-node24/target');
const artifactsRoot = path.join(root, 'evidence/runs/react-boilerplate-v4-node24/artifacts');
const guard = path.join(root, 'packages/node-guard/dist/index.cjs');
const t008ReceiptDigest = '4d32ae0a46041e5ec2ac68aa31a9b8f86bd9d294d312ce41968ddd99dc5ee758';
const t008ConsentDigest = 'dd0d629c7855690b45144f901f17c4e140cd5e4332c9ed2148f93d43363e9442';
const mutationLockDigest = '8af43b5f48d0c64f67c518a216a7d98571b1498c835ebb234d6dda845a988d33';
const t008ConsentPurpose =
	'immutable fixture, EOL Node 16 compatibility sandbox, target dependency, and locked npm population; lifecycle scripts disabled uniformly because optional ngrok@3.1.1 rejects darwin-arm64';
const ansiColorSequence = createRegExp(
	exactly(String.fromCharCode(27), '['),
	charIn(';').from('0', '9').times.any(),
	'm',
	[global],
);
const webpackDuration = createRegExp(exactly('Time: '), oneOrMore(digit), 'ms', [global]);
const webpackBuildTime = createRegExp(exactly('Built at: '), char.times.any(), [global]);
const expectedOpenSslFailure = createRegExp(
	anyOf(
		'ERR_OSSL_EVP_UNSUPPORTED',
		'digital envelope routines::unsupported',
		'Digest method not supported',
	),
	[caseInsensitive],
);

function markdownPath(jsonPath: string): string {
	return jsonPath.endsWith('.json')
		? `${jsonPath.slice(0, -'.json'.length)}.md`
		: `${jsonPath}.md`;
}

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

function env(): NodeJS.ProcessEnv {
	if (process.env.NODE_OPTIONS?.includes('--openssl-legacy-provider'))
		throw new Error('Legacy OpenSSL provider is forbidden');
	const bin = path.join(cache, 'node24/bin');
	return {
		...process.env,
		PATH: `${bin}:${process.env.PATH ?? ''}`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		npm_config_offline: 'true',
		NPM_CONFIG_CACHE: path.join(cache, 'npm-cache'),
		npm_config_cache: path.join(cache, 'npm-cache'),
		NODE_OPTIONS: `--require=${guard}`,
	};
}

function execute(command: string, args: string[], acceptFailure = false) {
	return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
		const child = spawn(command, args, { cwd: target, env: env() });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout?.on('data', (value: Buffer) => stdout.push(value));
		child.stderr?.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) => {
			const result = {
				code: code ?? -1,
				stdout: Buffer.concat(stdout).toString(),
				stderr: Buffer.concat(stderr).toString(),
			};
			if (result.code === 0 || acceptFailure) resolve(result);
			else reject(new Error(`${command} exited ${result.code}: ${result.stderr}`));
		});
	});
}

function normalized(text: string): string {
	return text
		.replace(ansiColorSequence, '')
		.replace(webpackDuration, 'Time: <duration>')
		.replace(webpackBuildTime, 'Built at: <normalized>')
		.split(`file://${root}`)
		.join('<checkout>')
		.split(root)
		.join('<checkout>');
}

async function verifyCacheRecovery(): Promise<Record<string, unknown>> {
	const closure = JSON.parse(
		await readFile(
			path.join(root, 'fixtures/react-boilerplate-v4-node24/cache-recovery-closure.json'),
			'utf8',
		),
	) as Record<string, any>;
	const closureDigest = sha256(canonicalize(closure));
	if (
		closure.schemaVersion !== 'versionless.npm-cache-closure.v1' ||
		closureDigest !== '6f7a41ea3d7b654e157237d1cc670bee235b312ca18a31198eddaa51b8889cf2' ||
		closure.lockEntries !== 1_516 ||
		closure.canonicalizedHttpEntries !== 10 ||
		closure.originalMissing !== 45 ||
		closure.alreadyRecovered !== 1 ||
		closure.remainingMissing !== 44 ||
		!Array.isArray(closure.entries) ||
		closure.entries.length !== 45
	)
		throw new Error('Canonical mutation-cache closure mismatch');
	const consentPath = path.join(root, closure.source.cache, '..', 'consent.json');
	const t008LockPath = path.join(
		root,
		'.versionless/work/react-boilerplate-v4/target/package-lock.json',
	);
	const mutationLockPath = path.join(cache, 'package-lock.webpack-4.30.0.json');
	const receiptPath = path.join(root, 'evidence/runs/react-boilerplate-v4/t008-run.json');
	const receipt = await verifyReceipt(receiptPath);
	if (receipt.digest !== t008ReceiptDigest || closure.source.receiptDigest !== t008ReceiptDigest)
		throw new Error('T008 receipt digest mismatch');
	const consentBytes = await readFile(consentPath);
	if (
		sha256(consentBytes) !== t008ConsentDigest ||
		closure.source.consentSha256 !== t008ConsentDigest
	)
		throw new Error('T008 consent digest mismatch');
	const sourceConsent = JSON.parse(consentBytes.toString()) as Record<string, unknown>;
	if (
		sourceConsent.consentId !== closure.source.consentId ||
		sourceConsent.purpose !== closure.source.purpose ||
		closure.source.consentId !== 'T008-fixture-ingest' ||
		closure.source.purpose !== t008ConsentPurpose
	)
		throw new Error('T008 locked npm population provenance mismatch');
	if (
		sha256(await readFile(t008LockPath)) !== mutationLockDigest ||
		sha256(await readFile(mutationLockPath)) !== mutationLockDigest
	)
		throw new Error('T008/T022 mutation lock mismatch');
	const provenanceEntries: Array<Record<string, unknown>> = [];
	let copied = 0;
	let preExisting = 0;
	for (const entry of closure.entries as Array<Record<string, any>>) {
		const sourceIndexPath = path.join(
			root,
			closure.source.cache,
			'_cacache/index-v5',
			entry.indexKey,
		);
		const sourceContentPath = path.join(
			root,
			closure.source.cache,
			'_cacache/content-v2',
			entry.contentKey,
		);
		const destinationIndexPath = path.join(
			root,
			closure.destinationCache,
			'_cacache/index-v5',
			entry.indexKey,
		);
		const destinationContentPath = path.join(
			root,
			closure.destinationCache,
			'_cacache/content-v2',
			entry.contentKey,
		);
		const sourceIndex = await readFile(sourceIndexPath);
		const sourceContent = await readFile(sourceContentPath);
		const destinationIndex = await readFile(destinationIndexPath);
		const destinationContent = await readFile(destinationContentPath);
		if (
			sha256(sourceIndex) !== entry.indexSha256 ||
			sha256(destinationIndex) !== entry.indexSha256 ||
			sha256(sourceContent) !== entry.contentSha256 ||
			sha256(destinationContent) !== entry.contentSha256 ||
			sourceContent.byteLength !== entry.size ||
			destinationContent.byteLength !== entry.size ||
			!sourceIndex.equals(destinationIndex) ||
			!sourceContent.equals(destinationContent)
		)
			throw new Error(`Cache byte provenance mismatch: ${entry.package}`);
		const indexLine = sourceIndex
			.toString()
			.split('\n')
			.find((line) => line.includes(entry.url));
		const separator = indexLine?.indexOf('\t') ?? -1;
		if (!indexLine || separator < 0)
			throw new Error(`Cache index record missing: ${entry.package}`);
		const indexRecord = JSON.parse(indexLine.slice(separator + 1)) as Record<string, any>;
		if (
			indexRecord.key !== `make-fetch-happen:request-cache:${entry.url}` ||
			indexRecord.integrity !== entry.integrity ||
			indexRecord.size !== entry.size ||
			indexRecord.metadata?.url !== entry.url
		)
			throw new Error(`Cache index evidence mismatch: ${entry.package}`);
		const packageManifest = await execute('tar', [
			'-xOzf',
			sourceContentPath,
			'package/package.json',
		]);
		const packageValue = JSON.parse(packageManifest.stdout) as Record<string, unknown>;
		const expression = packageValue.license ?? null;
		if (
			sha256(packageManifest.stdout) !== entry.packageManifestSha256 ||
			expression !== entry.license.expression ||
			(expression ? sha256(Buffer.from(String(expression))) : null) !==
				entry.license.expressionSha256
		)
			throw new Error(`Package manifest evidence mismatch: ${entry.package}`);
		for (const license of entry.license.files as Array<Record<string, string>>) {
			const content = await execute('tar', ['-xOzf', sourceContentPath, license.path]);
			if (sha256(content.stdout) !== license.sha256)
				throw new Error(`License evidence mismatch: ${entry.package}`);
		}
		const status = entry.package === 'worker-farm@1.6.0' ? 'pre-existing' : 'copied';
		if (status === 'pre-existing') preExisting++;
		else copied++;
		provenanceEntries.push({
			...entry,
			source: {
				index: path.relative(root, sourceIndexPath),
				content: path.relative(root, sourceContentPath),
			},
			destination: {
				index: path.relative(root, destinationIndexPath),
				content: path.relative(root, destinationContentPath),
			},
			status,
			bytesEqual: true,
		});
	}
	if (copied !== 44 || preExisting !== 1)
		throw new Error('Recovered cache status counts mismatch');

	const mutationLock = JSON.parse(await readFile(mutationLockPath, 'utf8')) as Record<
		string,
		any
	>;
	const lockPairs = new Map<string, { url: string; integrity: string }>();
	const visit = (dependencies: Record<string, any> | undefined): void => {
		for (const dependency of Object.values(dependencies ?? {})) {
			if (dependency.resolved && dependency.integrity)
				lockPairs.set(`${dependency.resolved}\n${dependency.integrity}`, {
					url: dependency.resolved,
					integrity: dependency.integrity,
				});
			visit(dependency.dependencies);
		}
	};
	visit(mutationLock.dependencies);
	let canonicalizedHttpEntries = 0;
	let missing = 0;
	for (const pair of lockPairs.values()) {
		const parsed = parseURL(pair.url);
		let url = pair.url;
		if (parsed.protocol === 'http:' && parsed.host === 'registry.npmjs.org') {
			canonicalizedHttpEntries++;
			parsed.protocol = 'https:';
			url = stringifyParsedURL(parsed);
		}
		const indexHash = sha256(`make-fetch-happen:request-cache:${url}`);
		const [algorithm, encoded] = pair.integrity.split('-');
		if (!algorithm || !encoded) throw new Error('Malformed lock integrity');
		const contentHash = Buffer.from(encoded, 'base64').toString('hex');
		const indexPath = path.join(
			root,
			closure.destinationCache,
			'_cacache/index-v5',
			indexHash.slice(0, 2),
			indexHash.slice(2, 4),
			indexHash.slice(4),
		);
		const contentPath = path.join(
			root,
			closure.destinationCache,
			'_cacache/content-v2',
			algorithm,
			contentHash.slice(0, 2),
			contentHash.slice(2, 4),
			contentHash.slice(4),
		);
		try {
			await Promise.all([readFile(indexPath), readFile(contentPath)]);
		} catch {
			missing++;
		}
	}
	if (
		lockPairs.size !== closure.lockEntries ||
		canonicalizedHttpEntries !== closure.canonicalizedHttpEntries ||
		missing !== 0
	)
		throw new Error('Post-copy mutation-lock cache audit failed');
	return {
		schemaVersion: 'versionless.npm-cache-provenance.v1',
		closureDigest,
		lockEntries: lockPairs.size,
		canonicalizedHttpEntries,
		entries: provenanceEntries,
		copied,
		preExisting,
		missing,
		bytesEqual: true,
		networkUsed: false,
	};
}

async function waitForServer(port: number): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt++) {
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
	throw new Error('Loopback server did not become ready');
}

async function startServer(port: number): Promise<ChildProcess> {
	const child = spawn(path.join(cache, 'node24/bin/node'), ['server'], {
		cwd: target,
		env: { ...env(), NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port) },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	await waitForServer(port);
	return child;
}

async function stopServer(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null) return;
	child.kill('SIGTERM');
	await new Promise<void>((resolve) => child.once('exit', () => resolve()));
}

async function journeyRun(browser: Browser, journey: Journey, port: number, run: number) {
	const context = await browser.newContext({
		locale: journey.locale,
		timezoneId: journey.timezoneId,
		viewport: journey.viewport,
	});
	const blocked: string[] = [];
	const syntheticBlocked = new Set<string>();
	const successfulNonLoopback: string[] = [];
	await context.route('**/*', async (route) => {
		const url = parseURL(route.request().url());
		if (['127.0.0.1', 'localhost', '::1'].includes(parseHost(url.host ?? '').hostname))
			await route.continue();
		else {
			blocked.push(route.request().url());
			syntheticBlocked.add(route.request().url());
			await route.fulfill({ status: 204, body: '' });
		}
	});
	const page = await context.newPage();
	page.on('response', (response) => {
		const url = parseURL(response.url());
		if (
			!['127.0.0.1', 'localhost', '::1'].includes(parseHost(url.host ?? '').hostname) &&
			!syntheticBlocked.has(response.url()) &&
			response.ok()
		)
			successfulNonLoopback.push(response.url());
	});
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
	await page.getByRole('heading', { name: journey.translatedHeading }).waitFor();
	await context.close();
	if (successfulNonLoopback.length)
		throw new Error(`Successful non-loopback traffic: ${successfulNonLoopback.join(', ')}`);
	return {
		run,
		result: 'pass',
		navigationPath: journey.navigationPath,
		selectedLocale: journey.targetLocale,
		translatedHeading: journey.translatedHeading,
		blocked,
		successfulNonLoopback,
	};
}

async function artifact(name: string, value: unknown): Promise<Artifact> {
	const file = path.join(artifactsRoot, name);
	const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
	await writeFile(file, content);
	return { path: path.relative(root, file), sha256: sha256(content) };
}

export async function verifyReactBoilerplateNode24({
	receiptPath,
}: {
	receiptPath: string;
}): Promise<MigrationReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('fixture:verify requires explicit offline mode');
	const manifest = JSON.parse(
		await readFile(
			path.join(root, 'fixtures/react-boilerplate-v4-node24/fixture.json'),
			'utf8',
		),
	) as Record<string, any>;
	const journey = JSON.parse(
		await readFile(path.join(root, manifest.journey), 'utf8'),
	) as Journey;
	const consent = JSON.parse(await readFile(path.join(cache, 'consent.json'), 'utf8')) as Record<
		string,
		any
	>;
	if (consent.consentId !== REACT_NODE24_CONSENT || consent.purpose !== REACT_NODE24_PURPOSE)
		throw new Error('Stale maintained-runtime consent evidence');
	const npm = path.join(cache, 'node24/bin/npm');
	const node = path.join(cache, 'node24/bin/node');
	if ((await execute(node, ['--version'])).stdout.trim() !== 'v24.15.0')
		throw new Error('Maintained runtime changed');
	await rm(artifactsRoot, { recursive: true, force: true });
	await mkdir(artifactsRoot, { recursive: true });
	const cacheProvenance = await verifyCacheRecovery();
	const packageFile = path.join(target, 'package.json');
	const lockFile = path.join(target, 'package-lock.json');
	const targetPackage = await readFile(packageFile);
	const targetLock = await readFile(lockFile);
	const targetPackageHash = sha256(targetPackage);
	const targetLockHash = sha256(targetLock);
	if (targetLockHash !== consent.lock.afterSha256)
		throw new Error('Maintained lock differs from consented lock');
	await rm(path.join(target, 'node_modules'), { recursive: true, force: true });
	await execute(npm, ['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund']);
	if (sha256(await readFile(lockFile)) !== targetLockHash)
		throw new Error('Offline clean install mutated maintained lock');
	const build = await execute(npm, ['run', 'build']);
	const artifacts: Artifact[] = [
		await artifact('cache-provenance.json', cacheProvenance),
		await artifact('build-target.log', normalized(`${build.stdout}${build.stderr}`)),
	];

	const browserExecutable = path.resolve(root, manifest.browser.executable);
	if (sha256(await readFile(browserExecutable)) !== manifest.browser.sha256)
		throw new Error('Pinned browser digest mismatch');
	const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
	const server = await startServer(43181);
	const journeys: unknown[] = [];
	try {
		for (let index = 1; index <= journey.qualificationRuns; index++)
			journeys.push(await journeyRun(browser, journey, 43181, index));
	} finally {
		await stopServer(server);
		await browser.close();
	}
	artifacts.push(await artifact('journey.json', journeys));

	const mutationPackage = targetPackage
		.toString()
		.replace('"webpack": "4.47.0"', '"webpack": "4.30.0"')
		.replace('"terser-webpack-plugin": "1.4.6"', '"terser-webpack-plugin": "1.2.3"');
	if (mutationPackage === targetPackage.toString())
		throw new Error('Webpack mutation target absent');
	let mutation;
	try {
		await writeFile(packageFile, mutationPackage);
		await writeFile(
			lockFile,
			await readFile(path.join(cache, 'package-lock.webpack-4.30.0.json')),
		);
		await rm(path.join(target, 'node_modules'), { recursive: true, force: true });
		await execute(npm, ['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund']);
		const failed = await execute(npm, ['run', 'build'], true);
		const output = `${failed.stdout}${failed.stderr}`;
		if (failed.code === 0 || !expectedOpenSslFailure.test(output))
			throw new Error(
				'Webpack 4.30.0 did not fail for the intended Node 24 MD4 incompatibility',
			);
		mutation = {
			webpack: '4.30.0',
			result: 'intended-failure',
			runtime: 'v24.15.0',
			reason: 'OpenSSL MD4 unsupported',
			lockSha256: sha256(await readFile(lockFile)),
		};
		artifacts.push(await artifact('build-mutation.log', normalized(output)));
	} finally {
		await writeFile(packageFile, targetPackage);
		await writeFile(lockFile, targetLock);
	}
	if (
		sha256(await readFile(packageFile)) !== targetPackageHash ||
		sha256(await readFile(lockFile)) !== targetLockHash
	)
		throw new Error('Webpack 4.47.0 restoration was not byte-identical');
	await rm(path.join(target, 'node_modules'), { recursive: true, force: true });
	await execute(npm, ['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund']);
	const restored = await execute(npm, ['run', 'build']);
	artifacts.push(
		await artifact('build-restored.log', normalized(`${restored.stdout}${restored.stderr}`)),
	);
	const restoredBrowser = await chromium.launch({
		headless: true,
		executablePath: browserExecutable,
	});
	const restoredServer = await startServer(43182);
	let restoredJourney;
	try {
		restoredJourney = await journeyRun(restoredBrowser, journey, 43182, 1);
	} finally {
		await stopServer(restoredServer);
		await restoredBrowser.close();
	}
	artifacts.push(
		await artifact('mutation.json', {
			...mutation,
			restoration: 'byte-identical',
			restoredPackageSha256: targetPackageHash,
			restoredLockSha256: targetLockHash,
			reproduced: restoredJourney.result,
			legacyOpenSslProvider: false,
		}),
	);
	const locale = await readFile(path.join(target, 'app/containers/LocaleToggle/index.js'));
	artifacts.push(
		await artifact('migration-diff.json', {
			changedFiles: [
				'app/containers/LocaleToggle/index.js',
				'package.json',
				'package-lock.json',
			],
			localeToggleSha256: sha256(locale),
			packageSha256: targetPackageHash,
			packageLockSha256: targetLockHash,
			lockPatchSha256: consent.lock.patchSha256,
		}),
	);
	const locality = {
		mode: 'offline' as const,
		scope: 'Versionless-spawned Node/npm/webpack child processes and Playwright browser requests',
		osWideIsolation: false as const,
		successfulNonLoopback: 0 as const,
		browserBlockedRequests: journeys.flatMap((value: any) => value.blocked).length,
	};
	artifacts.push(await artifact('locality.json', locality));
	const core = {
		fixture: manifest.id,
		revision: manifest.source.revision,
		node: manifest.runtime.version,
		webpack: manifest.webpack.to,
		localeToggleSha256: sha256(locale),
		packageSha256: targetPackageHash,
		packageLockSha256: targetLockHash,
	};
	const first = sha256(canonicalize(core));
	const second = sha256(canonicalize(JSON.parse(JSON.stringify(core))));
	artifacts.push(await artifact('deterministic-core.json', { first, second, equal: true }));
	artifacts.push(
		await artifact('ingest-integrity.json', {
			source: consent.source,
			runtime: consent.runtime,
			webpack: consent.webpack,
			bundlerCompanion: consent.bundlerCompanion,
			lock: consent.lock,
		}),
	);
	const receipt: MigrationReceipt = {
		schemaVersion: 'versionless.receipt.v1',
		runId: 'T022-react-boilerplate-v4-node24',
		fixture: manifest.id,
		source: {
			repository: manifest.source.repository,
			revision: manifest.source.revision,
			archiveSha256: manifest.source.archiveSha256,
			license: manifest.source.license,
			licenseSha256: manifest.source.licenseSha256,
		},
		tooling: {
			node: '24.15.0-darwin-arm64 maintained runtime',
			yukuParser: '0.7.0',
			yukuAnalyzer: '0.7.0',
			playwright: '1.58.2',
			chromium: '145.0.7632.6',
			webpack: '4.47.0',
			terserWebpackPlugin: '1.4.6',
			npmLock: 'v1',
		},
		consent: [{ id: consent.consentId, purpose: consent.purpose, mode: 'consented' }],
		migration: {
			file: 'app/containers/LocaleToggle/index.js',
			transform: 'react-connect-to-hooks + maintained-webpack-runtime',
			edits: 5,
			dependency: { name: 'webpack', from: '4.30.0', to: '4.47.0', license: 'MIT' },
			lockPatch: 'fixtures/react-boilerplate-v4-node24/webpack-4.47.0.lock.patch',
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
			'Network controls cover spawned children and browser routing, not OS-wide process isolation.',
			'TakeNote, Angular2-HN, old Vite, and a second bundler remain unverified.',
			'Governance, certification, and authenticity remain unverified or not claimed.',
			'This receipt proves only React Boilerplate on Node 24.15.0 with webpack 4.47.0.',
		],
	};
	receipt.integrity.canonicalDigest = receiptDigest(receipt);
	parseMigrationReceipt(receipt);
	const absolute = path.resolve(receiptPath);
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, `${JSON.stringify(receipt, null, 2)}\n`);
	await writeFile(markdownPath(absolute), renderReceipt(receipt));
	const aggregate = JSON.parse(
		await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
	) as { fixtures: Array<Record<string, unknown>>; unsupported: unknown[] };
	const preserved = aggregate.fixtures.filter((item) => item.id !== manifest.id);
	preserved.push({
		id: manifest.id,
		framework: 'react',
		bundler: 'webpack-4',
		runtime: 'node-24.15.0',
		result: 'pass',
		receipt: path.relative(root, absolute),
		digest: receipt.integrity.canonicalDigest,
	});
	await writeFile(
		path.join(root, 'evidence/runs/aggregate.json'),
		`${JSON.stringify({ ...aggregate, fixtures: preserved }, null, 2)}\n`,
	);
	await verifyReceipt(absolute);
	return receipt;
}
