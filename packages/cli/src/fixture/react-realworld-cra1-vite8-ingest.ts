import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	access,
	cp,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { char, createRegExp, exactly } from 'magic-regexp';
import os from 'node:os';
import * as path from 'pathe';
import { joinURL, parseURL } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const REALWORLD_CONSENT_ID = 'T036-react-realworld-license-md-ingest';
export const REALWORLD_INGEST_PURPOSE =
	'one-time immutable React RealWorld ee72eba4056392c95a27bc48d385d3f54ba38a18 archive, LICENSE.md, and package verification plus deterministic generated-lock/npm-cache population; upstream lockfile explicitly absent; supersedes exhausted T034 license-path attempt';

const root = path.resolve(import.meta.dirname, '../../../..');
const fixtureFile = path.join(root, 'fixtures/react-realworld-cra1-vite8/fixture.json');
const cache = path.join(root, '.versionless/cache/react-realworld-cra1-vite8');
const node16 = path.join(root, '.versionless/cache/angular-phonecat/node16');
const expectedArchiveSha256 = '67a0375d948c250a0e7d79c9024327239a223ee84c66111aae132b11144f932f';
const expectedLicenseSha256 = '3bc29327b728ee0729f65d5b7261a7445f4a44fd7fd09462883b19e42c34caa4';
const expectedPackageSha256 = 'ff5a67b34128a8d69ec6efe8560746dd14a668fdcad2074941abb48435dfe6bd';
const expectedLicenseBlobSha1 = '006edc881dcf9d25ae4ca05f4ccf9f630482f5ef';
const expectedArchiveRoot =
	'react-redux-realworld-example-app-ee72eba4056392c95a27bc48d385d3f54ba38a18';
const extractedDirectory = createRegExp(
	exactly('react-redux-realworld-example-app-').at.lineStart().and(char.times.any()).at.lineEnd(),
);

async function exists(file: string): Promise<boolean> {
	try {
		await access(file);
		return true;
	} catch {
		return false;
	}
}

function execute(command: string, args: string[], cwd: string, environment: NodeJS.ProcessEnv) {
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		const child = spawn(command, args, { cwd, env: environment });
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
			else reject(new Error(`${command} exited ${code}: ${result.stderr}`));
		});
	});
}

async function download(url: string): Promise<Buffer> {
	const parsed = parseURL(url);
	if (parsed.protocol !== 'https:') throw new Error('Ingest source must use HTTPS');
	const response = await fetch(url, { redirect: 'follow' });
	if (!response.ok) throw new Error(`Ingest source failed: ${response.status} ${url}`);
	return Buffer.from(await response.arrayBuffer());
}

function registryRows(lock: Record<string, any>) {
	const rows = (Object.entries(lock.packages ?? {}) as Array<[string, Record<string, any>]>)
		.filter(([key, value]) => key && value && typeof value === 'object')
		.map(([key, value]) => {
			if (!value.version || !value.resolved || !value.integrity)
				throw new Error(`Generated lock entry lacks registry integrity: ${key}`);
			const registry = parseURL(value.resolved);
			if (registry.protocol !== 'https:' || registry.host !== 'registry.npmjs.org')
				throw new Error(`Generated lock entry is not registry-only: ${key}`);
			return {
				path: key,
				version: value.version,
				resolved: value.resolved,
				integrity: value.integrity,
			};
		})
		.sort((left, right) => left.path.localeCompare(right.path));
	if (!rows.length) throw new Error('Generated lock registry closure is empty');
	return rows;
}

