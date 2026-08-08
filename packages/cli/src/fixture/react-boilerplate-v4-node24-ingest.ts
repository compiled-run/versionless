import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import https from 'node:https';
import * as path from 'pathe';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { transformReactConnectToHooks } from '../../../frameworks/react/src/react-connect-to-hooks.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
export const REACT_NODE24_CONSENT = 'T022-react-node24-ingest';
export const REACT_NODE24_PURPOSE =
	'pinned webpack 4.47.0 registry metadata, archive, MIT license, required terser-webpack-plugin 1.4.6 companion, deterministic npm v1 lock delta, and offline cache population for the Node 24 maintained-runtime lane';

type Manifest = {
	id: string;
	source: Record<string, string>;
	runtime: { version: string; archiveSha256: string };
	webpack: {
		from: string;
		to: string;
		metadataUrl: string;
		archiveUrl: string;
		integrity: string;
		license: string;
		licenseSha256: string;
	};
};

function run(command: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv) {
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		const child = spawn(command, args, { cwd, env });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout?.on('data', (value: Buffer) => stdout.push(value));
		child.stderr?.on('data', (value: Buffer) => stderr.push(value));
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

function download(url: string, destination: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = https.get(url, { headers: { accept: 'application/json' } }, (response) => {
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
			const output = createWriteStream(destination);
			response.pipe(output);
			output.once('finish', () => output.close(() => resolve()));
			output.once('error', reject);
		});
		request.once('error', reject);
	});
}

function sri(content: Buffer): string {
	return `sha512-${createHash('sha512').update(content).digest('base64')}`;
}

async function exists(file: string): Promise<boolean> {
	try {
		await access(file);
		return true;
	} catch {
		return false;
	}
}

