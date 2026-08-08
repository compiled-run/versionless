import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import https from 'node:https';
import * as path from 'pathe';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { transformPhoneDetailLexicalThis } from '../../../frameworks/angularjs/src/phone-detail-lexical-this.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
export const ANGULAR_PHONECAT_INGEST_PURPOSE =
	'pinned PhoneCat source and Node 16/24 runtimes plus frozen lockfile population; lifecycle scripts disabled and copy-libs invoked explicitly and identically';
type Runtime = { version: string; npm?: string; url: string; sha256: string };
type Manifest = {
	id: string;
	track: 'angularjs-special-track';
	source: {
		archiveUrl: string;
		archiveSha256: string;
		licenseSha256: string;
		packageSha256: string;
		packageLockSha256: string;
		phoneDetailSha256: string;
	};
	runtimes: { legacy: Runtime; target: Runtime };
	browser: { executable: string; sha256: string };
};

async function exists(file: string): Promise<boolean> {
	try {
		await stat(file);
		return true;
	} catch {
		return false;
	}
}

function run(
	command: string,
	args: string[],
	options: { cwd?: string; env?: NodeJS.ProcessEnv; stdio?: 'inherit' | 'pipe' } = {},
): Promise<{ stdout: Buffer; stderr: Buffer }> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { ...options, stdio: options.stdio ?? 'pipe' });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout?.on('data', (value: Buffer) => stdout.push(value));
		child.stderr?.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) => {
			const result = { stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) };
			if (code === 0) resolve(result);
			else reject(new Error(`${command} exited ${code}: ${result.stderr.toString()}`));
		});
	});
}

function download(url: string, destination: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = https.get(url, (response) => {
			if (
				(response.statusCode ?? 0) >= 300 &&
				(response.statusCode ?? 0) < 400 &&
				response.headers.location
			) {
				response.resume();
				download(response.headers.location, destination).then(resolve, reject);
				return;
			}
			if (response.statusCode !== 200) {
				response.resume();
				reject(new Error(`Download failed (${response.statusCode}): ${url}`));
				return;
			}
			const output = createWriteStream(destination, { flags: 'wx' });
			response.pipe(output);
			output.once('finish', () => output.close(() => resolve()));
			output.once('error', reject);
		});
		request.once('error', reject);
	});
}

