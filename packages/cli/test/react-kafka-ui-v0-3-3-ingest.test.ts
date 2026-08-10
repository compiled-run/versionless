import { afterEach, describe, expect, it } from 'vitest';
import {
	KAFKA_UI_CONSENT,
	discoverKafkaUiApplicationPackage,
	parseKafkaUiJsonc,
	parseKafkaUiLauncher,
} from '../src/fixture/react-kafka-ui-v0-3-3-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;
afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('KafkaUi T690 immutable ingest', () => {
	it('accepts BOM, comments, and trailing commas without weakening JSON', () => {
		expect(
			parseKafkaUiJsonc('\uFEFF{/*x*/"name":"ui",// y\n"items":[1,],}', 'ui/package.json'),
		).toEqual({ name: 'ui', items: [1] });
	});
	it('rejects duplicate keys and invalid JSONC with a relative path class', () => {
		expect(() => parseKafkaUiJsonc('{"name":1,"name":2}', 'ui/package.json')).toThrow(
			'ui/package.json',
		);
		expect(() => parseKafkaUiJsonc('{"name":Infinity}', 'ui/package.json')).toThrow(
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
			discoverKafkaUiApplicationPackage([
				{
					path: 'package.json',
					name: 'kafka-ui',
					reactMajor: null,
					webpackMajor: null,
					...shared,
				},
				{
					path: 'packages/ui/package.json',
					name: '@kafka-ui/ui',
					reactMajor: 16,
					webpackMajor: 4,
					...shared,
				},
			]).path,
		).toBe('packages/ui/package.json');
	});
	it('rejects equally qualified nested applications', () => {
		const shared = {
			name: '@kafka-ui/ui',
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
			discoverKafkaUiApplicationPackage([
				{ path: 'a/package.json', ...shared },
				{ path: 'b/package.json', ...shared },
			]),
		).toThrow('ambiguous');
	});
	it('requires fresh literal consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = KAFKA_UI_CONSENT;
		expect(
			parseKafkaUiLauncher(['--consent-id', KAFKA_UI_CONSENT, '--namespace', 't690']),
		).toBe('acquire');
	});
	it('allows strict offline replay', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(parseKafkaUiLauncher(['--verify-offline', '--namespace', 't690'])).toBe('verify');
	});
});