export async function ingestReactBoilerplateNode24(options: {
	allowNetwork: boolean;
	consentId?: string;
}) {
	if (
		!options.allowNetwork ||
		options.consentId !== REACT_NODE24_CONSENT ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== REACT_NODE24_CONSENT
	)
		throw new Error(`Fixture ingest requires exact consent ${REACT_NODE24_CONSENT}`);
	const manifest = JSON.parse(
		await readFile(
			path.join(root, 'fixtures/react-boilerplate-v4-node24/fixture.json'),
			'utf8',
		),
	) as Manifest;
	const cache = path.join(root, '.versionless/cache/react-boilerplate-v4-node24');
	const work = path.join(root, '.versionless/work/react-boilerplate-v4-node24');
	await rm(work, { recursive: true, force: true });
	await mkdir(cache, { recursive: true });
	await mkdir(work, { recursive: true });

	const sourceArchive = path.join(root, '.versionless/cache/react-boilerplate-v4/source.tar.gz');
	const nodeArchive = path.join(
		root,
		'.versionless/cache/angular-phonecat/node-v24.15.0-darwin-arm64.tar.gz',
	);
	if (sha256(await readFile(sourceArchive)) !== manifest.source.archiveSha256)
		throw new Error('Immutable d19099 source archive digest mismatch');
	if (sha256(await readFile(nodeArchive)) !== manifest.runtime.archiveSha256)
		throw new Error('Pinned Node 24 archive digest mismatch');
	await cp(sourceArchive, path.join(cache, 'source.tar.gz'));
	await cp(nodeArchive, path.join(cache, 'node-v24.15.0-darwin-arm64.tar.gz'));
	const metadataFile = path.join(cache, 'webpack-4.47.0.metadata.json');
	const archiveFile = path.join(cache, 'webpack-4.47.0.tgz');
	if (!(await exists(metadataFile))) await download(manifest.webpack.metadataUrl, metadataFile);
	const metadata = JSON.parse(await readFile(metadataFile, 'utf8')) as Record<string, any>;
	if (
		metadata.name !== 'webpack' ||
		metadata.version !== manifest.webpack.to ||
		metadata.license !== manifest.webpack.license ||
		metadata.dist?.tarball !== manifest.webpack.archiveUrl ||
		metadata.dist?.integrity !== manifest.webpack.integrity
	)
		throw new Error('Pinned webpack registry metadata mismatch');
	if (!(await exists(archiveFile))) await download(manifest.webpack.archiveUrl, archiveFile);
	const archive = await readFile(archiveFile);
	if (sri(archive) !== manifest.webpack.integrity)
		throw new Error('Pinned webpack archive integrity mismatch');
	const license = (await run('tar', ['-xOf', archiveFile, 'package/LICENSE'])).stdout;
	if (sha256(license) !== manifest.webpack.licenseSha256)
		throw new Error('Pinned webpack MIT license digest mismatch');

	const source = path.join(cache, 'source');
	const node24 = path.join(cache, 'node24');
	await mkdir(source, { recursive: true });
	await mkdir(node24, { recursive: true });
	await run('tar', ['-xzf', sourceArchive, '--strip-components=1', '-C', source]);
	await run('tar', ['-xzf', nodeArchive, '--strip-components=1', '-C', node24]);
	for (const [relative, expected] of [
		['LICENSE.md', manifest.source.licenseSha256],
		['app/containers/LocaleToggle/index.js', manifest.source.localeToggleSha256],
		['package.json', manifest.source.packageSha256],
		['package-lock.json', manifest.source.packageLockSha256],
	] as const)
		if (sha256(await readFile(path.join(source, relative))) !== expected)
			throw new Error(`Immutable source mismatch: ${relative}`);
	const node = path.join(node24, 'bin/node');
	if ((await run(node, ['--version'])).stdout.trim() !== 'v24.15.0')
		throw new Error('Unexpected maintained runtime');

	const target = path.join(work, 'target');
	await cp(source, target, { recursive: true });
	const localeFile = path.join(target, 'app/containers/LocaleToggle/index.js');
	const transformed = transformReactConnectToHooks(await readFile(localeFile, 'utf8'));
	await writeFile(localeFile, transformed.code);
	const packageFile = path.join(target, 'package.json');
	let packageText = await readFile(packageFile, 'utf8');
	packageText = packageText
		.replace('"react-redux": "7.0.2"', '"react-redux": "7.1.3"')
		.replace('"webpack": "4.30.0"', '"webpack": "4.47.0"')
		.replace('"terser-webpack-plugin": "1.2.3"', '"terser-webpack-plugin": "1.4.6"');
	await writeFile(packageFile, packageText);
	const t008TargetLock = path.join(
		root,
		'.versionless/work/react-boilerplate-v4/target/package-lock.json',
	);
	if (
		sha256(await readFile(t008TargetLock)) !==
		'8af43b5f48d0c64f67c518a216a7d98571b1498c835ebb234d6dda845a988d33'
	)
		throw new Error('Verified T008 React-Redux target lock baseline mismatch');
	await cp(t008TargetLock, path.join(target, 'package-lock.json'));
	const beforeWebpack = await readFile(path.join(target, 'package-lock.json'), 'utf8');
	const bin = path.join(node24, 'bin');
	const npm = path.join(bin, 'npm');
	const npmCache = path.join(cache, 'npm-cache');
	const env = {
		...process.env,
		PATH: `${bin}:${process.env.PATH ?? ''}`,
		NPM_CONFIG_CACHE: npmCache,
		npm_config_cache: npmCache,
	};
	await run(
		npm,
		[
			'install',
			'--package-lock-only',
			'--lockfile-version=1',
			'--ignore-scripts',
			'--no-audit',
			'--no-fund',
		],
		target,
		env,
	);
	const targetLock = path.join(target, 'package-lock.json');
	const afterWebpack = await readFile(targetLock, 'utf8');
	if (beforeWebpack === afterWebpack) throw new Error('Webpack lock update was empty');
	const beforeFile = path.join(cache, 'package-lock.webpack-4.30.0.json');
	await writeFile(beforeFile, beforeWebpack);
	const delta = await run('diff', [
		'-u',
		'--label',
		'package-lock.webpack-4.30.0.json',
		'--label',
		'package-lock.webpack-4.47.0.json',
		beforeFile,
		targetLock,
	]).catch((error: Error & { result?: { stdout: string } }) => {
		if (error.message.includes('exited 1') && error.result) return error.result;
		throw error;
	});
	await writeFile(
		path.join(root, 'fixtures/react-boilerplate-v4-node24/webpack-4.47.0.lock.patch'),
		delta.stdout,
	);
	await run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], target, env);
	const consent = {
		consentId: options.consentId,
		networkMode: 'consented' as const,
		purpose: REACT_NODE24_PURPOSE,
		source: {
			revision: manifest.source.revision,
			archiveSha256: manifest.source.archiveSha256,
		},
		runtime: { version: '24.15.0', archiveSha256: manifest.runtime.archiveSha256 },
		webpack: {
			version: manifest.webpack.to,
			registryMetadataSha256: sha256(await readFile(metadataFile)),
			archiveSha256: sha256(archive),
			integrity: manifest.webpack.integrity,
			license: manifest.webpack.license,
			licenseSha256: manifest.webpack.licenseSha256,
		},
		bundlerCompanion: {
			name: 'terser-webpack-plugin',
			from: '1.2.3',
			to: '1.4.6',
			reason: 'directly invoked 1.2.3 cache hashing requests OpenSSL MD4',
		},
		lock: {
			beforeSha256: sha256(beforeWebpack),
			afterSha256: sha256(afterWebpack),
			patchSha256: sha256(delta.stdout),
			format: 'npm-package-lock-v1',
		},
	};
	await writeFile(path.join(cache, 'consent.json'), `${JSON.stringify(consent, null, 2)}\n`);
	return { manifest, transformed, consent };
}
