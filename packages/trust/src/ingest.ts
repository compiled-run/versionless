import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonicalize, sha256 } from '../../core/src/receipts/canonicalize.ts';
import {
	CISA_KEV_URL,
	OSV_BATCH_URL,
	TRUST_PURPOSE,
	TRUST_SCHEMA,
	type PackageCoordinate,
	type TrustIngestRecord,
	packageVersionWithoutPeerContext,
	validatePackageCoordinates,
} from './schema.ts';

export interface IngestTrustOptions {
	rootDir?: string;
	cacheDir?: string;
	allowNetwork: boolean;
	consentId?: string;
	environment?: NodeJS.ProcessEnv;
	fetcher?: typeof fetch;
	observedAt?: string;
}

function unquote(value: string): string {
	const first = value[0];
	const last = value.at(-1);
	if (first === "'" || first === '"') {
		if (last !== first || value.length < 3) throw new Error('Malformed quoted package key');
		return value.slice(1, -1);
	}
	if (last === "'" || last === '"') throw new Error('Malformed quoted package key');
	return value;
}

function splitPackageKey(key: string): PackageCoordinate {
	const slash = key.startsWith('@') ? key.indexOf('/') : -1;
	const split = key.startsWith('@') ? key.indexOf('@', slash + 1) : key.indexOf('@');
	if (split <= 0) throw new Error(`Malformed pnpm package coordinate: ${key}`);
	return { name: key.slice(0, split), version: key.slice(split + 1) };
}

export function lockPackages(lock: string): PackageCoordinate[] {
	const lines = lock.replaceAll('\r\n', '\n').split('\n');
	const section = lines.findIndex((line) => line === 'packages:');
	if (section < 0 || lines.indexOf('packages:', section + 1) >= 0)
		throw new Error('pnpm lockfile must have exactly one packages section');
	const packages: PackageCoordinate[] = [];
	for (let index = section + 1; index < lines.length; index++) {
		const line = lines[index] ?? '';
		if (line && !line.startsWith(' ')) break;
		if (!line.startsWith('  ') || line.startsWith('   ')) continue;
		if (!line.endsWith(':')) throw new Error(`Malformed top-level pnpm package entry: ${line}`);
		const packageKey = line.slice(2, -1);
		if (!packageKey || packageKey.trimStart() !== packageKey)
			throw new Error(`Malformed top-level pnpm package entry: ${line}`);
		packages.push(splitPackageKey(unquote(packageKey)));
	}
	return validatePackageCoordinates(
		packages.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`)),
		'pnpm packages',
	);
}

export function osvRequest(packages: PackageCoordinate[]): string {
	const coordinates = validatePackageCoordinates(packages, 'OSV request packages');
	return canonicalize({
		queries: coordinates.map(({ name, version }) => ({
			package: { ecosystem: 'npm', name },
			version: packageVersionWithoutPeerContext(version),
		})),
	});
}

async function responseText(response: Response, label: string): Promise<string> {
	if (!response.ok) throw new Error(`${label} request failed with HTTP ${response.status}`);
	const text = await response.text();
	JSON.parse(text);
	return text;
}

export async function ingestTrustInputs(options: IngestTrustOptions): Promise<TrustIngestRecord> {
	const environment = options.environment ?? process.env;
	const consentId = options.consentId?.trim();
	if (!options.allowNetwork) throw new Error('Trust ingest requires --allow-network');
	if (environment.VERSIONLESS_NETWORK_MODE !== 'consented')
		throw new Error('Trust ingest requires VERSIONLESS_NETWORK_MODE=consented');
	if (!consentId) throw new Error('Trust ingest requires a non-empty consent ID');
	if (environment.VERSIONLESS_CONSENT_ID !== consentId)
		throw new Error('CLI consent ID must exactly match VERSIONLESS_CONSENT_ID');

	const rootDir = path.resolve(options.rootDir ?? '.');
	const cacheDir = path.resolve(rootDir, options.cacheDir ?? '.versionless/cache/trust');
	const packages = lockPackages(await readFile(path.join(rootDir, 'pnpm-lock.yaml'), 'utf8'));
	const request = osvRequest(packages);
	const fetcher = options.fetcher ?? fetch;
	const osvText = await responseText(
		await fetcher(OSV_BATCH_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: request,
		}),
		'OSV batch',
	);
	const kevText = await responseText(await fetcher(CISA_KEV_URL), 'CISA KEV');
	const observedAt = options.observedAt ?? new Date().toISOString();
	await mkdir(cacheDir, { recursive: true });
	await writeFile(path.join(cacheDir, 'osv.json'), osvText);
	await writeFile(path.join(cacheDir, 'cisa-kev.json'), kevText);
	const record: TrustIngestRecord = {
		schemaVersion: TRUST_SCHEMA,
		purpose: TRUST_PURPOSE,
		consent: { allowNetwork: true, mode: 'consented', consentId },
		packages,
		sources: [
			{
				kind: 'osv-batch',
				url: OSV_BATCH_URL,
				method: 'POST',
				observedAt,
				requestSha256: sha256(request),
				responsePath: 'osv.json',
				sha256: sha256(osvText),
			},
			{
				kind: 'cisa-kev',
				url: CISA_KEV_URL,
				method: 'GET',
				observedAt,
				responsePath: 'cisa-kev.json',
				sha256: sha256(kevText),
			},
		],
	};
	await writeFile(path.join(cacheDir, 'ingest.json'), `${JSON.stringify(record, null, 2)}\n`);
	return record;
}