export async function ingestReactRealworld({
	allowNetwork,
	consentId,
}: {
	allowNetwork: boolean;
	consentId?: string;
}) {
	if (
		!allowNetwork ||
		consentId !== REALWORLD_CONSENT_ID ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== REALWORLD_CONSENT_ID
	)
		throw new Error('React RealWorld ingest requires exact purpose-bound consent');
	const manifest = JSON.parse(await readFile(fixtureFile, 'utf8')) as Record<string, any>;
	const originalFixture = await readFile(fixtureFile);
	const expectedArchive = joinURL(
		manifest.source.repository,
		'archive',
		`${manifest.source.revision}.tar.gz`,
	);
	if (manifest.source.archiveUrl !== expectedArchive)
		throw new Error('React RealWorld archive attribution mismatch');
	await rm(cache, { recursive: true, force: true });
	const staging = await mkdtemp(path.join(os.tmpdir(), 'versionless-t036-realworld-'));
	let committed = false;
	try {
		const [archive, independentLicense] = await Promise.all([
			download(manifest.source.archiveUrl),
			download(manifest.source.licenseUrl),
		]);
		if (sha256(archive) !== expectedArchiveSha256)
			throw new Error('React RealWorld archive SHA-256 mismatch');
		if (
			sha256(independentLicense) !== expectedLicenseSha256 ||
			independentLicense.byteLength !== 1_068 ||
			independentLicense.at(-1) !== 10
		)
			throw new Error('React RealWorld LICENSE.md bytes mismatch');
		const blobPrefix = Buffer.from(`blob ${independentLicense.byteLength}\0`);
		if (
			createHash('sha1').update(blobPrefix).update(independentLicense).digest('hex') !==
			expectedLicenseBlobSha1
		)
			throw new Error('React RealWorld LICENSE.md Git blob mismatch');
		const licenseText = independentLicense.toString('utf8');
		if (
			!licenseText.includes('MIT License') ||
			!licenseText.includes('Copyright (c) 2020 GoThinkster')
		)
			throw new Error('React RealWorld LICENSE.md attribution mismatch');
		const archiveFile = path.join(staging, 'source.tar.gz');
		const extractRoot = path.join(staging, 'extract');
		await writeFile(archiveFile, archive);
		await mkdir(extractRoot, { recursive: true });
		await execute('tar', ['-xzf', archiveFile, '-C', extractRoot], root, process.env);
		const entries = await readdir(extractRoot, { withFileTypes: true });
		const directory = entries.find(
			(entry) =>
				entry.isDirectory() &&
				extractedDirectory.test(entry.name) &&
				entry.name === expectedArchiveRoot,
		);
		if (!directory || entries.filter((entry) => entry.isDirectory()).length !== 1)
			throw new Error('React RealWorld exact archive root mismatch');
		const extracted = path.join(extractRoot, directory.name);
		const sourceLicense = await readFile(path.join(extracted, 'LICENSE.md'));
		if (!sourceLicense.equals(independentLicense))
			throw new Error('Archive and independently fetched LICENSE.md differ');
		for (const lockName of ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock'])
			if (await exists(path.join(extracted, lockName)))
				throw new Error(`Expected absent upstream lock, found ${lockName}`);
		const packageBytes = await readFile(path.join(extracted, 'package.json'));
		if (sha256(packageBytes) !== expectedPackageSha256)
			throw new Error('React RealWorld package.json SHA-256 mismatch');
		const packageValue = JSON.parse(packageBytes.toString()) as Record<string, any>;
		if (packageValue.dependencies?.['react-scripts'] !== '1.1.1')
			throw new Error('Pinned legacy react-scripts 1.1.1 dependency missing');
		const source = path.join(staging, 'source');
		await cp(extracted, source, { recursive: true });
		await rm(extractRoot, { recursive: true, force: true });

		const lockWork = path.join(staging, 'generated-lock-work');
		await cp(source, lockWork, { recursive: true });
		const npmCache = path.join(staging, 'npm-cache');
		const environment = {
			...process.env,
			PATH: `${path.join(node16, 'bin')}:${process.env.PATH ?? ''}`,
			VERSIONLESS_NETWORK_MODE: 'consented',
			VERSIONLESS_CONSENT_ID: REALWORLD_CONSENT_ID,
			NPM_CONFIG_CACHE: npmCache,
			npm_config_cache: npmCache,
		};
		const npm = path.join(node16, 'bin/npm');
		await execute(
			npm,
			['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=true'],
			lockWork,
			environment,
		);
		const generatedLock = await readFile(path.join(lockWork, 'package-lock.json'));
		const generatedLockValue = JSON.parse(generatedLock.toString()) as Record<string, any>;
		const rows = registryRows(generatedLockValue);
		await writeFile(path.join(staging, 'generated-package-lock.json'), generatedLock);
		await rm(path.join(lockWork, 'node_modules'), { recursive: true, force: true });
		const offlineEnvironment = {
			...environment,
			VERSIONLESS_NETWORK_MODE: 'offline',
			NPM_CONFIG_OFFLINE: 'true',
			npm_config_offline: 'true',
		};
		for (let replay = 1; replay <= 2; replay++) {
			await rm(path.join(lockWork, 'node_modules'), { recursive: true, force: true });
			await execute(
				npm,
				['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'],
				lockWork,
				offlineEnvironment,
			);
			if (
				sha256(await readFile(path.join(lockWork, 'package-lock.json'))) !==
				sha256(generatedLock)
			)
				throw new Error(`Offline generated-lock replay ${replay} mutated lock bytes`);
		}
		await rm(path.join(lockWork, 'node_modules'), { recursive: true, force: true });
		const provenance = {
			schemaVersion: 'versionless.generated-npm-lock.v1',
			upstreamLock: 'absent',
			upstreamReproducibility: 'not-established',
			generatedBy: 'npm 8.19.4 under Node 16.20.2 darwin-arm64',
			generatedLockSha256: sha256(generatedLock),
			registryEntries: rows.length,
			registryClosureSha256: sha256(canonicalize(rows)),
			entries: rows,
			offlineCleanInstallReplays: 2,
		};
		await writeFile(
			path.join(staging, 'generated-lock-provenance.json'),
			`${JSON.stringify(provenance, null, 2)}\n`,
		);
		const consent = {
			schemaVersion: 'versionless.consent.v1',
			consentId: REALWORLD_CONSENT_ID,
			purpose: REALWORLD_INGEST_PURPOSE,
			networkMode: 'consented',
			sources: [
				{ url: manifest.source.archiveUrl, sha256: sha256(archive) },
				{ url: manifest.source.licenseUrl, sha256: sha256(independentLicense) },
				{
					kind: 'npm-generated-lock-and-cache',
					registryEntries: rows.length,
					closureSha256: provenance.registryClosureSha256,
				},
			],
			limitations: [
				'No upstream lockfile exists at the pinned revision.',
				'The npm lock is Versionless-generated evidence and is not original project evidence.',
				'Upstream dependency reproducibility is not established.',
			],
		};
		await writeFile(
			path.join(staging, 'consent.json'),
			`${JSON.stringify(consent, null, 2)}\n`,
		);
		manifest.generatedLock = {
			sha256: sha256(generatedLock),
			registryEntries: rows.length,
			registryClosureSha256: provenance.registryClosureSha256,
			provenance:
				'.versionless/cache/react-realworld-cra1-vite8/generated-lock-provenance.json',
		};
		await rm(lockWork, { recursive: true, force: true });
		await rename(staging, cache);
		try {
			await writeFile(fixtureFile, `${JSON.stringify(manifest, null, 2)}\n`);
		} catch (error) {
			await rm(cache, { recursive: true, force: true });
			await writeFile(fixtureFile, originalFixture);
			throw error;
		}
		committed = true;
		return { manifest, consent };
	} finally {
		if (!committed) {
			await rm(staging, { recursive: true, force: true });
			await rm(cache, { recursive: true, force: true });
		}
	}
}
