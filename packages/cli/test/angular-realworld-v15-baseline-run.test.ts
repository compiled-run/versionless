import { describe, expect, it } from 'vitest';
import {
	ANGULAR_REALWORLD_BUILD_OPTIMIZATION,
	ANGULAR_REALWORLD_LAUNCHER_COMPILE_COMMAND,
	ANGULAR_REALWORLD_LAUNCHER_EXECUTION_COMMAND,
	ANGULAR_REALWORLD_LAUNCHER_OPTIONS,
	T214_BASELINE_FAILURE_HASHES,
	finalizeBaseline,
	verifyBaselineReceipt,
} from '../src/fixture/angular-realworld-v15-baseline-run.ts';
import {
	CHROMIUM_SHA256,
	NODE_ARCHIVE_SHA256,
} from '../src/fixture/angular-realworld-v15-ingest.ts';

describe('Angular RealWorld v15 baseline receipt', () => {
	it('pins the collision-free T214 retry archive hashes', () => {
		expect(T214_BASELINE_FAILURE_HASHES).toEqual({
			receipt: '3a947238d952e6e8879fb2aafb62e1f2e6e72c79648d4f342822543726060400',
			install: 'cc19d1229a3bbeb03a73783ad47819438fedddb5a080b96cd2745650b5026fe8',
			build: '48d017ddf7c72ef3d2eab00ec63a5d6655eff4f082fea192dffc928df2c77b26',
		});
	});

	it('preserves an explicit terminal baseline failure without support uplift', () => {
		const receipt = finalizeBaseline({
			schemaVersion: 'versionless.angular-realworld-v15-baseline.v1',
			result: 'baseline-failed',
			closureManifestSha256: 'b'.repeat(64),
			runtime: {
				node: 'v18.20.8',
				archiveSha256: NODE_ARCHIVE_SHA256,
				npm: '10.8.2',
			},
			install: {
				exitCode: 1,
				offline: true,
				ignoreScripts: true,
				lockUnchanged: true,
				logSha256: 'c'.repeat(64),
			},
			build: {
				attempted: false,
				exitCode: null,
				configuration: 'production',
				aot: true,
				mechanism: 'architect-target-override',
				optimization: ANGULAR_REALWORLD_BUILD_OPTIMIZATION,
				launcher: null,
				logSha256: null,
				distTreeSha256: null,
			},
			smoke: {
				attempted: false,
				result: 'not-run',
				browserSha256: CHROMIUM_SHA256,
				requests: [],
				tagsRequests: 0,
				articlesRequests: 0,
				externalStylesheets: 0,
				pageErrors: [],
				storageInitiallyEmpty: false,
			},
			nonclaims: [
				'No migration, general Angular support, pilot, production, compliance, certification, authenticity, or OS-wide locality claim.',
			],
		});
		expect(verifyBaselineReceipt(receipt)).toEqual(receipt);
		const overclaimed = { ...structuredClone(receipt), result: 'pass' as const };
		expect(() => verifyBaselineReceipt(overclaimed)).toThrow();
	});

	it('requires passing build and smoke proof for a passing receipt', () => {
		const receipt = finalizeBaseline({
			schemaVersion: 'versionless.angular-realworld-v15-baseline.v1',
			result: 'pass',
			closureManifestSha256: 'd'.repeat(64),
			runtime: {
				node: 'v18.20.8',
				archiveSha256: NODE_ARCHIVE_SHA256,
				npm: '10.8.2',
			},
			install: {
				exitCode: 0,
				offline: true,
				ignoreScripts: true,
				lockUnchanged: true,
				logSha256: 'e'.repeat(64),
			},
			build: {
				attempted: true,
				exitCode: 0,
				configuration: 'production',
				aot: true,
				mechanism: 'architect-target-override',
				optimization: ANGULAR_REALWORLD_BUILD_OPTIMIZATION,
				launcher: {
					compiler: 'typescript',
					compilerVersion: 'Version 4.8.4',
					typesNodeVersion: '18.15.11',
					nodeVersion: 'v18.20.8',
					compileCommand: ANGULAR_REALWORLD_LAUNCHER_COMPILE_COMMAND,
					executionCommand: ANGULAR_REALWORLD_LAUNCHER_EXECUTION_COMMAND,
					options: ANGULAR_REALWORLD_LAUNCHER_OPTIONS,
					sourcePath: 'launcher/architect-launcher.cts',
					outputPath: 'launcher-dist/architect-launcher.cjs',
					sourceSha256: '2'.repeat(64),
					outputSha256: '3'.repeat(64),
				},
				logSha256: 'f'.repeat(64),
				distTreeSha256: '1'.repeat(64),
			},
			smoke: {
				attempted: true,
				result: 'pass',
				browserSha256: CHROMIUM_SHA256,
				requests: [],
				tagsRequests: 1,
				articlesRequests: 1,
				externalStylesheets: 3,
				pageErrors: [],
				storageInitiallyEmpty: true,
			},
			nonclaims: ['One immutable baseline only; no migration or support claim.'],
		});
		expect(verifyBaselineReceipt(receipt).result).toBe('pass');
		const { integrity: _integrity, ...receiptWithoutIntegrity } = receipt;
		const wrongOptimization = finalizeBaseline({
			...receiptWithoutIntegrity,
			build: {
				...receipt.build,
				optimization: {
					...ANGULAR_REALWORLD_BUILD_OPTIMIZATION,
					fonts: { inline: true },
				} as unknown as typeof ANGULAR_REALWORLD_BUILD_OPTIMIZATION,
			},
		});
		expect(() => verifyBaselineReceipt(wrongOptimization)).toThrow('facts differ');
		const rejectedRequest = finalizeBaseline({
			...receiptWithoutIntegrity,
			smoke: {
				...receipt.smoke,
				requests: [{ url: 'https://example.invalid/', action: 'rejected' }],
			},
		});
		expect(() => verifyBaselineReceipt(rejectedRequest)).toThrow('facts differ');
	});
});
