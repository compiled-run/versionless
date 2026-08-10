import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import {
	MATTERMOST_CONSENT,
	durableAcceptedResponse,
	discoverMattermostApplicationPackage,
	parseMattermostJsonc,
	parseMattermostLauncher,
} from '../src/fixture/react-mattermost-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;
afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('Mattermost T688 immutable ingest', () => {
	it('durably persists a response body and sanitized journal row before returning', async () => {
		const destination = await mkdtemp(join(tmpdir(), 'versionless-mattermost-ledger-'));
		const state = { acceptedResponses: 0, aggregateBytes: 0, observations: [], ledger: [] };
		await durableAcceptedResponse(
			state,
			'https://api.github.com/repos/mattermost/mattermost-webapp',
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
			url: 'https://api.github.com/repos/mattermost/mattermost-webapp',
			bodyBytes: 6,
			acceptedResponse: true,
		});
	});
	it('accepts BOM, comments, and trailing commas without weakening JSON', () => {
		expect(
			parseMattermostJsonc('\uFEFF{/*x*/"name":"ui",// y\n"items":[1,],}', 'ui/package.json'),
		).toEqual({ name: 'ui', items: [1] });
	});
	it('rejects duplicate keys and invalid JSONC with a relative path class', () => {
		expect(() => parseMattermostJsonc('{"name":1,"name":2}', 'ui/package.json')).toThrow(
			'ui/package.json',
		);
		expect(() => parseMattermostJsonc('{"name":Infinity}', 'ui/package.json')).toThrow(
			'invalid-jsonc',
		);
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
			discoverMattermostApplicationPackage([
				{
					path: 'package.json',
					name: 'mattermost',
					reactMajor: null,
					webpackMajor: null,
					...shared,
				},
				{
					path: 'packages/ui/package.json',
					name: '@mattermost/ui',
					reactMajor: 16,
					webpackMajor: 4,
					...shared,
				},
			]).path,
		).toBe('packages/ui/package.json');
	});
	it('rejects equally qualified nested applications', () => {
		const shared = {
			name: '@mattermost/ui',
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
			discoverMattermostApplicationPackage([
				{ path: 'a/package.json', ...shared },
				{ path: 'b/package.json', ...shared },
			]),
		).toThrow('ambiguous');
	});
	it('requires fresh literal consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = MATTERMOST_CONSENT;
		expect(
			parseMattermostLauncher(['--consent-id', MATTERMOST_CONSENT, '--namespace', 't688']),
		).toBe('acquire');
	});
	it('allows strict offline replay', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(parseMattermostLauncher(['--verify-offline', '--namespace', 't688'])).toBe('verify');
	});
});
