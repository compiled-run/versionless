import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import https from 'node:https';
import * as path from 'pathe';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { transformReactConnectToHooks } from '../../../frameworks/react/src/react-connect-to-hooks.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
type FixtureManifest = {
	id: string;
	source: {
		archiveUrl: string;
		archiveSha256: string;
		licenseSha256: string;
		localeToggleSha256: string;
		packageSha256: string;
		packageLockSha256: string;
	};
	runtime: { url: string; sha256: string };
	targetDependency: { archiveUrl: string; archiveSha256: string; licenseSha256: string };
};
type Download = readonly [url: string, file: string, sha256: string];

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
		child.stdout?.on('data', (v: Buffer) => stdout.push(v));
		child.stderr?.on('data', (v: Buffer) => stderr.push(v));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) })
				: reject(
						new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString()}`),
					),
		);
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

function replaceExact(source: string, before: string, after: string, label: string): string {
	const first = source.indexOf(before);
	if (first < 0 || source.indexOf(before, first + 1) >= 0)
		throw new Error(`Refused deterministic patch: ${label}`);
	return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

export async function ingestFixture(options: { allowNetwork: boolean; consentId?: string }) {
	const { allowNetwork, consentId } = options;
	if (
		!allowNetwork ||
		consentId !== 'T008-fixture-ingest' ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== consentId
	)
		throw new Error('Fixture ingest requires explicit consent T008-fixture-ingest');
	const manifest = JSON.parse(
		await readFile(path.join(root, 'fixtures/react-boilerplate-v4/fixture.json'), 'utf8'),
	) as FixtureManifest;
	const cache = path.join(root, '.versionless/cache/react-boilerplate-v4');
	const work = path.join(root, '.versionless/work/react-boilerplate-v4');
	await mkdir(cache, { recursive: true });
	const downloads: Download[] = [
		[
			manifest.source.archiveUrl,
			path.join(cache, 'source.tar.gz'),
			manifest.source.archiveSha256,
		],
		[
			manifest.runtime.url,
			path.join(cache, 'node-v16.20.2-darwin-arm64.tar.gz'),
			manifest.runtime.sha256,
		],
		[
			manifest.targetDependency.archiveUrl,
			path.join(cache, 'react-redux-7.1.3.tgz'),
			manifest.targetDependency.archiveSha256,
		],
	];
	for (const [url, file, expected] of downloads) {
		if (!(await exists(file))) await download(url, file);
		const actual = sha256(await readFile(file));
		if (actual !== expected) throw new Error(`Integrity mismatch for ${url}: ${actual}`);
	}
	const sourceCache = path.join(cache, 'source');
	const nodeCache = path.join(cache, 'node16');
	await rm(sourceCache, { recursive: true, force: true });
	await rm(nodeCache, { recursive: true, force: true });
	await mkdir(sourceCache, { recursive: true });
	await mkdir(nodeCache, { recursive: true });
	await run('tar', ['-xzf', downloads[0][1], '--strip-components=1', '-C', sourceCache]);
	await run('tar', ['-xzf', downloads[1][1], '--strip-components=1', '-C', nodeCache]);
	const checks: ReadonlyArray<readonly [string, string]> = [
		['LICENSE.md', manifest.source.licenseSha256],
		['app/containers/LocaleToggle/index.js', manifest.source.localeToggleSha256],
		['package.json', manifest.source.packageSha256],
		['package-lock.json', manifest.source.packageLockSha256],
	];
	for (const [relative, expected] of checks) {
		const actual = sha256(await readFile(path.join(sourceCache, relative)));
		if (actual !== expected) throw new Error(`Upstream ${relative} mismatch: ${actual}`);
	}
	const license = (await run('tar', ['-xOf', downloads[2][1], 'package/LICENSE.md'])).stdout;
	if (sha256(license) !== manifest.targetDependency.licenseSha256)
		throw new Error('react-redux 7.1.3 license mismatch');
	const node = path.join(nodeCache, 'bin/node');
	const version = (await run(node, ['--version'])).stdout.toString().trim();
	if (version !== 'v16.20.2') throw new Error(`Unexpected Node runtime ${version}`);
	await rm(work, { recursive: true, force: true });
	await mkdir(work, { recursive: true });
	const legacy = path.join(work, 'legacy');
	const target = path.join(work, 'target');
	await cp(sourceCache, legacy, { recursive: true });
	await cp(sourceCache, target, { recursive: true });
	const locale = path.join(target, 'app/containers/LocaleToggle/index.js');
	const transformed = transformReactConnectToHooks(await readFile(locale, 'utf8'));
	await writeFile(locale, transformed.code);
	const packageFile = path.join(target, 'package.json');
	const packageSource = await readFile(packageFile, 'utf8');
	const packageTarget = packageSource.replace('"react-redux": "7.0.2"', '"react-redux": "7.1.3"');
	if (packageTarget === packageSource) throw new Error('Refused package patch');
	await writeFile(packageFile, packageTarget);
	const lockFile = path.join(target, 'package-lock.json');
	const lockSource = await readFile(lockFile, 'utf8');
	const oldEntry = `    "react-redux": {
      "version": "7.0.2",
      "resolved": "https://registry.npmjs.org/react-redux/-/react-redux-7.0.2.tgz",
      "integrity": "sha512-uKRuMgQt8dWbcz0U75oFK5tDo3boyAKrqvf/j94vpqRFFZfyDDy4kofUgloFIGyuKTq2Zz51zgK9RzOTFXk5ew==",
      "requires": {
        "@babel/runtime": "^7.4.3",
        "hoist-non-react-statics": "^3.3.0",
        "invariant": "^2.2.4",
        "loose-envify": "^1.4.0",
        "prop-types": "^15.7.2",
        "react-is": "^16.8.6"
      },
      "dependencies": {
        "@babel/runtime": {
          "version": "7.4.3",
          "resolved": "https://registry.npmjs.org/@babel/runtime/-/runtime-7.4.3.tgz",
          "integrity": "sha512-9lsJwJLxDh/T3Q3SZszfWOTkk3pHbkmH+3KY+zwIDmsNlxsumuhS2TH3NIpktU4kNvfzy+k3eLT7aTJSPTo0OA==",
          "requires": {
            "regenerator-runtime": "^0.13.2"
          }
        },
        "regenerator-runtime": {
          "version": "0.13.2",
          "resolved": "https://registry.npmjs.org/regenerator-runtime/-/regenerator-runtime-0.13.2.tgz",
          "integrity": "sha512-S/TQAZJO+D3m9xeN1WTI8dLKBBiRgXBlTJvbWjCThHWZj9EvHK70Ff50/tYj2J/fvBY6JtFVwRuazHN2E7M9BA=="
        }
      }
    },`;
	const newEntry = `    "react-redux": {
      "version": "7.1.3",
      "resolved": "https://registry.npmjs.org/react-redux/-/react-redux-7.1.3.tgz",
      "integrity": "sha512-uI1wca+ECG9RoVkWQFF4jDMqmaw0/qnvaSvOoL/GA4dNxf6LoV8sUAcNDvE5NWKs4hFpn0t6wswNQnY3f7HT3w==",
      "requires": {
        "@babel/runtime": "^7.5.5",
        "hoist-non-react-statics": "^3.3.0",
        "invariant": "^2.2.4",
        "loose-envify": "^1.4.0",
        "prop-types": "^15.7.2",
        "react-is": "^16.9.0"
      },
      "dependencies": {
        "@babel/runtime": {
          "version": "7.5.5",
          "resolved": "https://registry.npmjs.org/@babel/runtime/-/runtime-7.5.5.tgz",
          "integrity": "sha512-28QvEGyQyNkB0/m2B4FU7IEZGK2NUrcMtT6BZEFALTguLk+AUT6ofsHtPk5QyjAdUkpMJ+/Em+quwz4HOt30AQ==",
          "requires": {
            "regenerator-runtime": "^0.13.2"
          }
        },
        "react-is": {
          "version": "16.9.0",
          "resolved": "https://registry.npmjs.org/react-is/-/react-is-16.9.0.tgz",
          "integrity": "sha512-tJBzzzIgnnRfEm046qRcURvwQnZVXmuCbscxUO5RWrGTXpon2d4c8mI0D8WE6ydVIm29JiLB6+RslkIvym9Rjw=="
        },
        "regenerator-runtime": {
          "version": "0.13.3",
          "resolved": "https://registry.npmjs.org/regenerator-runtime/-/regenerator-runtime-0.13.3.tgz",
          "integrity": "sha512-naKIZz2GQ8JWh///G7L3X6LaQUAMp2lvb1rvwwsURe/VXwD6VMfr+/1NuNw3ag8v2kY1aQ/go5SNn79O9JU7yw=="
        }
      }
    },`;
	await writeFile(
		lockFile,
		replaceExact(lockSource, oldEntry, newEntry, 'package-lock react-redux entry'),
	);
	const nodeBin = path.join(nodeCache, 'bin');
	const npmCache = path.join(cache, 'npm-cache');
	const env = {
		...process.env,
		PATH: `${nodeBin}:${process.env.PATH ?? ''}`,
		npm_config_cache: npmCache,
		NPM_CONFIG_CACHE: npmCache,
	};
	for (const lane of [legacy, target])
		await run(
			path.join(nodeBin, 'npm'),
			['ci', '--ignore-scripts', '--no-audit', '--no-fund'],
			{ cwd: lane, env, stdio: 'inherit' },
		);
	const consent = {
		consentId,
		networkMode: 'consented' as const,
		purpose:
			'immutable fixture, EOL Node 16 compatibility sandbox, target dependency, and locked npm population; lifecycle scripts disabled uniformly because optional ngrok@3.1.1 rejects darwin-arm64',
		cache: path.relative(root, cache),
		downloads: downloads.map(([url, file, hash]) => ({
			url,
			path: path.relative(root, file),
			sha256: hash,
		})),
		sourceChecks: Object.fromEntries(checks),
	};
	await writeFile(path.join(cache, 'consent.json'), `${JSON.stringify(consent, null, 2)}\n`);
	return { manifest, transformed, consent };
}
