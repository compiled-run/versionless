import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import {
	APPSMITH_CONSENT,
	durableAcceptedResponse,
	discoverAppsmithApplicationPackage,
	parseAppsmithJsonc,
	parseAppsmithLauncher,
	parseAppsmithStableVersion,
	selectAppsmithCandidate,
} from '../src/fixture/react-appsmith-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;
afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('Appsmith T685 immutable ingest', () => {
	it('durably persists a response body and sanitized journal row before returning', async () => {
		const destination = await mkdtemp(join(tmpdir(), 'versionless-appsmith-ledger-'));
		const state = { acceptedResponses: 0, aggregateBytes: 0, observations: [], ledger: [] };
		await durableAcceptedResponse(
			state,
			'https://api.github.com/repos/appsmithorg/appsmith',
			200,
			Buffer.from('source'),
			destination,
		);
		expect(await readFile(join(destination, '0001.body'), 'utf8')).toBe('source');
		const row = JSON.parse(await readFile(join(destination, 'journal.ndjson'), 'utf8')) as {
			url: string;
			bodyBytes: number;
			acceptedResponse: boolean;
		};
		expect(row).toMatchObject({
			url: 'https://api.github.com/repos/appsmithorg/appsmith',
			bodyBytes: 6,
			acceptedResponse: true,
		});
	});
	it('accepts BOM, comments, and trailing commas without weakening JSON', () => {
		expect(
			parseAppsmithJsonc('\uFEFF{/*x*/"name":"ui",// y\n"items":[1,],}', 'ui/package.json'),
		).toEqual({ name: 'ui', items: [1] });
	});
	it('rejects duplicate keys and invalid JSONC with a relative path class', () => {
		expect(() => parseAppsmithJsonc('{"name":1,"name":2}', 'ui/package.json')).toThrow(
			'ui/package.json',
		);
		expect(() => parseAppsmithJsonc('{"name":Infinity}', 'ui/package.json')).toThrow(
			'invalid-jsonc',
		);
	});
	it('accepts only stable v1 refs', () => {
		expect(parseAppsmithStableVersion('refs/tags/v1.5.9')).toEqual([1, 5, 9]);
		expect(parseAppsmithStableVersion('refs/tags/1.4.2')).toEqual([1, 4, 2]);
		expect(parseAppsmithStableVersion('refs/tags/v2.0.0')).toBeNull();
		expect(parseAppsmithStableVersion('refs/tags/v1.5.9-rc.1')).toBeNull();
	});
	it('selects greatest SemVer and bytewise ref', () => {
		const common = {
			commit: 'a'.repeat(40),
			tree: 'b'.repeat(40),
			commitDate: '2021-01-01T00:00:00Z',
		};
		expect(
			selectAppsmithCandidate([
				{ ...common, ref: 'refs/tags/v4.12.0', version: [4, 12, 0] },
				{ ...common, ref: 'refs/tags/4.13.0', version: [4, 13, 0] },
				{ ...common, ref: 'refs/tags/v4.13.0', version: [4, 13, 0] },
			]).ref,
		).toBe('refs/tags/4.13.0');
	});
	it('selects a nested authentic UI when the workspace root has no React', () => {
		const shared = {
			ownedWebpackConfigs: 1,
			browserEntry: true,
			search: true,
			detail: true,
			auth: true,
			registryApi: true,
		};
		expect(
			discoverAppsmithApplicationPackage([
				{
					path: 'package.json',
					name: 'appsmith',
					reactMajor: null,
					webpackMajor: null,
					...shared,
				},
				{
					path: 'packages/ui/package.json',
					name: '@appsmith/ui',
					reactMajor: 16,
					webpackMajor: 4,
					...shared,
				},
			]).path,
		).toBe('packages/ui/package.json');
	});
	it('rejects equally qualified nested applications', () => {
		const shared = {
			name: '@appsmith/ui',
			reactMajor: 16,
			webpackMajor: 4,
			ownedWebpackConfigs: 1,
			browserEntry: true,
			search: true,
			detail: true,
			auth: true,
			registryApi: true,
		};
		expect(() =>
			discoverAppsmithApplicationPackage([
				{ path: 'a/package.json', ...shared },
				{ path: 'b/package.json', ...shared },
			]),
		).toThrow('ambiguous');
	});
	it('requires fresh literal consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = APPSMITH_CONSENT;
		expect(
			parseAppsmithLauncher(['--consent-id', APPSMITH_CONSENT, '--namespace', 't685']),
		).toBe('acquire');
	});
	it('allows strict offline replay', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(parseAppsmithLauncher(['--verify-offline', '--namespace', 't685'])).toBe('verify');
	});
});
