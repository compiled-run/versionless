import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalize } from '../../core/src/index.ts';
import {
	createDashboardContactsPreflightReceipt,
	publishDashboardContactsPreflight,
	verifyDashboardContactsPreflight,
} from '../src/fixture/dashboard-contacts-dependency-preflight.ts';

const temporary: string[] = [];

afterEach(async () => {
	for (const target of temporary.splice(0)) await rm(target, { recursive: true, force: true });
});

describe('Dashboard/Contacts dependency acquisition preflight', () => {
	it('proves the exact immutable offline closure and preserves blocking evidence', async () => {
		const receipt = await createDashboardContactsPreflightReceipt();
		expect(receipt.result).toBe('not-ready');
		expect(receipt.closure).toEqual({
			pairs: 2_213,
			urls: 2_165,
			sha512OnlyUrls: 1_815,
			legacySha1OnlyUrls: 302,
			dualSriUrls: 48,
			cachedUrls: 667,
			missingUrls: 1_498,
			missingLegacySha1OnlyUrls: 55,
			rowSetSha256: '02f6522dc9cae9939a9b5c1adf7bb4af56aa9967e564a10d11ac3e960c102e61',
		});
		expect(receipt.cacheAudit.cached).toHaveLength(667);
		expect(receipt.cacheAudit.missing).toHaveLength(1_498);
		expect(receipt.metadataSummary.licenseEmptyIdentities).toEqual([
			'better-assert@1.0.2',
			'callsite@1.0.0',
			'component-bind@1.0.0',
			'component-inherit@0.0.3',
			'indexof@0.0.1',
			'object-component@0.0.3',
			'saucelabs@1.5.0',
		]);
		expect(receipt.metadataSummary.policyUnreviewedDeclarations).toEqual([
			{
				identity: 'json-schema@0.2.3',
				layout: 'package',
				declarations: ['AFLv2.1', 'BSD'],
			},
			{
				identity: '@types/q@0.0.32',
				layout: 'legacy-single-root',
				declarations: ['MIT'],
			},
		]);
		expect(receipt.metadataSummary.uncachedMetadata).toBe('unknown');
		expect(
			receipt.cacheAudit.missing.every((item) => item.metadata === 'unknown-uncached'),
		).toBe(true);
		expect(receipt.proposedAcquisition).toMatchObject({
			state: 'blocked-not-ready',
			consent: { status: 'proposed-unconsumed', consumed: false },
			network: {
				enabled: false,
				requests: 1_498,
				maximumResponseBytes: null,
				maximumAggregateBytes: null,
			},
			transaction: { state: 'not-created', stagingPath: null, publicationPath: null },
		});
		expect(receipt.replay).toMatchObject({
			runs: 2,
			networkAttempts: 0,
			identical: true,
			residue: 'none',
		});
		expect(receipt.replay.firstDigest).toBe(receipt.replay.secondDigest);
		expect(receipt.integrity.canonicalDigest).toHaveLength(64);
	}, 30_000);

	it('publishes atomically once and verifies exact bytes without residue', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t192-receipt-'));
		temporary.push(directory);
		const output = path.join(directory, 'preflight.json');
		const staging = `${output}.staging`;
		const published = await publishDashboardContactsPreflight(output);
		const firstBytes = await readFile(output);
		const verified = await verifyDashboardContactsPreflight(output);
		const secondBytes = await readFile(output);
		expect(secondBytes).toEqual(firstBytes);
		expect(verified.integrity.canonicalDigest).toBe(published.integrity.canonicalDigest);
		expect(firstBytes.toString('utf8')).toBe(`${canonicalize(published)}\n`);
		await expect(access(staging)).rejects.toThrow();
		await expect(publishDashboardContactsPreflight(output)).rejects.toThrow('already exists');
		expect(await readFile(output)).toEqual(firstBytes);

		const blockedOutput = path.join(directory, 'blocked.json');
		const blockedStaging = `${blockedOutput}.staging`;
		await writeFile(blockedStaging, 'preexisting');
		await expect(publishDashboardContactsPreflight(blockedOutput)).rejects.toThrow(
			'staging path already exists',
		);
		expect(await readFile(blockedStaging, 'utf8')).toBe('preexisting');
		await expect(access(blockedOutput)).rejects.toThrow();
	}, 30_000);
});