export async function ingestAngularPhonecat(options: {
	allowNetwork: boolean;
	consentId?: string;
}) {
	const { allowNetwork, consentId } = options;
	if (
		!allowNetwork ||
		!consentId?.trim() ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== consentId
	)
		throw new Error(
			'Fixture ingest requires allowNetwork, a non-empty consent ID, consented network mode, and exact CLI/environment consent ID equality',
		);
	const manifest = JSON.parse(
		await readFile(path.join(root, 'fixtures/angular-phonecat/fixture.json'), 'utf8'),
	) as Manifest;
	const cache = path.join(root, '.versionless/cache/angular-phonecat');
	const work = path.join(root, '.versionless/work/angular-phonecat');
	await mkdir(cache, { recursive: true });
	const downloads = [
		[
			manifest.source.archiveUrl,
			path.join(cache, 'source.tar.gz'),
			manifest.source.archiveSha256,
		],
		[
			manifest.runtimes.legacy.url,
			path.join(cache, 'node-v16.20.2-darwin-arm64.tar.gz'),
			manifest.runtimes.legacy.sha256,
		],
		[
			manifest.runtimes.target.url,
			path.join(cache, 'node-v24.15.0-darwin-arm64.tar.gz'),
			manifest.runtimes.target.sha256,
		],
	] as const;
	for (const [url, file, expected] of downloads) {
		if (!(await exists(file))) await download(url, file);
		const actual = sha256(await readFile(file));
		if (actual !== expected) throw new Error(`Integrity mismatch for ${url}: ${actual}`);
	}
	const browser = path.resolve(root, manifest.browser.executable);
	const browserHash = sha256(await readFile(browser));
	if (browserHash !== manifest.browser.sha256)
		throw new Error(`Cached Chromium integrity mismatch: ${browserHash}`);

	const sourceCache = path.join(cache, 'source');
	const node16 = path.join(cache, 'node16');
	const node24 = path.join(cache, 'node24');
	for (const directory of [sourceCache, node16, node24]) {
		await rm(directory, { recursive: true, force: true });
		await mkdir(directory, { recursive: true });
	}
	await run('tar', ['-xzf', downloads[0][1], '--strip-components=1', '-C', sourceCache]);
	await run('tar', ['-xzf', downloads[1][1], '--strip-components=1', '-C', node16]);
	await run('tar', ['-xzf', downloads[2][1], '--strip-components=1', '-C', node24]);
	const sourceChecks = [
		['LICENSE', manifest.source.licenseSha256],
		['package.json', manifest.source.packageSha256],
		['package-lock.json', manifest.source.packageLockSha256],
		['app/phone-detail/phone-detail.component.js', manifest.source.phoneDetailSha256],
	] as const;
	for (const [relative, expected] of sourceChecks) {
		const actual = sha256(await readFile(path.join(sourceCache, relative)));
		if (actual !== expected) throw new Error(`Upstream ${relative} mismatch: ${actual}`);
	}
	const versions = await Promise.all(
		(
			[
				[node16, 'v16.20.2'],
				[node24, 'v24.15.0'],
			] as const satisfies ReadonlyArray<readonly [string, string]>
		).map(async ([directory, expected]) => {
			const actual = (await run(path.join(directory, 'bin/node'), ['--version'])).stdout
				.toString()
				.trim();
			if (actual !== expected) throw new Error(`Unexpected Node runtime ${actual}`);
			return actual;
		}),
	);
	const npm16 = (
		await run(path.join(node16, 'bin/npm'), ['--version'], {
			env: { ...process.env, PATH: `${path.join(node16, 'bin')}:${process.env.PATH ?? ''}` },
		})
	).stdout
		.toString()
		.trim();
	if (npm16 !== '8.19.4') throw new Error(`Unexpected legacy npm ${npm16}`);

	await rm(work, { recursive: true, force: true });
	await mkdir(work, { recursive: true });
	const legacy = path.join(work, 'legacy');
	const target = path.join(work, 'target');
	await cp(sourceCache, legacy, { recursive: true });
	await cp(sourceCache, target, { recursive: true });
	const targetSource = path.join(target, 'app/phone-detail/phone-detail.component.js');
	const transformed = transformPhoneDetailLexicalThis(await readFile(targetSource, 'utf8'));
	await writeFile(targetSource, transformed.code);

	const prepare = async (lane: string, runtime: string) => {
		const bin = path.join(runtime, 'bin');
		const npm = path.join(bin, 'npm');
		const env = {
			...process.env,
			PATH: `${bin}:${process.env.PATH ?? ''}`,
			NPM_CONFIG_CACHE: path.join(cache, 'npm-cache'),
			npm_config_cache: path.join(cache, 'npm-cache'),
		};
		await run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
			cwd: lane,
			env,
			stdio: 'inherit',
		});
		await run(npm, ['run', 'copy-libs', '--ignore-scripts'], {
			cwd: lane,
			env,
			stdio: 'inherit',
		});
	};
	await prepare(legacy, node16);
	await prepare(target, node24);
	const consent = {
		consentId,
		networkMode: 'consented' as const,
		purpose: ANGULAR_PHONECAT_INGEST_PURPOSE,
		cache: path.relative(root, cache),
		downloads: downloads.map(([url, file, hash]) => ({
			url,
			path: path.relative(root, file),
			sha256: hash,
		})),
		sourceChecks: Object.fromEntries(sourceChecks),
		browser: { path: manifest.browser.executable, sha256: browserHash },
		versions,
		legacyNpm: npm16,
		preparation: [
			'npm ci --ignore-scripts --no-audit --no-fund',
			'npm run copy-libs --ignore-scripts',
		],
	};
	await writeFile(path.join(cache, 'consent.json'), `${JSON.stringify(consent, null, 2)}\n`);
	return { manifest, transformed, consent };
}
